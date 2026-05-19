# Performance

## Network behavior

Avoid request waterfalls.

Rules:

- no fetching in leaf components,
- no sibling components each discovering their own data needs at render time,
- no serial network chains unless request B truly depends on request A.

Prefer:

- route-level data loading,
- feature-level aggregation,
- batching when the UX state always needs the same data together.

## Selector discipline

Selectors should return narrow, stable data.
Do not return oversized objects with unrelated sibling state.

Bad:

- one selector returning the full page state tree

Good:

- one selector returning the exact view model required by the component

## Rerender discipline

Bad data bindings cause cascading rerenders.

Rules:

- pass the smallest useful props,
- avoid object churn when values have not changed,
- avoid parent subscriptions to sibling state they do not render,
- split state by change frequency and ownership.
- bind each component to the smallest ViewModel it needs.
- keep selector outputs referentially stable when inputs have not changed.

## Memoization

Do not reach for memoization first.
First fix:

- state shape
- ownership
- selector granularity
- component boundaries
- network loading shape

Then add memoization only where measurement shows it matters.

## Measuring render cost

It is possible to record rerenders for important operations.

Use React `Profiler` or targeted render-count helpers in component tests when changing:

- shared state machines,
- broad selectors,
- large explorer lists,
- layout containers,
- context providers.

Render-count checks should catch infinite loops and obvious broad-redraw regressions. Keep thresholds pragmatic and flow-specific so tests do not fail on harmless React scheduling differences.

## Checkpoints

Be suspicious of performance regressions when changing:

- selectors
- shared hooks
- context values
- large tables
- long lists
- dashboards
- layout containers reused across screens
