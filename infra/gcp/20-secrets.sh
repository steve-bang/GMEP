#!/usr/bin/env bash
# Step 3: create EMPTY secrets (no version) and grant the runtime service account access to each one.
# Values are supplied by the owner/dev out of band, never by this script and never in the repo:
#   printf '%s' "<value>" | gcloud secrets versions add gmep-firebase-api-key --data-file=- --project=<PROJECT_ID>
# (see docs/dev/gcp-setup-runbook.md section 6). Idempotent. Dry-run by default.
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "secrets"

# FIREBASE_API_KEY: always. EMAIL_SMTP_URL: needed when the SMTP adapter is deployed (required in prod there).
# CRON_SECRET: only if the shared-secret cron mode is wanted; OIDC (40-scheduler.sh) is the default and needs no secret.
secrets=("$SECRET_API_KEY" "$SECRET_SMTP_URL")
if [[ "${CREATE_CRON_SECRET:-false}" == "true" ]]; then secrets+=("$SECRET_CRON"); fi

for s in "${secrets[@]}"; do
  ensure "secret $s" -- \
    gcloud secrets describe "$s" --project="$PROJECT_ID" -- \
    gcloud secrets create "$s" --replication-policy=user-managed --locations="$REGION" --project="$PROJECT_ID"
  run gcloud secrets add-iam-policy-binding "$s" --project="$PROJECT_ID" \
    --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor
done

log "Created without a value. Add one version to each before 30-deploy-service.sh (runbook section 6)."
