#!/usr/bin/env bash
#
# Prove the Firebase API keys we commit are locked to our own apps.
#
#   scripts/check-api-key-restrictions.sh
#
# The keys in google-services.json / GoogleService-Info.plist are public — they
# ship inside every build. That is fine *only* while each key carries an
# application restriction (Android package + SHA-1, or iOS bundle id) and an
# API allowlist. Unrestricted, anyone who copies the key out of the repo or out
# of the APK can burn quota on every API enabled in the project and hammer
# Identity Toolkit.
#
# This calls Identity Toolkit from a plain HTTP client — no bundle id, no
# package signature, nothing an app would send. A restricted key must refuse.
# Read-only: createAuthUri only reports which providers an identifier has.
#
# Exit 0 = every key refused us. 1 = at least one is wide open. 2 = no verdict.
set -uo pipefail
cd "$(dirname "$0")/.."

KEYS="$(grep -rhoE 'AIza[0-9A-Za-z_-]{35}' \
          mobile-*/android/app/google-services.json \
          mobile-*/ios/*/GoogleService-Info.plist 2>/dev/null | sort -u)"

[ -n "$KEYS" ] || { echo "no Firebase API keys found in the committed config files"; exit 1; }

open=0
for key in $KEYS; do
  body="$(curl -sS --retry 2 --retry-all-errors -X POST \
    "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=$key" \
    -H 'Content-Type: application/json' \
    -d '{"identifier":"restriction-probe@example.com","continueUri":"http://localhost"}')"
  rc=$?

  # A transport failure is not a refusal. Calling it "restricted" is the one
  # wrong answer this script can give, so stop rather than guess.
  if [ "$rc" -ne 0 ] || [ -z "$body" ]; then
    echo "UNKNOWN       ${key:0:12}...  could not reach Identity Toolkit (curl exit $rc)"
    exit 2
  fi

  if printf '%s' "$body" | grep -q 'sessionId'; then
    echo "UNRESTRICTED  ${key:0:12}...  accepted a request from plain curl"
    open=1
  else
    reason="$(printf '%s' "$body" | grep -oE '"message": *"[^"]+"' | head -1)"
    echo "restricted    ${key:0:12}...  ${reason:-refused}"
  fi
done

if [ "$open" -eq 1 ]; then
  echo
  echo "Restrict the key(s): https://console.cloud.google.com/apis/credentials"
  echo "Steps and the minimal API allowlist: docs/FIREBASE.md section 5."
  exit 1
fi
