# Feature Structure

## Goal

Every feature should look familiar to both humans and agents.

## Client feature shape

Use a stable shape for non-trivial client features:

```text
packages/client/src/features/<feature-name>/
  components/
  selectors/
  state/
  __tests__/
  index.ts
```

### Rules

- `components/` render props and emit user actions.
- `state/` owns state machines, transitions, and side-effect intent.
- `selectors/` build narrow, stable ViewModels from feature state.
- `__tests__/` live beside the feature they verify.
- `index.ts` is the public feature entry point.

Each connected React component may use at most one selector, and that selector should return the ViewModel the component renders.

Most leaf components should stay props-driven when possible. If a leaf component does need a selector, keep it narrow and domain-named.

Components should not guess whether they are empty, loading, or ready by inspecting loosely related props. Those states should be first-class state-machine or ViewModel variants.

## Server feature shape

Use a stable shape for non-trivial server features:

```text
packages/server/src/features/<feature-name>/
  domain/
  services/
  routes/
  mappers/
  __tests__/
  index.ts
```

### Rules

- `domain/` holds pure business rules.
- `services/` orchestrate repositories, APIs, and domain logic.
- `routes/` stay thin.
- `mappers/` convert between transport, persistence, and domain shapes.
- `__tests__/` live beside the feature they verify.

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
