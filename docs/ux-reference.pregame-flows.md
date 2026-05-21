# Pregame UX Flow Reference

## Purpose

This document is a redesign reference for the frontend flows that participate in the pregame release. Its job is to make the current flow landscape legible so the UX can be reworked toward one goal: the `draft -> share -> discuss -> revise` loop must become the primary experience for both players and GMs.

This is not an implementation spec. It is a product-facing map of the existing and intended UX flows, with enough structure to guide redesign work across phone, tablet, and desktop without losing architectural alignment.

## Design Target

The pregame release should feel like correspondence play for a tabletop campaign.

- A player should always know the next useful pregame move.
- A GM should always be able to steer the party without opening deep admin screens.
- The phone experience must be complete, not reduced.
- The UI should follow the repo's ISA-101-inspired style:
  - grayscale first
  - stable layout regions
  - obvious actions
  - low decorative noise
  - drill-down from overview to detail

## Core Product Thesis

The first-class loop is:

1. player opens a game
2. player sees what the party needs
3. player drafts or revises a character
4. player shares a checkpoint into the group conversation
5. GM and players react, reply, or redirect
6. player revises again
7. the group converges on a stronger party before live play

Every major pregame surface should either:

- start this loop
- continue this loop
- bring a lapsed user back into this loop

If a surface does not do one of those three things, it is supporting UX and should be visually subordinate.

## Frontend Surface Map

These are the current frontend surfaces that matter to the pregame release.

| Surface | Route | Primary actor | Pregame role |
| --- | --- | --- | --- |
| Home | `/` | player, GM | broad account and game discovery entry |
| Pregame Lobby | `/games/:gameId` | player, GM | planning overview and primary game-scoped entry |
| Character Wizard | `/games/:gameId/character/new` | player, GM | draft creation |
| Character Wizard Edit | `/games/:gameId/characters/:characterId/edit` | player, GM | draft revision |
| Game Chat | `/games/:gameId/chat` | player, GM | discussion around shared drafts and prompts |
| Characters Workbench | `/games/:gameId/characters` | player, GM | structured review of mine, shared, and approved characters |
| Character Sheet | `/games/:gameId/characters/:characterId` | player, GM | authoritative detail drill-down |
| Player Inbox | `/me/inbox` | player | async re-entry and invite handling |
| GM Games | `/gm/games` | GM | game creation, visibility, invite entry |
| GM Inbox | `/gm/:gameId/inbox` | GM | approval and invite-response follow-up |

## Information-Level Model

The pregame UX should follow the ISA-101-inspired information hierarchy already implied by the current app.

### Level 1: Overview

- Home
- Pregame Lobby
- Player Inbox
- GM Games

These screens answer:

- what game needs my attention
- what is blocked
- where should I go next

### Level 2: Workflow Views

- Character Wizard
- Game Chat
- Characters Workbench
- GM Inbox

These screens answer:

- what move should I make now
- what context do I need while making it

### Level 3: Detail and Control

- Character Sheet

This screen answers:

- what exactly is on this character
- do I need deep inspection before the next pregame move

The redesign should keep users in Levels 1 and 2 as long as possible. Level 3 should be a drill-down, not the main route through pregame planning.

## Global Navigation Reference

The current pregame workflow nav is:

- `Lobby`
- `Create`
- `Chat`
- `Characters`
- `Inbox`

This is already the right conceptual model for the release. The redesign should treat this as the base shell for phone-first pregame work, with these roles:

- `Lobby` is the overview and orientation surface.
- `Create` is the action surface for making progress on a character.
- `Chat` is the social negotiation surface.
- `Characters` is the comparison and review surface.
- `Inbox` is a re-entry aid, not the main workspace.

## Canonical Pregame Loop

This is the main flow the redesign should optimize hardest.

### Flow A: Draft -> Share -> Discuss -> Revise

**Actor**

- player

**Current entry points**

