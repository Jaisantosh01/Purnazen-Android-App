#!/usr/bin/env bash
#
# Archive a Purnazen app for iOS, export an App Store Connect .ipa, and
# optionally upload it to TestFlight. Run on a Mac (locally or in CI).
#
#   APPLE_TEAM_ID=ABCDE12345 scripts/archive-ios.sh mobile-users 1.0.7
#   UPLOAD=1 ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_PATH=~/AuthKey.p8 \
#     APPLE_TEAM_ID=ABCDE12345 scripts/archive-ios.sh mobile-doctors 1.0.7
#
# Needs an Apple Developer Program membership (the team id) and, for signing
# without Xcode's GUI, an App Store Connect API key with the App Manager role.
# Xcode's automatic signing creates the distribution certificate and profile
# on first use (-allowProvisioningUpdates), so nothing is exported by hand and
# no .p12 file ever needs to be shared.
#
# Build number: MAJOR*1000000 + MINOR*1000 + PATCH — the same rule Android's
# versionCode follows (see release-mobile.yml). App Store Connect needs a new
# build number for every upload of the same version, so a second upload of
# 1.0.7 passes BUILD_NUMBER=1000007.1 (up to three dot-separated integers are
# allowed, and 1000007.1 sorts after 1000007).
#
# Output: build-logs/ios-archive-<app>.log and build/ios/<app>/ (xcarchive,
# ipa, dSYMs zip).

set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

APP="${1:-}"
VERSION="${2:-}"
[ -n "$APP" ] && [ -n "$VERSION" ] || { sed -n '3,9p' "$0"; exit 2; }

case "$APP" in
  mobile-users)   SCHEME=wellness;       WORKSPACE=wellness;       BUNDLE=com.purnazen ;;
  mobile-doctors) SCHEME=purnazendoctor; WORKSPACE=purnazendoctor; BUNDLE=com.purnazen.doctor ;;
  mobile-admin)   SCHEME=PurnazenAdmin;  WORKSPACE=PurnazenAdmin;  BUNDLE=com.purnazen.admin ;;
  *) echo "Unknown app '$APP' (mobile-users | mobile-doctors | mobile-admin)"; exit 2 ;;
esac

LOG_DIR="$ROOT/build-logs"; mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/ios-archive-$APP.log"; : > "$LOG"
OUT="$ROOT/build/ios/$APP"; mkdir -p "$OUT"

say() { printf '%s\n' "$*" | tee -a "$LOG"; }
run() { printf '\n$ %s\n' "$*" >> "$LOG"; "$@" >> "$LOG" 2>&1; }
die() { say ""; say "FAILED: $*"; say "Full log: $LOG"; tail -n 30 "$LOG"; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "iOS archives need macOS."
[ -n "${APPLE_TEAM_ID:-}" ] || die "APPLE_TEAM_ID is not set. It is the 10-character team id from developer.apple.com > Membership."
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || die "version must be MAJOR.MINOR.PATCH (got '$VERSION')"

if [ -z "${BUILD_NUMBER:-}" ]; then
  MAJ=${VERSION%%.*}; REST=${VERSION#*.}; MIN=${REST%%.*}; PAT=${REST#*.}
  BUILD_NUMBER=$(( MAJ * 1000000 + MIN * 1000 + PAT ))
fi

# App Store Connect API key: lets xcodebuild sign and upload unattended.
AUTH=()
if [ -n "${ASC_KEY_ID:-}" ]; then
  [ -n "${ASC_ISSUER_ID:-}" ] && [ -f "${ASC_KEY_PATH:-}" ] \
    || die "ASC_KEY_ID is set, so ASC_ISSUER_ID and ASC_KEY_PATH (the .p8 file) are required too"
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
elif [ "${UPLOAD:-0}" = "1" ]; then
  die "UPLOAD=1 needs an App Store Connect API key (ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH)"
fi

[ -f "$ROOT/$APP/ios/$SCHEME/GoogleService-Info.plist" ] \
  || die "$APP/ios/$SCHEME/GoogleService-Info.plist is missing — run scripts/ios-firebase-config.sh $APP"

say "=== Purnazen iOS archive ==="
say "app:     $APP ($BUNDLE)"
say "version: $VERSION ($BUILD_NUMBER)"
say "team:    $APPLE_TEAM_ID"
say "upload:  ${UPLOAD:-0}"

cd "$ROOT/$APP"
[ -d node_modules ] || { say "-- npm ci"; run npm ci --no-audit --no-fund || die "npm ci"; }
say "-- pod install"
if [ -f Gemfile ] && command -v bundle >/dev/null; then
  run bundle install || die "bundle install"
  run bundle exec pod install --project-directory=ios || die "pod install"
else
  (cd ios && run pod install) || die "pod install"
fi

ARCHIVE="$OUT/$SCHEME.xcarchive"
rm -rf "$ARCHIVE"
say "-- xcodebuild archive (Release)"
run xcodebuild -workspace "ios/$WORKSPACE.xcworkspace" -scheme "$SCHEME" \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates "${AUTH[@]}" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CODE_SIGN_STYLE=Automatic \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  archive || die "xcodebuild archive"

EXPORT_OPTS="$OUT/ExportOptions.plist"
DESTINATION=export; [ "${UPLOAD:-0}" = "1" ] && DESTINATION=upload
cat > "$EXPORT_OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>testFlightInternalTestingOnly</key><${TESTFLIGHT_INTERNAL_ONLY:-false}/>
</dict>
</plist>
PLIST

say "-- xcodebuild -exportArchive (destination: $DESTINATION)"
run xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_OPTS" -exportPath "$OUT/export" \
  -allowProvisioningUpdates "${AUTH[@]}" || die "xcodebuild -exportArchive"

( cd "$ARCHIVE/dSYMs" 2>/dev/null && zip -qr "$OUT/$APP-$VERSION-dSYMs.zip" . ) || true

say ""
if [ "$DESTINATION" = "upload" ]; then
  say "UPLOADED — $APP $VERSION ($BUILD_NUMBER) is processing in App Store Connect."
  say "It appears in TestFlight in 5–30 minutes."
else
  say "EXPORTED — $(ls "$OUT/export"/*.ipa 2>/dev/null | head -1)"
fi
say "Log: $LOG"
