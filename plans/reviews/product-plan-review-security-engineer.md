# Product Plan Security Review (Re-Review)
**Reviewer:** Security Engineer
**Artifact:** Product Plan (plans/product-plan.md)
**Date:** 2026-02-16
**Review Type:** Re-review after triage changes
**Verdict:** APPROVE

---

## Executive Summary

This is a re-review of the product plan following triage changes to address four Critical findings from the initial security review. All Critical findings have been adequately resolved:

1. **SEC-PP-01 (Agent prompt injection)** — RESOLVED: F14 now includes comprehensive agent security controls: input validation on agent queries to detect adversarial prompts, tool access re-verification at execution time before every tool invocation, and output filtering to prevent out-of-scope data in agent responses. F16 specifies adversarial testing for both guardrails and RBAC boundaries. Risk added to table (row 359).

2. **SEC-PP-02 (HMDA via document extraction)** — RESOLVED: F5 now explicitly requires that document analysis "must never extract demographic data" and specifies that if demographic data is detected in an uploaded document, it is "flagged, excluded from extraction, and the exclusion is logged in the audit trail." F14 reinforces that "HMDA demographic data isolation applies at every stage: collection, document extraction, storage, and retrieval." Risk added to table (row 354).

3. **SEC-PP-03 (Unmasked PII in documents)** — RESOLVED: F14 now specifies document access controls per role. The CEO is "restricted to document metadata (document type, upload date, status, quality flags)" and "cannot view or download raw document content." This aligns with the CEO's partial PII masking for structured data. Risk added to table (row 360).

4. **SEC-PP-04 (Audit trail immutability)** — RESOLVED: F15 now requires that "the audit trail is append-only -- no modification or deletion of entries is permitted" with "sequential IDs or timestamps with integrity guarantees" and specifies that "attempted tampering (if detected) is itself logged." This has been promoted from a downstream note to a Must Have requirement, which is the correct priority.

Additionally, the shift from simulated authentication to **real authentication via an identity provider** (Keycloak suggested as a downstream note for the Architect, row 420) significantly strengthens the security posture and eliminates the previous WARNING finding (SEC-PP-07) about simulated auth implications.

The updated plan maintains the strong security foundations identified in the initial review (HMDA data separation architecture, proxy discrimination awareness, decision traceability) while closing the critical gaps.

---

## Findings Summary

| ID | Severity | Category | Finding |
|----|----------|----------|---------|
| SEC-PP-R01 | **Warning** | Cross-Session Memory | Memory isolation requirements added but verification testing not explicit |
| SEC-PP-R02 | **Warning** | Document Security | Document retention policy remains unspecified (acceptable for PoC but should be noted) |
| SEC-PP-R03 | **Suggestion** | Audit Trail | Audit data retention period still unspecified (minor for PoC) |
| SEC-PP-R04 | **Suggestion** | Conversational Application | Conversational-only flow increases AI dependency for data collection completeness |
| SEC-PP-R05 | **Positive** | Agent Security | Multi-layer agent security defense is comprehensive and correctly scoped |
| SEC-PP-R06 | **Positive** | Authentication | Real authentication via identity provider significantly improves security posture over simulated auth |
| SEC-PP-R07 | **Positive** | HMDA Isolation | Document extraction filtering closes the most critical HMDA leakage path |
| SEC-PP-R08 | **Positive** | Audit Trail | Append-only immutability promoted to Must Have is the correct priority |
| SEC-PP-R09 | **Positive** | RBAC Consistency | Document access controls per role ensure PII masking consistency across structured and unstructured data |

---

## Detailed Findings

### SEC-PP-R01: Memory Isolation Verification Testing Not Explicit [WARNING]

**Category:** OWASP A01:2021 - Broken Access Control
**Location:** F14 (RBAC), F19 (Cross-Session Conversation Memory), Risk entry (row 349)

