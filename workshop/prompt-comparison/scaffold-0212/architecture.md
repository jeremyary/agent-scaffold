<!-- This project was developed with assistance from AI tools. -->

# Architecture: AI Mortgage Quickstart

**Version:** 1.0
**Date:** 2026-02-12
**Status:** Proposed

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Data Architecture](#3-data-architecture)
4. [API Design](#4-api-design)
5. [Agent Architecture](#5-agent-architecture)
6. [Security Architecture](#6-security-architecture)
7. [Infrastructure Architecture](#7-infrastructure-architecture)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [File Structure](#9-file-structure)
10. [Open Architectural Questions](#10-open-architectural-questions)
11. [Phase-by-Phase Build Order](#11-phase-by-phase-build-order)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
                                 +------------------+
                                 |   React 19 + Vite|
                                 |   (packages/ui)  |
                                 +--------+---------+
                                          |
                                     HTTP / SSE
                                          |
                     +--------------------v--------------------+
                     |           FastAPI (packages/api)        |
                     |                                         |
                     |  +-------------+   +----------------+   |
                     |  | Public Tier  |   | Protected Tier |   |
                     |  | /v1/public/* |   | /v1/*          |   |
                     |  +------+------+   +-------+--------+   |
                     |         |                  |             |
                     |  +------v------------------v----------+  |
                     |  |         Middleware Stack            |  |
                     |  | Correlation ID | Auth | Rate Limit |  |
                     |  +------+------------------+----------+  |
                     |         |                  |             |
                     |  +------v------+   +-------v--------+   |
                     |  | Intake Graph|   | Loan Processing |   |
                     |  | (LangGraph) |   | Graph (LangGraph)|  |
                     |  +------+------+   +-------+--------+   |
                     |         |                  |             |
                     +---------+------------------+-------------+
                               |                  |
          +--------------------+------------------+-----+
          |                    |                  |      |
    +-----v------+    +-------v-------+   +------v---+  |
    |  Redis      |    |  PostgreSQL   |   |  MinIO   |  |
    |  (cache,    |    |  + pgvector   |   |  (S3)    |  |
    |  sessions,  |    |  (packages/db)|   |          |  |
    |  rate limit)|    +-------+-------+   +----------+  |
    +-------------+            |                         |
                               |                         |
                    +----------+----------+              |
                    |                     |              |
              +-----v------+    +--------v--------+     |
              | LangGraph   |    | Application     |     |
              | Checkpoints |    | Data + Vectors  |     |
              | (PostgresSvr)|    | (SQLAlchemy)    |     |
              +-------------+    +-----------------+     |
                                                         |
          +----------------------------------------------+
          |
    +-----v--------+     +-----------+     +-------------+
    | FRED API     |     | BatchData |     | LLM APIs    |
    | (rates)      |     | (property)|     | Claude,     |
    +--------------+     +-----------+     | GPT-4 Vision|
                                           +-------------+
                                                  |
                                           +------v------+
                                           |  LangFuse   |
                                           | (LLM traces)|
                                           +-------------+
```

### 1.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Two independent agent graphs | Loan Processing Graph + Intake Graph | Different lifecycle, security posture, and scaling characteristics. Loan processing is authenticated, stateful, multi-step. Intake is public, conversational, stateless per request. Coupling them would force shared deployment and failure modes. |
| Single PostgreSQL for data + vectors | pgvector extension, no separate vector DB | Stakeholder constraint. Reduces operational complexity for a quickstart. pgvector is sufficient for the RAG scale needed (hundreds of regulatory documents, not millions). |
| API key auth with server-side role mapping | Bearer token, server resolves key to role | Real auth from day one (stakeholder preference). Server-side mapping prevents client-asserted role escalation. Simple enough for MVP, same interface pattern as JWT for future migration. |
| LangGraph PostgresSaver for checkpoints | Separate checkpoint tables managed by LangGraph | Framework-native checkpointing. Designed for full graph from Phase 1 to avoid checkpoint migration pain. See ADR in Section 10.3. |
| Redis for multi-purpose caching | RAG cache, sessions, rate limiting, external API cache | Single cache service reduces operational complexity. Namespace isolation via key prefixes prevents cross-concern interference. |
| Mocked services behind interfaces | Credit bureau, employment verification, BatchData (default) | Same Python protocol/interface as real services. Swap via configuration (environment variable), no code changes. |
| Decimal/integer cents for money | Python Decimal backend, integer cents in DB | Domain rule: never floating-point for money. Integer cents in the database are universally portable. Decimal in Python for calculation precision. |
| Simplified auth format | `Bearer <api_key>` with server-side role resolution | The product plan referenced `Bearer <role>:<key>` format. This was changed to `Bearer <api_key>` with server-side role resolution to prevent client-asserted role escalation. See Section 6.1 for details. |

### 1.3 System Boundaries

The system has three trust boundaries:

1. **Public boundary** -- Unauthenticated users interact with the Intake Graph and mortgage calculator. All input is untrusted. Rate limiting, prompt injection defense, and cost caps apply.
2. **Authenticated boundary** -- API key holders interact with the Loan Processing Graph. Input is validated but trusted to the extent of the holder's role.
3. **External service boundary** -- The system calls LLM APIs, FRED, and BatchData. All external responses are treated as untrusted input that may be malformed, delayed, or unavailable.

---

## 2. Component Architecture

### 2.1 API Layer (FastAPI)

#### Route Structure

All routes are versioned under `/v1/`. The public and protected tiers are distinguished by path prefix and middleware behavior.

```
/health                          # Liveness (no auth)
/ready                           # Readiness (no auth)

/v1/public/chat                  # Intake agent chat (no auth, rate limited)
/v1/public/chat/stream           # SSE streaming chat (no auth, rate limited)
/v1/public/calculator            # Mortgage calculator (no auth, rate limited)
/v1/public/rates                 # Current mortgage rates (no auth, rate limited)
/v1/public/property              # Property lookup (no auth, rate limited, 5/session)

/v1/applications                 # CRUD for loan applications (auth required)
/v1/applications/{id}            # Single application detail
/v1/applications/{id}/documents  # Document upload and listing
/v1/applications/{id}/submit     # Submit application for processing
/v1/applications/{id}/review     # Human review actions (approve/deny/request-docs)
/v1/applications/{id}/audit      # Audit trail for an application
/v1/applications/{id}/audit/export  # Export audit trail (reviewer only)
/v1/applications/{id}/coaching   # Denial coaching results

/v1/review-queue                 # Review queue listing (auth, role-filtered)

/v1/config/thresholds            # Confidence threshold management (reviewer only)
/v1/config/fraud-sensitivity     # Fraud sensitivity configuration (reviewer only)

/v1/admin/keys                   # API key management (P2, reviewer only)
/v1/admin/analytics              # Portfolio analytics (P2, reviewer only)
/v1/admin/knowledge-base         # Knowledge base management (reviewer only)
```

#### Middleware Stack

Middleware executes in this order for every request:

```
Request
  |
  v
[0] CORS middleware
    - Allowed origins: http://localhost:3000 (dev), configurable via CORS_ORIGINS env var
    - Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
    - Allowed headers: Authorization, Content-Type, X-Request-ID, X-Session-ID
    - Credentials: true
    - Handled by FastAPI's CORSMiddleware (outermost middleware)
  |
  v
[1] Correlation ID middleware
    - Reads X-Request-ID header or generates UUID v4
    - Attaches to request state and async context var
    - Adds to response headers
  |
  v
[2] Structured logging middleware
    - Logs request start (method, path, correlation_id)
    - Times request duration
    - Logs request completion (status, duration_ms)
    - Never logs request/response bodies in production
  |
  v
[3] Rate limiting middleware (public tier only)
    - Checks session-based limits (20 chat/hr, 5 property/session)
    - Checks IP-based limits (100 chat/day, 20 property/day)
    - Returns 429 with X-RateLimit-* headers on violation
    - Checks per-session concurrency (max 1 active inference)
    - Skips for authenticated tier
  |
  v
[4] Authentication middleware
    - Skips /health, /ready, /v1/public/* paths
    - Extracts Bearer token from Authorization header
    - Looks up token hash in database (api_keys table)
    - Resolves role from server-side mapping
    - Returns 401 on missing/invalid token
    - Attaches user identity and role to request state
  |
  v
[5] Authorization middleware
    - Checks required role for the endpoint against user's role
    - Role hierarchy: loan_officer < senior_underwriter < reviewer
    - Returns 403 on insufficient permissions
  |
  v
[6] Request size limits
    - JSON request bodies: 1 MB maximum
    - File uploads: 10 MB per file
    - Multipart requests: 50 MB total
    - Returns 413 (Payload Too Large) if exceeded
  |
  v
[7] Input validation (per-endpoint, Pydantic models)
  |
  v
Route handler
```

#### Request Lifecycle

Every request follows this lifecycle:

1. **Enter middleware chain** -- correlation ID assigned, logging started.
2. **Rate limit check** (public tier) -- Redis lookup for session/IP counters.
3. **Authentication** (protected tier) -- API key hash lookup in database with Redis cache (60-second TTL for key-to-role mapping).
4. **Authorization** -- Role check against endpoint requirement.
5. **Validation** -- Pydantic model validates request body/params.
6. **Handler execution** -- Business logic, possibly invoking agent graph.
7. **Response serialization** -- RFC 7807 for errors, data envelope for success.
8. **Logging** -- Request completion logged with duration and status.

### 2.2 Agent System

Two independent LangGraph graphs share infrastructure but have separate codebases, configurations, and lifecycle management. See Section 5 for detailed agent architecture.

### 2.3 Database Layer

PostgreSQL with pgvector. Three logical partitions within a single database:

1. **Application data** -- applications, documents, agent_decisions, audit_events, users, configuration. Managed by SQLAlchemy 2.0 async + Alembic.
2. **LangGraph checkpoints** -- checkpoint_blobs, checkpoint_writes, checkpoint_metadata tables. Managed by LangGraph PostgresSaver (framework-owned schema).
3. **Vector embeddings** -- embeddings table for RAG (compliance documents, mortgage knowledge base). Managed by application code using pgvector.

See Section 3 for complete schema.

### 2.4 Cache Layer (Redis)

Redis serves four distinct functions, isolated by key prefix:

| Function | Key Pattern | TTL | Purpose |
|----------|-------------|-----|---------|
| RAG query cache | `rag:{query_hash}` | 24 hours | Cache knowledge retrieval results |
| Session data | `session:{session_id}` | 24 hours (public), 90 days (auth) | Session state for public and authenticated users |
| Rate limiting | `ratelimit:{type}:{identifier}` | Varies (1h, 24h) | Session and IP rate limit counters |
| External API cache | `ext:{service}:{key}` | Varies (1h for FRED, 24h for BatchData) | Cache external API responses |
| Auth cache | `auth:{key_hash_prefix}` | 60 seconds | Cache API key lookups to reduce DB load |

**Redis authentication:**
- **Local development:** Redis runs without authentication, isolated within the Docker Compose network (no host-bound port exposure in production).
- **Production:** Redis requires authentication via `requirepass` directive or Redis 6+ ACLs for granular access control.
- **URL format with auth:** `redis://:password@redis:6379/0`. The `REDIS_URL` environment variable supports this format natively.

Each function uses a distinct key prefix. If Redis is unavailable:
- RAG queries run without caching (slower, functional).
- Sessions fall back to signed cookies with limited state.
- Rate limiting degrades to in-memory counters (per-process, not distributed).
- External API calls go directly to source.
- Auth lookups go directly to database.

### 2.5 Object Storage (MinIO)

MinIO provides S3-compatible object storage for document uploads.

**Bucket structure:**

```
mortgage-documents/
  {application_id}/
    {document_id}/{filename}       # Original upload
    {document_id}/redacted/{filename}  # Redacted version (for LLM processing)
```

**Access patterns:**
- Upload: Loan officer uploads via API; API stores in MinIO, creates DB record.
- Read (original): Restricted to authenticated users with application access. Original documents with PII are never served to external services.
- Read (redacted): Used by document processing agent when calling external LLM APIs.
- Presigned URLs: Generated server-side for secure, time-limited direct download links (15-minute expiry).

### 2.6 External Integrations

| Service | Interface | Caching | Fallback |
|---------|-----------|---------|----------|
| FRED API | HTTP GET to `api.stlouisfed.org` | Redis, 1-hour TTL | Last cached value with notice; hardcoded default (6.5%) if never cached |
| BatchData API | HTTP GET (mocked by default) | Redis, 24-hour TTL | Mocked service always available as fallback |
| Claude (Anthropic) | LangChain ChatAnthropic | None (per-request) | Retry 3x with exponential backoff; fail workflow step on exhaustion |
| GPT-4 Vision (OpenAI) | LangChain ChatOpenAI | None (per-request) | Retry 3x with exponential backoff; fail workflow step on exhaustion |
| LangFuse | LangFuse SDK callback | None | Silently skip tracing; log warning |

**Mocked service interface pattern:**

All mocked services implement a Python Protocol class. The real and mock implementations are selected via environment variable:

```python
# packages/api/src/services/protocols.py
class CreditBureauService(Protocol):
    async def get_credit_report(self, ssn_hash: str) -> CreditReport: ...

# packages/api/src/services/credit_bureau_mock.py
class MockCreditBureauService:
    async def get_credit_report(self, ssn_hash: str) -> CreditReport: ...

# packages/api/src/services/credit_bureau_real.py  (future)
class RealCreditBureauService:
    async def get_credit_report(self, ssn_hash: str) -> CreditReport: ...
```

Selection in dependency injection:

```python
# packages/api/src/dependencies.py
def get_credit_bureau_service() -> CreditBureauService:
    if settings.CREDIT_BUREAU_PROVIDER == "real":
        return RealCreditBureauService(api_key=settings.CREDIT_BUREAU_API_KEY)
    return MockCreditBureauService()
```

#### External Response Validation

All responses from external services (FRED, BatchData, LLM APIs) are treated as untrusted input and validated before use:

- **Type validation:** Every external response is parsed through a Pydantic model. Fields with unexpected types cause a validation error, not a silent coercion.
- **Length limits:** FRED API responses must be under 1 KB. BatchData responses must be under 10 KB. Responses exceeding these limits are rejected.
- **Content sanitization:** String fields from external responses are stripped of HTML tags and script content before storage or display. This prevents stored XSS from compromised external data.
- **Numeric bounds:** Interest rates must be between 0.1% and 20% (10-2000 bps). Property values must be positive integers. Values outside these bounds are rejected.
- **Failed validation behavior:** Validation failures are logged as warnings (including the service name, endpoint, and nature of the failure -- but not the raw response body). The system degrades gracefully: cached values are used if available, otherwise the dependent feature is unavailable with an appropriate error message.

---

## 3. Data Architecture

### 3.1 Database Schema

All monetary values stored as integer cents. All timestamps are UTC. UUIDs are used for primary keys.

#### applications

```sql
CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    borrower_name   VARCHAR(255) NOT NULL,
    ssn_encrypted   BYTEA NOT NULL,           -- AES-256-GCM encrypted SSN
    ssn_hash        VARCHAR(64) NOT NULL,      -- SHA-256 hash for lookups (salted)
    loan_amount_cents BIGINT NOT NULL,         -- Loan amount in cents
    property_address TEXT NOT NULL,
    loan_term_months INTEGER NOT NULL,         -- e.g., 360 for 30 years
    interest_rate_bps INTEGER,                 -- Basis points (650 = 6.50%)
    status          VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    -- Status enum: DRAFT, PROCESSING, DOCUMENT_PROCESSING, PARALLEL_ANALYSIS,
    --   AGGREGATED, AUTO_APPROVED, ESCALATED, DENIED, PROCESSING_FAILED,
    --   AWAITING_DOCUMENTS, HUMAN_APPROVED, HUMAN_DENIED
    -- Note: PROCESSING_FAILED indicates a technical failure (LLM timeout,
    --   service unavailable). ESCALATED indicates the system completed
    --   processing but confidence was insufficient for auto-decision.
    escalation_reason TEXT,                    -- Null if not escalated
    required_reviewer_role VARCHAR(30),        -- 'loan_officer' or 'senior_underwriter'
    workflow_thread_id UUID,                   -- LangGraph thread ID for checkpoint resume
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_created_by ON applications(created_by);
CREATE INDEX idx_applications_updated_at ON applications(updated_at DESC);
CREATE INDEX idx_applications_ssn_hash ON applications(ssn_hash);
```

**Note on VARCHAR vs PostgreSQL ENUM types:** VARCHAR is chosen over PostgreSQL ENUM types for `status`, `role`, and similar constrained fields for migration flexibility. Adding or renaming values in a PostgreSQL ENUM requires DDL changes that can be awkward in Alembic migrations. Valid values are enforced at the application layer via Pydantic model validators. CHECK constraints may be added during production hardening if stronger database-level guarantees are needed.

#### documents

```sql
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id),
    filename        VARCHAR(255) NOT NULL,
    content_type    VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    file_size_bytes BIGINT NOT NULL,
    storage_key     TEXT NOT NULL,              -- MinIO object key
    redacted_storage_key TEXT,                  -- MinIO key for redacted version
    document_type   VARCHAR(30),               -- W2, PAY_STUB, TAX_RETURN, BANK_STATEMENT, APPRAISAL, PHOTO, UNKNOWN
    classification_confidence NUMERIC(3,2),     -- 0.00 to 1.00
    extracted_data  JSONB,                      -- Structured extraction results
    extraction_confidence JSONB,                -- Per-field confidence scores
    pdf_metadata    JSONB,                      -- Creation date, producer, etc. for fraud detection
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,
    uploaded_by     UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_documents_application ON documents(application_id);
CREATE INDEX idx_documents_type ON documents(document_type);
```

#### agent_decisions

```sql
CREATE TABLE agent_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id),
    agent_name      VARCHAR(50) NOT NULL,
    -- Agent names: supervisor, document_processing, credit_analysis,
    --   risk_assessment, compliance, fraud_detection, denial_coaching, intake
    decision_type   VARCHAR(50) NOT NULL,
    -- Decision types: classification, extraction, credit_assessment,
    --   risk_score, compliance_check, fraud_check, routing_decision,
    --   coaching_output, aggregation
    confidence_score NUMERIC(3,2),              -- 0.00 to 1.00
    recommendation  VARCHAR(30),                -- APPROVE, DENY, ESCALATE, FLAG
    reasoning       TEXT NOT NULL,              -- Human-readable reasoning
    findings        JSONB NOT NULL DEFAULT '{}', -- Structured findings (DTI, LTV, flags, etc.)
    model_used      VARCHAR(100),               -- e.g., "claude-3-5-sonnet", "gpt-4-vision"
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    latency_ms      INTEGER,
    correlation_id  UUID NOT NULL,
    parent_step_id  UUID,                       -- Links to workflow step for parallel fan-out
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_decisions_application ON agent_decisions(application_id);
CREATE INDEX idx_agent_decisions_agent ON agent_decisions(agent_name);
CREATE INDEX idx_agent_decisions_correlation ON agent_decisions(correlation_id);
```

#### audit_events

This table is **append-only**. The application database role has only INSERT and SELECT grants. No UPDATE or DELETE.

```sql
CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID,                       -- Null for system-level events
    event_type      VARCHAR(50) NOT NULL,
    -- Event types: workflow_initialized, agent_dispatched, agent_completed,
    --   aggregation_completed, routing_decision, escalated, auto_approved,
    --   denied, human_review_started, human_approved, human_denied,
    --   documents_requested, documents_uploaded, threshold_changed,
    --   sensitivity_changed, audit_exported, application_created,
    --   key_generated, key_revoked
    actor_type      VARCHAR(20) NOT NULL,       -- 'agent' or 'user'
    actor_id        VARCHAR(100) NOT NULL,      -- Agent name or user ID
    actor_role      VARCHAR(30),                -- User role if actor_type = 'user'
    details         JSONB NOT NULL DEFAULT '{}', -- Event-specific payload
    -- For agent events: {confidence, reasoning, model_used}
    -- For human events: {decision, rationale}
    -- For threshold changes: {field, old_value, new_value}
    -- For workflow transitions: {from_status, to_status, trigger}
    correlation_id  UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutability enforcement: application role cannot UPDATE or DELETE
-- Applied in migration:
-- REVOKE UPDATE, DELETE ON audit_events FROM app_role;
-- GRANT INSERT, SELECT ON audit_events TO app_role;

CREATE INDEX idx_audit_events_application ON audit_events(application_id);
CREATE INDEX idx_audit_events_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_created ON audit_events(created_at);
CREATE INDEX idx_audit_events_correlation ON audit_events(correlation_id);
```

#### users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(30) NOT NULL,
    -- Roles: loan_officer, senior_underwriter, reviewer
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### api_keys

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    key_hash        VARCHAR(128) NOT NULL UNIQUE,  -- SHA-256 hash of the API key
    key_prefix      VARCHAR(8) NOT NULL,           -- First 8 chars for identification in logs
    is_default      BOOLEAN NOT NULL DEFAULT false, -- Flag for startup warning
    expires_at      TIMESTAMPTZ,                   -- Null = no expiration (MVP default)
    revoked_at      TIMESTAMPTZ,                   -- Null = active
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

#### configuration

```sql
CREATE TABLE configuration (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(100) NOT NULL UNIQUE,
    value           JSONB NOT NULL,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default configuration rows (seeded in migration):
-- key: 'confidence_thresholds' -> {"auto_approve": 0.85, "escalation": 0.60, "denial": 0.40}
-- key: 'fraud_sensitivity'     -> {"level": "MEDIUM"}
-- key: 'rate_limits'           -> {"chat_per_hour": 20, "property_per_session": 5, ...}
```

#### embeddings (pgvector)

```sql
CREATE TABLE embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content         TEXT NOT NULL,
    embedding       vector(1536) NOT NULL,       -- OpenAI text-embedding-3-small dimension
    metadata        JSONB NOT NULL DEFAULT '{}', -- {source, section, document_version}
    collection      VARCHAR(50) NOT NULL,        -- 'compliance', 'mortgage_knowledge'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_collection ON embeddings(collection);
-- lists=100 is a starting value; re-evaluate when knowledge base size is known
-- (guideline: lists = sqrt(n) where n is the number of vectors)
CREATE INDEX idx_embeddings_vector ON embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### LangGraph Checkpoint Tables

These tables are managed by LangGraph PostgresSaver. The schema is defined by the framework; we configure but do not modify it. The key design decision is to use a **single checkpoint store** for both graphs, distinguished by thread namespace.

LangGraph PostgresSaver creates these tables automatically:

- `checkpoint_blobs` -- Serialized graph state at each step
- `checkpoint_writes` -- Write log for conflict detection
- `checkpoint_metadata` -- Thread metadata, parent checkpoints

**Thread ID convention:**
- Loan Processing Graph: `loan:{application_id}`
- Intake Graph: `intake:{session_id}`

This namespace convention allows both graphs to share the checkpoint store while maintaining complete isolation. The full graph structure (all node definitions, edges, parallel fan-out branches, cyclic paths) is defined in Phase 1 even though most nodes are stubs. This ensures checkpoint schema compatibility across all phases.

### 3.2 Database Roles

Two PostgreSQL roles enforce separation of concerns:

| Role | Grants | Purpose |
|------|--------|---------|
| `app_role` | SELECT, INSERT, UPDATE, DELETE on all tables EXCEPT audit_events; SELECT, INSERT only on audit_events | Application runtime role. Cannot modify or delete audit records. |
| `migration_role` | All privileges on all tables, sequences, indexes | Used by Alembic for schema changes only. Not used at runtime. |

Migration applies these grants:

```sql
-- In Alembic migration
REVOKE UPDATE, DELETE ON audit_events FROM app_role;
GRANT SELECT, INSERT ON audit_events TO app_role;
```

### 3.3 Migration Strategy

- **Framework:** Alembic with async SQLAlchemy.
- **Location:** `packages/db/alembic/versions/`
- **Naming:** `{revision_id}_{description}.py` (auto-generated by Alembic).
- **Requirements:** Every migration includes both `upgrade()` and `downgrade()`. Migrations are idempotent.
- **Commands:** `make db-upgrade` (apply), `make db-rollback` (revert last).
- **CI gate:** Migrations are tested in CI before merge (up, verify, down, verify).

**Database role setup:** The initial migration (`001_initial_schema.py`) creates the `app_role` and `migration_role` database roles and applies the appropriate grants. This migration runs as the PostgreSQL superuser (or the `postgres` user in development). Subsequent migrations that add tables or modify schema use `migration_role` for DDL changes. The `app_role` grants are updated in the same migration that creates new tables to maintain grant consistency.

### 3.4 Data Flow: Application Processing

```
1. Loan officer creates application (POST /v1/applications)
   -> applications row created (status: DRAFT)
   -> audit_event: application_created

2. Loan officer uploads documents (POST /v1/applications/{id}/documents)
   -> Document stored in MinIO
   -> documents row created
   -> audit_event: documents_uploaded

3. Loan officer submits application (POST /v1/applications/{id}/submit)
   -> Status -> PROCESSING
   -> LangGraph thread created (loan:{application_id})
   -> Supervisor agent initializes workflow
   -> audit_event: workflow_initialized

4. Supervisor routes to document processing
   -> Status -> DOCUMENT_PROCESSING
   -> For each document:
     a. PII redaction (redacted copy stored in MinIO)
     b. Classification via GPT-4 Vision (redacted image)
     c. Data extraction via GPT-4 Vision (redacted image)
     d. PDF metadata extraction (local, no LLM)
   -> agent_decisions rows created
   -> audit_events: agent_dispatched, agent_completed

5. Supervisor initiates parallel analysis fan-out
   -> Status -> PARALLEL_ANALYSIS
   -> Phase 2: credit_analysis + risk_assessment run in parallel
   -> Phase 3a: + compliance + fraud_detection run in parallel
   -> Each agent:
     a. Receives application context + document extraction results
     b. Produces confidence score + reasoning + structured findings
     c. Creates agent_decisions row
     d. Creates audit_event

6. Supervisor aggregates results
   -> Status -> AGGREGATED
   -> Collects all agent results
   -> Identifies disagreements
   -> Generates consolidated narrative
   -> audit_event: aggregation_completed

7. Supervisor makes routing decision
   -> Reads current thresholds from configuration table
   -> Evaluates confidence scores against thresholds
   -> If all high confidence, no fraud flags, no disagreements:
      -> Status -> AUTO_APPROVED
      -> audit_event: auto_approved
   -> If any medium confidence or agent disagreement:
      -> Status -> ESCALATED
      -> required_reviewer_role = 'loan_officer' (medium) or 'senior_underwriter' (low)
      -> audit_event: escalated
   -> If fraud flag:
      -> Status -> ESCALATED (reason: fraud_flag)
      -> audit_event: escalated
   -> If below denial threshold:
      -> Status -> DENIED
      -> Denial coaching agent runs
      -> audit_event: denied

8. [If escalated] Human review
   -> Reviewer sees application in review queue
   -> Reviewer can: APPROVE, DENY, or REQUEST_MORE_DOCUMENTS
   -> audit_event: human_approved / human_denied / documents_requested

9. [If request more documents] Cyclic resubmission
   -> Status -> AWAITING_DOCUMENTS
   -> When documents uploaded, workflow restarts from step 4
   -> Previous analysis preserved in audit trail
   -> audit_event: workflow_restarted
```

**Error paths at each boundary:**

| Step | Failure Mode | Behavior |
|------|-------------|----------|
| 2 (upload) | MinIO unavailable | Return 503; do not create DB record |
| 4b (classification) | LLM API timeout/error | Retry 3x exponential backoff; on exhaustion, classify as "unknown", escalate |
| 4c (extraction) | LLM API error | Retry 3x; on exhaustion, record partial extraction, escalate |
| 5 (parallel) | One agent fails | Other agents continue; failed agent recorded as error; application escalated |
| 5 (parallel) | All agents timeout | Application status -> ESCALATED with reason "processing_timeout" |
| 7 (routing) | Configuration table unreachable | Use hardcoded default thresholds; log error |
| 8 (review) | Database write fails | Return 500; no state change; reviewer can retry |

---

## 4. API Design

### 4.1 Authentication Flow

```
Client                              API Server                     Database
  |                                     |                              |
  |  Authorization: Bearer <api_key>    |                              |
  |------------------------------------>|                              |
  |                                     |  SHA-256(api_key)            |
  |                                     |----------------------------->|
  |                                     |  Check auth cache (Redis)    |
  |                                     |     OR                       |
  |                                     |  SELECT user_id, role        |
  |                                     |  FROM api_keys               |
  |                                     |  JOIN users ON ...           |
  |                                     |  WHERE key_hash = ?          |
  |                                     |  AND revoked_at IS NULL      |
  |                                     |  AND (expires_at IS NULL     |
  |                                     |       OR expires_at > now()) |
  |                                     |<-----------------------------|
  |                                     |                              |
  |  200 OK (with user context)         |                              |
  |<------------------------------------|                              |
```

**API key generation (MVP seed):**

At startup / migration, default keys are created:

```python
# Generated during make setup / seed data
# Key format: mq_{role}_{random_32_chars}
# Example: mq_loan_officer_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
# Stored: SHA-256 hash of the full key
# Prefix stored: first 8 chars for log identification
```

The key format uses a prefix convention (`mq_` for mortgage quickstart) for human readability, but the server never parses the key -- it simply hashes and looks up. The role is determined entirely by the server-side mapping in the `api_keys` table.

**Default keys (seeded, flagged as is_default=true):**

| Role | Key Prefix | Purpose |
|------|-----------|---------|
| loan_officer | `mq_lo_***` | Demo loan officer |
| senior_underwriter | `mq_su_***` | Demo senior underwriter |
| reviewer | `mq_rv_***` | Demo reviewer |

On startup, if any key with `is_default = true` exists and is not revoked, the system logs:

```
[ERROR] Running with default API keys. Change keys before deploying to production.
```

### 4.2 Request/Response Shapes

#### Create Application

**Request:**

```http
POST /v1/applications
Authorization: Bearer mq_lo_a1b2c3d4...
Content-Type: application/json
```

```json
{
    "borrowerName": "Jane Doe",
    "ssn": "123-45-6789",
    "loanAmountCents": 32000000,
    "propertyAddress": "123 Main St, Springfield, IL 62701",
    "loanTermMonths": 360
}
```

**Response (201 Created):**

```json
{
    "data": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "borrowerName": "Jane Doe",
        "loanAmountCents": 32000000,
        "propertyAddress": "123 Main St, Springfield, IL 62701",
        "loanTermMonths": 360,
        "status": "DRAFT",
        "createdAt": "2026-02-12T14:30:00Z",
        "updatedAt": "2026-02-12T14:30:00Z"
    }
}
```

Note: SSN is never returned in any response body. It is accepted on creation, encrypted, and stored. Subsequent reads never include it.

**Location header:** `Location: /v1/applications/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

#### Application Detail

**Response (200 OK):**

```json
{
    "data": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "borrowerName": "Jane Doe",
        "loanAmountCents": 32000000,
        "propertyAddress": "123 Main St, Springfield, IL 62701",
        "loanTermMonths": 360,
        "interestRateBps": 650,
        "status": "ESCALATED",
        "escalationReason": "Agent disagreement: credit_analysis recommends APPROVE, risk_assessment recommends ESCALATE",
        "requiredReviewerRole": "loan_officer",
        "createdAt": "2026-02-12T14:30:00Z",
        "updatedAt": "2026-02-12T15:02:00Z",
        "documents": [
            {
                "id": "d1d2d3d4-...",
                "filename": "w2-2025.pdf",
                "documentType": "W2",
                "classificationConfidence": 0.95,
                "uploadedAt": "2026-02-12T14:35:00Z"
            }
        ],
        "agentAnalysis": {
            "documentProcessing": {
                "status": "completed",
                "confidence": 0.92,
                "summary": "All documents classified and extracted successfully.",
                "completedAt": "2026-02-12T14:50:00Z"
            },
            "creditAnalysis": {
                "status": "completed",
                "confidence": 0.88,
                "recommendation": "APPROVE",
                "summary": "Strong credit profile. FICO 720, no derogatory marks.",
                "findings": {
                    "creditScore": 720,
                    "paymentHistoryRating": "EXCELLENT",
                    "derogatoryMarks": 0
                },
                "completedAt": "2026-02-12T14:55:00Z"
            },
            "riskAssessment": {
                "status": "completed",
                "confidence": 0.65,
                "recommendation": "ESCALATE",
                "summary": "DTI at 44% exceeds qualified mortgage threshold.",
                "findings": {
                    "dtiRatio": 0.44,
                    "ltvRatio": 0.80,
                    "employmentStabilityScore": 0.85,
                    "riskFlags": ["DTI_ABOVE_THRESHOLD"]
                },
                "completedAt": "2026-02-12T14:56:00Z"
            },
            "compliance": null,
            "fraudDetection": null,
            "denialCoaching": null,
            "consolidatedNarrative": "Credit profile is strong (FICO 720) but DTI ratio of 44% exceeds the 43% qualified mortgage threshold. Risk assessment recommends escalation while credit analysis recommends approval. This disagreement requires human review."
        },
        "workflowThreadId": "loan:a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
}
```

#### Human Review Action

**Request:**

```http
POST /v1/applications/{id}/review
Authorization: Bearer mq_lo_a1b2c3d4...
Content-Type: application/json
```

```json
{
    "decision": "APPROVE",
    "rationale": "Income variance is due to seasonal overtime; verified via W-2 supplemental notes. DTI is 44% which is marginally above threshold but compensated by strong credit profile and 20% down payment."
}
```

**Response (200 OK):**

```json
{
    "data": {
        "applicationId": "a1b2c3d4-...",
        "status": "HUMAN_APPROVED",
        "reviewedBy": "Maria Lopez",
        "reviewedAt": "2026-02-12T16:30:00Z",
        "decision": "APPROVE",
        "rationale": "Income variance is due to seasonal overtime..."
    }
}
```

Valid `decision` values: `"APPROVE"`, `"DENY"`, `"REQUEST_MORE_DOCUMENTS"`.

For `REQUEST_MORE_DOCUMENTS`, an additional field `requestedDocuments` (string, min 10 chars) is required:

```json
{
    "decision": "REQUEST_MORE_DOCUMENTS",
    "rationale": "Need updated bank statement to verify income.",
    "requestedDocuments": "Most recent bank statement (January 2026) showing direct deposit history."
}
```

#### Review Queue

**Response (200 OK):**

```json
{
    "data": [
        {
            "applicationId": "a1b2c3d4-...",
            "borrowerName": "Jane Doe",
            "escalationReason": "Agent disagreement: credit vs. risk",
            "requiredReviewerRole": "loan_officer",
            "escalatedAt": "2026-02-12T15:02:00Z",
            "agentSummary": {
                "highestConfidence": 0.88,
                "lowestConfidence": 0.65,
                "hasFraudFlags": false,
                "hasDisagreements": true
            }
        }
    ],
    "pagination": {
        "nextCursor": "eyJpZCI6Ii4uLiJ9",
        "hasMore": true
    }
}
```

#### Mortgage Calculator

**Request:**

```http
POST /v1/public/calculator
Content-Type: application/json
```

```json
{
    "calculation": "monthly_payment",
    "inputs": {
        "homePriceCents": 40000000,
        "downPaymentCents": 8000000,
        "loanTermMonths": 360,
        "interestRateBps": 650,
        "annualPropertyTaxCents": 480000,
        "annualInsuranceCents": 120000
    }
}
```

**Response (200 OK):**

```json
{
    "data": {
        "calculation": "monthly_payment",
        "results": {
            "loanAmountCents": 32000000,
            "monthlyPrincipalInterestCents": 202264,
            "monthlyTaxCents": 40000,
            "monthlyInsuranceCents": 10000,
            "totalMonthlyPITICents": 252264,
            "totalInterestOverLifeCents": 40815040
        },
        "assumptions": {
            "interestRateSource": "FRED API (2026-02-12)",
            "taxEstimateSource": "User input",
            "insuranceEstimateSource": "User input"
        },
        "disclaimer": "These calculations are estimates for informational purposes only and do not constitute a loan offer or commitment. Actual rates, payments, and terms may vary."
    }
}
```

Supported `calculation` types: `"monthly_payment"`, `"total_interest"`, `"dti_preview"`, `"affordability"`, `"amortization"`, `"comparison"`.

#### Amortization Schedule Response

For `calculation: "amortization"`, the response is paginated (schedules can span 360+ months):

**Request:**

```http
POST /v1/public/calculator
Content-Type: application/json
```

```json
{
    "calculation": "amortization",
    "inputs": {
        "homePriceCents": 40000000,
        "downPaymentCents": 8000000,
        "loanTermMonths": 360,
        "interestRateBps": 650
    },
    "cursor": null,
    "limit": 12
}
```

**Response (200 OK):**

```json
{
    "data": {
        "calculation": "amortization",
        "loanAmountCents": 32000000,
        "schedule": [
            {
                "month": 1,
                "paymentCents": 202264,
                "principalCents": 35597,
                "interestCents": 166667,
                "balanceCents": 31964403
            },
            {
                "month": 2,
                "paymentCents": 202264,
                "principalCents": 35782,
                "interestCents": 166482,
                "balanceCents": 31928621
            }
        ]
    },
    "pagination": {
        "nextCursor": "eyJtb250aCI6MTN9",
        "hasMore": true
    }
}
```

Default `limit` is 12 (one year of payments). Maximum `limit` is 120 (10 years). Cursor-based pagination is consistent with the project's API conventions (Section 4.4).

#### Chat (Public Tier)

**Request:**

```http
POST /v1/public/chat
Content-Type: application/json
X-Session-ID: sess_abc123def456
```

```json
{
    "message": "What credit score do I need for a mortgage?"
}
```

**Response (200 OK):**

```json
{
    "data": {
        "response": "Most conventional mortgages require a minimum credit score of 620. However, FHA loans may accept scores as low as 580 with a 3.5% down payment. Higher credit scores typically qualify for better interest rates.",
        "citations": [
            {
                "source": "Fannie Mae Selling Guide",
                "section": "B3-5.1-01",
                "relevance": 0.92
            }
        ],
        "sentiment": "neutral",
        "sessionId": "sess_abc123def456",
        "disclaimer": "This information is for educational purposes only and does not constitute financial advice."
    }
}
```

#### Chat Streaming (SSE)

**Request:**

```http
POST /v1/public/chat/stream
Content-Type: application/json
Accept: text/event-stream
X-Session-ID: sess_abc123def456
```

```json
{
    "message": "How much can I afford if I make $75,000 a year?"
}
```

**Response (SSE stream):**

```
event: token
data: {"text": "Based"}

event: token
data: {"text": " on"}

event: token
data: {"text": " your"}

...

event: citations
data: {"citations": [{"source": "...", "section": "...", "relevance": 0.88}]}

event: metadata
data: {"sentiment": "neutral", "disclaimer": "..."}

event: done
data: {}
```

Note: The frontend consumes this endpoint via the Fetch API with a streaming body reader (`ReadableStream`), not the native `EventSource` API (which only supports GET requests). The POST method is required to send the message payload in the request body.

### 4.3 Error Response Format (RFC 7807)

All errors follow RFC 7807 Problem Details:

```json
{
    "type": "https://mortgage-quickstart.example.com/errors/validation-error",
    "title": "Validation Error",
    "status": 422,
    "detail": "Loan amount must be a positive integer.",
    "instance": "/v1/applications",
    "errors": [
        {
            "field": "loanAmountCents",
            "message": "Must be a positive integer",
            "value": -100
        }
    ]
}
```

**PII Redaction in Validation Errors:**

For fields containing PII (SSN, bank account numbers, date of birth), the `value` field in validation error details must be `[REDACTED]` or omitted entirely. Never echo PII back to the client in error responses.

```json
{
    "type": "https://mortgage-quickstart.example.com/errors/validation-error",
    "title": "Validation Error",
    "status": 422,
    "detail": "SSN must be in the format XXX-XX-XXXX.",
    "instance": "/v1/applications",
    "errors": [
        {
            "field": "ssn",
            "message": "Must be in the format XXX-XX-XXXX",
            "value": "[REDACTED]"
        }
    ]
}
```

Note: Logging middleware must also redact PII fields from validation error messages before writing to logs. This applies to any error path that might include user-submitted PII in the error detail.

Common error types:

| Type Path | Status | When |
|-----------|--------|------|
| `/errors/authentication-required` | 401 | Missing or invalid API key |
| `/errors/insufficient-permissions` | 403 | Role cannot access this endpoint |
| `/errors/not-found` | 404 | Resource does not exist |
| `/errors/validation-error` | 422 | Request body fails validation |
| `/errors/rate-limit-exceeded` | 429 | Session/IP rate limit hit |
| `/errors/conflict` | 409 | Application in wrong state for this action |
| `/errors/service-unavailable` | 503 | Critical dependency unavailable |

### 4.4 Pagination

All list endpoints use cursor-based pagination:

**Query parameters:**
- `cursor` -- Opaque cursor string (base64-encoded `{id, sortField}`)
- `limit` -- Items per page (default: 20, max: 100)

**Response:**

```json
{
    "data": [...],
    "pagination": {
        "nextCursor": "eyJpZCI6Ii4uLiIsInVwZGF0ZWRBdCI6Ii4uLiJ9",
        "hasMore": true
    }
}
```

When `hasMore` is `false`, `nextCursor` is `null`.

---

## 5. Agent Architecture

### 5.1 Loan Processing Graph

The Loan Processing Graph is a LangGraph StateGraph that implements the supervisor-worker pattern with persistent checkpointing.

#### Graph State Schema

```python
from typing import Any, TypedDict, Annotated
from langgraph.graph import add_messages

class DocumentResult(TypedDict):
    doc_id: str
    type: str  # W2, PAYSTUB, TAX_RETURN, BANK_STATEMENT, ID, OTHER
    confidence: float
    extracted_data: dict[str, Any]
    metadata: dict[str, Any]

class CreditAnalysisResult(TypedDict):
    confidence: float
    recommendation: str  # APPROVE, DENY, REVIEW
    credit_score: int
    debt_to_income: float
    findings: list[str]

class RiskAssessmentResult(TypedDict):
    confidence: float
    recommendation: str  # APPROVE, DENY, REVIEW
    risk_score: float
    risk_factors: list[str]
    ltv_ratio: float

class ComplianceCheckResult(TypedDict):
    confidence: float
    recommendation: str  # APPROVE, DENY, REVIEW
    violations: list[str]
    regulatory_references: list[str]

class FraudDetectionResult(TypedDict):
    confidence: float
    recommendation: str  # APPROVE, DENY, REVIEW
    flags: list[str]
    severity: str  # LOW, MEDIUM, HIGH

class AggregatedResults(TypedDict):
    final_recommendation: str  # APPROVE, DENY, REVIEW
    confidence: float
    agent_recommendations: dict[str, str]
    explanation: str

class CoachingOutput(TypedDict):
    suggestions: list[str]
    missing_documents: list[str]
    next_steps: list[str]

class LoanProcessingState(TypedDict):
    # Core identifiers
    application_id: str
    correlation_id: str
    workflow_status: str       # Current workflow state

    # Document processing results
    documents: list[DocumentResult]
    document_processing_complete: bool

    # Agent analysis results (populated by parallel fan-out)
    credit_analysis: CreditAnalysisResult | None
    risk_assessment: RiskAssessmentResult | None
    compliance_check: ComplianceCheckResult | None    # None until Phase 3a
    fraud_detection: FraudDetectionResult | None      # None until Phase 3a

    # Aggregation
    aggregated_results: AggregatedResults | None
    consolidated_narrative: str | None
    has_disagreements: bool
    has_fraud_flags: bool

    # Routing
    routing_decision: str | None     # AUTO_APPROVE, ESCALATE, DENY
    routing_rationale: str | None
    required_reviewer_role: str | None

    # Denial coaching (populated when denied/low confidence)
    coaching_output: CoachingOutput | None

    # Configuration snapshot (captured at routing time)
    thresholds: dict                 # {auto_approve, escalation, denial}

    # Resubmission tracking
    resubmission_count: int          # Number of document resubmission cycles
    previous_analyses: list[dict]    # Archived analyses from prior cycles

    # Messages for LLM context
    messages: Annotated[list, add_messages]
```

#### Graph Definition

```python
from langgraph.graph import StateGraph, END

graph = StateGraph(LoanProcessingState)

# Nodes
graph.add_node("supervisor_init", supervisor_init_node)
graph.add_node("document_processing", document_processing_node)
graph.add_node("credit_analysis", credit_analysis_node)
graph.add_node("risk_assessment", risk_assessment_node)
graph.add_node("compliance_check", compliance_check_node)
graph.add_node("fraud_detection", fraud_detection_node)
graph.add_node("aggregation", aggregation_node)
graph.add_node("routing_decision", routing_decision_node)
graph.add_node("denial_coaching", denial_coaching_node)
graph.add_node("human_review_wait", human_review_wait_node)

# Edges
graph.set_entry_point("supervisor_init")
graph.add_edge("supervisor_init", "document_processing")

# After document processing, fan out to parallel analysis
graph.add_conditional_edges(
    "document_processing",
    route_after_documents,  # Returns list of next nodes or escalates
    {
        "parallel_analysis": ["credit_analysis", "risk_assessment",
                              "compliance_check", "fraud_detection"],
        "escalate": "human_review_wait",
    }
)

# All parallel agents converge at aggregation
graph.add_edge("credit_analysis", "aggregation")
graph.add_edge("risk_assessment", "aggregation")
graph.add_edge("compliance_check", "aggregation")
graph.add_edge("fraud_detection", "aggregation")

# Aggregation -> routing decision
graph.add_edge("aggregation", "routing_decision")

# Routing branches
graph.add_conditional_edges(
    "routing_decision",
    route_after_decision,
    {
        "auto_approve": END,
        "escalate": "human_review_wait",
        "deny": "denial_coaching",
    }
)

# Denial coaching -> END
graph.add_edge("denial_coaching", END)

# Human review can cycle back to document processing (resubmission)
graph.add_conditional_edges(
    "human_review_wait",
    route_after_review,
    {
        "approved": END,
        "denied": "denial_coaching",
        "resubmit": "document_processing",
    }
)
```

**Phase 1 stubs:** In Phase 1, all agent nodes are stubs that return hardcoded results with synthetic confidence scores. The graph structure is complete (all nodes and edges defined) to ensure checkpoint schema compatibility. Stubs are replaced with real implementations in later phases.

```python
# Phase 1 stub example
async def credit_analysis_node(state: LoanProcessingState) -> dict:
    """Stub: returns synthetic credit analysis.
    Replaced with real LLM-based analysis in Phase 2.
    """
    return {
        "credit_analysis": {
            "confidence": 0.85,
            "recommendation": "APPROVE",
            "reasoning": "[STUB] Synthetic credit analysis for development.",
            "findings": {"creditScore": 720, "derogatoryMarks": 0},
        }
    }
```

#### Parallel Fan-Out Detail

LangGraph supports parallel execution via `Send` API or conditional edges that return multiple targets. The parallel fan-out in this graph dispatches to a variable number of agents depending on the phase:

- **Phase 2:** 2 agents -- `credit_analysis` + `risk_assessment`. The `compliance_check` and `fraud_detection` nodes exist but are stubs that return `None` results.
- **Phase 3a:** 4 agents -- `credit_analysis` + `risk_assessment` + `compliance_check` + `fraud_detection`. Stubs are replaced with real implementations.

The aggregation node uses a `join` strategy: it waits for all parallel branches to complete before executing. LangGraph handles this natively through the graph structure. The aggregation node must handle a variable number of non-None agent results -- it filters out `None` results from stub agents and aggregates only the agents that produced real output. This means Phase 2 aggregation considers 2 agent results while Phase 3a considers 4.

```python
def route_after_documents(state: LoanProcessingState) -> str:
    """Route after document processing completes."""
    if not state["document_processing_complete"]:
        return "escalate"  # Document processing failed
    return "parallel_analysis"
```

### 5.2 Intake Graph

The Intake Graph is a separate, simpler LangGraph graph for the public-facing conversational agent.

```python
class IntakeState(TypedDict):
    session_id: str
    messages: Annotated[list, add_messages]
    sentiment: str | None
    tool_results: list[dict]
    citations: list[dict]

intake_graph = StateGraph(IntakeState)

intake_graph.add_node("analyze_input", analyze_input_node)      # Sentiment + injection check
intake_graph.add_node("retrieve_knowledge", retrieve_knowledge_node)  # RAG lookup
intake_graph.add_node("invoke_tools", invoke_tools_node)         # Calculator, FRED, BatchData
intake_graph.add_node("generate_response", generate_response_node)  # LLM response generation

intake_graph.set_entry_point("analyze_input")
intake_graph.add_conditional_edges(
    "analyze_input",
    route_intake,
    {
        "knowledge": "retrieve_knowledge",
        "tool": "invoke_tools",
        "direct": "generate_response",
        "blocked": END,  # Prompt injection detected
    }
)
intake_graph.add_edge("retrieve_knowledge", "generate_response")
intake_graph.add_edge("invoke_tools", "generate_response")
intake_graph.add_edge("generate_response", END)
```

The Intake Graph does NOT use persistent checkpointing for public sessions (24-hour TTL sessions do not need workflow resume across restarts). For authenticated users with cross-session context (Phase 4, P2), conversation history is stored in a separate `chat_history` table (schema to be defined in Phase 4 technical design; this is a P2 feature) and loaded into the graph state on each invocation.

### 5.3 Agent-to-Agent Communication

Agents do not communicate directly. All communication flows through the graph state:

1. **Supervisor writes to state** -- dispatches context to worker nodes.
2. **Worker reads from state** -- receives application context and document results.
3. **Worker writes to state** -- deposits analysis results, confidence scores, findings.
4. **Aggregation reads from state** -- collects all worker outputs.
5. **Routing reads aggregated state** -- makes final decision.

This pattern ensures:
- All agent inputs/outputs are captured in checkpoint state.
- No hidden side channels between agents.
- State is inspectable at any point (debugging, audit).

### 5.4 Confidence-Based Routing Logic

```python
async def routing_decision_node(state: LoanProcessingState) -> dict:
    """Make final routing decision based on confidence scores and flags."""
    thresholds = state["thresholds"]  # Loaded from configuration table
    auto_approve = thresholds["auto_approve"]  # Default: 0.85
    escalation = thresholds["escalation"]       # Default: 0.60
    denial = thresholds["denial"]               # Default: 0.40

    # Collect all agent confidences
    agents = {
        "credit": state.get("credit_analysis"),
        "risk": state.get("risk_assessment"),
        "compliance": state.get("compliance_check"),
        "fraud": state.get("fraud_detection"),
    }
    active_agents = {k: v for k, v in agents.items() if v is not None}
    confidences = {k: v["confidence"] for k, v in active_agents.items()}
    recommendations = {k: v["recommendation"] for k, v in active_agents.items()}

    # Rule 1: Any fraud flag forces escalation
    if state.get("has_fraud_flags"):
        return {
            "routing_decision": "ESCALATE",
            "routing_rationale": "Fraud flag detected. Human review required.",
            "required_reviewer_role": "senior_underwriter",
        }

    # Rule 2: Agent disagreements force escalation
    if state.get("has_disagreements"):
        return {
            "routing_decision": "ESCALATE",
            "routing_rationale": f"Agent disagreement: {recommendations}. Human review required.",
            "required_reviewer_role": "loan_officer",
        }

    min_confidence = min(confidences.values())

    # Rule 3: All above auto-approve threshold
    if min_confidence >= auto_approve:
        return {
            "routing_decision": "AUTO_APPROVE",
            "routing_rationale": f"All agents above auto-approve threshold ({auto_approve}). Min confidence: {min_confidence}.",
        }

    # Rule 4: Any below denial threshold
    if min_confidence < denial:
        return {
            "routing_decision": "DENY",
            "routing_rationale": f"Agent confidence ({min_confidence}) below denial threshold ({denial}).",
        }

    # Rule 5: Medium confidence -> escalate
    reviewer_role = "loan_officer" if min_confidence >= escalation else "senior_underwriter"
    return {
        "routing_decision": "ESCALATE",
        "routing_rationale": f"Confidence ({min_confidence}) below auto-approve threshold ({auto_approve}). Human review required.",
        "required_reviewer_role": reviewer_role,
    }
```

### 5.5 Checkpoint Persistence Strategy

**Decision:** Use LangGraph PostgresSaver with the full graph structure defined from Phase 1.

**Rationale:** LangGraph serializes graph state at each checkpoint. The checkpoint schema is determined by the `State` TypedDict fields and the graph structure (node names, edges). If the graph structure changes between phases (adding nodes, changing edges), existing checkpoints may become incompatible. By defining the complete graph structure in Phase 1 (with stub implementations), checkpoint schema remains stable across all phases.

**Configuration:**

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# Separate connection pool for LangGraph checkpoints
checkpoint_pool = create_async_pool(
    dsn=settings.DATABASE_URL,
    min_size=2,
    max_size=5,  # Separate from application pool
)

checkpointer = AsyncPostgresSaver(checkpoint_pool)
await checkpointer.setup()  # Creates checkpoint tables if not exist

# Compile graph with checkpointer
loan_processing_app = loan_processing_graph.compile(
    checkpointer=checkpointer,
)
```

**Connection pool separation:** LangGraph's PostgresSaver uses its own connection pool, separate from the application's SQLAlchemy async pool. This prevents LangGraph checkpoint writes from contending with application queries. Pool sizes:

| Pool | Min | Max | Purpose |
|------|-----|-----|---------|
| Application (SQLAlchemy) | 5 | 20 | Application CRUD, audit writes |
| LangGraph checkpointer | 2 | 5 | Checkpoint reads/writes |

### 5.6 LLM Provider Strategy

| Agent | Model | Provider | Purpose |
|-------|-------|----------|---------|
| Supervisor | Claude (claude-3-5-sonnet or claude-3-opus) | Anthropic | Workflow orchestration, aggregation, routing decisions, narrative generation |
| Document Processing | GPT-4 Vision (gpt-4o) | OpenAI | Document classification and structured data extraction from images |
| Credit Analysis | Claude (claude-3-5-sonnet) | Anthropic | Credit report analysis, trend identification, plain-language summary |
| Risk Assessment | Claude (claude-3-5-sonnet) | Anthropic | DTI/LTV calculation context, employment stability analysis |
| Compliance Checking | Claude (claude-3-5-sonnet) | Anthropic | RAG-based regulatory compliance verification, adverse action notice generation |
| Fraud Detection | Claude (claude-3-5-sonnet) | Anthropic | Pattern detection across documents, anomaly identification |
| Denial Coaching | Claude (claude-3-5-sonnet) | Anthropic | Improvement recommendations, what-if calculations |
| Intake Agent | Claude (claude-3-5-sonnet) | Anthropic | Conversational responses, knowledge retrieval integration, tone adjustment |

All LLM calls are wrapped in a common `llm_call` utility that provides:
- Exponential backoff retry (max 3 retries; 1s, 2s, 4s)
- Retry on transient errors (429, 502, 503, 504); no retry on 400, 401, 403
- LangFuse tracing callback (silently skipped if LangFuse unavailable)
- Token usage tracking (prompt_tokens, completion_tokens)
- Latency measurement
- Correlation ID propagation

### 5.7 Tool Definitions

The mortgage calculator is exposed as a LangGraph tool callable by agents:

```python
from langchain_core.tools import tool

@tool
def mortgage_calculator(
    calculation: str,
    home_price_cents: int,
    down_payment_cents: int,
    loan_term_months: int,
    interest_rate_bps: int,
    annual_property_tax_cents: int | None = None,
    annual_insurance_cents: int | None = None,
    monthly_income_cents: int | None = None,
    monthly_debt_cents: int | None = None,
) -> dict:
    """Calculate mortgage metrics.

    Args:
        calculation: One of 'monthly_payment', 'total_interest', 'dti_preview',
            'affordability', 'amortization'.
        home_price_cents: Home price in cents.
        down_payment_cents: Down payment in cents.
        loan_term_months: Loan term in months (e.g., 360 for 30 years).
        interest_rate_bps: Annual interest rate in basis points (650 = 6.50%).
        annual_property_tax_cents: Annual property tax in cents (estimated).
        annual_insurance_cents: Annual homeowners insurance in cents (estimated).
        monthly_income_cents: Gross monthly income in cents (for DTI).
        monthly_debt_cents: Monthly debt payments in cents (for DTI).

    Returns:
        Dictionary with calculation results. All monetary values in cents.
    """
    # Pure computation -- no LLM calls, no side effects
    ...
```

The calculator tool is available to:
- **Intake Agent** -- invoked when users ask calculation questions in chat.
- **Denial Coaching Agent** -- invoked for what-if scenarios.

Additional tools available to the Intake Agent:

```python
@tool
async def get_current_rates() -> dict:
    """Get current mortgage rates from FRED API (cached)."""
    ...

@tool
async def lookup_property(address: str) -> dict:
    """Look up property data from BatchData API (or mock)."""
    ...

@tool
async def search_knowledge_base(query: str) -> list[dict]:
    """Search the mortgage knowledge base using RAG."""
    ...
```

---

## 6. Security Architecture

### 6.1 Authentication

**Mechanism:** API key authentication with server-side role mapping.

**Flow:**
1. Client sends `Authorization: Bearer <api_key>`.
2. Server computes `SHA-256(api_key)`.
3. Server looks up hash in `api_keys` table (with Redis cache).
4. Server resolves the associated user and role from the `users` table join.
5. Role is NEVER parsed from the token itself -- always resolved server-side.

**Key properties:**
- Keys are stored as SHA-256 hashes (one-way; original key cannot be recovered).
- Keys have an 8-character prefix stored in plaintext for log identification.
- Keys can be revoked (sets `revoked_at` timestamp; hash remains for audit).
- Keys can have optional expiration (`expires_at`).
- Default keys are flagged (`is_default = true`) for startup warning.

### 6.2 Role Hierarchy

```
reviewer
  |
  +-- senior_underwriter
        |
        +-- loan_officer
```

Permissions are hierarchical: a reviewer can do everything a senior_underwriter can do, which can do everything a loan_officer can do.

| Permission | loan_officer | senior_underwriter | reviewer |
|------------|:---:|:---:|:---:|
| Create/view applications | Y | Y | Y |
| Upload documents | Y | Y | Y |
| Submit for processing | Y | Y | Y |
| Review MEDIUM-confidence escalations | Y | Y | Y |
| Review LOW-confidence escalations | N | Y | Y |
| Export audit trails | N | N | Y |
| Configure thresholds | N | N | Y |
| Configure fraud sensitivity | N | N | Y |
| Manage knowledge base | N | N | Y |
| Manage API keys (P2) | N | N | Y |
| View portfolio analytics (P2) | N | N | Y |

#### Data Access Scoping (MVP)

MVP simplification: all authenticated users can view all applications. This is acceptable for a quickstart with a shared demo environment where all users are trusted internal participants.

Scoping rules that do apply in MVP:
- **Loan officers** can only submit reviews for applications in ESCALATED status that require their role level (or lower).
- **Reviewers** can export audit trails only for applications they have acted on (i.e., applications with `human_approved`, `human_denied`, or `documents_requested` audit events where their `actor_id` matches).

Note: Production systems would implement per-user application ownership scoping, where loan officers see only applications they created and underwriters see only applications assigned to their queue.

**Implementation:** A `require_role(minimum_role)` dependency that checks the authenticated user's role against the minimum required:

```python
from enum import IntEnum

class Role(IntEnum):
    LOAN_OFFICER = 1
    SENIOR_UNDERWRITER = 2
    REVIEWER = 3

def require_role(minimum: Role):
    async def dependency(current_user: User = Depends(get_current_user)):
        if Role[current_user.role.upper()] < minimum:
            raise AuthorizationError("Insufficient permissions")
        return current_user
    return Depends(dependency)
```

### 6.3 Public Tier Protections

#### Rate Limiting

Two layers, both tracked in Redis:

**Session-based limits:**

| Endpoint | Limit | Window | Key Pattern |
|----------|-------|--------|-------------|
| Chat | 20 messages | 1 hour | `ratelimit:session:chat:{session_id}` |
| Property lookup | 5 lookups | 24 hours (session lifetime) | `ratelimit:session:property:{session_id}` |
| Calculator | 100 calculations | 1 hour | `ratelimit:session:calc:{session_id}` |

**IP-based limits:**

| Endpoint | Limit | Window | Key Pattern |
|----------|-------|--------|-------------|
| Chat | 100 messages | 24 hours | `ratelimit:ip:chat:{ip}` |
| Property lookup | 20 lookups | 24 hours | `ratelimit:ip:property:{ip}` |
| Calculator | 500 calculations | 24 hours | `ratelimit:ip:calc:{ip}` |

**Concurrency limit:** Max 1 active inference per session. Tracked via Redis `SET NX` with 60-second TTL:

```
ratelimit:inference:{session_id} -> 1 (SET NX, EX 60)
```

If the key exists, the request is rejected with 429: "Please wait for the current response to complete."

**Per-session cumulative token budget (US-042):**

In addition to message-count rate limits, each public session has a cumulative token budget of 50,000 tokens (prompt + completion) per 24-hour session. This prevents cost abuse through long or complex prompts that consume disproportionate LLM resources.

- Redis key pattern: `ratelimit:tokens:session:{session_id}` with 24-hour TTL.
- The token budget is checked before invoking the LLM. If the budget is exhausted, the request is rejected with 429: "Session token budget exhausted. Please try again tomorrow."
- Token counts are updated after each LLM call (actual usage, not estimated).

**Rate limit isolation:** Public tier and protected tier use separate rate limit key namespaces. Authenticating does not bypass public tier limits -- an authenticated user accessing public endpoints is still subject to public rate limits via their session. Protected tier endpoints do not have rate limits in the MVP (low user count, trusted users).

#### Prompt Injection Defenses

Multi-layer defense implemented in the `analyze_input` node of the Intake Graph:

1. **Input sanitization** -- Remove/escape system-prompt-style markers (`###`, `[INST]`, `<|system|>`, `SYSTEM:`, etc.), instruction delimiters, and XML-like tags.
2. **Length validation** -- Chat messages limited to 2,000 characters. Reject longer input with 400.
3. **Semantic detection** -- Pattern matching for common injection patterns:
   - "ignore previous instructions"
   - "you are now"
   - "system:"
   - "reveal your prompt"
   - Role-playing instructions
   - Context escape attempts
4. **Output filtering** -- Post-process LLM responses to remove any reflected injection content.
5. **Structured prompting** -- Clear system/user message boundaries in all LLM calls. System prompt is never user-modifiable.

Flagged inputs are:
- Rejected with generic error: "I can only help with mortgage-related questions."
- Logged as security event: `{event: "prompt_injection_detected", session_id, input_hash, pattern_matched}` (input content is hashed, not logged verbatim, to avoid logging potentially malicious payloads).

#### Session Management

- Public sessions created on first request (UUID v4 session ID).
- Session ID stored in signed HTTP-only cookie and accepted via `X-Session-ID` header.
- Session state stored in Redis with 24-hour TTL (auto-evicted).
- Session contains: message count, property lookup count, last active timestamp.
- No PII stored in session.

### 6.4 PII Handling

**SSN storage:**
- Encrypted at rest using AES-256-GCM.
- Encryption key managed via environment variable (`SSN_ENCRYPTION_KEY`).
- A salted SHA-256 hash is stored separately for lookup operations.
- SSN is NEVER returned in API responses, logged, cached, or included in error messages.
- SSN is accepted only on application creation; subsequent reads never include it.

**Document PII redaction:**
- See Section 10.1 (Open Question OQ-9) for the architectural options under evaluation.
- Regardless of the chosen approach, the architecture requires:
  - Original documents stored in MinIO with restricted access.
  - Redacted versions stored separately in MinIO.
  - Only redacted versions sent to external LLM APIs.
  - Redaction events recorded in audit trail.
  - If redaction fails or confidence is low, processing fails safely (no unredacted data sent externally).

**SSN Encryption Key Management:**

- **Key generation:** `openssl rand -base64 32` produces a 256-bit random key.
- **Key format:** Base64-encoded 32-byte random value, stored in the `SSN_ENCRYPTION_KEY` environment variable.
- **Key rotation:** Out of scope for MVP. Production systems would use dual-key decryption (new key for encryption, both keys attempted for decryption) with a background re-encryption job to migrate all ciphertexts to the new key.
- **Operational security:**
  - The encryption key must never appear in logs, error messages, or process listings.
  - Production deployments must use a secret manager (e.g., Kubernetes Secrets, Vault). Environment variables are acceptable for local development only.
- **Startup validation:** On boot, the application verifies that `SSN_ENCRYPTION_KEY` is set and contains a valid base64-encoded value of at least 32 bytes. If the key is missing or insufficient length, the application refuses to start with a clear error message.

**PII in logs:**
- Structured logging middleware strips PII fields from log context.
- SSN, bank account numbers, date of birth, income figures are never logged.
- Application IDs (UUIDs) and correlation IDs are used for tracing instead.

### 6.5 Audit Trail Immutability

Enforced at three levels:

1. **Database level:** `REVOKE UPDATE, DELETE ON audit_events FROM app_role;`
2. **Application level:** The audit repository exposes only `create()` and `query()` methods. No `update()` or `delete()` methods exist.
3. **API level:** No API endpoint accepts PATCH or DELETE on audit events.

Verification: Integration test that attempts UPDATE and DELETE on audit_events and asserts permission error.

---

## 7. Infrastructure Architecture

### 7.1 Container Architecture

```
+-------------------+     +-------------------+     +-------------------+
| api               |     | ui                |     | worker            |
| (FastAPI + uvicorn|     | (nginx + React    |     | (FastAPI + agent  |
|  + agent graphs)  |     |  static build)    |     |  processing)      |
| Port: 8000        |     | Port: 3000        |     | No HTTP port      |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                          |
         +-------------------------+--------------------------+
                                   |
         +-------------------------+--------------------------+
         |                         |                          |
+--------v----------+     +--------v----------+     +--------v----------+
| postgresql        |     | redis             |     | minio             |
| Port: 5432        |     | Port: 6379        |     | Port: 9000 (API)  |
| + pgvector        |     |                   |     | Port: 9001 (UI)   |
+-------------------+     +-------------------+     +-------------------+
```

**Note on worker service:** The worker container shown in the diagram above is deferred -- it is NOT part of the MVP build. For MVP (Phases 1-3), all agent graph processing runs synchronously within the FastAPI request lifecycle (or within LangGraph graph execution triggered by a request handler). There are no background workers, task queues, or async job processors. A separate worker service is an optimization for Phase 4+ if long-running agent workflows need to be decoupled from request handling. The architecture supports this future separation because LangGraph's checkpoint persistence means a workflow started by the API can be resumed by a worker (or vice versa).

### 7.2 Docker Compose (Local Development)

```yaml
# compose.yml (simplified)
services:
  api:
    build:
      context: .
      dockerfile: packages/api/Containerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://app_user:password@postgres:5432/mortgage
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - FRED_API_KEY=${FRED_API_KEY}
      - SSN_ENCRYPTION_KEY=${SSN_ENCRYPTION_KEY}
      - LANGFUSE_PUBLIC_KEY=${LANGFUSE_PUBLIC_KEY:-}
      - LANGFUSE_SECRET_KEY=${LANGFUSE_SECRET_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy

  ui:
    build:
      context: .
      dockerfile: packages/ui/Containerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_BASE_URL=http://localhost:8000

  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=mortgage
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

  minio:
    image: minio/minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

### 7.3 Service Dependencies and Startup Order

```
PostgreSQL  ──┐
Redis       ──┼──> API Server ──> UI (dev proxy)
MinIO       ──┘
```

Startup sequence:
1. PostgreSQL starts, healthcheck passes (pg_isready).
2. Redis starts, healthcheck passes (redis-cli ping).
3. MinIO starts, healthcheck passes.
4. API server starts:
   a. Runs Alembic migrations (`alembic upgrade head`).
   b. Creates MinIO bucket if not exists.
   c. Loads seed data if database is empty.
   d. Initializes LangGraph checkpointer (`checkpointer.setup()`).
   e. Checks for default API keys (logs warning if found).
   f. Starts uvicorn.
5. UI starts (in development: Vite dev server with API proxy; in production: nginx serving static build).

### 7.4 Health Check Strategy

**Liveness (`GET /health`):**

```json
{
    "status": "ok",
    "timestamp": "2026-02-12T14:30:00Z"
}
```

Always returns 200 if the process is running. No dependency checks.

**Readiness (`GET /ready`):**

```json
{
    "status": "ready",
    "timestamp": "2026-02-12T14:30:00Z",
    "dependencies": {
        "database": {"status": "healthy", "latencyMs": 2},
        "redis": {"status": "healthy", "latencyMs": 1},
        "minio": {"status": "healthy", "latencyMs": 3},
        "llm_anthropic": {"status": "healthy"},
        "llm_openai": {"status": "healthy"}
    }
}
```

Returns 200 if all critical dependencies are reachable, 503 otherwise. LLM API checks are lightweight (model list / auth verification, not inference calls).

Both endpoints are unauthenticated and fast (no heavy computation).

### 7.5 Production Security Configuration

The following security hardening applies to production deployments. In local development, most of these are relaxed for convenience.

**HTTPS enforcement:**
- All HTTP traffic is redirected to HTTPS (301 redirect).
- TLS 1.2 minimum; TLS 1.3 preferred.
- HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.

**Security headers (set via FastAPI middleware):**

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' {API_URL}` | Prevent XSS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |

Note: In local development, CSP is relaxed to allow Vite HMR WebSocket connections. The security headers middleware reads a `PRODUCTION` environment variable to determine which policy set to apply.

---

## 8. Cross-Cutting Concerns

### 8.1 Structured Logging

All logs are JSON, written to stdout. Schema per `observability.md`:

```json
{
    "timestamp": "2026-02-12T14:30:00.123Z",
    "level": "INFO",
    "message": "Application processing completed",
    "correlationId": "a1b2c3d4-...",
    "service": "api",
    "applicationId": "e5f6g7h8-...",
    "agentName": "supervisor",
    "operation": "routing_decision",
    "durationMs": 12500,
    "extra": {
        "routingDecision": "ESCALATE",
        "minConfidence": 0.65
    }
}
```

**Security events** are logged at INFO or WARN level with `securityEvent: true`:

| Event | Level | Fields |
|-------|-------|--------|
| Auth success | INFO | `userId`, `keyPrefix`, `sourceIp` |
| Auth failure | WARN | `keyPrefix`, `sourceIp`, `reason` |
| Authorization failure | WARN | `userId`, `requiredRole`, `actualRole`, `endpoint` |
| Rate limit exceeded | WARN | `sessionId`, `sourceIp`, `limitType`, `endpoint` |
| Prompt injection detected | WARN | `sessionId`, `sourceIp`, `patternMatched` |
| Threshold changed | INFO | `userId`, `field`, `oldValue`, `newValue` |
| Audit export requested | INFO | `userId`, `applicationId` |
| Default keys detected | ERROR | (no PII fields) |

**Never logged:** SSN, bank account numbers, date of birth, income figures, API key values, full request/response bodies.

### 8.2 Correlation ID Propagation

```
Browser -> API Gateway -> FastAPI -> Agent Graph -> LLM API
  |            |             |           |            |
  +-- X-Request-ID header    |           |            |
  |            +-- middleware generates UUID if missing |
  |            |             +-- context var propagation |
  |            |             |           +-- LangFuse trace_id
  |            |             |           |            |
  [same correlation ID in all log entries and audit events]
```

Implementation uses Python `contextvars`:

```python
import contextvars

correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default=""
)
```

The correlation ID middleware sets this context var on each request. All log entries, audit events, agent decisions, and response headers include it.

**Correlation IDs vs Session IDs:** These are distinct concepts and must not be conflated:

- **Correlation IDs** are request-scoped (generated per request as UUID v4) and used exclusively for tracing and logging. They tie together all log entries, audit events, and downstream calls within a single request. They are ephemeral and not stored in Redis.
- **Session IDs** are stored in Redis (`session:{session_id}`) and persist across multiple requests. They are used for rate limiting, token budget tracking, and chat history continuity.

Session state is keyed by session ID, not correlation ID. A single session will generate many correlation IDs over its lifetime (one per request).

### 8.3 LLM Retry Strategy

```python
import asyncio
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

TRANSIENT_STATUS_CODES = {429, 502, 503, 504}

class TransientLLMError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        super().__init__(message)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception_type(TransientLLMError),
    before_sleep=log_retry_attempt,
)
async def call_llm(model, messages, **kwargs):
    """Call LLM with retry on transient errors."""
    try:
        return await model.ainvoke(messages, **kwargs)
    except Exception as e:
        status_code = getattr(e, "status_code", 500)
        if status_code in TRANSIENT_STATUS_CODES:
            raise TransientLLMError(status_code, str(e))
        raise  # Permanent error -- do not retry
```

Retry events are logged:

```json
{
    "level": "WARN",
    "message": "LLM API call retry",
    "attemptNumber": 2,
    "errorCode": 503,
    "agentName": "credit_analysis",
    "correlationId": "...",
    "waitSeconds": 2
}
```

### 8.4 Graceful Degradation

| Service | Degraded Behavior | Detection |
|---------|------------------|-----------|
| Redis unavailable | RAG runs without cache; rate limits use in-memory counters; auth goes direct to DB; sessions use signed cookies | Redis ping fails in readiness check |
| LangFuse unavailable | LLM calls continue; tracing silently skipped; warning logged once | SDK connection timeout |
| FRED API unavailable | Last cached rate used; if never cached, hardcoded 6.5% with notice | HTTP timeout or 5xx response |
| BatchData unavailable | Mock service used as fallback | HTTP timeout or 5xx response |
| LLM API (transient) | Retry 3x with exponential backoff | 429, 502, 503, 504 responses |
| LLM API (permanent) | Agent step fails; application escalated to human review | 400, 401, 403 responses after retry exhaustion |

### 8.5 LangFuse Integration

All LLM calls are instrumented via LangFuse callbacks:

```python
from langfuse.callback import CallbackHandler

def get_langfuse_handler(correlation_id: str, agent_name: str) -> CallbackHandler | None:
    """Create LangFuse callback handler if configured."""
    if not settings.LANGFUSE_PUBLIC_KEY:
        return None
    return CallbackHandler(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        trace_name=f"{agent_name}",
        session_id=correlation_id,
        metadata={"agent": agent_name},
    )
```

LangFuse provides:
- Per-agent cost tracking (tokens x model pricing).
- Latency distributions by model and agent.
- Full prompt/completion traces for debugging.
- Dashboard accessible at configured LangFuse URL.

**PII warning:** LangFuse traces include full prompt and completion content. This means any PII present in LLM prompts (borrower names, addresses, financial data) will be visible in LangFuse traces. For the MVP quickstart with synthetic data, this is acceptable. However, LangFuse must NOT be enabled in environments processing real PII unless the LangFuse instance is self-hosted within the organization's security boundary. The `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` environment variables should include a comment in `.env.example`: `# WARNING: LangFuse captures full prompt/completion content. Do not enable with real PII unless self-hosted.`

---

## 9. File Structure

This maps the architecture to the actual monorepo layout. The `packages/` directory does not yet exist and must be created as part of Phase 1 scaffolding.

```
project/
+-- packages/
|   +-- api/                           # FastAPI backend (Python, uv)
|   |   +-- pyproject.toml
|   |   +-- Containerfile
|   |   +-- src/
|   |   |   +-- __init__.py
|   |   |   +-- main.py               # FastAPI app factory, startup/shutdown
|   |   |   +-- settings.py           # Pydantic Settings (env-based config)
|   |   |   +-- dependencies.py       # FastAPI dependency injection
|   |   |   +-- middleware/
|   |   |   |   +-- correlation_id.py  # Correlation ID generation/propagation
|   |   |   |   +-- logging.py         # Structured request/response logging
|   |   |   |   +-- auth.py            # API key authentication
|   |   |   |   +-- rate_limit.py      # Session/IP rate limiting (public tier)
|   |   |   |
|   |   |   +-- routes/
|   |   |   |   +-- applications.py    # /v1/applications CRUD
|   |   |   |   +-- documents.py       # /v1/applications/{id}/documents
|   |   |   |   +-- review.py          # /v1/applications/{id}/review, /v1/review-queue
|   |   |   |   +-- audit.py           # /v1/applications/{id}/audit
|   |   |   |   +-- config.py          # /v1/config/thresholds, fraud-sensitivity
|   |   |   |   +-- public.py          # /v1/public/chat, calculator, rates, property
|   |   |   |   +-- health.py          # /health, /ready
|   |   |   |
|   |   |   +-- agents/
|   |   |   |   +-- graphs/
|   |   |   |   |   +-- loan_processing.py   # Loan Processing Graph definition
|   |   |   |   |   +-- intake.py            # Intake Graph definition
|   |   |   |   +-- nodes/
|   |   |   |   |   +-- supervisor.py        # Supervisor init, aggregation, routing
|   |   |   |   |   +-- document_processing.py
|   |   |   |   |   +-- credit_analysis.py
|   |   |   |   |   +-- risk_assessment.py
|   |   |   |   |   +-- compliance.py
|   |   |   |   |   +-- fraud_detection.py
|   |   |   |   |   +-- denial_coaching.py
|   |   |   |   |   +-- intake_nodes.py      # analyze_input, retrieve_knowledge, etc.
|   |   |   |   +-- tools/
|   |   |   |   |   +-- mortgage_calculator.py  # Calculator as LangGraph tool
|   |   |   |   |   +-- fred_api.py             # FRED rate/indicator tool
|   |   |   |   |   +-- property_lookup.py       # BatchData property tool
|   |   |   |   |   +-- knowledge_search.py      # RAG search tool
|   |   |   |   +-- state.py             # LoanProcessingState, IntakeState TypedDicts
|   |   |   |   +-- checkpointer.py      # PostgresSaver setup and configuration
|   |   |   |   +-- llm.py               # LLM client factory with retry and tracing
|   |   |   |
|   |   |   +-- services/
|   |   |   |   +-- protocols.py         # Protocol classes for mocked services
|   |   |   |   +-- credit_bureau_mock.py
|   |   |   |   +-- employment_verification_mock.py
|   |   |   |   +-- property_data_mock.py
|   |   |   |   +-- property_data_real.py   # BatchData API client
|   |   |   |   +-- fred_client.py          # FRED API client with caching
|   |   |   |   +-- minio_client.py         # MinIO upload/download/presign
|   |   |   |   +-- redis_client.py         # Redis connection and utilities
|   |   |   |   +-- encryption.py           # SSN encryption/decryption (AES-256-GCM)
|   |   |   |   +-- audit.py               # Audit event creation (append-only)
|   |   |   |   +-- pii_redaction.py        # PII redaction service (approach TBD per OQ-9)
|   |   |   |
|   |   |   +-- models/
|   |   |   |   +-- schemas.py             # Pydantic models for request/response
|   |   |   |   +-- enums.py               # ApplicationStatus, Role, AgentName, etc.
|   |   |   |
|   |   |   +-- security/
|   |   |   |   +-- prompt_injection.py     # Input sanitization and detection
|   |   |   |   +-- output_filter.py        # Output filtering for reflected injections
|   |   |   |
|   |   +-- tests/
|   |   |   +-- conftest.py              # Test fixtures, DB setup, mock services
|   |   |   +-- unit/
|   |   |   |   +-- test_mortgage_calculator.py
|   |   |   |   +-- test_routing_decision.py
|   |   |   |   +-- test_prompt_injection.py
|   |   |   |   +-- test_pii_redaction.py
|   |   |   |   +-- test_encryption.py
|   |   |   +-- integration/
|   |   |       +-- test_application_lifecycle.py
|   |   |       +-- test_agent_workflow.py
|   |   |       +-- test_audit_immutability.py
|   |   |       +-- test_auth.py
|   |   |       +-- test_rate_limiting.py
|   |
|   +-- ui/                            # React 19 frontend (pnpm)
|   |   +-- package.json
|   |   +-- Containerfile
|   |   +-- vite.config.ts
|   |   +-- src/
|   |   |   +-- main.tsx
|   |   |   +-- routes/                # TanStack Router file-based routes
|   |   |   |   +-- __root.tsx
|   |   |   |   +-- index.tsx          # Public landing page (calculator + chat)
|   |   |   |   +-- dashboard.tsx      # Loan officer dashboard
|   |   |   |   +-- applications/
|   |   |   |   |   +-- $id.tsx        # Application detail
|   |   |   |   |   +-- new.tsx        # Create application form
|   |   |   |   +-- review-queue.tsx   # Review queue
|   |   |   |   +-- admin/
|   |   |   |       +-- config.tsx     # Threshold/sensitivity config (P2)
|   |   |   |       +-- analytics.tsx  # Portfolio analytics (P2)
|   |   |   +-- components/
|   |   |   |   +-- mortgage-calculator.tsx  # Calculator widget
|   |   |   |   +-- chat-interface.tsx       # Public chat UI
|   |   |   |   +-- agent-analysis.tsx       # Agent results display
|   |   |   |   +-- review-panel.tsx         # Review action panel
|   |   |   |   +-- audit-timeline.tsx       # Audit trail timeline view
|   |   |   +-- hooks/
|   |   |   |   +-- use-auth.ts        # Auth context and API key management
|   |   |   |   +-- use-applications.ts # TanStack Query hooks for applications
|   |   |   |   +-- use-chat.ts         # Chat state and SSE connection
|   |   |   +-- lib/
|   |   |       +-- api-client.ts       # Typed API client
|   |   +-- tests/
|   |       +-- components/             # Vitest component tests
|   |       +-- e2e/                    # Playwright E2E tests
|   |
|   +-- db/                            # Database models and migrations (Python, uv)
|   |   +-- pyproject.toml
|   |   +-- src/
|   |   |   +-- __init__.py
|   |   |   +-- models.py             # SQLAlchemy ORM models
|   |   |   +-- engine.py             # Async engine and session factory
|   |   |   +-- repositories/
|   |   |       +-- application.py     # Application CRUD
|   |   |       +-- document.py        # Document CRUD
|   |   |       +-- audit.py           # Audit event (create + query only)
|   |   |       +-- agent_decision.py  # Agent decision storage
|   |   |       +-- user.py            # User/API key management
|   |   |       +-- configuration.py   # Configuration CRUD
|   |   |       +-- embedding.py       # Vector embedding operations
|   |   +-- alembic/
|   |   |   +-- env.py
|   |   |   +-- versions/
|   |   |       +-- 001_initial_schema.py   # All tables, indexes, grants
|   |   |       +-- 002_seed_data.py        # Default users, API keys, config
|   |   +-- tests/
|   |       +-- test_models.py
|   |       +-- test_migrations.py
|   |
|   +-- configs/                       # Shared configuration
|       +-- ruff.toml                  # Python linting (shared)
|       +-- .eslintrc.js               # TypeScript linting (shared)
|       +-- .prettierrc                # Formatting (shared)
|
+-- deploy/
|   +-- helm/                          # Helm charts for OpenShift/K8s
|       +-- Chart.yaml
|       +-- values.yaml
|       +-- templates/
|
+-- compose.yml                        # Local development
+-- turbo.json                         # Turborepo pipeline configuration
+-- Makefile                           # Common development commands
+-- .env.example                       # Template for environment variables
+-- README.md
```

---

## 10. Open Architectural Questions

### 10.1 OQ-9: PII Redaction Approach

**Context:** Document images (W-2, pay stubs, tax returns) contain PII (SSN, bank account numbers, dates of birth) that must not be sent to external LLM APIs. The redaction approach must reliably detect and remove PII while preserving the document's utility for data extraction.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A. Local OCR + NER | Run Tesseract OCR locally to extract text, apply NER (spaCy/Presidio) to detect PII, replace PII in text, send cleaned text to LLM (not image) | No PII leaves system boundary; no additional LLM cost; well-tested NER libraries exist | Loses document layout/visual context; OCR errors reduce extraction accuracy; requires local model dependencies |
| B. Multi-pass LLM | First pass: send to local/cheap model for PII detection; second pass: send redacted image to vision model for extraction | Preserves visual context; potentially more accurate PII detection | First model still sees PII (defeats purpose if external); doubles LLM cost; more complex pipeline |
| C. Local vision + masking | Use local vision model (e.g., PaddleOCR + layout detection) to identify PII regions in the image, black-box those regions, send masked image to external LLM | Preserves most visual context; PII never leaves boundary; image-level redaction is verifiable | Requires local GPU/compute for layout detection; adds significant dependency; masking may obscure nearby text |

**Recommendation:** Option A (Local OCR + NER) for MVP. The key insight is that for mortgage documents (W-2, pay stubs, tax returns), the document types are highly structured and standardized. A local OCR + NER pipeline using Tesseract and Presidio can reliably detect SSNs, account numbers, and other PII patterns in these specific document types. The loss of visual context is acceptable because:

1. The extracted text plus document type label provides sufficient context for the LLM to produce structured data.
2. The document classification step (which determines document type) can use a vision model on the redacted version where only PII regions are masked (a simpler version of Option C using regex-identified regions).
3. This approach has the strongest security guarantee: PII text is never transmitted externally.

**Fallback behavior:** If OCR fails (confidence below threshold), processing fails safely and the application is escalated to human review. No unredacted data is sent externally.

**Status:** Pending stakeholder confirmation. This is a strong recommendation but the decision affects implementation complexity in Phase 2.

### 10.2 OQ-7: LangGraph Async + Connection Pool Interaction

**Context:** FastAPI runs an async event loop. LangGraph with PostgresSaver needs database connections for checkpoint persistence. The application also needs connections for its own queries (SQLAlchemy async). If both share a connection pool, LangGraph checkpoint writes could starve application queries (or vice versa) under load.

**Resolution:** Use separate connection pools.

- **Application pool:** `asyncpg` via SQLAlchemy 2.0 async. Pool size: min 5, max 20. Used for all application CRUD, audit writes, and queries.
- **LangGraph checkpoint pool:** `asyncpg` connection pool created directly (not via SQLAlchemy). Pool size: min 2, max 5. Used exclusively by LangGraph PostgresSaver.

Both pools connect to the same PostgreSQL instance but use separate connections. The total max connections (25) is well within PostgreSQL's default `max_connections` (100).

LangGraph's `AsyncPostgresSaver` accepts an `asyncpg` connection pool directly, so this separation is straightforward:

```python
# Application pool (SQLAlchemy)
app_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=15,
)

# LangGraph checkpoint pool (asyncpg directly)
import asyncpg
checkpoint_pool = await asyncpg.create_pool(
    dsn=settings.DATABASE_URL.replace("+asyncpg", ""),
    min_size=2,
    max_size=5,
)
checkpointer = AsyncPostgresSaver(checkpoint_pool)
```

This ensures:
- Agent workflows running concurrently (up to 10 simultaneous) do not exhaust the application connection pool.
- Application queries (list applications, view details) are not blocked by checkpoint writes.
- Connection pool exhaustion in one domain does not cascade to the other.

### 10.3 OQ-10: Checkpoint Schema Forward-Compatibility

**Context:** If the LangGraph graph structure changes between phases (adding nodes, changing edges), existing checkpoints may become incompatible, requiring either migration or data loss.

**Resolution:** Define the complete graph structure in Phase 1, including all nodes and edges for the final system. Nodes that are not yet implemented use stub functions that return synthetic results.

**Design:**

```python
# Phase 1: All nodes defined, most are stubs
graph.add_node("supervisor_init", supervisor_init_node)          # Real in Phase 1
graph.add_node("document_processing", stub_document_processing)   # Stub -> Real in Phase 2
graph.add_node("credit_analysis", stub_credit_analysis)           # Stub -> Real in Phase 2
graph.add_node("risk_assessment", stub_risk_assessment)           # Stub -> Real in Phase 2
graph.add_node("compliance_check", stub_compliance_check)         # Stub -> Real in Phase 3a
graph.add_node("fraud_detection", stub_fraud_detection)           # Stub -> Real in Phase 3a
graph.add_node("aggregation", aggregation_node)                   # Real in Phase 1
graph.add_node("routing_decision", routing_decision_node)         # Real in Phase 2
graph.add_node("denial_coaching", stub_denial_coaching)           # Stub -> Real in Phase 3a
graph.add_node("human_review_wait", human_review_wait_node)       # Real in Phase 2

# All edges defined in Phase 1
# (same as Section 5.1 graph definition)
```

**Consequences:**
- **Positive:** Checkpoint schema is stable across all phases. No checkpoint migration needed. Workflows in progress during a deployment that swaps a stub for a real implementation will resume correctly (the checkpoint records state, not the function that produced it).
- **Negative:** Phase 1 code includes stub nodes that are not yet useful. The graph definition is larger than needed in Phase 1. This is acceptable overhead for a quickstart that prioritizes forward compatibility.
- **Neutral:** The `LoanProcessingState` TypedDict must include all fields from day one (including fields like `compliance_check` and `fraud_detection` that will be `None` until Phase 3a). This is acceptable because TypedDict fields can be `None`.

### 10.4 API Key Lifecycle

**MVP (Phase 1-3):** Static keys seeded during `make setup`. Keys are pre-generated, hashed, and stored in migration. The default keys are flagged with `is_default = true` for the startup warning.

Key generation process:
1. Generate 32-byte random key: `secrets.token_urlsafe(32)`.
2. Prefix with `mq_{role_abbreviation}_` for human readability.
3. Compute SHA-256 hash for storage.
4. Store hash and 8-character prefix in `api_keys` table.
5. Print the full key to console ONCE during seed (never stored in plaintext).

**Phase 4 (P2):** API key lifecycle management feature:
- Generate new keys via `POST /v1/admin/keys`.
- Revoke keys via `DELETE /v1/admin/keys/{id}`.
- Set expiration via `PATCH /v1/admin/keys/{id}`.
- All key lifecycle events recorded in audit trail.

### 10.5 Confidence-to-Role Mapping

**Decision:** Fixed mapping for MVP.

| Confidence Range | Required Reviewer Role |
|-----------------|----------------------|
| Below `escalation` threshold (< 0.60) | `senior_underwriter` |
| Between `escalation` and `auto_approve` (0.60 - 0.85) | `loan_officer` |
| Fraud flag (any confidence) | `senior_underwriter` |

This mapping is hardcoded in the routing decision node. Making it configurable adds UI complexity (mapping editor) without clear MVP benefit. The three-role hierarchy is a stakeholder mandate and unlikely to change. If needed in the future, the mapping can be moved to the `configuration` table with minimal code change.

---

## 11. Phase-by-Phase Build Order

### Phase 1: Foundation

**Goal:** Working application lifecycle with stub agents, real auth, real audit trail, complete graph structure.

**Build order:**

1. **Project scaffolding** (prerequisite for everything)
   - Create `packages/api/`, `packages/ui/`, `packages/db/` with build configuration
   - Create `compose.yml`, `Makefile`, `turbo.json`
   - Create `.env.example`
   - **Interface:** `make setup` installs dependencies, `make dev` starts services
   - **Exit criterion:** `make setup && make dev` runs without errors

2. **Database schema and migrations**
   - All tables from Section 3.1 (applications, documents, agent_decisions, audit_events, users, api_keys, configuration, embeddings)
   - Database role grants (app_role, migration_role)
   - Seed data (default users, API keys, configuration)
   - **Interface:** Alembic migrations in `packages/db/alembic/versions/`
   - **Exit criterion:** `make db-upgrade && make db-rollback && make db-upgrade` succeeds; all tables verified

3. **API infrastructure**
   - FastAPI app factory with middleware stack (correlation ID, logging, auth, authorization)
   - Health check endpoints (`/health`, `/ready`)
   - Error handling (RFC 7807)
   - Pydantic schemas for request/response
   - **Interface:** Routes in `packages/api/src/routes/`
   - **Exit criterion:** `curl localhost:8000/health` returns 200; `curl localhost:8000/ready` returns 200 with dependency status

4. **Authentication and RBAC**
   - API key middleware (hash lookup, role resolution)
   - Authorization middleware (role hierarchy check)
   - Startup warning for default keys
   - **Interface:** `Authorization: Bearer <key>` on all protected endpoints
   - **Exit criterion:** Protected endpoint returns 401 without key, 403 with wrong role, 200 with correct role

5. **Application CRUD and document upload**
   - Create application, view detail, list applications
   - Upload documents to MinIO
   - SSN encryption (AES-256-GCM)
   - **Interface:** `/v1/applications` endpoints
   - **Exit criterion:** Create application, upload document, retrieve detail -- all via API

6. **Audit trail**
   - Append-only audit event creation
   - Immutability enforcement (database grants)
   - Audit trail query endpoint
   - **Interface:** `/v1/applications/{id}/audit`
   - **Exit criterion:** Audit events created on app creation/document upload; UPDATE/DELETE on audit_events fails with permission error

7. **LangGraph graph definition with stubs**
   - Complete Loan Processing Graph (all nodes as stubs)
   - PostgresSaver checkpoint configuration (separate pool)
   - Submit application -> workflow runs through stubs -> reaches final state
   - **Interface:** `POST /v1/applications/{id}/submit`
   - **Exit criterion:** Submit application; workflow runs through all stub nodes; checkpoints written; audit events for each step

8. **Structured logging**
   - JSON logging with correlation ID
   - PII scrubbing
   - **Exit criterion:** All log entries are valid JSON with required fields; no PII in logs

**Phase 1 exit criteria (all must pass):**
- `make setup && make dev` completes in under 30 minutes
- All API endpoints return expected responses
- Workflow runs from DRAFT to AUTO_APPROVED via stubs with audit trail
- Database grants prevent audit modification
- Checkpoint survives service restart (stop API, start API, resume workflow)

### Phase 2: Core AI Agents

**Goal:** Real document processing, credit analysis, risk assessment, confidence-based routing, human review.

**Build order:**

1. **PII redaction service** (blocks document processing)
   - Implement chosen approach from OQ-9 (recommended: local OCR + NER)
   - **Exit criterion:** Given a W-2 with SSN, redacted output does not contain the SSN

2. **Document processing agent** (replace stub)
   - Document classification via GPT-4 Vision (on redacted image)
   - Structured data extraction
   - PDF metadata extraction (local, no LLM)
   - **Exit criterion:** Upload W-2 PDF; agent classifies it as "W2" with confidence > 0.6; extracts employer name, wages, tax withheld

3. **Credit analysis agent** (replace stub)
   - Mock credit bureau service implementation
   - LLM-based credit analysis
   - **Exit criterion:** Submit application; credit agent produces analysis with confidence score, reasoning, and findings

4. **Risk assessment agent** (replace stub)
   - DTI calculation, LTV calculation, employment stability scoring
   - Cross-source income validation
   - **Exit criterion:** Submit application with documents; risk agent calculates DTI and LTV correctly

5. **Confidence-based routing** (replace stub routing logic)
   - Threshold-based decision logic
   - Configuration endpoint for threshold management
   - **Exit criterion:** High confidence -> AUTO_APPROVED; medium -> ESCALATED; fraud flag -> ESCALATED

6. **Human review workflow**
   - Review queue endpoint (role-filtered)
   - Approve/Deny/Request-more-docs actions
   - Dashboard API endpoints
   - **Exit criterion:** Escalated application appears in review queue; reviewer can approve with rationale; audit trail records review

7. **Loan officer dashboard (UI)**
   - Application list, review queue, application detail with agent analysis
   - **Exit criterion:** UI displays applications, agent analysis with confidence scores, review actions work

**Phase 2 exit criteria:**
- Upload document -> agent extracts data with confidence scores
- Full workflow: create -> upload -> submit -> process -> auto-approve (high confidence) with audit trail
- Full workflow: create -> upload -> submit -> process -> escalate (medium confidence) -> human approve
- Review queue shows correct items for each role

### Phase 3a: Full Agent Suite

**Goal:** Compliance checking with RAG, fraud detection, denial coaching, cyclic resubmission.

**Build order:**

1. **Knowledge base and RAG infrastructure**
   - Compliance document ingestion (ECOA, Fair Housing Act excerpts)
   - Embedding generation and storage (pgvector)
   - RAG query service with Redis caching
   - **Exit criterion:** Query "What is ECOA?" returns relevant knowledge base content with citation

2. **Compliance checking agent** (replace stub)
   - Fair lending verification
   - Adverse action notice generation
   - Audit trail completeness check
   - **Exit criterion:** Denied application generates adverse action notice with regulatory citations

3. **Fraud detection agent** (replace stub)
   - Income discrepancy detection (15% threshold)
   - Property flip pattern detection
   - Identity consistency verification
   - PDF metadata anomaly detection
   - Configurable sensitivity
   - **Exit criterion:** Application with income discrepancy -> fraud flag -> forced escalation

4. **Denial coaching agent** (replace stub)
   - DTI improvement recommendations
   - Down payment scenarios
   - Credit score guidance
   - What-if calculations using mortgage calculator tool
   - **Exit criterion:** Denied application generates coaching output with specific improvement recommendations

5. **Cyclic document resubmission**
   - Request-more-documents workflow restart
   - Previous analysis archiving
   - **Exit criterion:** Request docs -> upload new docs -> workflow restarts from document processing

**Phase 3a exit criteria:**
- Full 4-agent parallel fan-out (credit + risk + compliance + fraud)
- Fraud flag forces human review regardless of other confidence scores
- Denied applications receive coaching with what-if calculations
- Document resubmission cycles workflow back to processing

### Phase 3b: Public Access and External Data

**Goal:** Public-facing intake agent, mortgage calculator, external data integration, rate limiting.

**Build order:**

1. **External data clients**
   - FRED API client with Redis caching
   - BatchData API client (real + mock) with Redis caching
   - **Exit criterion:** `GET /v1/public/rates` returns current mortgage rate from FRED

2. **Mortgage calculator**
   - All calculation types (monthly payment, total interest, DTI, affordability, amortization)
   - Calculator as LangGraph tool
   - Calculator UI component
   - **Exit criterion:** Calculator API returns correct PITI for known inputs; UI component renders

3. **Intake Graph implementation**
   - Sentiment analysis node
   - Knowledge retrieval node (RAG)
   - Tool invocation node (calculator, FRED, property)
   - Response generation node
   - **Exit criterion:** Chat query about credit scores returns knowledge-based answer with citation

4. **Rate limiting and session management**
   - Session creation and Redis storage
   - Session/IP rate limit middleware
   - Per-session concurrency limit
   - **Exit criterion:** 21st chat message in an hour returns 429

5. **Prompt injection defenses**
   - Input sanitization
   - Semantic detection
   - Output filtering
   - **Exit criterion:** "Ignore previous instructions" input is rejected; attempt is logged

6. **Streaming chat (SSE)**
   - SSE endpoint for chat streaming
   - UI integration for progressive rendering
   - **Exit criterion:** Chat response streams token-by-token in the UI

7. **Public landing page (UI)**
   - Calculator widget, chat interface, current rates display
   - **Exit criterion:** Unauthenticated user can use calculator and chat on landing page

**Phase 3b exit criteria:**
- Public chat works without authentication
- Calculator auto-populates with current FRED rate
- Rate limiting enforced per session and IP
- Prompt injection detected and blocked
- Streaming chat renders progressively

### Phase 4: Polish and Operability

**Goal:** Observability dashboard, audit export, admin interfaces, deployment manifests, CI pipeline.

**Build order:**

1. **LangFuse integration** -- Full tracing across all agents
2. **Audit trail export** -- PDF/JSON export endpoint (reviewer only)
3. **Admin configuration UI** -- Threshold and fraud sensitivity management (P2)
4. **Portfolio analytics dashboard** -- Aggregate metrics (P2)
5. **Cross-session chat context** -- Authenticated user conversation persistence (P2)
6. **Seed data expansion** -- 10+ diverse applications in various states
7. **Container deployment manifests** -- Containerfiles, Helm charts
8. **CI pipeline** -- Lint, type check, test, vulnerability scan
9. **API key lifecycle management** -- Generate, revoke, expire (P2)
10. **Documentation** -- README, code walkthrough, architecture overview

**Phase 4 exit criteria:**
- LangFuse dashboard shows traces for all LLM calls with cost data
- Audit trail exportable as document
- CI pipeline passes on clean branch
- Helm chart deploys to container platform
- README enables developer onboarding in under 2 hours

---

## Appendix A: Environment Variables

```bash
# Required
DATABASE_URL=postgresql+asyncpg://app_user:password@localhost:5432/mortgage
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
SSN_ENCRYPTION_KEY=base64-encoded-32-byte-key

# Optional
FRED_API_KEY=your-fred-api-key            # Optional for Phase 1-2; required for Phase 3b+ (live rate data). Free tier, 120 req/min
BATCHDATA_API_KEY=                          # Empty = use mock
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_HOST=http://localhost:3001

# Defaults (override in production)
LOG_LEVEL=INFO
API_HOST=0.0.0.0
API_PORT=8000
CREDIT_BUREAU_PROVIDER=mock                 # 'mock' or 'real'
EMPLOYMENT_VERIFICATION_PROVIDER=mock       # 'mock' or 'real'
```

## Appendix B: Key Design Constraints from Upstream

These constraints come from the product plan and stakeholder mandates. They are not architectural choices -- they are inputs.

| Constraint | Source | Impact |
|-----------|--------|--------|
| Turborepo monorepo | Template | Project structure uses `packages/` layout |
| React 19 + Vite + TanStack | Template | Frontend stack is fixed |
| FastAPI async | Template | Backend framework is fixed |
| SQLAlchemy 2.0 async + Alembic | Template | ORM and migration framework are fixed |
| LangGraph + PostgresSaver | Stakeholder | Agent orchestration framework and checkpoint mechanism are fixed |
| Claude for reasoning | Stakeholder | Primary LLM provider for analysis agents |
| GPT-4 Vision for documents | Stakeholder | Vision model for document classification/extraction |
| pgvector (no separate vector DB) | Stakeholder | Vector storage co-located with application data |
| Redis | Template | Cache layer is fixed |
| MinIO | Template | Object storage is fixed |
| LangFuse | Stakeholder | LLM observability platform is fixed |
| FRED API | Stakeholder | Mortgage rate and economic indicator source |
| BatchData API | Stakeholder | Property data source (mocked by default) |
| Decimal/integer cents | Domain rule | No floating-point for money anywhere in the system |
| Three roles (hierarchical) | Stakeholder | loan_officer < senior_underwriter < reviewer |
| Agent conflicts -> human review | Stakeholder | No automated tie-breaking |
