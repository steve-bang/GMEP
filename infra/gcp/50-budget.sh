#!/usr/bin/env bash
# Step 6: budget alert on the project (50/90/100 percent). Notifications go to the billing account administrators
# (default IAM recipients) unless you add a Monitoring channel in the console afterwards. Dry-run by default.
# Needs roles/billing.costsManager (or billing.admin) on the billing account, which only the owner has.
set -euo pipefail
# shellcheck source=infra/gcp/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
banner "budget"
require_var BILLING_ACCOUNT_ID
BUDGET_USD="${BUDGET_USD:-100}"
NAME="gmep-${ENV_NAME}-budget"

ensure "budget $NAME" -- \
  bash -c "gcloud billing budgets list --billing-account='$BILLING_ACCOUNT_ID' --format='value(displayName)' | grep -qx '$NAME'" -- \
  gcloud billing budgets create --billing-account="$BILLING_ACCOUNT_ID" --display-name="$NAME" \
  --filter-projects="projects/$(project_number)" --budget-amount="${BUDGET_USD}USD" \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
