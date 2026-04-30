package dev.signage.tv

import android.graphics.Color
import android.util.Log
import android.view.LayoutInflater
import androidx.annotation.OptIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

private const val LOG_TAG = "SignageTV"

@OptIn(UnstableApi::class)
@Composable
fun PlaybackScreen(
    state: MainUiState.Playback,
    viewModel: MainViewModel,
) {
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

    val engine = remember { viewModel.exoForPlayback() }
    val slideKey =
        state.slides.joinToString("|") { s ->
            "${s.url}#${s.fileType}#${s.durationSeconds}"
        }
    var index by remember(slideKey) { mutableIntStateOf(0) }
    var visit by remember(slideKey) { mutableIntStateOf(0) }
    val n = state.slides.size
    val slide = state.slides[index % n]
    val previousSlide = state.slides[(index - 1 + n) % n]
    val holdImageUrlForVideo: String? =
        if (slide.fileType == "video" && previousSlide.fileType != "video") {
            previousSlide.url
        } else {
            null
        }

    LaunchedEffect(index, state.slides) {
        viewModel.onPlaybackSlideContext(index, state.slides)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (slide.fileType) {
            "video" -> {
                val maxSec = slide.durationSeconds
                key(visit, slide.url, maxSec) {
                    val onEnded: () -> Unit = {
                        index = (index + 1) % n
                        visit += 1
                    }
                    SharedExoVideoSlide(
                        url = slide.url,
                        maxDurationSeconds = maxSec,
                        holdImageUrl = holdImageUrlForVideo,
                        onEnded = onEnded,
                        engine = engine,
                    )
                }
            }
            else -> {
                LaunchedEffect(index, slide.url) {
                    engine.onPlayerViewDetached()
                }
                ImageSlide(
                    url = slide.url,
                    durationSeconds = slide.durationSeconds,
                    onDone = {
                        index = (index + 1) % n
                        visit += 1
                    },
                )
            }
        }
    }
}

@OptIn(UnstableApi::class)
@Composable
private fun SharedExoVideoSlide(
    url: String,
    maxDurationSeconds: Int?,
    holdImageUrl: String?,
    onEnded: () -> Unit,
    engine: SignageExoController,
) {
    val onEndState = rememberUpdatedState(onEnded)
    val bindKey = url to maxDurationSeconds
    var lastBound: Pair<String, Int?>? by remember { mutableStateOf(null) }
    var videoRevealed by remember(url, holdImageUrl) {
        mutableStateOf(holdImageUrl == null)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (holdImageUrl != null) {
            HoldUnderImageFullBleed(url = holdImageUrl)
        }
        AndroidView(
            factory = { context ->
                val view = LayoutInflater.from(context).inflate(R.layout.exo_player_texture_view, null) as PlayerView
                view.setEnableComposeSurfaceSyncWorkaround(true)
                view.setShutterBackgroundColor(Color.TRANSPARENT)
                view.setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                view.player = engine.exo
                view
            },
            onRelease = { v -> (v as PlayerView).player = null },
            update = { v ->
                val view = v as PlayerView
                if (view.player == null) {
                    view.player = engine.exo
                }
                view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                if (lastBound != bindKey) {
                    lastBound = bindKey
                    videoRevealed = (holdImageUrl == null)
                    engine.bindCurrentVideoUrl(
                        url = url,
                        maxDurationSeconds = maxDurationSeconds,
                        onEnded = { onEndState.value() },
                        onFirstFrameRendered =
                            if (holdImageUrl != null) {
                                { videoRevealed = true }
                            } else {
                                null
                            },
                    )
                }
            },
            modifier =
                Modifier
                    .fillMaxSize()
                    .then(
                        if (holdImageUrl != null) {
                            Modifier.graphicsLayer {
                                alpha = if (videoRevealed) 1f else 0f
                            }
                        } else {
                            Modifier
                        },
                    ),
        )
    }
}

@Composable
private fun HoldUnderImageFullBleed(url: String) {
    val context = LocalContext.current
    val request =
        remember(url) {
            ImageRequest.Builder(context)
                .data(url)
                .allowHardware(true)
                .build()
        }
    SubcomposeAsyncImage(
        model = request,
        contentDescription = null,
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Crop,
    ) {
        when (painter.state) {
            is AsyncImagePainter.State.Success -> SubcomposeAsyncImageContent()
            is AsyncImagePainter.State.Error,
            is AsyncImagePainter.State.Empty,
            is AsyncImagePainter.State.Loading,
            -> {
                Box(Modifier.fillMaxSize())
            }
        }
    }
}

@Composable
private fun ImageSlide(
    url: String,
    durationSeconds: Int?,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val dwellMs = (durationSeconds ?: 8).coerceIn(2, 120) * 1000L
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

    SubcomposeAsyncImage(
        model = request,
        contentDescription = null,
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Crop,
    ) {
        LaunchedEffect(url, dwellMs) {
            val settled =
                withTimeoutOrNull(120_000) {
                    snapshotFlow { painter.state }.first {
                        it is AsyncImagePainter.State.Success || it is AsyncImagePainter.State.Error
                    }
                }
            when (settled) {
                is AsyncImagePainter.State.Success -> delay(dwellMs)
                is AsyncImagePainter.State.Error -> delay(8_000)
                else -> Unit
            }
            onDone()
        }
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
