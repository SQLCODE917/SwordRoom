# Pregame UX Flow Design

## 1. Feature Summary

This document is the source of truth for the meaningful UX states of the pregame release. Its purpose is to guide redesign work so the app gets users into the pregame loop with less friction and expresses that loop clearly once they are there.

The central product behavior is the `draft -> share -> discuss -> revise` loop. The frontend should make that loop feel like the default way to prepare for a game, especially on phones. This document defines the intended user-visible states, stable screen regions, design intent, and candidate labels. It does not prescribe implementation details, pseudocode, or private component structure.

The design must use the current architecture wherever it is good enough. New backend semantics are out of scope for this release unless they are separately designed and justified by clear cost-benefit.

## 2. Current State

### Relevant current surfaces

- Home at `/`
- Pregame Lobby at `/games/:gameId`
- Character Wizard create at `/games/:gameId/character/new`
- Character Wizard edit at `/games/:gameId/characters/:characterId/edit`
- Game Chat at `/games/:gameId/chat`
- Characters Workbench at `/games/:gameId/characters`
- Character Sheet at `/games/:gameId/characters/:characterId`
- Player Inbox at `/me/inbox`
- GM Games at `/gm/games`
- GM Inbox at `/gm/:gameId/inbox`

### Relevant current behaviors

- Pregame Lobby already shows planning status, party needs, GM prompt, roster, and recent activity.
- Character Wizard already supports game-scoped drafting, revision, checkpoint sharing, and GM prompt awareness.
- Game Chat already supports shared character artifacts, preview, reply staging, and reactions.
- Characters Workbench already supports `Mine`, `Shared`, and `Approved`, plus shared-draft preview and discussion handoff.
- Player Inbox already exposes a pregame digest for re-entry.

### Existing strengths to preserve

- The app is already game-scoped where pregame matters.
- The write model is already asynchronous and durable.
- The current pregame nav model is understandable: `Lobby`, `Create`, `Chat`, `Characters`, `Inbox`.
- The UI guidance already favors ISA-101-inspired stability, low noise, and overview-before-detail.

### Current UX problems

- The steps that lead users into the pregame loop still feel janky and distributed.
- Home, Inbox, Lobby, Create, Chat, and Characters still feel like adjacent tools more than one continuous mode.
- Character creation still reads too much like a completion wizard and not enough like an iterative planning workspace.
- Chat still reads too much like a generic transcript and not enough like a discussion around draft artifacts.
- Characters Workbench is useful, but its role in the loop is not yet obvious enough.

### Architectural constraint that matters

- The release should not invent new backend semantics just to support a more imaginative UX framing.
- In particular, candidate UX states such as richer compare behavior, deeper threaded discussion, or stronger revision anchors must be expressed through the existing architecture unless separately designed.

## 3. Target State

### North star

The pregame release should feel like correspondence play for a tabletop campaign:

1. a user resumes the most relevant game
2. sees what the game needs
3. drafts or revises a character direction
4. shares a meaningful checkpoint
5. discusses that checkpoint with the GM and other players
6. returns to revision with a clear reason
7. converges toward an approved party

### Source-of-truth UX state vocabulary

These are the meaningful UX states for this release. Future frontend work should map screens and transitions to these states rather than inventing page-local flow names.

- `resume`
  The user is re-entering an active pregame loop and needs a clear next move.

- `orient`
  The user is looking at the game as a party-planning system and deciding what to do next.

- `draft`
  The user is shaping a new or existing character direction.

- `share_ready`
  The user has enough draft shape to publish a meaningful checkpoint.

- `discuss`
  The group is responding to a shared draft, prompt, or planning question.

- `review`
  The user is scanning, comparing, or inspecting shared directions and party fit.

- `revise`
  The user is changing a draft in response to a visible reason.

- `approve`
  The draft is leaving exploratory planning and entering final review.

### UX state relationships

- `resume -> orient`
- `orient -> draft`
- `draft -> share_ready`
- `share_ready -> discuss`
- `discuss -> revise`
- `discuss -> review`
- `review -> discuss`
- `review -> revise`
- `revise -> share_ready`
- `discuss -> approve`
- `revise -> approve`

