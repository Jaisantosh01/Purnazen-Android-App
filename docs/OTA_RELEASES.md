# OTA App Releases (private blob distribution)

**Last updated:** 2026-06-26

The apps self-update from a **private** Azure Blob container, brokered by the
backend. The repo and the APKs stay private; the app only ever receives a
short-lived, read-only SAS download URL minted per request and gated by the
user's JWT. This replaces the old GitHub-Releases poll, which couldn't work
because the prod repo (and its release assets) are private.

## Flow

```
Release CI ──build signed APK──> upload to PRIVATE container  app-releases/
   │                                releases/<app-slug>/<version>/<file>.apk
   └──POST /api/v1/app-releases (X-Release-Token)──> app_releases table (registry)

App (logged in) ──GET /app-releases/latest?app=<slug>──> { version, forced, notes, sha256 }
            └──GET /app-releases/<slug>/<version>/download──> { url: <15-min SAS> } ──> install
```

- Registry source of truth: **`app_releases`** table (migration `a4b5c6d7e8f9`).
  The backend keeps the newest `RELEASE_KEEP_VERSIONS` (default 4) active per app.
- Endpoints (`backend/app/api/v1/endpoints/app_releases.py`):
  - `GET /app-releases/latest?app=<slug>` — JWT; latest version metadata (no URL).
  - `GET /app-releases/<slug>/<version>/download` — JWT; short-lived SAS URL.
  - `POST /app-releases` — **CI only**, `X-Release-Token` header (not user auth).
- App side: `src/services/updateService.js` (all three apps) polls these via the
  api client; `UpdatePrompt` / Settings "Check for Updates" are unchanged.

## One-time setup

### 1. Azure — private container + identity
- In the **existing** storage account, create a container **`app-releases`** with
  **no public access** (private).
- The CI uploads via OIDC, so the federated identity needs the
  **Storage Blob Data Contributor** role on that storage account (or container).

### 2. Azure — OIDC federated credential (for GitHub Actions)
- Create (or reuse) an Entra app registration / user-assigned managed identity.
- Add a **federated credential** for GitHub:
  `repo:Calypsion-Innovations/PurnaZen_Android_App:environment:production`
  (the release job uses `environment: production`).
- Grant it the Storage Blob Data Contributor role from step 1.

### 3. GitHub (prod repo) — secrets & variables
Repository **secrets**:
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` — for `azure/login`.
- `RELEASE_REGISTER_TOKEN` — long random string; must equal the backend env var.

Repository **variables**:
- `AZURE_STORAGE_ACCOUNT` — the storage account **name** (presence of this var is
  what enables the OTA upload steps; absent ⇒ steps are skipped, build still works).
- `AZURE_RELEASES_CONTAINER` — `app-releases` (optional; defaults to that).
- `API_BASE_URL` — already set; used for the register call.

### 4. Backend — environment variables (Container App)
- `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_ACCOUNT_KEY` — already set (reused).
- `AZURE_RELEASES_CONTAINER_NAME=app-releases` (optional; defaults to that).
- `RELEASE_REGISTER_TOKEN` — **same** value as the GitHub secret.
- Optional: `AZURE_RELEASE_SAS_EXPIRY_MINUTES` (default 15),
  `RELEASE_KEEP_VERSIONS` (default 4).

## Release runbook
1. Deploy the backend with the two new migrations applied
   (`alembic upgrade head` → adds `consultation_records` + `app_releases`).
2. Run the **Release Mobile Apps** workflow (app, version, notes, force_update).
   It builds the signed AAB+APK, uploads the APK to `app-releases`, and registers
   the version. (A GitHub Release is still published for archival on the private repo.)
3. In the app, **Settings → Check for Updates** now resolves against the backend.
   A `force_update` release makes the prompt non-dismissible.

## Security notes
- Container is **private**; no anonymous/public URLs ever exist.
- Downloads use **per-request, read-only, single-blob SAS** with a ~15-min TTL —
  the same mechanism already used for scan images and video streaming.
- The storage **account key never leaves the backend**; the app sees only a SAS.
- CI authenticates to Azure via **OIDC** (no long-lived cloud secret in GitHub);
  the only shared secret is `RELEASE_REGISTER_TOKEN`, scoped to the register call
  and compared in constant time server-side.
- Optional integrity: the registry stores each APK's **sha256** (returned by
  `/latest`) for client-side verification before install.
