#!/usr/bin/env bash
# Pre-deploy checklist for Fly.io. Run from repo root: ./scripts/fly-preflight.sh
# Requires: flyctl installed and authenticated (fly auth login)

set -e
cd "$(dirname "$0")/.."
APP="${FLY_APP_NAME:-tuneforge}"
VOLUME_NAME="ytmp3_data"
REQUIRED_SECRETS=(ADMIN_USERNAME ADMIN_PASSWORD JWT_SECRET)

echo "=== Fly pre-deploy checklist for app: $APP ==="
echo ""

# 1. App exists and we're logged in
echo -n "1. App status ... "
if fly status -a "$APP" &>/dev/null; then
  echo "OK (app exists)"
else
  echo "FAIL (run: fly launch --no-deploy)"
  exit 1
fi

# 2. Volume exists
echo -n "2. Volume '$VOLUME_NAME' ... "
if fly volumes list -a "$APP" 2>/dev/null | grep -q "$VOLUME_NAME"; then
  echo "OK"
else
  echo "FAIL (run: fly volumes create $VOLUME_NAME --region iad --size 1)"
  exit 1
fi

# 3. Required secrets set
echo -n "3. Secrets ... "
SECRETS=$(fly secrets list -a "$APP" 2>/dev/null || true)
MISSING=()
for s in "${REQUIRED_SECRETS[@]}"; do
  # fly secrets list outputs a table; names may be indented or in columns
  if ! echo "$SECRETS" | grep -qw "$s"; then
    MISSING+=("$s")
  fi
done
if [ ${#MISSING[@]} -eq 0 ]; then
  echo "OK (ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET)"
  if echo "$SECRETS" | grep -qw "GEMINI_API_KEY"; then
    echo "   (GEMINI_API_KEY also set)"
  else
    echo "   (GEMINI_API_KEY not set — optional for AI Autofill)"
  fi
else
  echo "FAIL (missing: ${MISSING[*]})"
  echo "   Run: fly secrets set ADMIN_USERNAME=... ADMIN_PASSWORD=... JWT_SECRET=\$(python3 -c \"import secrets; print(secrets.token_hex(32))\")"
  exit 1
fi

echo ""
echo "All checks passed. Deploy with: fly deploy"
exit 0