This is the authoritative UX loop model for the release. It is intentionally simpler than a backend state machine.

### Surface roles inside the loop

- Home and Inbox help users enter or resume the loop.
- Lobby is the main `orient` surface.
- Create is the main `draft`, `share_ready`, and `revise` surface.
- Chat is the main `discuss` surface.
- Characters Workbench is the main `review` surface.
- GM Inbox is the main `approve` surface for the GM, but it is not the center of pregame planning.
- Character Sheet is drill-down detail, not a primary loop surface.

### Candidate user-facing labels

The current route and architecture model should remain stable. Label changes are allowed as a UX decision, but they are candidates, not source-of-truth contracts.

Stable concepts:

- `Lobby`
- `Create`
- `Chat`
- `Characters`
- `Inbox`

Candidate labels for redesign exploration:

- `Chat` may become `Discuss`
- `Characters` may become `Review`

These candidate labels should be evaluated on clarity and cost. They are not requirements of this document.

### Phone-first shell

The pregame shell should work as one continuous mode on phone.

Required stable regions:

- header
- compact loop-status region
- one dominant next action
- main work region
- stable async status region
- bottom navigation

These regions should stay mounted and stable across pregame surfaces.

### Global shell contract

```yaml
screen_shell:
  applies_to:
    - Lobby
    - Create
    - Chat
    - Characters
  stable_regions:
    header:
      contents:
        - game_name
        - session_context_or_countdown
        - gm_role_indicator_when_relevant
    loop_status:
      contents:
        - active_need
        - active_prompt_or_revision_reason
        - latest_relevant_activity
    primary_action:
      max_count: 1
      rule: must advance the current loop state
    main_region:
      rule: screen-specific work area
    async_status:
      rule: fixed small region for saving, sharing, sent, and error states
    bottom_nav:
      contents:
        - Lobby
        - Create
        - Chat_or_Discuss_candidate
        - Characters_or_Review_candidate
```

### Global shell wireframe

```text
+--------------------------------------------------+
| Goblin Cave                         Fri 7 PM  () |
| Pregame: 3d 14h left                            |
+--------------------------------------------------+
| Need: Frontline 0/1   Prompt active              |
| Latest: Alice shared Rune Sage v3                |
+--------------------------------------------------+
| [ ONE PRIMARY NEXT ACTION ]                      |
+--------------------------------------------------+
| Main work region                                 |
|                                                  |
|                                                  |
+--------------------------------------------------+
| Saving / Shared / Needs attention                |
+--------------------------------------------------+
| Lobby        Create        Chat        Characters |
+--------------------------------------------------+
```

### Cost-benefit direction

The release should prefer high-value UX changes that reuse current architecture:

- stronger phone shell
- stronger prioritization of next action
- clearer re-entry hierarchy
- clearer `Create` as iterative workspace
- clearer `Chat` as artifact-centered discussion
- clearer `Characters` as review/comparison workbench

The release should avoid high-cost, low-certainty additions unless separately designed:

- new backend discussion semantics
- new authoritative compare semantics
- new command families just for UX labeling
- major route-model churn

### First-time experience north star

The first-time experience should get a user into the pregame loop with as few interactions as possible.

For a phone user, the system should make three primary first moves obvious:

- `Join a game`
- `Start a game`
- `Create a character`

The first-time experience should not feel like account administration, generic dashboard browsing, or route discovery. It should feel like choosing the fastest path into a real pregame context.

### First-time experience design intent

- A new player should be able to understand the app's purpose in one screen.
- A new player who already has a game to join should be able to enter that game's Lobby quickly.
- A new GM should be able to start a game and reach the Lobby quickly.
- A player who wants to explore character creation first should be able to enter the creator without confusion, but the UX should still pull them toward a game-scoped pregame loop as soon as possible.
- The first-time flow should minimize branching and avoid exposing low-priority destinations before the user has entered a meaningful pregame path.

### First-time experience priorities

Priority order for a brand new or newly returned phone user:

1. Resume an already-active pregame loop if one exists.
2. Join a game if the user has a clear join path or invite context.
3. Start a game if the user is acting as a GM.
4. Create a character if the user is exploring or preparing to join play.
5. Show broad Home/dashboard browsing only when none of the above are more relevant.

