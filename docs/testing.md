# Testing

- Prefer data-in/data-out unit tests with minimal mocks.
- Treat repeated mocking as a coupling smell.
- Prefer fakes at true system boundaries.
- Component tests render from view models and verify visible state, text, enabled/disabled state, and user interactions.
- State machines, command builders, selectors, mappers, rule functions, and ViewModel builders should have direct unit coverage.
- Browser tests describe full features in domain language and guard against regressions.
- Browser tests are local-only and destructive to local DynamoDB, SQS, and uploads state.
- Every bug fix must add or update the narrowest test that proves the fix.
