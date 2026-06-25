#!/usr/bin/env bash
# Runs INSIDE the build container (see build-apks.sh). Copies one app's source
# out of the read-only mount, installs deps, injects the API URL + APP_VERSION via
# a throwaway .env (never from source), builds a signed release APK into /release.
set -euo pipefail

echo "[inner] $APP  v$VERSION (code $VCODE)  ->  $API_BASE_URL"
SRC="/workspace/$APP"
DST="/build/$APP"
mkdir -p "$DST"
# Copy app source; skip host node_modules + previous gradle outputs (Linux rebuilds them).
rsync -a \
  --exclude node_modules \
  --exclude 'android/.gradle' \
  --exclude 'android/app/build' \
  --exclude 'android/build' \
  --exclude '.env' \
  --exclude '.env.local' \
  "$SRC/" "$DST/"
# Release builds must NOT pick up a local dev .env: Expo's export:embed inlines
# EXPO_PUBLIC_API_URL from .env, which would OVERRIDE the baked BASE_URL (e.g. a
# dev 'http://localhost:5000' .env makes the shipped app call localhost). Excluding
# it makes the bundle use the baked config default — same as GitHub CI (no .env).
cd "$DST"

npm ci

# Inject build-time config via a fresh .env (Expo inlines EXPO_PUBLIC_* at bundle
# time). The dev .env was excluded from the copy above, so this is the only one
# present, and it lives only in this throwaway build copy — the backend URL is
# never read from, or committed to, the source tree (src/config/index.js has no
# real URL, only a localhost dev fallback).
[ -n "${API_BASE_URL:-}" ] || { echo "[inner] ERROR: API_BASE_URL not set"; exit 1; }
cat > .env <<ENV
EXPO_PUBLIC_API_URL=${API_BASE_URL}
EXPO_PUBLIC_APP_VERSION=${VERSION}
ENV
echo "[inner] injected .env -> EXPO_PUBLIC_API_URL=${API_BASE_URL}  EXPO_PUBLIC_APP_VERSION=${VERSION}"

cd android
# gradlew may carry CRLF line endings from a Windows checkout — Linux rejects the
# shebang (`/bin/sh^M: bad interpreter`). Normalise to LF before executing.
sed -i 's/\r$//' gradlew
chmod +x gradlew
# Keep memory bounded: the native (CMake/NDK) C++ build OOM-kills the container if
# it compiles all 4 ABIs in parallel. Build one ABI by default (arm64-v8a covers
# essentially all modern devices) and cap Gradle's heap + worker parallelism.
export GRADLE_OPTS="${GRADLE_OPTS:--Xmx3g -XX:MaxMetaspaceSize=512m}"
ABIS="${ANDROID_ABIS:-arm64-v8a}"
WORKERS="${GRADLE_WORKERS:-1}"
./gradlew --no-daemon --stacktrace --max-workers="$WORKERS" \
  -PreactNativeArchitectures="$ABIS" \
  -PpurnazenVersionName="$VERSION" \
  -PpurnazenVersionCode="$VCODE" \
  :app:assembleRelease

APK=$(find app/build/outputs/apk/release -name '*.apk' | head -n1)
[ -n "$APK" ] || { echo "[inner] ERROR: no APK produced"; exit 1; }
OUT="/release/purnazen-${APP}-v${VERSION}.apk"
cp "$APK" "$OUT"
( cd /release && sha256sum "purnazen-${APP}-v${VERSION}.apk" > "purnazen-${APP}-v${VERSION}.sha256.txt" )
echo "[inner] wrote $OUT"
