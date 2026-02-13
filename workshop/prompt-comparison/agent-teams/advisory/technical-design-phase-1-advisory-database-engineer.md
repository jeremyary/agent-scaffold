<!-- This project was developed with assistance from AI tools. -->

# Technical Design Phase 1 Advisory: Database Schema Design

**To:** Tech Lead (Technical Design Document Author)
**From:** Database Engineer
**Re:** Phase 1 Database Schema, Migration Strategy, and Data Integrity
**Date:** 2026-02-12

This memo provides database-specific guidance for the Phase 1 Technical Design Document. Phase 1 comprises 37 P0 stories covering authentication, audit trail, PII encryption, LangGraph checkpoint infrastructure, application lifecycle, document management, seed data, and observability.

## Table Structures for Phase 1

### Core Tables Required

**`api_keys`** — Authentication with HMAC-SHA256 hashed keys
- `id` UUID PRIMARY KEY
- `key_hash` VARCHAR(64) NOT NULL UNIQUE — HMAC-SHA256 output is 64 hex chars
- `role` VARCHAR NOT NULL CHECK (role IN ('loan_officer', 'senior_underwriter', 'reviewer'))
- `description` VARCHAR — human-readable label
- `expires_at` TIMESTAMPTZ NOT NULL — enforced on every auth lookup
- `is_active` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Index on `key_hash` for auth lookups (expect <1ms lookup time)

**`loan_applications`** — Application lifecycle with encrypted PII fields
- `id` UUID PRIMARY KEY
- `status` VARCHAR NOT NULL CHECK (status IN ('draft', 'submitted', 'processing', 'awaiting_review', 'approved', 'denied', 'withdrawn', 'processing_error'))
- `borrower_name` VARCHAR NOT NULL — not encrypted, needed for display
- `ssn_encrypted` BYTEA — Fernet ciphertext (variable length, typically ~100 bytes)
- `ssn_last4` VARCHAR(4) — plaintext for masked display
- `account_numbers_encrypted` BYTEA — JSONB array, encrypted
- `government_id_encrypted` BYTEA
- `loan_amount_cents` INTEGER NOT NULL CHECK (loan_amount_cents > 0)
- `property_value_cents` INTEGER NOT NULL CHECK (property_value_cents > 0)
- `annual_income_cents` INTEGER NOT NULL CHECK (annual_income_cents >= 0)
- `monthly_debts_cents` INTEGER NOT NULL CHECK (monthly_debts_cents >= 0)
- `loan_term_months` INTEGER NOT NULL CHECK (loan_term_months > 0)
- `interest_rate` NUMERIC(8,6) NOT NULL CHECK (interest_rate > 0)
- `property_address` JSONB NOT NULL — no fixed schema, validated at API layer
- `analysis_pass` INTEGER NOT NULL DEFAULT 1
- `created_by` UUID NOT NULL REFERENCES api_keys(id)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Indexes: `(status, updated_at)` for review queue, `(created_by)`, `(created_at DESC)`

**`documents`** — Document metadata with MinIO references
- `id` UUID PRIMARY KEY
- `application_id` UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE
- `storage_key` VARCHAR NOT NULL UNIQUE — UUID-based MinIO object key
- `original_filename` VARCHAR NOT NULL — sanitized, for display only
- `mime_type` VARCHAR NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/tiff'))
- `file_size_bytes` INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 20971520)
- `document_type` VARCHAR — classified type (w2, pay_stub, tax_return, bank_statement, appraisal, unknown), nullable until classification
- `processing_status` VARCHAR NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
- `processing_error` JSONB — RFC 7807 error structure if failed
- `extracted_data` JSONB — type-specific extraction results
- `field_confidence` JSONB — per-field confidence scores
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- Indexes: `(application_id)`, `(processing_status)`

