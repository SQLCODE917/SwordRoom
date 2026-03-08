#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATE_DIR=".local/dev-stack"
LAUNCHER_PID_FILE="$STATE_DIR/launcher.pid"
CHILD_PID_FILE="$STATE_DIR/children.pid"

log() {
  printf '[shutdown] %s\n' "$*"
}

kill_pid_file_entries() {
  local pid_file="$1"
  local signal="${2:-TERM}"

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    if [[ -z "$pid" ]]; then
      continue
    fi
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "-$signal" "$pid" >/dev/null 2>&1 || true
    fi
  done < "$pid_file"
}

wait_for_pid_exit() {
  local pid="$1"
  local attempts=30

  while (( attempts > 0 )); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    attempts=$((attempts - 1))
  done

  return 1
}

mkdir -p "$STATE_DIR"

if [[ -f "$LAUNCHER_PID_FILE" ]]; then
  launcher_pid="$(cat "$LAUNCHER_PID_FILE")"
  if [[ -n "${launcher_pid:-}" ]] && kill -0 "$launcher_pid" >/dev/null 2>&1; then
    log "Stopping launcher PID $launcher_pid"
    kill -TERM "$launcher_pid" >/dev/null 2>&1 || true
    if ! wait_for_pid_exit "$launcher_pid"; then
      log "Launcher PID $launcher_pid did not exit in time; forcing shutdown"
      kill -KILL "$launcher_pid" >/dev/null 2>&1 || true
    fi
  fi
fi

kill_pid_file_entries "$CHILD_PID_FILE" TERM
sleep 1
kill_pid_file_entries "$CHILD_PID_FILE" KILL

log "Stopping Docker services"
docker compose -f docker-compose.local.yml down >/dev/null 2>&1 || true

rm -f "$LAUNCHER_PID_FILE" "$CHILD_PID_FILE"
log "Local dev stack stopped"
