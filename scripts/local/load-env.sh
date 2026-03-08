#!/usr/bin/env bash
set -euo pipefail

source .env.local

# Avoid opening CLI pagers (for example, `less`) in non-interactive scripts.
export AWS_PAGER=""

detect_docker_host() {
  if [[ -n "${LOCAL_DOCKER_HOST:-}" ]]; then
    echo "$LOCAL_DOCKER_HOST"
    return 0
  fi

  if getent hosts host.docker.internal >/dev/null 2>&1; then
    echo "host.docker.internal"
    return 0
  fi

  if getent hosts gateway.docker.internal >/dev/null 2>&1; then
    echo "gateway.docker.internal"
    return 0
  fi

  local gw_hex
  gw_hex="$(awk 'NR>1 && $2=="00000000" {print $3; exit}' /proc/net/route 2>/dev/null || true)"
  if [[ -n "$gw_hex" ]]; then
    printf '%d.%d.%d.%d\n' "0x${gw_hex:6:2}" "0x${gw_hex:4:2}" "0x${gw_hex:2:2}" "0x${gw_hex:0:2}"
    return 0
  fi

  echo "localhost"
}

rewrite_local_url_host() {
  local url="$1"
  local host="$2"
  if [[ "$url" =~ ^(https?://)(localhost|127\.0\.0\.1)(:[0-9]+)?(/.*)?$ ]]; then
    echo "${BASH_REMATCH[1]}${host}${BASH_REMATCH[3]}${BASH_REMATCH[4]}"
    return 0
  fi
  echo "$url"
}

compose_service_ip() {
  local service="$1"
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  local cid
  cid="$(docker compose -f docker-compose.local.yml ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    return 1
  fi

  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$cid" 2>/dev/null || true
}

rewrite_url_to_ip_port() {
  local url="$1"
  local ip="$2"
  local port="$3"
  if [[ "$url" =~ ^(https?://)[^/:]+(:[0-9]+)?(/.*)?$ ]]; then
    echo "${BASH_REMATCH[1]}${ip}:${port}${BASH_REMATCH[3]}"
    return 0
  fi
  echo "$url"
}

endpoint_reachable() {
  local url="$1"
  curl -sS --max-time 1 --output /dev/null "$url" >/dev/null 2>&1
}

if [[ -f /.dockerenv ]]; then
  DOCKER_HOST_FORWARDED="$(detect_docker_host)"
  DDB_ENDPOINT="$(rewrite_local_url_host "$DDB_ENDPOINT" "$DOCKER_HOST_FORWARDED")"
  SQS_ENDPOINT="$(rewrite_local_url_host "$SQS_ENDPOINT" "$DOCKER_HOST_FORWARDED")"
  S3_ENDPOINT="$(rewrite_local_url_host "${S3_ENDPOINT:-$SQS_ENDPOINT}" "$DOCKER_HOST_FORWARDED")"
  KEYCLOAK_ISSUER="$(rewrite_local_url_host "$KEYCLOAK_ISSUER" "$DOCKER_HOST_FORWARDED")"

  if ! endpoint_reachable "$DDB_ENDPOINT"; then
    ddb_ip="$(compose_service_ip dynamodb || true)"
    if [[ -n "${ddb_ip:-}" ]]; then
      DDB_ENDPOINT="$(rewrite_url_to_ip_port "$DDB_ENDPOINT" "$ddb_ip" "8000")"
    fi
  fi

  if ! endpoint_reachable "$SQS_ENDPOINT"; then
    localstack_ip="$(compose_service_ip localstack || true)"
    if [[ -n "${localstack_ip:-}" ]]; then
      SQS_ENDPOINT="$(rewrite_url_to_ip_port "$SQS_ENDPOINT" "$localstack_ip" "4566")"
    fi
  fi

  if ! endpoint_reachable "$S3_ENDPOINT"; then
    localstack_ip="$(compose_service_ip localstack || true)"
    if [[ -n "${localstack_ip:-}" ]]; then
      S3_ENDPOINT="$(rewrite_url_to_ip_port "$S3_ENDPOINT" "$localstack_ip" "4566")"
    fi
  fi

  if ! endpoint_reachable "$KEYCLOAK_ISSUER"; then
    keycloak_ip="$(compose_service_ip keycloak || true)"
    if [[ -n "${keycloak_ip:-}" ]]; then
      KEYCLOAK_ISSUER="$(rewrite_url_to_ip_port "$KEYCLOAK_ISSUER" "$keycloak_ip" "8080")"
    fi
  fi

  export DDB_ENDPOINT SQS_ENDPOINT S3_ENDPOINT KEYCLOAK_ISSUER
fi
