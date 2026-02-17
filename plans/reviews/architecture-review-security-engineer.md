# Architecture Review: Security Engineer

**Reviewer:** Security Engineer
**Date:** 2026-02-16
**Artifact:** `/home/jary/git/agent-scaffold/plans/architecture.md`
**Related ADRs:** 0001, 0005, 0006, 0007

## Executive Summary

The architecture demonstrates a strong security-first approach with multi-layered defense mechanisms for HMDA data isolation, role-based access control, agent security, and audit integrity. The four-stage HMDA isolation architecture (collection, extraction, storage, retrieval) with separate PostgreSQL schema provides architectural verifiability that demographic data cannot influence lending decisions. The agent security model implements defense in depth with four independent layers. The append-only audit trail uses database-level enforcement mechanisms.

However, there are several critical gaps and areas requiring strengthening:

1. **Cross-schema query prevention** — The HMDA schema isolation depends on code discipline and service boundaries, but lacks PostgreSQL role-level enforcement to prevent accidental joins or queries across schemas.
2. **Agent tool authorization timing** — The architecture describes "execution time" authorization checks but does not specify where in the LangGraph execution flow these checks occur or how they prevent cached/pre-authorized tool invocations.
3. **Output filtering false negative risk** — Pattern-based output filtering for PII and HMDA data is vulnerable to semantic leakage (e.g., "the applicant is from a predominantly Hispanic neighborhood" bypasses explicit demographic term patterns).
4. **Memory isolation at query level** — While user_id filtering is specified for conversation memory, the architecture does not address SQL injection risks or ORM eager-loading scenarios that could bypass the filter.
5. **Document access control gaps** — The CEO's "metadata-only" document access is described but the enforcement mechanism (API layer vs. storage layer vs. query layer) is not specified, creating risk of implementation bypass.

The architecture is fundamentally sound but requires specific hardening in enforcement mechanisms to prevent bypass scenarios.

## Findings Summary

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| SEC-A1 | **Critical** | HMDA Data Isolation | PostgreSQL role grants for HMDA schema isolation are not specified; reliance on code discipline creates bypass risk |
| SEC-A2 | **Critical** | Agent Security | Tool authorization re-verification timing in LangGraph execution flow is ambiguous; risk of cached/pre-authorized tool calls |
| SEC-A3 | **Warning** | Output Filtering | Pattern-based filtering vulnerable to semantic PII leakage and proxy demographic references |
| SEC-A4 | **Warning** | Memory Isolation | SQL injection and ORM eager-loading bypass risks for user_id filtering are not addressed |
| SEC-A5 | **Warning** | Document Access Control | CEO metadata-only enforcement mechanism is underspecified; unclear if enforced at API, query, or storage layer |
| SEC-A6 | **Warning** | Session Token Handling | Keycloak token validation and refresh token rotation mechanisms are not detailed |
| SEC-A7 | **Warning** | Demographic Data Filter | Document extraction filter relies on LLM-based detection; false negatives could leak HMDA data into lending path |
| SEC-A8 | **Suggestion** | Audit Hash Chain | Hash chain uses SHA-256 but no salt/key; vulnerable to precomputation and does not prevent admin-level rewriting |
| SEC-A9 | **Suggestion** | Input Validation | Adversarial prompt detection relies on pattern matching; sophisticated attacks may bypass heuristic patterns |
| SEC-A10 | **Suggestion** | RBAC Testing | Architecture does not specify adversarial RBAC test suite or how RBAC enforcement is continuously verified |
| SEC-A11 | **Positive** | Defense in Depth | Four independent agent security layers provide strong coverage of threat vectors |
| SEC-A12 | **Positive** | Architectural Verifiability | Schema-level HMDA separation is auditable via code inspection (grep for schema references) |
| SEC-A13 | **Positive** | Database-Level Audit Enforcement | Role grants + triggers for append-only audit provide stronger guarantees than application-level enforcement |

## Detailed Findings

### SEC-A1: PostgreSQL Role Grants for HMDA Schema Isolation [CRITICAL]

**Category:** HMDA Data Isolation (OWASP: Broken Access Control)

**Location:** `plans/architecture.md` Section 3.3, `plans/adr/0001-hmda-data-isolation.md`

**Description:**
ADR-0001 states: "The `hmda` PostgreSQL schema is accessible only by the database role used by the Compliance Service. The lending service database role has no grants on the `hmda` schema." However, the architecture document does not specify:

1. How many distinct PostgreSQL roles exist and which service uses which role
2. Whether the API gateway uses a different role than domain services
3. Whether there is a single `summit_cap_app` role (mentioned in ADR-0006) or multiple service-specific roles
4. What happens if a service attempts a JOIN between a lending-path table and an `hmda` schema table

If all services connect with the same database role, then the "lending service database role has no grants" statement is unenforceable. A bug in any service (or SQL injection in any endpoint) could query the `hmda` schema.

