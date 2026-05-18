# Refactoring Design: Guidance Alignment

## Purpose

This document proposes a staged refactoring of the monorepo so the codebase aligns with the current agent guidance:

- root [`AGENTS.md`](/workspaces/hello-world-monorepo/AGENTS.md)
- package-level `AGENTS.md` files
- supporting docs referenced by those agent files

The goal is not cosmetic consistency. The goal is to make package boundaries, ownership, tests, and feature shapes explicit enough that both humans and agents make lower-regression changes by default.

## Design goals

- Make package boundaries match the documented repository model.
- Make `packages/engine` a host-agnostic Sword World rules engine.
- Keep `packages/shared` limited to stable shared contracts and pure helpers.
- Make service packages thin at transport boundaries and organized by feature.
- Make web features centered on route-level orchestration, narrow selectors, and ViewModels.
- Bring docs, tests, and package structure into agreement so instructions stop contradicting implementation.

## Source of truth

Guidance precedence for refactoring decisions:

1. Rule documents for Sword World behavior.
2. Root package ownership and dependency rules in [`AGENTS.md`](/workspaces/hello-world-monorepo/AGENTS.md).
3. Package-level `AGENTS.md` contracts.
4. Supporting docs in `docs/`.
5. Existing code shape.

When existing code conflicts with the guidance, refactor the code unless the guidance itself is stale or contradictory. In those cases, update the docs first in the same workstream.

## Current alignment gaps

### 1. Documentation drift

- [`docs/architecture.md`](/workspaces/hello-world-monorepo/docs/architecture.md) partially reflects the new package model, but still uses old `core/server/client` terminology in several rules.
- [`docs/feature-structure.md`](/workspaces/hello-world-monorepo/docs/feature-structure.md) still prescribes `packages/client` and `packages/server` layouts instead of `packages/web` and `packages/services/*`.
- [`packages/shared/AGENTS.md`](/workspaces/hello-world-monorepo/packages/shared/AGENTS.md) still refers to `core`, which no longer exists as a package.

This creates instruction conflicts before any code is touched.

### 2. `packages/shared` no longer contains service-side auth adapters, but the package boundary still needs guarding

The package contract says shared content must be stable, side-effect free, and must not contain network access or environment-specific behavior. The service-side auth helpers have already been moved out of `shared`, but this boundary should now be enforced consistently in future refactors.

The completed move established the correct home in:

- [`packages/services/shared/src/authDev.ts`](/workspaces/hello-world-monorepo/packages/services/shared/src/authDev.ts)
- [`packages/services/shared/src/authOidc.ts`](/workspaces/hello-world-monorepo/packages/services/shared/src/authOidc.ts)

The remaining task here is preventative: keep new environment-aware helpers out of `shared` and add package-level enforcement if this class of mistake reappears.

### 3. `packages/engine` has started shedding app-shaped inputs, but character-creation structure is still flat

The engine contract now says engine APIs should remain standalone and host-agnostic. Current examples still depend on app-specific shared shapes and fixtures:

- [`packages/engine/src/index.ts`](/workspaces/hello-world-monorepo/packages/engine/src/index.ts)
- [`packages/engine/src/types.ts`](/workspaces/hello-world-monorepo/packages/engine/src/types.ts)

The gameplay slice has already been corrected:

- gameplay rules now live under [`packages/engine/src/gameplay/`](/workspaces/hello-world-monorepo/packages/engine/src/gameplay)
- gameplay APIs now accept engine-owned scene and combat-profile inputs
- dispatcher code now maps app models into engine inputs before calling the engine

The remaining engine work is structural and package-wide:

- split character-creation logic out of the root [`packages/engine/src/index.ts`](/workspaces/hello-world-monorepo/packages/engine/src/index.ts)
- move game rules and character-creation rules fully into domain folders
- keep reducing engine reliance on broad shared contract types where narrower engine-owned types are clearer

### 4. Services are not yet feature-shaped

