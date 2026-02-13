<!-- This project was developed with assistance from AI tools. -->

# Product Plan Review -- Security Engineer

**Reviewer:** Security Engineer
**Artifact:** plans/product-plan.md
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

Two critical findings related to the authentication model and data-at-rest encryption must be resolved before the technical design phase can proceed with clear security requirements. The remaining findings are warnings and suggestions that should be addressed but do not block.

---

## Findings

### Critical

#### C1. API Key Bearer Token Authentication is Insufficient for PII-Bearing Endpoints

**Category:** OWASP A07 -- Authentication Failures
**Location:** "Security Considerations > Access Tiers" and "Stakeholder-Mandated Constraints" (`Authorization: Bearer <role>:<key>` format)

The product plan mandates `Authorization: Bearer <role>:<key>` as the authentication scheme. This format embeds the role in the token itself, which means:

1. **Role is client-asserted, not server-verified.** Unless the server maintains a mapping of keys to roles (which is not specified), any holder of a valid key can claim any role by changing the role prefix. This is a privilege escalation vector.
2. **Static API keys cannot be rotated per-session or revoked individually** without a key management system, which is not described.
3. **API keys transmitted in headers are logged by many HTTP proxies, load balancers, and observability tools by default.** For a system handling SSNs, financial records, and credit data, credential leakage through infrastructure logging is a realistic risk.
4. **No session expiry.** Static API keys do not expire, violating the security baseline rule requiring "short-lived tokens with refresh rotation" (`.claude/rules/security.md`).

The plan states this is an MVP with "real authentication from day one" and "not mocked, not deferred," but API key auth for a system processing PII does not meet that bar. The gap is not that it needs to be OAuth2 -- it is that the plan does not specify how keys map to roles server-side, how keys are rotated, or how session lifetime is managed.

**Impact:** Privilege escalation from `loan_officer` to `reviewer` role. Credential leakage through infrastructure logging. No mechanism for revocation if a key is compromised.

**Recommendation:** The plan must specify that (a) the server maintains the authoritative key-to-role mapping, (b) the role is never parsed from the client-supplied token, (c) keys have a configurable expiry or rotation policy even at MVP, and (d) the Architect addresses key storage and rotation in the technical design. If the `<role>:<key>` format is retained for developer convenience, clarify that the role prefix is informational only and the server resolves role from the key alone.

---

#### C2. No Data-at-Rest Encryption Requirements Specified

**Category:** OWASP A02 -- Cryptographic Failures
**Location:** "Non-Functional Requirements > Security" and "Security Considerations > PII Handling"

The plan states: "PII (SSN, financial account numbers) is protected at rest and never appears in logs." However, "protected at rest" is the only mention of data-at-rest protections, and it lacks specificity:

1. **Database encryption.** No requirement for PostgreSQL transparent data encryption or column-level encryption for PII fields (SSN, account numbers, government IDs).
2. **Object storage encryption.** Uploaded loan documents (stored in MinIO) contain highly sensitive data -- tax returns, pay stubs, bank statements. No encryption-at-rest requirement is stated for object storage.
3. **Cache encryption.** Redis stores session data and potentially cached query results that may include PII. No encryption requirement for the cache layer.
4. **Backup encryption.** No mention of encrypted backups for any data store.

For a system that stores SSNs, financial account numbers, tax returns, and credit data, "protected at rest" is too vague for the Architect to design against.

**Impact:** PII exposure through database dumps, stolen storage volumes, unencrypted backups, or compromised cache instances.

**Recommendation:** Add explicit requirements: (a) column-level encryption or application-level encryption for SSN, account numbers, and government IDs in the database, (b) server-side encryption for object storage (MinIO supports SSE), (c) encryption requirements for Redis if PII transits through cache, (d) state that backup encryption requirements will be defined at production maturity. Even for MVP, the pattern should demonstrate encryption for the most sensitive fields.

---

### Warning

#### W1. PII Redaction Before LLM Calls is Underspecified

**Category:** OWASP A02 -- Cryptographic Failures / Data Protection
**Location:** "Should Have (P1)" -- "PII protection in LLM interactions" and "Security Considerations > PII Handling"