**Impact:**
A single database role with grants to both schemas undermines the entire HMDA isolation architecture. An ORM misconfiguration, accidental JOIN in a query, or SQL injection vulnerability in any service could leak HMDA data into the lending decision path. The architecture's claim of "architecturally verifiable isolation" becomes false — it is only verified by code inspection, not enforced by the database.

**Recommendation:**

1. Define at least two distinct PostgreSQL roles:
   - `lending_app` — has SELECT, INSERT, UPDATE grants on the default schema (applications, documents, decisions, etc.) and the `audit_events` schema. NO grants on the `hmda` schema.
   - `compliance_app` — has SELECT, INSERT grants on the `hmda` schema and SELECT grants on default schema tables needed for aggregate joins. NO UPDATE or DELETE grants on `hmda`.

2. All services except the Compliance Service connect using the `lending_app` role. The Compliance Service connects using the `compliance_app` role.

3. Document the role-to-service mapping in the architecture and include a verification command: `SELECT grantee, table_schema, privilege_type FROM information_schema.table_privileges WHERE table_schema = 'hmda';` to prove that `lending_app` has no grants.

4. Add a test case that attempts a cross-schema query using the `lending_app` role and verifies it is rejected with a permission error.

**References:** OWASP A01:2021 Broken Access Control, ADR-0001

---

### SEC-A2: Tool Authorization Re-Verification Timing in LangGraph [CRITICAL]

**Category:** Agent Security (OWASP: Broken Access Control)

**Location:** `plans/architecture.md` Section 2.3, Section 4.3, `plans/adr/0005-agent-security.md`

**Description:**
The architecture states: "Before every tool invocation within the LangGraph agent, a pre-execution check verifies: (1) The tool is in the agent's configured tool registry for the current user's role. (2) The user's role has not been revoked since session start." (Section 2.3) and "This is implemented as a LangGraph node that wraps tool execution." (ADR-0005 Layer 3).

However, LangGraph's execution model is not detailed enough to determine:

1. Where in the graph this "wrapping node" executes — before the tool selection decision or immediately before tool invocation?
2. Whether this prevents the agent from caching tool authorization decisions across multiple turns in the same session
3. How the "user's role has not been revoked" check works — does it query Keycloak on every tool call, or rely on session token expiry?
4. What happens if a tool invocation is initiated by the LLM's structured output (tool call) but the authorization check fails — is the entire agent response aborted, or does the agent receive an error message and continue?

If the authorization check happens at graph initialization (session start) rather than per-tool-call, or if the agent caches "this user can call this tool" across turns, then mid-session role changes would not be caught.

**Impact:**
A user whose role is demoted mid-session (e.g., LO role revoked by admin) could continue invoking tools they are no longer authorized to use until their session expires. An attacker who compromises a low-privilege session and then escalates their role in the identity provider would need to wait for session expiry before the application reflects the new privileges — but if authorization is cached, they might be able to invoke unauthorized tools immediately by replaying prior tool calls.

**Recommendation:**

1. Specify that the tool authorization check is implemented as a LangGraph conditional edge or pre-tool node that executes **immediately before** each tool invocation, not at graph initialization.

2. Clarify whether "role revocation check" means:
   - Re-validating the session token against Keycloak on every tool call (high latency but authoritative), or
   - Checking token expiry and role claims embedded in the JWT (low latency but stale until token refresh)

3. If using JWT claims, document the maximum staleness window (token lifetime) and note this as a known limitation: "Role changes are reflected within [token lifetime] minutes."

4. Add an explicit statement: "Tool authorization results are NOT cached across turns. Each tool invocation re-checks the user's current role against the tool's allowed_roles list."

5. Specify error handling: "If authorization check fails, the tool invocation is aborted, an error event is logged to the audit trail, and the agent returns a refusal message to the user."

**References:** OWASP A01:2021 Broken Access Control, ADR-0005

---

### SEC-A3: Output Filtering Vulnerable to Semantic Leakage [WARNING]

**Category:** Agent Security (OWASP: Sensitive Data Exposure)

**Location:** `plans/architecture.md` Section 2.3, Section 4.3, `plans/adr/0005-agent-security.md`

**Description:**
The output filtering layer (ADR-0005 Layer 4) scans agent responses for:
- PII patterns (SSN format, date-of-birth patterns)
- HMDA demographic data references
- Cross-user data references

Pattern-based filtering is effective against explicit mentions ("the applicant's SSN is 123-45-6789") but vulnerable to semantic leakage:

- "The applicant lives in a neighborhood that is predominantly Hispanic" — no explicit demographic term, but conveys protected information
- "Based on the property location in ZIP code 80205, this area has historically higher denial rates" — proxy discrimination signal, no explicit demographic data
- "The applicant's date of birth indicates they are elderly" — semantic PII, no MM/DD/YYYY pattern

