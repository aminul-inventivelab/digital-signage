package dev.signage.tv

sealed interface MainUiState {
    /** Initial connect / registration in progress. */
    data object Initializing : MainUiState

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
        /** In-memory; last successful RPC (or cache on cold start) had network payload. */
        val isFromCache: Boolean = false,
        val contentRevision: String? = null,
        val playlistId: String? = null,
        /** Mirrors [DeviceRow.screenOrientation] from poll (dashboard setting). */
        val screenOrientation: String = "landscape",
        /** Admin paused playback in the dashboard; show standby branding instead of slides or errors. */
        val playbackDisabledByAdmin: Boolean = false,
        /**
         * Bumped when the display returns after standby so [kotlinx.coroutines.flow.MutableStateFlow] emits
         * even if the server manifest is unchanged, and so the UI restarts the playlist like a fresh sync.
         */
        val uiRefreshGeneration: Long = 0L,
    ) : MainUiState

    /**
     * Fatal to the main flow. [code] is a [TvUserFacingError] constant for support;
     * details are in logcat, not in [code].
     */
    data class Error(val code: String) : MainUiState
}
