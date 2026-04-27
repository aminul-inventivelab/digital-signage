package dev.signage.tv

import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import androidx.compose.foundation.layout.Box
import androidx.media3.common.MediaItem
import java.util.concurrent.atomic.AtomicBoolean
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import kotlinx.coroutines.delay

private const val LOG_TAG = "SignageTV"

@Composable
fun PlaybackScreen(state: MainUiState.Playback) {
    if (state.isRegistrationMismatch) {
        Box(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text =
                    "This screen lost its link to the server (anonymous session no longer matches).\n" +
                        "In the app, use Reset, then enter the new pairing code on the web dashboard to link again.",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
        }
        return
    }
    if (state.slides.isEmpty()) {
        val message =
            if (state.playlistName == null) {
                "Waiting for an active playlist on this device…\n" +
                    "In the web app, open Devices, pick this screen, and choose a playlist (or create one and add media)."
            } else {
                "This screen’s active playlist is empty (“${state.playlistName}”).\n" +
                    "In the web app, open Playlists (or the device’s playlist editor) and add images or videos, then sync the TV app."
            }
        Box(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    // Full-bleed signage: no titles or metadata over media
    Box(modifier = Modifier.fillMaxSize()) {
        val slideKey =
            state.slides.joinToString("|") { s ->
                "${s.url}#${s.fileType}#${s.durationSeconds}"
            }
        var index by remember(slideKey) { mutableIntStateOf(0) }
        // New key every slide transition so the same (url, video) on later loops is not composed as
        // a reused slot — fixes black video + audio-only on 2nd+ play with SurfaceView/PlayerView.
        var visit by remember(slideKey) { mutableIntStateOf(0) }
        val n = state.slides.size
        val slide = state.slides[index % n]
        val advance: () -> Unit = {
            index = (index + 1) % n
            visit += 1
        }
        when (slide.fileType) {
            "video" -> {
                // visit + duration so server cap changes recompose
                key(visit, slide.url, slide.durationSeconds) {
                    VideoSlide(
                        url = slide.url,
                        maxDurationSeconds = slide.durationSeconds,
                        onEnded = advance,
                    )
                }
            }
            else -> {
                ImageSlide(
                    url = slide.url,
                    durationSeconds = slide.durationSeconds,
                    onDone = advance,
                )
            }
        }
    }
}

@Composable
private fun VideoSlide(
    url: String,
    maxDurationSeconds: Int?,
    onEnded: () -> Unit,
) {
    val onEndedState = rememberUpdatedState(onEnded)
    AndroidView(
        factory = { context ->
            val exo =
                ExoPlayer.Builder(context)
                    .setMediaSourceFactory(
                        DefaultMediaSourceFactory(OkHttpDataSource.Factory(UnsafeOkHttpClient.instance)),
                    )
                    .build()
            val view = LayoutInflater.from(context).inflate(R.layout.exo_player_texture_view, null) as PlayerView
            view.setEnableComposeSurfaceSyncWorkaround(true)
            view.setShutterBackgroundColor(Color.TRANSPARENT)
            view.player = exo
            val handler = Handler(Looper.getMainLooper())
            val finished = AtomicBoolean(false)
            val finish: () -> Unit = {
                if (finished.compareAndSet(false, true)) {
                    handler.removeCallbacksAndMessages(null)
                    runCatching { exo.stop() }
                    onEndedState.value()
                }
            }
            val mediaItem = MediaItem.fromUri(Uri.parse(url))
            val listener =
                object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        if (playbackState == Player.STATE_ENDED) {
                            finish()
                        }
                    }

                    override fun onPlayerError(playbackError: PlaybackException) {
                        Log.e(LOG_TAG, "Video playback error: $url", playbackError)
                        finish()
                    }
                }
            exo.addListener(listener)
            exo.setMediaItem(mediaItem)
            exo.playWhenReady = true
            exo.prepare()
            val maxDelayMs = maxDurationToDelayMs(maxDurationSeconds)
            if (maxDelayMs != null && maxDelayMs in 1..(30L * 60L * 1000L)) {
                handler.postDelayed(finish, maxDelayMs)
            }
            // Tag so onRelease can remove callbacks
            view.setTag(R.id.signage_video_handler, handler)
            view
        },
        modifier = Modifier.fillMaxSize(),
        onRelease = { view ->
            (view.getTag(R.id.signage_video_handler) as? Handler)?.removeCallbacksAndMessages(null)
            val v = view as PlayerView
            val p = v.player
            v.player = null
            p?.stop()
            p?.clearVideoSurface()
            p?.release()
        },
        update = { v ->
            (v as PlayerView).resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
        },
    )
}

@Composable
private fun ImageSlide(
    url: String,
    durationSeconds: Int?,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val waitMs = (durationSeconds ?: 8).coerceIn(2, 120) * 1000L
    val request =
        remember(url) {
            ImageRequest.Builder(context)
                .data(url)
                .listener(
                    onError = { _, result ->
                        Log.e(LOG_TAG, "Image load failed: $url", result.throwable)
                    },
                )
                .build()
        }

    LaunchedEffect(url, waitMs) {
        delay(waitMs)
        onDone()
    }

    // SubcomposeAsyncImage: shows explicit loading/error; plain AsyncImage used to go black on failure.
    SubcomposeAsyncImage(
        model = request,
        contentDescription = null,
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Crop,
    ) {
        when (val s = painter.state) {
            is AsyncImagePainter.State.Success -> SubcomposeAsyncImageContent()
            is AsyncImagePainter.State.Error -> {
                val detail = s.result.throwable?.message ?: s.result.toString()
                Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Could not load image.\n$detail",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            is AsyncImagePainter.State.Loading,
            is AsyncImagePainter.State.Empty,
            -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Loading…",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                }
            }
        }
    }
}

/** When to end playback via timer, or null to rely on end of media only. */
private fun maxDurationToDelayMs(maxDurationSeconds: Int?): Long? =
    maxDurationSeconds?.takeIf { it > 0 }?.times(1000L)
