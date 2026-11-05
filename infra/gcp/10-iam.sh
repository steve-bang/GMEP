#!/usr/bin/env bash
# Step 2 (needs roles/resourcemanager.projectIamAdmin + roles/iam.serviceAccountAdmin + roles/iam.workloadIdentityPoolAdmin):
# service accounts, least-privilege IAM and Workload Identity Federation for GitHub Actions. Idempotent. Dry-run by default.
#
# Service accounts
#   gmep-run       identity of the Cloud Run service (Admin SDK: Firestore, Auth, files bucket, secrets)
#   scheduler      identity Cloud Scheduler uses to mint the OIDC token (src/platform/auth/cronAuth.ts)
#   gmep-deployer  identity GitHub Actions impersonates through WIF (no long-lived key anywhere)
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "iam"
require_var GITHUB_REPOSITORY # OWNER/REPO, e.g. the repository that hosts .github/workflows/deploy-staging.yml

POOL="${WIF_POOL:-github}"
PROVIDER="${WIF_PROVIDER:-github-oidc}"

for sa in "$RUN_SA_NAME:GMEP Cloud Run" "$SCHEDULER_SA_NAME:GMEP Cloud Scheduler (OIDC caller)" "$DEPLOYER_SA_NAME:GMEP GitHub deployer (WIF)"; do
  ensure "service account ${sa%%:*}" -- \
    gcloud iam service-accounts describe "${sa%%:*}@${PROJECT_ID}.iam.gserviceaccount.com" --project="$PROJECT_ID" -- \
    gcloud iam service-accounts create "${sa%%:*}" --display-name="${sa#*:}" --project="$PROJECT_ID"
done

# --- Runtime identity: only what the Admin SDK usage needs (ADR 0001 §2.1) ---
for role in roles/datastore.user roles/firebaseauth.admin; do
  run gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUN_SA" \
    --role="$role" --condition=None --quiet
done
# Files bucket only (not project-wide).
run gcloud storage buckets add-iam-policy-binding "gs://$FILES_BUCKET" \
  --member="serviceAccount:$RUN_SA" --role=roles/storage.objectAdmin
# Secret access is granted per secret in 20-secrets.sh (never project-wide).
# Signed URLs (ADR 0001 §7.3) are not built yet; enable this only when that feature ships (needs signBlob on itself).
if [[ "${GRANT_URL_SIGNING:-false}" == "true" ]]; then
  run gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --project="$PROJECT_ID" \
    --member="serviceAccount:$RUN_SA" --role=roles/iam.serviceAccountTokenCreator
fi

# --- Deployer: build, push, deploy, Firestore rules/indexes. Nothing on data, nothing on secrets. ---
for role in roles/run.admin roles/datastore.indexAdmin roles/firebaserules.admin \
  roles/firebase.viewer roles/serviceusage.serviceUsageConsumer roles/browser; do
  run gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOYER_SA" \
    --role="$role" --condition=None --quiet
done
run gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location="$REGION" --project="$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" --role=roles/artifactregistry.writer
# The deployer may run the service as gmep-run, and nothing else.
run gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --project="$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" --role=roles/iam.serviceAccountUser

# --- Workload Identity Federation: only this GitHub repository can impersonate the deployer ---
ensure "WIF pool $POOL" -- \
  gcloud iam workload-identity-pools describe "$POOL" --location=global --project="$PROJECT_ID" -- \
  gcloud iam workload-identity-pools create "$POOL" --location=global --project="$PROJECT_ID" \
  --display-name="GitHub Actions"
ensure "WIF provider $PROVIDER" -- \
  gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool="$POOL" \
  --location=global --project="$PROJECT_ID" -- \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --workload-identity-pool="$POOL" \
  --location=global --project="$PROJECT_ID" --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPOSITORY}'"
run gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" --project="$PROJECT_ID" \
  --member="principalSet://iam.googleapis.com/projects/$(project_number)/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPOSITORY}" \
  --role=roles/iam.workloadIdentityUser

log "GitHub repository variable GCP_WORKLOAD_IDENTITY_PROVIDER ="
log "  projects/$(project_number)/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
log "GitHub repository variable GCP_DEPLOYER_SERVICE_ACCOUNT = $DEPLOYER_SA"
