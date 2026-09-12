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
run firebase projects:list --json || die "firebase is not authenticated, or cannot reach the API. Run: firebase login"
node -e "
  const fs=require('fs');
  const txt=fs.readFileSync('$LOG','utf8');
  const i=txt.lastIndexOf('{\"status\"');
  if (i<0) process.exit(1);
  const res=JSON.parse(txt.slice(i));
  const ids=(res.result||[]).map(p=>p.projectId);
  if (!ids.includes('$PROJECT')) {
    console.error('Project $PROJECT is not visible to this firebase login. Visible: '+ids.join(', '));
    process.exit(1);
  }
" >> "$LOG" 2>&1 || die "project $PROJECT is not accessible with the current firebase login (see log)"
say "auth:    ok"

for APP in $APPS; do
  case "$APP" in
    mobile-users)   BUNDLE=com.purnazen;        TARGET=wellness;        DISPLAY="PurnaZen (iOS)" ;;
    mobile-doctors) BUNDLE=com.purnazen.doctor; TARGET=purnazendoctor;  DISPLAY="PurnaZen Doctor (iOS)" ;;
    mobile-admin)   BUNDLE=com.purnazen.admin;  TARGET=wellness;        DISPLAY="PurnaZen Admin (iOS)" ;;
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

  APP_ID=$(firebase apps:list IOS --project "$PROJECT" --json 2>>"$LOG" | node -e "
    let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
      try {
        const r=JSON.parse(s).result||[];
        const hit=r.find(a=>(a.bundleId||'')==='$BUNDLE');
        process.stdout.write(hit?hit.appId:'');
      } catch { process.stdout.write(''); }
    });
  ")

  if [ -z "$APP_ID" ]; then
    say "   no iOS app registered for $BUNDLE — creating it"
    run firebase apps:create IOS "$DISPLAY" --bundle-id "$BUNDLE" --project "$PROJECT" \
      || die "firebase apps:create for $BUNDLE"
    APP_ID=$(firebase apps:list IOS --project "$PROJECT" --json 2>>"$LOG" | node -e "
      let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
        try {
          const r=JSON.parse(s).result||[];
          const hit=r.find(a=>(a.bundleId||'')==='$BUNDLE');
          process.stdout.write(hit?hit.appId:'');
        } catch { process.stdout.write(''); }
      });
    ")
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
done

say ""
say "Done. Commit the plist(s): this repo already tracks the Android"
say "google-services.json, and the iOS file follows the same rule — it ships"
say "inside the app binary either way, and CI needs it to build."
