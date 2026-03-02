#!/usr/bin/env bash
set -euo pipefail
source scripts/local/load-env.sh

aws_ddb() { aws --region "$AWS_REGION" --endpoint-url "$DDB_ENDPOINT" dynamodb "$@"; }

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

aws_ddb put-item --table-name "$GAMESTATE_TABLE" --item "{
  \"pk\": {\"S\":\"GAME#game-1\"},
  \"sk\": {\"S\":\"METADATA\"},
  \"type\": {\"S\":\"GameMetadata\"},
  \"gameId\": {\"S\":\"game-1\"},
  \"gmPlayerId\": {\"S\":\"gm-zzz\"},
  \"createdAt\": {\"S\":\"$now\"},
  \"updatedAt\": {\"S\":\"$now\"},
  \"version\": {\"N\":\"1\"}
}" || true

aws_ddb put-item --table-name "$GAMESTATE_TABLE" --item "{
  \"pk\": {\"S\":\"PLAYER#player-aaa\"},
  \"sk\": {\"S\":\"PROFILE\"},
  \"type\": {\"S\":\"PlayerProfile\"},
  \"playerId\": {\"S\":\"player-aaa\"},
  \"displayName\": {\"S\":\"Local Player\"},
  \"roles\": {\"L\":[{\"S\":\"PLAYER\"}]},
  \"createdAt\": {\"S\":\"$now\"},
  \"updatedAt\": {\"S\":\"$now\"}
}" || true

aws_ddb put-item --table-name "$GAMESTATE_TABLE" --item "{
  \"pk\": {\"S\":\"PLAYER#gm-zzz\"},
  \"sk\": {\"S\":\"PROFILE\"},
  \"type\": {\"S\":\"PlayerProfile\"},
  \"playerId\": {\"S\":\"gm-zzz\"},
  \"displayName\": {\"S\":\"Local GM\"},
  \"roles\": {\"L\":[{\"S\":\"PLAYER\"},{\"S\":\"GM\"}]},
  \"createdAt\": {\"S\":\"$now\"},
  \"updatedAt\": {\"S\":\"$now\"}
}" || true

echo "Seeded game-1, player-aaa, gm-zzz"
