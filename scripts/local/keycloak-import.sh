#!/usr/bin/env bash
set -euo pipefail

source scripts/local/load-env.sh
KEYCLOAK_REALM_ISSUER="${OIDC_ISSUER:-${KEYCLOAK_ISSUER:-http://localhost:8080/realms/swordworld}}"
KEYCLOAK_BASE_URL="${KEYCLOAK_REALM_ISSUER%/realms/*}"
bash scripts/local/keycloak-wait.sh "${KEYCLOAK_BASE_URL}"

echo "Importing realm 'swordworld'..."
REALM_FILE_LOCAL="keycloak/realm-swordworld.json"
REALM_FILE_CONTAINER="/tmp/realm-swordworld.json"

if [[ ! -f "$REALM_FILE_LOCAL" ]]; then
  echo "Missing realm file: $REALM_FILE_LOCAL"
  exit 1
fi

# Devcontainers can run Docker with a different host filesystem view, so
# copy the realm JSON into the container explicitly instead of relying on mounts.
docker compose -f docker-compose.local.yml cp "$REALM_FILE_LOCAL" "keycloak:$REALM_FILE_CONTAINER"

docker compose -f docker-compose.local.yml exec -T keycloak /opt/keycloak/bin/kcadm.sh config credentials   --server http://localhost:8080   --realm master   --user admin   --password admin

if docker compose -f docker-compose.local.yml exec -T keycloak /opt/keycloak/bin/kcadm.sh get realms/swordworld >/dev/null 2>&1; then
  echo "Realm exists; deleting for clean import..."
  docker compose -f docker-compose.local.yml exec -T keycloak /opt/keycloak/bin/kcadm.sh delete realms/swordworld
fi

docker compose -f docker-compose.local.yml exec -T keycloak /opt/keycloak/bin/kcadm.sh create realms -f "$REALM_FILE_CONTAINER"
echo "Realm imported."
