# Pregame Planning Loop Architecture Design

## 1. Feature Summary

SwordWorld is intended to support groups who prepare for play asynchronously. The pregame planning loop exists so that character creation, party coordination, and GM guidance can produce momentum before a live session begins.

The current limitation is not a lack of async infrastructure. The repo already has command-driven writes, read APIs, a character wizard, game chat, and inboxes. The missing piece is a coherent architecture that treats drafting, sharing, discussion, and re-entry as one system instead of several adjacent features.

The desired end state is a game-scoped planning system with stable artifact semantics, specialized read models, and explicit ownership boundaries so multiple implementation streams can extend the loop without collapsing rules, chat, inbox, and creator concerns into one oversized model.

## 2. Current State

### Relevant existing behavior and modules

- `packages/web/src/pages/CharacterWizardPage.tsx` implements the current character creation route.
- `packages/web/src/pages/GameChatPage.tsx` implements the current game chat route.
- `packages/web/src/pages/CharacterSheetPage.tsx` implements the current detailed character read surface.
- `packages/web/src/pages/PlayerInboxPage.tsx` and `packages/web/src/pages/GMInboxPage.tsx` implement async inbox surfaces.
- `packages/web/src/features/character-wizard/` already follows the repo's feature-oriented web shape and provides a useful seam for future work.
- `packages/services/api/src/features/gameplay/routes.ts` and `service.ts` currently expose game chat reads.
- `packages/services/api/src/features/games/routes.ts` and `service.ts` currently expose character reads.
- `packages/services/api/src/features/me/routes.ts` and `packages/services/api/src/features/gm/routes.ts` expose inbox reads.
- `packages/services/api/src/features/commands/service.ts` already authorizes command intake for draft saves, approval submission, and chat messages.
- `packages/services/dispatcher/src/handlers/character/saveWizardProgress.ts` already applies draft-save behavior.
- `packages/services/dispatcher/src/handlers/game/sendGameChatMessage.ts` already applies game chat writes.
- `packages/shared/src/contracts/commands.ts` already contains the stable command contract layer.

### Existing architectural patterns that matter

- The repo is command-driven for writes and read-model-driven for UI reads.
- Package ownership and dependency rules are defined in `AGENTS.md` and `docs/architecture.md`.
- Web feature structure is defined in `docs/feature-structure.md` and `packages/web/AGENTS.md`.
- Service responsibilities are defined in `packages/services/AGENTS.md`.
- The UI layer is intentionally responsive across phone, tablet, and desktop per `docs/ui.md`.

### Existing tests that matter

- `packages/web/src/pages/GameChatPage.test.tsx`
- `packages/web/src/pages/CharacterSheetPage.test.tsx`
- `packages/web/src/features/character-wizard/useCharacterWizardWorkflow.test.ts`
- `packages/web/src/features/character-wizard/commands.test.ts`
- `packages/services/api/src/index.test.ts`
- `packages/services/api/src/routeAuth.test.ts`
- `packages/services/dispatcher/src/handlers/game/sendGameChatMessage.test.ts`
- `packages/services/dispatcher/src/handlers/character/characterRules.test.ts`
- `packages/services/dispatcher/src/index.test.ts`

### Known architectural limitations

- Character drafting and chat are both present, but there is no stable shared-artifact seam between them.
- There is no specialized planning hub read concern between home and transcript.
- Inbox surfaces are async-capable but remain largely approval- and notification-oriented rather than planning-oriented.
- Chat is transcript-centric and does not yet preserve the semantics of discussing a particular draft revision.
- Without explicit guardrails, future work could push social-planning concepts into the engine or leak persistence concerns upward into the web.

## 3. Target State

### Final system behavior

When the feature is complete, the system should support this flow:

1. a player drafts or revises a character
2. the player shares a game-scoped artifact representing that draft or revision
3. the artifact appears in the game conversation and can be previewed or discussed
4. structured planning signals such as party needs or GM prompts influence the next revision
5. inbox or digest surfaces route absent users back into the same loop

The system remains asynchronous by default. Live presence may improve responsiveness, but it must not become a prerequisite for making progress.

### Final bounded capabilities

#### Private drafting workspace

