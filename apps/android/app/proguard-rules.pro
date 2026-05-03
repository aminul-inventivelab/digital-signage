# --- App (dev.signage.tv) ---
-keepattributes *Annotation*, InnerClasses, Signature

# kotlinx.serialization (models + generated serializers)
-keepnames class kotlinx.serialization.** { *; }
-keepclassmembers @kotlinx.serialization.Serializable class dev.signage.tv.** {
    *** Companion;
}
-keepclasseswithmembers class dev.signage.tv.**$$serializer {
    *** INSTANCE;
}

# OkHttp / Conscrypt optional paths (no warnings from optional TLS stacks)
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn java.lang.invoke.StringConcatFactory

# SLF4J on Android has no binding at compile time
-dontwarn org.slf4j.impl.**
