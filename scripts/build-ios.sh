#!/usr/bin/env bash
#
# Build a Purnazen app for iOS. Run this on the Mac — it needs Xcode.
#
#   scripts/build-ios.sh                          # users app, simulator, Debug
#   scripts/build-ios.sh mobile-users             # same, explicit
#   scripts/build-ios.sh mobile-users device      # generic iOS device, Release
#   API_BASE_URL=https://... scripts/build-ios.sh # bake a backend URL into the bundle
#
# Everything — every command and all of its output — goes to
# build-logs/ios-build.log. The terminal gets a short summary. That file is the
# thing to share when a build fails; the interesting error is almost never the
# last line xcodebuild prints.
#
# Not run in CI: GitHub's macOS runners are billed at 10x, and there is no
# signing identity to build a distributable archive with yet. This is the local
# loop until an Apple Developer account and a provisioning profile exist.

set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

APP="${1:-mobile-users}"
TARGET="${2:-simulator}"
LOG_DIR="$ROOT/build-logs"
LOG="$LOG_DIR/ios-build.log"

mkdir -p "$LOG_DIR"
: > "$LOG"

say()  { printf '%s\n' "$*" | tee -a "$LOG"; }
note() { printf '%s\n' "$*" >> "$LOG"; }
run()  {
  note ""
  note "\$ $*"
  "$@" >> "$LOG" 2>&1
}
die()  {
  say ""
  say "FAILED: $*"
  say "Full log: $LOG"
  say ""
  say "Last 40 lines:"
  tail -n 40 "$LOG"
  exit 1
}

case "$APP" in
  mobile-users)   SCHEME=wellness;        WORKSPACE=wellness ;;
  mobile-admin)   SCHEME=wellness;        WORKSPACE=wellness ;;
  mobile-doctors) SCHEME=purnazendoctor;  WORKSPACE=purnazendoctor ;;
  *) echo "Unknown app '$APP' (mobile-users | mobile-doctors | mobile-admin)"; exit 2 ;;
esac

say "=== Purnazen iOS build ==="
say "app:    $APP"
say "target: $TARGET"
say "log:    $LOG"
say ""

# ── Preflight ───────────────────────────────────────────────────────────────
[ "$(uname -s)" = "Darwin" ] || die "iOS builds need macOS. This is $(uname -s)."
command -v node >/dev/null       || die "node not found on PATH."
command -v xcodebuild >/dev/null || die "xcodebuild not found. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app"
xcodebuild -version >> "$LOG" 2>&1 || die "xcodebuild is present but not usable — check 'sudo xcode-select -s /Applications/Xcode.app'."
say "Xcode:  $(xcodebuild -version 2>/dev/null | head -1)"
say "node:   $(node --version)"

cd "$ROOT/$APP"

# ── JS dependencies ─────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  say "-- npm ci (node_modules missing)"
  run npm ci --no-audit --no-fund || die "npm ci"
else
  say "-- node_modules present, skipping npm ci"
fi

# ── Build-time config ───────────────────────────────────────────────────────
# The backend URL is never hardcoded in source; it is inlined into the bundle
# from EXPO_PUBLIC_API_URL. Only written when you pass one, so an existing .env
# is left alone.
if [ -n "${API_BASE_URL:-}" ]; then
  say "-- writing .env (EXPO_PUBLIC_API_URL)"
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$API_BASE_URL" > .env
elif [ ! -f .env ]; then
  say "!! no .env and no API_BASE_URL — the app will fall back to http://localhost:5000"
fi

# ── Firebase ────────────────────────────────────────────────────────────────
# Not needed to compile, but the app calls FirebaseApp.configure() through
# react-native-firebase at launch and will crash on the splash screen without
# it. The file is per-bundle-id: add an iOS app with bundle id com.purnazen in
# the Firebase console and download it.
if [ ! -f "ios/$WORKSPACE/GoogleService-Info.plist" ]; then
  say "!! GoogleService-Info.plist is missing from ios/$WORKSPACE/"
  say "   The build will succeed; the app will crash at launch (sign-in, push"
  say "   and Crashlytics all initialise from it). Firebase console ->"
  say "   Project settings -> Add app -> iOS -> bundle id com.purnazen."
fi

# ── CocoaPods ───────────────────────────────────────────────────────────────
cd ios
if [ -f ../Gemfile ] && command -v bundle >/dev/null; then
  say "-- bundle install"
  ( cd .. && run bundle install ) || die "bundle install (try: gem install bundler)"
  say "-- pod install (bundle exec)"
  ( cd .. && run bundle exec pod install --project-directory=ios ) || die "pod install"
else
  command -v pod >/dev/null || die "CocoaPods not found. Install it: sudo gem install cocoapods"
  say "-- pod install"
  run pod install || die "pod install"
fi

[ -d "$WORKSPACE.xcworkspace" ] || die "pod install did not produce $WORKSPACE.xcworkspace"

# ── xcodebuild ──────────────────────────────────────────────────────────────
if [ "$TARGET" = "device" ]; then
  CONFIG=Release
  DEST='generic/platform=iOS'
  # No signing identity is provisioned yet, so build the binary without trying
  # to sign it. Producing a distributable .ipa needs an Apple Developer account,
  # a bundle-id registration for com.purnazen and a provisioning profile.
  EXTRA=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=)
else
  CONFIG=Debug
  DEST='generic/platform=iOS Simulator'
  EXTRA=()
fi

say "-- xcodebuild ($CONFIG, $DEST)"
say "   this takes a while on a cold build — watch it with: tail -f $LOG"
run xcodebuild \
  -workspace "$WORKSPACE.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "$DEST" \
  -derivedDataPath build/DerivedData \
  "${EXTRA[@]}" \
  build \
  || die "xcodebuild"

say ""
say "BUILD SUCCEEDED"
say "Product: $ROOT/$APP/ios/build/DerivedData/Build/Products/$CONFIG-*/"
say "Log:     $LOG"