**Description:**
The updated plan strengthens memory isolation requirements in F14 and F19:
- F14 specifies: "Cross-session memory is isolated per user -- memory storage includes a user identifier as a mandatory isolation key, memory retrieval verifies the requesting user matches the memory owner before returning any data, and memory is never retrieved across user boundaries, even for admin or executive roles."
- F19 reinforces: "Memory storage includes a user identifier as a mandatory isolation key. Memory retrieval verifies the requesting user matches the memory owner before returning any data."
- Risk table entry (row 349) correctly identifies memory leakage as Low likelihood / High impact with mitigation.

However, the plan does not explicitly specify **how memory isolation will be verified** during testing. The initial review (SEC-PP-06) recommended testing that "User A cannot retrieve User B's memory via direct API calls, session hijacking, or adversarial agent prompts."

**Impact:**
Without explicit testing requirements, memory isolation verification could be overlooked during implementation. Given that memory isolation is described as a "hard requirement" and listed as a risk mitigation, verification testing should be first-class.

**Recommendation:**
1. Add to Non-Functional Requirements or F14:
   - Memory isolation must be verified through testing: attempt to retrieve User A's memory from User B's session via both API calls and adversarial agent prompts; verify retrieval fails or returns empty
   - Memory retrieval failure should be graceful (returns empty, does not error or leak error messages revealing that the other user's memory exists)

2. Alternatively, add to the "Key risks" section of Phase 2 (where F19 is delivered):
   - Memory isolation verification testing is required as part of Phase 2 exit criteria

This is a **Warning** rather than Critical because the requirements are now specified correctly — this finding addresses testing verification, which is a downstream implementation concern.

**References:**
- OWASP A01:2021 - Broken Access Control

---

### SEC-PP-R02: Document Retention Policy Remains Unspecified [WARNING]

**Category:** Data Security / Compliance
**Location:** F5 (Document Upload and Analysis), Won't Have section (row 216)

**Description:**
The Won't Have section now explicitly states: "Document retention policies and automated purging -- Documents persist for the lifetime of the demo environment. Production retention policies, automated purging, and borrower data deletion workflows are out of scope for the PoC."

This is a clear and appropriate scoping decision for a PoC. However, the plan does not note that unbounded document accumulation is a cost and compliance concern for Quickstart users who deploy this in longer-lived environments.

**Impact:**
Low impact for the Summit demo. Medium impact for Quickstart users who deploy this application and begin accumulating real or realistic document uploads without a retention policy.

**Recommendation:**
1. Add to Technical Writer documentation scope (downstream note):
   - Document that the PoC does not implement document retention or purging policies
   - Provide guidance for Quickstart users on how to add retention policies when moving to MVP or production (e.g., scheduled job, retention period configuration, borrower data deletion workflows)

This is a **Warning** rather than Critical because the plan correctly scopes this as out of scope for the PoC, and the Won't Have section is now explicit about it.

**References:**
- GDPR Article 17 (Right to Erasure) — not directly applicable to a US PoC, but a common pattern in production systems

---

### SEC-PP-R03: Audit Data Retention Period Unspecified [SUGGESTION]

**Category:** OWASP A09:2021 - Security Logging and Monitoring Failures
**Location:** F15 (Comprehensive Audit Trail)

**Description:**
F15 now specifies that the audit trail is append-only with immutability guarantees, which resolves the Critical finding (SEC-PP-04). However, the plan does not specify an audit data retention period or whether audit data is purged after a retention period.

This is consistent with the initial review finding (SEC-PP-09), which was classified as a **Suggestion**. The updated plan does not change this area.

**Impact:**
Low impact for the demo. Medium impact for Quickstart users who deploy this in a longer-lived environment and need to understand the retention posture.

**Recommendation:**
1. Add to Non-Functional Requirements or F15:
   - Audit data retention period is **not specified for the PoC** — data persists as long as the database exists
   - Quickstart users should define their own retention policy when moving to MVP or production

2. Add to Technical Writer documentation scope (downstream):
   - Document that the PoC does not implement audit data purging, and provide guidance on how to add it (e.g., scheduled job, retention period configuration)

This is a **Suggestion** because it is a minor concern for the PoC and the plan correctly does not over-engineer retention policies for a demo environment.

**References:**
- OWASP A09:2021 - Security Logging and Monitoring Failures
- SOC 2 Logging Retention Controls

---

### SEC-PP-R04: Conversational-Only Application Flow Increases AI Dependency [SUGGESTION]

**Category:** Data Quality / Security by Design
**Location:** F4 (Mortgage Application Workflow), Risk entry (row 356)

**Description:**
The updated plan removes the form-based application path from F4, leaving only the conversational AI path: "Borrowers initiate and progress through a mortgage application... via a conversational path where the AI assistant guides the borrower through the process step by step."

This simplification strengthens the agentic AI differentiator (which is the point of the Quickstart), but it also increases the application's dependency on AI quality for data collection completeness. The plan acknowledges this risk (row 356): "Conversational-only application workflow depends on AI quality for data collection."

From a security perspective, this creates a potential issue: if the AI fails to collect required fields (or collects them incorrectly), the application data is incomplete or inaccurate. This could lead to downstream issues in underwriting, compliance checks, or audit trail provenance if the AI's conversation transcript does not clearly establish consent for HMDA data collection, disclosures, or other regulatory checkpoints.

**Impact:**
Low to Medium. The risk is primarily a data quality concern, not a security vulnerability. However, incomplete or inaccurate application data could result in:
- Missing HMDA demographic data (undermining the collection-without-use demonstration)
- Unclear consent/disclosure acknowledgment timestamps in the audit trail
- Incorrect data extraction that is then used in lending decisions

The plan's mitigation strategy (row 356) is appropriate: "Pre-seeded demo data provides a reliable demo path. Thorough testing of the conversational flow is essential to ensure all 1003/URLA fields are captured."

**Recommendation:**
1. Ensure the conversational AI flow is tested for completeness with all required 1003/URLA fields, including:
   - HMDA demographic data collection with clear explanation and consent
   - Disclosure acknowledgments (Loan Estimate, privacy notice, equal opportunity notice, HMDA notice) with timestamps
   - Co-borrower entry and shared application data

2. Consider adding a fallback mechanism for critical fields (e.g., if the AI fails to collect HMDA data after N conversation turns, prompt explicitly or present a structured input).

This is a **Suggestion** because the plan correctly identifies the risk and mitigation, and the conversational-only approach is a valid design choice for a PoC focused on agentic AI capabilities.

**References:**
- OWASP A04:2021 - Insecure Design (missing critical functionality due to over-reliance on AI)

---

### SEC-PP-R05: Multi-Layer Agent Security Defense is Comprehensive [POSITIVE]

**Category:** Agent Security / RBAC
**Location:** F14 (RBAC), F16 (Fair Lending Guardrails), Risk entry (row 359)

**Description:**
The updated F14 now includes comprehensive agent security controls that address the Critical finding (SEC-PP-01):

> "Agent security includes: input validation on agent queries to detect and reject adversarial prompts, tool access re-verification at execution time before any tool invocation (not just at session start), and output filtering to prevent out-of-scope data from appearing in agent responses."

F16 reinforces adversarial testing scope:

> "Adversarial testing applies to both fair lending guardrails and RBAC boundaries -- the system must be tested against prompts designed to bypass access controls or extract protected data."

Risk entry (row 359) correctly documents this as High likelihood / High impact with multi-layer mitigation.

This is a **best-practice defense-in-depth approach** to agent security:
1. **Input validation** — Detect and refuse adversarial prompts before they reach the agent
2. **Tool-level authorization** — Re-verify permissions before every tool invocation, not just at session start (prevents time-of-check-time-of-use vulnerabilities)
3. **Output filtering** — Scan agent responses for out-of-scope data before returning to the user
4. **Adversarial testing** — Verify the defenses work in practice

**Impact:**
This feature significantly strengthens the RBAC demonstration and addresses the highest-risk agent attack vectors: prompt injection to bypass access controls, cross-user data leakage, and HMDA data exfiltration.

**Recommendation:**
None. This is a positive finding. Ensure these controls are prioritized during architecture and technical design, and test them thoroughly with realistic adversarial prompts before the Summit demo.

**References:**
- OWASP Top 10 for LLMs: LLM01 - Prompt Injection
- OWASP A01:2021 - Broken Access Control

---

### SEC-PP-R06: Real Authentication Significantly Improves Security Posture [POSITIVE]

**Category:** Authentication / Security Baseline
**Location:** Downstream Notes (row 420), F14 (RBAC)

**Description:**
The updated plan replaces simulated authentication with **real authentication via a production-grade identity provider**. Downstream note (row 420) states:

> "Stakeholder requires real authentication via a production-grade identity provider (Keycloak suggested). The Architect should evaluate and select the appropriate identity provider. This is a stakeholder technology preference, not a product-level technology mandate."

This change eliminates the previous WARNING finding (SEC-PP-07) about simulated auth implications for Quickstart users. With real authentication:
- RBAC enforcement is backed by trustworthy identity and session management
- Quickstart users can deploy the application in non-demo contexts (internal pilots, user testing) without the "authentication is not secure for real data" warning
- The application demonstrates production-grade patterns, not just PoC shortcuts

**Impact:**
This is a significant security improvement. Real authentication transforms the Quickstart from "demo only, not suitable for real data" to "PoC maturity with production-grade identity management." This increases the Quickstart's value for practitioners evaluating the architecture for their own use cases.

**Recommendation:**
None. This is a positive finding. Ensure the Architect evaluates identity providers with appropriate security features (OAuth2/OIDC, session management, token refresh, etc.) and documents the authentication architecture for Quickstart users.

**References:**
- OWASP A07:2021 - Identification and Authentication Failures

---

### SEC-PP-R07: Document Extraction Filtering Closes Critical HMDA Leakage Path [POSITIVE]

**Category:** RBAC / Data Isolation
**Location:** F5 (Document Upload and Analysis), F14 (RBAC), Risk entry (row 354)

**Description:**
The updated F5 now explicitly addresses HMDA data in document extraction:

> "Document analysis must never extract demographic data (race, ethnicity, sex); if demographic data is detected in an uploaded document, it is flagged, excluded from extraction, and the exclusion is logged in the audit trail."

F14 reinforces this at the architectural level:

> "HMDA demographic data isolation applies at every stage: collection, document extraction (see F5), storage, and retrieval."

Risk entry (row 354) correctly documents this as Medium likelihood / High impact with mitigation: "Document analysis pipeline must never extract demographic data. If demographic data is detected in an uploaded document, it is flagged, excluded from extraction, and the exclusion is logged in the audit trail."

This resolves the Critical finding (SEC-PP-02) and closes the most subtle HMDA leakage path: demographic data bypassing the collection-without-use architecture via document uploads.

**Impact:**
This feature ensures that the HMDA data separation architecture is complete and consistent across all data entry paths (structured application form, document upload, API imports). The logging of exclusions in the audit trail provides transparency and accountability.

**Recommendation:**
None. This is a positive finding. Ensure the document extraction pipeline is tested with documents that contain demographic data (e.g., a government-issued ID, a prior HMDA form, a credit report) to verify that detection and filtering work correctly.

**References:**
- HMDA (12 CFR Part 1003) — demographic data collection and use restrictions

---

### SEC-PP-R08: Append-Only Immutability Promoted to Must Have [POSITIVE]

**Category:** Audit Trail / Compliance
**Location:** F15 (Comprehensive Audit Trail)

**Description:**
The updated F15 now specifies audit trail immutability as a first-class requirement:

> "The audit trail is append-only -- no modification or deletion of entries is permitted. Audit entries include sequential IDs or timestamps with integrity guarantees. Attempted tampering (if detected) is itself logged."

This resolves the Critical finding (SEC-PP-04) and elevates immutability from a downstream note to a Must Have requirement in Phase 2. This is the correct priority for a regulated financial services context where audit log integrity is a critical control.

**Impact:**
This feature ensures that the audit trail has evidentiary value for compliance reviews, investigations, and regulatory audits. Without immutability, the decision traceability and override tracking capabilities (F15) would be meaningless — logs could be altered to hide misconduct or poor judgment.

**Recommendation:**
None. This is a positive finding. Ensure the Architect designs append-only storage with integrity guarantees (cryptographic chaining, database-level append-only constraints, or immutable storage mechanisms) and that the implementation is tested for tamper resistance.

**References:**
- OWASP A09:2021 - Security Logging and Monitoring Failures
- SOC 2 Logging and Monitoring Controls

---

### SEC-PP-R09: Document Access Controls Ensure PII Masking Consistency [POSITIVE]

**Category:** RBAC / PII Handling
**Location:** F14 (RBAC), Risk entry (row 360)

**Description:**
The updated F14 now specifies document access controls per role:

> "Document access controls enforced per role: CEO restricted to document metadata (document type, upload date, status, quality flags) and masked extracted data only -- cannot view or download raw document content. Underwriter and LO have full document access scoped to their pipeline."

Risk entry (row 360) correctly documents this as Medium likelihood / High impact: "Document access controls enforced per role: CEO restricted to document metadata... cannot view or download raw document content."

This resolves the Critical finding (SEC-PP-03) and ensures that the CEO's partial PII masking (borrower names visible; SSN, account numbers, DOB masked) applies consistently across structured data and unstructured document content.

**Impact:**
This feature ensures RBAC consistency: the CEO sees operational context (who, what stage, what documents exist) without bypassing PII masking via raw document access. This aligns with the principle that different roles need different data views, and access controls enforce those boundaries at all layers.

**Recommendation:**
None. This is a positive finding. Ensure the document access control implementation is tested to verify that the CEO cannot bypass metadata-only access via API calls, URL manipulation, or agent prompts.

**References:**
- OWASP A01:2021 - Broken Access Control
- OWASP A03:2021 - Sensitive Data Exposure (legacy mapping)

---

## Verdict

**APPROVE**

All four Critical findings from the initial review have been adequately resolved:

1. **SEC-PP-01 (Agent security)** — Comprehensive multi-layer defense: input validation, tool access re-verification, output filtering, adversarial testing. (Positive finding SEC-PP-R05)
2. **SEC-PP-02 (HMDA via document extraction)** — Document extraction filtering with detection, exclusion, and audit logging. (Positive finding SEC-PP-R07)
3. **SEC-PP-03 (Unmasked PII in documents)** — Document access controls per role; CEO restricted to metadata only. (Positive finding SEC-PP-R09)
4. **SEC-PP-04 (Audit trail immutability)** — Append-only requirement with integrity guarantees promoted to Must Have. (Positive finding SEC-PP-R08)

Additionally, the shift from simulated authentication to real authentication via an identity provider (Positive finding SEC-PP-R06) significantly strengthens the overall security posture and eliminates a previous WARNING finding.

The remaining findings are two **Warnings** (memory isolation verification testing, document retention policy) and two **Suggestions** (audit data retention, conversational-only AI dependency). None are blocking for the product plan to proceed to architecture.

The plan is **ready to proceed to Architecture phase (Phase 5)** with the following recommendations for downstream phases:

1. **Memory isolation verification testing** (SEC-PP-R01) should be specified in Phase 2 testing requirements or Non-Functional Requirements
2. **Document retention policy guidance** (SEC-PP-R02) should be included in Technical Writer documentation scope
3. **Audit data retention period** (SEC-PP-R03) should be noted in documentation as unspecified for the PoC
4. **Conversational flow completeness testing** (SEC-PP-R04) should be prioritized in Phase 2 to verify all 1003/URLA fields are captured

---

## Review Resolution Changes Summary

### Critical Findings Resolved (4/4)

| ID | Finding | Resolution Status |
|----|---------|------------------|
| SEC-PP-01 | Agent prompt injection | ✅ RESOLVED — F14 agent security controls, F16 adversarial testing, risk entry added |
| SEC-PP-02 | HMDA via document extraction | ✅ RESOLVED — F5 demographic data filtering, F14 isolation at every stage, risk entry added |
| SEC-PP-03 | Unmasked PII in documents | ✅ RESOLVED — F14 document access controls per role, CEO restricted to metadata, risk entry added |
| SEC-PP-04 | Audit trail immutability | ✅ RESOLVED — F15 append-only requirement with integrity guarantees |

### New Positive Findings (5)

All Critical finding resolutions are positive findings in this re-review:
- SEC-PP-R05: Multi-layer agent security defense
- SEC-PP-R06: Real authentication via identity provider
- SEC-PP-R07: Document extraction filtering for HMDA data
- SEC-PP-R08: Audit trail immutability promoted to Must Have
- SEC-PP-R09: Document access controls ensure PII masking consistency

### New Warning/Suggestion Findings (4)

- SEC-PP-R01 [Warning]: Memory isolation verification testing should be explicit
- SEC-PP-R02 [Warning]: Document retention policy unspecified (acceptable for PoC, note for Quickstart users)
- SEC-PP-R03 [Suggestion]: Audit data retention period unspecified (minor for PoC)
- SEC-PP-R04 [Suggestion]: Conversational-only flow increases AI dependency (acknowledged in risk table)

None of these new findings are blocking for architecture phase.

---

## Security Review Checklist

| Check | Status | Notes |
|-------|--------|-------|
| No technology names in feature descriptions | ✅ Pass | Features describe capabilities, not solutions |
| MoSCoW prioritization used | ✅ Pass | Features classified as Must/Should/Could/Won't |
| No epic or story breakout | ✅ Pass | Features described and prioritized, not decomposed |
| NFRs are user-facing | ✅ Pass | Quality expectations framed as user outcomes |
| User flows present | ✅ Pass | 8 comprehensive flows documented |
| Phasing describes capability milestones | ✅ Pass | 6 phases with clear capability milestones |
| **RBAC design clear and unambiguous** | ✅ Pass | Agent security controls added (SEC-PP-R05), document access controls specified (SEC-PP-R09) |
| **Audit trail sufficient for regulated context** | ✅ Pass | Immutability now specified (SEC-PP-R08); decision traceability, override tracking, data provenance excellent |
| **Fair lending guardrails robust** | ✅ Pass | Proxy discrimination awareness is excellent depth (maintained from initial review) |
| **HMDA architecture feasible and secure** | ✅ Pass | Separation architecture correct, document extraction filtering added (SEC-PP-R07) |
| **Document handling security concerns addressed** | ✅ Pass | HMDA filtering (SEC-PP-R07), document access controls (SEC-PP-R09), retention policy scoped as out of scope (SEC-PP-R02) |
| **Cross-session memory isolation specified** | ⚠️ Partial | Isolation requirements clear, verification testing should be explicit (SEC-PP-R01) |
| **PII masking consistent across all features** | ✅ Pass | Document access controls ensure consistency (SEC-PP-R09) |
| **Authentication implications explicit** | ✅ Pass | Real authentication via identity provider (SEC-PP-R06) |
| **Data seeding security concerns addressed** | ✅ Pass | Pre-seeded data is fictional and does not introduce security concerns |
| **Agent tool access secure** | ✅ Pass | Multi-layer defense: input validation, tool access re-verification, output filtering (SEC-PP-R05) |

---

## Next Steps

1. **Proceed to Architecture phase (Phase 5)** — Product plan is approved from a security perspective
2. **Architecture review** will verify that:
   - HMDA data separation is implemented as a first-class architectural boundary (not just access control rules)
   - Agent security controls (input validation, tool authorization, output filtering) are enforced at the correct layers
   - Audit trail immutability is designed with appropriate storage mechanisms
   - Document access controls are enforced at the API/data layer, not just the frontend
   - Real authentication via identity provider is integrated correctly with RBAC enforcement
3. **Memory isolation verification testing** should be specified in Phase 2 requirements or Non-Functional Requirements
4. **Technical Writer** documentation should include:
   - Document retention policy guidance for Quickstart users moving to MVP/production
   - Audit data retention guidance (unspecified for PoC, define for production)
   - Conversational flow completeness testing (ensure all 1003/URLA fields captured)

---

## OWASP Top 10 Checklist

1. **Broken Access Control** — ✅ RESOLVED: Agent security controls (SEC-PP-R05), document access controls (SEC-PP-R09), HMDA isolation (SEC-PP-R07), memory isolation requirements (SEC-PP-R01)
2. **Cryptographic Failures** — ✅ Pass: Not applicable to PoC scope; real authentication uses industry-standard protocols (OAuth2/OIDC)
3. **Injection** — ✅ RESOLVED: Agent prompt injection defenses (SEC-PP-R05); SQL/command injection deferred to architecture/implementation
4. **Insecure Design** — ✅ Pass: Fair lending guardrails, proxy discrimination awareness, HMDA architecture, audit traceability demonstrate security-by-design
5. **Security Misconfiguration** — ✅ Pass: Real authentication replaces simulated auth; configuration hardening deferred to architecture
6. **Vulnerable Components** — ⚠️ Deferred: Dependency scanning (npm audit, pip audit) deferred to architecture and CI/CD
7. **Authentication Failures** — ✅ RESOLVED: Real authentication via identity provider (SEC-PP-R06)
8. **Data Integrity Failures** — ✅ Pass: Audit trail immutability (SEC-PP-R08); deserialization security deferred to architecture
9. **Logging Failures** — ✅ Pass: Comprehensive audit trail (F15) with decision traceability, override tracking, data provenance; retention policy unspecified (SEC-PP-R03, minor)
10. **SSRF** — ⚠️ Deferred: External URL validation (if applicable) deferred to architecture and implementation

---

## Updated Agent Memory

Recording key learnings for future reviews:

**Pattern: Agent Security in Agentic AI Applications**
Multi-layer defense is essential for agent systems with tool access and data access:
1. Input validation — detect adversarial prompts before they reach the agent
2. Tool-level authorization — re-verify permissions at execution time (TOCTOU protection)
3. Output filtering — scan responses for out-of-scope data before returning
4. Adversarial testing — verify defenses work against realistic attacks

**Pattern: HMDA Data Separation Architecture**
HMDA demographic data isolation must be enforced at **every stage** of the data lifecycle, not just at collection:
- Collection (structured form input)
- Document extraction (filter demographic data from uploaded documents)
- Storage (separate data paths for lending decisions vs. compliance reporting)
- Retrieval (agent tools cannot access HMDA data, only aggregate reporting functions)

Document extraction is the most subtle leakage path — it bypasses structured data separation if not explicitly designed to filter demographic content.

**Pattern: PII Masking Consistency**
Role-based PII masking must apply consistently across structured and unstructured data:
- Structured fields (database records, API responses)
- Unstructured content (uploaded documents, raw file access)
- Extracted data (document analysis results)

If a role has partial PII visibility (e.g., CEO sees names but not SSN), document access controls must enforce the same boundary — metadata-only access, not raw document content.

**Pattern: Audit Trail Immutability**
Append-only audit trails are a **Must Have** (not a Nice-to-Have) for regulated contexts. Immutability should be:
- Specified at the product plan level (not deferred to architecture)
- Enforced architecturally (storage-level constraints, not application-level promises)
- Tested for tamper resistance (attempted modifications should be detected and logged)

**Pattern: Real Authentication vs. Simulated Authentication**
Real authentication (OAuth2/OIDC, SAML) is a significant security improvement over simulated auth for PoC applications:
- Backs RBAC with trustworthy identity and session management
- Enables non-demo deployments (internal pilots, user testing) without "not secure for real data" warnings
- Demonstrates production-grade patterns, increasing Quickstart value

When evaluating identity provider options, ensure support for role-based access, session management, token refresh, and integration with downstream RBAC enforcement.
