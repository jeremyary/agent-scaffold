# Testing Standards

## Requirements

These targets apply at **MVP** and **Production** maturity. At **PoC** maturity, focus on smoke tests for critical paths — see the maturity expectations table in the root CLAUDE.md.

- All new code must include tests before merge
- Bug fixes must include a regression test that fails without the fix
- Minimum coverage target: 80% line coverage for new code (MVP/Production)

## Test Naming
Format: `should <expected behavior> when <condition>`

```
should return 404 when user is not found
should validate email format when registering
should retry on transient network failure
```

## Structure
- Follow Arrange-Act-Assert (AAA) pattern
- One assertion concept per test (multiple assertions OK if testing one behavior)
- Use descriptive test group names that read as specifications

## Isolation
- Tests must not depend on execution order
- Tests must not share mutable state
- Mock external services and I/O at boundaries
- Use factories or fixtures for test data, not raw literals
- Clean up any resources created during tests

## Types
- **Unit tests:** Test individual functions/modules in isolation
- **Integration tests:** Test module interactions and API boundaries
- **End-to-end tests:** Test critical user flows through the full stack

## Files
- Co-locate unit tests with source: `foo.ts` → `foo.test.ts`, `foo.py` → `test_foo.py`
- Integration/e2e tests in dedicated `tests/` directory