**`audit_events`** — Immutable audit trail with hash chaining (see Data Integrity section below)
- `id` BIGSERIAL PRIMARY KEY — auto-increment for append performance
- `application_id` UUID REFERENCES loan_applications(id) — nullable for system events
- `event_type` VARCHAR NOT NULL CHECK (event_type IN ('state_transition', 'agent_decision', 'human_review', 'auth_event', 'threshold_change', 'document_upload', 'routing_decision'))
- `actor_id` VARCHAR — API key ID or agent name or 'anonymous'
- `actor_type` VARCHAR CHECK (actor_type IN ('user', 'agent', 'system'))
- `actor_role` VARCHAR
- `agent_name` VARCHAR — for agent_decision events
- `confidence_score` NUMERIC(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1)
- `reasoning` TEXT
- `input_data_hash` VARCHAR(64) — SHA-256 of input data
- `previous_state` VARCHAR — for state_transition events
- `new_state` VARCHAR
- `metadata` JSONB NOT NULL DEFAULT '{}'
- `prev_event_hash` VARCHAR(64) NOT NULL — hash chain (null sentinel: '0' * 64 for first event per application)
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- NO `updated_at` — immutable table
- Indexes: `(application_id, id)` for cursor pagination, `(event_type)`, `(created_at)`

**`langgraph` schema** — Managed by PostgresSaver, not application code. Create schema in migration, LangGraph creates tables.

### Phase 1-Specific Considerations

**Roles table not needed.** Role is stored as an enum CHECK constraint on `api_keys.role` and validated at the application layer. No separate roles table required at MVP.

**No agent_decisions table in Phase 1.** Agent decisions are recorded as `audit_events` with `event_type = 'agent_decision'`. A dedicated `agent_decisions` table for structured querying is added in Phase 2.

**Confidence thresholds seeded, not configurable UI in Phase 1.** Seed data includes default thresholds in a simple key-value table (`confidence_thresholds`) so the aggregator can query them. The admin UI for editing thresholds is Phase 5.

## Column Type Recommendations

**Financial values:** INTEGER cents, not NUMERIC or FLOAT. Stored as `loan_amount_cents INTEGER`, serialized at API layer as string decimals (`"250000.00"`). No floating-point arithmetic in database or application. Use `BIGINT` if loan amounts could exceed ~$21M (INT max is 2^31-1 cents = $21.4M).

**Encrypted fields:** BYTEA. Fernet ciphertext is binary, variable-length. A 9-digit SSN encrypts to ~100 bytes. BYTEA avoids encoding overhead. Store with key version prefix (single byte prepended to ciphertext) for dual-key decryption during rotation.

**UUIDs:** Use `UUID` type, not VARCHAR(36). Indexes are more efficient on 16-byte native UUIDs. Generate with `gen_random_uuid()` or at application layer (Python `uuid.uuid4()`).

**Timestamps:** TIMESTAMPTZ (timestamp with time zone), not TIMESTAMP. Store all times in UTC. Let the API layer handle display timezone conversion.

**JSON fields:** JSONB, not JSON. JSONB is indexed and queryable. Use for: `property_address`, `extracted_data`, `field_confidence`, `metadata`, `processing_error`.

**Enums vs CHECK constraints:** Use CHECK constraints for small, stable enums (status values, roles, mime types). Changing a CHECK constraint requires an ALTER TABLE, but adding a value is a single migration. PostgreSQL native ENUMs are more rigid and harder to evolve.

## Indexing Strategy for Phase 1 Query Patterns

**Application listing by status (APP-02, REV-01):**
```sql
CREATE INDEX idx_loan_applications_status_updated_at
ON loan_applications(status, updated_at DESC);
```
Covers review queue query: `WHERE status = 'awaiting_review' ORDER BY updated_at ASC` (oldest first). Composite index on `(status, updated_at)` allows the DB to seek to the status and scan in time order without a separate sort.

**Application listing by creator (APP-02 loan officer scope):**
```sql
CREATE INDEX idx_loan_applications_created_by
ON loan_applications(created_by);
```

