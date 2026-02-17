# Consolidated Review: Architecture

**Reviews consolidated:** architecture-review-code-reviewer.md, architecture-review-security-engineer.md, architecture-review-orchestrator.md
**Date:** 2026-02-16
**Verdicts:** Code Reviewer: APPROVE, Security Engineer: REQUEST_CHANGES, Orchestrator: APPROVE

## Summary

- Total findings across all reviews: 34
- De-duplicated findings: 23
- Reviewer disagreements: 1
- Breakdown: 3 Critical, 8 Warning, 8 Suggestion, 4 Positive

## Triage Required

### Critical (must fix before proceeding)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| C-1 | PostgreSQL role grants for HMDA schema isolation not specified -- without distinct database roles, schema separation is convention not enforcement; a single connection could query both schemas | Security Engineer (SEC-A1), Orchestrator (O-02 related) | Section 3.3, ADR-0001 | Define at least two PostgreSQL roles: `lending_app` (no HMDA grants) and `compliance_app` (HMDA + lending read). Specify role-to-service mapping. Address how role separation works in a monolithic process (separate connection pools). Include verification command. | **Fix** |
| C-2 | Tool authorization re-verification timing in LangGraph is ambiguous -- unclear if checks happen per-tool-call or at graph initialization; cached authorization could miss mid-session role changes | Security Engineer (SEC-A2) | Section 2.3, Section 4.3, ADR-0005 | Specify that tool auth check is a LangGraph pre-tool node executing immediately before each invocation. Clarify role check mechanism (JWT claims with known staleness vs. Keycloak round-trip). State explicitly that auth results are NOT cached across turns. Specify error handling on auth failure. | **Fix** |
| C-3 | CEO document access enforcement mechanism underspecified -- "metadata only" is stated but enforcement layer (API, service, query, storage) is not specified, creating bypass risk | Security Engineer (SEC-A5) | Section 2.1, Section 4.2 | Specify multi-layer enforcement: API endpoint returns 403 for CEO, service method raises exception, query layer excludes content columns. Clarify audit trail document linking respects same access rules. | **Fix** |

### Warning (should fix)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| W-1 | Monolith internal module boundaries lack enforcement -- Python imports don't prevent cross-service access; HMDA schema access could leak via developer shortcut | Code Reviewer (CR-A01), Orchestrator (O-02 related) | Section 8.1 | Acknowledge Python module boundaries are convention. Add mitigation: CI grep check for `hmda` schema references outside Compliance Service (already mentioned as verification in 3.3, formalize as CI step). | **Fix** |
| W-2 | Hash chain serial insertion creates undocumented failure mode -- concurrent async inserts could fork the chain causing false tamper detections | Code Reviewer (CR-A02), Orchestrator (O-04 related) | Section 3.4, ADR-0006 | State concurrency strategy: PostgreSQL advisory lock (simple at PoC scale), or accept possible gaps and verify accordingly. Note hash chain is PoC-specific, would be replaced (not upgraded) for production. | **Fix** |
| W-3 | No graceful degradation for optional Docker Compose services -- unclear which of 9 containers are required vs. optional | Code Reviewer (CR-A03) | Section 7.2 | Add degradation table: required (PostgreSQL, Keycloak, API, Frontend) vs. optional (LangFuse stack, LlamaStack if using remote). Note behavior when optional services are absent. | **Fix** |
| W-4 | Output filtering vulnerable to semantic leakage -- pattern matching catches explicit PII/HMDA but not proxy demographic references or semantic PII | Security Engineer (SEC-A3) | Section 2.3, ADR-0005 | Extend output filtering to include semantic checks for demographic proxies. Harden agent prompts to refuse neighborhood-level demographic analysis. Add semantic leakage test cases. Note limitation at PoC maturity. | **Fix** |
| W-5 | Memory isolation SQL injection and ORM bypass risks not addressed -- user_id filtering could be bypassed via injection or eager-loading | Security Engineer (SEC-A4) | Section 3.5 | Specify parameterized queries for all checkpoint access. Add defense-in-depth post-retrieval user_id verification. Specify ORM configuration to prevent eager-loading across users. | **Fix** |
| W-6 | Keycloak token validation details missing -- token lifetime, refresh rotation, JWKS caching, fail-closed behavior, WebSocket re-validation not specified | Security Engineer (SEC-A6) | Section 4.1 | Specify token lifetime (e.g., 15min access, 8hr refresh), refresh rotation, JWKS cache duration, fail-closed on IdP unavailability, WebSocket re-validation on every message. | **Fix** |
| W-7 | Demographic data filter in document extraction relies on LLM detection with false negative risk | Security Engineer (SEC-A7) | Section 2.5 | Specify detection mechanism (keyword + semantic similarity). Add false negative mitigation (agent output filter as secondary defense). Add test cases with indirect demographic data. Note limitation at PoC maturity. | **Fix** |
| W-8 | WebSocket/SSE fallback strategy inconsistent between sections -- Section 2.1 mentions SSE fallback but Section 8.2 describes WebSocket-only protocol | Orchestrator (O-01) | Section 2.1, Section 8.2 | Commit to WebSocket-only for PoC. Note SSE as production upgrade path. Remove ambiguous "or SSE" reference. | **Fix** |

