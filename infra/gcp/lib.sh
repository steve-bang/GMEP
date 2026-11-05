#!/usr/bin/env bash
# Shared helpers for the GMEP GCP scripts. Sourced, never executed directly.
#
# Safety model:
#   - DRY_RUN defaults to 1: every mutating command is only printed. Apply with DRY_RUN=0.
#   - In dry-run mode no gcloud command of any kind is executed (no existence checks, no lookups),
#     so the scripts can be reviewed and tested without credentials.
#   - Every step is idempotent: "ensure" checks first, IAM bindings and `services enable` are naturally repeatable.
#   - Nothing secret is read or written here. Secret VALUES are supplied by the owner (see 20-secrets.sh).
# Configuration comes from the environment or from the file named by INFRA_ENV_FILE (copy staging.env.example).

set -euo pipefail

if [[ -n "${INFRA_ENV_FILE:-}" ]]; then
  # shellcheck disable=SC1090
  source "$INFRA_ENV_FILE"
fi

DRY_RUN="${DRY_RUN:-1}"

log() { printf '%s\n' "$*" >&2; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# require_var NAME: fail on a missing value when applying; use a visible placeholder in dry-run.
require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
      printf -v "$name" '%s' "<$name>"
      export "${name?}"
    else
      die "$name is required (set it in the environment or INFRA_ENV_FILE)"
    fi
  fi
}

require_var PROJECT_ID
require_var ENV_NAME # dev | staging | prod, becomes GMEP_ENV
case "$ENV_NAME" in dev | staging | prod | "<ENV_NAME>") ;; *) die "ENV_NAME must be dev, staging or prod" ;; esac

REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-gmep}"
AR_REPO="${AR_REPO:-gmep}"
RUN_SA_NAME="${RUN_SA_NAME:-gmep-run}"
SCHEDULER_SA_NAME="${SCHEDULER_SA_NAME:-scheduler}"
DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-gmep-deployer}"
FILES_BUCKET="${FILES_BUCKET:-${PROJECT_ID}-files}"
RUN_SA="${RUN_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="${DEPLOYER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
# Secret Manager names (same as docs/dev/deploy-guide.md)
SECRET_API_KEY="${SECRET_API_KEY:-gmep-firebase-api-key}"
SECRET_SMTP_URL="${SECRET_SMTP_URL:-gmep-email-smtp-url}"
SECRET_CRON="${SECRET_CRON:-gmep-cron-secret}"

# run CMD...: print, and execute only when DRY_RUN=0.
run() {
  printf '+ %s\n' "$*" >&2
  if [[ "$DRY_RUN" != "1" ]]; then "$@"; fi
}

# ensure LABEL -- CHECK... -- CREATE...: run CREATE only if CHECK fails (CHECK must be a read-only command).
ensure() {
  local label="$1"
  shift
  [[ "${1:-}" == "--" ]] || die "ensure: missing first --"
  shift
  local check=() create=() cur=check
  while [[ $# -gt 0 ]]; do
    if [[ "$1" == "--" && "$cur" == "check" ]]; then
      cur=create
    elif [[ "$cur" == "check" ]]; then
      check+=("$1")
    else
      create+=("$1")
    fi
    shift
  done
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[dry-run] ensure $label (existence check skipped)"
    run "${create[@]}"
  elif "${check[@]}" >/dev/null 2>&1; then
    log "exists: $label"
  else
    log "creating: $label"
    "${create[@]}"
  fi
}

# project_number: numeric id (needed for WIF principals and the Cloud Run URL).
project_number() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '<PROJECT_NUMBER>'
  else
    gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)'
  fi
}

# service_url: deterministic Cloud Run URL (https://<service>-<project number>.<region>.run.app).
service_url() { printf 'https://%s-%s.%s.run.app' "$SERVICE" "$(project_number)" "$REGION"; }

banner() {
  log "== $1 | project=$PROJECT_ID env=$ENV_NAME region=$REGION dry_run=$DRY_RUN"
  if [[ "$DRY_RUN" == "1" ]]; then log "   (printing only; re-run with DRY_RUN=0 to apply)"; fi
}
