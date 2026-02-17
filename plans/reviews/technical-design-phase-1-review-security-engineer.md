# Technical Design Phase 1 Review: Security Engineer

**Artifact:** Technical Design Phase 1 (hub + 4 chunks)
**Reviewer:** Security Engineer
**Date:** 2026-02-16
**Verdict:** REQUEST_CHANGES

## Summary

Phase 1 Technical Design establishes a strong foundation for security with multi-layer RBAC enforcement, database-level HMDA isolation, and proper JWT validation. However, there are critical security issues that must be addressed before implementation: token storage in the frontend uses memory-only storage which will not survive page refreshes, the Keycloak realm configuration includes hardcoded demo passwords in version control, the HMDA demographic filter uses only keyword-based detection which is insufficient for semantic demographic references, and several error handling paths leak implementation details.

The three-layer RBAC pattern is architecturally sound, the dual PostgreSQL role separation is correctly implemented, and the PKCE flow configuration is properly secured. The audit trail immutability enforcement is robust. However, fixes are required for token persistence, secrets management, and error message sanitization.

## Findings

### Critical

#### C-01: Hardcoded Demo Passwords in Keycloak Realm Configuration

**Category:** Secrets Management (OWASP: Security Misconfiguration)
**Location:** `plans/technical-design-phase-1.md` lines 556-602 (Keycloak Realm Configuration), `config/keycloak/summit-cap-realm.json`
**Description:** The Keycloak realm JSON includes hardcoded passwords in cleartext (`"value": "demo123"` for demo users, `"value": "admin123"` for admin). This file is committed to version control per the hub document Section "Keycloak Realm Configuration".

**Impact:**
- Demo passwords are exposed in version control history permanently
- If this configuration is used in any non-local environment (staging, internal demo), these credentials become public knowledge
- An attacker with repository access gains admin credentials to Keycloak

**Recommended Resolution:**
1. Remove all `credentials` blocks from the realm JSON file
2. Document in README that demo user passwords must be set post-import via Keycloak admin console or environment-driven import script
3. Alternatively, use environment variable substitution in the realm JSON at import time: `"value": "${DEMO_USER_PASSWORD}"` and inject from compose environment
4. Add `.env.example` entry: `DEMO_USER_PASSWORD=changeme` with clear documentation that this MUST be changed for any non-local deployment
5. Add secrets scanning to CI to prevent credential commits

**References:**
- OWASP A05:2021 Security Misconfiguration
- `.claude/rules/security.md` § Secrets: "Never hardcode secrets"

---

#### C-02: Frontend Token Storage Loses Tokens on Page Refresh

**Category:** Authentication (OWASP: Identification and Authentication Failures)
**Location:** `plans/technical-design-phase-1-chunk-ui.md` lines 184-186, 244
**Description:** The auth.ts implementation returns tokens in the `AuthUser` object and the documentation states "Frontend stores tokens in memory (not localStorage for security)" (line 26). The keycloak-js adapter is initialized with `onLoad: "check-sso"` which will not recover tokens after page refresh if they are only in memory.

**Impact:**
- Users lose authentication state on every page refresh
- Forces re-login on every navigation that causes a full page load
- Poor user experience that may lead developers to unsafely store tokens in localStorage as a workaround
- Session state is lost, breaking the "cross-session memory" requirement (F19)

**Recommended Resolution:**
1. Use keycloak-js token management: do not extract `accessToken` and `refreshToken` into application state
2. Let keycloak-js manage token storage in its internal mechanism (it uses sessionStorage for tab-scoped persistence and handles refresh automatically)
3. Update `extractUser()` to return only user metadata (id, email, name, role) — not tokens
4. Update `getAccessToken()` to return `kc.token` directly from the keycloak instance
5. Document in auth.ts that keycloak-js uses sessionStorage (tab-scoped, cleared on tab close) which balances security and usability
6. If absolute memory-only storage is required, document that page refresh will lose auth state and this is intentional

