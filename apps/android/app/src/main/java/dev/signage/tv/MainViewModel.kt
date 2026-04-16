package dev.signage.tv

import android.app.Application
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.random.Random

private val Application.deviceDataStore by preferencesDataStore(name = "signage_device")

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

    data class Linked(val deviceName: String) : MainUiState

    data class Error(val message: String) : MainUiState
}

@Serializable
data class DeviceInsert(
    val pairingCode: String,
    val name: String = "Android TV",
    val status: String = "pending_pairing",
    val registeredSessionId: String,
)

@Serializable
data class DeviceRow(
    val id: String,
    @SerialName("owner_id") val ownerId: String? = null,
    @SerialName("pairing_code") val pairingCode: String,
    val name: String,
    val status: String,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val dataStore = application.deviceDataStore

    private val supabase by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
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
        supabase.auth.signInAnonymously()

        val snapshot = dataStore.data.first()
        val storedDeviceId = snapshot[DeviceKeys.DEVICE_ID]
        val storedPairingCode = snapshot[DeviceKeys.PAIRING_CODE]

        if (storedDeviceId != null && storedPairingCode != null) {
            _state.value =
                MainUiState.AwaitingLink(
                    pairingCode = storedPairingCode,
                    deviceId = storedDeviceId,
                    message = "Enter this code in the web dashboard to finish linking.",
                )
            pollUntilLinked(storedDeviceId)
            return
        }

        val pairingCode = storedPairingCode ?: generatePairingCode()
        val userId = supabase.auth.currentUserOrNull()?.id ?: error("Anonymous session missing")

        val inserted =
            supabase
                .from("devices")
                .insert(
                    DeviceInsert(
                        pairingCode = pairingCode,
                        registeredSessionId = userId,
                    ),
                ) { select() }
                .decodeSingle<DeviceRow>()

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
                supabase
                    .from("devices")
                    .select {
                        filter {
                            eq("id", deviceId)
                        }
                        single()
                    }.decodeSingle<DeviceRow>()

            if (row.ownerId != null) {
                _state.value = MainUiState.Linked(row.name)
                return
            }

            delay(5_000)
        }
    }

    fun resetRegistration() {
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
