#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATE_DIR=".local/dev-stack"
LAUNCHER_PID_FILE="$STATE_DIR/launcher.pid"
CHILD_PID_FILE="$STATE_DIR/children.pid"

TASK_PIDS=()
INPUT_PID=""
SHUTTING_DOWN=0

mkdir -p "$STATE_DIR"

log() {
  printf '[bootstrap] %s\n' "$*"
}

kill_orphan_web_vite() {
  local pid
  while IFS= read -r pid; do
    if [[ -z "$pid" || "$pid" == "$$" ]]; then
      continue
    fi
    if [[ -d "/proc/$pid" ]]; then
      local cwd
      cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
      if [[ "$cwd" == "$ROOT_DIR/packages/web" ]]; then
        kill -TERM "$pid" >/dev/null 2>&1 || true
        sleep 1
        if kill -0 "$pid" >/dev/null 2>&1; then
          kill -KILL "$pid" >/dev/null 2>&1 || true
        fi
      fi
    fi
  done < <(pgrep -f "$ROOT_DIR/packages/web/node_modules/.bin/.*/vite/bin/vite.js" || true)
}

prefix_stream() {
  local name="$1"
  sed -u "s/^/[$name] /"
}

write_child_pid_file() {
  : > "$CHILD_PID_FILE"
  local pid
  for pid in "${TASK_PIDS[@]}"; do
    printf '%s\n' "$pid" >> "$CHILD_PID_FILE"
  done
}

start_task() {
  local name="$1"
  shift

  (
    exec stdbuf -oL -eL "$@"
  ) > >(prefix_stream "$name") 2>&1 &

  TASK_PIDS+=("$!")
  write_child_pid_file
}

retry() {
  local attempts="$1"
  shift

  local try=1
  while (( try <= attempts )); do
    if "$@"; then
      return 0
    fi
    log "Retry $try/$attempts failed for: $*"
    try=$((try + 1))
    sleep 2
  done

  return 1
}

cleanup() {
  if (( SHUTTING_DOWN == 1 )); then
    return
  fi
  SHUTTING_DOWN=1
  set +e

  log "Shutting down local dev stack"

  if [[ -n "$INPUT_PID" ]] && kill -0 "$INPUT_PID" >/dev/null 2>&1; then
    kill "$INPUT_PID" >/dev/null 2>&1 || true
  fi

  local pid
  for pid in "${TASK_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -TERM "$pid" >/dev/null 2>&1 || true
    fi
  done

  sleep 1

  for pid in "${TASK_PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -KILL "$pid" >/dev/null 2>&1 || true
    fi
  done

  for pid in "${TASK_PIDS[@]}"; do
    wait "$pid" >/dev/null 2>&1 || true
  done

  docker compose -f docker-compose.local.yml down >/dev/null 2>&1 || true
  rm -f "$LAUNCHER_PID_FILE" "$CHILD_PID_FILE"
}

trap cleanup EXIT
trap 'exit 0' INT TERM

if [[ -f "$LAUNCHER_PID_FILE" ]]; then
  existing_pid="$(cat "$LAUNCHER_PID_FILE")"
  if [[ -n "${existing_pid:-}" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
    log "Existing local dev stack detected; stopping it first"
    bash scripts/local/dev-down.sh
  fi
fi

printf '%s\n' "$$" > "$LAUNCHER_PID_FILE"

source scripts/local/load-env.sh
source .env.local.queueurl || true

export FLOW_LOG="${FLOW_LOG:-1}"
export RUN_AUTH_MODE="${RUN_AUTH_MODE:-${AUTH_MODE:-dev}}"

if [[ "$RUN_AUTH_MODE" == "dev" ]]; then
  export ALLOW_DEV_AUTH="${ALLOW_DEV_AUTH:-1}"
  export RUN_DEV_ACTOR_ID="${RUN_DEV_ACTOR_ID:-${DEV_ACTOR_ID:-player-aaa}}"
  export VITE_AUTH_MODE=dev
  export VITE_DEV_ACTOR_ID="$RUN_DEV_ACTOR_ID"
else
  export RUN_OIDC_ISSUER="${RUN_OIDC_ISSUER:-${RUN_KEYCLOAK_ISSUER:-${OIDC_ISSUER:-${KEYCLOAK_ISSUER:-http://localhost:8080/realms/swordworld}}}}"
  export RUN_OIDC_AUDIENCE="${RUN_OIDC_AUDIENCE:-${OIDC_AUDIENCE:-swordworld-web}}"
  export VITE_AUTH_MODE=oidc
  export VITE_OIDC_DISCOVERY_URL="${RUN_OIDC_ISSUER%/}/.well-known/openid-configuration"
  export VITE_OIDC_CLIENT_ID="${VITE_OIDC_CLIENT_ID:-swordworld-web}"
  export VITE_OIDC_REDIRECT_URI="${VITE_OIDC_REDIRECT_URI:-http://localhost:5173/auth/callback}"
fi

log "Starting Docker services"
docker compose -f docker-compose.local.yml up -d

log "Clearing orphaned web dev servers"
kill_orphan_web_vite

log "Provisioning local resources"
if [[ "${RESET_LOCAL_STATE:-0}" == "1" ]]; then
  log "Resetting local browser-test state"
  retry 10 bash scripts/local/reset-browser-test-state.sh
else
  retry 30 bash scripts/local/create-resources.sh

  log "Seeding local data"
  retry 10 bash scripts/local/seed.sh
fi

if [[ "$RUN_AUTH_MODE" == "oidc" ]]; then
  log "Importing Keycloak realm"
  retry 20 bash scripts/local/keycloak-import.sh
fi

log "Building API and dispatcher from latest source"
pnpm exec tsc -b packages/services/api packages/services/dispatcher

log "Starting log aggregation and watch processes"
start_task infra docker compose -f docker-compose.local.yml logs -f --tail=100
start_task tsc pnpm exec tsc -b packages/services/api packages/services/dispatcher --watch --preserveWatchOutput
start_task api bash scripts/local/run-api-runtime.sh
start_task dispatcher bash scripts/local/run-dispatcher-runtime.sh
start_task web pnpm --filter @starter/web dev

log "Local dev stack is live"
log "Press q, Ctrl-C, or run scripts/local/dev-down.sh to stop"

if [[ -t 0 ]]; then
  (
    while IFS= read -r -n 1 key < /dev/tty; do
      if [[ "$key" == "q" || "$key" == "Q" ]]; then
        log "Shutdown requested from keyboard"
        kill -TERM "$$" >/dev/null 2>&1 || true
        break
      fi
    done
  ) &
  INPUT_PID="$!"
fi

while true; do
  for pid in "${TASK_PIDS[@]}"; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      log "A dev-stack task exited unexpectedly: PID $pid"
      exit 1
    fi
  done
  sleep 1
done
