#!/usr/bin/env bash
set -euo pipefail

source scripts/local/load-env.sh

aws_ddb() { aws --region "$AWS_REGION" --endpoint-url "$DDB_ENDPOINT" dynamodb "$@"; }
aws_sqs() { aws --region "$AWS_REGION" --endpoint-url "$SQS_ENDPOINT" sqs "$@"; }
aws_s3api() { aws --region "$AWS_REGION" --endpoint-url "$S3_ENDPOINT" s3api "$@"; }

ensure_ddb_table() {
  local table_name="$1"
  if aws_ddb describe-table --table-name "$table_name" >/dev/null 2>&1; then
    return 0
  fi

  aws_ddb create-table \
    --table-name "$table_name" \
    --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
    --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
}

ensure_sqs_queue_url() {
  local queue_name="$1"
  shift

  local queue_url
  queue_url="$(aws_sqs get-queue-url --queue-name "$queue_name" --query QueueUrl --output text 2>/dev/null || true)"
  if [[ -n "$queue_url" && "$queue_url" != "None" ]]; then
    printf '%s\n' "$queue_url"
    return 0
  fi

  aws_sqs create-queue --queue-name "$queue_name" "$@" >/dev/null
  aws_sqs get-queue-url --queue-name "$queue_name" --query QueueUrl --output text
}

ensure_s3_bucket() {
  local bucket_name="$1"
  if aws_s3api head-bucket --bucket "$bucket_name" >/dev/null 2>&1; then
    return 0
  fi

  aws_s3api create-bucket --bucket "$bucket_name" >/dev/null
}

echo "== DynamoDB tables =="
ensure_ddb_table "$GAMESTATE_TABLE"
ensure_ddb_table "$COMMANDLOG_TABLE"

echo "== SQS queues (FIFO + DLQ) =="
DLQ_URL="$(ensure_sqs_queue_url \
  "$COMMANDS_DLQ_NAME" \
  --attributes FifoQueue=true,ContentBasedDeduplication=false)"
DLQ_ARN=$(aws_sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)

QUEUE_URL="$(ensure_sqs_queue_url \
  "$COMMANDS_QUEUE_NAME" \
  --attributes FifoQueue=true,ContentBasedDeduplication=false)"

REDRIVE_POLICY="$(printf '{"deadLetterTargetArn":"%s","maxReceiveCount":"5"}' "$DLQ_ARN")"
REDRIVE_POLICY_ESCAPED="${REDRIVE_POLICY//\"/\\\"}"
aws_sqs set-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attributes "{\"RedrivePolicy\":\"$REDRIVE_POLICY_ESCAPED\"}" >/dev/null

echo "COMMANDS_QUEUE_URL=$QUEUE_URL" > .env.local.queueurl
echo "Queue URL: $QUEUE_URL"

echo "== S3 buckets =="
ensure_s3_bucket "$UPLOADS_BUCKET"
aws_s3api put-bucket-cors \
  --bucket "$UPLOADS_BUCKET" \
  --cors-configuration '{"CORSRules":[{"AllowedHeaders":["*"],"AllowedMethods":["GET","HEAD","PUT"],"AllowedOrigins":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]}' >/dev/null
echo "Uploads bucket: $UPLOADS_BUCKET"
