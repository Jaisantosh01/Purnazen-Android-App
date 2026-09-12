#!/usr/bin/env bash
#
# Build (and optionally run) a Purnazen app for iOS. Run this on the Mac.
#
#   scripts/build-ios.sh                          # users app -> build + run in the simulator
#   scripts/build-ios.sh mobile-users run         # same, explicit
#   scripts/build-ios.sh mobile-users build       # compile only, no simulator
#   scripts/build-ios.sh mobile-users device      # generic iOS device, Release, unsigned
#
# Everything — every command and all of its output — goes to
# build-logs/ios-build.log, and in `run` mode the simulator's own log for the
# app process is appended after launch. That file is the thing to share when
# something fails; the interesting error is almost never the last line
# xcodebuild prints, and a launch crash never reaches the terminal at all.
#
# Not run in CI: GitHub's macOS runners bill at 10x, and there is no signing
# identity to build a distributable archive with yet.

set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

APP="${1:-mobile-users}"
MODE="${2:-run}"
LOG_DIR="$ROOT/build-logs"
LOG="$LOG_DIR/ios-build.log"

mkdir -p "$LOG_DIR"
: > "$LOG"

say()  { printf '%s\n' "$*" | tee -a "$LOG"; }
note() { printf '%s\n' "$*" >> "$LOG"; }
run()  { note ""; note "\$ $*"; "$@" >> "$LOG" 2>&1; }
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
  mobile-users)   SCHEME=wellness;       WORKSPACE=wellness;       TARGET=wellness;       BUNDLE=com.purnazen ;;
  mobile-admin)   SCHEME=wellness;       WORKSPACE=wellness;       TARGET=wellness;       BUNDLE=com.purnazen.admin ;;
  mobile-doctors) SCHEME=purnazendoctor; WORKSPACE=purnazendoctor; TARGET=purnazendoctor; BUNDLE=com.purnazen.doctor ;;
  *) echo "Unknown app '$APP' (mobile-users | mobile-doctors | mobile-admin)"; exit 2 ;;
esac

case "$MODE" in
  run|build|device) ;;
  simulator) MODE=build ;;   # the old spelling
  *) echo "Unknown mode '$MODE' (run | build | device)"; exit 2 ;;
esac

say "=== Purnazen iOS ==="
say "app:  $APP"
say "mode: $MODE"
say "log:  $LOG"
say ""

# ── Preflight ───────────────────────────────────────────────────────────────
[ "$(uname -s)" = "Darwin" ] || die "iOS builds need macOS. This is $(uname -s)."
command -v node >/dev/null       || die "node not found on PATH."
command -v xcodebuild >/dev/null || die "xcodebuild not found. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app"
xcodebuild -version >> "$LOG" 2>&1 || die "xcodebuild is present but not usable — try: sudo xcode-select -s /Applications/Xcode.app"
say "Xcode: $(xcodebuild -version 2>/dev/null | head -1)"
say "node:  $(node --version)"

cd "$ROOT/$APP"

# ── JS dependencies ─────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  say "-- npm ci (node_modules missing)"
  run npm ci --no-audit --no-fund || die "npm ci"
else
  say "-- node_modules present"
fi

# ── Build-time config ───────────────────────────────────────────────────────
# The backend URL is never hardcoded in source; it is inlined into the bundle
# from EXPO_PUBLIC_API_URL. Only written when you pass one, so an existing .env
# is left alone.
if [ -n "${API_BASE_URL:-}" ]; then
  say "-- writing .env (EXPO_PUBLIC_API_URL=$API_BASE_URL)"
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$API_BASE_URL" > .env
elif [ ! -f .env ]; then
  say "!! no .env and no API_BASE_URL — the app will fall back to http://localhost:5000"
  say "   (the simulator shares the Mac's loopback, so a backend on :5000 works as-is)"
fi

# ── Firebase ────────────────────────────────────────────────────────────────
# Not needed to compile, but react-native-firebase calls FirebaseApp.configure()
# at launch and the app dies on the splash screen without it.
if [ ! -f "ios/$TARGET/GoogleService-Info.plist" ]; then
  say ""
  say "!! ios/$TARGET/GoogleService-Info.plist is missing."
  say "   Fetch it first:  scripts/ios-firebase-config.sh $APP"
  say "   Continuing — the build will succeed and the app will crash at launch."
  say ""
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

DERIVED="$ROOT/$APP/ios/build/DerivedData"

# ── device: compile only, unsigned ──────────────────────────────────────────
if [ "$MODE" = "device" ]; then
  # No signing identity is provisioned yet. Producing a distributable .ipa needs
  # an Apple Developer account, a registered bundle id and a provisioning
  # profile; this just proves the arm64 device slice compiles.
  say "-- xcodebuild (Release, generic iOS device, unsigned)"
  run xcodebuild -workspace "$WORKSPACE.xcworkspace" -scheme "$SCHEME" \
    -configuration Release -destination 'generic/platform=iOS' \
    -derivedDataPath "$DERIVED" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
    build || die "xcodebuild"
  say ""
  say "BUILD SUCCEEDED"
  say "Log: $LOG"
  exit 0
fi

