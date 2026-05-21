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
- Completed:
  - Slice 1: backend durable semantic metric emission for post-commit pregame commands
  - Slice 2: creator-session start/completion and active-duration recording with stable entry-source semantics
  - Slice 3: durable reply-target and prompt-response semantics for shared draft discussion
  - Slice 4: end-to-end trace propagation across browser, HTTP, queue, and dispatcher
  - AWS rollout phase 1: Lambda active tracing, CORS support for semantic observability headers, and a CloudWatch pregame observability dashboard
- Remaining:
  - AWS rollout phase 2: log-retention and dashboard refinement, alerting for product-health thresholds, and optional X-Ray/RUM visualization integrations
- Track:
  - creator active minutes per invited player
  - creator return sessions before first play
  - share rate before first session
  - replies and reactions per shared artifact
  - chat-to-creator return rate
  - GM prompt response rate
- Keep metrics derivative of stable user-visible events rather than hidden client-only heuristics.
