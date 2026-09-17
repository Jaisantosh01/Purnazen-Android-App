#!/usr/bin/env bash
#
# Fetch (or register) the Firebase iOS app and write its GoogleService-Info.plist.
#
#   scripts/ios-firebase-config.sh                 # mobile-users
#   scripts/ios-firebase-config.sh mobile-doctors
#   scripts/ios-firebase-config.sh all
#
# Run on the Mac — it uses the Firebase CLI and your `firebase login` session.
# The project id is read from the Android google-services.json that is already
# committed, so there is nothing to configure; override with FIREBASE_PROJECT.
#
# This is the file react-native-firebase reads at launch to call
# FirebaseApp.configure(). It is per-bundle-id, and it gets the same treatment
# as the Android google-services.json this repo already tracks: commit it. The
# values in it ship inside the app binary regardless, and CI cannot build
# without it. This script exists so nobody has to click through the console.
#
# Note: registering an iOS app in Firebase does not enable push. That needs an
# APNs key uploaded in the Firebase console, which needs an Apple Developer
# account. Without it the app still runs; pushService.init() fails softly and
# the in-app notification feed keeps working.

set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

LOG_DIR="$ROOT/build-logs"
LOG="$LOG_DIR/ios-firebase-config.log"
mkdir -p "$LOG_DIR"
: > "$LOG"

say()  { printf '%s\n' "$*" | tee -a "$LOG"; }
run()  { printf '\n$ %s\n' "$*" >> "$LOG"; "$@" >> "$LOG" 2>&1; }
die()  { say ""; say "FAILED: $*"; say "Full log: $LOG"; say ""; tail -n 25 "$LOG"; exit 1; }

WANT="${1:-mobile-users}"
case "$WANT" in
  all) APPS="mobile-users mobile-doctors mobile-admin" ;;
  mobile-users|mobile-doctors|mobile-admin) APPS="$WANT" ;;
  *) echo "Usage: $0 [mobile-users|mobile-doctors|mobile-admin|all]"; exit 2 ;;
esac

command -v firebase >/dev/null || die "firebase CLI not found. npm i -g firebase-tools"
command -v node >/dev/null     || die "node not found on PATH."

PROJECT="${FIREBASE_PROJECT:-$(node -e "
  const fs = require('fs');
  const p = 'mobile-users/android/app/google-services.json';
  if (!fs.existsSync(p)) { process.exit(1); }
  process.stdout.write(JSON.parse(fs.readFileSync(p,'utf8')).project_info.project_id);
" 2>/dev/null)}"
[ -n "$PROJECT" ] || die "could not determine the Firebase project id — set FIREBASE_PROJECT."

say "=== Firebase iOS config ==="
say "project: $PROJECT"
say "apps:    $APPS"
say "log:     $LOG"
say ""

# Fails fast and legibly if the CLI session has expired, rather than three
# commands later with a confusing permission error.
#
# Parse the command's stdout, never the log: the CLI pretty-prints its JSON and
# writes progress lines around it, so anything that pattern-matches the log file
# is reading the wrong thing. `json_slice` trims to the first brace and hands the
# rest to a JSON parser, which is the only reliable way to read this output.
json_slice() { node -e "
  let s='';
  process.stdin.on('data', d => s += d).on('end', () => {
    const i = s.indexOf('{');
    process.stdout.write(i < 0 ? '' : s.slice(i));
  });
"; }

PROJECTS_JSON="$(firebase projects:list --json 2>>"$LOG" | json_slice)"
printf '\n$ firebase projects:list --json\n%s\n' "$PROJECTS_JSON" >> "$LOG"
[ -n "$PROJECTS_JSON" ] || die "firebase is not authenticated, or cannot reach the API. Run: firebase login"

VISIBLE="$(printf '%s' "$PROJECTS_JSON" | node -e "
  let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
    try { process.stdout.write((JSON.parse(s).result||[]).map(p=>p.projectId).join(' ')); }
    catch { process.stdout.write(''); }
  });
")"
case " $VISIBLE " in
  *" $PROJECT "*) ;;
  *) die "project $PROJECT is not visible to this firebase login. Visible: ${VISIBLE:-<none>}. Run: firebase login --reauth" ;;
esac
say "auth:    ok"

# Empty output here means "no app with that bundle id" — and, if the output could
# not be read or parsed, it would mean the same thing, so the script would go on
# to create a DUPLICATE app. Hence: unreadable output is a non-zero return, kept
# distinct from an empty result, and the caller turns that into a failure.
#
# Note it returns rather than calling die(): this runs inside "$(...)", where an
# exit only ends the subshell and the script would carry on regardless.
find_app_id() {
  local bundle="$1" raw
  raw="$(firebase apps:list IOS --project "$PROJECT" --json 2>>"$LOG" | json_slice)"
  printf '\n$ firebase apps:list IOS --project %s --json\n%s\n' "$PROJECT" "$raw" >> "$LOG"
  [ -n "$raw" ] || return 1
  printf '%s' "$raw" | node -e "
    let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
      const r = JSON.parse(s).result || [];
      const hit = r.find(a => (a.bundleId || '') === process.argv[1]);
      process.stdout.write(hit ? hit.appId : '');
    });
  " "$bundle"
}

