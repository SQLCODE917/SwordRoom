#!/usr/bin/env bash
set -euo pipefail
source scripts/local/load-env.sh
node packages/test-e2e/dist/runFixtureSequence.js e2e.good.human_rune_master_sequence
