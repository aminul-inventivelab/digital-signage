package dev.signage.tv

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ApplicationPackageTest {
    @Test
    fun targetPackage_isSignageTv() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("dev.signage.tv", context.packageName)
    }
}