**References:**
- OWASP A07:2021 Identification and Authentication Failures
- Keycloak JavaScript Adapter documentation on token handling

---

#### C-03: SQL Injection Risk in Audit Event Hashing

**Category:** Injection (OWASP: Injection)
**Location:** `plans/technical-design-phase-1.md` lines 900-939 (Audit Trail Integration), specifically line 908
**Description:** The hash chain computation uses f-string interpolation to construct a hash input: `hash_input = f"{prev.id}:{prev.prev_hash}"`. While `prev.id` is an integer from the database and `prev.prev_hash` is a string from a prior hash (both controlled data), the broader pattern of using raw SQL with text() is fragile. Additionally, the INSERT statement at line 912 uses `:event_data::jsonb` parameter binding which is correct, but the initial SELECT query uses raw interpolation.

**Impact:**
- If the hash chain logic is ever extended to include user-controlled fields, SQL injection becomes possible
- The use of `text()` with manual parameter binding is more fragile than using SQLAlchemy ORM or query builder APIs

**Recommended Resolution:**
1. Use SQLAlchemy `select()` query builder for the initial SELECT: `select(AuditEvent.id, AuditEvent.prev_hash).order_by(AuditEvent.id.desc()).limit(1)`
2. This eliminates all raw SQL in the audit event writer except the INSERT (which uses parameter binding)
3. Add explicit comment: "Do not add user-controlled fields to hash chain computation without sanitization"
4. Consider using the ORM insert() statement builder instead of text() for consistency

**References:**
- OWASP A03:2021 Injection
- SQLAlchemy documentation on query builders

---

### Warning

#### W-01: HMDA Demographic Filter Uses Keyword-Only Detection

**Category:** Data Integrity (OWASP: Insecure Design)
**Location:** `plans/technical-design-phase-1-chunk-data.md` lines 777-856 (demographic_filter.py)
**Description:** The demographic data filter (Stage 2 of HMDA isolation) uses only keyword matching with a hardcoded pattern list. The design acknowledges this: "Phase 1: keyword-based detection only. Phase 2+: add semantic similarity when embedding model is available" (line 787). However, demographic references can be semantic without using explicit keywords (e.g., "applicant is from a community with historical redlining", "family background in [ethnicity-coded cultural reference]").

**Impact:**
- Demographic data can leak into the lending path if expressed indirectly
- Undermines HMDA isolation Stage 2 effectiveness
- Creates compliance risk if the system is used for actual lending decisions

**Recommended Resolution:**
1. Document in the filter module header: "WARNING: Phase 1 keyword-only filter is insufficient for production use. Semantic detection required."
2. Add a runtime warning log on first filter invocation: "Demographic filter operating in keyword-only mode. Semantic detection not yet implemented."
3. Add explicit requirement to Phase 2 scope: implement semantic similarity detection using embedding model before any production use
4. Consider adding a "confidence level" to the filter result (HIGH for keyword match, UNKNOWN for no match) and log all UNKNOWN cases for manual review during demo

**References:**
- OWASP A04:2021 Insecure Design
- ADR-0001 Stage 2 (Extraction Filter)

---

#### W-02: Database Role Passwords in Init Script Are Weak

**Category:** Security Misconfiguration (OWASP: Security Misconfiguration)
**Location:** `plans/technical-design-phase-1-chunk-infra.md` lines 831-837 (01-roles.sql)
**Description:** The PostgreSQL init script creates roles with hardcoded passwords: `lending_app` with password `'lending_pass'` and `compliance_app` with password `'compliance_pass'`. These are trivially guessable.

**Impact:**
- In local development: minimal risk (PostgreSQL not exposed)
- If compose.yml is accidentally used in any networked environment: database is wide open
- Sets a bad precedent that may be copied into production configurations

**Recommended Resolution:**
1. Use environment variable substitution: `CREATE ROLE lending_app WITH LOGIN PASSWORD '${LENDING_APP_PASSWORD}';`
2. Update compose.yml to inject passwords from environment variables
3. Update `.env.example` with strong default passwords: `LENDING_APP_PASSWORD=<random 32-char string>`
4. Document in README: "Generate new database passwords before deploying to any non-local environment"
5. Add note in init script: "DO NOT use these passwords in production"

