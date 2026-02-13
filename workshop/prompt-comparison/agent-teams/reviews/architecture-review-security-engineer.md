<!-- This project was developed with assistance from AI tools. -->

# Architecture Review -- Security Engineer

**Reviewer:** Security Engineer
**Artifact:** plans/architecture.md
**Date:** 2026-02-12

## Verdict: APPROVE

The architecture document addresses every critical and warning finding from my Phase 2 product plan review. The authentication model uses server-side role resolution (ADR-002), data-at-rest encryption is specified with Fernet for PII fields and MinIO SSE for documents (Security Architecture section), PII redaction is mandatory from Phase 2 (the first LLM-calling phase), audit trail immutability uses a three-layer enforcement model (database permissions, trigger guard, hash chaining), document upload security covers all OWASP secure upload requirements, and the intake agent is architecturally sandboxed from application data (ADR-006). No critical security gaps remain. The findings below are warnings and suggestions for refinement during Technical Design.

---

## Findings

### Warning

#### S-W1. bcrypt for API Key Hashing May Not Be the Optimal Choice

**Category:** OWASP A02 -- Cryptographic Failures
**Location:** Authentication and Authorization section (line 666), Data Architecture section (line 384)

The architecture specifies bcrypt for API key hashing (`key_hash: VARCHAR(128) NOT NULL -- bcrypt hash of the API key`). bcrypt is designed for password hashing -- it is intentionally slow to resist brute-force attacks on low-entropy human-chosen passwords. API keys, however, are high-entropy random strings (typically 32+ bytes). For high-entropy secrets, a fast hash like SHA-256 (or HMAC-SHA-256 with a server-side secret) is sufficient and significantly reduces latency on every authenticated request, since bcrypt's cost function runs on every key lookup.

This is not a vulnerability -- bcrypt is never wrong for hashing secrets. It is a performance concern: if the API handles many authenticated requests per second, the bcrypt verification cost per request may become noticeable (typically 50-200ms depending on cost factor).

**Impact:** Elevated latency on every authenticated API call, proportional to bcrypt's cost factor. Functionally correct but suboptimal for high-entropy keys.

**Recommendation:** During Technical Design, evaluate whether HMAC-SHA-256 (with a server-side HMAC key from the environment) is a better fit for API key verification. If bcrypt is retained, document the performance trade-off and set the cost factor appropriately for the expected request rate.

---

#### S-W2. Fernet Key Rotation Strategy Has a Gap for Long-Lived Records

**Category:** OWASP A02 -- Cryptographic Failures
**Location:** Security Architecture > Data-at-Rest Encryption (line 711)

The architecture specifies: "Key rotation strategy: encrypt new records with new key, lazy-decrypt-and-re-encrypt old records on read." This is a reasonable MVP approach, but it has a gap: records that are never read after a key rotation remain encrypted with the old key indefinitely. For a loan application that was denied and archived, the old key must be retained forever or the data becomes unrecoverable.

Additionally, the architecture specifies a single `ENCRYPTION_KEY` environment variable. Key rotation requires either supporting multiple keys simultaneously (a key ring with a "current" key for encryption and all previous keys for decryption) or a batch migration job.

**Impact:** Either old encryption keys must be retained indefinitely (expanding the key management scope) or a batch re-encryption job is needed (not described). For MVP this is acceptable, but the Technical Design should specify the key ring approach.

**Recommendation:** The Technical Design should specify: (a) a key ring approach where the encryption service tries the current key first, then falls back to previous keys for decryption, (b) an identifier in the encrypted field indicating which key version was used (e.g., a key version prefix on the ciphertext), and (c) an optional batch re-encryption command for operational key rotation. Fernet's token format includes a timestamp but not a key identifier, so the application layer needs to manage this.

---

#### S-W3. Redis Fallback to In-Memory Rate Limiting Weakens Public Tier Protection

**Category:** OWASP A04 -- Insecure Design
**Location:** Caching Strategy > Graceful degradation (lines 788-792)

