#!/usr/bin/env bash
# Inject app secrets into the Azure Container App as ENCRYPTED Container Apps
# secrets (not plaintext env), then apply the DB migration.
#
# Reads values from .env.local in the repo root — they never leave your machine
# except into your own Azure resource. Contains NO secret literals itself.
# Run it yourself:
#
#   bash scripts/azure-configure.sh
#
set -euo pipefail

RG="qms-integrated-rg"
APP="qms-integrated"
ENVFILE="$(cd "$(dirname "$0")/.." && pwd)/.env.local"

[ -f "$ENVFILE" ] || { echo "Missing $ENVFILE"; exit 1; }

declare -a SECRETS      # name=value  (for `secret set`)
declare -a ENVREFS      # KEY=secretref:name (for `update --set-env-vars`)

add() {
  local key="$1" val="$2"
  # secret name: lowercase, underscores -> dashes (Container Apps naming rules)
  local name; name="$(echo "$key" | tr 'A-Z_' 'a-z-')"
  SECRETS+=("$name=$val")
  ENVREFS+=("$key=secretref:$name")
}

has_cron=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue;; esac
  key="${line%%=*}"; val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"   # strip one layer of surrounding quotes
  [ -z "$key" ] && continue
  case "$key" in NEXTAUTH_URL|NX_*|TURBO_*|VERCEL*) continue;; esac
  [ "$key" = "CRON_SECRET" ] && has_cron=1
  add "$key" "$val"
done < "$ENVFILE"

# CRON_SECRET (event-bus cron auth): take from .env.local if present, else
# generate a fresh one here. No secret is ever written into this file.
if [ "$has_cron" -eq 0 ]; then
  add "CRON_SECRET" "${CRON_SECRET:-$(openssl rand -hex 32)}"
fi

echo "Setting ${#SECRETS[@]} encrypted secrets on $APP ..."
az containerapp secret set -g "$RG" -n "$APP" --secrets "${SECRETS[@]}" -o none

echo "Wiring env vars to secret references (triggers a new revision) ..."
az containerapp update -g "$RG" -n "$APP" \
  --set-env-vars "${ENVREFS[@]}" "AUTH_TRUST_HOST=true" "NODE_ENV=production" -o none

echo "Applying Drizzle migration to the database ..."
# shellcheck disable=SC1090
set -a; . "$ENVFILE"; set +a
npm run db:migrate

FQDN="$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)"
echo ""
echo "Done. App: https://$FQDN/"
echo "Give the new revision ~30s, then reload."
