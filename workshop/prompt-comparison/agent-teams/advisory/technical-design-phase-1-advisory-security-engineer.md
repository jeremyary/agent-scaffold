<!-- This project was developed with assistance from AI tools. -->

# Technical Design Phase 1 Advisory — Security Engineer

**To:** Tech Lead
**From:** Security Engineer
**Date:** 2026-02-12
**Re:** Security implementation guidance for Phase 1 (37 P0 stories)

## API Key Authentication and Validation

**Flow:** Client sends `Authorization: Bearer <role>:<key>` → extract key portion → compute HMAC-SHA256 using server-side `HMAC_SECRET_KEY` → constant-time lookup in `api_keys.key_hash` → retrieve database role → ignore client-supplied role prefix (log mismatch at `warn` if present) → populate `AuthContext` with key_id, database role, correlation_id.

**Key point:** The client-supplied role prefix is a routing hint only. The database role is the single source of truth for authorization. This eliminates privilege escalation (ADR-002). HMAC-SHA256 provides fast lookups (microseconds) appropriate for high-entropy API keys, unlike bcrypt which is designed for low-entropy passwords. The HMAC secret adds a defense layer: if the DB is compromised, the attacker cannot verify keys without the server-side secret.

**Production credential check (AUTH-07):** Hard-fail at startup if `ENVIRONMENT=production` and any default credentials detected: seed API keys, `MINIO_ACCESS_KEY=minioadmin`, `DATABASE_URL` containing known default passwords. Exit before accepting HTTP requests. No partial startup.

**Expiration:** Check `expires_at` on every auth attempt. Expired keys return 401 with audit event (`metadata.reason: "expired_key"`).

## Role-Based Access Control

**Hierarchy:** `loan_officer < senior_underwriter < reviewer`. Higher roles inherit all lower permissions. `require_role(minimum_role)` dependency compares against this ordering.

**Review queue filtering (AUTH-05 AC-6):** Enforce at API level, not just UI. `loan_officer` sees only medium-confidence escalations. Low-confidence, fraud-flagged, and conflict-escalated applications are invisible to `loan_officer` (requires `senior_underwriter` or above). This is a data leakage control.

## Fernet Encryption for PII

**Encryption scope:** `loan_applications.ssn_encrypted`, `account_numbers_encrypted`, `government_id_encrypted`. All are Fernet-encrypted before storage. `ssn_last4` stored in plaintext for display.

**Key ring for rotation:** `ENCRYPTION_KEY` (current key, used for all new encryption) and `ENCRYPTION_KEY_PREVIOUS` (optional, previous key for decryption of older records). Each ciphertext prepended with a 1-byte key version identifier (e.g., `\x01` for current, `\x00` for previous). On decryption, read the version byte, route to the correct key. If version byte indicates previous key but `ENCRYPTION_KEY_PREVIOUS` is not set, fail with clear error (do not fall back to plaintext). Batch re-encryption is deferred beyond MVP.

**Key sourcing:** Environment variable or secrets manager. Never hardcoded. Missing `ENCRYPTION_KEY` in production blocks startup (AUTH-07 AC-5).

**API responses:** PII fields are always masked: `"ssn": "***-**-1234"` (last 4 only), account numbers and government IDs `"[REDACTED]"`. Cleartext PII never returned in API responses.

## Audit Trail Immutability

**Three enforcement layers (ADR-003, AUDIT-03):**

1. **Database permissions:** Dedicated `audit_writer` PostgreSQL role with `GRANT INSERT ON audit_events` and `REVOKE UPDATE, DELETE`. Application uses `SET ROLE audit_writer` within the transactional connection pool before audit writes, restores original role afterward. No separate connection pool needed.

2. **Trigger guard:** `BEFORE UPDATE OR DELETE` trigger on `audit_events` raises exception. Defense against ORM bugs or misconfigured sessions.

3. **Hash chain:** Each event's `prev_event_hash` contains `SHA-256(id || application_id || event_type || created_at || prev_event_hash)` of the previous event. First event per application uses a null sentinel hash (e.g., 64 zeros). Provides tamper detection during audit export (Phase 5).

**Concurrency control:** During parallel agent fan-out (PIPE-10), multiple agents may write audit events for the same application simultaneously. Use PostgreSQL advisory lock keyed on `application_id` (e.g., `pg_advisory_xact_lock(hashtext(application_id))`) to serialize audit writes per application, guaranteeing a linear hash chain. Lock held only for INSERT duration. Performance impact negligible relative to LLM call latency.

**System-level events:** Audit events with `application_id = NULL` (e.g., auth failures, key management) use the null sentinel for `prev_event_hash` per AUDIT-03 AC-8. They are independently traceable via `event_type` and `created_at` but not hash-chained to each other.

## PII Redaction Pipeline (Operational Phase 2)

