# Pregame Planning Loop TODOs

These are the major product slices that still remain after the current pregame loop implementation.

## Recently Completed

- `Characters` workbench exists as a game-scoped planning surface with `Mine`, `Shared`, and `Approved` states.
- Creator checkpoint sharing supports draft snapshot, question, compare directions, and answer GM prompt.
- Shared character artifacts now support lightweight social feedback through low-friction reactions that aggregate back onto chat and workbench reads.

## 1. End-To-End Browser Coverage

- Add route-level browser coverage for the full pregame loop:
  `Lobby -> Create/Edit -> Share Draft -> Chat Preview/Reply -> Reactions -> Characters -> Digest/Re-entry`
- Cover a phone-first viewport explicitly.
- Keep existing digest/browser coverage intact while broadening the protected loop.
- Stabilize the local browser stack so the proof does not depend on orphaned local dev processes being cleaned up manually.

## 2. Product Metrics And Instrumentation

- Instrument the pregame loop so the product thesis can be measured directly.
- The design intent for these metrics now lives in:
  - `docs/ux.phone-first-pregame-loop.md`
  - `docs/architecture.pregame-planning-loop.md`
  - `docs/metrics.pregame-planning-loop.md`
- Slice 1 is underway as backend durable semantic metric emission for post-commit pregame commands.
- The remaining work is implementation, not metric-definition discovery.
- Track:
  - creator active minutes per invited player
  - creator return sessions before first play
  - share rate before first session
  - replies and reactions per shared artifact
  - chat-to-creator return rate
  - GM prompt response rate
- Keep metrics derivative of stable user-visible events rather than hidden client-only heuristics.
