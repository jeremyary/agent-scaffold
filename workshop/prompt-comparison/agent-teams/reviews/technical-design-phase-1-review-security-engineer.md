# This project was developed with assistance from AI tools.

# Technical Design Phase 1 Security Review

**Reviewer:** Security Engineer
**Document:** `plans/technical-design-phase-1.md`
**Date:** 2026-02-12
**Verdict:** APPROVE with recommendations for post-Phase 1 hardening

---

## Executive Summary

The Phase 1 Technical Design demonstrates strong security architecture with defense-in-depth for the most critical areas: authentication, audit trail immutability, and PII protection. The design correctly implements ADR-002 (server-side role resolution), ADR-003 (audit infrastructure from day one), and includes field-level encryption with key rotation support. All critical findings from the architecture review have been addressed in the TD.

The design is **approved** with recommendations for post-Phase 1 security hardening that should be prioritized in Phase 2.

---

## Critical Findings

None. All critical risks identified in architecture review are adequately addressed.

---

## Warning Findings

### W-1: HMAC Secret Rotation Operational Gap

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 2051-2052

**Issue:** The TD documents that changing `HMAC_SECRET_KEY` invalidates all existing API keys, with no rotation mechanism at MVP. This creates operational friction if the secret is compromised.

**Risk:** In the event of HMAC secret compromise, all API keys must be regenerated and redistributed to users. For a production system with distributed users, this is a significant operational burden.

**Recommendation:** Document a key rotation procedure in the operational runbook:
1. Phase 1: Accept limitation and document in production readiness checklist
2. Phase 2+: Consider dual-secret support (similar to Fernet key rotation) if API key rotation becomes operationally painful
3. Always: Treat HMAC secret with the same protection level as encryption keys

**Rationale:** The TD correctly flags this as an "operational constraint" rather than a security vulnerability. For MVP scale (limited number of reviewers generating keys), manual key regeneration is acceptable. Flagging for post-MVP improvement.

---

### W-2: Advisory Lock Timeout Not Specified

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1387-1396

**Issue:** The audit service uses `pg_advisory_xact_lock()` for hash chain serialization, but the TD does not specify a lock timeout. In pathological scenarios (agent crashes mid-audit-write), the lock could block indefinitely.

**Risk:** A crashed agent holding an advisory lock could block all subsequent audit writes for that application, causing workflow failure.

**Recommendation:** Implement at transaction level:
- Use `pg_advisory_xact_lock()` as specified (transaction-scoped lock, auto-released on commit/rollback)
- Set `statement_timeout` on the transactional connection pool to 5 seconds (sufficient for a single INSERT, much shorter than LLM call latency)
- The transaction-scoped lock ensures automatic release even if the process crashes

**Impact:** Low. PostgreSQL's transaction-scoped advisory locks (`pg_advisory_xact_lock`) automatically release on transaction end (commit/rollback), so the risk is limited to the transaction timeout duration. The recommendation is belt-and-suspenders.

---

### W-3: Production Credential Check Coverage Incomplete

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1241-1278

**Issue:** The production credential hard-fail check covers seed API keys, MinIO defaults (`minioadmin`), database password detection (`postgres`), and required secrets (`ENCRYPTION_KEY`, `HMAC_SECRET_KEY`). It does **not** cover Redis default configuration (no password) or weak database passwords (non-default but weak).

**Risk:**
- Redis with no password in production allows unauthorized access to rate limiting, session data, and cached market data
- Weak but non-default database passwords bypass the check

**Recommendation:** Expand `check_production_credentials()` to include:
1. **Redis password check:** If `REDIS_URL` does not include authentication credentials (format: `redis://:password@host`), fail
2. **Consider:** Entropy check on database password (if extractable from connection string). This is harder to implement correctly (avoiding false positives) and may be deferred to Phase 2.

**Impact:** Moderate. Redis at MVP contains no PII, limiting the blast radius. Database is the higher-value target and is partially covered (default password detection).

---

### W-4: Hash Chain Validation Timing Not Specified

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 473-525 (AUDIT-03)

**Issue:** The architecture specifies hash chain validation "during audit export (Phase 5)" and "optional periodic background check." The TD implements the hash chaining write-time logic but does not specify when or how validation occurs within Phase 1 scope.

**Risk:** Hash chain tampering is not detected until export (Phase 5), meaning silent corruption could exist for months before discovery.

