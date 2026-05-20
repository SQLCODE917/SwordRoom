## Design Documents for Agent-Implemented Features

### Core rule

Specify the boundaries, contracts, risks, and verification points.

Do not specify every class, helper, line of code, or internal algorithm unless that detail is required to preserve correctness, compatibility, security, data shape, or integration behavior.

A good design document should make the next agent say:

“I know what slice I own, what I must not touch, what tests prove it works, and how my slice connects to the larger feature.”

It should not make the next agent say:

“I am following a giant brittle recipe.”

---

## Required Design Document Structure

Every design document must use this structure.

### 1. Feature Summary

Describe the feature in plain language.

Include:

- user-visible behavior
- system behavior
- current limitation or problem
- desired end state

Keep this short. One to three paragraphs.

### 2. Current State

Describe the relevant existing code and behavior.

Include:

- important files, modules, APIs, commands, or data models
- existing patterns that should be followed
- existing tests that matter
- known constraints

Do not inventory the whole codebase. Only include context needed to prevent wrong turns.

### 3. Target State

Describe what should be true when the whole feature is complete.

Include:

- final behavior
- final API or interface shape, if relevant
- final data flow, if relevant
- final user flow, if relevant
- compatibility expectations

This section defines the feature’s north star.

### 4. Non-Goals

List what this feature must not attempt.

Use this to prevent scope creep.

Examples:

- Do not redesign the auth system.
- Do not change the database schema outside the listed tables.
- Do not replace the existing queue runner.
- Do not introduce a new state-management library.
- Do not change public API behavior except where explicitly stated.

### 5. Guardrails

List hard boundaries future agents must obey.

Guardrails should cover:

- ownership boundaries
- files or modules that should not be changed
- public interfaces that must remain stable
- backward compatibility
- security/privacy rules
- performance limits
- failure behavior
- migration safety
- test requirements

Guardrails are more important than implementation details.

### 6. Implementation Slices

Break the feature into one-session slices.

Each slice must be small enough that one coding agent can:

- read the relevant files
- implement the change
- add or update tests
- run verification
- leave the repo in a clean state
- write a useful handoff note

Do not make slices based on architecture layers alone.

Prefer vertical slices that produce testable behavior.

Bad slice:

- “Create all models”
- “Create all services”
- “Build frontend later”

Good slice:

- “Add server-side validation for scheduled delivery cutoff and prove invalid orders are rejected”
- “Expose delivery-window availability through the existing order API”
- “Render delivery-window choices in checkout using the existing API contract”

Each slice must include:

#### Slice N: Name

**Purpose**

Explain what this slice accomplishes in the larger feature.

**Scope**

List what this slice may change.

**Out of Scope**

List what this slice must not change.

**Expected Behavior After This Slice**

Describe what should work after the slice is done, even if the whole feature is not complete.

**Contracts and Boundaries**

Define any API shapes, data shapes, function contracts, event names, state transitions, or invariants that future slices will rely on.

Only define contracts that matter for integration.

**Testable Hypotheses**

Write these as concrete claims that can be proven or disproven.

Examples:

- Given an order after the cutoff time, the API rejects it with the expected error.
- Given a valid delivery window, checkout stores the selected window without changing payment behavior.
- Given the feature flag is disabled, existing checkout behavior is unchanged.
- Given a failed availability lookup, the UI shows the fallback state and does not submit an invalid order.

**Verification**

List exact checks the implementation agent must run.

Examples:

- unit tests
- integration tests
- typecheck
- lint
- build
- specific manual test path
- database migration dry run
- API contract test

**Definition of Done**

Define the minimum acceptable completed state.

A slice is not done unless:

- relevant tests pass
- existing behavior is preserved
- no unrelated refactor is included
- no hidden TODO blocks are left inside the slice
- the handoff note is updated
- the next slice can start without cleanup

**Handoff Notes for Next Agent**

State what the next agent can rely on after this slice is complete.

---

## Right-Sizing Rules

A design document is too detailed if it:

- contains large code blocks
- specifies private helper names without a reason
- dictates line-by-line implementation order
- describes framework usage already obvious from the repo
- tries to solve every future edge case upfront
- becomes hard to review in one sitting

A design document is too vague if it:

- does not define done
- does not name the boundaries
- does not say what tests prove success
- does not explain how slices connect
- leaves data contracts implicit
- leaves error behavior undefined
- leaves backward compatibility undefined
- lets future agents make conflicting assumptions

The correct level of detail is:

Explicit:

- feature intent
- non-goals
- task boundaries
- interfaces between slices
- invariants
- failure behavior
- acceptance tests
- verification commands
- handoff expectations

Implicit:

- local helper structure
- variable names
- ordinary framework patterns
- exact internal control flow
- small refactors inside owned scope
- implementation details that are easy to infer from nearby code

---

## Integration-Hell Prevention

Every slice must leave the repo in a clean, mergeable state.

Avoid designs where many agents build disconnected parts that only work after a final integration push.

Prefer this pattern:

1. Create or preserve the stable seam.
2. Implement one behavior through that seam.
3. Test that behavior.
4. Keep old behavior working.
5. Repeat.

A slice may introduce a temporary adapter, feature flag, or compatibility layer if that makes integration safer.

A slice must not leave broken tests, half-wired flows, or speculative abstractions for later agents to clean up.

---

## Reviewability Budget

The design document should usually be readable in 5–10 minutes.

Use short sections.

Use tables only when they make boundaries or slice ownership clearer.

Avoid long prose.

Avoid large code samples.

Use pseudocode only when the exact contract is hard to express in words.

---

## Required Output Format

When producing a design document, use this exact outline:

# Design: [Feature Name]

## Feature Summary

## Current State

## Target State

## Non-Goals

## Guardrails

## Implementation Slices

### Slice 1: [Name]

- Purpose:
- Scope:
- Out of Scope:
- Expected Behavior After This Slice:
- Contracts and Boundaries:
- Testable Hypotheses:
- Verification:
- Definition of Done:
- Handoff Notes for Next Agent:

### Slice 2: [Name]

...

## Integration Strategy

Explain how slices combine without requiring a painful final integration phase.

## Risks and Early Warning Signs

List the main ways this feature could go wrong.

For each risk, include the signal that would reveal it early.

## Final Acceptance Criteria

List what must be true when the entire feature is complete.

## Open Questions

Only include questions that block safe implementation.

Do not include vague future ideas.
