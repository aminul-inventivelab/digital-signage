package dev.signage.tv

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Shared [OkHttpClient] for Coil, ExoPlayer upstream data sources, and the Ktor engine used by Supabase.
 * Uses the platform default TLS stack and hostname verification (system trust store).
 *
 * If HTTPS media or API calls fail on a specific device while HTTP-level checks succeed, verify
 * system date/time, OS updates for root CAs, and any captive portal or TLS-inspecting network.
 */
object SignageOkHttpClient {
    val instance: OkHttpClient by lazy { build() }

    private fun build(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }
}
