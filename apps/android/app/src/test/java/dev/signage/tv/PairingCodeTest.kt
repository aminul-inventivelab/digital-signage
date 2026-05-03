package dev.signage.tv

import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingCodeTest {
    @Test
    fun formatPairingCodeFromBucket_padsToSixDigits() {
        assertEquals("000000", formatPairingCodeFromBucket(0))
        assertEquals("000001", formatPairingCodeFromBucket(1))
        assertEquals("000123", formatPairingCodeFromBucket(123))
        assertEquals("999999", formatPairingCodeFromBucket(999_999))
    }

    @Test(expected = IllegalArgumentException::class)
    fun formatPairingCodeFromBucket_rejectsNegative() {
        formatPairingCodeFromBucket(-1)
    }

    @Test(expected = IllegalArgumentException::class)
    fun formatPairingCodeFromBucket_rejectsMillion() {
        formatPairingCodeFromBucket(1_000_000)
    }

    @Test
    fun generatePairingCode_matchesSixDigitPattern() {
        val random = Random(42L)
        repeat(50) {
            val code = generatePairingCode(random)
            assertTrue(code.matches(Regex("^[0-9]{6}$")))
        }
    }
}
