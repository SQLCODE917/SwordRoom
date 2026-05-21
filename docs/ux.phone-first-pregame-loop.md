# Pregame Planning Loop UX Design

## 1. Feature Summary

SwordWorld needs a pregame experience that works for busy groups who check in at different times from their phones. The desired user-visible behavior is a phone-first planning loop where players move fluidly between character creation, party discussion, and GM guidance without needing a live session to make progress.

The current problem is not that character creation or chat is missing. The problem is that they are separate destinations. The product becomes more compelling when character work produces social artifacts, chat produces new character decisions, and both surfaces keep the next useful move obvious.

The desired end state is a game-scoped planning experience with a default `Lobby`, a focused `Create` flow, a character-aware `Chat` surface, and lightweight sharing and preview flows that make pregame character discussion habitual.

## 2. Current State

### Relevant existing behavior

- `packages/web/src/pages/CharacterWizardPage.tsx` provides the current character creation flow.
- `packages/web/src/features/character-wizard/` already contains feature-owned command builders, workflow logic, state tests, view-model tests, and component tests.
- `packages/web/src/pages/GameChatPage.tsx` and `packages/web/src/components/GameChatPanel.tsx` provide the current game chat surface.
- `packages/web/src/pages/CharacterSheetPage.tsx` provides the authoritative read-only sheet view.
- `packages/web/src/pages/PlayerInboxPage.tsx` and `packages/web/src/pages/GMInboxPage.tsx` provide inbox surfaces for async follow-up and approval work.
- `packages/web/src/App.tsx` already exposes authenticated routes for character creation, chat, sheet viewing, and inboxes.

### Relevant existing system seams

- The web app already submits commands through the shared command workflow and polls async status rather than assuming immediate writes.
- Character drafting already uses `SaveCharacterDraft` and `SubmitCharacterForApproval`.
- Chat already uses `SendGameChatMessage`.
- Read APIs already expose game chat, character sheets, owned character sheets, player inbox, and GM inbox.
- Chat reads are currently served through the service read layer and chat writes already pass through API authorization and dispatcher handling.

### Existing patterns that should be preserved

- `docs/architecture.md`: explicit ownership boundaries and model transitions.
- `docs/feature-structure.md`: feature folders, selectors, state machines, and route/page separation.
- `docs/ui.md`: phone/tablet/desktop intent, semantic HTML, minimal DOM, and theme discipline.
- `packages/web/AGENTS.md`: one connected boundary per feature container, explicit view-model states, and command submission through the shared workflow.

### Existing tests that matter

- `packages/web/src/pages/GameChatPage.test.tsx`
- `packages/web/src/pages/CharacterSheetPage.test.tsx`
- `packages/web/src/features/character-wizard/commands.test.ts`
- `packages/web/src/features/character-wizard/useCharacterWizardWorkflow.test.ts`
- `packages/web/src/features/character-wizard/viewModel.test.ts`
- `packages/web/src/features/character-wizard/components/CharacterWizardPanels.test.tsx`
- `packages/services/api/src/index.test.ts`
- `packages/services/dispatcher/src/handlers/game/sendGameChatMessage.test.ts`
- `packages/services/dispatcher/src/handlers/character/characterRules.test.ts`

### Known current limitations

- There is no game-scoped planning hub between home, creator, and chat.
- Chat is still transcript-first rather than character-artifact-first.
- The creator does not treat sharing as a first-class action at each meaningful checkpoint.
- The full character sheet is authoritative, but it is too heavy for most quick pregame conversation.
- Inbox surfaces support async status follow-up, but they do not yet act as planning re-entry surfaces.
- The current experience supports async activity, but it does not yet make the draft-share-discuss-revise loop obvious.
- Pregame success metrics exist as product goals, but not yet as durable semantic telemetry.

## 3. Target State

### Final behavior

When the feature is complete, a player with only a phone can:

1. open a game-scoped lobby and immediately see what the party still needs
2. jump into a focused creator checkpoint
3. share a draft snapshot or revision into the game conversation
4. preview another player's shared character without losing context
5. return later through inbox or digest and continue where the social loop left off

The final UX keeps character planning social without turning the product into live co-editing. It should feel like correspondence play: short meaningful moves, durable context, and clear next actions.

### Final user flow

1. Player enters the game and lands on `Lobby`.
2. Lobby shows session timing, GM prompt, party roster, party needs, and recent character-centered activity.
3. Player opens `Create`, changes a draft, and sees party context inline.
4. Player uses `Share Update` from the creator.
5. Shared update appears in `Chat` as a structured character artifact, not only plain text.
6. Another player or the GM opens the artifact preview, replies, reacts, or compares directions.
7. Inbox or digest later routes the player back to the relevant lobby, chat artifact, or creator checkpoint.