**Recommendation:**
1. **Phase 1 scope (this TD):** Hash chain computation and storage is correctly implemented. No changes required for Phase 1 deliverable.
2. **Phase 2 action item:** Add a background validation job that periodically (daily) validates hash chain integrity for a sample of recent applications. Log validation failures at `error` level with alerting. This provides proactive tamper detection without waiting for export.
3. **Phase 5:** Full export-time validation as specified in architecture.

**Impact:** Low for Phase 1. The defense-in-depth layers (INSERT-only role + trigger guard) prevent accidental corruption. Hash chaining detects intentional tampering, but delayed detection is acceptable at PoC/MVP maturity.

---

## Suggestion Findings

### S-1: Content-Type Validation Should Be Magic-Byte Explicit

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 71-76 (Document Upload flow)

**Observation:** The TD specifies "Read magic bytes to determine actual MIME type (python-magic)" and "Validate against allowlist" but does not explicitly state that the HTTP `Content-Type` header is **ignored** in favor of magic byte detection.

**Recommendation:** Make this explicit in the implementation contract (Document Upload flow, step 5a):
- "Read magic bytes using `python-magic` to determine actual MIME type. **The HTTP Content-Type header is not trusted.**"
- This clarifies that polyglot attacks (file with PDF magic bytes but `Content-Type: image/jpeg`) are defended against.

**Rationale:** The TD's intent is clear (magic byte validation), but explicit language prevents implementation shortcuts that trust the header.

---

### S-2: Fernet Key Version Byte Collision Risk

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1289-1333 (Encryption Service)

**Observation:** The encryption service prepends a key version byte (`\x01` = current, `\x00` = previous) before the Fernet ciphertext. Fernet tokens have a fixed structure starting with version byte `\x80`. The prepended byte creates a format: `[version_prefix][fernet_token]`.

**Potential Issue:** If the version byte is `\x80`, it could collide with the Fernet token structure, causing ambiguity during decryption.

**Recommendation:**
- Use version bytes outside Fernet's internal range. The TD uses `\x00` (previous) and `\x01` (current), which are safe (Fernet tokens start with `\x80`).
- Add a unit test in `test_encryption.py` that validates version byte routing works correctly for both keys, including edge cases (decrypt with wrong key fails, decrypt with missing previous key fails).

**Impact:** None if implemented as specified. Flagging as a code review checkpoint.

---

### S-3: SSN Last-4 Extraction Should Be Validated

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1323-1332 (Encryption Service)

**Observation:** The `extract_last4(ssn: str)` method strips hyphens and extracts the last 4 digits. The TD does not specify validation of the input format before extraction.

**Recommendation:** Add validation:
```python
@staticmethod
def extract_last4(ssn: str) -> str:
    """Extract last 4 digits of SSN for masked display."""
    # Validate SSN format before extraction
    if not re.match(r"^\d{3}-\d{2}-\d{4}$", ssn):
        raise ValueError(f"Invalid SSN format: expected NNN-NN-NNNN")
    digits = ssn.replace("-", "")
    return digits[-4:]
```

**Rationale:** Prevents silent failures if malformed SSN data reaches the encryption service (e.g., from a bypassed Pydantic validator). Fail fast with a clear error.

---

### S-4: Document Filename Sanitization Needs Length Check Before Truncation

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` line 76 (Document Upload, step 5e)

**Observation:** The TD specifies "Sanitize filename: strip path components, replace non-alnum (keep . and -), truncate 255 chars." The order of operations matters: truncation after sanitization could leave a filename ending in a hyphen or period, which some filesystems treat specially.

**Recommendation:** Sanitization order:
1. Strip path components
2. Replace non-alnum except `.` and `-`
3. Strip leading/trailing `.` and `-` (preventing `.` or `-` as entire filename)
4. Truncate to 255 chars
5. If truncation results in trailing `.` or `-`, strip again

**Impact:** Cosmetic. MinIO does not care, but sanitization best practices.

---

### S-5: Rate Limiting Fallback for LLM Endpoints Should Fail Closed

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/architecture.md` lines 812-819 (Caching Strategy)

**Cross-reference:** Architecture specifies graceful degradation when Redis is unavailable. For "Chat sessions" and "Property data lookups to real external API," the system "fails closed." For "Calculator and market data endpoints," it "falls back to in-memory rate limiting."

**Observation:** The TD does not specify rate limiting implementation details (Phase 1 delivers the middleware skeleton but real limits are Phase 3b). When implemented, the fallback behavior for LLM-invoking endpoints must be explicit.

