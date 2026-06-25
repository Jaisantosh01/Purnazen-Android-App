#!/usr/bin/env bash
# Purnazen Azure provisioning — secure path (managed-identity ACR pull + GitHub OIDC).
# Idempotent-ish: safe to re-run; skips resources that already exist where practical.
# Writes all the values you need for GitHub config to scripts/.azure-outputs.env
set +e
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
# Stop Git-Bash/MSYS from mangling ARM resource IDs (/subscriptions/...) into
# Windows paths — this silently broke --registry-identity on the first run.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
cd "$(dirname "$0")/.." || exit 1
LOG=scripts/.provision.log
OUT=scripts/.azure-outputs.env
: > "$LOG"
say(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

# ---------- variables ----------
export LOCATION=centralindia
export RG=purnazen-rg
export SUFFIX=$(openssl rand -hex 3)
export ACR=purnazenacr$SUFFIX
export PG=purnazen-pg-$SUFFIX
export PG_ADMIN=pzadmin
export PG_PASS="$(openssl rand -base64 18 | tr -d '/+=')Aa1!"
export PG_DB=wellness_db
export STORAGE=purnazenst$SUFFIX
export ENVIRONMENT=purnazen-cae
export APP=purnazen-backend
export GH_REPO=Jaisantosh01/Purnazen-Android-App
export APP_NAME=purnazen-github-oidc
say "SUFFIX=$SUFFIX ACR=$ACR PG=$PG STORAGE=$STORAGE"

# ---------- Phase 1: providers + RG ----------
say "Registering providers..."
for p in Microsoft.App Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL \
         Microsoft.OperationalInsights Microsoft.Storage Microsoft.ManagedIdentity; do
  az provider register -n "$p" >>"$LOG" 2>&1
done
say "Creating resource group $RG..."
az group create -n "$RG" -l "$LOCATION" >>"$LOG" 2>&1

# ---------- ACR + build image ----------
say "Creating ACR $ACR (Basic)..."
az acr create -n "$ACR" -g "$RG" --sku Basic >>"$LOG" 2>&1
say "Building backend image in ACR (this can take several minutes)..."
az acr build --registry "$ACR" --image purnazen-backend:v1 --image purnazen-backend:latest \
  --file backend/Dockerfile backend >>"$LOG" 2>&1
# verify build (the local stream can crash on Windows; the run still completes)
BUILD_STATE=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].status" -o tsv 2>>"$LOG")
say "ACR build status: ${BUILD_STATE:-unknown}"

# ---------- Postgres ----------
say "Creating Postgres flexible server $PG (Burstable B1ms)..."
az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOCATION" \
  --tier Burstable --sku-name Standard_B1ms \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASS" \
  --version 16 --storage-size 32 --public-access 0.0.0.0 --yes >>"$LOG" 2>&1
say "Creating database $PG_DB..."
az postgres flexible-server db create -g "$RG" -s "$PG" -n "$PG_DB" >>"$LOG" 2>&1

# ---------- Storage ----------
say "Creating storage account $STORAGE + uploads container..."
az storage account create -n "$STORAGE" -g "$RG" -l "$LOCATION" \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false >>"$LOG" 2>&1
export STORAGE_KEY=$(az storage account keys list -n "$STORAGE" -g "$RG" --query "[0].value" -o tsv 2>>"$LOG")
az storage container create -n uploads --account-name "$STORAGE" --account-key "$STORAGE_KEY" >>"$LOG" 2>&1

# ---------- Container Apps env ----------
say "Ensuring containerapp extension + creating environment $ENVIRONMENT..."
az extension add -n containerapp --upgrade >>"$LOG" 2>&1
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOCATION" >>"$LOG" 2>&1

# ---------- Phase 2: managed identity + container app ----------
say "Creating user-assigned identity + AcrPull role..."
az identity create -n purnazen-app-id -g "$RG" -l "$LOCATION" >>"$LOG" 2>&1
export UAI_ID=$(az identity show -n purnazen-app-id -g "$RG" --query id -o tsv 2>>"$LOG")
export UAI_PRINCIPAL=$(az identity show -n purnazen-app-id -g "$RG" --query principalId -o tsv 2>>"$LOG")
export ACR_ID=$(az acr show -n "$ACR" --query id -o tsv 2>>"$LOG")
az role assignment create --assignee-object-id "$UAI_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal --role AcrPull --scope "$ACR_ID" >>"$LOG" 2>&1
sleep 45