### Final screen model

- `Lobby`: game-scoped planning hub and default home.
- `Create`: focused checkpoint flow for drafting and revising a character.
- `Chat`: full conversation view with structured planning artifacts.
- `Characters`: personal and party-facing workbench for drafts, shared concepts, and approved characters.
- `Inbox / Digest`: re-entry aid derived from the primary planning loop.

### Compatibility expectations

- Existing character sheet routes remain the authoritative detailed read surface.
- Existing async command behavior remains the write model.
- Existing inbox and approval flows remain valid during incremental rollout.
- Tablet and desktop may show more simultaneous context, but the phone workflow remains the baseline and must stay complete.

### Success measures

The pregame loop should be evaluated with metrics that describe planning behavior semantically rather than mirroring a specific page layout.

- `Creator active minutes per invited player` means time spent in game-scoped draft work before first play.
- `Creator return sessions before first play` means distinct resumed drafting sessions after a player leaves and later re-enters the loop.
- `Share rate before first session` means the percentage of invited players who publish at least one shared character artifact before the group's first live session.
- `Replies and reactions per shared artifact` means social follow-up attached to a concrete shared draft revision.
- `Chat-to-creator return rate` means the percentage of planning conversations that send a player back into draft editing or checkpoint sharing.
- `GM prompt response rate` means the percentage of structured GM prompts that receive a relevant planning response during the pregame window.

### Metric capture intent

- Shared draft publication, replies, reactions, GM prompts, role claims, invite acceptance, and digest re-entry should be counted from backend durable events because they already cross stable system boundaries.
- Creator session metrics should be derived from semantic route-entry, draft-save, share, submit, and route-exit style events rather than from specific component-level interactions.
- Frontend telemetry should be limited to the minimum needed to understand time-in-flow and session boundaries. It must survive heavy UX iteration without requiring the metric model to be rewritten.
- Future distributed tracing should treat browser session, HTTP request chain, command intake, queue handoff, and async command application as one correlated planning trace so later FE redesigns do not break observability.

### Phone shell

- Top app bar:
  - game name
  - countdown to next session
  - unread indicator
  - inbox / digest entry
- Bottom navigation:
  - `Lobby`
  - `Create`
  - `Chat`
  - `Characters`

### Phone wireframes

#### Lobby

```text
+--------------------------------------------------+
| Goblin Cave                          3d 14h   () |
| Session 1 this Friday                           |
+--------------------------------------------------+
| Lobby | Create | Chat | Characters              |
+--------------------------------------------------+
| GM prompt                                        |
| "We still need frontline and field healing."     |
| [Answer in Creator] [Reply in Chat]              |
+--------------------------------------------------+
| Party roster                                     |
| [Aline: Rune Sage] [Borin: Empty] [GM: Zed]      |
+--------------------------------------------------+
| Party needs                                      |
| Frontline 0/1  Healer 0/1  Scout 1/1             |
| [Claim a need]                                   |
+--------------------------------------------------+
| Recent activity                                  |
| Alice shared Rune Sage v3                        |
| "Can I stay backline support?"                   |
| [Open] [Reply] [React]                           |
|                                                  |
| GM started vote: "Urban or frontier campaign?"   |
| [Vote]                                           |
+--------------------------------------------------+
| [Quick share my current draft]                   |
+--------------------------------------------------+
```

#### Creator

```text
+--------------------------------------------------+
| Create: Rune Sage                    Step 3 of 7 |
| Party need: Healer still open                    |
+--------------------------------------------------+
| Concept                                           |
| Backline support caster with rune knowledge      |
+--------------------------------------------------+
| Background                                        |
| Result: Sage 1                                   |
| [Roll 2D] [Choose result]                        |
|                                                  |
| Why this matters                                 |
| Covers lore, research, and old writing           |
+--------------------------------------------------+
| Current summary                                  |
| INT 17   MP 18   EXP 500 / 2500 spent            |
+--------------------------------------------------+
| Party context                                    |
| GM asked for field healing                       |
| Alice said: "I can cover scouting."              |
| [Open full thread]                               |
+--------------------------------------------------+
| [Save Draft] [Share Update] [Next]               |
+--------------------------------------------------+
```

#### Share Update Sheet

