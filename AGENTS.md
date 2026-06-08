# AGENTS.md

## Purpose

Build maintainable, verifiable TypeScript software for SwordRoom / Sword World. Optimize for explicit boundaries, narrow state, low-regression changes, and easy review. Prefer simple, explicit code over clever abstractions.

## Read order

Before changing code, read:

1. This file.
2. The nearest package-level `AGENTS.md`.
3. Any referenced document in `docs/` that affects the task.
4. Relevant fixtures and seed data when changing gameplay, character creation, auth, inbox, command, or persistence behavior.

If the human corrects the same class of mistake twice, update the relevant agent guidance so the fix persists.

## Related documents

- [UI](docs/ui.md) - rules for design and implementation of the UI in React/TypeScript

## Continuous Maintenance Discipline

Every time you touch a file, give it a review, as to prevent drift away from the repo rules.

- Every time you edit a file, review that file for adherence to the repo rules in `AGENTS.md` and relevant `docs/` files.
- If you find drift in code relevant to your task, immediately align it with the repo rules.
- If you find drift in code not relevant to your task, add it to your TODO list, and after finishing your task, output the TODO list, along with elegant solutions that will bring it back into compliance with the repo rules.

# Plan tool

- Skip for straightforward tasks; no single-step plans.
- Update the plan after completing each sub-task.
- Plan closure: reconcile every intention as Done, Blocked, or Cancelled.
  Do not end with in_progress/pending items.
- Promise discipline: don't commit to tests/refactors unless you will do them
  now. Label optional work as "Next steps" outside the committed plan.
- Only update the plan tool; do not message the user mid-turn about plan status.

# Presenting your work

Plain text output; the CLI handles styling. Be concise; friendly coding
teammate tone. Mirror the user's style.

- Lead with the change and context (where/why), not "Summary:".
- Flat bullets (`-`), short **bold** Title Case headers, no nesting.
- Don't dump large files; reference paths. Summarize command output.

## IaC as the Source of Truth

- Every time you need to change the AWS infrastructure, the change needs to happen via IaC template.
- Every IaC template change needs to be deployed and verified in AWS.
- You are not to do one-off changes in AWS using the AWS CLI. If for whatever reason that is the only way, you must get permission from the user to do so.

## Design Documents

When asked to write a design document, do not write a full implementation spec.

Write a handoff-oriented design document whose job is to help future agents implement the feature in small, testable, reviewable sessions.

The document must explain:

- what feature is being built
- why it exists
- how the work is divided into safe implementation slices
- what each slice must prove before it is considered done
- how each slice fits into the whole feature
- what boundaries future agents must not cross

The document must not over-specify ordinary implementation details that a competent coding agent can infer from the existing codebase.

## Repository model

- `packages/shared` owns shared contracts, DTOs, validation, command contracts, DB contracts, errors, fixtures, and pure shared rules.
- `packages/engine` owns pure game/domain logic. It may depend on `@starter/shared`.
- `packages/services/shared` owns service-side shared adapters, repositories, persistence helpers, and infrastructure-facing service utilities.
- `packages/services/api` owns HTTP/API behavior, auth resolution, command intake, upload URL issuance, read APIs, and API-facing orchestration.
- `packages/services/dispatcher` owns async command consumption and effect application.
- `packages/web` owns React UI, routes, pages, hooks, browser-side API clients, view models, and user interaction flows.
- `packages/test-browser-e2e` owns local-only Playwright browser regression tests.
- `packages/test-e2e` owns fixture-driven end-to-end paths.
- `fixtures`, `scripts/local`, `keycloak`, and `docs` are part of the working system, not disposable scaffolding.

## Dependency direction

- `web` may depend on `engine` and shared public contracts.
- `engine` may depend on `shared`.
- `services/api` and `services/dispatcher` may depend on `engine`, `services/shared`, and `shared`.
- `shared` must not depend on `web`, `engine`, or services.
- `engine` must not depend on React, HTTP, DynamoDB, SQS, S3, Keycloak, browser APIs, or service adapters.
- `web` must not import API or dispatcher implementation code.
- Services must not expose persistence models directly to the web.
- Promote code into `shared` only when it is stable, domain-relevant, and truly shared.

## Environment

- Assume development happens in VS Code with the repo devcontainer.
- Use pnpm workspace commands and checked-in Makefile/scripts.
- Use Node 20+ and pnpm 8+.
- Prefer `make dev-up` for the full local stack.
- Stop local stack with `make dev-down`, `q`, `Ctrl-C`, or `bash scripts/local/dev-down.sh`.
- Do not assume Chrome, React DevTools, or browser-inspection tooling as default agent workflow.
- Do not rely on ambient local services. Use checked-in local scripts.

## Done means

- Formatting passes.
- Lint passes if configured.
- Typecheck passes.
- Relevant unit tests pass.
- Relevant browser/E2E tests pass when the change touches user flows.
- New behavior is covered by tests.
- Docs, fixtures, and seed data are updated when behavior changes.
- The diff has been self-reviewed for duplication, dead code, accidental coupling, naming drift, and boundary violations.

## Supporting documents

- `docs/architecture.md`
- `docs/architecture.pregame-planning-loop.md`
- `docs/feature-structure.md`
- `docs/testing.md`
- `docs/ui.md`
- `docs/ux.pregame-flows.md`
- `docs/ux.phone-first-pregame-loop.md`
- `docs/ux-reference.pregame-flows.md`
- `docs/metrics.pregame-planning-loop.md`
- `docs/performance.md`
- `docs/operations.md`
- `docs/writing-design-documents.md`
