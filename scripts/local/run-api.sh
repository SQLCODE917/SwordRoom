#!/usr/bin/env bash
set -euo pipefail
source scripts/local/load-env.sh
source .env.local.queueurl || true
export COMMANDS_QUEUE_URL="${COMMANDS_QUEUE_URL:-}"
export PORT="${API_PORT}"
export FLOW_LOG="${FLOW_LOG:-1}"

mode="${RUN_AUTH_MODE:-${AUTH_MODE:-dev}}"
export AUTH_MODE="$mode"

if [[ "$AUTH_MODE" == "dev" ]]; then
  export ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH:-1}"
  export DEV_ACTOR_ID="${RUN_DEV_ACTOR_ID:-${DEV_ACTOR_ID:-player-aaa}}"
fi

if [[ "$AUTH_MODE" == "oidc" ]]; then
  export OIDC_ISSUER="${RUN_OIDC_ISSUER:-${RUN_KEYCLOAK_ISSUER:-${OIDC_ISSUER:-${KEYCLOAK_ISSUER:-http://localhost:8080/realms/swordworld}}}}"
  export OIDC_AUDIENCE="${RUN_OIDC_AUDIENCE:-${OIDC_AUDIENCE:-swordworld-web}}"
fi

pnpm --filter @starter/services-api dev
