# AGENTS.md

## Scope

`services` owns HTTP handling, orchestration, repositories, authorization, storage, events, and feature services.

## Rules

- Keep route handlers thin.
- Validate transport shapes at request and response boundaries.
- Keep business rules out of Express route handlers.
- Map explicitly between transport, domain, and persistence models.
- Keep external service adapters isolated from domain logic.
- Use feature folders for related server behavior under `src/features`.
- Keep shared server infrastructure in `config`, `middleware`, `repositories`, `authz`, `storage`, and `events`.
- Depend on `@starter/services-shared` for shared contracts and validation.
- Do not leak persistence models to the client.