#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Migrate the QMS app fully onto Azure:
#   • Azure Database for PostgreSQL (Flexible Server)  ← replaces Supabase DB
#   • Azure Blob Storage                               ← already provisioned
#   • Wire both into the Container App as ENCRYPTED secrets
#   • Create the schema (Drizzle migrations) on the new DB
#
# Run this yourself (it generates/handles secrets locally, none are hardcoded):
#   bash scripts/azure-migrate.sh
#
# Prereqs: `az login` done; run from the repo root; .env.local present
# (used only to carry over AUTH_SECRET / OAuth / email if you have them).
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

RG="qms-integrated-rg"
LOC="eastus"
APP="qms-integrated"
PG="qms-integrated-pg8e0ca2f"        # globally-unique server name
PGADMIN="qmsadmin"
PGDB="qms"
STOR="qmsintgstor8e0ca2f"            # storage account created earlier
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVFILE="$ROOT/.env.local"

# URL-safe admin password meeting Azure complexity (upper+lower+digit+special).
PGPASS="Qx7_$(openssl rand -hex 20)"

echo "▶ Creating Azure PostgreSQL flexible server ($PG) — a few minutes..."
if ! az postgres flexible-server show -g "$RG" -n "$PG" >/dev/null 2>&1; then
  az postgres flexible-server create \
    -g "$RG" -n "$PG" -l "$LOC" \
    --admin-user "$PGADMIN" --admin-password "$PGPASS" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --public-access 0.0.0.0 --yes -o none
else
  echo "  server exists — resetting admin password"
  az postgres flexible-server update -g "$RG" -n "$PG" --admin-password "$PGPASS" -o none
fi

echo "▶ Allowing this machine's IP through the PG firewall (for migration)..."
MYIP="$(curl -s https://ifconfig.me || echo '')"
[ -n "$MYIP" ] && az postgres flexible-server firewall-rule create -g "$RG" -n "$PG" \
  --rule-name client-migrate --start-ip-address "$MYIP" --end-ip-address "$MYIP" -o none || true

echo "▶ Ensuring database '$PGDB' exists..."
az postgres flexible-server db create -g "$RG" -s "$PG" -d "$PGDB" -o none 2>/dev/null || true

PGHOST="$PG.postgres.database.azure.com"
PG_URL="postgresql://$PGADMIN:$PGPASS@$PGHOST:5432/$PGDB?sslmode=require"

echo "▶ Fetching Blob Storage connection string..."
STOR_CONN="$(az storage account show-connection-string -g "$RG" -n "$STOR" --query connectionString -o tsv)"

# AUTH_SECRET: reuse from .env.local if set, else generate a fresh one.
AUTH_SECRET_VAL="$(grep -E '^AUTH_SECRET=' "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)"
[ -z "$AUTH_SECRET_VAL" ] && AUTH_SECRET_VAL="$(openssl rand -base64 32)"
CRON_VAL="$(openssl rand -hex 32)"

# Optional OAuth / email carried over from .env.local if present.
declare -a SECRETS ENVREFS
secref() { local k="$1" v="$2"; [ -z "$v" ] && return; local n; n="$(echo "$k"|tr 'A-Z_' 'a-z-')"; SECRETS+=("$n=$v"); ENVREFS+=("$k=secretref:$n"); }
getenv() { grep -E "^$1=" "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true; }

secref POSTGRES_URL "$PG_URL"
secref AZURE_STORAGE_CONNECTION_STRING "$STOR_CONN"
secref AUTH_SECRET "$AUTH_SECRET_VAL"
secref CRON_SECRET "$CRON_VAL"
for k in AUTH_GOOGLE_ID AUTH_GOOGLE_SECRET AUTH_GITHUB_ID AUTH_GITHUB_SECRET \
         AUTH_RESEND_KEY AUTH_AUTH0_ID AUTH_AUTH0_SECRET AUTH_AUTH0_DOMAIN; do
  secref "$k" "$(getenv "$k")"
done

echo "▶ Setting ${#SECRETS[@]} encrypted secrets on the Container App..."
az containerapp secret set -g "$RG" -n "$APP" --secrets "${SECRETS[@]}" -o none

echo "▶ Wiring env vars (secret refs + Blob container) — triggers new revision..."
az containerapp update -g "$RG" -n "$APP" \
  --set-env-vars "${ENVREFS[@]}" \
    "AZURE_STORAGE_CONTAINER=uploads" "AUTH_TRUST_HOST=true" "NODE_ENV=production" \
    'EMAIL_FROM=QMS <noreply@sparkiq.ai>' -o none

echo "▶ Creating schema on the new Azure database (Drizzle migrate)..."
( cd "$ROOT" && POSTGRES_URL="$PG_URL" POSTGRES_SSL=true npm run db:migrate )

FQDN="$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)"
echo ""
echo "✅ Done. The app is now fully on Azure (Postgres + Blob)."
echo "   URL: https://$FQDN/"
echo "   Give the new revision ~30s, then open it and register the first user."
echo ""
echo "ℹ️  This is a FRESH database (no users yet) — sign up to create the admin."
echo "    To copy data from the old Supabase DB instead, tell me and I'll add a pg_dump step."