**References:**
- OWASP A05:2021 Security Misconfiguration
- `.claude/rules/security.md` § Secrets

---

#### W-03: Error Responses Leak Implementation Details

**Category:** Information Disclosure (OWASP: Security Misconfiguration)
**Location:** Multiple locations across chunk files
**Description:** Several error handling paths return implementation details to the user:

1. `plans/technical-design-phase-1-chunk-auth.md` line 232: `"Authentication service unavailable"` on Keycloak down reveals dependency on external auth service
2. `plans/technical-design-phase-1-chunk-data.md` line 634: Database errors log "DSN (without password)" but still reveal connection string structure
3. `plans/technical-design-phase-1-chunk-auth.md` line 230: JWT validation failure message `"Invalid authentication token"` is correct, but the log message `"JWT validation failed after JWKS refresh: %s"` with exception details may leak key details if logs are accessible

**Impact:**
- Attackers learn about system architecture (Keycloak, PostgreSQL, connection topology)
- Error messages guide reconnaissance and targeted attacks
- At PoC maturity this is acceptable, but needs hardening for production

**Recommended Resolution:**
1. Review all error responses for implementation detail leakage
2. For external APIs: return generic errors ("Service temporarily unavailable") with request_id for support
3. For logs: detailed errors are acceptable, but ensure logs are not exposed to unauthenticated users
4. Add security checklist item for Phase 4b: "Sanitize all error responses for production"
5. Document error handling strategy in architecture: "PoC: detailed errors acceptable. Production: generic user-facing errors, detailed logs only."

**References:**
- OWASP A05:2021 Security Misconfiguration
- CWE-209: Generation of Error Message Containing Sensitive Information

---

#### W-04: JWKS Cache Busting on Signature Failure May Enable Timing Attack

**Category:** Cryptographic Implementation (OWASP: Cryptographic Failures)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` lines 136-139, 211-230
**Description:** The JWKS client implementation caches JWKS for 5 minutes but busts the cache on signature verification failure (line 222). An attacker can measure response time differences: valid token with cached JWKS (fast) vs. invalid token triggering JWKS refresh (slow). This leaks information about token validity timing.

**Impact:**
- Side-channel information leakage about token validity
- Attacker can distinguish between "token format invalid" (no JWKS fetch) and "token signature invalid" (JWKS fetch triggered)
- Low severity because the information gained is minimal, but violates defense-in-depth

**Recommended Resolution:**
1. Add jitter to JWKS cache expiration: instead of fixed 5 minutes, use `random.uniform(240, 360)` seconds
2. On signature failure: check if cache is older than 4 minutes before busting. If cache is fresh, assume the token is genuinely invalid (not a key rotation event)
3. Log JWKS refresh events with timestamp to detect excessive refreshes (potential DoS or scanning)
4. Consider: do not bust cache on first signature failure; bust only on second failure within a short window (indicates likely key rotation)

**References:**
- OWASP A02:2021 Cryptographic Failures
- CWE-208: Observable Timing Discrepancy

---

#### W-05: PII Masking Middleware Fails Open on Unexpected Data Structure

**Category:** Data Protection (OWASP: Cryptographic Failures)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` lines 456-493
**Description:** The PII masking middleware catches exceptions during masking and returns 500 (line 483-491), which is correct (fail closed). However, the error log at line 485 includes `exc_info=True` which logs the full stack trace including potentially the unmasked data structure that caused the error.

**Impact:**
- Unmasked PII may appear in application logs if masking fails
- Logs are typically accessible to developers and operators, creating a PII exposure path
- Undermines the CEO document access restriction (REQ-CC-03)