- Owns incomplete and exploratory character work.
- Optimizes for revision without social pressure.
- May exist outside an active game context until the user chooses to share into one.

#### Game-scoped planning hub

- Owns the shared answer to "what should happen next for this game?"
- Surfaces party needs, GM direction, and recent planning activity.
- Is distinct from the raw transcript and from the full sheet.

#### Shared character artifacts

- Represent discussable character snapshots or revisions.
- Bridge creator state and conversation state.
- Preserve meaning across later edits.

#### Pregame conversation

- Owns discussion, replies, and social follow-up.
- May reference planning artifacts and prompts.
- Does not become the source of truth for character legality.

#### Digest and re-entry surfaces

- Own re-entry for players who were away.
- Remain derivative of primary planning and conversation state.
- Must guide the user back into the main loop rather than becoming a parallel workflow.

### Final integration seams

- A stable shared-artifact seam between drafting and conversation
- A planning-hub read model that is distinct from transcript and sheet reads
- A lightweight shared-artifact preview read that is distinct from the full character sheet
- A digest layer derived from primary planning and conversation state

### Compatibility expectations

- Existing command-driven write behavior remains the core mutation model.
- Existing character-sheet reads remain authoritative for detailed character inspection.
- Existing inbox and approval flows remain valid during incremental rollout.
- Existing package boundaries remain in force.

### Why the system exists in this shape

The product thesis is that busy groups need durable moves rather than synchronous coordination. The architecture therefore separates rules, shared artifacts, conversation, planning views, and digests because they answer different questions and must evolve at different rates. This separation prevents local optimizations in one surface from weakening the full pregame loop.

## 4. Non-Goals

- Do not introduce live collaborative editing as a prerequisite for pregame planning.
- Do not move social-planning logic into `packages/engine`.
- Do not replace the current command log and queue-based async write model.
- Do not collapse planning hub, conversation, full sheet, and digest into one oversized read model.
- Do not expand the feature into cross-game social discovery or community browsing.
- Do not redesign unrelated auth, gameplay, or approval architecture except where this feature requires narrow compatibility work.

## 5. Guardrails

### Ownership boundaries

- `packages/shared` owns stable cross-package contracts and validation for planning concepts that must cross boundaries.
- `packages/engine` owns character legality, derived stats, and deterministic rule projections only.
- `packages/services/api` owns read APIs, authorization, and write intake for planning behavior.
- `packages/services/dispatcher` owns async application of planning commands and durable side effects.
- `packages/services/shared` owns persistence and infrastructure helpers used by the services layer.
- `packages/web` owns navigation, view models, responsive composition, and browser-side orchestration.

### Directionality rules

- Web may depend on shared public contracts and engine-derived summaries.
- Services may orchestrate engine calls and persistence to support planning behavior.
- Engine must not depend on chat, prompt, reaction, digest, lobby, or browser concepts.
- Shared must not encode browser-only layout choices or persistence-only storage details.

### Artifact semantics

- Shared character artifacts must refer to an explicit snapshot or revision, not an implicit mutable latest state.
- Later character edits must not silently rewrite the meaning of earlier conversation.
- Artifact identity must remain game-scoped once a draft is shared into a game.

### Read-model specialization

- Planning hub, conversation, artifact preview, full character sheet, and digest are distinct read concerns.
- No single read model should try to answer all five questions equally.
- Social surfaces should prefer lightweight summaries; full sheets remain available for deep inspection.

### Authority separation

- Character legality remains authoritative in engine-backed character logic.
- Prompts, role claims, replies, and reactions remain social-planning signals.
- Social-planning state may summarize rules-derived outputs but must not override them.

### Digest derivation

- Inbox and digest surfaces must be reproducible from primary planning and conversation state.
- Important planning state must not exist only in a digest row.
- Re-entry surfaces must route the user back to primary planning surfaces rather than becoming a long-term data silo.

### Failure behavior

- Failed social actions must not destroy draft state or erase historical meaning.
- Missing preview data or stale derived reads must degrade gracefully.
- Partial rollout must preserve existing sheet, chat, and inbox routes while new planning surfaces are added.

### Performance and shape constraints

