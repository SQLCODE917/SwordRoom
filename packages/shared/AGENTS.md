# Shared Package Conventions

## Scope

`shared` contains stable shared concepts only.

## Allowed content

- domain types and shared value objects
- API contracts and DTO types under `src/contracts`
- command, DB, and error contracts
- validation schemas
- user-defined type guards
- pure utilities
- pure mapping helpers that are shared across packages
- pure shared rule tables and helpers
- shared fixtures that are part of the working system

## Forbidden content

- React code
- Express code
- browser APIs
- filesystem access
- network access
- environment-specific behavior
- auth implementations that talk to external systems
- code promoted into `shared` only to avoid duplication once

## Rules

- Keep `shared` side-effect free.
- Export explicit contracts.
- Prefer named exports.
- Validate and narrow at boundaries.
- Do not hide unsafe casts in shared helpers.
- Keep contract families aligned with the product routes and workflows they support.
- Do not place service adapters, web orchestration, or engine-owned rule execution in `shared`.
