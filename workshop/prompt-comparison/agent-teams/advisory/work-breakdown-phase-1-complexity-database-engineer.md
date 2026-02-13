<!-- This project was developed with assistance from AI tools. -->

# Phase 1 Work Breakdown Complexity Assessment — Database Engineer

**To:** Project Manager (Work Breakdown Phase)
**From:** Database Engineer
**Date:** 2026-02-12
**Re:** Database task complexity, dependencies, and domain-specific risks

## Summary

Reviewed the Phase 1 Technical Design for database-related task groups. The migration ordering is sound, but several task groups appear undersized or have hidden complexity. Specific concerns: audit immutability infrastructure touches 4 distinct mechanisms and should be split; seed data is not as simple as "one data migration" given idempotency requirements and fixed UUID constraints; advisory lock behavior with async connection pools needs explicit handling.

---

## 1. Undersized Tasks

### Migration 006: Audit Immutability Infrastructure
**Stated scope:** Single migration creating trigger guard + audit_writer role.

**Actual scope touches 4 distinct mechanisms:**
1. Trigger function definition (`prevent_audit_event_modification`)
2. Trigger attachment (BEFORE UPDATE/DELETE)
3. Role creation (`CREATE ROLE audit_writer NOLOGIN`)
4. Permission grants (INSERT + USAGE on sequence + GRANT audit_writer TO app_user)

**Risk:** Each mechanism has a different rollback strategy. If the migration fails partway, the down migration must cleanly undo partial state. Testing requires verifying:
- Trigger correctly blocks UPDATE/DELETE attempts
- `SET LOCAL ROLE audit_writer` + INSERT succeeds
- `SET LOCAL ROLE audit_writer` + UPDATE/DELETE fails
- Grants work with connection pooling (role membership is session-scoped)

**Recommendation:** This is realistically 5-7 hours of work if the implementer is thorough (not 2-3). Keep as one task but increase complexity estimate. Alternatively, split into two tasks: (a) trigger guard, (b) INSERT-only role + grants.

### Migration 009: Seed Data
**Stated scope:** Idempotent data migration with 12 applications, 3 API keys, documents, audit events, thresholds.

**Actual complexity:**
- Fixed UUIDs for reproducibility means manual UUID generation (not `gen_random_uuid()`)
- Idempotency requires `INSERT ... ON CONFLICT DO NOTHING` or manual existence checks
- Audit event seed data must respect hash chain integrity (insert in order, compute prev_event_hash)
- SSN encryption must happen during seed data INSERT (requires encryption service logic in migration, or pre-computed ciphertext)
- API key hashes must match plaintext keys printed to console (HMAC-SHA256 computation in migration)

**Hidden dependency:** Seed data migration imports or duplicates logic from `EncryptionService` and `auth/resolver.py`. If those aren't implemented yet, seed data can't run.

**Recommendation:** Seed data is not a single task. Split into:
1. **Seed API keys**: 3 keys, HMAC hash computation, plaintext console output, 24-hour TTL
2. **Seed applications + audit trail**: 12 applications with encrypted PII, hash-chained audit events in correct order
3. **Seed thresholds**: Simpler, 2 rows, no dependencies

Alternatively, treat seed data as its own epic with 3 sub-tasks.

---

## 2. Hidden Dependencies

### Advisory Lock + Connection Pooling
The TD specifies `pg_advisory_xact_lock(hashtext(application_id))` for audit event serialization. Two concerns:

1. **Async connection pool behavior:** SQLAlchemy async sessions use a connection pool. Advisory locks are connection-scoped (or transaction-scoped for `_xact_` variant). If the session rolls back, the lock releases. But if an exception occurs between acquiring the lock and committing, the lock is held until rollback. This is correct behavior, but the migration testing must verify:
   - Lock is acquired before hash computation
   - Lock releases on COMMIT
   - Lock releases on ROLLBACK (error case)

2. **Lock contention under pathological load:** The TD notes that PostgreSQL's `lock_timeout` setting governs wait behavior. Default is 0 (wait forever). Phase 1 should document whether the app sets a session-level `lock_timeout` to bound worst-case latency. If not documented, this is a production risk flag.

**Recommendation:** Migration 005 or 006 should include a comment documenting advisory lock assumptions. No code change needed, but the implementer should know this is a nuance to test.

### SET LOCAL ROLE and Async Sessions
The TD specifies `SET LOCAL ROLE audit_writer` for INSERT-only permissions. This requires the session to be in a transaction (non-autocommit mode). SQLAlchemy async sessions default to autocommit=False, so this works. BUT:

- If a service method calls `audit_service.record_event()` outside a transaction, `SET LOCAL ROLE` will fail.
- The TD says "audit is within the same transaction as the triggering operation" (lines 1120-1121), which is correct design. But the implementer must ensure that route handlers use `async with session.begin()` or equivalent.

**Recommendation:** Add explicit check in AuditService that the session is in a transaction before issuing `SET LOCAL ROLE`. Raise an error if not. This prevents subtle bugs from hitting production.

### Database Roles vs API Roles
Two different role concepts in this system:

1. **PostgreSQL roles:** `app_user` (connection pool user), `audit_writer` (INSERT-only role)
2. **Application roles:** `loan_officer`, `senior_underwriter`, `reviewer`

The TD is clear about this distinction, but the implementer must not confuse them. The `api_keys.role` column stores application roles (VARCHAR, CHECK constraint). The `audit_writer` is a PostgreSQL role. They are orthogonal.

**Recommendation:** Migration 006 should include a comment clarifying this. No code change, just reduce confusion.

---

## 3. Domain-Specific Risks

