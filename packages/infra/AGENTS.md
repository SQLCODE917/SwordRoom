# Infra Agent Contract

Use [`docs/deployment.aws-cdk.github-actions.yaml`](/workspaces/hello-world-monorepo/docs/deployment.aws-cdk.github-actions.yaml) as the implementation source of truth for AWS deployment work in this package.

Rules:
- Do not invent a different deployment architecture unless the user explicitly changes the contract.
- Prefer AWS CDK v2 in TypeScript and GitHub Actions with AWS OIDC.
- Keep [`packages/services/api/src/server.ts`](/workspaces/hello-world-monorepo/packages/services/api/src/server.ts) and [`packages/services/dispatcher/src/worker.ts`](/workspaces/hello-world-monorepo/packages/services/dispatcher/src/worker.ts) working for local development while adding AWS Lambda entrypoints.
- Treat work units, prerequisites, deliverables, and machine verification steps in the YAML contract as binding.
- When implementing a work unit, verify its listed commands before reporting completion.
