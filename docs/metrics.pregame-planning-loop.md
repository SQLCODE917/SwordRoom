# Pregame Metrics and Tracing

## 1. Feature Summary

SwordWorld's pregame loop needs durable product metrics that survive UI iteration and do not depend on brittle frontend click logging. The feature is a backend-first observability seam for pregame planning activity, with minimal frontend-only instrumentation reserved for semantics the backend cannot infer on its own.

Today, the repo has useful flow logs in the web, API, and dispatcher, but those logs are not yet organized around stable product metrics. The desired end state is a semantic metric stream for pregame planning, backed primarily by durable service-side events, with a future-compatible path toward AWS RUM for session timing and AWS X-Ray style trace propagation across HTTP and async command handling.

## 2. Current State

- `packages/services/shared/src/flowLog.ts` emits structured service logs through `logServiceFlow`.
- `packages/web/src/logging/flowLog.ts` emits browser-side development flow logs through `logWebFlow`.
- Pregame planning semantics already exist as durable chat artifacts in `packages/shared/src/contracts/chat.ts`:
  - `CHARACTER_DRAFT`
  - `GAME_PROMPT`
  - `PARTY_ROLE_CLAIM`
  - `CHARACTER_DRAFT_REACTION`
- API reads already expose pregame planning and digest through:
  - `GET /games/{gameId}/pregame`
  - `GET /me/pregame`
- Dispatcher processing already gives one stable post-authorization boundary where command success is known:
  - the command envelope has been validated
  - the handler has produced effects
  - the write transaction has succeeded
- Current limitations that matter for metrics:
  - there is no stable semantic metric stream yet
  - creator time-in-flow and return sessions are not durably knowable from backend logs alone
  - shared-draft reactions are durable, but shared-draft replies are not yet durable because reply context is currently staged in the web composer rather than stored as a structured backend relationship
  - end-to-end trace correlation across browser, HTTP, queue, and dispatcher does not yet exist

## 3. Target State

When the feature is complete, pregame metrics should be captured as semantic product events rather than page-implementation details.

The finished shape should have:

- a stable pregame metric taxonomy with versioned names and low-cardinality dimensions
- backend durable emission for metrics that can be proven from persisted or post-commit behavior
- frontend/session instrumentation only for metrics that cannot be derived durably, especially creator active minutes and creator return sessions
- trace context that can later correlate:
  - browser session
  - HTTP request
  - command acceptance
  - queue handoff
  - dispatcher processing
  - downstream service activity
- log payloads that are straightforward to aggregate in CloudWatch Logs Insights now and compatible with EMF extraction and X-Ray linked analysis later

Compatibility expectations:

- existing product behavior must remain unchanged
- flow logs may gain new semantic entries, but existing routes and commands must keep working
- metric capture must not depend on React component names, DOM structure, or local button composition

## 4. Non-Goals

- Do not add a bespoke analytics network pipeline from the browser.
- Do not add heavyweight frontend telemetry SDK usage for metrics that are already visible in backend durable events.
- Do not redesign command, chat, or inbox contracts solely for observability in this first slice.
- Do not treat approximate UI heuristics as durable truth.
- Do not introduce high-cardinality CloudWatch metric dimensions such as `gameId`, `actorId`, `characterId`, `artifactId`, `commandId`, or `requestId`.
- Do not attempt full X-Ray propagation in the same slice as initial metric emission.

## 5. Guardrails

- `packages/services/shared` owns reusable service-side metric helpers and semantic log formatting.
- `packages/services/api` may emit pregame metrics for read behavior and request-context observations, but must stay thin and must not embed reporting logic in route handlers.
- `packages/services/dispatcher` owns durable post-command metric emission when a command has been successfully applied.
- `packages/web` must only own semantic session boundaries and entry-source hints that the backend cannot infer.
- Metric names and low-cardinality dimensions are public observability contracts for future reporting. Change them only with an explicit version bump or compatibility plan.
- High-cardinality identifiers belong in metric context fields or traces, not metric dimensions.
- Backend durable metrics must only be emitted after the system has crossed a trustworthy boundary:
  - post-read for read metrics
  - post-commit for write metrics
