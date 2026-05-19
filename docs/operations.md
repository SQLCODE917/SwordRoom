# Operations

## Main commands

Full checks:

```bash
pnpm build
pnpm type-check
pnpm test
```

## Local stack

```bash
make dev-up
make dev-down
make resources
make seed
make keycloak-import
```

## Targeted checks:

```bash
pnpm --filter @starter/services-api test
pnpm --filter @starter/services-dispatcher test
pnpm --filter @starter/web test
pnpm --filter @starter/engine test
pnpm --filter @starter/shared test
```

## Browser tests:

```bash
pnpm test:browser:install
pnpm test:browser
pnpm test:browser:headed
```
