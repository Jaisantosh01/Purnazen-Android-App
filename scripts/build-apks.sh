#!/usr/bin/env bash
# Build signed release APKs for the Purnazen apps locally in Docker, rename them
# purnazen-<app>-v<version>.apk, and drop them in ./release/.
#
# Usage:
#   scripts/build-apks.sh <version> <api_base_url> ["app1 app2 ..."]
# Example:
#   scripts/build-apks.sh 1.0.0 https://purnazen-backend.<region>.azurecontainerapps.io
#
# Keystore: defaults to ./purnazen-upload.keystore with the password in
# ./.keystore-password.txt (override with KEYSTORE_FILE / KEYSTORE_PASSWORD /
# KEY_ALIAS / KEY_PASSWORD env vars). VCODE overrides the versionCode.
set -euo pipefail
# Git-Bash/MSYS mangles container-side paths (/workspace, /release) into Windows
# paths in `docker run` args. Disable conversion and feed Docker the HOST paths
# in Windows form (pwd -W) instead.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
cd "$(dirname "$0")/.."
ROOT=$(pwd)
ROOT_WIN=$(pwd -W 2>/dev/null || pwd)   # D:/Misc/... — Docker-friendly on Windows

VERSION="${1:-1.0.0}"
API_BASE_URL="${2:-}"
APPS="${3:-mobile-users mobile-doctors mobile-admin}"
VCODE="${VCODE:-$(date +%y%m%d%H)}"

if [ -z "$API_BASE_URL" ]; then
  echo "Usage: scripts/build-apks.sh <version> <api_base_url> [\"app1 app2\"]"; exit 1
fi

KS="${KEYSTORE_FILE:-$ROOT/purnazen-upload.keystore}"
KS_PASS="${KEYSTORE_PASSWORD:-$(cat "$ROOT/.keystore-password.txt" 2>/dev/null || true)}"
KEY_ALIAS="${KEY_ALIAS:-purnazen}"
KEY_PASS="${KEY_PASSWORD:-$KS_PASS}"
[ -f "$KS" ] || { echo "ERROR: keystore not found: $KS"; exit 1; }
[ -n "$KS_PASS" ] || { echo "ERROR: keystore password not set"; exit 1; }
KS_WIN=$(cygpath -m "$KS" 2>/dev/null || echo "$KS")   # Windows form for the -v mount

IMAGE=purnazen-android-build
echo ">> Building Docker image $IMAGE (first run downloads the Android SDK/NDK — several minutes)"
docker build -f scripts/android-build.Dockerfile -t "$IMAGE" scripts

mkdir -p "$ROOT/release"
# Gradle/npm caches live in Docker NAMED VOLUMES (inside the Linux VM), not host
# bind mounts: Gradle does atomic dir renames that fail on Windows bind mounts
# ("Could not move temporary workspace ... to immutable location").
docker volume create purnazen-gradle-cache >/dev/null
docker volume create purnazen-npm-cache >/dev/null

for APP in $APPS; do
  echo ">> Building $APP  v$VERSION (versionCode $VCODE)  ->  $API_BASE_URL"
  docker run --rm \
    --memory="${DOCKER_MEMORY:-13g}" --memory-swap="${DOCKER_MEMORY:-13g}" \
    --cpuset-cpus="${DOCKER_CPUSET:-0-3}" \
    -v "${ROOT_WIN}:/workspace:ro" \
    -v "${ROOT_WIN}/release:/release" \
    -v purnazen-gradle-cache:/cache/gradle \
    -v purnazen-npm-cache:/cache/npm \
    -v "${KS_WIN}:/keystore/upload.keystore:ro" \
    -e APP="$APP" -e VERSION="$VERSION" -e VCODE="$VCODE" -e API_BASE_URL="$API_BASE_URL" \
    -e ANDROID_ABIS="${ANDROID_ABIS:-arm64-v8a}" -e GRADLE_WORKERS="${GRADLE_WORKERS:-1}" \
    ${GRADLE_OPTS:+-e GRADLE_OPTS="$GRADLE_OPTS"} \
    -e PURNAZEN_UPLOAD_STORE_FILE=/keystore/upload.keystore \
    -e PURNAZEN_UPLOAD_STORE_PASSWORD="$KS_PASS" \
    -e PURNAZEN_UPLOAD_KEY_ALIAS="$KEY_ALIAS" \
    -e PURNAZEN_UPLOAD_KEY_PASSWORD="$KEY_PASS" \
    "$IMAGE" bash /workspace/scripts/_android-build-inner.sh
done

echo ">> Done. Signed APKs in ./release:"
ls -lh "$ROOT/release"/*.apk 2>/dev/null || true
