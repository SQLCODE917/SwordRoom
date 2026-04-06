#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  local exit_code=$?
  trap - EXIT
  printf '[browser-tests] stopping local dev stack after Playwright\n'
  bash scripts/local/dev-down.sh >/dev/null 2>&1 || true
  exit "$exit_code"
}

trap cleanup EXIT

printf '[browser-tests] resetting local DynamoDB, SQS, and uploads state before running Playwright\n'
printf '[browser-tests] stopping any existing local dev stack so Playwright can start from a clean state\n'
bash scripts/local/dev-down.sh >/dev/null 2>&1 || true

if [[ "${1:-}" == "--" ]]; then
  shift
fi

pnpm --filter @starter/test-browser-e2e exec playwright test "$@"