### Reviewer Disagreements

| # | Issue | Location | Reviewer A | Reviewer B | Disposition |
|---|-------|----------|-----------|-----------|-------------|
| D-1 | Compliance Service database role separation in a monolith | Section 3.3, ADR-0001 | Security Engineer: Critical (SEC-A1) -- role grants must be specified; without them schema isolation is unenforceable | Orchestrator: Warning (O-02) -- genuine ambiguity but resolvable at TD phase | **Resolved -- Security Engineer severity (Critical) accepted; C-1 disposition is Fix. Separate connection pools in the monolith.** |

### Suggestions (improve if approved)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| S-1 | WebSocket reconnection and error recovery not addressed despite chat being primary interaction mode | Code Reviewer (CR-A04) | Section 8.2 | Add boundary-level note on reconnection strategy: auto-reconnect, recover from checkpoint, send last known event ID. | **Improvement** |
| S-2 | HMDA schema isolation verification should be formalized as CI check, not one-time verification | Code Reviewer (CR-A05) | Section 3.3 | Elevate grep check to CI requirement: "no code outside services/compliance/ references the hmda schema." | **Fix** |
| S-3 | Test directory structure for integration/e2e tests not specified in project layout | Code Reviewer (CR-A06) | Section 10 | Add tests/integration/ and tests/e2e/ to project structure. | **Improvement** |
| S-4 | Compliance Service dual-schema bridging needs explicit interface constraint -- only aggregate results exposed, never individual-level joins | Code Reviewer (CR-A07) | Section 2.4, ADR-0001 | Add note: Compliance Service exposes only pre-aggregated statistics; no API returns individual HMDA records joined with lending decisions. | **Improvement** |
| S-5 | Async document processing notification path ambiguous -- "via WebSocket or polling" leaves frontend/backend contract undefined | Orchestrator (O-03) | Section 2.5, Section 8.3 | Pick polling for PoC (document status endpoint). Chat can also surface results on next user interaction. | **Fix** |
| S-6 | Analytics materialized view refresh strategy unspecified -- standard views likely sufficient at PoC scale | Orchestrator (O-05) | Section 3.2 | Clarify standard views preferred at PoC; materialized views as production optimization. | **Improvement** |
| S-7 | OQ-A5 (compliance KB content review timeline) is a project management concern, not an architecture question | Orchestrator (O-06) | Section 12 | Keep dependency note in architecture; move detailed timeline analysis to project-level note. | **Improvement** |
| S-8 | Keycloak database dependency ambiguous -- shared PostgreSQL vs. embedded H2 not decided | Orchestrator (O-10) | Section 7.2, ADR-0007 | State explicitly: embedded H2 with realm import for PoC (self-contained, avoids sharing application PostgreSQL). | **Fix** |

### Not Included (addressable in Technical Design, no architecture change needed)

- **Security Engineer SEC-A8:** Audit hash chain vulnerable to recomputation -- acknowledged limitation at PoC maturity; upgrade path documented
- **Security Engineer SEC-A9:** Input validation pattern matching limitations -- multi-layer defense compensates; production upgrade to ML-based detection noted
- **Security Engineer SEC-A10:** RBAC adversarial test suite not specified -- appropriate for Technical Design / test planning, not architecture

### Positive (no action needed)

- HMDA four-stage isolation is enforced with exceptional consistency across every section -- no gaps found -- Code Reviewer (CR-A09), Security Engineer (SEC-A12), Orchestrator (O-07)
- Configuration-driven agent definitions (YAML for prompts, tools, scopes, routing) make extensibility claims credible and testable -- Code Reviewer (CR-A08), Orchestrator (O-08)
- Four-layer agent security provides strong defense in depth with independently testable layers -- Security Engineer (SEC-A11), Code Reviewer (CR-A10)
- Database-level audit enforcement (role grants + triggers) is stronger than application-level promises -- Security Engineer (SEC-A13)
- All seven ADRs cross-reference correctly and tell a coherent, non-contradictory story -- Orchestrator (O-09)
- Dual-data-path ASCII diagram makes HMDA isolation immediately comprehensible -- Code Reviewer (CR-A11)
