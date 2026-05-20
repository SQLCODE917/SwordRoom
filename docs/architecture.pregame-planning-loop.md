# Pregame Planning Loop Architecture

## Purpose

SwordWorld is intended to work for busy people who cannot rely on everyone being present at the same time. The pregame experience therefore needs to behave more like correspondence play than live co-editing.

Character creation and pregame chat are not separate product areas. They form one system whose purpose is to help a party converge on a session plan through repeated asynchronous moves.

This document defines the stable architectural constraints for that system so future sessions can extend it without breaking coherence.

## System Intent

The pregame planning loop exists to create a durable social cycle:

1. private or semi-private character work
2. game-scoped sharing into a party conversation
3. party and GM feedback
4. revision or commitment
5. return later

The product succeeds when character creation produces discussion and discussion drives character iteration.

## Architectural Stance

- Keep the existing command-driven, read-model-oriented architecture.
- Treat pregame planning as asynchronous by default.
- Preserve a strict separation between rules authority and social coordination.
- Keep game context as the primary organizing container for shared planning activity.
- Design phone-first interaction as a product constraint, not a styling preference.

## Bounded Capabilities

The pregame loop is composed of five capabilities:

### 1. Private drafting workspace

- Owns incomplete and exploratory character work.
- Optimizes for iteration without social pressure.
- May exist outside an active game context.

### 2. Game-scoped planning hub

- Owns the shared view of party needs, pending prompts, and recent planning activity.
- Exists to answer "what should happen next?" for the current game.

### 3. Shared character artifacts

- Own durable, discussable representations of a character draft or revision.
- Bridge the creator and the conversation.

### 4. Pregame conversation

- Owns discussion, reactions, prompt responses, and social coordination.
- Is the source of truth for conversation, not for character legality or current draft state.

### 5. Digest and notification surfaces

- Own re-entry for absent users.
- Remain derivative of the primary planning state.

## Core Invariants

### Async-first

- The system must remain useful when participants check in at different times.
- Live presence may improve the experience, but it must not be required for the core loop.

### Game-scoped sharing

- Shared planning artifacts belong to a game context.
- Private library work may exist outside a game, but once a draft is shared into planning it becomes game-scoped.

### Durable artifact semantics

- Shared character artifacts must refer to an explicit draft revision or immutable snapshot.
- A later edit must not silently rewrite the meaning of earlier conversation.
- Chat can reference a "latest" draft only when that ambiguity is explicit to the user.

### Authority separation

- Character legality, derived stats, and rules calculations remain separate from chat, prompts, reactions, and notification policy.
- Social features may summarize engine-derived character information, but they do not become a new rules authority.

### Read-model specialization

- The planning hub, conversation view, and full character sheet serve different user questions and should remain distinct read concerns.
- Social surfaces should prefer lightweight summaries over exhaustive sheet payloads.

### Digest derivation

- Inbox and digest surfaces are re-entry aids.
- They must be reproducible from primary planning and conversation state.
- They must not become the only place where important planning information exists.

### Phone-first baseline

- Primary pregame tasks must work in a single-column interaction model.
- Larger breakpoints may reveal more simultaneous context, but they must not create a separate desktop-only workflow.

### Party-direction visibility

- GM prompts, role gaps, and recent character changes are first-class planning signals.
- They should not depend on users manually reconstructing context from raw transcript history.

### Measure the loop, not isolated screens

- Success evaluation must distinguish:
  - private drafting
  - shared drafting
  - social response to shared drafting
- Local improvements that increase time in one surface while weakening the draft-share-discuss-revise loop are regressions.

## Ownership And Directionality

### `packages/shared`

- Owns stable cross-package contracts and validation for planning concepts that need to cross boundaries.
- Should only absorb concepts that are stable enough to matter to multiple packages.

### `packages/engine`

- Owns character rules, legality, and deterministic projections derived from character state.
- Must remain unaware of chat, lobby organization, reactions, prompt management, and digest policy.

### `packages/services/api`

- Owns command intake, authorization, and read APIs for shared planning surfaces.
- Owns projection-oriented reads for planning views that combine multiple service-side concerns.

### `packages/services/dispatcher`

- Owns asynchronous application of planning commands and any durable side effects that result from them.
- Owns persistence-facing workflow consequences such as derived planning activity and digest generation.

### `packages/services/shared`

- Owns repositories, persistence helpers, and infrastructure-facing utilities that support the services layer.

### `packages/web`

- Owns navigation, screen composition, view models, and the browser-side orchestration of the planning loop.
- Must compose planning surfaces from stable read concerns rather than importing service implementation detail.

### Directionality rules

- Web may consume planning read models and engine-derived summaries through public contracts.
- Services may orchestrate engine calls and persistence to support planning behavior.
- Engine must not depend on social planning concepts.
- Shared contracts must not encode browser-only layout choices or service-only storage detail.

## Shared Artifact Model

The architecture distinguishes between:

- editable character state
- shared character artifacts derived from that state
- conversation that references those artifacts

These are related but not interchangeable.

This distinction exists to preserve conversational stability, enable discussion of alternatives, and prevent mutable draft state from erasing historical context.

## Planning Hub Model

The planning hub is not a second chat transcript. Its job is to surface:

- party needs
- active GM prompts
- recent shared character activity
- pending decisions that can unblock the next session

This surface exists to compress context for users who are returning after time away.

## Command And Projection Strategy

- Continue to model pregame writes as explicit intents rather than implicit document overwrites.
- Keep projections focused on the user question they answer.
- Avoid designing social planning around one oversized aggregate that attempts to serve chat, lobby, sheet, and inbox equally.

The system should favor narrow projections such as:

- planning hub view
- conversation view
- shared character preview
- full character sheet
- digest summary

## Access And Visibility

- Shared planning surfaces are visible to the game's participants and GM according to membership and role.
- Private character work remains private until deliberately shared or otherwise promoted into a game-scoped context.
- GM-specific authority should remain explicit and limited to the concerns that actually require it.

## Coordination Rules For Multi-Stream Work

- Web work may iterate on layout, navigation, and view models as long as the capability boundaries and artifact semantics remain intact.
- API and dispatcher work may evolve projections and command handling without pushing social logic into the engine.
- Engine work may deepen character rules without taking on responsibility for social planning or notification concerns.
- Shared-contract work should be conservative and should only formalize concepts that must remain stable across package boundaries.

These rules exist so that different implementation streams can move in parallel without collapsing the architecture into one package or one oversized model.

## Non-Goals

- Real-time collaborative editing
- Engine-owned chat behavior
- Presence-driven planning assumptions
- A social graph that spans unrelated games
- Visual-character-creator complexity as the main retention strategy

## Why The System Exists In This Shape

The system is shaped around asynchronous planning because that is the product thesis. Busy groups need durable moves, not synchronous coordination as a prerequisite.

The architecture separates rules, social artifacts, conversation, and digest surfaces because each answers a different question and changes at a different rate. Keeping those concerns distinct prevents local optimization from damaging the whole loop.

If future work improves creator depth, chat richness, or planning visibility while preserving these boundaries, it is aligned. If it makes one surface stronger by weakening revision semantics, game scoping, or async usability, it is architectural drift.