The services contract says related behavior should live under `src/features`, with thin routes and explicit mapping. Current API code is still largely flat and centralized:

- [`packages/services/api/src/httpRoutes.ts`](/workspaces/hello-world-monorepo/packages/services/api/src/httpRoutes.ts)

The dispatcher is closer to the target shape because it already has handler subfolders, but the API package still concentrates routing, validation, authorization, and orchestration in broad files.

### 5. Web feature orchestration is still page-heavy

The web contract calls for narrow connected boundaries, selector/ViewModel-driven rendering, and command submission through `useCommandWorkflow()`. Current hotspots still mix route loading, local workflow state, command building, timers, and rendering in single page files:

- [`packages/web/src/pages/CharacterWizardPage.tsx`](/workspaces/hello-world-monorepo/packages/web/src/pages/CharacterWizardPage.tsx)

There is also direct command posting in flow helpers:

- [`packages/web/src/flows/characterWizardCommands.ts`](/workspaces/hello-world-monorepo/packages/web/src/flows/characterWizardCommands.ts)

This conflicts with the web command guidance and makes it harder to reason about page behavior through ViewModels and focused tests.

### 6. Tests do not yet fully mirror the target architecture

The testing guidance prefers:

- data-in/data-out unit tests
- direct coverage for state machines, selectors, mappers, rule functions, and command builders
- browser tests at full feature boundaries

The current codebase already has tests, but the package shapes do not consistently expose those seams. Some files still blend rule logic, orchestration, transport, and page state in ways that force broader tests than necessary.

## Target architecture

### Shared

`packages/shared` should contain only:

- stable contracts under `src/contracts`
- validation schemas
- stable shared errors
- pure type guards
- pure shared rule tables and rule helpers
- shared fixtures that are application-neutral and documented

`shared` should not contain:

- auth implementations
- OIDC/JWKS fetching
- `process.env` reads
- browser logic
- service orchestration

### Engine

`packages/engine` should become the only package that executes Sword World rules.

It should own:

- character creation legality and state transitions
- gameplay procedure resolution
- combat resolution
- equipment legality and rule application
- engine-specific domain errors
- engine-owned domain input and output types where host-neutrality matters

It should accept plain inputs such as:

- skill levels
- ability scores
- rolled totals
- combatants
- scenario descriptors
- item catalog entries

It should not require:

- API DTO names
- persistence models
- `CharacterItem`
- route identities
- application fixture formats

### Services

`packages/services/api` and `packages/services/dispatcher` should be the application boundary around the engine.

They should own:

- transport validation
- auth resolution
- authorization
- repository access
- command intake and dispatch
- mapping between transport, persistence, and engine models

Target API shape:

```text
packages/services/api/src/
  features/
    characters/
      routes/
      services/
      mappers/
      __tests__/
      index.ts
    games/
    gameplay/
    inbox/
  config/
  middleware/
  authz/
  repositories/
  storage/
  events/
```

Target dispatcher shape:

```text
packages/services/dispatcher/src/
  features/
    character/
      handlers/
      services/
      mappers/
      __tests__/
      index.ts
    game/
    gameplay/
  config/
  repositories/
  events/
```

### Web

`packages/web` should organize non-trivial work by feature and keep pages thin.

Target shape:

```text
packages/web/src/
  features/
    character-wizard/
      components/
      hooks/
      selectors/
      state/
      flows/
      __tests__/
      index.ts
    gameplay/
    inbox/
  pages/
  routes/
  components/
  hooks/
  api/
```

Expected behavior:

- routes remain entry points
- pages compose feature containers
- selectors return ViewModels
- leaf components receive props
- command submission goes through the command workflow hook contract
- polling logic is centralized instead of reimplemented in pages or feature helpers

## Refactoring principles