```text
+--------------------------------------------------+
| Share update                                     |
+--------------------------------------------------+
| Share type                                       |
| (o) Draft snapshot                               |
| ( ) Ask a question                               |
| ( ) Compare two directions                       |
| ( ) Answer GM prompt                             |
+--------------------------------------------------+
| Preview                                          |
| Rune Sage v3                                     |
| INT 17 / MP 18 / Sage 1 / Sorcerer 2             |
| "Trying support caster. Too fragile?"            |
+--------------------------------------------------+
| Quick prompts                                    |
| [Need party feedback] [Need GM ruling]           |
| [Claiming healer role] [Open to changing build]  |
+--------------------------------------------------+
| [Post to Chat]                                   |
+--------------------------------------------------+
```

#### Chat

```text
+--------------------------------------------------+
| Chat: Goblin Cave                                |
+--------------------------------------------------+
| [All] [Characters] [GM] [Votes]                 |
+--------------------------------------------------+
| Alice shared Rune Sage v3                        |
| INT 17 / MP 18 / Sage 1 / Sorcerer 2             |
| "Thinking support caster. Too fragile?"          |
| [Open] [Reply] [React]                           |
|                                                  |
| GM prompt                                        |
| "We still need a frontline before Friday."       |
| [Answer in Creator]                              |
|                                                  |
| Borin replied                                    |
| "I can switch from scout to tank."               |
| [Open Borin draft]                               |
+--------------------------------------------------+
| [+] Attach card...  Message...           [Send]  |
+--------------------------------------------------+
```

#### Character Preview From Chat

```text
+--------------------------------------------------+
| Rune Sage v3                                     |
+--------------------------------------------------+
| Role fit                                         |
| Backline support / possible healer               |
+--------------------------------------------------+
| Snapshot                                         |
| INT 17  MP 18  Sage 1  Sorcerer 2                |
| Backpack: starter gear                           |
+--------------------------------------------------+
| Feedback so far                                  |
| GM: "Looks good if someone else fronts."         |
| Borin: "I'll take frontline."                    |
+--------------------------------------------------+
| [Open full sheet] [Reply] [Compare]              |
+--------------------------------------------------+
```

#### Characters

```text
+--------------------------------------------------+
| Characters                                       |
+--------------------------------------------------+
| [Mine] [Shared] [Approved]                      |
+--------------------------------------------------+
| Mine                                             |
| Rune Sage v3                     Shared 3 replies|
| Frontliner draft                 Not shared      |
| Old healer concept               Archived        |
+--------------------------------------------------+
| [Start new character]                            |
+--------------------------------------------------+
```

### Responsive behavior

#### Tablet

- Lobby becomes two columns:
  - planning feed
  - roster and party needs
- Creator keeps a persistent summary column.
- Chat keeps transcript and preview visible together when space allows.

#### Desktop

- Lobby uses three zones:
  - direction and party state
  - recent planning activity
  - selected detail preview
- Creator may show step outline, active panel, and summary together.
- Chat may keep transcript and selected character preview visible together.

The larger layouts reveal more context, but they must not introduce a separate desktop-only workflow or hide required actions from phone users.

### Product metrics

The intended success metrics are:

- creator active minutes per invited player
- creator return sessions before first play
- share rate before first session
- replies and reactions per shared character artifact
- chat-to-creator return rate
- GM prompt response rate

Time-in-page alone is not a success metric unless it accompanies sharing, revision, and discussion.

## 4. Non-Goals

- Do not turn the pregame loop into a live collaboration or presence-dependent feature.
- Do not replace the full character sheet as the authoritative detailed read surface.
- Do not redesign gameplay, combat, or in-session play UI as part of this feature.
- Do not make avatar visual customization the main retention strategy.
- Do not create a social graph or discovery surface across unrelated games.
- Do not require a desktop-only workflow for party planning.

## 5. Guardrails

- `Lobby` is the default home for an upcoming game. The raw transcript is not the default planning home.
- `Create` and `Chat` remain distinct surfaces with distinct questions, even when tightly integrated.
- Character sharing must be a first-class creator action available from meaningful checkpoints.
- Shared character updates must open into a lightweight preview before requiring a full-sheet navigation.
- Inbox and digest surfaces remain derivative re-entry aids rather than parallel planning systems.
- Party needs, GM prompts, and recent character changes must remain visible somewhere more structured than the raw transcript.
- Phone remains the baseline information hierarchy and required workflow.
- Error states must be recoverable. A failed share must not discard draft edits or in-progress message text.
- New planning surfaces must use explicit loading, ready, empty, and error states rather than deriving state from loosely related props.
- UI changes must remain compatible with `docs/ui.md`: semantic HTML, minimal DOM, theme-token usage, and responsive intent for phone, tablet, and desktop.
- Web changes must remain compatible with `packages/web/AGENTS.md`: thin connected boundaries, view-model-driven rendering, and command submission through the shared command workflow.
- New behavior must be covered by component or feature tests, and route-level flow changes must add or update browser coverage.