The architecture specifies that when Redis is unavailable, "Rate limiting falls back to in-memory counters (not distributed, but functional for single-instance MVP)." While this is pragmatic for MVP, it creates a security gap:

1. In-memory counters reset on application restart, meaning an attacker can bypass rate limits by timing requests around restarts.
2. The architecture also states "Chat sessions fail to create (intake agent unavailable until Redis recovers)" -- which means the intake agent is offline but the calculator and market data endpoints (also public, also rate-limited) remain available with weakened rate limiting.

For the public-facing endpoints that invoke LLMs, weakened rate limiting during Redis outages could result in uncontrolled LLM costs.

**Impact:** Rate limit bypass during Redis outages for public-tier endpoints. LLM cost exposure if LLM-invoking endpoints (chat) fall back to in-memory rate limiting. The current architecture mitigates this for chat (chat is unavailable without Redis), but does not address whether property data lookups or other potentially costly endpoints also degrade.

**Recommendation:** During Technical Design, specify which public-tier endpoints should fail closed (return 503) when Redis is unavailable versus which can operate with in-memory rate limiting. LLM-invoking endpoints should fail closed rather than fall back to weaker rate limiting.

---

#### S-W4. Hash Chain Verification Is Write-Time Only -- No Runtime Validation Specified

**Category:** OWASP A08 -- Data Integrity Failures
**Location:** Security Architecture > Audit Trail Integrity (lines 756-762)

The architecture describes a three-layer audit immutability model including hash chaining: "Each audit event includes `prev_event_hash` containing SHA-256 of the previous event's `(id, application_id, event_type, created_at, prev_event_hash)`." The hash is computed on write. However, the architecture does not specify when or how the hash chain is validated (verified).

Hash chaining provides tamper detection, but only if someone actually checks the chain. Without a specified validation trigger, the chain could be broken by a direct database modification and no one would know until a manual audit.

**Impact:** Tampered audit records could go undetected if the hash chain is never validated. The hash chain provides evidence for forensic review but not real-time integrity monitoring.

**Recommendation:** The Technical Design should specify: (a) hash chain validation on audit trail export (the export endpoint in Phase 5 should verify the chain before generating the export), (b) optionally, a background job that periodically validates the chain and alerts on breaks. This does not need to be Phase 1 -- the write-time hash recording is correct from day one -- but the validation mechanism should be specified for Phase 5.

---

### Suggestion

#### S-S1. Content-Type Validation for Document Uploads Should Include Magic Byte Verification

**Category:** OWASP A03 -- Injection
**Location:** Security Architecture > Document Upload Security (lines 729-734)

The architecture specifies "Server-side MIME type validation against allowlist" and "Validate PDF structure / image headers before processing. Reject polyglot files." This is good, but the Technical Design should be explicit that MIME type validation means checking the file's magic bytes (file signature), not the `Content-Type` header from the HTTP request (which is client-controlled and trivially spoofed).

The "Validate PDF structure / image headers" requirement implicitly covers this, but it would be clearer to state: "MIME type is determined by inspecting file content (magic bytes), not by trusting the HTTP Content-Type header or file extension."

**Recommendation:** Clarify in the Technical Design that MIME type validation is content-based (magic bytes / file header inspection), not header-based. Python libraries like `python-magic` or manual header byte checks are appropriate. The current architecture text is not wrong, but implementers could interpret "MIME type validation" as checking the HTTP header.

---

#### S-S2. Intake Agent Tool Responses Should Be Treated as Untrusted Input

**Category:** OWASP A03 -- Injection
**Location:** Component Architecture > Intake Graph (lines 296-339)

The architecture specifies that the intake agent's tools include `fred_api_lookup`, `property_data_lookup`, and `knowledge_base_search`. The tool implementations make HTTP calls to external APIs or database queries and return results to the LLM agent.

