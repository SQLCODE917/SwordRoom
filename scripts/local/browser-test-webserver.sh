#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:5173}"

extract_host() {
  local url="$1"
  if [[ "$url" =~ ^https?://([^/:]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi

  return 1
}

host="$(extract_host "$BASE_URL" || true)"
case "$host" in
  localhost|127.0.0.1)
    ;;
  *)
    printf 'Browser e2e tests only support a local base URL. Refusing to run against: %s\n' "$BASE_URL" >&2
    exit 1
    ;;
esac

export RESET_LOCAL_STATE=1
export RUN_AUTH_MODE=dev
export RUN_DEV_ACTOR_ID="${RUN_DEV_ACTOR_ID:-player-aaa}"

bash scripts/local/dev-up.sh
