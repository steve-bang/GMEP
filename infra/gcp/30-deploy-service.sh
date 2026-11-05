#!/usr/bin/env bash
# Step 4: deploy (or update) the Cloud Run service. This file is THE service definition: the owner/dev runs it by hand
# for the first deploy and .github/workflows/deploy-staging.yml runs it for every later one. Idempotent. Dry-run by default.
#
# Required: IMAGE (full Artifact Registry reference), APP_BASE_URL, CRON_COMPANY_ID.
# Env vars follow src/platform/config/env.ts on master. EMAIL_* only exist on branch feat/email-smtp-adapter-deploy-guide
# (an unknown variable is ignored by master, so setting them early is harmless).
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "deploy service"
require_var IMAGE
require_var APP_BASE_URL
require_var CRON_COMPANY_ID

if [[ "$DRY_RUN" != "1" ]]; then
  # Fail early and clearly instead of a Cloud Run revision that cannot start.
  gcloud secrets versions list "$SECRET_API_KEY" --project="$PROJECT_ID" --limit=1 --format='value(name)' |
    grep -q . || die "secret $SECRET_API_KEY has no version yet (runbook section 6)"
  case "$APP_BASE_URL" in https://*) ;; *) die "APP_BASE_URL must be https:// (the __Host- session cookie requires HTTPS)" ;; esac
fi

# The scheduler token audience is the run.app URL of this service; both CRON_OIDC_* must be set together (env.ts).
CRON_AUDIENCE="${CRON_OIDC_AUDIENCE:-$(service_url)}"

# '^@^' makes '@' the list delimiter so values may contain commas and spaces.
env_vars="^@^GMEP_ENV=${ENV_NAME}@GMEP_DATA_BACKEND=firestore@GCLOUD_PROJECT=${PROJECT_ID}@GMEP_FILES_BUCKET=${FILES_BUCKET}"
env_vars+="@TRUSTED_PROXY_HOPS=1@APP_BASE_URL=${APP_BASE_URL}@APP_ORIGIN=${APP_BASE_URL}@CRON_COMPANY_ID=${CRON_COMPANY_ID}"
env_vars+="@CRON_OIDC_AUDIENCE=${CRON_AUDIENCE}@CRON_OIDC_SERVICE_ACCOUNT=${SCHEDULER_SA}"
secrets="FIREBASE_API_KEY=${SECRET_API_KEY}:latest"
if [[ -n "${EMAIL_FROM:-}" ]]; then
  env_vars+="@EMAIL_FROM=${EMAIL_FROM}"
  secrets+=",EMAIL_SMTP_URL=${SECRET_SMTP_URL}:latest"
fi
if [[ "${CRON_SHARED_SECRET:-false}" == "true" ]]; then secrets+=",CRON_SECRET=${SECRET_CRON}:latest"; fi

# Never set FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST / FIREBASE_STORAGE_EMULATOR_HOST here.
# --allow-unauthenticated is intended: the app authenticates itself (__Host- cookie); the cron route checks OIDC itself.
run gcloud run deploy "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --image="$IMAGE" \
  --service-account="$RUN_SA" --port=8080 --allow-unauthenticated \
  --min-instances="${MIN_INSTANCES:-0}" --max-instances="${MAX_INSTANCES:-5}" \
  --cpu=1 --memory=1Gi --concurrency=80 \
  --labels="app=gmep,env=${ENV_NAME}" \
  --set-env-vars="$env_vars" --set-secrets="$secrets"

log "Service URL: $(service_url)   (smoke test: curl -s '$(service_url)/api/health?ready=1')"
