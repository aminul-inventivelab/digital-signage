package dev.signage.tv

import kotlin.random.Random

/**
 * Pairing codes must match the DB check `^[0-9]{6}$` (see `devices_pairing_code_format` migration).
 */
internal fun formatPairingCodeFromBucket(bucket: Int): String {
    require(bucket in 0 until 1_000_000) { "bucket must be in [0, 999999]" }
    return bucket.toString().padStart(6, '0')
}

internal fun generatePairingCode(random: Random = Random.Default): String =
    formatPairingCodeFromBucket(random.nextInt(0, 1_000_000))
