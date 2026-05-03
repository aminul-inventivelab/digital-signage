package dev.signage.tv

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * When connectivity becomes validated again after an outage, triggers an immediate manifest sync.
 */
internal class PlaybackNetworkObserver(
    context: Context,
    private val onValidatedNetwork: () -> Unit,
) {
    private val appContext = context.applicationContext
    private val connectivity = appContext.getSystemService(ConnectivityManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastValidatedHintElapsedMs = 0L

    private val callback =
        object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities,
            ) {
                if (!networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
                    return
                }
                val now = SystemClock.elapsedRealtime()
                if (now - lastValidatedHintElapsedMs < 2_500L) {
                    return
                }
                lastValidatedHintElapsedMs = now
                // Network callbacks run on ConnectivityThread; ViewModel/lifecycle work must stay on main.
                mainHandler.post { onValidatedNetwork() }
            }
        }

    fun register() {
        connectivity.registerDefaultNetworkCallback(callback)
    }

    fun unregister() {
        runCatching {
            connectivity.unregisterNetworkCallback(callback)
        }
    }
}