**Recommended Resolution:**
1. Change error logging to NOT include `exc_info=True`: log only `"PII masking failed for CEO request -- returning 500"`
2. Add a separate sanitized log message: `logger.debug("Masking failed on data type: %s", type(data).__name__)` (type info only, no data)
3. Document in middleware: "Do not log data structures from masking failures — they may contain unmasked PII"
4. Add test case: trigger masking failure with mock PII data, verify logs do not contain PII

**References:**
- OWASP A02:2021 Cryptographic Failures
- `.claude/rules/security.md` § Logging

---

#### W-06: No Rate Limiting on Authentication Endpoints

**Category:** Authentication (OWASP: Identification and Authentication Failures)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` (auth implementation, no rate limiting specified)
**Description:** The authentication middleware validates JWT tokens on every request but does not implement rate limiting. An attacker can attempt token brute-forcing or JWT scanning attacks against the API.

**Impact:**
- API endpoints vulnerable to authentication bypass attempts via brute force
- No defense against token scanning (trying many tokens to find a valid one)
- At PoC maturity: acceptable risk (demo environment, no real data)
- For production: critical gap

**Recommended Resolution:**
1. Add requirement to Phase 2 or Phase 4b: implement rate limiting on all authenticated endpoints
2. Suggested implementation: fastapi-limiter with Redis backend (Redis already in stack for LangFuse)
3. Rate limit strategy: 100 requests/minute per IP for authenticated endpoints, 10 requests/minute per IP for auth failures
4. Document in architecture: "Phase 1: no rate limiting (PoC acceptable). Phase 4b: add rate limiting before production."

**References:**
- OWASP A07:2021 Identification and Authentication Failures
- `.claude/rules/security.md` § Authentication & Authorization: "Implement rate limiting on authentication endpoints"

---

#### W-07: Agent Tool Authorization Registry Hardcoded in Python Module

**Category:** Configuration Management (OWASP: Security Misconfiguration)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` lines 525-541 (tool_auth.py)
**Description:** The tool authorization registry (`TOOL_AUTHORIZATION` dict) is hardcoded in Python at lines 528-541 with a comment "This is loaded from config/agents/*.yaml in production." However, the `load_tool_auth_from_config()` function (lines 585-600) is defined but not used in the initialization path.

**Impact:**
- Tool authorization changes require code deployment, not configuration update
- Risk of production/dev authorization drift if config is updated but code is not
- Makes security audits harder (need to check both code and config)

**Recommended Resolution:**
1. Initialize `TOOL_AUTHORIZATION` by loading from config on module import: `TOOL_AUTHORIZATION = _load_default_tool_auth()`
2. Define `_load_default_tool_auth()` that aggregates all `config/agents/*.yaml` files using `load_tool_auth_from_config()`
3. Fallback to the hardcoded dict only if config files are missing (with loud warning log)
4. Document: "Tool authorization is config-driven. Hardcoded fallback is for testing only."
5. Add test case: verify that modifying `config/agents/public-assistant.yaml` tool allowed_roles changes authorization behavior

**References:**
- OWASP A05:2021 Security Misconfiguration
- REQ-CC-21: Agent configuration

---

### Suggestion

#### S-01: Add Security Headers to API Responses

**Category:** Security Hardening (OWASP: Security Misconfiguration)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` lines 604-648 (main.py middleware setup)
**Description:** The FastAPI app configures CORS but does not set security headers (Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security).

**Impact:**
- Missing defense-in-depth for XSS, clickjacking, and MIME-sniffing attacks
- At PoC maturity: low risk (controlled environment)
- For production: standard security practice

**Recommended Resolution:**
1. Add a security headers middleware to main.py:
```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```
2. For HTTPS environments, add: `response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"`
3. Document in compose.yml comment: "Security headers added in middleware. HSTS only for HTTPS deployments."

**References:**
- OWASP A05:2021 Security Misconfiguration
- OWASP Secure Headers Project

---

#### S-02: Add Token Expiry Warning to UI

**Category:** Usability and Security (OWASP: Identification and Authentication Failures)
**Location:** `plans/technical-design-phase-1-chunk-ui.md` lines 286-296 (useAuth hook)
**Description:** The frontend checks token expiry every 30 seconds and refreshes proactively (line 287-294). However, there is no user-facing warning when the token is about to expire and refresh may fail.

