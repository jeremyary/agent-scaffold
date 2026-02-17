# Maturity Expectations

Maturity level governs **implementation quality** — test coverage, error handling depth, documentation thoroughness, infrastructure complexity. It does **not** govern **workflow phases**. A PoC still follows the full plan-review-build-verify sequence when SDD criteria are met (see `workflow-patterns` skill). The artifacts may be lighter, but they are not skipped.

**Current maturity: Proof-of-Concept**

| Concern | Expectation |
|---------|-------------|
| Testing | Smoke tests only |
| Error handling | Console output is fine |
| Security | Don't store real secrets |
| Documentation | README with setup steps |
| Performance | Ignore unless broken |
| Code review | Optional |
| Infrastructure | Local dev only |
