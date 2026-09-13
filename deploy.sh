#!/usr/bin/env bash

set -euo pipefail

MODE="dev"

for CANDIDATE in "${1-}" "${2-}"; do
  [ -n "$CANDIDATE" ] || continue
  MODE_LC=$(printf '%s' "$CANDIDATE" | tr '[:upper:]' '[:lower:]')
  case "$MODE_LC" in
    production|prod)
      MODE="production"
      ;;
    development|dev)
      MODE="dev"
      ;;
    *)
      continue
      ;;
  esac
done

if [ "$MODE" = "production" ]; then
  export NODE_ENV=production
  export ZEP_DEBUG=false
else
  export NODE_ENV=development
  export ZEP_DEBUG=true
fi

echo "Deploying with NODE_ENV=${NODE_ENV} (ZEP_DEBUG=${ZEP_DEBUG})"

FLAG_FILE="src/utils/debugFlag.ts"
BACKUP_FILE="${FLAG_FILE}.bak"

if [ -f "$FLAG_FILE" ]; then
  cp "$FLAG_FILE" "$BACKUP_FILE"
fi

cleanup() {
  if [ -f "$BACKUP_FILE" ]; then
    mv "$BACKUP_FILE" "$FLAG_FILE"
  fi
}

trap cleanup EXIT

cat <<EOF > "$FLAG_FILE"
export const DEBUG_FLAG = ${ZEP_DEBUG:-true};
EOF

# Includes NPC tests, build/archive, and the confirmed museum-app target guard.
npm run deploy