When the intake agent receives tool results and formulates a response, the tool output is part of the LLM context. If an attacker can influence the data returned by a tool (e.g., a malicious knowledge base document, or a compromised external API response), they could inject instructions into the LLM context (indirect prompt injection).

This is a known limitation of tool-using LLM agents and there is no perfect mitigation, but the Technical Design should acknowledge the risk and specify that: (a) knowledge base documents are admin-uploaded only (not user-submitted), (b) external API responses are validated and truncated before being passed as tool results, and (c) the intake agent's system prompt includes instructions to ignore instructions embedded in tool results.

**Impact:** Indirect prompt injection via malicious tool results could cause the intake agent to produce incorrect financial guidance or reveal system prompt details.

**Recommendation:** The Technical Design should specify input validation and length limits on tool result payloads before they are injected into the LLM context. Knowledge base content should be treated as semi-trusted (admin-curated) but external API responses should be strictly validated.

---

#### S-S3. AuthContext Should Include Request Timestamp for Audit Correlation

**Category:** OWASP A09 -- Logging and Monitoring Failures
**Location:** Authentication and Authorization > Auth Context Propagation (lines 686-694)

The `AuthContext` dataclass contains `key_id`, `role`, and `correlation_id`. Consider adding `authenticated_at: datetime` to capture the timestamp when authentication was performed. This is useful for:

1. Detecting clock skew between the auth event and the audit event recording.
2. Correlating auth events across services if the system scales beyond a single instance.
3. Detecting replay attacks if the same correlation ID appears with different auth timestamps.

**Impact:** Minor. The `created_at` on audit events partially covers this, but having the auth timestamp in the context is more precise.

**Recommendation:** Add `authenticated_at` to `AuthContext` during Technical Design. Low effort, minor improvement.

---

#### S-S4. compose.yml MinIO Default Credentials Should Be Flagged in Documentation

**Category:** OWASP A05 -- Security Misconfiguration
**Location:** Deployment Architecture > Local Development (lines 912-913)

The architecture shows `MINIO_ROOT_USER: minioadmin` and `MINIO_ROOT_PASSWORD: minioadmin` in the compose file. This is standard for local development, but the architecture should note that the production credential hard-fail check (described for API keys in the Authentication section) should also apply to MinIO credentials. If `ENVIRONMENT=production` and MinIO credentials are `minioadmin/minioadmin`, the system should refuse to start.

**Impact:** Default MinIO credentials in a deployed environment would allow unauthenticated access to all uploaded loan documents (tax returns, pay stubs, bank statements).

**Recommendation:** Extend the production credential hard-fail check to cover MinIO, Redis, and PostgreSQL default credentials, not just API keys. The architecture mentions this check for API keys only (line 674). The Technical Design should enumerate all credential sources that are validated at startup.

---

#### S-S5. LLM API Keys Should Be Scoped to Minimum Required Permissions

**Category:** OWASP A01 -- Broken Access Control
**Location:** Environment Configuration (lines 960-961)

The architecture requires `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` as environment variables. These are third-party API keys with potential billing implications. The Technical Design should specify:

1. API keys should be scoped to the minimum required model access (e.g., if only Claude Sonnet is needed, do not use a key with access to more expensive models).
2. API keys should have spend limits configured at the provider level.
3. The application should log LLM API call costs (via LangFuse) and alert if costs exceed expected thresholds.

This is not an architecture-level concern per se, but it is an operational security consideration that the Technical Design should document.

**Impact:** Unrestricted LLM API keys could result in unexpected costs if the application is misconfigured or if a public-tier endpoint is abused.

**Recommendation:** Document API key scoping and spend limit configuration as part of the deployment guide. Not a code change -- an operational checklist item.

---

### Positive

#### S-P1. Server-Side Role Resolution Eliminates Privilege Escalation (ADR-002)

**Location:** Authentication and Authorization (lines 648-662), ADR-002 (lines 1089-1094)

