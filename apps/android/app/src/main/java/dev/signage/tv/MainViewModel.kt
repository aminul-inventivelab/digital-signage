package dev.signage.tv

import android.app.Application
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.result.PostgrestResult
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID
import kotlin.random.Random




private const val LOG_TAG = "SignageTV"

private val Application.deviceDataStore by preferencesDataStore(name = "signage_device")

/**
 * PostgREST returns `[{...}]` by default, but `single()` uses `Accept: application/vnd.pgrst.object+json`,
 * which returns `{...}`. supabase-kt's [PostgrestResult.decodeSingle] only accepts a JSON array.
 */
private inline fun <reified T : Any> PostgrestResult.decodeOneRow(): T {
    val payload = data.trim()
    return if (payload.startsWith("[")) decodeSingle<T>() else decodeAs<T>()
}

private object DeviceKeys {
    val DEVICE_ID = stringPreferencesKey("device_id")
    val PAIRING_CODE = stringPreferencesKey("pairing_code")
}

sealed interface MainUiState {
    data object MissingConfig : MainUiState

    data class AwaitingLink(
        val pairingCode: String,
        val deviceId: String,
        val message: String,
    ) : MainUiState

    data class Playback(
        val deviceName: String,
        val deviceId: String,
        val playlistName: String?,
        val slides: List<PlaybackSlide>,
        /** True when tv_get_playback_slides rejected the caller (lost anon session vs registered_session_id). */
        val isRegistrationMismatch: Boolean = false,
    ) : MainUiState

    data class Error(val message: String) : MainUiState
}

@Serializable
data class DeviceInsert(
    @SerialName("pairing_code") val pairingCode: String,
    val name: String = "Android TV",
    val status: String = "pending_pairing",
    @SerialName("registered_session_id") val registeredSessionId: String,
)

@Serializable
data class DeviceRow(
    val id: String,
    @SerialName("owner_id") val ownerId: String? = null,
    @SerialName("pairing_code") val pairingCode: String,
    val name: String,
    val status: String,
)

@Serializable
private data class TvGetPlaybackParams(
    @SerialName("p_device_id")
    val pDeviceId: String,
)

@Serializable
private data class TvGetPlaybackResult(
    val ok: Boolean,
    val playlistName: String? = null,
    val slides: List<TvGetPlaybackSlide> = emptyList(),
)

