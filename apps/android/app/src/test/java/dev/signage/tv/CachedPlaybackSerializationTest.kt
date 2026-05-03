package dev.signage.tv

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class CachedPlaybackSerializationTest {
    private val json =
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

    @Test
    fun cachedPlaybackV1_roundTrip() {
        val original =
            CachedPlaybackV1(
                deviceId = "550e8400-e29b-41d4-a716-446655440000",
                deviceDisplayName = "Lobby TV",
                playlistName = "Promos",
                contentRevision = "rev-1",
                playlistId = "pl-1",
                savedAtMs = 1_700_000_000_000L,
                slides =
                    listOf(
                        PlaybackSlide(
                            url = "https://example.test/a.jpg",
                            fileType = "image",
                            durationSeconds = 12,
                        ),
                    ),
                screenOrientation = "portrait",
            )
        val wire = json.encodeToString(CachedPlaybackV1.serializer(), original)
        val decoded = json.decodeFromString(CachedPlaybackV1.serializer(), wire)
        assertEquals(original, decoded)
    }

    @Test
    fun cachedPlaybackV1_toleratesUnknownFutureKeys() {
        val payload =
            """
            {
              "deviceId": "d1",
              "savedAtMs": 0,
              "futureField": true,
              "slides": []
            }
            """.trimIndent()
        val parsed = json.decodeFromString(CachedPlaybackV1.serializer(), payload)
        assertEquals("d1", parsed.deviceId)
        assertEquals(0L, parsed.savedAtMs)
        assertEquals(emptyList<PlaybackSlide>(), parsed.slides)
    }
}