### First-time experience constraints

- The first-time path must favor game-scoped entry over generic account surfaces.
- The user should not need to understand the difference between all screens before taking the first meaningful action.
- The first-time path should avoid presenting too many equal choices.
- The first-time path should preserve the current architecture where possible:
  - joined game leads to Lobby
  - GM-created game leads to Lobby
  - game-scoped character creation leads to Create
  - library-only character creation remains available, but should not dominate the phone-first first-time path

## 4. Non-Goals

- Do not define pseudocode or implementation algorithms.
- Do not prescribe React structure, hook names, or local state shape.
- Do not require route changes for the redesign to be valid.
- Do not introduce new backend semantics in this release unless separately designed.
- Do not make compare mode, threaded discussion, or richer revision anchors mandatory if they exceed the current architecture.
- Do not turn GM Inbox into the center of the pregame experience.
- Do not turn Character Sheet into the default discussion surface.
- Do not optimize the release around approval before optimizing it around planning.

## 5. Guardrails

### Product guardrails

- The `draft -> share -> discuss -> revise` loop is the primary experience.
- Every major pregame surface must do one of three things:
  - start the loop
  - continue the loop
  - resume the loop
- If a surface does not do one of those, it is supporting UX and should be visually subordinate.

### Architecture guardrails

- This document defines UX states and design intent, not implementation contracts beyond what is required for coherence.
- Existing backend semantics are the baseline.
- Any idea that requires new durable semantics must be treated as a future design item, not silently smuggled into this release as a frontend assumption.

### UI guardrails

- Use ISA-101-inspired stability and low-noise layout.
- Keep one dominant next action per phone viewport region.
- Preserve stable regions across screens.
- Keep overview and workflow surfaces dominant over detail surfaces.

### Naming guardrails

- Route paths remain implementation choices and do not need to change.
- Candidate label changes are optional and should not cause route or architecture churn by themselves.

### Re-entry guardrails

- Active pregame work should outrank generic dashboard browsing.
- Re-entry surfaces must explain why now.
- Inbox is a recovery surface, not the primary pregame workspace.

### Review guardrails

- Characters Workbench is for structured review, comparison, and inspection.
- It must not become a second general chat transcript.

### Approval guardrails

- Approval is the exit from exploratory planning, not the center of the release.
- Submit must remain visually downstream from share during exploration.

## 6. Implementation Slices

### Slice 1: Reduce Friction Into The Loop

**Purpose**

Make it easier for users, including first-time users, to land in the active pregame loop instead of broad account or dashboard browsing.

**Scope**

- Home and Inbox prioritization
- Resume and re-entry framing
- Lobby entry emphasis

**Out of Scope**

- new backend semantics
- compare-specific new features
- approval redesign

**Expected Behavior After This Slice**

- users can more quickly identify the game that needs attention
- first-time users can quickly choose `Join`, `Start`, or `Create`
- active pregame work is visually prioritized

**Contracts and Boundaries**

- resume is a UX state, not a new route contract
- digest and inbox remain re-entry aids

**Testable Hypotheses**

- Given active pregame activity, users can identify the next planning destination faster than generic home browsing.
- Given multiple games, the interface explains why one game deserves attention now.
- Given a first-time phone user, the interface exposes a fastest path into a meaningful pregame context without requiring dashboard literacy.

**Verification**

- web tests for Home and Inbox prioritization
- browser coverage for resume-to-lobby flow
- typecheck for touched packages

**Definition of Done**

- active pregame re-entry is clearer without route-model churn
- no new backend semantics are introduced

**Handoff Notes for Next Agent**

- You can rely on resume/orient framing as a stable UX target.
- You can treat first-time entry as part of pregame-loop UX rather than a separate onboarding product.

### Slice 2: Make Lobby The Control Room

**Purpose**

Turn Lobby into the unquestioned `orient` surface for players and GMs.

**Scope**

- first-viewport priority
- next-action emphasis
- party needs and latest-relevant-activity framing

**Out of Scope**

- full chat redesign
- creator internals

