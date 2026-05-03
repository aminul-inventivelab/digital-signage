package dev.signage.tv

import android.util.Log
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

private const val TAG = "PlaybackRealtime"

/**
 * Subscribes to Postgres changes that affect this device's manifest so we can refetch quickly.
 *
 * We intentionally do **not** subscribe to [public.devices]: [tv_device_heartbeat] updates
 * `last_seen` on an interval and would fire Postgres Changes constantly → playback wake storms and UI freezes.
 * Admin device settings (orientation, pause, name) are picked up by the revision poll instead.
 */
internal class PlaybackRealtimeCoordinator(
    private val supabase: SupabaseClient,
    private val scope: CoroutineScope,
) {
    private var channel: RealtimeChannel? = null
    private var flows: List<Job> = emptyList()
    private var subscribedDeviceId: String? = null
    private var subscribedPlaylistId: String? = null

    fun update(
        deviceId: String,
        playlistId: String?,
        onManifestMaybeStale: () -> Unit,
    ) {
        val pid = playlistId?.takeIf { it.isNotBlank() }
        if (deviceId == subscribedDeviceId && pid == subscribedPlaylistId && channel != null) {
            return
        }
        tearDownChannel()
        subscribedDeviceId = deviceId
        subscribedPlaylistId = pid
        val ch = supabase.realtime.channel("tv-manifest:$deviceId")
        val jobs = mutableListOf<Job>()
        jobs +=
            ch.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "device_playlists"
                filter = "device_id=eq.$deviceId"
            }.onEach {
                Log.d(TAG, "device_playlists change → refresh hint")
                onManifestMaybeStale()
            }.launchIn(scope)
        pid?.let { plId ->
            jobs +=
                ch.postgresChangeFlow<PostgresAction>(schema = "public") {
                    table = "playlist_items"
                    filter = "playlist_id=eq.$plId"
                }.onEach {
                    Log.d(TAG, "playlist_items change → refresh hint")
                    onManifestMaybeStale()
                }.launchIn(scope)
        }
        flows = jobs
        channel = ch
        scope.launch {
            runCatching {
                ch.subscribe()
            }.onFailure { e ->
                Log.w(TAG, "realtime subscribe failed", e)
            }
        }
    }

    private fun tearDownChannel() {
        flows.forEach { it.cancel() }
        flows = emptyList()
        val ch = channel ?: return
        scope.launch {
            runCatching {
                supabase.realtime.removeChannel(ch)
            }.onFailure { e ->
                Log.d(TAG, "removeChannel", e)
            }
        }
        channel = null
    }

    fun disconnect() {
        subscribedDeviceId = null
        subscribedPlaylistId = null
        tearDownChannel()
    }
}