PII redaction before LLM API calls is listed as P1 (Should Have), but several P0 features depend on sending document content to LLM APIs (document extraction, credit analysis, compliance checking). This means P0 agents in Phase 2 will be sending document data to external LLMs before the PII redaction feature is implemented in Phase 2/3.

The plan says "Data sent to external LLM APIs has PII redacted before transmission" in the Security section (implying a hard requirement), but then lists PII protection as P1 in Phase 2. This is contradictory -- either redaction is required from the start of LLM usage, or P0 agents operate without it temporarily.

**Impact:** SSNs, account numbers, and other PII sent to external LLM providers during Phases 1-2 if redaction is deferred. This conflicts with the domain rules in `.claude/rules/domain.md` which state "LLM prompts must redact PII before sending to external model APIs."

**Recommendation:** Elevate PII redaction to P0 and include it in Phase 2 alongside the first real LLM-using agents, or explicitly state that Phase 2 agents must implement inline PII stripping even before the centralized PII protection feature exists. The domain rule in `.claude/rules/domain.md` makes this non-optional.

---

#### W2. Public Tier Prompt Injection Defenses are Mentioned but Not Bounded

**Category:** OWASP A03 -- Injection
**Location:** "Security Considerations > Access Tiers" -- "Prompt injection defenses for the conversational interface"

The plan correctly identifies prompt injection as a risk for the public intake agent. However, it does not specify:

1. What the intake agent should be prevented from doing (e.g., accessing loan application data, executing actions, revealing system prompts).
2. Whether the public agent has any access to the authenticated data layer at all, or is fully sandboxed.
3. What "prompt injection defenses" means concretely -- input filtering, output filtering, system prompt hardening, or a combination.

For a public-facing LLM interface in a financial system, the blast radius of successful prompt injection must be explicitly bounded.

**Impact:** If the intake agent has access to the application database or internal APIs, a prompt injection attack could exfiltrate PII or loan data. Even without data access, the agent could be manipulated to provide incorrect financial guidance, creating liability.

**Recommendation:** Add a requirement that the public intake agent operates in a sandboxed context with no access to the application database or authenticated API endpoints. Define the agent's permission boundary explicitly: what tools/data it can access (calculator, FRED API, property lookup, knowledge base) and what it cannot (application data, user records, audit trails). Require that the Architect designs the intake agent's LLM context with least-privilege access.

---

#### W3. Mock Authentication Leaking to Production Risk

**Category:** OWASP A05 -- Security Misconfiguration
**Location:** "Mocked vs. Real Services" and "Phase 1: Foundation"

The plan correctly states "Real authentication from day one" and includes a "startup warning if running with default credentials." However:

1. The plan does not specify what "default credentials" are or how they are provisioned. If seed data includes pre-configured API keys, those keys could persist into production deployments.
2. There is no requirement for the system to refuse to start (or operate in a degraded mode) if default credentials are detected in a non-development environment.
3. Other mocked services (credit bureau, email, property data) implement the same interface as real services. If the authentication mock similarly implements the same interface but with weaker security properties, swapping to a "real" auth provider could leave the weak mock properties in the configuration.

**Impact:** Default API keys shipped in seed data used in deployed environments. Mock auth behaviors (e.g., accepting any key format, skipping validation) persisting in misconfigured deployments.

**Recommendation:** Require that (a) the system refuses to start in production mode with default/seed credentials (not just a warning), (b) seed API keys are clearly marked and documented as development-only, (c) the Architect specifies the exact boundary between mock and real authentication behaviors.

---

#### W4. Agent Conflict Escalation Could Create Processing Bottleneck

**Category:** OWASP A04 -- Insecure Design
**Location:** "Security Considerations > Agent Conflict Resolution"

The plan states: "All agent conflicts (disagreements between agents on an application) escalate to human review. There is no automated tie-breaking." This is a sound security principle for a regulated domain, but the plan does not address:

1. **Denial of service via manufactured disagreements.** If an attacker can influence agent inputs (e.g., through crafted documents), they could systematically create agent disagreements, flooding the human review queue.
2. **Queue saturation.** No maximum queue depth or alerting is specified. If the review queue grows unbounded, reviewers could miss genuinely high-priority items buried among manufactured escalations.
3. **No timeout on review.** Applications in the review queue could sit indefinitely with no SLA or auto-escalation.

