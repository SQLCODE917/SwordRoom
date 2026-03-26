#!/usr/bin/env bash
set -euo pipefail
source scripts/local/load-env.sh

aws_ddb() { aws --region "$AWS_REGION" --endpoint-url "$DDB_ENDPOINT" dynamodb "$@"; }

put_item() {
  aws_ddb put-item --table-name "$GAMESTATE_TABLE" --item "$1" || true
}

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

put_item "$(cat <<JSON
{
  "pk": {"S":"GAME#game-1"},
  "sk": {"S":"METADATA"},
  "type": {"S":"GameMetadata"},
  "gameId": {"S":"game-1"},
  "name": {"S":"Local Demo Game"},
  "visibility": {"S":"PUBLIC"},
  "createdByPlayerId": {"S":"gm-zzz"},
  "gmPlayerId": {"S":"gm-zzz"},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"},
  "version": {"N":"1"}
}
JSON
)"

put_item "$(cat <<JSON
{
  "pk": {"S":"GAME#game-1"},
  "sk": {"S":"MEMBER#gm-zzz"},
  "type": {"S":"GameMember"},
  "gameId": {"S":"game-1"},
  "playerId": {"S":"gm-zzz"},
  "roles": {"L":[{"S":"GM"}]},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"}
}
JSON
)"

put_item "$(cat <<JSON
{
  "pk": {"S":"PLAYER#player-aaa"},
  "sk": {"S":"PROFILE"},
  "type": {"S":"PlayerProfile"},
  "playerId": {"S":"player-aaa"},
  "displayName": {"S":"Local Player"},
  "email": {"S":"player@example.com"},
  "emailNormalized": {"S":"player@example.com"},
  "emailVerified": {"BOOL":true},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"}
}
JSON
)"

put_item "$(cat <<JSON
{
  "pk": {"S":"PLAYER#gm-zzz"},
  "sk": {"S":"PROFILE"},
  "type": {"S":"PlayerProfile"},
  "playerId": {"S":"gm-zzz"},
  "displayName": {"S":"Local GM"},
  "email": {"S":"gm@example.com"},
  "emailNormalized": {"S":"gm@example.com"},
  "emailVerified": {"BOOL":true},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"}
}
JSON
)"

put_item "$(cat <<JSON
{
  "pk": {"S":"PLAYER#admin-001"},
  "sk": {"S":"PROFILE"},
  "type": {"S":"PlayerProfile"},
  "playerId": {"S":"admin-001"},
  "displayName": {"S":"Local Admin"},
  "email": {"S":"admin@example.com"},
  "emailNormalized": {"S":"admin@example.com"},
  "emailVerified": {"BOOL":true},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"}
}
JSON
)"

put_item "$(cat <<JSON
{
  "pk": {"S":"PLAYER#admin-001"},
  "sk": {"S":"ENTITLEMENTS#PLATFORM"},
  "type": {"S":"PlatformEntitlement"},
  "playerId": {"S":"admin-001"},
  "roles": {"L":[{"S":"ADMIN"}]},
  "grantedByPlayerId": {"S":"bootstrap"},
  "createdAt": {"S":"$now"},
  "updatedAt": {"S":"$now"}
}
JSON
)"

echo "Seeded game-1 with player-aaa identity, gm-zzz game membership, and admin-001 platform entitlement"
