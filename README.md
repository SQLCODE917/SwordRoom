# Universal Hello World Monorepo Scaffold

This is a ready-to-use starter for new projects with:

- `@starter/core` - shared types/utilities/validation
- `@starter/server` - Node + Express API consuming core
- `@starter/client` - React + Vite app consuming core + server API types

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

Run in development (from this folder):

```bash
pnpm --filter @starter/server dev
pnpm --filter @starter/client dev
```

Server endpoint:

- `GET http://localhost:3000/api/hello?name=YourName`

## Why this scaffold

- Single source of truth for BE/FE contracts in `core`
- Server contract types exported and consumed by client
- Shared validation logic in `core` (no duplication)
- Monorepo build and test pipeline via root scripts
- Devcontainer for reproducible environment

## Customize for your project

1. Rename package scope from `@starter/*` to your org scope.
2. Replace Hello domain types in `packages/core/src/types.ts` with your domain.
3. Expand server routes while keeping request/response types tied to core.
4. Replace client UI while keeping API layer typed by server exports.