# Product Plan Security Review

**Reviewer:** Security Engineer
**Date:** 2026-02-12
**Document:** `/home/jary/redhat/git/agent-scaffold-test-0212/plans/product-plan.md`

---

## Product Plan Review Checklist Evaluation

### 1. No technology names in feature descriptions
- **Status:** PASS
- **Finding:** Features are described as capabilities (e.g., "document processing agent", "confidence-based routing", "immutable audit trail") rather than implementation technologies. Technology mandates (LangGraph, PostgreSQL, MinIO) are correctly placed in the "Stakeholder-Mandated Constraints" section.

### 2. MoSCoW prioritization used
- **Status:** PASS
- **Finding:** Features are organized as Must Have (P0), Should Have (P1), Could Have (P2), and Won't Have, which follows MoSCoW principles.

### 3. No epic or story breakout
- **Status:** PASS
- **Finding:** Features describe capabilities and requirements, not decomposed work items. No dependency graphs, entry/exit criteria, or agent assignments present.

### 4. NFRs are user-facing
- **Status:** PASS
- **Finding:** Non-functional requirements are framed as user outcomes ("feels responsive", "completes within a short wait") rather than implementation targets. Performance section uses user-experience language appropriately.

### 5. User flows present
- **Status:** PASS
- **Finding:** Five comprehensive user flows documented, covering developer (Alex), loan officer (Maria), compliance officer (James), borrower (Sam), and risk management lead (Dana).

### 6. Phasing describes capability milestones
- **Status:** PASS
- **Finding:** Each phase (Foundation, Core AI Agents, Full Agent Suite and Public Access, Polish and Operability) describes what the system can do at that milestone, not just which features are included.

---

## Security Findings

### [CRITICAL] Public Tier Cost Abuse and Prompt Injection Defense Details Missing

**Category:** Public tier risks
**Section:** Security Considerations, Feature Scope (P1: Public access tier with rate limiting)
**Description:** The product plan identifies the correct threat categories for the public tier (prompt injection, cost abuse) but does not specify concrete mitigation patterns beyond naming the defenses. For a regulated industry quickstart that explicitly targets "impressive over minimal" scope and serves as a teaching tool, the plan should enumerate specific patterns that will be demonstrated.

**Impact:**
- Developers using this quickstart as a reference may implement inadequate defenses
- Cost abuse could make the demo prohibitively expensive to run
- Prompt injection could expose internal system prompts, bias agent behavior, or extract training data
- The demo's credibility as a "production-quality pattern" reference is undermined if defenses are generic placeholders

**Recommendation:**
Add a subsection under "Security Considerations" titled "Public Tier Threat Mitigation Patterns" that specifies:

1. **Prompt Injection Defenses:**
   - Input sanitization patterns (removal of system-prompt-style markers, instruction delimiters)
   - Output filtering (preventing reflection of potential injection payloads)
   - Semantic detection (flagging inputs that request system behavior changes, role-playing, or context escapes)
   - Structured prompting with clear user/system boundaries

2. **Cost Abuse Controls:**
   - Per-session token limits (e.g., max 10,000 tokens per 24-hour session)
   - Per-IP daily request caps (e.g., 100 chat messages, 50 calculator invocations)
   - Per-session concurrency limits (max 1 active inference per session)
   - Cost monitoring with automatic shutdown thresholds

3. **Rate Limiting Strategy:**
   - Tiered limits (per-second, per-minute, per-hour, per-day) at both session and IP levels
   - Redis-backed rate limiting with sliding windows
   - Differentiated limits for calculator (higher) vs. chat (lower) due to cost differences

This is a teaching quickstart — these patterns should be exemplary, not minimal.

**References:** OWASP LLM Top 10 — LLM01 (Prompt Injection), OWASP API Security Top 10 — API4 (Lack of Resources & Rate Limiting)

---

### [CRITICAL] PII Redaction Mechanism Undefined

**Category:** PII and data handling
**Section:** Security Considerations (PII Handling), Feature Scope (P0: Document processing agent)
**Description:** The plan states "Document images are redacted of PII before transmission to external AI services" but does not define what redaction mechanism will be used, what PII categories will be redacted, or how redaction quality will be validated. SSN, bank account numbers, and other PII must be removed from images before they leave the system boundary.

