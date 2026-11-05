#!/usr/bin/env bash
# Step 1 (owner, or dev with Owner on the project): project, billing, APIs, Artifact Registry, Firestore,
# private files bucket, Firestore backup. Idempotent. Dry-run by default.
# Usage: INFRA_ENV_FILE=infra/gcp/staging.env DRY_RUN=0 infra/gcp/00-bootstrap.sh
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "bootstrap"

if [[ "${CREATE_PROJECT:-0}" == "1" ]]; then
  # shellcheck disable=SC2086
  ensure "project $PROJECT_ID" -- gcloud projects describe "$PROJECT_ID" -- \
    gcloud projects create "$PROJECT_ID" --name="GMEP $ENV_NAME" ${PARENT_FLAG:-}
fi

if [[ -n "${BILLING_ACCOUNT_ID:-}" ]]; then
  run gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
else
  log "BILLING_ACCOUNT_ID not set: skipping billing link (must already be linked)"
fi

run gcloud services enable --project="$PROJECT_ID" \
  serviceusage.googleapis.com cloudresourcemanager.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com run.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com \
  firebase.googleapis.com firebaserules.googleapis.com identitytoolkit.googleapis.com \
  storage.googleapis.com cloudscheduler.googleapis.com logging.googleapis.com \
  monitoring.googleapis.com billingbudgets.googleapis.com apikeys.googleapis.com

ensure "Artifact Registry $AR_REPO" -- \
  gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT_ID" -- \
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION" \
  --project="$PROJECT_ID" --description="GMEP images"

# Firestore Native in the same region (location cannot be changed afterwards).
fs_flags=()
if [[ "${DELETE_PROTECTION:-false}" == "true" ]]; then fs_flags+=(--delete-protection); fi
ensure "Firestore (default)" -- \
  gcloud firestore databases describe --database='(default)' --project="$PROJECT_ID" -- \
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native \
  --project="$PROJECT_ID" ${fs_flags[@]+"${fs_flags[@]}"}

if [[ "${ENABLE_PITR:-false}" == "true" ]]; then
  run gcloud firestore databases update --database='(default)' --enable-pitr --project="$PROJECT_ID"
fi

# Daily managed backup. Retention is an open decision [Cần xác nhận]; default 7d.
ensure "Firestore daily backup schedule" -- \
  bash -c "gcloud firestore backups schedules list --database='(default)' --project='$PROJECT_ID' --format='value(name)' | grep -q ." -- \
  gcloud firestore backups schedules create --database='(default)' --recurrence=daily \
  --retention="${BACKUP_RETENTION:-7d}" --project="$PROJECT_ID"

# Private bucket for business files (e-invoice XML/PDF): uniform access, no public access, same region.
ensure "bucket gs://$FILES_BUCKET" -- \
  gcloud storage buckets describe "gs://$FILES_BUCKET" --project="$PROJECT_ID" -- \
  gcloud storage buckets create "gs://$FILES_BUCKET" --location="$REGION" --project="$PROJECT_ID" \
  --uniform-bucket-level-access --public-access-prevention

log "Next: enable Firebase + Auth by hand (runbook section 4), then 10-iam.sh"
