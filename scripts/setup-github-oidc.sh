#!/usr/bin/env bash
# Create the GitHub Actions OIDC identity for the backend-deploy workflow:
# an Entra app registration + service principal, federated to the repo, with
# AcrPush + Contributor scoped to the PurnaZen resource group.
#
# App-reg + federated-credential creation works for a normal/guest user when the
# directory allows app creation. The ROLE ASSIGNMENTS need Microsoft.Authorization/
# roleAssignments/write (Owner / User Access Administrator / RBAC Administrator) —
# if you are only Contributor, those two steps fail and must be run by an Owner.
set +e
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
cd "$(dirname "$0")/.." || exit 1

APP_NAME=purnazen-github-oidc
GH_REPO=Jaisantosh01/Purnazen-Android-App
RG=PurnaZen

SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
RG_ID=$(az group show -n "$RG" --query id -o tsv)
echo "Sub=$SUB Tenant=$TENANT RG=$RG_ID"

# 1) App registration + service principal (reuse if present)
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null)
if [ -z "$APP_ID" ]; then
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "Created app $APP_ID"
else
  echo "Reusing app $APP_ID"
fi
az ad sp show --id "$APP_ID" >/dev/null 2>&1 || az ad sp create --id "$APP_ID" >/dev/null 2>&1

# 2) Federated credentials — subjects MUST match how the workflows run
cat > scripts/.fc-prod.json <<JSON
{"name":"gh-env-production","issuer":"https://token.actions.githubusercontent.com","subject":"repo:${GH_REPO}:environment:production","audiences":["api://AzureADTokenExchange"]}
JSON
cat > scripts/.fc-main.json <<JSON
{"name":"gh-branch-main","issuer":"https://token.actions.githubusercontent.com","subject":"repo:${GH_REPO}:ref:refs/heads/main","audiences":["api://AzureADTokenExchange"]}
JSON
az ad app federated-credential create --id "$APP_ID" --parameters @scripts/.fc-prod.json 2>&1 | tail -1
az ad app federated-credential create --id "$APP_ID" --parameters @scripts/.fc-main.json 2>&1 | tail -1
rm -f scripts/.fc-prod.json scripts/.fc-main.json

# 3) Roles (need Owner/UAA — will fail for a plain Contributor)
echo "--- attempting role assignments (need Owner) ---"
az role assignment create --assignee "$APP_ID" --role AcrPush     --scope "$RG_ID" 2>&1 | tail -2
az role assignment create --assignee "$APP_ID" --role Contributor --scope "$RG_ID" 2>&1 | tail -2

echo
echo "================= GitHub secrets ================="
echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT"
echo "AZURE_SUBSCRIPTION_ID=$SUB"
echo "=================================================="
echo "Federated subjects: repo:${GH_REPO}:environment:production  and  :ref:refs/heads/main"
echo "Verify roles once an Owner has granted them:"
echo "  az role assignment list --assignee $APP_ID --all -o table"