- Home -> `Lobby`
- Home -> `Edit`
- Inbox digest -> `Create`, `Chat`, or `Lobby`
- Characters workbench -> `Continue Discussion`

**Current path**

1. open a game
2. review `Lobby` planning status and party needs
3. open `Create`
4. save or revise a checkpoint
5. share current checkpoint into chat
6. review follow-up in `Chat` or `Characters`
7. return to `Create`

**Why it matters**

- this is the loop that validates the product thesis
- this is where time spent and social engagement should concentrate

**Current strengths**

- game-scoped lobby exists
- creator has checkpoint sharing
- chat has structured artifact preview, reply, and reaction
- workbench can inspect shared drafts and continue discussion

**Current friction**

- the loop still feels spread across multiple screens instead of like one continuous pregame mode
- `Create` is still wizard-shaped before it feels socially shaped
- `Lobby` is informative, but not yet obviously the control room for the next pregame move
- `Chat` is still transcript-dominant relative to draft iteration

**Redesign implication**

- this loop should be visible from every pregame surface as the primary path
- every screen should expose one dominant next action that advances the loop

## Player Flows

### Flow B: Discover an active pregame opportunity

**Current surfaces**

- Home
- Player Inbox

**User question**

- which game needs me now

**Current path**

- Home shows `My Games`
- Inbox shows `Pregame Digest`

**Current friction**

- Home is broad and mixes library, public games, and pregame planning
- Inbox is useful for re-entry, but it is not yet obviously the async planning hub

**Redesign implication**

- phone users should see active pregame opportunities before general account browsing
- `Pregame Digest` should feel like a planning inbox, not a secondary table beneath generic inbox content

### Flow C: Enter a game and understand party state

**Current surface**

- Pregame Lobby

**User question**

- what does this group need from me

**Current content**

- planning status
- GM prompt
- party roster
- party needs
- recent activity

**Current friction**

- the lobby reads more like a status board than a launch surface for the next move
- recent activity is present but not yet visually dominant enough to pull the user into the loop

**Redesign implication**

- the first phone viewport should answer:
  - what is needed
  - what changed
  - what should I do next
- the most likely next actions should be direct:
  - `Create for open role`
  - `Answer prompt`
  - `Open latest shared draft`

### Flow D: Start a new draft for a game

**Current surface**

- Character Wizard create route

**User question**

- how do I create something useful for this party

**Current support**

- planning rail in apply mode
- active prompt visibility
- share current checkpoint panel

**Current friction**

- the wizard still carries the cognitive shape of step-by-step completion more than iterative planning
- some users may still feel they must finish a character before participating socially

**Redesign implication**

- `Create` should read as an iterative planning workspace, not only a form flow
- early checkpoints should feel socially publishable
- the screen should explicitly reward partial progress

### Flow E: Revise an existing draft after feedback

**Current surfaces**

- Character Wizard edit route
- Chat
- Characters Workbench
- Inbox digest

**User question**

- how do I act on feedback without losing context

**Current path**

- chat or workbench discussion points back to edit
- digest may return the user to edit

**Current friction**

- route transitions still feel like screen hops between tools
- the reason for returning to edit is implicit more often than explicit

**Redesign implication**

- edit re-entry should carry a clear cause:
  - answer prompt
  - respond to party fit feedback
  - compare directions
- when possible, re-entry should preserve the relevant pregame context in a stable side region

### Flow F: Share a checkpoint from the creator

**Current surface**

- `Share Current Checkpoint` panel in the wizard

**Current share intents**

- `Draft snapshot`
- `Ask a question`
- `Compare directions`
- `Answer GM prompt`

**User question**

- how do I show the group something useful right now

**Current friction**

- the share panel exists, but the surrounding page still prioritizes the wizard more than the social action
- the difference between intents may not yet be visually prominent enough on phone

**Redesign implication**