# ── Pick a simulator ────────────────────────────────────────────────────────
# Prefer one that is already booted; otherwise the newest available iPhone, so
# this does not break every time Xcode retires a device name.
SIM_JSON="$(xcrun simctl list devices available --json 2>>"$LOG")"
read -r UDID SIM_NAME <<<"$(node -e "
  const d = JSON.parse(process.argv[1]).devices;
  const all = [];
  for (const [runtime, list] of Object.entries(d)) {
    if (!/iOS/.test(runtime)) continue;
    for (const dev of list) if (dev.isAvailable !== false) all.push({ ...dev, runtime });
  }
  if (!all.length) process.exit(1);
  // A full-size iPhone on the newest runtime, unless something is already
  // booted — in which case use that, so this does not spin up a second
  // simulator next to the one you are looking at.
  const score = x => /iPhone/.test(x.name) ? (/SE/.test(x.name) ? 2 : 3)
                   : /iPad/.test(x.name) ? 1 : 0;
  const pick = all.find(x => x.state === 'Booted') ||
    all.sort((a, b) =>
      score(b) - score(a) ||
      b.runtime.localeCompare(a.runtime, undefined, { numeric: true }) ||
      b.name.localeCompare(a.name, undefined, { numeric: true })
    )[0];
  process.stdout.write(pick.udid + ' ' + pick.name);
" "$SIM_JSON")"
[ -n "${UDID:-}" ] || die "no iOS simulators are installed. Open Xcode > Settings > Components and add an iOS runtime."
say "-- simulator: $SIM_NAME ($UDID)"

run xcrun simctl boot "$UDID"   # already-booted returns non-zero; harmless
run open -a Simulator --args -CurrentDeviceUDID "$UDID"

# ── Metro ───────────────────────────────────────────────────────────────────
# A Debug build loads its JS from Metro rather than from a bundle inside the
# .app, so it has to be running before the app launches — otherwise the app
# opens to a red "No script URL provided" screen that looks like a build
# failure and is not one.
METRO_LOG="$LOG_DIR/metro.log"
if curl -sf --max-time 2 "http://localhost:8081/status" >/dev/null 2>&1; then
  say "-- metro already running on :8081"
else
  say "-- starting metro (log: ${METRO_LOG#$ROOT/})"
  ( cd "$ROOT/$APP" && nohup npx react-native start --port 8081 > "$METRO_LOG" 2>&1 & )
  for _ in $(seq 1 30); do
    curl -sf --max-time 2 "http://localhost:8081/status" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf --max-time 2 "http://localhost:8081/status" >/dev/null 2>&1 \
    || say "!! metro did not come up on :8081 — see ${METRO_LOG#$ROOT/}"
fi

# ── Build for the simulator ─────────────────────────────────────────────────
say "-- xcodebuild (Debug, $SIM_NAME)"
say "   cold builds take a while — watch with: tail -f $LOG"
run xcodebuild -workspace "$WORKSPACE.xcworkspace" -scheme "$SCHEME" \
  -configuration Debug -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  build || die "xcodebuild"

APP_PATH="$(/usr/bin/find "$DERIVED/Build/Products" -maxdepth 2 -name "$TARGET.app" -type d 2>/dev/null | head -n1)"
[ -n "$APP_PATH" ] || die "built, but no $TARGET.app under $DERIVED/Build/Products"
say "-- built: ${APP_PATH#$ROOT/}"

if [ "$MODE" = "build" ]; then
  say ""
  say "BUILD SUCCEEDED (not installed — pass 'run' to launch it)"
  say "Log: $LOG"
  exit 0
fi

# ── Install, launch, and capture what the app says ──────────────────────────
say "-- installing"
run xcrun simctl install "$UDID" "$APP_PATH" || die "simctl install"

say "-- launching $BUNDLE"
run xcrun simctl launch "$UDID" "$BUNDLE" || die "simctl launch"

# Give it long enough to get past Firebase configuration, the native module
# registry and the first JS render — which is where a launch failure happens.
say "-- watching for 25s"
sleep 25

if xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "UIKitApplication:$BUNDLE"; then
  ALIVE=yes
else
  ALIVE=no
fi

# The reason this script harvests the simulator log rather than leaving it to
# the terminal: a Firebase misconfiguration, a missing native module or an
# unhandled JS error at startup kills the app before anything reaches stdout,
# and this is the only evidence that it happened.
note ""
note "=== simulator log, last 60s, process $TARGET ==="
xcrun simctl spawn "$UDID" log show --last 60s --style compact \
  --predicate "processImagePath CONTAINS \"$TARGET\"" >> "$LOG" 2>&1 || true

note ""
note "=== crash reports written in the last 5 minutes ==="
/usr/bin/find "$HOME/Library/Logs/DiagnosticReports" -name "$TARGET*" -mmin -5 2>/dev/null \
  | while read -r f; do note "--- $f"; cat "$f" >> "$LOG" 2>&1; done

say ""
if [ "$ALIVE" = "yes" ]; then
  say "RUNNING — $BUNDLE is up on $SIM_NAME."
else
  say "LAUNCHED, THEN DIED — the process is gone 25s later."
  say "The simulator log and any crash report are at the end of $LOG."
fi
say "Log:   $LOG"
say "Metro: ${METRO_LOG#$ROOT/}"
