#!/usr/bin/env bash
set -euo pipefail
source scripts/local/load-env.sh
source .env.local.queueurl || true
export COMMANDS_QUEUE_URL="${COMMANDS_QUEUE_URL:-}"
export PORT="${API_PORT}"
pnpm --filter @starter/services-api dev
