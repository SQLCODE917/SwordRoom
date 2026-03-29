#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:8080}"
echo "Waiting for Keycloak at $URL ..."
for i in {1..120}; do
  if curl -fsS "$URL/realms/master" >/dev/null 2>&1; then
    echo "Keycloak is up."
    exit 0
  fi
  sleep 1
done
echo "Keycloak did not become ready in time."
exit 1