**Expected Behavior After This Slice**

- Lobby answers what the game needs next
- Lobby produces one obvious next action

**Contracts and Boundaries**

- Lobby remains game-scoped
- it summarizes, not replaces, Create, Chat, or Characters

**Testable Hypotheses**

- Given no active draft, Lobby pushes the user toward the most relevant creation move.
- Given active feedback, Lobby pushes the user toward revision or discussion instead of generic browsing.

**Verification**

- web tests for lobby priority states
- browser coverage for lobby-to-create and lobby-to-chat actions
- typecheck for touched packages

**Definition of Done**

- Lobby behaves like a control room, not only a status board

**Handoff Notes for Next Agent**

- You can treat Lobby as the canonical `orient` surface.

### Slice 3: Reframe Create As Iterative Workspace

**Purpose**

Make Create feel like an iterative planning surface, not only a completion wizard.

**Scope**

- stronger checkpoint sharing emphasis
- stronger visible revision reason
- stronger party-context framing

**Out of Scope**

- new command semantics
- replacement of existing wizard engine logic

**Expected Behavior After This Slice**

- partial drafts feel valid
- share is a first-class output
- revise has visible cause

**Contracts and Boundaries**

- Create remains the main `draft`, `share_ready`, and `revise` surface
- approval remains visually downstream

**Testable Hypotheses**

- Given feedback-driven re-entry, the reason for revision stays visible.
- Given a partial draft, the user can still share meaningfully without feeling blocked by completion.

**Verification**

- web tests for checkpoint share framing and revision context
- browser coverage for create-share-discuss handoff
- typecheck for touched packages

**Definition of Done**

- Create reads as a workspace for planning moves rather than a narrow form-completion funnel

**Handoff Notes for Next Agent**

- You can rely on Create being the dominant draft-and-revise surface.

### Slice 4: Reframe Chat And Characters Around Discussion And Review

**Purpose**

Clarify the distinct roles of discussion and review without demanding new backend semantics.

**Scope**

- stronger artifact-centered chat hierarchy
- stronger shared-draft review hierarchy in Characters
- candidate label exploration for `Discuss` and `Review`

**Out of Scope**

- new durable reply threading
- mandatory compare route or new compare semantics

**Expected Behavior After This Slice**

- Chat foregrounds the active shared artifact and next conversational move
- Characters foregrounds structured review and comparison

**Contracts and Boundaries**

- Chat remains the main `discuss` surface
- Characters remains the main `review` surface
- label changes are optional

**Testable Hypotheses**

- Given a shared draft, users can tell whether to discuss, inspect, or revise next.
- Given multiple shared drafts, users can compare directions without needing full-sheet drill-down first.

**Verification**

- web tests for chat and characters emphasis changes
- browser coverage for discuss-to-revise and review-to-discuss handoffs
- typecheck for touched packages

**Definition of Done**

- Chat and Characters have clearer, non-overlapping loop roles

**Handoff Notes for Next Agent**

- You can rely on `discuss` and `review` as stable UX concepts even if labels stay `Chat` and `Characters`.

### Slice 5: Keep Approval As Exit, Not Center

**Purpose**

Preserve approval without letting it dominate the pregame release.

**Scope**

- submit framing
- GM inbox framing
- rejection return-to-planning framing

**Out of Scope**

- re-architecting approval semantics

**Expected Behavior After This Slice**

- approval feels like the end of exploratory planning
- planning remains the center of the release

**Contracts and Boundaries**

- GM Inbox remains the main final-review surface
- approval does not replace collaborative steering

**Testable Hypotheses**

- Given an exploratory draft, the UI emphasizes share before submit.
- Given a GM review decision, the user can return to planning rather than dead-end.

**Verification**

- web tests for create submit hierarchy and GM inbox return-to-planning actions
- browser coverage for submit and rejection return path
- typecheck for touched packages

**Definition of Done**

- approval exists as a clean exit without visually displacing the loop

**Handoff Notes for Next Agent**

- You can rely on approval as secondary until the draft is visibly converged.

## Flow Contracts

### Flow A: Resume Into Active Pregame