- Failure logs and product metrics are different concerns. A failing command may produce flow logs without producing a product metric.
- Future distributed tracing must not assume synchronous completion. Any trace design must tolerate request acceptance and async application happening in different processes and at different times.
- Verification for any slice in this feature must include:
  - typecheck for touched packages
  - tests for new metric derivation helpers
  - tests for any new API or dispatcher behavior that emits or relies on semantic metric events

## 6. Implementation Slices

### Slice 1: Durable Backend Pregame Metric Emission

**Purpose**

Create the first stable metric seam using existing durable behavior. This slice proves that pregame planning activity can be emitted as semantic product metrics without adding frontend payloads or network chatter.

**Scope**

- Add a service-shared pregame metric helper and taxonomy.
- Emit metric events from dispatcher after successful application of relevant pregame commands.
- Document the semantic meaning of each metric introduced in this slice.

**Out of Scope**

- Creator active-minute calculation.
- Creator return-session calculation.
- Durable reply-target metrics for shared draft follow-up messages.
- Digest presentation or re-entry metrics derived from polling read APIs.
- Full HTTP-to-queue-to-dispatch trace propagation.
- CloudWatch dashboard or AWS infrastructure rollout.

**Expected Behavior After This Slice**

- Service logs include semantic `PREGAME_METRIC` events for:
  - draft creation
  - draft save with a real persisted change
  - draft share publication
  - GM prompt publication
  - party role claim publication
  - shared draft reaction publication
- These events include low-cardinality dimensions and separate high-cardinality context fields.
- Existing product behavior is unchanged.

**Contracts and Boundaries**

- Metric payloads are versioned under a stable schema family.
- Dimensions remain low-cardinality and suitable for EMF extraction later.
- Context fields may include high-cardinality identifiers for log search and future trace joins.
- Dispatcher emits only after successful write application.
- Polling read APIs must not be treated as a proxy for user-visible entry or re-entry metrics.

**Testable Hypotheses**

- Given a processed `SendGameChatMessage` command with a `CHARACTER_DRAFT` artifact, dispatcher emits a semantic metric describing a shared draft publication.
- Given a processed `SendGameChatMessage` command with a `CHARACTER_DRAFT_REACTION` artifact, dispatcher emits a semantic metric tied to the targeted shared draft.
- Given a no-op `SaveCharacterDraft` command that produces no writes, dispatcher does not emit a misleading persisted-save metric.
**Verification**

- `pnpm --filter @starter/services-shared test`
- `pnpm --filter @starter/services-shared type-check`
- `pnpm --filter @starter/services-dispatcher test`
- `pnpm --filter @starter/services-dispatcher type-check`

**Definition of Done**

- The new metric helper is covered by tests.
- Dispatcher compiles and emits the new metric records through existing flow-log infrastructure.
- No UI behavior changes are required for the slice to work.
- The next slice can build reporting or session correlation on top of the new metric names without revisiting their meaning.

**Handoff Notes for Next Agent**

- You can rely on a stable backend semantic metric vocabulary for durable pregame events.
- You cannot yet rely on durable reply-target metrics, creator-session timing, or digest re-entry metrics.

### Slice 2: Creator Session Anchors and Re-entry Semantics

**Purpose**

Capture the two metrics the backend cannot infer alone: creator active minutes and creator return sessions. Keep the seam semantic and resilient to UI refactors.

**Scope**

- Add minimal creator-session and planning-entry semantics at route/workflow boundaries.
- Add explicit re-entry semantics so digest- or chat-originated creator sessions are counted without relying on polling read APIs.
- Plan for CloudWatch RUM or a similarly light browser session source without making it the source of truth for durable backend events.
- Preserve a stable session/entry vocabulary that can survive component rewrites.

**Out of Scope**

- DOM click analytics.
- Page-specific button instrumentation.
- Full distributed tracing.

**Expected Behavior After This Slice**

