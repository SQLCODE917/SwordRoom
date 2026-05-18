# AGENTS.md

## Scope

`shared` contains stable shared concepts only.

## Allowed content

- domain types
- API contracts and DTO types under `src/contracts`
- validation schemas
- user-defined type guards
- pure utilities
- pure mapping helpers that are shared across packages

## Forbidden content

- React code
- Express code
- browser APIs
- filesystem access
- network access
- environment-specific behavior
- code promoted into `core` only to avoid duplication once

## Rules

- Keep `core` side-effect free.
- Export explicit contracts.
- Prefer named exports.
- Validate and narrow at boundaries.
- Do not hide unsafe casts in shared helpers.
- Keep contract families aligned with the product routes: session, explorer, shares, uploads, downloads, and events.
