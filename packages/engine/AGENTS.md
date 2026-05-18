# Engine Package Conventions

## Scope

`engine` owns Sword World rules, state transitions, calculators, and legality checks.
It should be usable by any host application that wants to implement Sword World gameplay.

## Read order

Before changing engine code, read:

1. [/workspaces/hello-world-monorepo/AGENTS.md](/workspaces/hello-world-monorepo/AGENTS.md)
2. This file.
3. The rule document that matches the task:
   - [/workspaces/hello-world-monorepo/docs/sword-world-character-creation.md](/workspaces/hello-world-monorepo/docs/sword-world-character-creation.md)
   - [/workspaces/hello-world-monorepo/docs/sword-world-gameplay-loop.md](/workspaces/hello-world-monorepo/docs/sword-world-gameplay-loop.md)
   - [/workspaces/hello-world-monorepo/docs/sword-world-gameplay-loop-flow-diagrams.md](/workspaces/hello-world-monorepo/docs/sword-world-gameplay-loop-flow-diagrams.md)
4. Relevant shared rules, fixtures, and contracts already used by the engine.

If the docs and code disagree, treat the rule document as the source of truth and update tests plus calling code accordingly.

## Design goal

Keep the engine standalone and host-agnostic.

The engine should model:

- what the rules allow
- how state changes when a legal action happens
- what deterministic result follows from supplied inputs

The engine should not model:

- HTTP requests or responses
- persistence records or repository concerns
- auth providers, sessions, or entitlements
- React state or view models
- queue, worker, or event delivery concerns
- browser APIs, filesystem APIs, or environment variables

## Boundary rules

- `engine` may depend on `@starter/shared` only for stable shared contracts, validated rule tables, and pure helpers.
- Do not import service implementation code, web code, infra code, or test-only orchestration into `engine`.
- Treat app-specific DTOs as suspect even when they currently live in `shared`.
- If a type includes API, persistence, auth, or UI concerns, map it outside the engine.
- Prefer engine-owned domain types when the concept is part of Sword World rules rather than generic shared plumbing.

## Purity and determinism

- Engine functions must be pure.
- Do not read clocks, random sources, process env, global mutable state, or I/O directly.
- Accept rolled totals, timestamps, ids, catalogs, and tables as inputs.
- Return next state plus structured errors; do not throw for expected rule violations.
- Keep error codes stable and machine-readable. Error messages should explain the rule violation without depending on UI wording.

## Modeling rules

- Encode rule procedures explicitly: character creation, checks, combat, damage, equipment legality, and similar rule flows.
- Prefer small rule functions that can be composed over large orchestration functions with mixed concerns.
- Use discriminated unions and explicit state shapes for meaningful rule states.
- Keep model transitions one-directional and easy to test.
- Represent rule restrictions explicitly instead of hiding them in stringly typed conditionals spread across files.
- Separate rule data from rule execution where that improves clarity.

## Reusability rules

- Design public APIs so a different app could call them without knowing SwordRoom internals.
- Do not require host-specific entity shapes when a narrower engine shape would do.
- Do not bake transport field names, DynamoDB keys, route semantics, or page workflow assumptions into engine types.
- Prefer inputs like `combatant`, `skillLevels`, `abilityScores`, `catalogEntry`, and `rolledTotal` over app-layer objects.
- If an adapter is needed from app models to engine models, keep that adapter outside `engine`.

## File and export shape

- Group code by rule domain, not by technical layer names from services or web.
- Keep the public API intentional through `src/index.ts`.
- Prefer named exports.
- Keep helpers private unless another package truly needs them.
- Place tests beside the rule domain they verify.

## Testing expectations

- Add or update unit tests for every rule change.
- Cover legal paths, illegal paths, edge cases, and rule-specific invariants.
- Prefer table-driven tests for rule matrices and progression rules.
- When implementing a rule from a document table, include representative examples from that table in tests.
- When a behavior depends on imported shared rule data or fixtures, add at least one test that proves the integration shape still matches the rulebook intent.

## Promotion guidance

- Put reusable static tables, validation schemas, and neutral shared helpers in `shared`.
- Keep Sword World rule execution in `engine`.
- Do not move engine logic into `shared` just to remove one import or avoid a local dependency.

## Review checklist

Before finishing engine work, confirm:

- the rulebook-backed behavior is still explicit
- the API stayed host-agnostic
- no side effects or infrastructure concerns leaked in
- tests cover the changed rule paths
- exports stayed narrow and intentional