- Prefer boundary-extracting refactors over rewrites.
- Move one concern at a time: docs, then types, then mappers, then call sites.
- Preserve behavior with narrow tests before changing structure.
- Keep old adapters temporarily when needed, but mark them transitional and remove them within the same workstream.
- Do not promote code into `shared` just to avoid a local dependency.
- Do not pull app-layer concerns into `engine` just because a current call site already uses them.

## Proposed workstreams

### Workstream 1: Correct the guidance set

Update docs so the guidance is internally consistent before large code moves.

Changes:

- rewrite [`docs/architecture.md`](/workspaces/hello-world-monorepo/docs/architecture.md) to use `shared / engine / services / web`
- rewrite [`docs/feature-structure.md`](/workspaces/hello-world-monorepo/docs/feature-structure.md) to describe `packages/web` and `packages/services/*`
- update [`packages/shared/AGENTS.md`](/workspaces/hello-world-monorepo/packages/shared/AGENTS.md) to remove obsolete `core` terminology

Outcome:

- one stable architectural vocabulary
- fewer contradictory instructions for future edits

### Workstream 2: Purify `packages/shared`

Move environment- and network-aware helpers out of shared.

Changes:

- move `devAuth` behavior into a service or web dev-auth adapter package location
- move local OIDC verification into service-side auth modules
- keep only contracts and pure validation helpers in shared

Outcome:

- shared becomes safe to import from all packages
- fewer accidental side effects in packages that depend on shared

Status:

- completed for auth adapter extraction
- follow-up enforcement should happen only if a future change tries to place environment-aware logic back into `shared`

### Workstream 3: Decouple engine from app-shaped models

Introduce engine-owned input models and mapping boundaries.

Changes:

- replace engine APIs that consume `CharacterItem` with narrower engine inputs
- replace direct fixture-shaped gameplay seeding with engine scenario inputs
- keep compatibility adapters in services or web as needed
- split `packages/engine/src/index.ts` exports by domain area if needed

Suggested target engine shape:

```text
packages/engine/src/
  characterCreation/
    state.ts
    rules.ts
    transitions.ts
    __tests__/
    index.ts
  gameplay/
    state.ts
    checks.ts
    combat.ts
    scenarios.ts
    __tests__/
    index.ts
  games/
    rules.ts
    __tests__/
    index.ts
  index.ts
```

Outcome:

- engine becomes reusable across multiple host applications
- engine tests become smaller and more rule-focused

Status:

- gameplay boundary extraction is completed
- engine folder restructuring has started with `games/` and `gameplay/`
- character-creation extraction is still required to finish this workstream

### Workstream 4: Introduce service feature folders and mapping layers

Refactor the API and dispatcher into explicit feature modules.

Changes:

- break up `httpRoutes.ts` into feature route modules
- add request/response validation per route family
- move domain mapping out of broad route handlers
- give dispatcher feature handlers explicit engine-facing mappers

Outcome:

- thinner transport layer
- easier review of feature-specific changes
- clearer boundary between orchestration and rules

Status:

- started
- `packages/services/api/src/httpRoutes.ts` is now being decomposed into feature route modules
- extracted feature route slices now include `admin`, `characters`, `commands`, `games`, `gameplay`, `gm`, and `me`
- `httpRoutes.ts` now acts as a route-composition and shared-dispatch module rather than the primary home of route definitions
- next in this workstream:
  split feature-owned read/orchestration logic out of [`packages/services/api/src/index.ts`](/workspaces/hello-world-monorepo/packages/services/api/src/index.ts) before beginning Workstream 5
- continue this workstream before starting Workstream 5

### Workstream 5: Move web behavior into feature modules and ViewModels

Refactor broad pages into feature containers, selectors, and smaller hooks.

Changes:

- extract character wizard state, command building, and derived display logic into `features/character-wizard`
- keep `pages/CharacterWizardPage.tsx` as a route/page shell
- migrate direct `api.postCommand()` flow helpers toward `useCommandWorkflow()` entry points
- centralize polling and command-status mapping through the existing hook contract

Outcome:

- pages become easier to scan
- feature tests can target state, selectors, and rendering separately
- command behavior becomes consistent across pages