```yaml
flow:
  id: resume_active_pregame
  actor:
    - player
    - gm
  state: resume
  user_question: What needs me now?
  primary_action:
    label: Resume Planning
    destination: active_game_lobby
  guardrails:
    - active pregame outranks generic browsing
    - each resume card explains why now
```

### Flow A1: First-Time Entry To Pregame

```yaml
flow:
  id: first_time_entry
  actor:
    - player
    - gm
  state: resume
  user_question: What should I do first?
  primary_choices:
    - Join a Game
    - Start a Game
    - Create a Character
  priority_rules:
    - active pregame resume beats generic first-time entry
    - join or invite context beats broad browsing
    - start game is primary for a user acting as GM
    - create character is available, but should lead toward a game-scoped loop quickly
  guardrails:
    - do not force the user through generic dashboard comprehension first
    - do not present more than three equally weighted first actions on phone
    - first-time entry should minimize taps before reaching a meaningful pregame surface
```

Wireframe:

```text
+--------------------------------------------------+
| SwordWorld                                       |
| Async party planning for your next session       |
+--------------------------------------------------+
| What do you want to do first?                    |
|                                                  |
| [Join a Game]                                    |
| Enter a game and start planning                  |
|                                                  |
| [Start a Game]                                   |
| Create a game and guide the party                |
|                                                  |
| [Create a Character]                             |
| Start a draft and move toward a game             |
+--------------------------------------------------+
```

### Flow A2: Join A Game Fast

```yaml
flow:
  id: join_game_fast
  actor: player
  state: resume
  user_question: How do I get into the game quickly?
  preferred_destination: /games/:gameId
  rule:
    - once joined, land in Lobby rather than generic home
```

Wireframe:

```text
+--------------------------------------------------+
| Join a Game                                      |
+--------------------------------------------------+
| Goblin Cave                                      |
| GM: Zed                                          |
| Session 1 this Friday                            |
|                                                  |
| [Join and Open Lobby]                            |
+--------------------------------------------------+
```

### Flow A3: Start A Game Fast

```yaml
flow:
  id: start_game_fast
  actor: gm
  state: orient
  user_question: How do I start planning quickly?
  preferred_destination: /games/:gameId
  rule:
    - after game creation, land in Lobby rather than staying in admin setup
```

Wireframe:

```text
+--------------------------------------------------+
| Start a Game                                     |
+--------------------------------------------------+
| New game name                                    |
| Goblin Cave                                      |
|                                                  |
| [Create Game and Open Lobby]                     |
+--------------------------------------------------+
```

### Flow A4: Create A Character Fast

```yaml
flow:
  id: create_character_fast
  actor: player
  state: draft
  user_question: How do I start making something useful now?
  preferred_destinations:
    game_scoped: /games/:gameId/character/new
    fallback: player_library_creator
  rules:
    - prefer game-scoped creator when a relevant game context exists
    - library creator remains available but should not overshadow pregame entry
```

Wireframe:

```text
+--------------------------------------------------+
| Create a Character                               |
+--------------------------------------------------+
| Best next step                                   |
| Goblin Cave needs Frontline                      |
|                                                  |
| [Create for Goblin Cave]                         |
|                                                  |
| Or                                               |
| [Create in My Library]                           |
+--------------------------------------------------+
```

### Flow B: Lobby As Control Room

```yaml
flow:
  id: lobby_control_room
  route: /games/:gameId
  state: orient
  user_question: What does this game need next?
  first_viewport_must_show:
    - active_need
    - active_prompt
    - latest_relevant_activity
    - one next action
```

Player wireframe:

```text
+--------------------------------------------------+
| Goblin Cave                         3d 14h   () |
| Session 1 this Friday                           |
+--------------------------------------------------+
| Party gap                                        |
| Frontline 0/1   Healing 0/1   Scout 1/1          |
+--------------------------------------------------+
| GM prompt                                        |
| "We need someone who can survive first contact." |
| [Create for Frontline]                           |
+--------------------------------------------------+
| What changed                                     |
| Alice shared Rune Sage v3                        |
| GM replied: "Good support, still fragile."       |
| [Open Latest Shared Draft]                       |
+--------------------------------------------------+
| Lobby        Create        Chat        Characters |
+--------------------------------------------------+
```