**Impact:**
- User experiences unexpected logout if refresh token expires while idle
- No opportunity to save work or extend session before forced logout
- Poor user experience, especially during long-running tasks

**Recommended Resolution:**
1. Add state to AuthProvider: `tokenExpiryWarning: boolean`
2. Set warning to true when access token has < 2 minutes remaining and refresh token has < 5 minutes remaining
3. Display a banner: "Your session is expiring soon. Please save your work."
4. Add "Extend Session" button that triggers proactive refresh
5. Log warning events to help diagnose session timeout issues

**References:**
- OWASP A07:2021 Identification and Authentication Failures
- User experience best practices for session management

---

#### S-03: Document Security Review Checklist for Phase 2+

**Category:** Process (Security Governance)
**Location:** Applies to all future phases
**Description:** Phase 1 establishes foundational security controls but does not define a security review checklist for subsequent phases. As new features are added (document upload, chat, agent tools), each phase should have a security review gate.

**Impact:**
- Risk of security regressions as new features are added
- No systematic way to ensure security controls are maintained across phases

**Recommended Resolution:**
1. Create `docs/security-review-checklist.md` with phase-specific checks:
   - Phase 2: Document upload validation, file type restrictions, size limits, virus scanning integration point
   - Phase 3: WebSocket authentication, chat input sanitization, agent prompt injection resistance
   - Phase 4: Production secrets management, HTTPS enforcement, rate limiting, security monitoring
2. Integrate checklist into workflow-patterns skill: "Security review required for Phases 2, 3, 4b"
3. Add checklist template to `.claude/rules/review-governance.md` § Two-Agent Review

**References:**
- `.claude/rules/review-governance.md`
- Secure SDLC best practices

---

### Positive

#### P-01: Three-Layer RBAC Pattern Is Architecturally Sound

**Category:** Access Control (OWASP: Broken Access Control)
**Location:** `plans/technical-design-phase-1.md` lines 709-738, `plans/technical-design-phase-1-chunk-auth.md` lines 264-451
**Description:** The three-layer RBAC enforcement pattern (API middleware, domain services, agent tool authorization) provides defense-in-depth. Even if the API middleware is bypassed, the service layer re-applies data scope filters (lines 409-428), and the agent layer checks tool authorization before every invocation (lines 496-600).

**Strength:**
- Multiple independent enforcement points prevent single-point-of-failure authorization bypasses
- Data scope injection pattern (lines 409-428) ensures loan officers only see their own pipeline regardless of which code path is taken
- Agent tool authorization framework (lines 496-600) is configuration-driven and independently testable

**References:**
- REQ-CC-01: Three-layer RBAC enforcement
- OWASP A01:2021 Broken Access Control (prevention)

---

#### P-02: HMDA Isolation Has Multiple Independent Barriers

**Category:** Data Protection (Compliance)
**Location:** `plans/technical-design-phase-1.md` lines 777-863, `plans/technical-design-phase-1-chunk-data.md` lines 1-1038
**Description:** The HMDA isolation design uses five independent barriers:

1. **Separate PostgreSQL schema** (hmda vs. public)
2. **Separate database roles** (lending_app vs. compliance_app) with explicit REVOKE on cross-access
3. **Separate connection pools** enforced at the application layer
4. **Module isolation** with CI lint check preventing code-level access
5. **Demographic data filter** in extraction pipeline (keyword-based in Phase 1, semantic in Phase 2+)

**Strength:**
- Failure of any single barrier does not compromise isolation
- Database-level enforcement (roles + schema) provides the strongest guarantee
- CI lint check catches accidental violations before deployment
- The dual-role pattern is elegant and maps cleanly to the compliance/lending separation

**References:**
- ADR-0001: HMDA Data Isolation Architecture
- REQ-CC-05 through REQ-CC-07

---

#### P-03: Audit Trail Immutability Is Database-Enforced

