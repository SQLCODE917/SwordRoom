# Architecture

## Package boundaries

- `packages/shared`: shared contracts, DTOs, validation, errors, fixtures, and pure shared helpers
- `packages/engine`: pure Sword World domain logic and rules execution
- `packages/services/shared`: service-side shared adapters, repositories, persistence helpers, and infrastructure-facing utilities
- `packages/services/api`: HTTP/API behavior, auth resolution, command intake, uploads, and read-side orchestration
- `packages/services/dispatcher`: async command consumption and effect application
- `packages/web`: React rendering, routes, pages, hooks, selectors, view models, and user interaction flows

## Dependency direction

- `engine` may depend on `shared`.
- `web` may depend on `engine` and shared public contracts.
- `services/api` and `services/dispatcher` may depend on `engine`, `services/shared`, and `shared`.
- `shared` must not depend on `engine`, `web`, or services.
- `engine` must not depend on React, HTTP, persistence SDKs, queue SDKs, browser APIs, or service adapters.
- `web` must not depend on API or dispatcher implementation code.
- Services must not expose persistence models directly to the web.

## Ownership model

- `shared` owns stable transport contracts, validation, shared errors, DB contracts, and neutral pure helpers.
- `engine` owns rule execution, game/domain state transitions, legality checks, and deterministic calculators.
- Services own transport decoding, auth, authorization, persistence, event handling, and orchestration around the engine.
- `web` owns feature orchestration for the browser, route/page composition, command submission, selectors, and rendering.

Promote code into `shared` only when it is stable, domain-relevant, and truly shared across package boundaries.

## Model flow

Use explicit model transitions:

1. `unknown` input
2. validated transport DTO
3. domain model
4. view model or response DTO

Do not skip layers when the shapes serve different purposes.

## State modeling

Represent meaningful UI and workflow states with discriminated unions.

Example:

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };
```

Do not model meaningful state machines with loosely related booleans.

## Frontend state machines and ViewModels

Feature state machines own meaningful UX states and transitions.

ViewModel selection belongs in the state machine layer or pure selectors, not inside React JSX.

Use explicit ViewModel states such as:

- `null` when there is intentionally nothing to render
- `loading` while a request or data pipeline is active
- `ready` when a meaningful UX state can be rendered
- `error` when the user needs a recoverable failure state

Ready ViewModels may have multiple variants, but variant selection should be declarative and testable outside the component.

## Separation of concerns

- Pure functions transform data.
- Engine functions apply rules and state transitions.
- Orchestrators coordinate side effects.
- Route handlers decode requests and encode responses.
- Hooks bind UI actions to state transitions.
- Components render view models.
- Adapters talk to external systems.

## Mapping

Prefer explicit mapping functions:

- DTO -> domain
- persistence -> domain
- domain -> ViewModel
- domain -> response DTO
- app model -> engine input
- engine result -> persistence or response model

Avoid passing raw API payloads directly into React components or raw persistence shapes directly into the engine.

## Validation

Validate at every trust boundary:

- inbound HTTP
- outbound HTTP
- environment variables
- storage payloads
- third-party API responses

Use `unknown` at the boundary, then validate and narrow.
