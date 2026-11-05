#!/usr/bin/env bash
# Step 5: Cloud Scheduler job calling POST /api/v1/internal/cron/run-due with an OIDC token.
# src/platform/auth/cronAuth.ts accepts the token only when aud == CRON_OIDC_AUDIENCE (the service URL) and
# email == CRON_OIDC_SERVICE_ACCOUNT (the scheduler SA) and email_verified is true; 30-deploy-service.sh sets both.
# The person running this needs roles/cloudscheduler.admin and roles/iam.serviceAccountUser on the scheduler SA.
# Idempotent (create or update). Dry-run by default.
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "scheduler"

JOB="${SCHEDULER_JOB:-gmep-run-due}"
SCHEDULE="${SCHEDULE:-*/15 * * * *}"
URL="${CRON_OIDC_AUDIENCE:-$(service_url)}"

common=(--project="$PROJECT_ID" --location="$REGION" --schedule="$SCHEDULE" --time-zone="Asia/Ho_Chi_Minh"
  --uri="$URL/api/v1/internal/cron/run-due" --http-method=POST
  --oidc-service-account-email="$SCHEDULER_SA" --oidc-token-audience="$URL"
  --attempt-deadline=180s --min-backoff=10s --max-backoff=120s --max-retry-attempts=3)

ensure "scheduler job $JOB" -- \
  gcloud scheduler jobs describe "$JOB" --location="$REGION" --project="$PROJECT_ID" -- \
  gcloud scheduler jobs create http "$JOB" "${common[@]}"
# Re-apply so a changed schedule or URL converges (no-op when equal).
if [[ "$DRY_RUN" != "1" ]]; then gcloud scheduler jobs update http "$JOB" "${common[@]}"; fi

log "Test once: gcloud scheduler jobs run $JOB --location=$REGION --project=$PROJECT_ID"