**Impact:**
- SSNs, account numbers, and other sensitive data could be transmitted to third-party LLM providers in violation of data handling policies
- Redaction failures would be silent — without validation, there's no guarantee PII isn't leaking
- Developers replicating this pattern might implement ineffective redaction (e.g., simple regex-based text replacement that fails on images)

**Recommendation:**
Expand the "PII Handling" section under "Security Considerations" to specify:

1. **Redaction approach:** Image-based redaction using bounding box detection and blurring/blackout, not text extraction and replacement (which fails if OCR misses PII)
2. **PII categories to redact:** SSN (9-digit with or without hyphens), bank account numbers (XXXXXX-XXXX format), credit card numbers (16-digit sequences), date of birth (MM/DD/YYYY formats), addresses (when detectable)
3. **Redaction validation:** Every redacted document logged (document ID, redaction event timestamp, categories detected) to the audit trail
4. **Fallback behavior:** If redaction confidence is low or the service is unavailable, document processing fails with a logged security event rather than proceeding with potentially unredacted images

Add to "Open Questions": "What third-party redaction service or open-source library should be used for image-based PII detection and redaction? What is the fallback if the redaction service is unavailable?"

**References:** OWASP Top 10 2021 — A04:2021 Insecure Design, PCI DSS 3.2.1 Requirement 3 (Protect stored cardholder data)

---

### [WARNING] Audit Trail Immutability Enforcement Mechanism Not Specified

**Category:** Audit trail security
**Section:** Feature Scope (P0: Immutable audit trail), Non-Functional Requirements (Auditability)
**Description:** The plan states audit records are "append-only" and "immutable once written" but does not specify how this is enforced at the database or application layer. Immutability is a critical property for regulated industries — without enforcement, it's a documentation claim, not a guarantee.

**Impact:**
- Database users with UPDATE privileges could modify audit records
- Application bugs could inadvertently update records
- Compliance audits could reject the audit trail if immutability cannot be proven
- Developers using this as a reference might not implement enforcement, leaving the audit trail mutable

**Recommendation:**
Add a subsection under "Non-Functional Requirements > Auditability" titled "Audit Trail Immutability Enforcement" that specifies at least one of:

1. **Database-level enforcement:** PostgreSQL table with no UPDATE or DELETE grants for application roles; REVOKE UPDATE, DELETE on audit tables in migration
2. **Application-level enforcement:** Audit repository class that exposes only `create()` and `query()` methods — no `update()` or `delete()` methods
3. **Trigger-based protection:** PostgreSQL triggers that raise exceptions on UPDATE/DELETE attempts on audit tables

Recommend option 1 (database-level) as the most robust. Add to "Phase 1: Foundation" deliverables: "Audit trail immutability verified via database permission inspection."

**References:** NIST 800-53 AU-9 (Protection of Audit Information), SOC 2 CC7.2 (System monitoring)

---

### [WARNING] API Key Rotation and Revocation Not Addressed

**Category:** Authentication and authorization
**Section:** Security Considerations (MVP Authentication Scope), Feature Scope (P0: API key authentication)
**Description:** The plan specifies API key authentication with a startup warning for default keys but does not address key rotation, revocation, or expiration. For an MVP demonstrating "production-quality patterns", the absence of key lifecycle management is a notable gap.

**Impact:**
- Compromised API keys cannot be revoked without redeploying or manual database intervention
- No mechanism to enforce periodic key rotation (90-day session TTL is mentioned for sessions, not keys themselves)
- Developers using this as a reference might not implement key management, leading to long-lived, irrevocable credentials in their production systems

**Recommendation:**
Add to "Feature Scope > Could Have (P2)":
- **API key management interface** — Reviewers can generate new API keys, revoke existing keys, and set expiration dates. All key lifecycle events recorded in the audit trail.

Add to "Open Questions":
- "Should API keys have expiration dates enforced at the API level, or is session TTL (90 days for authenticated users) sufficient for the MVP?"

Alternatively, if key rotation is out of scope for the MVP, add to "Non-Goals":
- "API key rotation and revocation tooling (keys are static for the MVP; production systems would implement key lifecycle management)"

This makes the scope boundary explicit rather than leaving it ambiguous.

