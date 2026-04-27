package dev.signage.tv

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory

class SignageTvApp : Application(), ImageLoaderFactory {
    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .okHttpClient(UnsafeOkHttpClient.instance)
            .build()
    }
}