for APP in $APPS; do
  case "$APP" in
    mobile-users)   BUNDLE=com.purnazen;        TARGET=wellness;        DISPLAY="PurnaZen (iOS)" ;;
    mobile-doctors) BUNDLE=com.purnazen.doctor; TARGET=purnazendoctor;  DISPLAY="PurnaZen Doctor (iOS)" ;;
    mobile-admin)   BUNDLE=com.purnazen.admin;  TARGET=PurnazenAdmin;   DISPLAY="PurnaZen Admin (iOS)" ;;
  esac
  DEST_DIR="$ROOT/$APP/ios/$TARGET"
  DEST="$DEST_DIR/GoogleService-Info.plist"

  say ""
  say "-- $APP  ($BUNDLE)"
  [ -d "$DEST_DIR" ] || die "$DEST_DIR does not exist — is the iOS project set up for $APP?"

  # The bundle id in the Xcode project has to match the one registered, or the
  # plist is inert at runtime and Firebase reports a config mismatch.
  PBX="$ROOT/$APP/ios/$TARGET.xcodeproj/project.pbxproj"
  if [ -f "$PBX" ] && ! grep -q "PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE;" "$PBX"; then
    say "   !! $TARGET.xcodeproj does not set PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE"
    say "      Fetching the plist anyway; the app will not find its config until they match."
  fi

  APP_ID="$(find_app_id "$BUNDLE")" \
    || die "could not read the iOS app list from the Firebase CLI (see log)"

  if [ -z "$APP_ID" ]; then
    say "   no iOS app registered for $BUNDLE — creating it"
    run firebase apps:create IOS "$DISPLAY" --bundle-id "$BUNDLE" --project "$PROJECT" \
      || die "firebase apps:create for $BUNDLE"
    APP_ID="$(find_app_id "$BUNDLE")" \
      || die "could not read the iOS app list from the Firebase CLI (see log)"
    [ -n "$APP_ID" ] || die "created the app but could not find it in apps:list"
  fi
  say "   appId:  $APP_ID"

  TMP="$(mktemp -t gsi)"
  firebase apps:sdkconfig IOS "$APP_ID" --project "$PROJECT" > "$TMP" 2>>"$LOG" \
    || die "firebase apps:sdkconfig for $APP_ID"

  # sdkconfig prints progress lines before the file itself; keep from <?xml on.
  node -e "
    const fs=require('fs');
    const t=fs.readFileSync('$TMP','utf8');
    const i=t.indexOf('<?xml');
    if (i<0) { console.error('no plist in sdkconfig output'); process.exit(1); }
    fs.writeFileSync('$DEST', t.slice(i).trimEnd()+'\n');
  " >> "$LOG" 2>&1 || die "could not extract the plist from the sdkconfig output"
  rm -f "$TMP"

  plutil -lint "$DEST" >> "$LOG" 2>&1 || die "$DEST is not a valid plist"
  GOT=$(plutil -extract BUNDLE_ID raw -o - "$DEST" 2>/dev/null)
  [ "$GOT" = "$BUNDLE" ] || die "plist BUNDLE_ID is '$GOT', expected '$BUNDLE'"

  say "   wrote:  ${DEST#$ROOT/}"

  # Firebase's iOS OAuth flow (Google sign-in through signInWithPopup) returns
  # to the app through a URL scheme: the encoded app id, and for Google the
  # reversed client id. Without them the browser sheet opens and never comes
  # back. Derived from the plist just written, so they can never drift.
  INFO="$DEST_DIR/Info.plist"
  ENCODED="app-$(plutil -extract GOOGLE_APP_ID raw -o - "$DEST" | tr ':' '-')"
  REVERSED="$(plutil -extract REVERSED_CLIENT_ID raw -o - "$DEST" 2>/dev/null || true)"
  /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$INFO" >/dev/null 2>&1 || true
  /usr/libexec/PlistBuddy \
    -c "Add :CFBundleURLTypes array" \
    -c "Add :CFBundleURLTypes:0 dict" \
    -c "Add :CFBundleURLTypes:0:CFBundleTypeRole string Editor" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLName string firebase-auth" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $ENCODED" \
    "$INFO" >> "$LOG" 2>&1 || die "could not write URL schemes into $INFO"
  if [ -n "$REVERSED" ]; then
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:1 string $REVERSED" "$INFO" >> "$LOG" 2>&1
  fi
  say "   url schemes: $ENCODED${REVERSED:+, $REVERSED}"
done

say ""
say "Done. Commit the plist(s): this repo already tracks the Android"
say "google-services.json, and the iOS file follows the same rule — it ships"
say "inside the app binary either way, and CI needs it to build."