## 6. Implementation Slices

### Slice 1: Game Lobby And Pregame Navigation

**Purpose**

Create the phone-first entry point for the pregame loop so the user has a clear game-scoped home instead of bouncing between unrelated pages.

**Scope**

- Add the `Lobby` surface and bottom-navigation shell for pregame planning.
- Compose the initial lobby from existing or narrowly expanded read seams.
- Establish the view-model states for loading, ready, empty, and error.

**Out of Scope**

- Structured character share artifacts
- reactions or comparisons
- prompt authoring workflows

**Expected Behavior After This Slice**

- A player can enter a game and land on a lobby instead of starting from a transcript-first view.
- The lobby shows session context, party roster, and recent activity or explicit placeholders.
- The user can move directly to creator, chat, and character-library surfaces from the same shell.

**Contracts and Boundaries**

- The lobby is game-scoped, not global.
- The lobby is a distinct read concern from chat and from the full character sheet.
- The lobby must render from an explicit view model and must not infer readiness from partial data.

**Testable Hypotheses**

- Given a game with existing chat and characters, the lobby renders a useful ready state instead of an empty frame.
- Given missing or loading data, the lobby renders explicit fallback states without hiding navigation.
- Given a phone viewport, the primary navigation remains reachable without horizontal scrolling.

**Verification**

- Update or add route- and page-level tests in `packages/web`.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/web type-check`.
- Run `pnpm type-check` if shared contracts or route composition change.

**Definition of Done**

- The lobby exists as a stable route-level surface.
- The player can move from lobby to creator and chat without detouring through unrelated screens.
- Ready, empty, loading, and error states are all explicit and tested.

**Handoff Notes for Next Agent**

- Future slices may assume a stable game-scoped planning home exists and that it is distinct from the chat transcript.

### Slice 2: Share Draft From Creator Into Chat

**Purpose**

Turn character creation into a social action by allowing a draft checkpoint or revision to be posted into the game conversation as a structured artifact.

**Scope**

- Add a share flow from the creator.
- Persist or project shared character updates as game-scoped artifacts rather than plain transcript-only text.
- Render the shared result inside chat.

**Out of Scope**

- reactions
- comparisons between multiple builds
- GM prompt workflows beyond posting a shared update

**Expected Behavior After This Slice**

- A player can share a meaningful character update from the creator without leaving the loop.
- The resulting chat item preserves enough character context to discuss the build.
- A failed share leaves the local draft intact.

**Contracts and Boundaries**

- A shared character update must refer to a specific draft snapshot or revision, not an implicit mutable latest state.
- Shared updates are game-scoped.
- The creator remains the editing authority; chat only references and discusses the shared result.

**Testable Hypotheses**

- Given a saved draft, the player can share it into chat and see a structured planning artifact.
- Given later edits to that draft, the earlier shared artifact still means the same thing.
- Given a failed share command, the player retains current draft state and can retry.

**Verification**

- Update relevant web feature tests in `packages/web/src/features/character-wizard/` and `packages/web/src/pages/GameChatPage.test.tsx`.
- Update command and authorization coverage in `packages/services/api`.
- Update dispatcher coverage near chat and character handlers.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm type-check`.

**Definition of Done**

- Creator and chat are connected through a stable share flow.
- Shared artifacts preserve meaning across later character edits.
- The loop remains async and recoverable under failure.

**Handoff Notes for Next Agent**

- Future chat improvements may assume that a shared character update is a first-class artifact with stable identity and game scope.

### Slice 3: Chat-Native Character Preview And Reply Loop

**Purpose**

Make shared character updates easy to discuss on phone by introducing a lightweight preview before full-sheet navigation.

**Scope**

- Add character-artifact preview behavior in chat.
- Add direct reply and follow-up actions from the preview surface.
- Preserve the existing sheet route as the detailed read surface.

**Out of Scope**

- replacing the authoritative character sheet
- broad chat redesign unrelated to character artifacts
- desktop-only interaction models

**Expected Behavior After This Slice**

- Tapping a shared character update opens a lightweight preview on phone.
- Users can reply or jump to the full sheet from that preview.
- Character-centered chat becomes easier without burying the player in sheet detail.