**Recommendation for Phase 3b TD:**
- Intake chat endpoint (`POST /v1/chat/sessions/:id/messages`): If Redis unavailable, return 503 (fail closed). Do not fall back to in-memory counters. Rationale: LLM cost exposure.
- Calculator endpoint (`POST /v1/calculator/*`): If Redis unavailable, fall back to in-memory counters (acceptable, no LLM cost).
- Protected tier endpoints: If Redis unavailable, fall back to in-memory counters (acceptable for single-instance MVP).

**Phase 1 Action:** None (rate limiting middleware is Phase 3b). Flagging for Phase 3b security review.

---

### S-6: Correlation ID Validation Regex Could Be Tighter

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1093-1094

**Observation:** The correlation ID middleware uses regex `^[a-zA-Z0-9_-]{1,128}$` to validate client-supplied `X-Request-ID`. This allows underscores and hyphens, which is reasonable. However, it does not prevent all potentially malicious payloads (e.g., SQL injection via correlation ID is impossible because correlation IDs are always logged/stored as strings, never used in queries, but log injection is theoretically possible).

**Recommendation:** Current regex is acceptable. If paranoia is desired, restrict to UUID format: `^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`. This would reject human-readable correlation IDs (e.g., `request-abc-123`) which may be useful for debugging.

**Decision:** Accept current regex. The regex prevents control characters and limits length, which is sufficient.

---

## Positive Findings

### P-1: Server-Side Role Resolution Correctly Implemented

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1149-1212 (Key Resolution Flow)

The TD correctly implements ADR-002 with explicit steps:
- Extract role prefix (optional) and raw key
- Compute HMAC-SHA256 using server-side secret
- Lookup hash in database
- Use **database role**, not client-supplied role
- Log mismatch at `warn` level (lines 1200-1205)

This eliminates the privilege escalation vector identified in all three Phase 2 reviews. The design is sound and complete.

---

### P-2: Three-Layer Audit Immutability Defense

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 884-911 (Trigger Guard + INSERT-only Role + Hash Chain)

The TD implements defense-in-depth:
1. **INSERT-only role** (lines 902-911): `audit_writer` role has no UPDATE/DELETE grants
2. **Trigger guard** (lines 887-898): `BEFORE UPDATE OR DELETE` trigger raises exception
3. **Hash chain** (lines 1398-1468): SHA-256 linking with advisory lock serialization

This is exemplary. The three layers are independent (permission, trigger, cryptographic) and provide resilience against different attack vectors (misconfiguration, ORM bugs, database compromise).

---

### P-3: PII Masking Strategy Is Comprehensive

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1335-1344 (PII Masking in Responses)

The TD specifies:
- SSN: `"***-**-1234"` (last 4 only, from stored `ssn_last4`)
- Account numbers: `"[REDACTED]"`
- Government IDs: `"[REDACTED]"`
- **Cleartext PII is never included in API responses** (line 1341)

Cross-reference to PII-02 (log masking) and PII-03 (LLM redaction) ensures consistent handling across all boundaries. The use of `ssn_last4` as a separate plaintext column (lines 764-765) is correct — it avoids decrypting SSN for display purposes.

---

### P-4: Health Endpoint Security Correctly Scoped

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 670-707 (Health + Readiness Endpoints)

The TD correctly specifies:
- **No authentication required** (lines 679, 692)
- **Lightweight checks**: `SELECT 1` for PostgreSQL, `PING` for Redis, `list_buckets` or HEAD for MinIO (lines 707)
- **Limited information disclosure**: Readiness returns `{"status": "ok"|"degraded", "dependencies": {...}}` with minimal detail (lines 695-704)

This balances operational observability with security. Health endpoints do not leak version information, dependency versions, or internal errors.

---

### P-5: Production Credential Hard-Fail Is Correctly Scoped

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1241-1278 (Production Credential Check)

The TD implements the architecture requirement:
- Check for seed API keys (`is_seed` flag, lines 1253-1259)
- Check MinIO defaults (lines 1261-1263)
- Check database default password (lines 1265-1267)
- Check required secrets (`ENCRYPTION_KEY`, `HMAC_SECRET_KEY`, lines 1269-1273)
- **Hard fail**: `raise SystemExit(1)` before HTTP server starts (lines 1274-1278)

This prevents insecure deployments. The use of `SystemExit(1)` (non-zero) ensures container orchestration (Kubernetes, OpenShift) detects the failure and does not route traffic.

**Note:** See W-3 for Redis coverage gap, but the core pattern is correct.

---