My product plan review C1 flagged the `Bearer <role>:<key>` format as a privilege escalation vector because the role was client-asserted. The architecture resolves this comprehensively: "the role prefix is a routing hint only. The server resolves the authoritative role from the key alone." Client-supplied role mismatches are logged at `warn` level but the database role is always used. This is the correct design -- it eliminates the escalation vector while preserving the mandated token format and developer ergonomics. The explicit statement that "The client-supplied role prefix is never used for authorization decisions" (line 657) removes all ambiguity.

---

#### S-P2. Three-Layer Audit Immutability Is Defense-in-Depth Done Right

**Location:** Security Architecture > Audit Trail Integrity (lines 756-762), ADR-003 (lines 1096-1102)

My product plan review W5 flagged that "append-only" at the application layer alone is insufficient. The architecture addresses this with three independent enforcement layers: (1) a dedicated `audit_writer` PostgreSQL role with INSERT-only privileges, (2) a `BEFORE UPDATE OR DELETE` trigger that raises an exception, and (3) hash chaining for tamper detection. Any single layer could fail (misconfigured pool, dropped trigger, compromised app) and the other two layers still protect the audit trail. This is textbook defense-in-depth and exceeds what I expected for an MVP. Delivering this in Phase 1 (ADR-003) means all events are protected from day one.

---

#### S-P3. Intake Agent Sandboxing Is Architectural, Not Runtime

**Location:** Component Architecture > Intake Graph (lines 296-330), Security Architecture > Public Tier Sandboxing (lines 738-752), ADR-006 (lines 1120-1127)

My product plan review W2 flagged that the intake agent's blast radius was unbounded. The architecture addresses this with architectural isolation: the intake graph is a separate LangGraph instance with an explicit tool allowlist (calculator, FRED, property data, knowledge base search) and "no code path from the intake graph to application data." The isolation is enforced by the graph's tool definitions and connection pool scoping (RAG schema only), not by runtime permission checks that could be bypassed. This is the strongest form of sandboxing short of process-level isolation. The explicit enumeration of what the intake agent CAN and CANNOT access (lines 740-751) leaves no ambiguity for implementers.

---

#### S-P4. Document Upload Security Covers All OWASP Secure Upload Requirements

**Location:** Security Architecture > Document Upload Security (lines 728-734)

My product plan review W6 flagged missing file type validation, size limits, filename sanitization, and content validation. The architecture addresses all four: MIME type allowlist (`application/pdf`, `image/jpeg`, `image/png`, `image/tiff`), 20MB size limit, filename sanitization (strip path components, replace non-alphanumeric, truncate, store with UUID key), and content validation (PDF structure / image header validation, polyglot rejection). UUID-based storage keys in MinIO eliminate path traversal entirely. This is a complete response to the finding.

---

#### S-P5. PII Redaction Is a Required Dependency, Not an Optional Step

**Location:** Security Architecture > PII Redaction Pipeline (lines 715-724), Phased Implementation > Phase 2 (lines 997-998)

My product plan review W1 flagged the contradiction between PII redaction being P1 and the security requirement that PII be redacted before LLM calls. The architecture resolves this by making the PII redaction service "a required dependency for all agent nodes in the loan processing graph. Agents that skip redaction fail the code review checklist." Operational from Phase 2 (the first phase with real LLM calls). This is the correct design -- redaction is not optional, it is infrastructure.

---

#### S-P6. SSRF Prevention Is Addressed at the Architecture Level

**Location:** Security Architecture > External API Security (lines 764-766)

My product plan review S4 flagged SSRF risk in external data integrations. The architecture addresses this: "All external API URLs are configured via environment variables and validated at startup. User-supplied data is passed as query parameters to known-good base URLs, never concatenated into URL paths or used to construct arbitrary URLs." This eliminates the primary SSRF vector for this application.

---

#### S-P7. Production Credential Hard-Fail Is Specified

**Location:** Authentication and Authorization > Production Credential Safety (lines 672-674)

