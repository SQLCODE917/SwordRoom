# Feature Structure

## Goal

Every feature should look familiar to both humans and agents.

Use stable feature shapes so domain logic, orchestration, mapping, and tests have predictable homes.

## Web feature shape

Use a stable shape for non-trivial browser features:

```text
packages/web/src/features/<feature-name>/
  components/
  hooks/
  selectors/
  state/
  flows/
  __tests__/
  index.ts
```

### Rules

- `components/` render props and emit user actions.
- `hooks/` bind browser behavior and feature orchestration to the page or route layer.
- `selectors/` build narrow, stable ViewModels from feature state and domain inputs.
- `state/` owns state machines, transitions, and local feature workflow state.
- `flows/` may contain focused client-side workflow helpers when they do not belong in generic hooks.
- `__tests__/` live beside the feature they verify.
- `index.ts` is the public feature entry point.

Each connected React component may use at most one selector, and that selector should return the ViewModel the component renders.

Most leaf components should stay props-driven when possible. If a leaf component does need a selector, keep it narrow and domain-named.

Components should not guess whether they are empty, loading, or ready by inspecting loosely related props. Those states should be first-class state-machine or ViewModel variants.

Keep `src/routes/` as the route entry layer and `src/pages/` as the page implementation layer. For non-trivial behavior, pages should compose feature modules instead of owning all orchestration directly.

## Service feature shape

Use a stable shape for non-trivial service features under both `packages/services/api` and `packages/services/dispatcher`:

```text
packages/services/<service-name>/src/features/<feature-name>/
  routes/       # api only when HTTP entrypoints exist
  handlers/     # dispatcher only when command/event handlers exist
  services/
  mappers/
  domain/
  __tests__/
  index.ts
```

### Rules

- `domain/` holds pure business rules that are service-owned rather than engine-owned.
- `services/` orchestrate repositories, APIs, authz checks, and engine calls.
- `routes/` stay thin and HTTP-facing.
- `handlers/` stay thin and command/event-facing.
- `mappers/` convert between transport, persistence, service, and engine shapes.
- `__tests__/` live beside the feature they verify.

Keep shared server infrastructure in package-level folders such as `config`, `middleware`, `repositories`, `authz`, `storage`, and `events`.

## Engine feature shape

Use a stable shape for non-trivial rule domains inside `packages/engine`:

```text
packages/engine/src/<rule-domain>/
  state.ts
  rules.ts
  transitions.ts
  __tests__/
  index.ts
```

### Rules

- Group engine code by Sword World rule domain, not by transport or app workflow.
- Keep engine inputs host-agnostic.
- Keep rule data and rule execution close together when that improves clarity.
- Expose only intentional public engine APIs through package entry points.

## Shared package shape

Keep `packages/shared` organized around stable shared concerns:

```text
packages/shared/src/
  contracts/
  rules/
  fixtures/
  <other-pure-shared-modules>
```

### Rules

- `contracts/` owns API, command, DB, and error contracts.
- `rules/` owns pure shared rule tables and helpers that are stable across package consumers.
- `fixtures/` owns shared fixture data that is part of the working system.
- Do not place environment-specific adapters or network behavior in shared.

## Shared UI primitives

Use a shared UI layer for primitives such as:

- Avatar
- Badge
- Breadcrumb
- Button
- Card
- DropdownMenu
- Form
- Notification

Before creating a new component, check whether the behavior is already covered by an existing primitive or a composition of primitives.

## Naming

- Name files by domain meaning, not implementation trivia.
- Name tests after behavior.
- Name selectors after the view model they produce.
- Name hooks after the behavior they bind.
- Name mappers after the boundary they cross.
