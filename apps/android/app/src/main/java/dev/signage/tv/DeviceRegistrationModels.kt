package dev.signage.tv

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

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
    @SerialName("screen_orientation") val screenOrientation: String = "landscape",
)
