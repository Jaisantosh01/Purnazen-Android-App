# Reproducible local Android build environment for the Purnazen apps.
# Mirrors the CI toolchain (JDK 17 + Node 22) plus the Android SDK/NDK that the
# GitHub ubuntu runners provide preinstalled, sized to the apps' build.gradle:
#   compile/target SDK 36, build-tools 36.0.0, NDK 27.1.12297006, CMake (vision-camera).
# Gradle itself comes from the project's wrapper (9.3.1).
FROM eclipse-temurin:17-jdk

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    GRADLE_USER_HOME=/cache/gradle \
    npm_config_cache=/cache/npm

# Base tools + Node 22
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl unzip git rsync ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Android command-line tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && curl -fsSL -o /tmp/cmdtools.zip \
       https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip -q /tmp/cmdtools.zip -d ${ANDROID_HOME}/cmdline-tools \
    && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && rm /tmp/cmdtools.zip
ENV PATH=${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools

# SDK packages matching the apps' build.gradle (+ license acceptance)
RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager --install \
       "platform-tools" \
       "platforms;android-36" \
       "build-tools;36.0.0" \
       "ndk;27.1.12297006" \
       "cmake;3.22.1" >/dev/null

WORKDIR /workspace