### JSONB Indexing for property_address
The `loan_applications.property_address` column is JSONB (line 814). No index is defined on this column. If Phase 2+ queries by city or zip code (e.g., "all applications in Springfield, IL"), a full table scan is required.

**Recommendation:** Defer indexing to Phase 2 when query patterns are known. Document this as a Phase 2 consideration. Phase 1 does not query by address fields, so no index is needed yet.

### Trigger Performance on audit_events
The trigger `audit_events_immutability_guard` fires BEFORE UPDATE OR DELETE. This is correct for a guard trigger. BUT: if a developer accidentally issues `DELETE FROM audit_events WHERE application_id = :id` during debugging, the trigger will block each row deletion individually (row-level trigger). On a large table, this could appear to hang.

**Recommendation:** The trigger is correctly designed. No change needed. But the DX-04 architecture docs should warn: "Do not attempt bulk operations on audit_events in production. The table is append-only by design."

### Hash Chain Validation
The audit service computes `prev_event_hash` by concatenating fields from the previous event (lines 1518-1525). Two risks:

1. **Timestamp formatting:** The TD uses `.isoformat()` for timestamp serialization (line 1522). ISO 8601 includes timezone. If the database `created_at` is `TIMESTAMPTZ` and the Python code uses timezone-naive datetimes, the hash will mismatch. The implementer must ensure timestamps are always timezone-aware.

2. **Null application_id:** System events have `application_id = NULL` and use a null sentinel hash (line 1510-1511). These events are not hash-chained. If a developer tries to validate the hash chain for a system event, they'll get a mismatch. The validation logic (Phase 5) must handle this.

**Recommendation:** Seed data task must include a test that validates the hash chain for at least one application's audit trail. This catches timestamp formatting bugs early.

### Fernet Ciphertext Size
The TD specifies `ssn_encrypted BYTEA`, `account_numbers_encrypted BYTEA`, `government_id_encrypted BYTEA` (lines 804-807). Fernet ciphertext is larger than plaintext:
- Fernet overhead: ~57 bytes (timestamp, IV, HMAC)
- SSN: 11 chars plaintext → ~68 bytes ciphertext
- Version byte prepended: +1 byte

**Risk:** If the implementer assumes ciphertext ≈ plaintext size, they may not test large values. Account numbers could be 50+ characters (multiple accounts, JSON array). Government ID could be 100+ characters (passport number + country code).

**Recommendation:** Seed data should include at least one application with:
- Multiple account numbers (e.g., 5 accounts → ~200 chars plaintext)
- Long government ID (e.g., international passport + notes)

This ensures BYTEA columns are not undersized. No schema change needed (BYTEA has no length limit), but it's a test coverage gap.

---

## 4. Testing Concerns

### Migration Up/Down Testing
The TD specifies 9 migrations with dependencies. Testing the down path is critical:

- **Migration 006 down:** Must drop trigger, drop function, revoke grants, drop role. Order matters. If `app_user` has active sessions with `audit_writer` membership, `DROP ROLE` will fail.
- **Migration 009 down:** Must delete seed data in reverse dependency order: audit_events → documents → applications → api_keys → thresholds. If foreign key constraints are deferred, order may not matter, but the down migration should be explicit.

**Recommendation:** Every migration's down path must be tested with `alembic downgrade -1` after applying. Add this to the migration task exit conditions.

### Seed Data Idempotency Testing
The TD requires seed data to be idempotent (line 1004). Two cases to test:

1. **First run (empty database):** All 12 applications + keys + thresholds are inserted.
2. **Repeat run (data exists):** No duplicate key violations, no data changes, plaintext keys are NOT printed again.

**Recommendation:** The seed data task exit condition should verify both cases explicitly.

### Audit Event Immutability Testing
Three mechanisms to test:

1. **Trigger guard blocks UPDATE:** `UPDATE audit_events SET event_type = 'x' WHERE id = 1` → raises exception
2. **Trigger guard blocks DELETE:** `DELETE FROM audit_events WHERE id = 1` → raises exception
3. **INSERT-only role blocks UPDATE/DELETE:** `SET ROLE audit_writer; UPDATE audit_events SET event_type = 'x' WHERE id = 1;` → permission denied

**Recommendation:** The test must distinguish between trigger guard (application-layer protection) and role permissions (database-layer protection). Both must be verified independently.

### Hash Chain Integrity Testing
The seed data includes complete audit trails for approved/denied applications (line 1035). Testing must verify:

1. **First event has null sentinel hash:** `prev_event_hash = "0" * 64`
2. **Second event's prev_event_hash matches computed hash of first event**
3. **Third event's prev_event_hash matches computed hash of second event**

**Recommendation:** This is a unit test for the audit service, not a migration test. But the seed data task should include a smoke test that the hash chain is valid for at least one application.

---

## Recommendations Summary

1. **Increase complexity estimate for Migration 006** (audit immutability): 4 mechanisms, thorough testing required.
2. **Split seed data into 3 sub-tasks** or treat as its own epic: API keys, applications + audit trail, thresholds.
3. **Add session transaction check** in AuditService before `SET LOCAL ROLE`.
4. **Document advisory lock + connection pool behavior** in migration comments.
5. **Test both up and down paths** for every migration (not just up).
6. **Verify seed data idempotency** with repeat runs.
7. **Test hash chain integrity** for seeded audit trails.
8. **Include large ciphertext values** in seed data (multiple accounts, long government ID).

---

**Overall assessment:** The TD's database design is sound. The primary risk is underestimating the complexity of audit immutability infrastructure and seed data. With task splitting and explicit testing requirements, these risks are manageable.