- Phone is the baseline interaction model.
- Planning surfaces should load summary data first rather than requiring exhaustive sheet payloads to render useful state.
- Desktop and tablet may reveal more simultaneous context, but they must not create a separate required workflow.

### Test requirements

- Changes to stable contracts must add or update shared and service-side contract coverage.
- Changes to projections or command application must add or update API and dispatcher tests.
- Changes to visible planning behavior must add or update component, page, or browser tests in `packages/web`.
- Route-level loop changes should add or update browser coverage in addition to unit coverage.

## 6. Implementation Slices

### Slice 1: Stable Shared-Artifact Seam

**Purpose**

Create the architectural seam that lets a character draft or revision become a discussable game-scoped artifact without changing engine responsibility.

**Scope**

- Introduce the shared concept of a pregame planning artifact across the relevant boundaries.
- Preserve existing character-authority and chat-authority responsibilities.
- Add the minimum compatible persistence and read support needed for downstream slices.

**Out of Scope**

- lobby UI
- prompt workflows
- digest improvements
- broad chat redesign

**Expected Behavior After This Slice**

- The system can persist and read a game-scoped shared character artifact with stable identity and stable meaning.
- Existing draft-save and chat behavior still work.
- Future slices have a seam they can build through without redefining artifact semantics.

**Contracts and Boundaries**

- Artifact semantics are shared-contract territory only when they must cross package boundaries.
- Artifact snapshots are not engine-owned concepts.
- Existing character-sheet reads remain authoritative for detailed character inspection.

**Testable Hypotheses**

- Given a shared artifact, later draft edits do not rewrite the earlier artifact's meaning.
- Given an unauthorized actor, the system rejects attempts to share into an unrelated game.
- Given existing character-save and chat flows, behavior remains backward compatible.

**Verification**

- Update shared contract coverage where cross-package planning concepts become stable.
- Update API authorization and dispatcher application tests.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm type-check`.

**Definition of Done**

- Artifact identity, scope, and revision semantics are explicit and tested.
- Existing write and read seams remain functional.
- Future slices can reference the artifact seam without redefining it.

**Handoff Notes for Next Agent**

- Future work may assume a stable game-scoped artifact concept exists and that it is separate from mutable draft state.

### Slice 2: Planning-Hub Projection

**Purpose**

Add the read concern that answers "what should happen next for this game?" without overloading chat or inbox.

**Scope**

- Introduce a planning-hub projection and route-level consumption surface.
- Combine the minimum planning signals needed to orient a returning player.
- Preserve transcript and sheet reads as distinct concerns.

**Out of Scope**

- artifact preview behavior
- full creator-to-chat sharing loop
- gameplay UI changes

**Expected Behavior After This Slice**

- The system can serve a dedicated planning-hub view.
- The planning hub can orient the player without requiring transcript reconstruction.
- Existing chat and sheet routes continue to work.

**Contracts and Boundaries**

- The planning hub is not a second transcript.
- The planning hub is not the sole source of planning truth; it is a specialized projection.
- The planning hub must remain game-scoped.

**Testable Hypotheses**

- Given an active game with chat and characters, the planning hub surfaces recent relevant planning state.
- Given no recent planning state, the planning hub still renders a useful explicit empty state.
- Given existing chat routes, the new planning hub does not replace or break them.

**Verification**

- Update API projection tests and web route/page tests.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm type-check`.

**Definition of Done**

- A dedicated planning-hub seam exists and is tested.
- Players no longer need transcript-only reconstruction to orient themselves.
- The architecture preserves distinct read concerns.

**Handoff Notes for Next Agent**

- Future slices may assume the lobby-style planning hub exists as a stable read concern distinct from chat and sheet views.

### Slice 3: Creator-To-Conversation Artifact Loop

**Purpose**

Implement one complete behavioral loop through the new seam: revise a draft, share it, and discuss it.

**Scope**

- Connect creator behavior to artifact creation.
- Connect artifact reads into conversation rendering.
- Add the lightweight preview read or summary needed for discussion.

**Out of Scope**

- prompt authoring
- digest routing
- unrelated chat feature work

**Expected Behavior After This Slice**

