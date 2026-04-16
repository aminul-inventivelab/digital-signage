package dev.signage.tv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val signageColors =
    darkColorScheme(
        primary = Color(0xFF2DD4BF),
        onPrimary = Color(0xFF0B1220),
        background = Color(0xFF050B14),
        onBackground = Color(0xFFE2E8F0),
        surface = Color(0xFF0C1524),
        onSurface = Color(0xFFE2E8F0),
    )

@Composable
fun SignageTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = signageColors, typography = Typography, content = content)
}