**Audit events for an application (AUDIT-04):**
```sql
CREATE INDEX idx_audit_events_application_id_id
ON audit_events(application_id, id);
```
Supports cursor-based pagination (`WHERE application_id = ? AND id > ? ORDER BY id LIMIT ?`). The `id` column (BIGSERIAL) is monotonically increasing, so sorting by `id` is equivalent to sorting by `created_at` but more efficient.

**API key auth lookups (AUTH-01):**
```sql
CREATE UNIQUE INDEX idx_api_keys_key_hash
ON api_keys(key_hash);
```
UNIQUE ensures no hash collision. Lookup on every protected request, must be fast.

**Document listing for an application (DOC-04):**
```sql
CREATE INDEX idx_documents_application_id
ON documents(application_id);
```

**DO NOT index encrypted columns.** `ssn_encrypted`, `account_numbers_encrypted`, `government_id_encrypted` are never queried. Indexing them wastes space and leaks information (index size correlates with plaintext cardinality).

## Migration Ordering

**Dependencies:**
1. `api_keys` — no dependencies
2. `loan_applications` — depends on `api_keys` (FK: `created_by`)
3. `documents` — depends on `loan_applications` (FK: `application_id`)
4. `audit_events` — depends on `loan_applications` (FK: `application_id`, nullable)
5. `confidence_thresholds` — no dependencies, seed after schema
6. `langgraph` schema creation — no dependencies, tables managed by PostgresSaver
7. Seed data — runs after all schema is created

**Migration file structure:**
```
db/migrations/
├── 001_create_api_keys.sql
├── 002_create_loan_applications.sql
├── 003_create_documents.sql
├── 004_create_audit_events_with_immutability.sql
├── 005_create_confidence_thresholds.sql
├── 006_create_langgraph_schema.sql
└── 007_seed_data.sql
```

Each migration must be idempotent where possible. Use `IF NOT EXISTS` for CREATE TABLE, CREATE INDEX, CREATE SCHEMA. For ALTER TABLE changes (future migrations), check for column existence before adding.

## Audit Event Immutability Enforcement

Three-layer defense as specified in architecture:

**Layer 1: INSERT-only database role**
```sql
CREATE ROLE audit_writer;
GRANT INSERT ON audit_events TO audit_writer;
-- NO UPDATE, NO DELETE
```
Application's transactional connection user (`app_user`) is granted `SET ROLE audit_writer`. Audit inserts execute `SET ROLE audit_writer`, INSERT, then reset role. No separate connection pool needed.

**Layer 2: Trigger guard**
```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_immutability_guard
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_modification();
```

**Layer 3: Hash chaining with advisory lock**

Each audit event includes `prev_event_hash` = SHA-256 of the previous event's `(id || application_id || event_type || created_at || prev_event_hash)`. First event per application uses null sentinel hash (`'0' * 64`).

During parallel agent execution (e.g., credit analyst + risk assessor + compliance checker), multiple audit events for the same application may insert concurrently. To maintain a linear hash chain, audit inserts acquire a PostgreSQL advisory lock keyed on `application_id`:

```sql
SELECT pg_advisory_xact_lock(hashtext(application_id::text));
-- Compute prev_event_hash from most recent event for this application
-- INSERT with computed prev_event_hash
-- Lock released at transaction end
```

The lock serializes audit writes per application. Performance impact: negligible (~1-5ms per insert). Lock is held only during the INSERT, not during LLM calls.

**System-level events (application_id = NULL):** Use null sentinel hash, not chained. System events (auth failures, key creation/revocation) are independently verifiable and do not chain to each other.

## Seed Data Approach

Seed data is an Alembic data migration (not application-level seeding). This ensures seed data runs once per environment, is version-controlled, and is idempotent.

