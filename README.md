# Character Creation Vertical Slice Monorepo

Source-of-truth contracts live in:
- `design-decisions/character-creation-vertical-slice/vertical-slice.character-creation.engine.yaml`
- `design-decisions/character-creation-vertical-slice/vertical-slice.character-creation.async-layer.yaml`
- `design-decisions/character-creation-vertical-slice/vertical-slice.character-creation.db-schema.yaml`
- `design-decisions/character-creation-vertical-slice/vertical-slice.character-creation.fixtures.yaml`

Mapped workspace layout:
- `packages/engine` (pure TS + zod + unit tests, zero AWS deps)
- `packages/infra` (CloudFormation scaffold)
- `packages/services/api`
- `packages/services/dispatcher`
- `packages/services/shared`
- `packages/web` (basic placeholder)
- `packages/test-e2e`
- `fixtures/vertical-slice.character-creation.fixtures.yaml` (symlink to source-of-truth)
- `docs/vertical-slice.character-creation.*.yaml` (symlinks to source-of-truth)

## Commands

```bash
pnpm test
pnpm type-check
pnpm build
```