My product plan review W3 requested that the system refuse to start in production mode with default credentials (not just log a warning). The architecture specifies exactly this: "The system refuses to start in production mode (`ENVIRONMENT=production`) if default/seed credentials are detected. This is a hard fail (process exits with error), not a warning log." Seed keys have 24-hour TTL as an additional safeguard.

---

## OWASP Top 10 Coverage Assessment

| OWASP Category | Architecture Coverage | Residual Risk |
|---|---|---|
| A01: Broken Access Control | Server-side role resolution (ADR-002), hierarchical RBAC, `require_role(minimum_role)` dependency, review queue role-based filtering | Low. Role resolution is correct. Review queue filtering prevents data leakage across roles. |
| A02: Cryptographic Failures | Fernet encryption for PII fields, MinIO SSE, Redis scoped to non-PII, bcrypt for key hashing | Low. Key rotation strategy needs Technical Design refinement (S-W2). bcrypt vs. HMAC trade-off for keys (S-W1). |
| A03: Injection | PII redaction pipeline, document upload validation (MIME, size, content, filename), intake agent sandboxing, parameterized queries (SQLAlchemy ORM) | Low. Indirect prompt injection via tool results is a residual risk for any tool-using LLM agent (S-S2). |
| A04: Insecure Design | Human-in-the-loop for conflicts, confidence-based escalation, fraud flags force review, configurable thresholds | Low. Redis fallback weakens rate limiting (S-W3). |
| A05: Security Misconfiguration | Production credential hard-fail, 24h seed key TTL, environment-based configuration | Low. Hard-fail check should extend to MinIO/Redis/PostgreSQL defaults (S-S4). |
| A06: Vulnerable Components | Dependency scanning in CI (Phase 5), pinned versions in lock files | Low at architecture level. Implementation must enforce. |
| A07: Authentication Failures | bcrypt key hashing, configurable TTL (90 days protected, 24h dev), revocation, creation/revocation audited | Low. No session-based auth needed for API key model. |
| A08: Data Integrity Failures | Three-layer audit immutability (DB permissions + trigger + hash chain), append-only schema design (no `updated_at` on audit tables) | Low. Hash chain validation timing not specified (S-W4). |
| A09: Logging Failures | Structured JSON logging, PII masking, correlation ID propagation, LangFuse tracing | Low. AuthContext timestamp suggestion (S-S3) is minor. |
| A10: SSRF | Environment-variable-only URLs, user data as query parameters only, startup URL validation | Low. Architecture-level mitigation is correct. |

---

## Traceability: Product Plan Review Findings to Architecture Resolution

| Product Plan Finding | Architecture Resolution | Status |
|---|---|---|
| C1: Privilege escalation via client-asserted role | Server-side role resolution, client role ignored for auth (ADR-002, lines 648-662) | **Resolved** |
| C2: No data-at-rest encryption specified | Fernet for PII fields, MinIO SSE, Redis scoped to non-PII (lines 700-711) | **Resolved** |
| W1: PII redaction timing contradiction | Redaction mandatory from Phase 2, required dependency for all agents (lines 715-724) | **Resolved** |
| W2: Intake agent blast radius unbounded | Architectural sandboxing with explicit tool allowlist and no application data access (ADR-006, lines 738-752) | **Resolved** |
| W3: Default credentials in production | Hard-fail on startup with default credentials (lines 672-674) | **Resolved** |
| W4: Review queue saturation | Not directly addressed in architecture. Acceptable -- this is an operational concern for Technical Design, not an architecture gap. | **Deferred to TD** |
| W5: Audit trail immutability enforcement unspecified | Three-layer enforcement: DB permissions + trigger + hash chain (lines 756-762) | **Resolved** |
| W6: Document upload security missing | Complete coverage: MIME allowlist, 20MB limit, filename sanitization, content validation, UUID storage (lines 728-734) | **Resolved** |
| S1: Rate limiting scope undefined | Per-IP public, per-key protected, separate limits for LLM-invoking endpoints (line 172) | **Resolved** |
| S2: Cross-session context PII implications | 24h TTL, conversation summaries not raw transcripts, PII redacted before storage (lines 329-330) | **Resolved** |
| S3: Threshold configuration authorization | Restricted to `reviewer` role (line 592). Safety floor and confirmation step deferred to TD. | **Partially resolved** |
| S4: SSRF risk in external integrations | Environment-variable-only URLs, user data as query parameters only (lines 764-766) | **Resolved** |
| S5: Input validation scope | LLM output validated before DB insertion (agent pattern step 5, line 280). External API responses handled via Protocol pattern. | **Resolved** |

