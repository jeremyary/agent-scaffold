# This project was developed with assistance from AI tools.
# Security Review Checklist by Phase

Per-phase security review items. Each phase's TD review gate should verify these items are addressed in the design. Items are cumulative -- later phases inherit earlier phase requirements.

## Phase 1: Foundation

Covered by the Phase 1 TD review. Key controls established:
- [x] Three-layer RBAC (API middleware, domain service, agent tool auth)
- [x] JWT validation with all critical checks (sig, aud, iss, exp)
- [x] PKCE for public SPA client
- [x] HMDA isolation (dual schema, dual roles, CI lint, demographic filter)
- [x] Audit trail immutability (role grants, triggers, hash chain, advisory locks)
- [x] Database-enforced role separation (lending_app, compliance_app)

## Phase 2: Borrower Experience

Focus areas: document upload, chat input, agent prompt injection, cross-session memory.

| Check | What to Verify |
|-------|---------------|
| Document upload validation | File type allowlist, size limits, magic byte verification (not just extension) |
| Document storage | Files stored outside webroot, served via signed URLs with expiration |
| Chat input sanitization | User messages sanitized before inclusion in agent prompts |
| Prompt injection resistance | Agent system prompts tested against common injection patterns (ignore previous instructions, role override, data exfiltration attempts) |
| Cross-session memory isolation | User A cannot access User B's conversation history or memory |
| WebSocket authentication | WS connections require valid JWT, re-validated on token refresh |
| Tool authorization config-driven | TOOL_AUTHORIZATION loaded from config/agents/*.yaml, not hardcoded (see ideas backlog SE-W7) |
| PII in conversation logs | Conversation content with PII must follow same masking rules as API responses |

## Phase 3: Loan Officer and Underwriter

Focus areas: pipeline data access, compliance queries, decision traceability.

| Check | What to Verify |
|-------|---------------|
| Pipeline data boundaries | Loan officers see only assigned applications; underwriters see only their queue |
| Compliance knowledge base access | Compliance queries do not leak HMDA demographic data into responses |
| Decision override audit | Every underwriter override (approve despite AI recommendation, or vice versa) is logged with rationale |
| Document access control | Users can only access documents for applications in their scope |
| Conditions workflow | Condition requests and fulfillments are tamper-evident in audit trail |

## Phase 4a: Advanced Personas (UW/Compliance/CEO)

Focus areas: fairness metrics, executive data access, model monitoring.

| Check | What to Verify |
|-------|---------------|
| TrustyAI fairness metrics | SPD/DIR calculations use only HMDA-schema data via compliance_app role |
| CEO PII masking | CEO sees aggregated data only; SSN, DOB, account numbers masked in all responses |
| CEO document access | 403 on individual borrower documents per REQ-CC-03 |
| Model monitoring data | LangFuse metrics do not contain PII from user conversations |
| Semantic demographic filter | Phase 2+ upgrade from keyword-only to semantic similarity detection (see ideas backlog SE-W1) |

## Phase 4b: Container Platform Deployment

Focus areas: production secrets, network security, rate limiting.

| Check | What to Verify |
|-------|---------------|
| Secrets management | All credentials via environment variables or secrets manager; no hardcoded values |
| Database role passwords | Strong, randomly generated passwords for all DB roles |
| HTTPS enforcement | HSTS headers, TLS certificates validated, Secure/HttpOnly/SameSite cookie flags |
| Rate limiting | Authentication endpoints rate-limited (see ideas backlog SE-W6) |
| Error response sanitization | All user-facing errors are generic; implementation details only in logs |
| Security headers | CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| Dependency scanning | Container images scanned for CVEs; dependency audit in CI |
| Network policies | Inter-service communication restricted to required paths only |
| Log access control | Application logs containing debug info are not accessible to unauthenticated users |

## How to Use

1. During TD review for each phase, the Security Engineer reviewer should check all items for the current phase and all prior phases
2. Items marked with cross-references to the ideas backlog should be verified against the backlog entry for current status
3. New security concerns discovered during review should be added to this checklist for the appropriate phase
4. This checklist supplements, not replaces, the two-agent review requirement in `review-governance.md`
