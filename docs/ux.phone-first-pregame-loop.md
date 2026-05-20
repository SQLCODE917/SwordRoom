# Phone-First Pregame Loop UX Spec

## Purpose

Validate SwordWorld as an async "chess by mail" tabletop experience for busy people by making character creation and pregame chat reinforce each other.

This spec focuses on the time before the first live session. The product goal is not only to let a player finish a legal character. The goal is to make players want to revisit, revise, share, and discuss their characters with the GM and the rest of the party.

## Success Signals

- Players spend meaningful time in character creation across multiple short sessions.
- Players share character drafts before the first session begins.
- Pregame chat contains character-focused discussion rather than only scheduling logistics.
- GMs can steer party composition and scenario tone without requiring everyone to be online at once.

## Product Promise

- A player can make one meaningful pregame move in under 60 seconds.
- Every meaningful move leaves behind something others can react to later.
- Character planning feels social, not solitary.
- Phone is the baseline experience. Tablet and desktop reveal more context, but they do not introduce a different workflow.

## Core Loop

1. A player sees a party need, GM prompt, or comment from another player.
2. The player opens the creator and adjusts a draft.
3. The player shares a checkpoint into the game conversation.
4. The GM or other players react, reply, or compare against party needs.
5. The player revises the draft or locks in a direction.
6. The loop repeats until the party is ready to play.

## Primary Navigation

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

### Navigation intent

- `Lobby` is the default home for an upcoming game.
- `Create` is the focused drafting surface.
- `Chat` is the full conversation view.
- `Characters` is the personal and party library surface.
- Inbox remains a secondary digest surface, not the primary planning surface.

## Shared UX Principles

- Prefer one task at a time on phone.
- Keep the most important next action visible without scrolling to the page end.
- Treat character sharing as a first-class action, not a side effect.
- Summaries come before full sheets.
- The creator should always show the current party context.
- Chat should always make it easy to jump back into the creator.

## Screen 1: Lobby

### Role

The lobby is the pregame planning hub. It answers:

- What does the party still need?
- What changed since I last checked?
- What should I do next?

### Phone wireframe

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

### Notes

- The top half of the screen is directional: session timing, GM prompt, party needs.
- The bottom half is social proof: recent shares, replies, votes, and activity.
- The primary CTA changes based on context. Examples:
  - `Quick share my current draft`
  - `Answer GM prompt`
  - `Claim a need`

## Screen 2: Creator

### Role

The creator remains rule-dense, but it must feel lightweight on phone. It should feel like a sequence of checkpoints that are easy to revisit rather than a long form that must be finished in one sitting.

### Phone wireframe

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

### Creator interaction rules

- One major decision zone per screen.
- Derived stat summaries stay visible without opening another route.
- Party context appears inline so the player never has to remember it.
- `Share Update` is available from every meaningful checkpoint.
- Full sheet detail is secondary to current decision support.

## Screen 3: Share Update Sheet

### Role

Sharing should feel easy enough to do often. The player should not need to write a long message every time they want feedback.

### Phone wireframe

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

### Notes

- The share sheet is a bottom-sheet interaction on phone.
- The share payload should be previewable before posting.
- The message can be lightweight because the card itself carries context.

## Screen 4: Chat

### Role

Chat is where hype accumulates. It must support plain text, but it should privilege character-centered conversation and pregame planning artifacts.

### Phone wireframe

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

### Message types

- Plain text
- Character snapshot card
- Character revision / diff card
- GM prompt card
- Vote / poll card
- Reply thread summary

### Chat rules

- Character messages should be visually richer than plain text.
- A character card should expose direct actions:
  - `Open`
  - `Reply`
  - `React`
  - `Compare`
- Filters must make character-centered planning easy to find later.

## Screen 5: Character Preview From Chat

### Role

Most chat interactions should open a lightweight preview first, not a full-page detour.

### Phone wireframe

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

### Notes

- Use a bottom sheet on phone.
- Opening the full sheet is a secondary action.
- The preview should answer "what is this build trying to do?" before showing exhaustive detail.

## Screen 6: Characters

### Role

This is the workbench and library view. It should separate private drafting from shared party-facing artifacts.

### Phone wireframe

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

### Notes

- `Mine` emphasizes ongoing work.
- `Shared` emphasizes social traction.
- `Approved` supports the transition from planning to play.

## Inbox / Digest

Inbox should summarize what changed while the player was away:

- new replies to a shared character
- GM prompt awaiting response
- party need still unclaimed
- character approved or rejected

Inbox should route the user back into `Lobby`, `Create`, or the relevant chat artifact. It should not become a parallel planning workflow.

## Responsive Adaptation

### Tablet

- Lobby becomes two columns:
  - planning feed
  - roster and party needs
- Creator shows a persistent summary column.
- Chat shows transcript plus preview inspector.

### Desktop

- Lobby uses three zones:
  - direction and party state
  - social activity feed
  - detail preview / selected artifact
- Creator can show step outline, active panel, and summary at once.
- Chat can keep transcript and selected character preview visible together.

### Invariant across breakpoints

Phone is the baseline information hierarchy. Larger screens reveal more simultaneous context, but they do not introduce new required steps or hidden-only desktop features.

## Product-Specific UX Constraints

- The lobby is the default game home, not the raw chat transcript.
- Character sharing is part of creation, not a separate export flow.
- Party needs and GM prompts must remain visible across the loop.
- A shared character update should always be easier to open than a full sheet.
- The system should reward short revisits and iterative posting rather than one long uninterrupted build session.

## Measurement

Track success at the loop level, not only at the page level:

- creator active minutes per invited player
- creator return sessions before first play
- share rate before first session
- replies and reactions per shared character artifact
- chat-to-creator return rate
- GM prompt response rate

High time-in-page without sharing or discussion is not success by itself. The intended outcome is a virtuous cycle between drafting and conversation.