**References:** OWASP ASVS 2.7 (Out of Band Verifier), NIST 800-63B 5.1.1 (Memorized Secret Verifiers)

---

### [WARNING] Mocked Services Introduce Security Blind Spots in Credit and Employment Verification

**Category:** Mocked services
**Section:** Mocked vs. Real Services
**Description:** The plan explicitly mocks the credit bureau API and employment verification service. While this is appropriate for a quickstart, the plan does not flag the security implications: real integrations would include fraud checks (credit freeze detection, SSN validation, employer verification) that the mocks cannot simulate. Developers replicating this pattern need to understand what security properties are missing.

**Impact:**
- The fraud detection agent operates on incomplete data — it cannot detect credit freezes, mismatched SSNs, or employer verification failures because those signals aren't present in mocked data
- Developers using this quickstart as a reference might not realize that real credit bureau integrations provide critical fraud signals
- The demo appears to have comprehensive fraud detection, but the mocked data means certain attack vectors are invisible

**Recommendation:**
Add a subsection under "Mocked vs. Real Services" titled "Security Implications of Mocked Services":

**Mocked Credit Bureau API:**
- Does NOT include: Credit freeze detection, SSN validation against credit bureau records, velocity checks (multiple inquiries in short time), synthetic identity detection
- Fraud detection agent will NOT catch these patterns in the quickstart
- Real implementations must integrate actual credit bureau fraud signals

**Mocked Employment Verification:**
- Treats uploaded pay stubs as authoritative without employer confirmation
- Does NOT detect: Forged pay stubs, employer name mismatches, income inflation
- Real implementations require third-party verification (e.g., The Work Number) or direct employer contact

This transparency strengthens the quickstart's credibility as a teaching tool.

**References:** FFIEC IT Examination Handbook — Retail Payment Systems (Fraud Detection and Prevention)

---

### [WARNING] Confidence Threshold Tampering Audit Insufficient

**Category:** Audit trail security, Access model
**Section:** Feature Scope (P0: Confidence-based routing), User Flows (Flow 5: Dana Adjusts Risk Thresholds)
**Description:** The plan states that confidence threshold changes are recorded in the audit trail with user identity, old value, new value, and timestamp. However, it does not specify whether threshold changes require approval, are reversible, or are subject to access control beyond the reviewer role. In regulated industries, risk parameter changes often require multi-person approval or at minimum a review/approval workflow.

**Impact:**
- A single compromised reviewer account could lower approval thresholds to auto-approve risky applications
- No mechanism for detecting or reversing inappropriate threshold changes
- Audit trail records the change but does not prevent abuse

**Recommendation:**
This is acceptable for the MVP scope but should be flagged as a known limitation. Add to "Open Questions":

"Should confidence threshold changes require multi-person approval (maker/checker pattern), or is single-reviewer authority with audit trail sufficient for the MVP?"

If single-reviewer authority is chosen (likely for MVP simplicity), add to "Security Considerations > Role Hierarchy":

**Known Limitation:** Confidence threshold changes by reviewers are immediately effective and do not require a second approval. Production systems in regulated industries typically implement a maker/checker pattern for risk parameter changes. The audit trail records all changes, enabling post-hoc review.

**References:** SOC 2 CC6.2 (Logical access controls), FFIEC IT Examination Handbook — Information Security (Segregation of Duties)

---

### [WARNING] Rate Limiting State Shared Across Public and Authenticated Tiers Could Enable Privilege Escalation

**Category:** Public tier risks, Access model
**Section:** Security Considerations (Two-Tier Access Model), Feature Scope (P1: Public access tier with rate limiting)
**Description:** The plan specifies Redis for rate limiting but does not clarify whether rate limit state is isolated between the public (unauthenticated) and protected (authenticated) tiers. If rate limit keys are shared or predictable, an attacker could exhaust the rate limit allowance for a specific IP, then authenticate to bypass the public tier limits and continue generating cost.

**Impact:**
- Authenticated users on the same IP as public users could be rate-limited incorrectly
- Conversely, an attacker could authenticate with a low-privilege account to bypass stricter public tier limits
- Rate limiting logic complexity increases if not clearly separated

**Recommendation:**
Add to "Security Considerations > Two-Tier Access Model":