**Impact:** Human review queue overwhelmed by adversarial or edge-case inputs, causing legitimate applications to be delayed or missed.

**Recommendation:** Add requirements for (a) review queue monitoring and alerting when queue depth exceeds a threshold, (b) priority ordering in the queue (fraud flags higher than confidence disagreements), (c) a maximum review SLA or timeout with defined behavior (e.g., auto-escalate to senior underwriter after N hours). These do not need to be P0 features but should be documented as known risks with planned mitigations.

---

#### W5. Audit Trail Immutability is Not Architecturally Specified

**Category:** OWASP A08 -- Data Integrity Failures
**Location:** "Must Have (P0)" -- "Complete immutable audit trail" and "Non-Functional Requirements > Auditability"

The plan repeatedly states audit records are "append-only -- no updates or deletes." However, it does not specify:

1. How immutability is enforced at the database level (e.g., database triggers that prevent UPDATE/DELETE, separate audit database with restricted permissions, application-level guards only).
2. Whether the application's database user has UPDATE/DELETE permissions on audit tables (if it does, "immutable" is aspirational, not enforced).
3. Whether audit records are integrity-protected (e.g., hash chaining, digital signatures) to detect tampering.
4. Who has administrative access to the audit store and whether that access is itself audited.

For a regulated financial system, "append-only" at the application layer alone is insufficient -- a compromised application or direct database access could still modify records.

**Impact:** Audit trail tampering through direct database access, compromised application credentials, or administrative override. In a regulatory examination, the integrity of the audit trail is the first thing auditors verify.

**Recommendation:** Add a requirement that the Architect must specify the immutability enforcement mechanism in the technical design. At minimum for MVP: (a) the application database user must not have UPDATE/DELETE permissions on audit tables, (b) audit records should include a hash chain or integrity checksum. At production maturity, consider a separate audit store with independent access controls.

---

#### W6. Document Upload Security Requirements Missing

**Category:** OWASP A08 -- Data Integrity Failures / A03 -- Injection
**Location:** "Must Have (P0)" -- "Automated document data extraction"

The plan describes document upload and processing but does not address:

1. **File type validation.** What file types are accepted? Only PDF and common image formats? The plan says "common document image formats and PDFs" but does not require server-side MIME type validation.
2. **File size limits.** No maximum upload size specified. Large files could be used for denial-of-service.
3. **Malicious file handling.** PDFs and images can contain embedded scripts, metadata exploits, or polyglot payloads. Before these files are sent to vision LLMs or rendered in the UI, they need sanitization.
4. **Filename sanitization.** The plan mentions sanitizing filenames before logging (for PII), but not before storage -- path traversal via malicious filenames is a risk.

**Impact:** Server-side code execution via malicious uploads, denial of service via oversized files, path traversal via crafted filenames, XSS via malicious file metadata rendered in the UI.

**Recommendation:** Add requirements for (a) allowlisted file types with server-side MIME validation, (b) maximum file size limit, (c) filename sanitization for storage (not just logging), (d) antivirus or sanitization pass before processing. These are standard secure upload requirements per OWASP.

---

### Suggestion

#### S1. Rate Limiting Scope Should be Defined More Precisely

**Location:** "Security Considerations > Access Tiers" and "Non-Functional Requirements > Security"

The plan mentions "session-based rate limiting and cost caps" for the public tier and "rate limiting on authentication endpoints" in the security baseline. The Architect needs clarity on:

- Rate limiting per IP, per session, or per API key?
- Separate rate limits for LLM-invoking endpoints (higher cost) vs. static data endpoints?
- Cost cap enforcement: per-session, per-hour, per-day?
- What happens when a rate limit is hit -- 429 response, or degraded service?

**Recommendation:** Add a note that the Architect should define rate limiting granularity and cost cap enforcement strategy in the technical design. Specify that LLM-invoking public endpoints (chat, property lookup) need separate, more restrictive rate limits than static data endpoints (rates, calculator).

---

#### S2. Cross-Session Context for Authenticated Intake Users Has PII Implications

**Location:** "Phase 5" -- "Cross-session context for authenticated intake users (part of intake agent, P1)"