### Workstream 6: Align tests with seams

As each workstream lands, move tests toward the documented layering.

Changes:

- engine: table-driven rule tests
- shared: contract and pure helper tests
- services: route boundary tests plus mapper/service unit tests
- web: selector/ViewModel/state tests plus component tests
- browser: only full user flows and regressions

Outcome:

- smaller, faster unit feedback
- browser tests reserved for real end-to-end risk

## Execution order

Recommended order:

1. Guidance/doc alignment.
2. Shared purification.
3. Engine boundary extraction.
4. Service mapping and feature extraction.
5. Web feature extraction and command workflow cleanup.
6. Follow-up doc refresh and dead-code removal.

This order minimizes churn because the package boundaries become trustworthy before broad code motion begins.

## Execution recommendations

- Finish Workstream 3 immediately before starting Workstream 4.
  Recommendation:
  extract character-creation logic from [`packages/engine/src/index.ts`](/workspaces/hello-world-monorepo/packages/engine/src/index.ts) into a dedicated `characterCreation/` domain folder in the next engine-focused refactor slice.
- Start Workstream 4 only after Workstream 3 is fully complete.
  Recommendation:
  begin with `packages/services/api/src/httpRoutes.ts` because it is the broadest remaining service boundary file and will benefit most from feature extraction once engine APIs are stable.
- Continue Workstream 4 immediately after route extraction by moving feature-owned read/orchestration logic out of [`packages/services/api/src/index.ts`](/workspaces/hello-world-monorepo/packages/services/api/src/index.ts).
  Recommendation:
  extract the `readApis` methods feature by feature, starting with the same route families already split out of `httpRoutes.ts` so route and orchestration ownership converge together.
- Start Workstream 5 only after the first API and dispatcher feature folders exist.
  Recommendation:
  begin with [`packages/web/src/pages/CharacterWizardPage.tsx`](/workspaces/hello-world-monorepo/packages/web/src/pages/CharacterWizardPage.tsx) because it is the clearest high-risk example of page-heavy orchestration and direct command coupling.
- Revisit test-architecture cleanup during each workstream, not as a separate final sweep.
  Recommendation:
  add or move narrow tests in the same slice that introduces each new seam.

## Migration strategy

- Keep refactors incremental and behavior-preserving.
- Introduce new module boundaries beside old ones first.
- Add tests at the new seam before deleting legacy paths.
- Convert one feature family at a time:
  - character creation
  - gameplay
  - games/invites
  - inbox/chat
- Delete compatibility adapters only after all imports are moved.

## Risks

- Moving too much at once will hide behavioral regressions inside structural churn.
- Replacing shared types too aggressively may break service and web call sites without clarifying ownership.
- Refactoring pages without first extracting ViewModels may just relocate complexity.
- Browser-flow changes are likely to regress if command workflow behavior is changed without targeted tests.

## Non-goals

- rewriting all product behavior
- replacing the command architecture
- introducing a new global state library
- redesigning the UI theme system
- optimizing performance ahead of boundary clarity unless a refactor uncovers a measured regression

## Acceptance criteria

The refactoring program is complete when:

- package boundaries in code match the documented repository model
- docs use one consistent vocabulary
- `shared` is side-effect free and environment-neutral
- `engine` can be consumed through host-agnostic rule APIs
- services map explicitly between transport, persistence, and engine models
- web features expose ViewModels and keep route/page files thin
- tests exist at each documented seam
- obsolete compatibility modules and stale docs are removed

## Verification

For each completed workstream, run the narrowest relevant checks first, then broader repo checks:

```bash
pnpm --filter @starter/shared test
pnpm --filter @starter/engine test
pnpm --filter @starter/services-api test
pnpm --filter @starter/services-dispatcher test
pnpm --filter @starter/web test
pnpm build
pnpm type-check
pnpm test
```

When user flows change, add or update browser coverage:

```bash
pnpm test:browser
```
