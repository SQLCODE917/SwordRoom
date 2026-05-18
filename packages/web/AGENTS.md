# Web Package Conventions

`web` owns React rendering, hooks, selectors, view models, and feature-level orchestration.

## Rules

- Prefer one connected boundary per route or feature container.
- Most leaf components should receive props only.
- Components render view models; hooks orchestrate work.
- Use at most one selector per connected component, and have that selector return the component ViewModel.
- Keep state-machine transitions and ViewModel selection outside JSX.
- Keep selectors narrow and stable.
- Do not fetch data in leaf components.
- Centralize screen-level data loading.
- Reuse shared UI primitives before creating new components.
- Use CSS Modules.
- Prefer semantic HTML and minimal DOM.
- Add component tests for rendering behavior and interaction behavior.
- Add browser tests for full feature flows.

## Commands
- Use [`src/hooks/useCommandStatus.ts`](/workspaces/hello-world-monorepo/packages/web/src/hooks/useCommandStatus.ts) as the definitive command workflow API.
- In React code, submit commands through `useCommandWorkflow()`.
- Prefer `submitEnvelopeAndAwait()` when the page can build the command envelope locally.
- Use `submitAndAwait()` only when an existing flow helper already encapsulates command submission.
- Do not call `api.postCommand()` directly from pages or components.
- Do not hand-roll command polling with `getCommandStatus()`, `setTimeout()`, `setInterval()`, ad hoc `mapStatus()` helpers, or local `sleep()` helpers.
- Reuse `createCommandId()` from the hook module instead of duplicating UUID helpers.

## Routing
- `src/routes/` is the route entry layer.
- `src/pages/` contains page implementations.
- If a route file only re-exports a page, keep it as a thin wrapper.
- Avoid introducing new page implementations directly under `src/routes/` without a deliberate topology change.
