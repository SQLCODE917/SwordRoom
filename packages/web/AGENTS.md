# Web Package Conventions

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
