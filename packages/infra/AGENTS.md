# Infra Agent Contract

Use [`docs/deployment.aws-cdk.github-actions.yaml`](/workspaces/hello-world-monorepo/docs/deployment.aws-cdk.github-actions.yaml) as the implementation source of truth for generic AWS deployment work in this package.
Use [`docs/idm.aws-secure-architecture.yaml`](/workspaces/hello-world-monorepo/docs/idm.aws-secure-architecture.yaml) as the implementation source of truth for IDM, authentication, authorization, and access-control work that touches AWS deployment.

Rules:
- Do not invent a different deployment architecture unless the user explicitly changes the contract.
- Do not invent a different IDM or access-control architecture unless the user explicitly changes the contract.
- Prefer AWS CDK v2 in TypeScript and GitHub Actions with AWS OIDC.
- Keep [`packages/services/api/src/server.ts`](/workspaces/hello-world-monorepo/packages/services/api/src/server.ts) and [`packages/services/dispatcher/src/worker.ts`](/workspaces/hello-world-monorepo/packages/services/dispatcher/src/worker.ts) working for local development while adding AWS Lambda entrypoints.
- Treat work units, prerequisites, deliverables, and machine verification steps in the YAML contract as binding.
- When implementing a work unit, verify its listed commands before reporting completion.

- Keep Cognito scoped to end-user application authentication.
- Keep AWS human operator access on IAM Identity Center with MFA, not Cognito.
- Keep CI/CD access on GitHub OIDC assume-role flows, not human credentials or long-lived AWS keys.
- Use stack outputs to build and publish the SPA after infrastructure deploys instead of hardcoding API or OIDC endpoints in workflows.

Bootstrap path for initial platform admins:
- Create initial 'ADMIN' entitlements directly in DynamoDB only after the approved subject list exists and a change record is open.
- Use the Cognito or local OIDC 'sub' as the explicit 'playerId'; never bootstrap admin from email aliases, groups, or raw token role claims.
- Preferred bootstrap command template:

```bash
aws dynamodb put-item \
  --table-name "$GAMESTATE_TABLE" \
  --condition-expression "attribute_not_exists(pk) AND attribute_not_exists(sk)" \
  --item '{
    "pk": {"S": "PLAYER#<oidc-sub>"},
    "sk": {"S": "ENTITLEMENTS#PLATFORM"},
    "type": {"S": "PlatformEntitlement"},
    "playerId": {"S": "<oidc-sub>"},
    "roles": {"L": [{"S": "ADMIN"}]},
    "grantedByPlayerId": {"S": "<approved-operator-sub>"},
    "createdAt": {"S": "<iso8601>"},
    "updatedAt": {"S": "<iso8601>"}
  }'
```

- This bootstrap is auditable through CloudTrail plus the change ticket that approved the subject list, and it preserves the rule that application authorization stays in DynamoDB rather than the identity provider.