**Rate Limit Isolation:** Public tier and protected tier rate limits are tracked separately. Public tier uses session ID + IP address as rate limit keys. Protected tier uses API key as the rate limit key. This prevents cross-tier rate limit interference and ensures that authenticating does not bypass public tier cost controls.

Alternatively, if rate limits should apply globally (authenticated users share the same IP-based limits as public users), make this explicit and justify the decision.

**References:** OWASP API Security Top 10 — API4 (Lack of Resources & Rate Limiting)

---

### [SUGGESTION] Add Security Logging Requirements to Observability NFRs

**Category:** Audit trail security
**Section:** Non-Functional Requirements (Observability, Security)
**Description:** The plan specifies structured logging with correlation IDs and mentions that "critical errors are logged at appropriate severity levels". However, it does not enumerate the security-relevant events that MUST be logged beyond "authentication, authorization failures, input validation failures" in the security baseline. For a regulated industry quickstart, security logging should be comprehensive and exemplary.

**Impact:**
- Developers may under-log security events, missing incidents
- Incomplete security logs reduce the effectiveness of the audit trail

**Recommendation:**
Add a subsection under "Non-Functional Requirements > Observability" titled "Security Event Logging Requirements":

The following security-relevant events MUST be logged at INFO or WARNING level:
- Authentication attempts (success and failure) with user identity and source IP
- Authorization failures (user attempted action beyond their role permissions)
- Confidence threshold changes with old/new values and reviewer identity
- Rate limit violations (session ID, IP, endpoint, limit exceeded)
- Prompt injection detection events (flagged input, session ID, detection rule matched)
- Document redaction events (document ID, PII categories detected and redacted)
- API key usage (key prefix, endpoint accessed, timestamp) for cost attribution
- Audit trail export requests (application ID, requester identity, timestamp)

Security events must NOT log PII or credential values. Correlation IDs must be included in all security log entries for traceability.

**References:** OWASP Logging Cheat Sheet, NIST 800-53 AU-2 (Audit Events)

---

### [SUGGESTION] Specify Input Validation Strategy for LLM-Facing Inputs

**Category:** Public tier risks, PII and data handling
**Section:** Security Considerations (Security, Public Tier)
**Description:** The plan mentions "input validation on all API endpoints" and "prompt injection defenses" but does not specify what validation will be applied to user inputs before they reach LLMs. LLM inputs require different validation than traditional API inputs — length limits, content filtering, and semantic checks are all relevant.

**Impact:**
- Excessively long inputs could increase cost or cause timeouts
- Inputs containing code, script tags, or markdown could cause unexpected LLM behavior
- Without specification, implementers might apply insufficient validation

**Recommendation:**
Add to "Security Considerations > Public Tier (Unauthenticated)" a subsection titled "Input Validation for LLM Interactions":

1. **Length limits:** Chat messages limited to 2,000 characters. Calculator inputs validated as numeric within reasonable ranges (loan amount: $1,000 - $10,000,000, interest rate: 0.1% - 20%, term: 1-30 years).
2. **Content filtering:** Strip HTML tags, script blocks, and markdown image syntax from user inputs before LLM processing.
3. **Encoding normalization:** Normalize Unicode to NFC form to prevent homograph attacks and encoding-based injection.
4. **Semantic validation:** Flag inputs that contain common injection patterns (e.g., "ignore previous instructions", "you are now", "system:") for additional scrutiny or rejection.

**References:** OWASP Input Validation Cheat Sheet, OWASP LLM Top 10 — LLM01 (Prompt Injection)

---

### [SUGGESTION] Clarify Session TTL Enforcement Mechanism

**Category:** Authentication and authorization
**Section:** Security Considerations (Two-Tier Access Model)
**Description:** The plan specifies 24-hour TTL for public sessions and 90-day TTL for authenticated sessions but does not specify how TTL is enforced (Redis expiration, database timestamp checks, token expiration claims).

**Impact:**
- Implementation ambiguity could lead to inconsistent enforcement
- If session TTL is only checked on new requests but not enforced on long-running operations (e.g., a document processing workflow), sessions could exceed TTL

**Recommendation:**
Add to "Security Considerations > Two-Tier Access Model":