**Scope:** All data sent to external LLM APIs must pass through `services/pii.py` redaction service before transmission. Mandatory dependency for all loan processing graph agent nodes.

**Field registry:** Redaction service identifies PII fields by name pattern and explicit registry: `ssn*`, `social_security*`, `account_number*`, `government_id*`, `borrower_name` (when in financial context). Replace with redaction tokens: `[SSN_REDACTED]`, `[ACCOUNT_REDACTED]`, `[GOV_ID_REDACTED]`, `[NAME_REDACTED]`. Non-PII fields (loan amount, property address, interest rate) passed through unchanged.

**Tokens are distinguishable:** Unique token per field type allows LLM to reason about field presence without seeing values.

**Redaction token mapping:** Service returns both redacted data and a mapping of redaction tokens to field paths (not values). Result processing layer uses this to understand which fields were redacted without storing PII.

## Production Credential Detection

**Scope (AUTH-07):** On startup, if `ENVIRONMENT=production`, check for:
- Seed API keys (e.g., via `is_seed` flag or known seed key hashes in DB)
- `MINIO_ACCESS_KEY=minioadmin` or `MINIO_SECRET_KEY=minioadmin`
- `DATABASE_URL` containing known default passwords (e.g., `postgres` as password)
- Missing `ENCRYPTION_KEY` or `HMAC_SECRET_KEY`

**Failure mode:** Exit with non-zero exit code, log error identifying which credential is unsafe. No partial startup, no warnings — hard fail.

## Health Endpoint Exposure

**No authentication required (DEPLOY-03).** Health checks must be accessible to orchestrators without credentials. Limit information exposure:
- `/health` (liveness): Return 200 if process alive. No detailed status.
- `/ready` (readiness): Check PostgreSQL (`SELECT 1`), Redis (ping), MinIO (lightweight connectivity test). Return 200 if all pass, 503 if any fail. Do not return detailed connection strings or error messages in response body.

## Document Upload Security

**Validation (DOC-01, DOC-02):**
- **MIME type:** Server-side magic-byte validation against allowlist (`application/pdf`, `image/jpeg`, `image/png`, `image/tiff`). Do not trust `Content-Type` header.
- **File size:** Max 20MB, configurable.
- **Filename sanitization:** Strip path components, replace non-alphanumeric chars (except `.` and `-`), truncate to 255 chars. Store with UUID key in MinIO, not original filename.
- **Content validation:** Validate PDF structure / image headers before processing. Reject polyglot files.
- **Storage isolation:** Each document stored under a UUID key in dedicated MinIO bucket. Server-side encryption (SSE) enabled for all objects.

## Critical Implementation Pitfalls

1. **HMAC secret rotation:** No mechanism at MVP. If `HMAC_SECRET_KEY` changes, all existing API keys become invalid. Document this operational constraint. Production deployments should treat HMAC secret as immutable or implement a dual-secret rotation like Fernet.

2. **Fernet key version byte:** Ensure the version byte is prepended **before** the Fernet token, not embedded within. Fernet tokens have a fixed structure; prepending a byte is the only safe versioning approach.

3. **Audit advisory lock scope:** Lock on `application_id`, not on a global lock. Global lock would serialize all audit writes across all applications, destroying parallel fan-out benefits.

4. **Authorization header logging:** Never log the `Authorization` header value. Always log as `"Authorization: Bearer [REDACTED]"` in structured logs.

5. **PII in error messages:** Validation errors must not echo PII values. Example: `"SSN format invalid"` (good), `"SSN '123-45-6789' format invalid"` (bad).

6. **Redis fallback for rate limiting:** If Redis unavailable, protected-tier endpoints should fall back to in-memory counters (acceptable for single-instance MVP). Public-tier LLM-invoking endpoints (chat) should fail closed (503), not fall back, to prevent unmetered LLM usage.

## Open Items for Technical Design

1. **bcrypt vs HMAC trade-off:** Architecture chose HMAC-SHA256 for speed. Confirm this aligns with stakeholder security policy. If bcrypt is mandated for API keys, document the per-request latency cost (milliseconds) and consider async key derivation.

2. **Fernet key rotation UX:** No UI for key rotation at MVP. Document the manual process: set `ENCRYPTION_KEY_PREVIOUS` to old key, set `ENCRYPTION_KEY` to new key, restart service. Old records decrypt on-read using previous key. New records encrypt with current key.

3. **Hash chain validation timing:** Architecture specifies validation during audit export (Phase 5) and optional daily background job. Define background job schedule and alerting mechanism for chain breaks.

4. **Content-Type validation:** Confirm magic-byte validation library (e.g., `python-magic`). Do not rely on file extension or HTTP header.

5. **Production credential check scope:** Should cover Redis default config (no password) in addition to PostgreSQL, MinIO, API keys?