- A player can create a meaningful shared planning move from the creator.
- The game conversation can render and discuss that move.
- The lightweight preview exists without replacing the full sheet.

**Contracts and Boundaries**

- Creator remains the editing authority.
- Conversation remains the discussion authority.
- Preview reads remain summary-oriented and distinct from full-sheet reads.

**Testable Hypotheses**

- Given a draft revision, the player can share it into the game conversation.
- Given the resulting artifact, another player can preview and discuss it without requiring a full-sheet jump.
- Given a failure in sharing or preview loading, the loop degrades without data loss or semantic corruption.

**Verification**

- Update web feature and page tests for creator and chat.
- Update API and dispatcher tests where write or read behavior changes.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm type-check`.

**Definition of Done**

- One complete draft-share-discuss loop exists across web, API, and dispatcher layers.
- The loop is testable without relying on final future integration work.
- Existing full-sheet behavior remains intact.

**Handoff Notes for Next Agent**

- Future work may assume creator, artifact, and conversation are connected through a stable tested loop.

### Slice 4: Structured Planning Signals And Digest Derivation

**Purpose**

Add structured planning direction and durable re-entry without pushing those concerns into the engine or transcript.

**Scope**

- Add structured planning signals such as GM prompts or party-need state.
- Derive digest and inbox re-entry behavior from primary planning state.
- Keep these concerns separate from legality and character-authority logic.

**Out of Scope**

- real-time presence systems
- gameplay loop redesign
- generalized notification infrastructure

**Expected Behavior After This Slice**

- The system can expose party direction without relying on transcript-only inference.
- Returning users can re-enter the correct planning context from digest surfaces.
- Engine responsibility remains unchanged.

**Contracts and Boundaries**

- Planning signals remain social-planning data, not character rules.
- Digest remains derivative and must not become the only source of important planning state.
- Visibility remains game-scoped and membership-aware.

**Testable Hypotheses**

- Given an active planning signal, the player can see it without scanning the full transcript.
- Given a digest item tied to a shared artifact or prompt, re-entry lands in the correct game-scoped context.
- Given engine rule changes, social-planning ownership boundaries remain intact.

**Verification**

- Update service tests for derived planning reads and digest behavior.
- Update web tests for re-entry and context rendering.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm type-check`.

**Definition of Done**

- Structured planning direction exists outside raw transcript history.
- Digest re-entry is tied to primary planning state rather than ad hoc route jumps.
- The feature remains consistent with package ownership boundaries.

**Handoff Notes for Next Agent**

- Future optimization work may assume structured planning signals and digest derivation already exist as first-class service concerns.

### Slice 5: Route-Level Compatibility And End-To-End Coherence

**Purpose**

Finish the feature in a way that protects global coherence instead of relying on a final integration pass.

**Scope**

- Tighten compatibility between planning hub, creator, chat, sheet, and digest routes.
- Add route-level regression coverage for the full loop.
- Remove temporary assumptions only when equivalent tested seams are in place.

**Out of Scope**

- unrelated cleanup refactors
- new package topology
- non-pregame feature work

**Expected Behavior After This Slice**

- The pregame planning loop works across its primary surfaces on phone and remains coherent on larger breakpoints.
- Existing routes that remain public still behave predictably.
- Future agents inherit stable seams instead of half-integrated flows.

**Contracts and Boundaries**

- Compatibility layers may exist temporarily, but the user-visible loop must remain functional after each session-sized slice.
- No slice may require a later "big integration" session to restore repository coherence.
- Browser flow coverage becomes part of the feature's standing guardrail.

**Testable Hypotheses**

- Given a complete pregame scenario, the player can move from lobby to creator to chat to digest and back without dead ends.
- Given a phone viewport, the complete loop remains usable.
- Given unchanged approval or sheet flows, they remain compatible with the new planning architecture.

**Verification**

- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm type-check`.
- Run `pnpm test:browser`.

**Definition of Done**

- The main loop has route-level regression coverage.
- Compatibility expectations are tested, not assumed.
- The next agent can continue from stable seams without cleanup work.

**Handoff Notes for Next Agent**

- Future work may assume the pregame planning loop is an integrated cross-surface feature with verified architectural boundaries rather than an aspirational composition.