### Flow C: Create As Iterative Draft Studio

```yaml
flow:
  id: iterative_draft_workspace
  state:
    - draft
    - share_ready
    - revise
  user_question: What can I change or share right now?
  primary_action:
    default: Share Checkpoint
    when_dirty: Save and Share
  rules:
    - partial drafts are valid
    - revision reason is visible when relevant
    - submit is visually downstream from share
```

Wireframe:

```text
+--------------------------------------------------+
| Create                              Goblin Cave |
+--------------------------------------------------+
| Responding to GM prompt                          |
| "We need frontline and field healing."           |
+--------------------------------------------------+
| Current direction                                |
| Shield Cleric                                    |
| Covers: Frontline partial / Healing strong       |
| Risk: Low mobility                               |
| [Save and Share Checkpoint]                      |
+--------------------------------------------------+
| Draft sections                                   |
| Concept ready   Role needs choice   Notes empty  |
+--------------------------------------------------+
| Latest feedback                                  |
| GM: "Can this survive melee?"                    |
+--------------------------------------------------+
| Lobby        Create        Chat        Characters |
+--------------------------------------------------+
```

### Flow D: Chat As Discussion Around Shared Artifacts

```yaml
flow:
  id: artifact_centered_discussion
  route: /games/:gameId/chat
  state: discuss
  user_question: What are we discussing, and what action can I take?
  rules:
    - shared draft artifacts outrank freeform messages in the first viewport
    - every active artifact exposes a path back to revision
    - no new backend discussion semantics are assumed
```

Wireframe:

```text
+--------------------------------------------------+
| Chat                                Goblin Cave |
+--------------------------------------------------+
| Active draft discussion                           |
| Shield Cleric v2                                  |
| Question: Can this cover frontline enough?        |
| [Revise Draft]                                    |
+--------------------------------------------------+
| Shared draft                                      |
| Sonia: Shield Cleric v2                           |
| Healing strong / Frontline partial                |
| GM: "Good direction. Needs a survival answer."    |
| Alice: "Works if Borin goes tank."                |
| [Reply] [React] [Open In Characters]              |
+--------------------------------------------------+
| Lobby        Create        Chat        Characters |
+--------------------------------------------------+
```

### Flow E: Characters As Review Workbench

```yaml
flow:
  id: review_shared_directions
  route: /games/:gameId/characters
  state: review
  user_question: Which draft should we inspect, compare, or discuss?
  candidate_nav_label: Review
  rules:
    - structured comparison is primary
    - full sheet is drill-down only
    - no mandatory new compare semantics
```

Wireframe:

```text
+--------------------------------------------------+
| Characters                          Goblin Cave |
+--------------------------------------------------+
| Party fit                                        |
| Frontline 0/1   Healing 1/1   Scout 1/1          |
+--------------------------------------------------+
| Shared drafts                                    |
| Shield Cleric v2                                 |
| Covers healing / partial frontline               |
| Status: discussing survivability                 |
| [Discuss] [Revise] [Inspect]                     |
| Rune Sage v3                                     |
| Status: needs GM direction                       |
| [Discuss] [Inspect]                              |
+--------------------------------------------------+
| Approved                                         |
| Kira: Scout                                      |
+--------------------------------------------------+
| Lobby        Create        Chat        Characters |
+--------------------------------------------------+
```

### Flow F: Approval As Exit

```yaml
flow:
  id: approval_exit
  state: approve
  rules:
    - approval closes exploratory planning
    - approval does not replace the loop
    - rejection returns the user to planning context
```

## Summary Principle

The release should be organized around these five loops:

1. Resume Loop
   Open app -> active game -> next pregame action

2. Draft Loop
   Lobby -> Create -> Share Checkpoint -> Chat

3. Feedback Loop
   Chat -> Revise With Cause -> Share Revision

4. Review Loop
   Characters -> Inspect / Compare / Discuss -> Revise or Return To Chat

5. GM Steering Loop
   Lobby -> Set Prompt -> Players Draft And Share -> GM Guides

The core UX sentence is:

`A user should always be one tap away from the next movement in the loop.`
