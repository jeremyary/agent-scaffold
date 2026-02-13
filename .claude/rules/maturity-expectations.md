# Maturity Expectations

Maturity level governs **implementation quality** — test coverage, error handling depth, documentation thoroughness, infrastructure complexity. It does **not** govern **workflow phases**. A PoC still follows the full plan-review-build-verify sequence when SDD criteria are met (see `workflow-patterns` skill). The artifacts may be lighter, but they are not skipped.

| Concern | Proof-of-Concept | MVP | Production |
|---------|-------------------|-----|------------|
| Testing | Smoke tests only | Happy path + critical edges | Full coverage targets (80%+) |
| Error handling | Console output is fine | Basic error responses | Structured errors, monitoring, alerting |
| Security | Don't store real secrets | Auth + input validation | Full OWASP audit, dependency scanning, threat model |
| Documentation | README with setup steps | README + API basics | Full docs suite, ADRs, runbooks |
| Performance | Ignore unless broken | Profile obvious bottlenecks | Load testing, SLOs, optimization |
| Code review | Optional | Light review | Full review + security audit gate |
| Infrastructure | Local dev only | Basic CI + single deploy target | Full CI/CD, staging, monitoring, IaC |
