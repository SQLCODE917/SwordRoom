# Architecture

## Package boundaries

- `packages/engine`: true standalone rules engine
- `packages/shared`: shared contracts and pure logic only.
- `packages/services`: Express-facing application layer, orchestration, adapters, mappers, and data services.
- `packages/web`: React-facing application layer, view models, selectors, hooks, and presentational components.

## Core rules

- `engine` owns implementations of Sword World rules
- `core` owns shared domain types, validation schemas, user-defined type guards, DTO contracts, and pure utilities.
- `server` and `client` may both depend on `core`.
- `client` must not depend on `server`.
- `server` must not expose persistence models directly to the client.

## Model flow

Use explicit model transitions:

1. `unknown` input
2. validated transport DTO
3. domain model
4. view model or response DTO

Do not skip layers when the shapes serve different purposes.

## State modeling

Represent UI and workflow state with discriminated unions.

Example:

```ts
type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };
```

Do not model meaningful state machines with loosely related booleans.

## Frontend state machines and ViewModels

Feature state machines own meaningful UX states and transitions.

ViewModel selection belongs in the state machine layer or pure selectors, not inside React JSX.

Use explicit ViewModel states such as:

- `null` when there is intentionally nothing to render,
- `loading` while a request or data pipeline is active,
- `ready` when a meaningful UX state can be rendered,
- `error` when the user needs a recoverable failure state.

Ready ViewModels may have multiple variants, but variant selection should be declarative and testable outside the component.

## Separation of concerns

- Pure functions transform data.
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

Avoid passing raw API payloads directly into React components.

## Validation

Validate at every trust boundary:

- inbound HTTP
- outbound HTTP
- environment variables
- storage payloads
- third-party API responses

Use `unknown` at the boundary, then validate and narrow.