@Serializable
private data class TvGetPlaybackSlide(
    @SerialName("fileType")
    val fileType: String,
    @SerialName("durationSeconds")
    val durationSeconds: Int? = null,
    @SerialName("storagePath")
    val storagePath: String,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val dataStore = application.deviceDataStore
    private var playbackObserveJob: Job? = null

    private val supabase by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            httpEngine = KtorClientProvider.unsafeHttpClient.engine
            install(Auth)
            install(Postgrest)
        }
    }

    private val _state = MutableStateFlow<MainUiState>(MainUiState.MissingConfig)
    val state: StateFlow<MainUiState> = _state.asStateFlow()

    init {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            _state.value = MainUiState.MissingConfig
        } else {
            viewModelScope.launch {
                runCatching {
                    startRegistrationFlow()
                }.onFailure { throwable ->
                    _state.value = MainUiState.Error(throwable.message ?: "Unexpected error")
                }
            }
        }
    }

    private suspend fun startRegistrationFlow() {
        // Attempt anonymous sign-in but don't crash if disabled
        runCatching { supabase.auth.signInAnonymously() }

        val snapshot = dataStore.data.first()
        val storedDeviceId = snapshot[DeviceKeys.DEVICE_ID]
        val storedPairingCode = snapshot[DeviceKeys.PAIRING_CODE]

        if (storedDeviceId != null && storedPairingCode != null) {
            val visible = fetchDeviceRow(storedDeviceId)
            if (visible != null) {
                if (visible.ownerId != null) {
                    startPlaybackObservation(storedDeviceId, visible.name)
                    return
                }
                _state.value =
                    MainUiState.AwaitingLink(
                        pairingCode = storedPairingCode,
                        deviceId = storedDeviceId,
                        message = "Enter this code in the web dashboard to finish linking.",
                    )
                pollUntilLinked(storedDeviceId)
                return
            }
            // Row not visible to this session (new anonymous user, cleared DB, etc.) — drop stale cache
            dataStore.edit { prefs ->
                prefs.remove(DeviceKeys.DEVICE_ID)
                prefs.remove(DeviceKeys.PAIRING_CODE)
            }
        }

        createNewDeviceAndPoll()
    }

    /** Uses a normal JSON array response (no `.single()`); RLS returns [] if this session cannot see the row. */
    private suspend fun fetchDeviceRow(deviceId: String): DeviceRow? =
        supabase
            .from("devices")
            .select {
                filter {
                    eq("id", deviceId)
                }
            }.decodeList<DeviceRow>()
            .firstOrNull()

    private suspend fun createNewDeviceAndPoll() {
        val pairingCode = generatePairingCode()
        // Use Supabase user ID if available, otherwise generate a persistent installation ID
        val registrationId = supabase.auth.currentUserOrNull()?.id ?: UUID.randomUUID().toString()

        val inserted =
            supabase
                .from("devices")
                .insert(
                    DeviceInsert(
                        pairingCode = pairingCode,
                        registeredSessionId = registrationId,
                    ),
                ) { select() }
                .decodeOneRow<DeviceRow>()

        dataStore.edit { prefs ->
            prefs[DeviceKeys.DEVICE_ID] = inserted.id
            prefs[DeviceKeys.PAIRING_CODE] = inserted.pairingCode
        }

        _state.value =
            MainUiState.AwaitingLink(
                pairingCode = inserted.pairingCode,
                deviceId = inserted.id,
                message = "Waiting for the owner to link this screen…",
            )

        pollUntilLinked(inserted.id)
    }

    private suspend fun pollUntilLinked(deviceId: String) {
        while (true) {
            val row =
                try {
                    fetchDeviceRow(deviceId)
                } catch (_: Exception) {
                    delay(10_000)
                    continue
                }

            if (row == null) {
                // No row: stale local id for this anon session, or device removed — register again
                dataStore.edit { prefs ->
                    prefs.remove(DeviceKeys.DEVICE_ID)
                    prefs.remove(DeviceKeys.PAIRING_CODE)
                }
                createNewDeviceAndPoll()
                return
            }

            if (row.ownerId != null) {
                startPlaybackObservation(deviceId, row.name)
                return
            }

            delay(5_000)
        }
    }

    private fun startPlaybackObservation(deviceId: String, deviceName: String) {
        playbackObserveJob?.cancel()
        playbackObserveJob =
            viewModelScope.launch {
                while (isActive) {
                    try {
                        _state.value = loadPlaybackState(deviceId, deviceName)
                    } catch (e: Exception) {
                        Log.e(LOG_TAG, "loadPlaybackState failed", e)
                        _state.value =
                            MainUiState.Playback(
                                deviceName = deviceName,
                                deviceId = deviceId,
                                playlistName = null,
                                slides = emptyList(),
                                isRegistrationMismatch = false,
                            )
                    }
                    delay(4_000)
                }
            }
    }

    private suspend fun loadPlaybackState(
        deviceId: String,
        deviceName: String,
    ): MainUiState.Playback {
        val res =
            supabase.postgrest.rpc("tv_get_playback_slides", TvGetPlaybackParams(pDeviceId = deviceId))
                .decodeAs<TvGetPlaybackResult>()
        Log.d(LOG_TAG, "tv_get_playback_slides response: ok=${res.ok}, playlistName=${res.playlistName}, slidesCount=${res.slides.size}")
        if (!res.ok) {
            Log.w(
                LOG_TAG,
                "tv_get_playback_slides: this Supabase user is not the registering session for device $deviceId. Use Reset on the TV and link again, or re-pair.",
            )
            return MainUiState.Playback(
                deviceName = deviceName,
                deviceId = deviceId,
                playlistName = null,
                slides = emptyList(),
                isRegistrationMismatch = true,
            )
        }
        val slides =
            res.slides.map { s ->
                PlaybackSlide(
                    url = publicMediaUrl(s.storagePath),
                    fileType = s.fileType,
                    durationSeconds = s.durationSeconds,
                )
            }
        return MainUiState.Playback(
            deviceName = deviceName,
            deviceId = deviceId,
            playlistName = res.playlistName,
            slides = slides,
            isRegistrationMismatch = false,
        )
    }

    private fun publicMediaUrl(storagePath: String): String {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        val encoded =
            storagePath.split("/").joinToString("/") { segment ->
                java.net.URLEncoder.encode(segment, Charsets.UTF_8.name()).replace("+", "%20")
            }
        return "$base/storage/v1/object/public/media/$encoded"
    }

    fun resetRegistration() {
        playbackObserveJob?.cancel()
        playbackObserveJob = null
        viewModelScope.launch {
            runCatching {
                dataStore.edit { prefs ->
                    prefs.remove(DeviceKeys.DEVICE_ID)
                    prefs.remove(DeviceKeys.PAIRING_CODE)
                }
                supabase.auth.signOut()
            }
            _state.value = MainUiState.Error("Cleared local registration. Relaunch the app to generate a new pairing code.")
        }
    }

    private fun generatePairingCode(): String = Random.nextInt(0, 1_000_000).toString().padStart(6, '0')
}