export PG_HOST=$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv 2>>"$LOG")
export DB_URL="postgresql://${PG_ADMIN}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}?sslmode=require"

say "Creating Container App $APP (RUN_MIGRATIONS=0; DB seeded next)..."
az containerapp create -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
  --image "$ACR.azurecr.io/purnazen-backend:v1" \
  --user-assigned "$UAI_ID" \
  --registry-server "$ACR.azurecr.io" --registry-identity "$UAI_ID" \
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

# ---------- Phase 3: seed DB ----------
say "Adding firewall rule for this machine + seeding DB..."
MYIP=$(curl -s -4 https://api.ipify.org)
az postgres flexible-server firewall-rule create -g "$RG" -s "$PG" \
  --name allow-provisioner --start-ip-address "$MYIP" --end-ip-address "$MYIP" >>"$LOG" 2>&1
if [ -x backend/venv312/Scripts/python.exe ]; then
  ( cd backend && DATABASE_URL="$DB_URL" ./venv312/Scripts/python.exe seed.py >>"../$LOG" 2>&1 )
  say "Seed exit: $?"
else
  say "WARN: backend/venv312 python not found; seed skipped — run seed.py manually."
fi

# ---------- Phase 5: GitHub OIDC ----------
say "Creating GitHub OIDC app + federated creds + roles..."
export SUB=$(az account show --query id -o tsv 2>>"$LOG")
export TENANT=$(az account show --query tenantId -o tsv 2>>"$LOG")
export RG_ID=$(az group show -n "$RG" --query id -o tsv 2>>"$LOG")
export APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>>"$LOG")
if [ -z "$APP_ID" ]; then
  export APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv 2>>"$LOG")
  az ad sp create --id "$APP_ID" >>"$LOG" 2>&1
fi
cat > scripts/.fc-prod.json <<JSON
{"name":"gh-env-production","issuer":"https://token.actions.githubusercontent.com","subject":"repo:${GH_REPO}:environment:production","audiences":["api://AzureADTokenExchange"]}
JSON
cat > scripts/.fc-main.json <<JSON
{"name":"gh-branch-main","issuer":"https://token.actions.githubusercontent.com","subject":"repo:${GH_REPO}:ref:refs/heads/main","audiences":["api://AzureADTokenExchange"]}
JSON
az ad app federated-credential create --id "$APP_ID" --parameters @scripts/.fc-prod.json >>"$LOG" 2>&1
az ad app federated-credential create --id "$APP_ID" --parameters @scripts/.fc-main.json >>"$LOG" 2>&1
az role assignment create --assignee "$APP_ID" --role AcrPush     --scope "$RG_ID" >>"$LOG" 2>&1
az role assignment create --assignee "$APP_ID" --role Contributor --scope "$RG_ID" >>"$LOG" 2>&1
rm -f scripts/.fc-prod.json scripts/.fc-main.json
export ACR_LOGIN_SERVER=$(az acr show -n "$ACR" --query loginServer -o tsv 2>>"$LOG")

# ---------- write outputs ----------
cat > "$OUT" <<ENV
# Generated $(date) — values for GitHub config + app config. KEEP PG_PASS SECRET.
LOCATION=$LOCATION
RG=$RG
SUFFIX=$SUFFIX
ACR_NAME=$ACR
ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER
BACKEND_CONTAINERAPP=$APP
POSTGRES_SERVER_NAME=$PG
STORAGE=$STORAGE
BACKEND_FQDN=$FQDN
BACKEND_URL=https://$FQDN
PG_PASS=$PG_PASS
AZURE_CLIENT_ID=$APP_ID
AZURE_TENANT_ID=$TENANT
AZURE_SUBSCRIPTION_ID=$SUB
ENV
say "Wrote $OUT"
say "Health check: $(curl -s https://$FQDN/health 2>>"$LOG")"
say "DONE."