Storing conversation history across sessions for authenticated users means PII may accumulate in the chat context store. The plan does not address:

- Retention policy for cross-session conversation data
- Whether PII shared in previous conversations is redacted before being sent as context to subsequent LLM calls
- User's ability to request deletion of their conversation history (data subject rights, even for MVP demonstration)

**Recommendation:** Add a requirement that cross-session context has a defined retention period, that accumulated PII in conversation history is redacted before re-injection into LLM context, and that a conversation history deletion mechanism exists.

---

#### S3. Confidence Threshold Configuration Should Have Authorization Controls

**Location:** "Must Have (P0)" -- "Confidence-based routing and escalation" and "Role Model"

The plan states that confidence thresholds are configurable and changes are audited. The role model restricts threshold configuration to the `reviewer` role. This is adequate but consider:

- Threshold changes directly affect which applications get auto-approved vs. human-reviewed. Lowering thresholds reduces human oversight.
- The plan should require that threshold changes take effect only after a confirmation step (not a single-click change) to prevent accidental misconfiguration.
- Consider requiring that threshold changes below a safety floor (e.g., auto-approve threshold below 0.5) are rejected or require additional authorization.

**Recommendation:** Add a requirement for a safety floor on confidence thresholds that cannot be overridden without elevated authorization, and a confirmation step for all threshold changes.

---

#### S4. SSRF Risk in External Data Integrations

**Category:** OWASP A10 -- Server-Side Request Forgery
**Location:** "Should Have (P1)" -- External data integrations (FRED API, BatchData API, property data)

The system makes server-side HTTP requests to external APIs (FRED, BatchData, potentially others). If any of these URLs are configurable or influenced by user input (e.g., a user provides a property address that gets incorporated into an API URL), there is SSRF risk.

**Recommendation:** Note for the Architect that all external API URLs must be allowlisted at configuration time. User-supplied data (property addresses, etc.) must be passed as query parameters to known-good base URLs, never concatenated into the URL path or used to construct arbitrary URLs.

---

#### S5. Clarify Scope of "Input Validation at System Boundaries"

**Location:** "Non-Functional Requirements > Security" -- "All input is validated at system boundaries"

For the Architect and implementers, "system boundaries" should be explicitly enumerated:

1. HTTP API request bodies and query parameters
2. Uploaded file content and metadata
3. Responses from external APIs (FRED, BatchData, LLM providers) -- these are also untrusted input
4. Data extracted by LLM agents from documents (LLM output is untrusted and should be validated before database insertion)
5. Chat input from the public intake agent

LLM agent output (item 4) is particularly important and often overlooked -- agents extract structured data from documents, and that extracted data flows into the database. If the LLM hallucinates or is manipulated, malformed data enters the system.

**Recommendation:** Add a note that "system boundaries" includes LLM agent output (extracted data, analysis results) and external API responses, not just user-facing HTTP endpoints.

---

### Positive

#### P1. Real Authentication from Day One

The plan explicitly requires "real authentication from day one -- not mocked, not deferred" with a startup warning for default credentials. This is the correct approach for a security-sensitive domain and prevents the common anti-pattern of adding auth as an afterthought. The three-role hierarchy (loan_officer, senior_underwriter, reviewer) maps cleanly to the principle of least privilege.

---

#### P2. Firm Human-in-the-Loop for Agent Disagreements

The requirement that "all agent conflicts escalate to human review -- no automated tie-breaking" is a strong security and compliance pattern for regulated domains. This prevents the system from auto-resolving disagreements in a way that could mask errors or bias. The statement that this is "a firm stakeholder requirement" appropriately signals that it is non-negotiable.

---

#### P3. Mocked Services with Real Interfaces

The design principle that "the mock is a different implementation, not a different interface" significantly reduces the risk of security-relevant behavioral differences between mock and real services. When the credit bureau mock and the real API share the same interface contract, security controls (input validation, error handling, response parsing) are tested against the same shape even in development.

---

#### P4. Audit Trail as First-Class Requirement

The audit trail is P0, not an afterthought. It captures agent decisions (with confidence and reasoning), human actions (with identity and rationale), and state transitions. This is essential for a regulated financial system and demonstrates the compliance pattern correctly. The completeness criterion ("producible in under 5 minutes") gives the Architect a measurable target.