**Contracts and Boundaries**

- Preview data is summary data, not the exhaustive sheet.
- The full sheet remains the authoritative detailed read view.
- Preview interactions must work in a one-column phone layout first.

**Testable Hypotheses**

- Given a shared character update, the user can open a preview without leaving chat.
- Given a need for more detail, the user can still navigate to the full sheet.
- Given missing or stale preview data, the chat surface degrades gracefully instead of breaking the transcript.

**Verification**

- Update `packages/web/src/pages/GameChatPage.test.tsx`.
- Add or update component tests for preview rendering and actions.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/web type-check`.
- Run `pnpm test:browser` if the route-level interaction changes are substantial.

**Definition of Done**

- Shared character artifacts are discussion-friendly on phone.
- Users no longer need the full sheet for every pregame comment.
- Existing chat behavior continues to work for plain text messages.

**Handoff Notes for Next Agent**

- Future work may rely on the presence of a lightweight summary read for shared character artifacts.

### Slice 4: Party Needs, GM Prompts, And Structured Planning Signals

**Purpose**

Give the loop explicit planning direction so players do not have to reconstruct party needs from raw transcript history.

**Scope**

- Surface party needs and GM prompts in the lobby.
- Surface relevant planning context inside the creator and chat.
- Support low-friction player responses such as answering a prompt or claiming a need.

**Out of Scope**

- calendar or scheduling redesign
- gameplay procedure design
- changes to character legality rules

**Expected Behavior After This Slice**

- A player can see what the party still needs without reading the full transcript.
- The creator reflects relevant party context while a draft is being edited.
- Planning signals reinforce the draft-share-discuss-revise loop instead of competing with it.

**Contracts and Boundaries**

- Planning signals are game-scoped.
- Planning signals guide conversation and drafting, but they do not become rules authority.
- The lobby remains a distinct planning read concern rather than a second transcript.

**Testable Hypotheses**

- Given an active GM prompt, the player can see it from lobby and creator.
- Given an unfilled party role, the player can identify it without scanning the entire chat history.
- Given a prompt response or role claim, the planning system reflects that activity without mutating the underlying character rules.

**Verification**

- Update web tests for lobby, creator context, and chat context.
- Update service tests for any new planning projections or commands.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/services-api test`.
- Run `pnpm --filter @starter/services-dispatcher test`.
- Run `pnpm type-check`.

**Definition of Done**

- Party direction is visible in structured surfaces rather than only in transcript text.
- Players can act on prompts and party needs in a few taps.
- The planning loop becomes easier to resume after time away.

**Handoff Notes for Next Agent**

- Future digest work may assume planning signals exist as first-class game-scoped context rather than as transcript-only inference.

### Slice 5: Digest Re-Entry And Larger-Breakpoint Coherence

**Purpose**

Finish the async loop by making re-entry useful and by ensuring tablet and desktop reveal more context without creating a different workflow.

**Scope**

- Route inbox and digest items back into lobby, chat artifacts, or creator checkpoints.
- Add tablet and desktop layout refinement for lobby, creator, and chat.
- Preserve the phone workflow as the canonical baseline.

**Out of Scope**

- broad notification system redesign
- unrelated desktop-only features
- new game-discovery or cross-game social surfaces

**Expected Behavior After This Slice**

- A returning player can re-enter the correct part of the planning loop from digest state.
- Tablet and desktop users can see more context simultaneously.
- The product still works completely on phone.

**Contracts and Boundaries**

- Digest remains derivative of primary planning state.
- Larger breakpoints reveal more simultaneous context but do not introduce required new steps.
- Existing route semantics for sheet, chat, and inbox remain stable unless explicitly replaced with compatibility coverage.

**Testable Hypotheses**

- Given a digest item about a shared character, the user lands in the correct planning context.
- Given a desktop viewport, the user sees more context but does not need a different mental model.
- Given a phone viewport, the same end-to-end behavior still works in one column.

**Verification**

- Update relevant inbox and route tests in `packages/web`.
- Run `pnpm --filter @starter/web test`.
- Run `pnpm --filter @starter/web type-check`.
- Run `pnpm test:browser`.

**Definition of Done**

- Async re-entry is purposeful instead of generic.
- Breakpoint changes improve context density without fragmenting the workflow.
- The feature has route-level regression coverage for the key loop.

**Handoff Notes for Next Agent**

- Future optimization work may assume the core loop exists across lobby, creator, chat, and digest with phone as the baseline workflow.