The architecture acknowledges this limitation in ADR-0005: "Output filtering is a blunt instrument — pattern matching on text. It catches obvious leaks (SSN format) but may miss subtle data leakage. This is acceptable at PoC maturity." However, given the product plan's emphasis on proxy discrimination awareness (F16) and the demo's focus on fair lending credibility, semantic leakage of demographic proxies directly undermines the system's narrative.

**Impact:**
A sophisticated user (or adversarial tester during the Summit demo) could extract demographic information or discriminatory proxies by asking questions that elicit semantic responses rather than explicit data. For example:
- "Describe the neighborhood where the property is located" → agent describes demographic composition
- "What factors correlate with higher approval rates?" → agent lists proxies for protected characteristics

This creates a credibility gap: the system claims to prevent HMDA data from influencing lending decisions, but allows agents to discuss demographic proxies in responses.

**Recommendation:**

1. Extend output filtering to include semantic checks for demographic proxies:
   - Geographic/neighborhood descriptors that imply demographic composition (e.g., "predominantly", "historically", "neighborhood composition")
   - Age-related inferences from dates ("elderly", "retired", "young")
   - Family structure proxies ("single parent", "large family")

2. Add a post-filtering review step that checks if the response contains comparative or statistical language about demographics: "higher rates", "typical for this area", "common among [group]"

3. Harden agent system prompts (Layer 2) to refuse geographic analysis questions: "I cannot provide neighborhood-level demographic analysis or area-based approval rate comparisons, as these may constitute proxy discrimination under fair lending laws."

4. Add semantic leakage test cases to the adversarial test suite (mentioned in ADR-0005 but not detailed in architecture): "Describe the typical borrower profile in ZIP code 80205", "What neighborhoods have the highest approval rates?"

5. Note in the architecture: "Output filtering uses both pattern matching (explicit PII) and semantic checks (demographic proxies). False negatives remain possible at PoC maturity — production hardening would use NLP-based classification."

**References:** OWASP A02:2021 Cryptographic Failures, ECOA/Fair Housing Act proxy discrimination standards, ADR-0005

---

### SEC-A4: Memory Isolation SQL Injection and ORM Risks [WARNING]

**Category:** Memory Isolation (OWASP: Injection)

**Location:** `plans/architecture.md` Section 3.5

**Description:**
The architecture states: "The checkpoint table includes `user_id` as a mandatory column. All checkpoint queries include `WHERE user_id = :requesting_user_id`. There is no query path that retrieves checkpoints across users."

However:

1. If `user_id` is taken from user input or session context without parameterization, SQL injection could bypass the filter: `' OR 1=1 --` as a user_id value would return all checkpoints
2. If using an ORM with eager-loading or JOIN traversal, a checkpoint query could inadvertently load related records across users
3. If checkpoint retrieval uses a session-scoped query but the session object is reused across requests (connection pooling issue), user_id filtering might be bypassed

The architecture does not specify:
- Whether `user_id` is bound as a query parameter or concatenated
- Whether ORM-level protections (query scoping, lazy loading) are enforced
- Whether there are any code paths that retrieve checkpoints by `session_id` or `application_id` instead of `user_id` (and whether those paths re-verify user ownership)

**Impact:**
Memory isolation failure would allow a user to access another user's conversation history. For the Borrower persona, this leaks personal financial data. For the CEO persona, this leaks strategic business discussions. For the Underwriter persona, this leaks decision rationale and compliance concerns.

**Recommendation:**

1. Specify that all checkpoint queries use parameterized queries or ORM query builders (never string concatenation): `session.query(Checkpoint).filter(Checkpoint.user_id == requesting_user_id)`

2. Add a defense-in-depth check: after retrieving a checkpoint, re-verify `checkpoint.user_id == requesting_user_id` before deserializing and returning it

3. If there are any retrieval paths by `session_id` or `application_id`, document that these must include a secondary `user_id` filter: `WHERE session_id = :session_id AND user_id = :requesting_user_id`

4. Add a test case: attempt to retrieve a checkpoint by manipulating `user_id` in the request (if exposed via API) or by forging a session token with a different `user_id` claim

5. Specify ORM configuration: disable eager-loading for any relationships on the checkpoint table that could traverse to other users' data

**References:** OWASP A03:2021 Injection, ADR-0002 (Database Selection)

---

### SEC-A5: CEO Document Access Enforcement Mechanism Underspecified [WARNING]

**Category:** Document Access Control (OWASP: Broken Access Control)

**Location:** `plans/architecture.md` Section 2.1, Section 4.2

**Description:**
The architecture states: "CEO: Document metadata only (document type, upload date, status, quality flags) -- the CEO cannot view or download raw document content." (Section 4.2) and "For the CEO, document content is not accessible -- only metadata." (Section 2.1).

