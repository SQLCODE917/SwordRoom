#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source scripts/local/load-env.sh

aws_ddb() { aws --region "$AWS_REGION" --endpoint-url "$DDB_ENDPOINT" dynamodb "$@"; }
aws_sqs() { aws --region "$AWS_REGION" --endpoint-url "$SQS_ENDPOINT" sqs "$@"; }
aws_s3api() { aws --region "$AWS_REGION" --endpoint-url "$S3_ENDPOINT" s3api "$@"; }
aws_s3() { aws --region "$AWS_REGION" --endpoint-url "$S3_ENDPOINT" s3 "$@"; }

log() {
  printf '[reset] %s\n' "$*"
}

extract_host() {
  local url="$1"
  if [[ "$url" =~ ^https?://([^/:]+) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi

  return 1
}

assert_local_url() {
  local name="$1"
  local url="$2"
  local host
  host="$(extract_host "$url" || true)"

  case "$host" in
    localhost|127.0.0.1|host.docker.internal|gateway.docker.internal|*.localhost.localstack.cloud|10.*|172.*|192.168.*)
      return 0
      ;;
    *)
      printf 'Refusing to reset browser-test state because %s is not local: %s\n' "$name" "$url" >&2
      exit 1
      ;;
  esac
}

delete_table_if_exists() {
  local table_name="$1"
  if ! aws_ddb describe-table --table-name "$table_name" >/dev/null 2>&1; then
    return 0
  fi

  aws_ddb delete-table --table-name "$table_name" >/dev/null

  local attempt=0
  while (( attempt < 30 )); do
    if ! aws_ddb describe-table --table-name "$table_name" >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  printf 'Timed out waiting for DynamoDB table deletion: %s\n' "$table_name" >&2
  exit 1
}

reset_queue_if_exists() {
  local queue_name="$1"
  local queue_url
  queue_url="$(aws_sqs get-queue-url --queue-name "$queue_name" --query QueueUrl --output text 2>/dev/null || true)"
  if [[ -z "$queue_url" || "$queue_url" == "None" ]]; then
    return 0
  fi

  if aws_sqs purge-queue --queue-url "$queue_url" >/dev/null 2>&1; then
    return 0
  fi

  aws_sqs delete-queue --queue-url "$queue_url" >/dev/null
}

empty_bucket_if_exists() {
  local bucket_name="$1"
  if ! aws_s3api head-bucket --bucket "$bucket_name" >/dev/null 2>&1; then
    return 0
  fi

  aws_s3 rm "s3://$bucket_name" --recursive >/dev/null || true
}

assert_local_url "DDB_ENDPOINT" "$DDB_ENDPOINT"
assert_local_url "SQS_ENDPOINT" "$SQS_ENDPOINT"
assert_local_url "S3_ENDPOINT" "$S3_ENDPOINT"

log "Clearing DynamoDB tables"
delete_table_if_exists "$GAMESTATE_TABLE"
delete_table_if_exists "$COMMANDLOG_TABLE"

log "Purging SQS queues"
reset_queue_if_exists "$COMMANDS_QUEUE_NAME"
reset_queue_if_exists "$COMMANDS_DLQ_NAME"

log "Emptying uploads bucket"
empty_bucket_if_exists "$UPLOADS_BUCKET"

log "Recreating local resources"
bash scripts/local/create-resources.sh

log "Seeding local data"
bash scripts/local/seed.sh
