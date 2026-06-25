#!/usr/bin/env bash
# Purnazen PRODUCTION Azure provisioning (subscription b662f9ac…, tenant jaicalypsion).
#
# The signed-in user is Contributor (+AcrPull/AcrPush) on the PurnaZen RG but NOT
# Owner / User Access Administrator, so it CANNOT create role assignments. That
# rules out the managed-identity ACR pull and GitHub OIDC (both need
# Microsoft.Authorization/roleAssignments/write). We therefore pull the image
# with ACR ADMIN CREDENTIALS — the only path available to a Contributor. An Owner
# can later switch to managed identity + wire OIDC for CI.
#
# Reuses the existing RG (PurnaZen) and storage account (purnazenblob).
# Idempotent-ish: skips resources that already exist where practical.
set +e
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'   # stop Git-Bash mangling ARM IDs
cd "$(dirname "$0")/.." || exit 1
LOG=scripts/.provision-prod.log
OUT=scripts/.azure-prod-outputs.env
: > "$LOG"
say(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# ---------- fixed context (must match the production subscription) ----------
export EXPECT_SUB=b662f9ac-5a22-464b-8cd7-86902aad7842
export LOCATION=centralindia
export RG=PurnaZen
export STORAGE=purnazenblob          # existing
export PG_ADMIN=pzadmin
export PG_PASS="$(openssl rand -base64 18 | tr -d '/+=')Aa1!"
export PG_DB=wellness_db
export ENVIRONMENT=purnazen-cae
export APP=purnazen-backend
export SUFFIX=$(openssl rand -hex 3)
export ACR=purnazenacr$SUFFIX        # globally unique
export PG=purnazen-pg-$SUFFIX        # globally unique

# ---------- safety: confirm we're on the right subscription ----------
CUR_SUB=$(az account show --query id -o tsv 2>>"$LOG")
say "Current subscription: $CUR_SUB"
if [ "$CUR_SUB" != "$EXPECT_SUB" ]; then
  say "ERROR: not on the production subscription ($EXPECT_SUB). Run: az account set --subscription $EXPECT_SUB"
  exit 1
fi
az group show -n "$RG" >/dev/null 2>>"$LOG" || { say "ERROR: RG $RG not found"; exit 1; }
say "SUFFIX=$SUFFIX ACR=$ACR PG=$PG  (RG=$RG, STORAGE=$STORAGE reused)"

# ---------- Storage: ensure the uploads container exists ----------
say "Ensuring 'uploads' container in $STORAGE..."
export STORAGE_KEY=$(az storage account keys list -n "$STORAGE" -g "$RG" --query "[0].value" -o tsv 2>>"$LOG")
az storage container create -n uploads --account-name "$STORAGE" --account-key "$STORAGE_KEY" >>"$LOG" 2>&1

# ---------- ACR (Basic) + admin creds + build image ----------
say "Creating ACR $ACR (Basic)..."
az acr create -n "$ACR" -g "$RG" --sku Basic >>"$LOG" 2>&1
az acr update -n "$ACR" --admin-enabled true >>"$LOG" 2>&1
say "Building backend image in ACR (several minutes; local log stream may Unicode-crash on Windows — build still runs)..."
az acr build --registry "$ACR" --image purnazen-backend:v1 --image purnazen-backend:latest \
  --file backend/Dockerfile backend >>"$LOG" 2>&1
BUILD_STATE=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].status" -o tsv 2>>"$LOG")
say "ACR build status: ${BUILD_STATE:-unknown}"
export ACR_LOGIN_SERVER=$(az acr show -n "$ACR" --query loginServer -o tsv 2>>"$LOG")
export ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv 2>>"$LOG")
export ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv 2>>"$LOG")

# ---------- Postgres (Burstable B1ms) + DB ----------
say "Creating Postgres flexible server $PG (Burstable B1ms)..."
az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOCATION" \
  --tier Burstable --sku-name Standard_B1ms \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASS" \
  --version 16 --storage-size 32 --public-access 0.0.0.0 --yes >>"$LOG" 2>&1
say "Creating database $PG_DB..."
az postgres flexible-server db create -g "$RG" -s "$PG" -n "$PG_DB" >>"$LOG" 2>&1
export PG_HOST=$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv 2>>"$LOG")
export DB_URL="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}?sslmode=require"

# ---------- Container Apps environment ----------
say "Ensuring containerapp extension + environment $ENVIRONMENT..."
az extension add -n containerapp --upgrade >>"$LOG" 2>&1
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOCATION" >>"$LOG" 2>&1

# ---------- Container App (admin-cred pull; RUN_MIGRATIONS=0, DB seeded next) ----------
say "Creating Container App $APP (admin-cred pull)..."
az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
  --image "$ACR_LOGIN_SERVER/purnazen-backend:v1" \
  --registry-server "$ACR_LOGIN_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
  --target-port 5000 --ingress external \
  --min-replicas 1 --max-replicas 3 --cpu 1.0 --memory 2.0Gi \
  --secrets database-url="$DB_URL" secret-key="$(openssl rand -hex 32)" \
            jwt-secret-key="$(openssl rand -hex 32)" storage-key="$STORAGE_KEY" \
  --env-vars DATABASE_URL=secretref:database-url SECRET_KEY=secretref:secret-key \
             JWT_SECRET_KEY=secretref:jwt-secret-key \
             AZURE_STORAGE_ACCOUNT_NAME="$STORAGE" AZURE_STORAGE_ACCOUNT_KEY=secretref:storage-key \
             AZURE_BLOB_CONTAINER_NAME=uploads CORS_ORIGINS='*' WEB_CONCURRENCY=2 RUN_MIGRATIONS=0 >>"$LOG" 2>&1
export FQDN=$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv 2>>"$LOG")
say "BACKEND FQDN: $FQDN"

# ---------- Seed the DB (alembic can't build a fresh schema; use seed.py create_all) ----------
say "Adding firewall rule for this machine + seeding DB..."
MYIP=$(curl -s -4 https://api.ipify.org)
az postgres flexible-server firewall-rule create -g "$RG" -s "$PG" \
  --name allow-provisioner --start-ip-address "$MYIP" --end-ip-address "$MYIP" >>"$LOG" 2>&1
if [ -x backend/venv312/Scripts/python.exe ]; then
  ( cd backend && DATABASE_URL="$DB_URL" ./venv312/Scripts/python.exe seed.py >>"../$LOG" 2>&1 )
  say "Seed exit: $?"
else
  say "WARN: backend/venv312 python not found; seed SKIPPED — run seed.py manually with DATABASE_URL."
fi

# ---------- Verify ----------
say "Health: $(curl -s -m 20 https://$FQDN/health 2>>"$LOG")"

# ---------- Outputs ----------
cat > "$OUT" <<ENV
# Generated $(date) — PRODUCTION. KEEP SECRET (PG_PASS, ACR_PASS).
SUBSCRIPTION=$CUR_SUB
LOCATION=$LOCATION
RG=$RG
ACR_NAME=$ACR
ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER
ACR_USER=$ACR_USER
ACR_PASS=$ACR_PASS
BACKEND_CONTAINERAPP=$APP
POSTGRES_SERVER_NAME=$PG
PG_PASS=$PG_PASS
STORAGE=$STORAGE
BACKEND_FQDN=$FQDN
BACKEND_URL=https://$FQDN
ENV
say "Wrote $OUT"
say "DONE."