- sharing should feel like one of the primary outputs of `Create`
- the share intent should visibly change both preview copy and downstream expected response

### Flow G: Read and respond to another player's draft

**Current surfaces**

- Game Chat
- Characters Workbench shared preview

**Current response modes**

- preview
- reply
- react
- open sheet
- continue discussion

**User question**

- what is this build trying to do, and how should I respond

**Current friction**

- chat still distributes attention across many transcript items
- workbench is stronger for comparison, but is not yet the obvious “review drafts” destination

**Redesign implication**

- shared drafts should read as high-signal cards
- quick feedback actions should be easier to scan than surrounding freeform messages
- the difference between `talk`, `react`, and `deep inspect` should stay visually clear

### Flow H: Compare shared directions before committing

**Current surfaces**

- creator compare intent
- chat draft artifacts
- workbench shared preview

**User question**

- which version of this character direction should win

**Current friction**

- compare is supported as a share intent, but not yet as a dedicated review mode

**Redesign implication**

- this is a likely sticky behavior for the product and should be treated as a valuable pregame ritual
- redesign should consider whether compare needs a stronger dedicated visual treatment

### Flow I: Re-enter after time away

**Current surfaces**

- Player Inbox
- Pregame Digest

**User question**

- where do I pick this back up

**Current destinations**

- `Lobby`
- `Chat`
- `Create`
- `Edit`

**Current friction**

- re-entry works functionally, but still feels like navigation rather than guided continuation

**Redesign implication**

- re-entry should feel like `resume planning`, not `go to another page`
- digest cards should carry stronger “why now” framing

### Flow J: Submit for approval

**Current surfaces**

- creator final step
- GM inbox

**User question**

- is this ready to leave the revision loop

**Why it is secondary**

- approval matters, but it is downstream of the pregame loop
- the release should not optimize for approval at the expense of sharing and discussion

**Redesign implication**

- `submit` should exist, but should not overshadow `share` during the exploratory phase

## GM Flows

### Flow K: Create a game and seed the pregame loop

**Current surface**

- GM Games

**Current actions**

- create game
- set visibility
- invite player
- jump to chat or play routes

**User question**

- how do I get a new pregame loop started

**Current friction**

- GM Games is an admin surface first, planning surface second
- there is no strong post-create handoff into the lobby as the control room

**Redesign implication**

- after game creation or invite activity, the preferred next destination should be the game lobby
- GM administrative setup should feed directly into pregame planning setup

### Flow L: Orient the party with a prompt

**Current surfaces**

- Pregame Lobby
- Game Chat
- Character Wizard planning rail

**Current path**

- GM opens lobby
- reviews open roles
- posts suggested prompt for open roles
- players see the prompt in lobby, chat, and creator

**Why it matters**

- this is the GM's strongest mechanism for steering the loop without synchronous play

**Current friction**

- the prompt action exists, but it is still embedded in a generally informational lobby

**Redesign implication**

- the GM's main phone action should likely be `set the next planning question`
- prompts should remain structured and visible across all major pregame surfaces

### Flow M: Review the party as a system

**Current surfaces**

- Pregame Lobby
- Characters Workbench
- Chat

**User question**

- do we have a coherent party, and where are the gaps

**Current friction**

- the party view is distributed:
  - needs are in lobby
  - artifacts are in chat
  - comparison is in characters

**Redesign implication**

- for GM use, the product needs a stronger “party planner” reading across those surfaces
- on phone, this likely means one dominant status stack and one dominant action stack rather than many equal panels

### Flow N: Respond to shared drafts socially before formally reviewing

**Current surfaces**

- Game Chat
- Characters Workbench

**Current actions**

- reply
- react
- preview
- open sheet

**Why it matters**

- GMs should be able to guide drafts before the approval queue
- this keeps the loop collaborative instead of adjudicative

**Redesign implication**

- GM lightweight feedback should be easier than full inbox review
- the pregame release should bias the GM toward steering early, not only judging late