### P-6: Fernet Key Rotation Design Is Correct

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1286-1333 (Encryption Service)

The key ring implementation is sound:
- Current key (`ENCRYPTION_KEY`) for all new encryptions (line 1300)
- Version byte prefix routes decryption to correct key (lines 1304-1321)
- Fallback to previous key (`ENCRYPTION_KEY_PREVIOUS`) if version byte indicates old key (lines 1314-1319)
- Clear error if previous key required but not configured (line 1316)

This supports zero-downtime key rotation: deploy new key as `ENCRYPTION_KEY` and old key as `ENCRYPTION_KEY_PREVIOUS`, then lazily re-encrypt on read. The architecture correctly defers batch re-encryption to post-MVP (line 2066).

**Cross-reference:** Architecture lines 728-731 confirm this approach.

---

### P-7: IDOR Prevention via Ownership Checks

**Location:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md` lines 1072-1074 (Error Handling Rules)

The TD specifies: "Ownership check failures: `loan_officer` accessing another user's resource -> 404 (not 403), preventing information leakage about resource existence."

This is correct IDOR defense. A 403 response leaks that the resource exists; a 404 does not distinguish between "does not exist" and "exists but you can't access it."

**Cross-reference:** Lines 442-443 (GET application detail) confirm this pattern.

---

## Security Checklist Verification

| OWASP Top 10 Category | Status | Evidence |
|-----------------------|--------|----------|
| **A01: Broken Access Control** | ✅ PASS | Server-side role resolution (P-1), IDOR prevention (P-7), role hierarchy enforced (lines 156-173) |
| **A02: Cryptographic Failures** | ✅ PASS | Fernet for PII (P-6), HMAC-SHA256 for keys (lines 1181-1184), MinIO SSE (line 78), Redis scoped to non-PII (architecture line 726) |
| **A03: Injection** | ✅ PASS | Pydantic validation (lines 247-283), no SQL concatenation (SQLAlchemy ORM), file type magic bytes (S-1), filename sanitization (S-4) |
| **A04: Insecure Design** | ✅ PASS | Rate limiting planned (Phase 3b), audit immutability (P-2), production credential checks (P-5) |
| **A05: Security Misconfiguration** | ⚠️ PARTIAL | Production checks cover most defaults (P-5), but see W-3 for Redis gap |
| **A06: Vulnerable Components** | ✅ PASS | Dependency scanning is project convention (`.claude/rules/security.md`), no hardcoded versions in TD |
| **A07: Authentication Failures** | ✅ PASS | API key expiration (lines 315-356), revocation (lines 109-144), HMAC hashing (P-1), no weak password storage |
| **A08: Data Integrity Failures** | ✅ PASS | Hash chain (P-2), no deserialization of untrusted data in TD scope |
| **A09: Logging Failures** | ✅ PASS | Structured logging (lines 1117-1142), PII masking in logs (P-3), audit events for security events (lines 387-392) |
| **A10: SSRF** | ✅ PASS | External API URLs are configuration-based (architecture lines 788-790), no user-controlled URL construction in TD scope |

---

## Dependency Scan Results

Phase 1 dependencies (from TD contract):
- **Python**: `cryptography` (Fernet), `python-magic` (file type detection), `fastapi`, `sqlalchemy`, `alembic`, `hmac` (stdlib), `hashlib` (stdlib)
- **Node**: Not in Phase 1 API scope

**Action Required:** Run `pip audit` (or `uv pip audit`) on `packages/api/pyproject.toml` after dependency installation. No known CVEs in the specified libraries as of 2026-02-12, but this must be verified at implementation time.

---

## Threat Model

| Threat Actor | Attack Vector | Mitigations in TD |
|--------------|---------------|-------------------|
| **External Attacker (unauthenticated)** | Attempt to access protected endpoints without key | Auth middleware (lines 1149-1212), 401 response (lines 20-30) |
| **External Attacker (authenticated, low privilege)** | Privilege escalation to higher role | Server-side role resolution (P-1), role hierarchy checks (lines 156-173) |
| **Malicious Loan Officer** | Access other loan officers' applications | Ownership checks (P-7), role-based filtering (lines 399-400) |
| **Malicious Loan Officer** | Exfiltrate PII from API responses | PII masking (P-3), cleartext PII never in responses (line 1341) |
| **Malicious Loan Officer** | Tamper with audit trail | Three-layer immutability (P-2), INSERT-only role + trigger + hash chain |
| **Compromised Database** | Read encrypted PII | Fernet encryption (P-6), encryption key external to database |
| **Compromised Database** | Forge API keys | HMAC secret external to database (lines 1182-1184) |
| **Compromised Redis** | Read PII from cache | Redis scoped to non-PII data (architecture line 726) |
| **Document Upload Attacker** | Polyglot file attack | Magic byte validation (S-1), filename sanitization (S-4), size limits (line 74) |
| **Insider (reviewer with DB access)** | Modify audit trail via direct SQL | Trigger guard blocks UPDATE/DELETE (P-2, lines 887-898) |
| **Insider (reviewer with DB access)** | Decrypt PII | Requires `ENCRYPTION_KEY` (external to database) + ability to run Python code with the key |

**Residual Risks (accepted at MVP):**
- **Database + Encryption Key Compromise:** If both the database and `ENCRYPTION_KEY` are compromised, PII is readable. Mitigation: Deploy encryption key via secrets manager (e.g., Vault), not environment variable, in production.
- **HMAC Secret Rotation:** No dual-secret support (W-1). Accepted at MVP scale.
- **Redis No Password (production):** Flagged in W-3. Must be resolved before production deployment.

---

## Recommendations Summary

### Phase 1 (Blocking for Production)
1. **[W-3] Add Redis password check** to `check_production_credentials()` (blocks production deployment if Redis has no auth)

### Phase 2 (High Priority)
1. **[W-4] Add daily hash chain validation job** (proactive tamper detection)
2. **[W-2] Document statement_timeout** in connection pool configuration (already implicit via transaction-scoped advisory lock, document for clarity)

### Phase 2+ (Enhancement)
1. **[W-1] Consider HMAC secret dual-key rotation** (if key rotation becomes operationally painful)
2. **[S-5] Specify rate limiting fallback behavior** (fail closed for LLM endpoints) in Phase 3b TD

### Code Review Checkpoints
1. **[S-1] Verify Content-Type header is ignored** in document upload (magic bytes only)
2. **[S-2] Unit test Fernet key version byte routing** (both keys, failure cases)
3. **[S-3] Validate SSN format before extraction** (fail fast on malformed input)
4. **[S-4] Sanitize filename after truncation** (strip trailing `.` and `-`)

---

## Cross-References

- **Architecture Review:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/reviews/architecture-review-security-engineer.md`
  - All Critical/Warning findings from architecture review are resolved in this TD
  - ADR-002 (server-side role resolution) correctly implemented
  - ADR-003 (audit infrastructure from Phase 1) correctly implemented
  - Data-at-rest encryption (architecture review C-2) correctly scoped