**Seed data composition (per requirements):**
- 3 API keys (one per role), 24-hour TTL for development
- 12 test loan applications in diverse statuses (3 approved, 2 denied, 3 awaiting_review, 1 processing, 1 processing_error, 1 draft, 1 withdrawn)
- At least 2 documents per non-draft application
- Complete audit trails for each application (state transitions, document uploads, agent decisions)
- Default confidence thresholds (auto_approve: 0.85, escalate_low: 0.60)
- Sample knowledge base regulatory excerpts with pre-computed embeddings (rag schema, Phase 3a prerequisite but seeded early)

**Idempotency:** Check for existence before inserting. For API keys, check `key_hash` uniqueness. For applications, use fixed UUIDs for seed records.

**Plaintext seed keys:** Print to console during seed migration so developers can copy them into API requests. Store HMAC hashes in DB, not plaintexts.

## Schema Concerns for Tech Lead to Address

1. **Escalation timestamp tracking.** Review queue sorting requires "time in queue." Current design uses `updated_at` on `loan_applications` (updated when status changes to `awaiting_review`). This works if no other updates occur while in review. If other fields could update during review (e.g., metadata annotations), add a dedicated `escalated_at TIMESTAMPTZ` column set when transitioning to `awaiting_review`.

2. **Document upload limit per application.** No current limit. Recommend adding a configurable max (e.g., 25 documents per application) enforced at API layer. DB does not need a constraint, but consider it for abuse prevention.

3. **Application ID as LangGraph thread ID.** Confirmed as UUID, compatible with both systems. On retry after `processing_error`, same thread ID resumes from checkpoint. On resubmission (Phase 4), increment `analysis_pass` and use thread ID `{application_id}:{analysis_pass}`.

4. **Hash chain validation frequency.** Daily background job validates hash chains for integrity. On export (Phase 5), full chain validation before export. No real-time validation on every read (too expensive).

5. **Connection pool sizing.** Two async pools: transactional (public schema) and RAG (rag schema). Transactional pool: 20 min, 50 max connections. RAG pool: 5 min, 20 max (vector search is slower, fewer concurrent). Audit writes use `SET ROLE` within transactional pool, not a third pool.

6. **pgvector index type.** Use HNSW for MVP (<10k document chunks). If knowledge base grows beyond 100k chunks, revisit index tuning. HNSW build is slower than IVF but query performance is superior for small-to-medium datasets.

7. **Statement timeout for RAG queries.** Set `statement_timeout = 10s` on RAG connection pool to prevent runaway vector scans. Transactional pool: `statement_timeout = 5s` (most queries <100ms). LLM latency dominates, so aggressive timeouts catch DB issues early.

## Recommendations Summary

- **Use INTEGER cents for all monetary values.** No floating-point.
- **Use BYTEA for encrypted fields.** Include key version prefix byte.
- **Use composite index `(status, updated_at)` for review queue.** Covers both filter and sort.
- **Implement all three immutability layers for audit_events.** Database role + trigger + hash chain.
- **Seed data as Alembic data migration.** Idempotent, version-controlled.
- **Advisory lock on application_id for audit inserts.** Serializes concurrent writes, maintains linear hash chain.
- **Two connection pools, not three.** Transactional + RAG. Audit uses `SET ROLE` within transactional pool.
- **Consider dedicated `escalated_at` timestamp** if review queue sorting requires precision beyond `updated_at`.

This advisory is based on the requirements, architecture, and constraints documented in the three provided files. The Tech Lead should validate that Phase 1's 37 P0 stories are fully covered by this schema design and note any gaps in the Technical Design Document.

---

**Absolute File Paths Referenced:**
- `/home/jary/redhat/git/agent-scaffold-test-teams/plans/requirements.md`
- `/home/jary/redhat/git/agent-scaffold-test-teams/plans/requirements-chunk-1-foundation.md`
- `/home/jary/redhat/git/agent-scaffold-test-teams/plans/requirements-chunk-2-core-workflow.md`
- `/home/jary/redhat/git/agent-scaffold-test-teams/plans/architecture.md`