- Creator sessions can be counted and timed semantically.
- Creator entries can be classified by stable sources such as `lobby`, `chat`, `digest`, or `characters`.
- Creator-session semantics should piggyback on existing creator reads and commands through a stable shared request-context contract, rather than adding a new browser analytics request.

**Contracts and Boundaries**

- Entry source is a workflow-level semantic, not a component id.
- Session metrics must tolerate future route, layout, and component changes.
- Browser telemetry remains minimal and only covers semantics unavailable from durable backend logs.

**Testable Hypotheses**

- Given a player enters the creator from the digest, the session is classified as a digest-originated creator session even if the page layout changes.
- Given the player returns to the creator later before first play, the session count increases without duplicating save/share metrics.

**Verification**

- Typecheck for touched packages
- Tests for creator-session classification and entry-source propagation
- Browser regression for at least one digest-to-creator and chat-to-creator path

**Definition of Done**

- Creator-session and entry-source semantics exist independently of component composition.
- No extra network traffic is added beyond what the semantic session boundary truly requires.

**Handoff Notes for Next Agent**

- You can rely on stable creator-session semantics, but not yet on full async trace joins.

### Slice 3: Durable Reply and Prompt-Response Semantics

**Purpose**

Close the gap between UI-visible discussion and durable analytics by making shared-draft reply relationships explicit.

**Scope**

- Introduce a durable backend representation for replying to a shared draft or a GM prompt.
- Make prompt-response metrics derivable without text heuristics.

**Out of Scope**

- Rebuilding the whole chat model.
- Freeform conversation analytics beyond explicit pregame reply relationships.

**Expected Behavior After This Slice**

- Replies to shared drafts and GM prompts become durable structured events.
- Prompt response rate and replies-per-shared-artifact no longer depend on approximate frontend view-model logic.

**Contracts and Boundaries**

- Structured reply targets must reference stable message or prompt identities.
- Freeform message bodies remain freeform; the relationship metadata is the durable analytic seam.

**Testable Hypotheses**

- Given a player replies to a shared draft, the backend stores a durable target relationship.
- Given a player answers a GM prompt, the response can be joined to the originating prompt without parsing text.

**Verification**

- Shared contract tests
- API and dispatcher tests for structured reply behavior
- Browser regression for share -> reply -> workbench visibility

**Definition of Done**

- Reply and prompt-response reporting can be computed from durable backend events alone.

**Handoff Notes for Next Agent**

- You can now aggregate replies and prompt responses without relying on composer-prefill text.

### Slice 4: End-to-End Trace Propagation

**Purpose**

Prepare for plan-maximum tracing across browser, HTTP, queue, and dispatcher without forcing the first metric slices to wait on infrastructure work.

**Scope**

- Define request, command, queue, and dispatcher trace context handoff.
- Align the app-level trace shape with AWS-friendly propagation patterns such as `X-Amzn-Trace-Id` and `AWSTraceHeader`.
- Preserve user/session correlation boundaries without leaking high-cardinality values into metric dimensions.

**Out of Scope**

- Replacing existing flow logs.
- Building dashboards as part of the propagation seam.

**Expected Behavior After This Slice**

- A single planning action can be followed across browser session, API request, queue message, dispatcher processing, and downstream service logs.

**Contracts and Boundaries**

- Trace context must survive async handoff.
- Request ids, command ids, and future trace ids are correlation fields, not product metrics.
- The trace seam must coexist with existing durable metric events rather than replace them.

**Testable Hypotheses**

- Given a traced creator share action, the resulting API and dispatcher logs can be joined through propagated trace context.
- Given async processing delay, the trace remains valid without assuming synchronous completion.

**Verification**

- Typecheck for touched packages
- Tests for trace-context formatting and propagation helpers
- Local end-to-end proof that one pregame action produces correlated API and dispatcher traces

**Definition of Done**

- Future agents can wire AWS X-Ray or equivalent tracing onto an already stable application-level trace seam.

**Handoff Notes for Next Agent**

- You can treat the product metric stream and the trace stream as complementary systems: one answers product questions, the other explains execution paths.