**Session TTL Enforcement:** Session TTLs are enforced via Redis key expiration (automatic eviction after TTL). Every API request validates that the session exists in Redis before proceeding. For long-running asynchronous operations (agent workflows), the session is re-validated before each agent invocation, ensuring expired sessions cannot complete workflows.

**References:** OWASP Session Management Cheat Sheet

---

### [POSITIVE] Strong Stakeholder Preference for Security-First Approach

**Section:** Stakeholder Preferences, Security Considerations
**Finding:** The stakeholder preference "Security posture: Upgrade, don't defer" is exemplary and well-reflected in the plan. Real API key auth from day one, image redaction before LLM calls, separate database roles from Phase 1, and global rate limits before public access are all strong security-first decisions. This positions the quickstart as a credible reference implementation for regulated industries.

---

### [POSITIVE] Comprehensive Audit Trail Requirements

**Section:** Feature Scope (P0: Immutable audit trail), Non-Functional Requirements (Auditability)
**Finding:** The audit trail requirements are thorough and well-specified: every agent decision recorded with timestamp, confidence score, and reasoning; every human review recorded with identity and rationale; immutable append-only storage; exportable as a document. The inclusion of regulatory citation traceability (compliance checks traceable to specific document versions) demonstrates strong understanding of regulated industry needs.

---

### [POSITIVE] Fair Lending Compliance Awareness

**Section:** Problem Statement, Feature Scope (P0: Compliance checking agent), Security Considerations (PII Handling)
**Finding:** The plan demonstrates strong awareness of fair lending requirements: denial reasons must trace to objective financial criteria (never subjective assessments), adverse action notices must cite specific reasons, and the compliance checking agent uses RAG against regulatory documents. The statement "All denial reasons trace to objective financial criteria — never subjective assessments (fair lending requirement)" in the PII Handling section is precisely correct and shows domain expertise.

---

### [POSITIVE] Three-Role Permission Hierarchy Enforces Least Privilege

**Section:** Security Considerations (Role Hierarchy), Feature Scope (P0: Role-based access control)
**Finding:** The three-role hierarchy (loan_officer, senior_underwriter, reviewer) enforces least privilege effectively. Loan officers cannot review low-confidence escalations, and only reviewers can export audit trails and configure thresholds. This is more sophisticated than a binary user/admin split and demonstrates production-quality access control design.

---

## Verdict

**APPROVE WITH CONDITIONS**

### Conditions for Approval

The product plan is well-structured and demonstrates strong security awareness for a regulated industry quickstart. However, the following CRITICAL findings must be addressed before downstream work (architecture, requirements) proceeds:

1. **[CRITICAL] Public Tier Cost Abuse and Prompt Injection Defense Details Missing** — Add concrete mitigation patterns to "Security Considerations" as specified in the finding recommendation. This is essential for a teaching quickstart that will be used as a reference.

2. **[CRITICAL] PII Redaction Mechanism Undefined** — Specify the redaction approach, PII categories, validation strategy, and fallback behavior. Add the open question about third-party redaction services.

### Recommended Improvements (Non-Blocking)

The WARNING and SUGGESTION findings should be addressed during architecture and technical design phases:

- Audit trail immutability enforcement mechanism (specify database-level permission strategy in architecture)
- API key rotation and revocation scope decision (add to "Could Have" or "Non-Goals" explicitly)
- Security implications of mocked services (add transparency section)
- Confidence threshold tampering controls (add known limitation or multi-person approval to open questions)
- Rate limiting isolation between tiers (clarify in architecture)
- Security logging requirements (enumerate in observability architecture)
- Input validation strategy for LLM inputs (specify in API design or architecture)
- Session TTL enforcement mechanism (specify Redis-based approach in architecture)

### Strengths

- Stakeholder preference for "security posture: upgrade, don't defer" is exemplary and consistently applied
- Comprehensive audit trail requirements with immutability, exportability, and regulatory citation traceability
- Strong fair lending compliance awareness with objective criteria enforcement
- Three-role permission hierarchy enforces least privilege effectively
- Clear separation of public and protected access tiers with distinct security profiles

### Summary

This product plan provides a solid foundation for a security-conscious regulated industry quickstart. The two critical gaps (public tier defense patterns and PII redaction mechanism) are addressable with targeted additions to the "Security Considerations" section. Once these are resolved, the plan will serve as a strong reference for developers building AI systems in regulated domains.