- **Product Plan Review:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/reviews/product-plan-review-security-engineer.md`
  - Production credential hard-fail (W-3) correctly implemented (P-5), with Redis gap flagged (W-3 this review)
  - PII redaction timing (W-1) mechanism is in Phase 1 TD (encryption service), operational in Phase 2 (first LLM call)

- **Requirements:** `/home/jary/redhat/git/agent-scaffold-test-teams/plans/requirements-chunk-1-foundation.md`
  - AUTH-01 through AUTH-08: Fully specified in TD
  - AUDIT-01 through AUDIT-04: Fully specified in TD
  - PII-01, PII-02, PII-04: Fully specified in TD
  - PII-03: Mechanism delivered in Phase 1 (encryption service), operational in Phase 2

---

## Conclusion

The Phase 1 Technical Design is **approved** from a security perspective. The design demonstrates mature security architecture with:
- Correct implementation of server-side role resolution (eliminating privilege escalation)
- Defense-in-depth for audit trail immutability
- Field-level encryption with key rotation support
- Comprehensive PII masking across all boundaries
- Production deployment safety mechanisms

The warning findings (W-1 through W-4) are operational improvements or Phase 2 enhancements, not blocking security vulnerabilities. The suggestions (S-1 through S-6) are code review checkpoints to ensure the implementation matches the design intent.

The design is ready for implementation. Security Engineer review will be required again at Phase 2 (first real LLM call, PII redaction operational) and Phase 3b (rate limiting implementation, fail-closed behavior).

---

## Metadata

- **Review Date:** 2026-02-12
- **Document Version:** Phase 1 Technical Design (2084 lines)
- **Reviewer Role:** Security Engineer
- **Review Scope:** Authentication, authorization, PII protection, audit trail, document upload security, production credential checks, OWASP Top 10 coverage
- **Findings:** 0 Critical, 4 Warnings, 6 Suggestions, 7 Positive
- **Verdict:** APPROVE