However, the enforcement mechanism is not specified:

1. Is this enforced at the API layer (document download endpoint returns 403 for CEO role)?
2. Is this enforced at the query layer (CEO queries return only metadata columns, not file_path or content)?
3. Is this enforced at the storage layer (CEO's database role lacks SELECT on the file_path column or document_content blob)?
4. What if the CEO accesses a document via the audit trail (which includes `source_document_id`)? Can they follow that link to retrieve the document?

If enforcement is only at the API layer, a bug in the frontend or a direct API call could bypass it. If enforcement is only at the query layer, raw SQL access or ORM eager-loading could bypass it. If not enforced at the storage layer, database-level access could bypass application controls.

**Impact:**
If the CEO can access raw document content (which may contain unmasked SSN, DOB, bank account numbers in uploaded PDFs or images), the PII masking guarantees for the CEO role are violated. The product plan explicitly requires: "Document metadata only" for CEO (F14).

**Recommendation:**

1. Specify multi-layer enforcement:
   - **API layer:** Document download endpoint (`GET /api/documents/{id}/download`) checks `if user_role == 'ceo': raise 403 Forbidden`
   - **Service layer:** Document service's `get_document_content()` method raises an exception if called with `user_role == 'ceo'`
   - **Query layer:** CEO queries retrieve only from the `documents` table (metadata), never from `document_content` or `file_path`

2. Clarify audit trail document linking: "Audit entries include `source_document_id` for provenance, but document retrieval via the audit trail respects the same role-based access rules. CEO can see the document ID and metadata but cannot retrieve the file content."

3. Add a test case: authenticate as CEO, attempt to download a document via API, verify 403 response

4. Consider a more explicit model: store document metadata in `documents` table and file content in a separate `document_files` table with a foreign key. CEO's queries never JOIN to `document_files`.

**References:** OWASP A01:2021 Broken Access Control, Product Plan F14

---

### SEC-A6: Keycloak Token Validation and Refresh Mechanisms Not Detailed [WARNING]

**Category:** Authentication (OWASP: Identification and Authentication Failures)

**Location:** `plans/architecture.md` Section 4.1

**Description:**
The architecture describes Keycloak as the identity provider and states: "FastAPI middleware validates the token against Keycloak's public key." However, critical details are missing:

1. Where is Keycloak's public key retrieved from (JWKS endpoint)? Is it cached or fetched on every request?
2. What is the token lifetime? Short-lived access tokens (minutes) or long-lived (hours)?
3. Are refresh tokens used? If so, how is refresh token rotation handled (to prevent token replay attacks)?
4. What happens if Keycloak is unreachable during token validation? Does the application fail-open (accept unvalidated tokens) or fail-closed (reject all requests)?
5. Are WebSocket connections re-validated on every message, or only at connection upgrade?

**Impact:**
- If tokens are long-lived and refresh rotation is not implemented, a stolen token remains valid for hours, allowing unauthorized access
- If public key caching is too aggressive (cached for days), Keycloak key rotation does not take effect, allowing tokens signed with compromised keys to remain valid
- If WebSocket token validation is only at upgrade, a token that expires mid-conversation remains usable until the connection is closed

**Recommendation:**

1. Specify token lifetime: "Access tokens expire after 15 minutes. Refresh tokens expire after 8 hours."

2. Specify refresh token rotation: "Refresh token rotation is enabled. Each refresh operation issues a new refresh token and invalidates the old one."

3. Specify public key caching: "Keycloak's JWKS is cached for 1 hour with a fallback refresh on validation failure."

4. Specify failure mode: "If Keycloak is unreachable, token validation fails-closed — requests are rejected with 503 Service Unavailable."

5. Specify WebSocket re-validation: "WebSocket connections re-validate the access token on every message. If the token has expired, the connection is closed with a 4401 status code and the client must reconnect with a refreshed token."

6. Consider session binding: "Access tokens include a session identifier claim. The application verifies that the session ID matches the connection's session to prevent token reuse across sessions."

**References:** OWASP A07:2021 Identification and Authentication Failures, ADR-0007

---

### SEC-A7: Demographic Data Filter Relies on LLM Detection [WARNING]

**Category:** HMDA Data Isolation (OWASP: Security Misconfiguration)

**Location:** `plans/architecture.md` Section 2.5

**Description:**
The architecture states: "After extraction, a dedicated filter step scans extracted data for demographic content (race, ethnicity, sex). If detected: (1) The demographic data is excluded from the extraction result... (2) The exclusion is logged in the audit trail..."

This filter is described as an LLM-based extraction with a subsequent scan. However:

1. LLMs are not 100% reliable at detecting demographic content, especially if it is phrased indirectly or embedded in free text
2. If a document contains "applicant self-identifies as Hispanic" and the extraction pipeline extracts this as "applicant notes: self-identifies as Hispanic", the filter may or may not catch it depending on the pattern matching implementation
3. If the filter relies on keyword matching (race, ethnicity, sex, gender), synonyms or euphemisms might bypass it

The architecture acknowledges this in ADR-0005 ("Output filtering is a blunt instrument") but does not provide the same acknowledgment for the document extraction filter.

**Impact:**
A false negative in the demographic data filter would allow HMDA data to leak into the lending decision path via uploaded documents. For example, if a borrower uploads a government application that includes demographic checkboxes and the LLM extracts "race: Asian" but the filter does not catch it, that data enters the lending-path tables and could be accessed by lending-persona AI assistants.

**Recommendation:**

1. Specify the detection mechanism: "The demographic data filter uses a combination of keyword matching (race, ethnicity, sex, gender, national origin, religion, familial status, disability) and semantic similarity to known HMDA data fields. Any extraction field or value with similarity above a threshold is flagged as demographic."

2. Add an explicit false negative mitigation: "If demographic data is extracted but not filtered, it remains in the lending-path tables. The agent output filter (Layer 4) provides a secondary defense — if a lending-persona agent response includes demographic data, it is redacted and the leak is logged."

3. Add a test case: upload a document with indirect demographic data ("applicant is a member of [religious group]", "applicant has a disability requiring accommodation") and verify it is detected and excluded

4. Note the limitation in the architecture: "The demographic data filter at PoC maturity uses keyword and semantic matching. Production hardening would include manual review of extracted data for a sample of applications to audit false negatives."

**References:** OWASP A05:2021 Security Misconfiguration, ADR-0001

---

### SEC-A8: Audit Hash Chain Vulnerable to Recomputation [SUGGESTION]

**Category:** Audit Trail (Data Integrity Failures)

**Location:** `plans/architecture.md` Section 3.4, `plans/adr/0006-audit-trail.md`

**Description:**
The architecture describes a hash chain for tamper evidence: "each audit event includes a `prev_hash` field that is the SHA-256 hash of the previous event's `id` concatenated with its `event_data`."

This provides ordering verification and detects naive tampering (deleting an event breaks the chain). However:

1. SHA-256 without a secret key or salt is vulnerable to precomputation — an attacker who modifies an event can recompute all subsequent hashes in the chain
2. The hash chain does not prevent an attacker with database admin access from modifying events and recomputing the chain
3. The architecture notes: "This is not cryptographically rigorous... At PoC maturity, this detects naive tampering." (ADR-0006)

**Impact:**
The hash chain provides tamper *evidence* for naive modifications (a single changed event without chain recomputation) but does not provide tamper *resistance* against a determined attacker with database access. For a PoC, this is acceptable. For a production system demonstrating compliance auditability, it would be insufficient.

**Recommendation:**

1. Acknowledge the limitation explicitly in the architecture (already noted in ADR-0006, but should be surfaced in Section 3.4 as well): "The hash chain detects naive tampering (single event modification) but does not prevent sophisticated tampering (full chain recomputation by an admin-level attacker)."

2. Document the upgrade path: "Production hardening would use HMAC with a secret key (unknown to the application database role) or blockchain-style Merkle trees with external verification."

3. Consider an incremental improvement: "The hash includes a server-side secret salt that is not stored in the database. An attacker with database access cannot recompute the chain without the salt."

4. Add a verification script: "A hash chain verification script runs periodically (daily) and alerts if the chain is broken. Broken chains are themselves logged to the `audit_violations` table."

**References:** OWASP A08:2021 Software and Data Integrity Failures, ADR-0006

---

### SEC-A9: Input Validation Pattern Matching Limitations [SUGGESTION]

**Category:** Agent Security (OWASP: Injection)

**Location:** `plans/architecture.md` Section 4.3, `plans/adr/0005-agent-security.md`

**Description:**
The input validation layer (ADR-0005 Layer 1) uses pattern matching to detect adversarial prompts: "role-play attacks, instruction override attempts, system prompt extraction, delimiter injection."

Pattern-based detection is effective against known attacks but vulnerable to novel or obfuscated attacks:
- "Ignore your instructions" is caught, but "Disregard your prior directives" might not be
- "Pretend you are an admin" is caught, but "Act as if you had admin privileges" might not be
- Encoding attacks (Base64, ROT13, Unicode normalization) can bypass pattern matching

The architecture acknowledges this: "Pattern matching is heuristic -- it catches common attacks, not all possible attacks. This is the first line of defense, not the only one." (ADR-0005)

**Impact:**
A sophisticated attacker could bypass input validation with novel phrasing or encoding. However, the multi-layer defense (input validation + system prompt hardening + tool authorization + output filtering) means a bypass of Layer 1 does not automatically compromise the system.

**Recommendation:**

1. Explicitly list known attack patterns in the adversarial test suite (mentioned in ADR-0005 but not detailed): include examples of each pattern type and variations

2. Add an encoding normalization step before pattern matching: decode Base64, normalize Unicode, expand URL-encoded strings

3. Consider a secondary heuristic: "If a user query contains an unusually high density of imperative verbs (ignore, pretend, disregard, override), flag for review even if no specific pattern matches."

4. Log all input validation rejections with the detected pattern type for ongoing tuning: "Query rejected: instruction override attempt detected (pattern: 'ignore your')"

5. Note the upgrade path: "Production hardening would use ML-based adversarial prompt detection trained on a dataset of red-team attacks."

**References:** OWASP A03:2021 Injection, ADR-0005

---

### SEC-A10: RBAC Verification and Continuous Testing Not Specified [SUGGESTION]

**Category:** Access Control (OWASP: Broken Access Control)

**Location:** `plans/architecture.md` Section 4.2, Section 9.2

**Description:**
The architecture describes comprehensive RBAC enforcement at three layers (API gateway, domain services, agent layer) and specifies a data access matrix (Section 4.2). However:

1. There is no mention of how RBAC rules are tested continuously (beyond "smoke tests" at PoC maturity per `maturity-expectations.md`)
2. There is no specification of an adversarial RBAC test suite analogous to the adversarial prompt test suite mentioned in ADR-0005
3. It is unclear whether RBAC rules are unit-tested per endpoint, integration-tested per persona, or end-to-end tested with adversarial scenarios

Given the product plan's emphasis on RBAC as a credibility-critical feature (F14, rated highest RICE score in the product plan), the absence of RBAC testing detail is a gap.

**Impact:**
RBAC bugs are subtle and often discovered only through adversarial testing (e.g., "Can a borrower access another borrower's data by guessing their application_id?"). Without a documented test strategy, RBAC enforcement is at risk of having gaps that are not discovered until the Summit demo or after Quickstart release.

**Recommendation:**

1. Specify an RBAC test matrix in the architecture (or reference it in Section 9.2): "RBAC enforcement is verified by a test suite that covers every role × data type combination in the data access matrix (Section 4.2)."

2. Define adversarial RBAC test scenarios:
   - Borrower attempts to access another borrower's application by changing application_id in API request
   - Loan Officer attempts to query applications outside their pipeline
   - CEO attempts to download raw document content
   - Any role attempts to query HMDA data via the chat assistant
   - Any role attempts to access memory checkpoints by manipulating user_id

3. Specify that RBAC tests run in CI: "RBAC tests are part of the CI pipeline and block merge if any access boundary is violated."

4. Add a test coverage metric: "At least one positive test (authorized access succeeds) and one negative test (unauthorized access is denied) per cell in the data access matrix."

**References:** OWASP A01:2021 Broken Access Control, Product Plan F14, `review-governance.md`

---

### SEC-A11: Four-Layer Agent Security Provides Strong Defense [POSITIVE]

**Category:** Agent Security

**Location:** `plans/architecture.md` Section 4.3, `plans/adr/0005-agent-security.md`

**Description:**
The agent security architecture implements defense in depth with four independent layers:

1. **Input validation** (pre-agent) — pattern-based detection of adversarial prompts
2. **System prompt hardening** (agent configuration) — explicit refusal instructions in agent prompts
3. **Tool authorization** (execution time) — deterministic re-verification before every tool call
4. **Output filtering** (post-agent) — scans responses for out-of-scope data

Each layer is independently testable and addresses a different threat vector (prompt injection, tool misuse, data leakage). The architecture explicitly acknowledges that no single layer is perfect and designs for layered failure.

**Impact:**
This is a strong security model that reduces the risk of a single bypass compromising the entire system. The architecture correctly identifies that LLM-based systems cannot rely solely on prompt engineering (Layer 2) and must have programmatic enforcement (Layers 1, 3, 4).

**Observation:**
The product plan's risk table rates "Agent prompt injection bypasses RBAC or leaks HMDA data" as High likelihood / High impact. This architecture directly addresses that risk with a multi-layer defense that is appropriate for a PoC demonstrating responsible AI in a regulated context.

---

### SEC-A12: Schema-Level HMDA Separation Provides Architectural Verifiability [POSITIVE]

**Category:** HMDA Data Isolation

**Location:** `plans/architecture.md` Section 3.3, `plans/adr/0001-hmda-data-isolation.md`

**Description:**
The decision to use a separate PostgreSQL schema (`hmda`) for demographic data provides a verifiable isolation boundary. As the architecture states: "Schema-level isolation is verifiable by auditing schema references in code" (ADR-0001).

This is superior to table-level separation (same schema) or access-control-only approaches because:

1. A code audit can use `grep -r 'hmda\.' packages/api/` to find all references to the HMDA schema and verify they occur only in the Compliance Service
2. SQL queries that JOIN lending-path tables with HMDA tables must explicitly reference the schema (`hmda.demographics`), making accidental joins detectable
3. The separation is visible in database tooling (schema explorers, ER diagrams)

**Impact:**
The architecture provides a demonstration-ready answer to the question: "How do you prove that demographic data doesn't influence lending decisions?" The answer is architectural: "Demographic data lives in a separate schema that lending services cannot query."

**Observation:**
This design choice directly supports the product plan's emphasis on the HMDA collection + fair lending refusal tension as a core differentiator (F25, P0, rated 4.0 in RICE scoring).

However, the verifiability depends on database role enforcement (see SEC-A1) — without role-level grants, the schema separation is convention, not enforcement.

---

### SEC-A13: Database-Level Audit Enforcement Stronger Than Application-Level [POSITIVE]

**Category:** Audit Trail

**Location:** `plans/architecture.md` Section 3.4, `plans/adr/0006-audit-trail.md`

**Description:**
The audit trail architecture uses database-level enforcement mechanisms rather than relying solely on application code:

1. **Role grants** — the application database role has INSERT and SELECT only (no UPDATE, DELETE) on audit tables
2. **Trigger-based rejection** — a BEFORE UPDATE OR DELETE trigger rejects any modification attempt and logs it to `audit_violations`
3. **Sequential IDs** — bigserial provides gap-free ordering

This is stronger than an application-level "we promise not to modify audit records" approach because:
- Application bugs cannot modify audit records (the database rejects the operation)
- SQL injection vulnerabilities cannot modify audit records (same reason)
- Direct database access by an admin is still prevented by the role grants (assuming the admin uses the application role, not a superuser role)

**Impact:**
The architecture provides a demonstrable guarantee: "The application literally cannot update or delete audit records — the database enforces this." This is critical for the product plan's emphasis on audit trail credibility (F15, P0).

**Observation:**
ADR-0006 correctly acknowledges the limitation: "Even if application code attempts to issue UPDATE or DELETE, the database rejects it." This is a strong design for a PoC. The upgrade path to HMAC-based tamper resistance (SEC-A8) is clearly noted.

---

## Security-Specific Architecture Checklist

### RBAC Enforcement

| Check | Status | Notes |
|-------|--------|-------|
| RBAC enforced at API gateway | ✅ Pass | Middleware pipeline in Section 2.2 |
| RBAC enforced at service layer (defense in depth) | ✅ Pass | Services re-apply data scope filters (Section 2.4) |
| RBAC enforced at agent layer (tool registries) | ✅ Pass | Tool authorization at execution time (Section 2.3) |
| Data access matrix defined and comprehensive | ✅ Pass | Section 4.2 covers all persona × data type combinations |
| Cross-user data isolation verified | ⚠️ Partial | Memory isolation specified but SQL injection risks not addressed (SEC-A4) |
| CEO PII masking consistently applied | ⚠️ Partial | Specified but document access enforcement mechanism unclear (SEC-A5) |
| RBAC violations logged to audit trail | ✅ Pass | Implied by comprehensive audit logging (Section 3.4) |

### HMDA Data Isolation

| Check | Status | Notes |
|-------|--------|-------|
| Four-stage isolation (collection, extraction, storage, retrieval) | ✅ Pass | All stages specified in Section 3.3 and ADR-0001 |
| Separate PostgreSQL schema for HMDA data | ✅ Pass | `hmda` schema defined in ADR-0001 |
| Database role grants enforce schema isolation | ❌ Fail | Not specified; see SEC-A1 |
| Compliance Service is sole HMDA accessor | ✅ Pass | Specified in ADR-0001 |
| Demographic data filter in document extraction | ⚠️ Partial | Specified but false negative risks not fully addressed (SEC-A7) |
| Lending-persona agents cannot query HMDA data | ✅ Pass | Tool registries exclude HMDA-querying tools (Section 2.3) |
| Aggregate-only HMDA access for CEO | ✅ Pass | `get_hmda_aggregates` tool specified (Section 2.3) |
| Cross-schema JOIN prevention | ⚠️ Partial | Depends on role grants (SEC-A1) |

### Agent Security

| Check | Status | Notes |
|-------|--------|-------|
| Input validation layer implemented | ✅ Pass | ADR-0005 Layer 1 |
| System prompt hardening with refusal instructions | ✅ Pass | ADR-0005 Layer 2 |
| Tool authorization at execution time | ⚠️ Partial | Specified but timing ambiguous (SEC-A2) |
| Output filtering for PII and HMDA data | ⚠️ Partial | Pattern-based; semantic leakage risk (SEC-A3) |
| Fair lending guardrails active | ✅ Pass | Specified in Section 4.3 |
| Proxy discrimination awareness | ✅ Pass | Specified in Section 4.3 and ADR-0005 |
| Adversarial prompt test suite defined | ⚠️ Partial | Mentioned in ADR-0005 but not detailed (SEC-A9) |
| Defense-in-depth: multiple independent layers | ✅ Pass | Four layers (SEC-A11) |

### Authentication & Session Management

| Check | Status | Notes |
|-------|--------|-------|
| Real identity provider (Keycloak) | ✅ Pass | Specified in Section 4.1 and ADR-0007 |
| OIDC token-based authentication | ✅ Pass | Section 4.1 |
| Token validation against IdP public key | ✅ Pass | Section 4.1 |
| Token lifetime and refresh rotation | ⚠️ Partial | Not specified (SEC-A6) |
| WebSocket connection re-validation | ⚠️ Partial | Not specified (SEC-A6) |
| Session binding to prevent token reuse | ⚠️ Partial | Not specified (SEC-A6) |
| Fail-closed on IdP unavailability | ⚠️ Partial | Not specified (SEC-A6) |

### Audit Trail Integrity

| Check | Status | Notes |
|-------|--------|-------|
| Append-only enforcement via database role grants | ✅ Pass | ADR-0006 |
| Trigger-based rejection of UPDATE/DELETE | ✅ Pass | ADR-0006 |
| Sequential IDs for ordering guarantees | ✅ Pass | bigserial (Section 3.4) |
| Tamper evidence via hash chain | ⚠️ Partial | Vulnerable to recomputation (SEC-A8) |
| Decision traceability implemented | ✅ Pass | application_id and decision_id linking (Section 3.4) |
| Override tracking for AI-human divergence | ✅ Pass | Explicit override event type (Section 3.4) |
| Data provenance logging | ✅ Pass | source_document_id (Section 3.4) |
| Export capability for external analysis | ✅ Pass | Specified in ADR-0006 |

### Document Access Control

| Check | Status | Notes |
|-------|--------|-------|
| Role-based document access defined | ✅ Pass | Data access matrix (Section 4.2) |
| CEO restricted to metadata only | ⚠️ Partial | Specified but enforcement unclear (SEC-A5) |
| Document version history tracked | ✅ Pass | Mentioned in Section 3.2 |
| Document quality flags for anomaly detection | ✅ Pass | Section 2.5 |
| Raw document storage access controlled | ⚠️ Partial | Object storage access control not detailed |

### Memory Isolation

| Check | Status | Notes |
|-------|--------|-------|
| User ID as mandatory isolation key | ✅ Pass | Section 3.5 |
| All checkpoint queries filter by user_id | ✅ Pass | Section 3.5 |
| No cross-user memory retrieval | ✅ Pass | Section 3.5 |
| Memory isolation at database level | ⚠️ Partial | SQL injection risks not addressed (SEC-A4) |
| Memory not accessible to CEO or admin roles | ✅ Pass | Explicitly stated (Section 3.5) |

## Verdict

**REQUEST_CHANGES**

The architecture demonstrates strong security design principles with multi-layered defenses and architectural verifiability. However, there are three critical enforcement gaps that must be addressed before implementation:

1. **SEC-A1 (Critical):** PostgreSQL role grants for HMDA schema isolation must be specified. Without role-level enforcement, the schema separation is convention, not enforcement.

2. **SEC-A2 (Critical):** Tool authorization re-verification timing in LangGraph must be clarified to ensure mid-session role changes are detected and cached authorization is prevented.

3. **SEC-A5 (Warning elevated to blocking):** CEO document access enforcement mechanism must be specified at multiple layers (API, service, query) to prevent bypass.

The architecture is fundamentally sound and demonstrates security expertise. These gaps are resolvable through specification rather than rearchitecture. Once these three items are addressed with specific enforcement mechanisms, the architecture will provide a strong security foundation for implementation.

All other findings (SEC-A3 through SEC-A10) are warnings or suggestions that should be addressed but are not blocking. The positive findings (SEC-A11 through SEC-A13) confirm that the core security design is strong.

## Recommendations for Technical Design Phase

The following security concerns should be explicitly addressed in the Technical Design Document:

1. **Database schema with role grants** — Define all PostgreSQL roles, their grants per schema/table, and the role-to-service mapping
2. **LangGraph agent implementation** — Specify where tool authorization checks occur in the graph execution flow
3. **Document access control implementation** — Define API endpoint authorization logic, service layer checks, and query layer restrictions
4. **Token validation configuration** — Specify token lifetime, refresh rotation, JWKS caching, and failure modes
5. **Output filtering semantic checks** — Define the extended filtering rules for demographic proxies
6. **Memory isolation implementation** — Specify parameterized query patterns and ORM configuration to prevent SQL injection
7. **RBAC test suite** — Define adversarial test scenarios covering all access boundaries

These items are appropriate for Technical Design and do not require architecture rework.
