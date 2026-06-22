# Deployment & CI/CD (Azure + GitHub Actions)

How Purnazen ships: the **backend** runs on **Azure Container Apps**, and the
**three Android apps** are built and published as **GitHub Releases**. All
pipelines are **manual** (`workflow_dispatch`) and authenticate to Azure with
**OIDC federated credentials** — no cloud passwords are stored in GitHub.

> TL;DR for an operator who already has everything provisioned:
> Actions tab → **Deploy Backend** (backend) · **Release Mobile Apps** (apps) ·
> **Service Status** (health). Required GitHub config is in [§4](#4-github-configuration).

---

## 1. Architecture

```
GitHub Actions ──OIDC──> Azure AD app (federated)
   │                         │ roles: AcrPush + Contributor (scoped to the RG)
   │ az acr build            ▼
   ├───────────────> Azure Container Registry (purnazen-backend:<tag>)
   │ az containerapp update           │ image pull (managed identity, AcrPull)
   │                                   ▼
   │                         Azure Container Apps  ── HTTPS /health ──> probe
   │                                   │
   │                     env/secrets:  ├─ Azure Database for PostgreSQL (DATABASE_URL)
   │                                   ├─ Azure Cache for Redis        (REDIS_URL, optional)
   │                                   └─ Azure Blob Storage           (uploads)
   │
   └── gradle bundleRelease/assembleRelease ─> signed AAB + APK ─> GitHub Releases
```

Workflows ([.github/workflows/](../.github/workflows/)):

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| Deploy Backend | `deploy-backend.yml` | manual | Build image in ACR → roll Container App → wait for `/health` 200 |
| Release Mobile Apps | `release-mobile.yml` | manual | Signed AAB+APK per app, renamed, → GitHub Release |
| Service Status | `service-status.yml` | manual | Read-only health/status report into the run summary |

---

## 2. One-time Azure provisioning

Requires the Azure CLI (`az`) and an owner/contributor on the subscription. Pick
your own names; the placeholders below are referenced throughout.

```bash
# --- variables (edit these) ---
LOCATION=centralindia
RG=purnazen-rg
ACR=purnazenacr                       # must be globally unique, 5-50 alphanumerics
ENVIRONMENT=purnazen-cae              # Container Apps environment
APP=purnazen-backend                  # Container App name
PG=purnazen-pg                        # Postgres flexible server (globally unique)
PG_ADMIN=pzadmin
PG_DB=wellness_db

# --- resource group ---
az group create -n "$RG" -l "$LOCATION"

# --- container registry ---
az acr create -n "$ACR" -g "$RG" --sku Standard

# --- postgres flexible server + database ---
az postgres flexible-server create \
  -n "$PG" -g "$RG" -l "$LOCATION" \
  --tier Burstable --sku-name Standard_B1ms \
  --admin-user "$PG_ADMIN" --admin-password '<STRONG-PASSWORD>' \
  --version 16 --storage-size 32 --yes
az postgres flexible-server db create -g "$RG" -s "$PG" -d "$PG_DB"
# Allow Azure services to reach it (or use VNet/private endpoint in prod):
az postgres flexible-server firewall-rule create -g "$RG" -n "$PG" \
  --rule-name allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# --- container apps environment ---
az extension add -n containerapp --upgrade
az containerapp env create -n "$ENVIRONMENT" -g "$RG" -l "$LOCATION"
```

Create the Container App from a placeholder image (the deploy workflow replaces
it), with a **system-assigned identity** that can pull from ACR:

```bash
az containerapp create \
  -n "$APP" -g "$RG" --environment "$ENVIRONMENT" \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 5000 --ingress external \
  --min-replicas 1 --max-replicas 3 \
  --system-assigned

# Let the app pull from ACR with its managed identity (no registry passwords):
az containerapp registry set \
  -n "$APP" -g "$RG" \
  --server "${ACR}.azurecr.io" --identity system
```

### App configuration & secrets (kept in Azure, not GitHub)

Store runtime config as **Container App secrets** + env vars. These never touch
GitHub — the deploy workflow only swaps the image.

```bash
PG_HOST=$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv)

az containerapp secret set -n "$APP" -g "$RG" --secrets \
  database-url="postgresql://${PG_ADMIN}:<STRONG-PASSWORD>@${PG_HOST}:5432/${PG_DB}?sslmode=require" \
  secret-key="$(openssl rand -hex 32)" \
  razorpay-key-id="<optional>" \
  razorpay-key-secret="<optional>"

az containerapp update -n "$APP" -g "$RG" --set-env-vars \
  DATABASE_URL=secretref:database-url \
  SECRET_KEY=secretref:secret-key \
  RAZORPAY_KEY_ID=secretref:razorpay-key-id \
  RAZORPAY_KEY_SECRET=secretref:razorpay-key-secret \
  CORS_ORIGINS="https://your-frontend-or-*" \
  WEB_CONCURRENCY=2
```

> Match the env var names the backend expects — see `backend/app/core/config.py`
> and `backend/.env.example`.

---

## 3. OIDC: let GitHub deploy without secrets

Create an Azure AD app + service principal, federate it to this repo, and grant
it least-privilege roles **scoped to the resource group**.

```bash
APP_NAME=purnazen-github-oidc
SUB=$(az account show --query id -o tsv)
RG_ID=$(az group show -n "$RG" --query id -o tsv)

# 1) App registration + service principal
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2) Federated credentials — one per ref you deploy from.
#    Use environment subjects because the workflows target the "production" env.
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name":"gh-env-production",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:<OWNER>/<REPO>:environment:production",
  "audiences":["api://AzureADTokenExchange"]
}'
# Service-status runs on the default branch (no environment):
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name":"gh-branch-main",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:<OWNER>/<REPO>:ref:refs/heads/main",
  "audiences":["api://AzureADTokenExchange"]
}'

# 3) Roles (scoped to the resource group, not the subscription)
az role assignment create --assignee "$APP_ID" --role "AcrPush"      --scope "$RG_ID"
az role assignment create --assignee "$APP_ID" --role "Contributor"  --scope "$RG_ID"
```

Why these roles: `AcrPush` to publish images; `Contributor` (RG-scoped) so
`az acr build` can queue a build and `az containerapp update` can roll the app.
Tighten later with a custom role (`Microsoft.App/containerApps/*`,
`Microsoft.ContainerRegistry/registries/scheduleRun/action`) if desired.

---

## 4. GitHub configuration

**Settings → Secrets and variables → Actions.**

### Repository variables (not secret)

| Variable | Example | Used by |
|---|---|---|
| `AZURE_RESOURCE_GROUP` | `purnazen-rg` | backend, status |
| `ACR_NAME` | `purnazenacr` | backend, status |
| `ACR_LOGIN_SERVER` | `purnazenacr.azurecr.io` | backend |
| `BACKEND_CONTAINERAPP` | `purnazen-backend` | backend, status |
| `POSTGRES_SERVER_NAME` | `purnazen-pg` | status (optional) |

### Repository secrets

| Secret | What it is |
|---|---|
| `AZURE_CLIENT_ID` | the OIDC app's `appId` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `ANDROID_KEYSTORE_BASE64` | base64 of your upload keystore (see §5) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias |
| `ANDROID_KEY_PASSWORD` | key password |

### Environment

Create an environment named **`production`** (Settings → Environments) and add
**Required reviewers** — this turns the backend deploy and the app release into
approval-gated actions. The federated subject `…:environment:production` (§3)
must match this name.

---

## 5. Android signing keystore

Generate **one upload keystore** (reused for all three apps; their distinct
`applicationId`s keep them separate) and store it as secrets — never commit it.

```bash
keytool -genkeypair -v \
  -keystore purnazen-upload.keystore \
  -alias purnazen -keyalg RSA -keysize 2048 -validity 10000

# Encode for the ANDROID_KEYSTORE_BASE64 secret:
base64 -w0 purnazen-upload.keystore > keystore.b64        # Linux
#   macOS: base64 -i purnazen-upload.keystore -o keystore.b64
#   Windows PS: [Convert]::ToBase64String([IO.File]::ReadAllBytes("purnazen-upload.keystore")) > keystore.b64
```

The gradle `release` signing config reads `PURNAZEN_UPLOAD_*` env vars in CI and
falls back to the debug key locally — so `./gradlew assembleRelease` still works
on a dev machine without any secrets.

> Back up this keystore offline. If you ever publish to Google Play, losing it
> means you can't ship updates to the same app listing.

---

## 6. Running the pipelines

### Deploy the backend
Actions → **Deploy Backend** → *Run workflow*:
- **image_tag** — blank uses the short commit SHA.
- **run_migrations** — `true` applies `alembic upgrade head` on container start.

It builds in ACR, rolls the Container App, then polls `/health` and fails if it
doesn't return 200 within ~5 minutes.

### Release the apps
Actions → **Release Mobile Apps** → *Run workflow*:
- **app** — `all` or one app.
- **version** — e.g. `1.0.0` (becomes `versionName`; `versionCode` = run number).
- **release_notes**, **prerelease** — optional.

Produces `purnazen-<app>-v<version>.aab` + `.apk` (+ a `.sha256.txt`) attached to
a GitHub Release tagged `<app>-v<version>`.

### Check status
Actions → **Service Status** → *Run workflow*. Read-only; writes a report
(provisioning state, active revisions, `/health`, recent image tags, latest
releases) to the run summary.

---

## 7. Database migrations

The container entrypoint runs `alembic upgrade head` when `RUN_MIGRATIONS=1`
(the deploy workflow's default). This is safe with **one replica**. If you run
multiple replicas, avoid concurrent migrations:

```bash
# set the app to skip start-up migrations
az containerapp update -n "$APP" -g "$RG" --set-env-vars RUN_MIGRATIONS=0
# run migrations once as an exec into a live replica (or a one-off Job)
az containerapp exec -n "$APP" -g "$RG" --command "alembic upgrade head"
```

Then deploy with **run_migrations = false**.

---

## 8. Security notes

- **No long-lived cloud secrets in GitHub** — Azure auth is OIDC; tokens are
  short-lived and scoped to a federated subject.
- **Least privilege** — roles are scoped to the resource group; the Container
  App pulls images via its managed identity (ACR admin user can stay disabled).
- **App config stays in Azure** — `DATABASE_URL`, `SECRET_KEY`, etc. live as
  Container App secrets, not in the repo or workflow files.
- **Manual + gated** — every workflow is `workflow_dispatch`; deploys/releases
  run in the `production` environment so they can require a reviewer.
- **Signing secrets** are write-only repo secrets; the keystore is never
  committed and is decoded only into the runner's temp dir at build time.
- Rotate the upload keystore passwords and the Postgres admin password
  periodically, and prefer a VNet/private endpoint for Postgres in production.
