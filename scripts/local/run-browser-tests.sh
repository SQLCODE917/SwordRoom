#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ "${1:-}" == "--" ]]; then
  shift
fi

pnpm --filter @starter/test-browser-e2e exec playwright test "$@"
