<!-- This project was developed with assistance from AI tools. -->

# Architecture Advisory -- Database Engineer

**Date:** 2026-02-12
**Input for:** Architect (plans/architecture.md)

---

## 1. Core Entity Model

Primary entities and cardinalities:

- **api_keys** (1) --< (N) **loan_applications** (created_by FK)
- **loan_applications** (1) --< (N) **documents** (uploaded files)
- **loan_applications** (1) --< (N) **audit_events** (append-only log)
- **loan_applications** (1) --< (N) **agent_decisions** (one per agent per analysis pass)
- **loan_applications** (1) --< (N) **review_actions** (human review records)
- **loan_applications** (1) --< (1) **workflow_checkpoints** (LangGraph state, latest per app)
- **knowledge_documents** (1) --< (N) **knowledge_embeddings** (chunked vectors for RAG)
- **intake_conversations** (1) --< (N) **intake_messages** (chat history, no FK to applications)
- **calculator_results** -- do NOT persist. Stateless computation, return in response body only.

`api_keys` stores hashed keys, role enum (`loan_officer`, `senior_underwriter`, `reviewer`), TTL/expiry, and active flag. This is the auth source of truth. Use UUIDs for all PKs exposed via API; internal auto-increment `BIGSERIAL` for audit_events (append performance).

## 2. PII Encryption Strategy

Encrypt at the application layer before INSERT using Fernet symmetric encryption (`cryptography` library). Key sourced from `ENCRYPTION_KEY` environment variable (or secrets manager).

**Encrypted columns:** `loan_applications.ssn_encrypted`, `loan_applications.account_numbers_encrypted`, `loan_applications.government_id_encrypted`. Store as `BYTEA`. Add a parallel `ssn_last4 VARCHAR(4)` column (plaintext) for display/search purposes only.

**Querying implications:** Encrypted columns cannot be used in WHERE, JOIN, or ORDER BY. All lookups must use application_id (UUID) or the `ssn_last4` partial field. Never decrypt in SQL -- always decrypt in the Python service layer. Index `ssn_last4` only if search-by-last4 is a real query pattern.

## 3. Audit Trail Immutability

**Table:** `audit_events` with columns: `id BIGSERIAL PK`, `application_id UUID FK`, `event_type VARCHAR NOT NULL`, `actor_id UUID`, `actor_role VARCHAR`, `agent_name VARCHAR`, `confidence_score NUMERIC(4,3)`, `reasoning TEXT`, `input_data_hash VARCHAR(64)`, `previous_state VARCHAR`, `new_state VARCHAR`, `metadata JSONB`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**Enforcement mechanism:** Create a dedicated PostgreSQL role `audit_writer` with `INSERT`-only privilege on `audit_events`. Revoke UPDATE and DELETE. The application connects to audit_events through this role (or a separate connection pool using this role). Add a `BEFORE UPDATE OR DELETE` trigger that raises an exception as a defense-in-depth measure.

**Hash chaining:** Each row includes `prev_event_hash VARCHAR(64)` containing SHA-256 of the previous event's `(id, application_id, event_type, created_at, prev_event_hash)`. First event per application uses a null sentinel. This enables tamper detection during audit export.

## 4. pgvector for RAG

**Separate schema:** Place RAG tables in a `rag` schema (`rag.knowledge_documents`, `rag.knowledge_embeddings`). Application tables stay in the `public` schema. This provides logical separation without a second database.

**Embedding column:** `rag.knowledge_embeddings.embedding VECTOR(1536)` (dimension matches embedding model; adjust if using a different model). Index with `CREATE INDEX ON rag.knowledge_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`. Rebuild index after bulk inserts. For small document counts (<10k chunks), `HNSW` index is a better choice: `CREATE INDEX ON rag.knowledge_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`.

**Connection pool isolation:** Configure two SQLAlchemy async connection pools: one for transactional queries (`public` schema, higher priority) and one for RAG similarity searches (`rag` schema, lower `statement_timeout`, separate pool size). Set `statement_timeout = '5s'` on the RAG pool to prevent long-running vector scans from holding connections. This prevents RAG load spikes from starving transactional queries.

## 5. LangGraph Checkpoint Storage

LangGraph's `PostgresSaver` manages its own tables. Place it in a dedicated `langgraph` schema to avoid collision with application tables. Configure via `PostgresSaver.from_conn_string(...)` with `schema="langgraph"`.

**Lifecycle management:** Completed workflow checkpoints (terminal states: approved, denied, withdrawn) are no longer needed for resumption. Add a periodic cleanup job (daily cron or background task) that deletes checkpoint rows where the associated `loan_applications.status` is terminal and `loan_applications.updated_at` is older than 30 days. Do NOT delete checkpoints for active workflows -- these are critical for crash recovery.

## 6. Financial Precision

| Value Type | PostgreSQL Type | Python Type | Example |
|------------|----------------|-------------|---------|
| Monetary amounts | `INTEGER` (cents) | `int` | 250000 = $2,500.00 |
| Interest rates | `NUMERIC(8,6)` | `decimal.Decimal` | 6.875000 = 6.875% |
| DTI/LTV ratios | `NUMERIC(8,4)` | `decimal.Decimal` | 43.5000 = 43.5% |
| Confidence scores | `NUMERIC(4,3)` | `decimal.Decimal` | 0.950 |

Never use `FLOAT`, `DOUBLE PRECISION`, or `REAL` for any financial or scoring value. Format to dollars/percentages only at the API serialization layer.

## 7. Phase-by-Phase Schema Evolution

Use **Alembic** with one migration per logical entity group. Forward-only for MVP (down migrations provided but not required to run in shared environments). Migration naming: `YYYYMMDD_HHMMSS_<description>.py`.

| Phase | Migrations |
|-------|-----------|
| 1 | `api_keys`, `loan_applications`, `documents`, `audit_events` (with trigger + hash chaining), `langgraph` schema setup, seed data |
| 2 | `agent_decisions`, add columns to `loan_applications` for extracted data, PII encrypted fields |
| 3a | `rag` schema + `knowledge_documents` + `knowledge_embeddings` + vector index |
| 3b | `intake_conversations` + `intake_messages` |
| 4 | `fraud_flags` table, `review_actions` (if not already in Phase 1), add `resubmission_count` to applications |
| 5 | `compliance_reports`, `threshold_change_log`, indexes for reporting queries |

Each migration must be idempotent (`IF NOT EXISTS`). Test both up and down locally before merge. Never modify a migration that has been applied to any shared environment.
