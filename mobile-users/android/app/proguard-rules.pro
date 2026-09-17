# R8 / ProGuard rules for release builds.
#
# minifyEnabled + shrinkResources are ON (see build.gradle). Most of what a
# React Native app needs is already supplied by the libraries themselves as
# consumer rules inside their AARs — react-android, hermes-android, firebase,
# ML Kit and OkHttp all ship their own. What follows is the part that cannot
# come from a library: anything reached by reflection from JavaScript, plus
# this app's own native modules.
#
# If a screen works in debug and crashes in release with ClassNotFoundException,
# NoSuchMethodError or "Module ... is not a registered callable module", a keep
# rule is missing here — do not turn minification back off. Read the stack
# trace against the mapping file (build/outputs/mapping/release/mapping.txt,
# uploaded to Crashlytics automatically and attached to the GitHub Release).

# ── React Native bridge ─────────────────────────────────────────────────────
# The bridge finds native modules and their methods reflectively, so the
# annotations and everything wearing them have to survive.
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStripAny
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# JNI entry points: the native side looks these up by name.
-keep class com.facebook.jni.** { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}

# ── This app's native modules ───────────────────────────────────────────────
# Registered by class in MainApplication and then addressed from JS by the
# string in getName(); the ReactPackage/ReactModule classes must keep their
# shape. Deliberately narrower than `-keep class com.purnazen.** { *; }`, which
# would exempt the whole app from shrinking.
-keep class com.purnazen.**.*Package { *; }
-keep class com.purnazen.**.*Module { *; }
-keep class com.purnazen.**.*Receiver { *; }

# ── Hermes ──────────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── Firebase (auth + messaging) ─────────────────────────────────────────────
# Model classes are deserialised reflectively.
-keepattributes Signature,InnerClasses,EnclosingMethod
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── ML Kit face detection (on-device scan quality gate) ─────────────────────
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ── Google Play In-App Updates ──────────────────────────────────────────────
# The library ships consumer rules; this only silences warnings for the optional
# Play Core classes it references but this app does not use.
-dontwarn com.google.android.play.core.**

# ── OkHttp / Okio (axios goes through the RN networking stack) ──────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# ── Keep line numbers so crash reports stay readable ────────────────────────
# Without SourceFile/LineNumberTable every frame reads "Unknown Source".
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