---

#### P5. Explicit PII Redaction in LLM Interactions

Identifying PII redaction before LLM calls as a specific feature (rather than assuming providers handle it) demonstrates awareness that external LLM providers are third parties who should not receive sensitive customer data. The domain rule reinforcing this (`.claude/rules/domain.md`) creates a defense-in-depth approach.

---

## OWASP Top 10 Coverage Summary

| OWASP Category | Plan Coverage | Gaps |
|---|---|---|
| A01: Broken Access Control | Three roles defined, RBAC specified | Role-from-token parsing risk (C1) |
| A02: Cryptographic Failures | PII redaction mentioned, no secrets in code | No data-at-rest encryption spec (C2) |
| A03: Injection | Prompt injection mentioned, input validation required | Prompt injection defenses unbounded (W2), upload sanitization missing (W6) |
| A04: Insecure Design | Human-in-the-loop, confidence escalation | Review queue saturation not addressed (W4) |
| A05: Security Misconfiguration | Default credential warning | No hard-fail for default creds in production (W3) |
| A06: Vulnerable Components | Dependency scanning in CI mentioned | Adequate at plan level |
| A07: Authentication Failures | Auth from day one, bearer tokens | Static API keys, no expiry/rotation (C1) |
| A08: Data Integrity Failures | Immutable audit trail | Enforcement mechanism unspecified (W5), upload integrity unspecified (W6) |
| A09: Logging Failures | Structured logging, PII masking, correlation IDs | Adequate at plan level |
| A10: SSRF | Not addressed | External API URL allowlisting needed (S4) |

---

## Cross-References from Teammate Reviews

After reviewing findings from the Architect (`product-plan-review-architect.md`, verdict: REQUEST_CHANGES) and API Designer (`product-plan-review-api-designer.md`, verdict: NEEDS_DISCUSSION):

1. **Authentication token format -- three-way convergence.** All three reviewers independently flagged the `Authorization: Bearer <role>:<key>` format as problematic (my C1, Architect W-5, API Designer C1). The Architect frames it as an architectural ambiguity (is the role authoritative or advisory?). The API Designer frames it as a deviation from standard Bearer token semantics. I frame it as a privilege escalation vector. These perspectives are complementary and reinforce the criticality: this must be resolved before Phase 1 authentication design begins.

2. **Audit trail phasing -- Architect's C-2 strengthens my W5.** The Architect correctly identifies that deferring the audit trail to Phase 3 while auditable events begin in Phase 1 creates a gap. From a security perspective, this phasing gap compounds the immutability enforcement concern in my W5: if audit trail infrastructure is added retroactively in Phase 3, the mechanism for enforcing append-only semantics (database permissions, hash chaining) may be more difficult to layer onto an existing schema than building it correctly from Phase 1.

3. **PII redaction timing -- Architect's W-1 aligns with my W1.** The Architect notes that the plan's feature-to-phase assignments create implicit constraints, specifically flagging that "PII protection may need to be foundational rather than Phase 2." This supports my W1 finding that PII redaction before LLM calls should be P0 or at minimum operational from the first Phase 2 agent.

4. **Document upload -- API Designer's W2 complements my W6.** The API Designer identifies that the document upload lifecycle (synchronous vs. asynchronous, status polling) is underspecified. My W6 covers the security dimensions of the same gap (file type validation, size limits, malicious content). Together, these findings indicate that document upload is underspecified on both the API contract and security dimensions.

---

## Summary

The product plan demonstrates strong security awareness for an MVP in a regulated financial domain -- real authentication from day one, human-in-the-loop for agent conflicts, PII redaction as an explicit feature, and audit trails as a first-class requirement. These are patterns worth preserving. However, two critical gaps must be resolved before proceeding: (1) the API key authentication model has a privilege escalation vector because the role is embedded in the client-supplied token without specifying server-side role resolution, and (2) data-at-rest encryption requirements for a system storing SSNs, tax returns, and credit data are effectively unspecified. Six warnings identify areas where the plan's security intent is correct but the specification is too vague for the Architect to design against -- particularly PII redaction timing, prompt injection boundaries, document upload security, and audit trail immutability enforcement.