**Category:** Audit and Accountability (Compliance)
**Location:** `plans/technical-design-phase-1.md` lines 865-939, `plans/technical-design-phase-1-chunk-data.md` lines 355-411, 546-568
**Description:** The audit trail design uses multiple database-level enforcement mechanisms:

1. **Role grants:** lending_app has INSERT+SELECT only (line 816)
2. **Database trigger:** BEFORE UPDATE/DELETE trigger rejects modifications (lines 546-560)
3. **Audit violations table:** Rejected modification attempts are logged (lines 550-551)
4. **Hash chain:** Each event includes `prev_hash` for tamper evidence (lines 383, 898-910)
5. **Advisory locks:** PostgreSQL advisory locks ensure serial hash chain integrity (lines 899, 938)

**Strength:**
- Immutability is enforced at the database level, not just application convention
- Tamper attempts are recorded in `audit_violations` table
- Hash chain provides cryptographic tamper evidence (PoC-level; production would add HMAC)
- Design supports both append-only enforcement (operational requirement) and tamper detection (compliance requirement)

**References:**
- ADR-0006: Audit Trail Architecture
- REQ-CC-09: Audit event immutability

---

#### P-04: PKCE Flow Is Correctly Configured

**Category:** Authentication (OWASP: Identification and Authentication Failures)
**Location:** `plans/technical-design-phase-1.md` lines 527-538, 608, `plans/technical-design-phase-1-chunk-ui.md` lines 179
**Description:** The Keycloak realm configuration correctly enables PKCE for the public client (line 536: `"pkce.code.challenge.method": "S256"`), and the frontend initializes with `pkceMethod: "S256"` (line 179). This prevents authorization code interception attacks.

**Strength:**
- PKCE is mandatory for public clients (SPAs) per OAuth 2.1
- S256 (SHA-256) is the recommended challenge method
- Frontend correctly passes PKCE parameters in init
- No client secrets are configured for the public client (line 530: `"publicClient": true`), which is correct

**References:**
- OAuth 2.1 draft
- OWASP A07:2021 Identification and Authentication Failures (prevention)

---

#### P-05: JWT Validation Includes All Critical Checks

**Category:** Authentication (OWASP: Cryptographic Failures)
**Location:** `plans/technical-design-phase-1-chunk-auth.md` lines 237-246
**Description:** The JWT validation at line 239-246 includes all critical checks: signature verification, audience (`aud`), issuer (`iss`), and expiration (`exp`). The validation uses the `python-jose` library with proper options (line 245: `options={"verify_exp": True, "verify_aud": True, "verify_iss": True}`).

**Strength:**
- Prevents token tampering (signature check)
- Prevents token replay across services (audience check)
- Prevents token from untrusted issuers (issuer check)
- Prevents expired token use (expiration check)
- All checks are explicit and auditable

**References:**
- JWT RFC 7519
- OWASP A02:2021 Cryptographic Failures (prevention)

---

## Verdict

**REQUEST_CHANGES**

The Technical Design Phase 1 has strong foundational security architecture (three-layer RBAC, database-enforced HMDA isolation, proper JWT validation, audit trail immutability). However, the following critical issues must be resolved before implementation begins:

1. **C-01: Remove hardcoded passwords from Keycloak realm configuration** — Critical secrets management violation
2. **C-02: Fix frontend token storage to survive page refresh** — Breaks usability and session persistence
3. **C-03: Eliminate SQL injection risk in audit hashing** — Use SQLAlchemy query builders

Additionally, the following warnings should be addressed (prioritized):

- **W-02: Use strong database role passwords with environment variables** — Prevents accidental exposure
- **W-05: Do not log unmasked PII in masking failure paths** — Protects CEO document access restriction
- **W-07: Load tool authorization from config, not hardcoded dict** — Ensures config-driven security

After addressing these findings, the design will provide a secure foundation for Phase 1 implementation. The positive findings (P-01 through P-05) demonstrate that the core security architecture is sound and aligns with OWASP best practices and Red Hat AI compliance requirements.