### Flow O: Approve or reject a submitted character

**Current surface**

- GM Inbox

**User question**

- is this draft ready for live play

**Why it is relevant but not core**

- approval closes the loop, but it is not the loop itself
- the release should prevent GM Inbox from becoming the main pregame destination

**Redesign implication**

- GM Inbox remains necessary
- it should stay visually separate from collaborative planning
- it should read as a final review queue, not the central party-planning hub

## Shared Cross-Role Flows

### Flow P: Open a full character sheet from a shared artifact

**Current surfaces**

- Chat preview
- Characters workbench preview

**Purpose**

- deep inspection
- rules verification
- approval confidence

**Design implication**

- the sheet should remain a drill-down
- it should never be the required first step for ordinary pregame conversation

### Flow Q: Move from conversation to action

**Current surfaces**

- chat side rail
- reply-to-create handoff
- lobby actions
- digest actions

**Purpose**

- prevent pregame from stalling in conversation only

**Design implication**

- every discussion surface should provide a clear action exit back into revision

### Flow R: Move from action back to conversation

**Current surfaces**

- creator share panel
- share-to-chat
- role claim
- answer GM prompt

**Purpose**

- prevent drafting from becoming private and silent

**Design implication**

- every creation surface should provide a clear social output path

## Flows That Should Become Secondary In The Redesign

These flows still matter, but should not dominate the release framing.

- broad home/dashboard browsing
- public game browsing
- library-only character creation outside a game
- gameplay routes
- approval as the main GM behavior
- full-sheet inspection as the main player behavior

The redesign should not remove them. It should visually subordinate them when the user is inside a live pregame context.

## Phone-First Redesign Guidance

### What the first viewport should answer

For every pregame surface on phone, the first viewport should answer one question clearly.

- Lobby: `What does this game need next?`
- Create: `What can I change or share right now?`
- Chat: `What are we discussing, and what action can I take from it?`
- Characters: `Which draft should I inspect or compare?`
- Inbox: `What should I resume?`

### Stable regions that should exist on phone

- page title and game identity
- one primary next action
- one compact context block
- one main content region
- one stable status region for async command state
- one persistent pregame navigation region

### Action priority for phone

Primary actions should usually be limited to one per viewport region.

- Lobby primary: enter creator, answer prompt, or open latest shared draft
- Create primary: save/share current checkpoint
- Chat primary: reply/react/open draft
- Characters primary: review/continue discussion
- Inbox primary: resume planning

### Suggested shell direction

The redesign should continue to bias toward:

- `Lobby`
- `Create`
- `Chat`
- `Characters`

as the primary phone navigation set.

`Inbox` can remain accessible, but it should support the loop rather than compete with it.

## UX Questions The Redesign Should Explicitly Answer

- Should the default authenticated entry go to Home, Inbox, or the most active Lobby?
- Should `Characters` become the main review surface for shared drafts, with `Chat` focused more tightly on discussion?
- Should `Create` open to the last active checkpoint instead of always feeling like a top-to-bottom wizard?
- Should the GM's default route after creating or opening a game be Lobby rather than GM Games or Chat?
- Should compare-direction behavior get a dedicated visual mode instead of remaining only a share intent?
- Should approval remain fully separate from collaborative planning, or should the pre-submit review state become more visible to the GM in the pregame surfaces?

## Practical Redesign Priority

If the UX is being redesigned specifically to make the pregame release succeed, the order of emphasis should be:

1. make `Lobby` the unquestioned pregame home
2. make `Create` feel iterative and socially connected
3. make shared drafts the highest-signal objects in `Chat`
4. make `Characters` the best place to compare and inspect shared directions
5. make `Inbox` feel like resume planning, not generic notifications
6. keep `GM Inbox` as a final review queue, not the center of the release

The release wins when users spend time in the loop, not when they merely have access to all the tools around it.