---

## Cross-References from Teammate Reviews

No teammate reviews were available at the time of this review. Cross-references will be provided if teammate reviews surface findings that overlap with or contradict the findings above.

---

## Phase-by-Phase Security Posture Assessment

| Phase | Security Capabilities Delivered | Security Posture |
|---|---|---|
| Phase 1 | Auth middleware (key resolver + role asserter + audit injector), audit event recording with three-layer immutability, production credential hard-fail, structured logging with PII masking, correlation IDs, health endpoints | **Adequate.** All security infrastructure is foundational. No LLM calls yet, so no PII redaction needed. |
| Phase 2 | PII redaction service (mandatory for all agents), document upload security (MIME, size, filename, content validation), MinIO SSE, Fernet encryption for PII fields, LangFuse tracing | **Adequate.** PII protection is operational from the first LLM call. Document upload hardened before first upload. |
| Phase 3a | RAG connection pool isolation, knowledge base (admin-curated), parallel agent execution with conflict detection | **Adequate.** Schema isolation prevents RAG workload from accessing application data. Conflict detection escalates to humans. |
| Phase 3b | Intake agent sandboxing (separate graph, explicit tool allowlist, no app data access), Redis rate limiting (per-IP public, per-key protected, separate LLM limits), SSE streaming | **Adequate.** Public-facing agent has the strongest isolation pattern in the system. Rate limiting operational before public launch. |
| Phase 4 | Fraud detection (forces human review), cyclic resubmission (full pipeline re-run) | **Adequate.** Fraud flags add a safety layer. Re-run goes through full pipeline including PII redaction. |
| Phase 5 | Audit trail export (should validate hash chain), compliance reporting, knowledge base management, cross-session context (PII redacted, 24h TTL), containerization, CI with security scanning | **Adequate.** Hash chain validation on export is recommended (S-W4). CI security scanning closes the dependency vulnerability gap. |

---

## Scope Discipline Check

The architecture stays within its lane. It defines component boundaries, data flow patterns, security mechanisms, and phasing without:
- Making product scope changes (all features trace to the product plan)
- Specifying detailed API contracts (endpoint groups and patterns are described, but JSON shapes and specific request/response formats are deferred to the API Designer)
- Prescribing implementation details (e.g., specific Pydantic model fields, exact LangGraph node implementations)

The architecture makes appropriate forward references to the Technical Design for decisions that require more detail (Open Questions section, lines 1150-1167).

---

## Summary

This architecture document is a strong security design for an MVP in a regulated financial domain. All six critical and warning findings from my product plan review have been resolved with concrete, well-specified mechanisms. The server-side role resolution (ADR-002) eliminates the privilege escalation vector. The three-layer audit immutability model exceeds typical MVP security posture. The intake agent sandboxing is architectural rather than runtime, which is the strongest form available within a monolith. PII redaction is a mandatory dependency rather than an optional step. Document upload security covers all standard OWASP requirements.

The four warnings in this review are refinements for the Technical Design phase: bcrypt vs. HMAC for API key hashing (S-W1), Fernet key rotation key ring approach (S-W2), Redis fallback behavior for rate limiting (S-W3), and hash chain validation timing (S-W4). None of these are architecture-level blockers. The five suggestions are implementation-level improvements that should be addressed during Technical Design but do not affect the architecture's security posture.

Verdict: **APPROVE**. Proceed to Technical Design with the warnings and suggestions above incorporated into the TD's security requirements.
