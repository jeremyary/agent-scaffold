<!-- This project was developed with assistance from AI tools. -->

# System Architecture: Multi-Agent Mortgage Loan Processing System

## Architecture Overview

The system is a multi-agent AI-powered mortgage loan processing platform built as a developer quickstart on the Red Hat AI Quickstart template. It consists of three primary subsystems connected through well-defined boundaries:

1. **Loan Processing Subsystem** -- A supervisor-worker LangGraph graph that orchestrates document extraction, credit analysis, risk assessment, compliance checking, fraud detection, and denial coaching through persistent, checkpointed workflows.

2. **Intake Subsystem** -- An independent LangGraph graph providing a public-facing conversational agent with RAG-based mortgage Q&A, tool integrations (mortgage calculator, FRED API, property data), and streaming responses.

3. **Application Platform** -- The FastAPI backend, React frontend, PostgreSQL database, Redis cache, and MinIO object storage that host both subsystems and provide the API layer, authentication, audit trail, and dashboard UI.

**High-level component relationships:**

```
                         +---------------------------+
                         |       React 19 UI         |
                         |  (Dashboard + Intake Chat |
                         |   + Calculator Widget)    |
                         +------------+--------------+
                                      | HTTP / SSE
                         +------------+--------------+
                         |       FastAPI Backend      |
                         |  /v1/* API + Auth + Audit  |
                         +--+------+------+------+---+
                            |      |      |      |
              +-------------+  +---+---+  |  +---+-----------+
              |                |       |  |  |               |
    +---------v---------+  +--v--+ +--v--+  +--v---+  +------v------+
    | Loan Processing   |  |Redis| |MinIO|  | FRED |  | LLM APIs    |
    | Graph (LangGraph) |  +-----+ +-----+  | API  |  | Claude,     |
    | - Supervisor      |                    +------+  | GPT-4V      |
    | - Worker Agents   |                              +-------------+
    +---------+---------+
              |
    +---------v---------+     +-------------------+
    | PostgreSQL 16     |     | Intake Graph      |
    | - public schema   |     | (LangGraph)       |
    | - rag schema      |     | - Q&A Agent       |
    | - langgraph schema|     | - Calculator Tool |
    | - pgvector        |     | - Data Tools      |
    +-------------------+     +-------------------+
```

The loan processing graph and intake graph are separate LangGraph state machines that share the same PostgreSQL database (different schemas) and LLM API clients, but are otherwise isolated. The intake graph has no access to loan application data or the authenticated API tier.

---

## Package Structure

The project follows the Red Hat AI Quickstart monorepo layout managed by Turborepo.

```
project/
├── packages/
│   ├── ui/                          # React 19 frontend (pnpm)
│   │   ├── src/
│   │   │   ├── components/          # Shared UI components (shadcn/ui)
│   │   │   ├── features/
│   │   │   │   ├── dashboard/       # Application list, detail, workflow viz
│   │   │   │   ├── review-queue/    # Human review interface
│   │   │   │   ├── intake-chat/     # Public chat interface
│   │   │   │   ├── calculator/      # Mortgage calculator widget
│   │   │   │   └── admin/           # Threshold config, KB management
│   │   │   ├── hooks/               # Shared React hooks
│   │   │   ├── lib/                 # API client, auth utilities
│   │   │   └── routes/              # TanStack Router route definitions
│   │   └── vite.config.ts
│   │
│   ├── api/                         # FastAPI backend (uv/Python)
│   │   ├── src/
│   │   │   ├── auth/                # Key resolver, role asserter, auth context
│   │   │   ├── contracts/           # Protocol classes for mocked services
│   │   │   ├── graphs/
│   │   │   │   ├── loan_processing/ # Supervisor-worker graph definition
│   │   │   │   └── intake/          # Intake conversation graph definition
│   │   │   ├── agents/
│   │   │   │   ├── document_processor.py
│   │   │   │   ├── credit_analyst.py
│   │   │   │   ├── risk_assessor.py
│   │   │   │   ├── compliance_checker.py
│   │   │   │   ├── fraud_detector.py
│   │   │   │   ├── denial_coach.py
│   │   │   │   └── intake_agent.py
│   │   │   ├── routes/
│   │   │   │   ├── applications.py
│   │   │   │   ├── documents.py
│   │   │   │   ├── review_queue.py
│   │   │   │   ├── audit_events.py
│   │   │   │   ├── chat.py
│   │   │   │   ├── calculator.py
│   │   │   │   ├── market_data.py
│   │   │   │   ├── admin.py
│   │   │   │   ├── auth_keys.py
│   │   │   │   └── health.py
│   │   │   ├── services/
│   │   │   │   ├── mocks/           # Mock implementations of external services
│   │   │   │   ├── audit.py         # Audit event recording service
│   │   │   │   ├── pii.py           # PII redaction pipeline
│   │   │   │   ├── encryption.py    # Field-level encryption utilities
│   │   │   │   └── llm.py           # LLM client wrappers (Claude, GPT-4V)
│   │   │   ├── middleware/
│   │   │   │   ├── correlation.py   # X-Request-ID / correlation ID
│   │   │   │   ├── rate_limit.py    # Redis-backed rate limiting
│   │   │   │   └── logging.py       # Structured JSON logging
│   │   │   └── config.py            # Settings (Pydantic BaseSettings)
│   │   ├── tests/
│   │   └── pyproject.toml
│   │
│   ├── db/                          # Database models & migrations (uv/Python)
│   │   ├── src/
│   │   │   ├── models/              # SQLAlchemy 2.0 async models
│   │   │   ├── migrations/          # Alembic migration scripts
│   │   │   └── seed.py              # Seed data generation
│   │   └── pyproject.toml
│   │
│   └── configs/                     # Shared ESLint, Prettier, Ruff configs
│
├── deploy/
│   └── helm/                        # Helm charts for OpenShift
├── compose.yml                      # Local development with containers
├── turbo.json                       # Turborepo pipeline configuration
├── Makefile                         # Common development commands
└── plans/                           # Architecture, design docs, ADRs
```

**Package boundaries:**
- `ui` communicates with `api` exclusively via HTTP (configured by `VITE_API_BASE_URL`).
- `api` imports models from `db` as a Python dependency.
- `db` is standalone -- manages schema, models, and migrations. No dependency on `api`.
- `configs` provides shared linter and formatter configuration. No runtime dependencies.

---

## Technology Stack Decisions

### Stakeholder-Mandated (Confirmed)

All stakeholder-mandated technologies are adopted as specified. Trade-offs and risks are noted where relevant.

| Technology | Role | Adoption Notes |
|-----------|------|---------------|
| **LangGraph + PostgresSaver** | Agent orchestration with persistent checkpointing | Checkpointing is foundational from Phase 1. PostgresSaver uses a dedicated `langgraph` schema to isolate checkpoint tables from application data. |
| **Claude (reasoning)** | Primary LLM for credit analysis, risk assessment, compliance, intake Q&A, denial coaching | Used for all text-reasoning tasks. Accessed via Anthropic API. |
| **GPT-4 Vision** | Document analysis (OCR + extraction) | Used exclusively for document image/PDF processing where vision capability is required. Accessed via OpenAI API. |
| **PostgreSQL + pgvector** | Application database + RAG vector search in single instance | Risk: shared database creates scaling coupling between transactional and vector workloads. Mitigated by schema isolation (`public`, `rag`, `langgraph`) and separate connection pools with distinct `statement_timeout` settings (see Data Architecture). |
| **Redis** | Caching, rate limiting, session data | Used for: RAG query cache, external API response cache (FRED, property data), rate limiting counters, intake chat session tokens. PII does not transit through Redis at MVP -- cache is limited to non-PII data. |
| **MinIO** | S3-compatible object storage for documents | Configured with server-side encryption (SSE) for all stored objects. Documents are referenced by UUID keys, never by original filenames. |
| **LangFuse** | LLM observability and tracing | Optional dependency -- system degrades gracefully if unavailable. Integrated via LangFuse callback handlers on LLM client calls. |
| **FRED API** | Live mortgage rates, Treasury yields, housing indices | Cached in Redis with 1-hour TTL. Public tier endpoint serves cached data. |
| **BatchData API** | Property valuations, comparable sales, AVM estimates | Mocked by default with fixture data. Real API key configurable via environment variable. |
| **React 19 + Vite + TanStack Router + TanStack Query + Tailwind + shadcn/ui** | Frontend stack | Standard Red Hat AI Quickstart frontend. TanStack Query handles API state management and polling. |
| **FastAPI (async)** | Backend framework | All endpoints are async. Uses dependency injection for auth, services, and configuration. |
| **SQLAlchemy 2.0 async + Alembic** | ORM and migrations | Async engine with connection pooling. Alembic for forward-only migrations at MVP. |
| **Vitest / Pytest** | Testing frameworks | Vitest for UI, Pytest for API and DB packages. |
| **pnpm / uv** | Package managers | pnpm for Node packages, uv for Python packages. |
| **Turborepo** | Build system | Manages cross-package build dependencies and caching. |
| **Podman / Helm / OpenShift** | Container build and deployment | Podman for local container builds. Helm charts for OpenShift deployment. |
| **SSE** | Streaming chat transport | Server-Sent Events for incremental intake chat responses via POST + `Accept: text/event-stream`. Polling for all other status updates. Note: POST-based SSE is non-standard (browser `EventSource` API supports GET only); the Technical Design must document that the frontend uses `fetch` with `ReadableStream`, not the native `EventSource` API. |
| **`Bearer <role>:<key>`** | Authentication format | Role prefix is a routing hint only. Server resolves role from key alone (see Authentication section). |

### Architecture Decisions (Not Mandated)

| Decision | Choice | Rationale |
|---------|--------|-----------|
| **PII encryption library** | `cryptography` (Fernet symmetric) | Established, audited library. Fernet provides authenticated encryption. Key sourced from environment/secrets manager. |
| **Mocked service abstraction** | Python `Protocol` classes | Type-safe interface contracts. Mock and real implementations share the same Protocol. Swap via configuration, not code changes. |
| **API key hashing** | HMAC-SHA256 with server-side secret | Fast (microseconds per lookup), appropriate for high-entropy API keys. HMAC secret adds defense layer if DB is compromised. |
| **Audit immutability enforcement** | Database-level: dedicated `audit_writer` role with INSERT-only + trigger guard + hash chaining + advisory lock for concurrency | Defense in depth: permission restriction, trigger, cryptographic verification, and serialized writes during parallel fan-out. |
| **Connection pool strategy** | Two async pools: transactional (public schema) and RAG (rag schema). Audit writes use `SET ROLE` within transactional pool. | Isolates vector search load from transactional queries. Separate `statement_timeout` settings. Avoids a third pool for audit. |
| **Rate limiting backend** | Redis with sliding window counters | Per-IP for public tier, per-key for protected tier. Separate, more restrictive limits for LLM-invoking endpoints. |
| **Correlation ID propagation** | `X-Request-ID` header, generated at API entry point | Attached to all log entries, audit events, and downstream service calls. |
| **LLM failure strategy** | Retry with exponential backoff (3 attempts), then fail to `processing_error` status | Application moves to error state, error logged in audit trail, user can retry via API action endpoint. |

---

## Component Architecture

### Loan Processing Graph

The loan processing workflow is implemented as a LangGraph `StateGraph` with a supervisor-worker pattern. The supervisor is the graph's control flow logic (conditional edges), not a separate LLM agent.

**Graph structure:**

```
                    +-----------+
                    |   START   |
                    +-----+-----+
                          |
                    +-----v-----+
                    |  Document  |
                    | Processing |
                    +-----+-----+
                          |
              +-----------+-----------+
              |           |           |
        +-----v-----+ +--v------+ +-v----------+
        |  Credit    | |  Risk   | | Compliance |
        |  Analysis  | |  Assess | | Checking   |
        +-----+------+ +--+------+ +-+----------+
              |           |           |
              +-----------+-----------+
                          |
                    +-----v-----+
                    | Aggregator|  (Confidence aggregation +
                    | + Router  |   conflict detection)
                    +-----+-----+
                          |
              +-----------+-----------+-----------+
              |           |           |           |
        auto-approve  escalate-to  escalate-to  fraud-flag
        (high conf)   review       review       (force
                      (med conf)   (conflict)    review)
              |           |           |           |
              v           +-----------+-----------+
         +--------+                   |
         |APPROVED|            +------v------+
         +--------+            | AWAIT_REVIEW|
                               +------+------+
                                      |
                               +------v------+
                               | Human Review|
                               | (approve /  |
                               |  deny /     |
                               |  req docs)  |
                               +--+----+--+--+
                                  |    |  |
                            approve deny  request-docs
                               |    |        |
                               v    v   +----v------+
                                        | Re-process|
                                        | (full     |
                                        |  pipeline)|
                                        +-----------+
```

**State management:**

The graph state is a TypedDict containing:
- `application_id`: UUID of the loan application
- `documents`: List of document references with extraction results
- `agent_results`: Dict mapping agent name to analysis result (confidence, reasoning, data)
- `aggregated_confidence`: Overall confidence score after aggregation
- `routing_decision`: The routing outcome (auto_approve, escalate, fraud_flag)
- `review_result`: Human review decision (if applicable)
- `analysis_pass`: Integer counter for resubmission cycles
- `current_step`: Current position in the workflow
- `errors`: List of agent-level errors encountered

**Checkpoint strategy:**

LangGraph's `PostgresSaver` checkpoints the full graph state after every node execution. Checkpoints are stored in the `langgraph` schema. This means:
- If the service restarts mid-workflow, it resumes from the last completed node.
- The state includes all agent results accumulated so far, so parallel agents that completed before the restart do not re-execute.
- Checkpoint cleanup runs daily for terminal workflows older than 30 days.

**Graph invocation:**

Graph invocation is asynchronous. Application submission enqueues a background task that invokes the LangGraph graph. The API returns 202 Accepted immediately. The client polls application status for completion. The `application_id` is used directly as the LangGraph `thread_id`, providing a natural mapping between the application record and its graph execution. On retry (after `processing_error`), the same `application_id`/`thread_id` is used so PostgresSaver resumes from the last successful checkpoint. If the checkpoint itself is corrupted, the retry falls back to a fresh graph invocation with thread_id `{application_id}:{analysis_pass}`, re-running the full pipeline.

**Confidence aggregation:**

The aggregator node receives results from all analysis agents and applies the following rules (in priority order):
1. Any fraud flag from any agent -> `fraud_flag` routing (forces human review)
2. Any conflict between agents (e.g., credit says approve, risk says deny) -> `escalate` routing
3. Minimum confidence across all agents below configurable threshold -> `escalate` routing
4. All agents above threshold with no conflicts -> `auto_approve` routing

Thresholds are loaded from the database (`admin/thresholds` table) at graph initialization, not hardcoded. Changes to thresholds take effect on the next workflow invocation.

**Agent conflict detection:**

Two agents "conflict" when their recommendations diverge. Each agent produces a `recommendation` field (`approve`, `deny`, `review`) and a `confidence` score. The aggregator detects conflicts when any two agents produce different recommendations. All conflicts escalate to human review with no automated tie-breaking (firm stakeholder requirement).

### Worker Agents

Each worker agent follows the same pattern:

1. **Receive** task-specific input from the graph state
2. **Redact** PII from any data that will be sent to LLMs (via the PII redaction service)
3. **Call** the appropriate LLM with a structured prompt
4. **Parse** the LLM response into a typed result dataclass
5. **Validate** the parsed result (schema validation, range checks on scores)
6. **Record** an audit event with confidence, reasoning, and input data hash
7. **Return** the typed result to the graph state

| Agent | LLM | Input | Output |
|-------|-----|-------|--------|
| Document Processor | GPT-4 Vision | Document image/PDF from MinIO | Document type classification, extracted fields, confidence per field |
| Credit Analyst | Claude | Mocked credit report data | Credit assessment, recommendation, confidence, reasoning |
| Risk Assessor | Claude | Extracted financial data (income, debts, property value) | DTI, LTV, employment stability, risk score, recommendation |
| Compliance Checker | Claude + RAG | All agent results + knowledge base context | Fair lending compliance status, regulatory citations, recommendation |
| Fraud Detector | Claude | All documents + metadata + extracted data | Fraud flags (if any), suspicion reasons, confidence |
| Denial Coach | Claude | Denial reasons from other agents | Improvement recommendations, what-if scenarios |

### Intake Graph

The intake agent is an independent LangGraph graph with no connection to the loan processing graph or the application database.

**Graph structure:**

```
    +-------+
    | START |
    +---+---+
        |
    +---v-----------+
    | Intake Agent   |     Tools available:
    | (Claude)       +---> - mortgage_calculator
    |                |     - fred_api_lookup
    +---+-----+-----+     - property_data_lookup
        |     |            - knowledge_base_search
        |     |
    +---v---+ |
    | TOOLS | |
    +---+---+ |
        |     |
        +--+--+
           |
    +------v------+
    |   RESPOND    |
    +------+------+
           |
    +------v------+
    |     END     |
    +-------------+
```

**Isolation boundaries:**
- The intake agent's tool set is explicitly limited: mortgage calculator (pure computation), FRED API (cached market data), property data (mocked/real external API), and knowledge base search (RAG over regulatory documents only).
- The intake agent has **no access** to: loan application data, user records, audit trails, review queue, or any authenticated API endpoint.
- The intake agent runs on a separate LangGraph graph instance with its own state that contains only conversation history and tool results.
- Chat sessions are short-lived by default (24-hour TTL). Cross-session context (P2) stores conversation summaries, not raw transcripts, and redacts PII before storage.

**Tool implementations:**

| Tool | Implementation | Data Source |
|------|---------------|-------------|
| `mortgage_calculator` | Pure Python computation (no LLM) | Input parameters only |
| `fred_api_lookup` | HTTP client to FRED API | Cached in Redis (1-hour TTL) |
| `property_data_lookup` | Protocol-based (mock or real BatchData) | Mock fixture data or real API |
| `knowledge_base_search` | pgvector similarity search | `rag` schema in PostgreSQL |

### Mortgage Calculator

The mortgage calculator is a hybrid component: pure computation engine with an optional LLM natural-language wrapper.

**Computation engine** (no LLM):
- Monthly payment (PITI: principal, interest, taxes, insurance)
- Total interest over loan life
- DTI ratio preview
- Affordability estimate (given income and debts)
- Amortization schedule generation
- Side-by-side scenario comparison

All financial calculations use `Decimal` types internally. Results formatted to dollars/percentages only at the API serialization layer.

**API endpoints** (public tier, stateless):
- `POST /v1/calculator/monthly-payment` -- single scenario
- `POST /v1/calculator/affordability` -- affordability estimate
- `POST /v1/calculator/amortization` -- full amortization schedule

Each endpoint accepts JSON input and returns JSON results. No database access, no state, no authentication required. Rate-limited via Redis.

**LLM wrapper** (intake agent tool):
When the intake agent invokes `mortgage_calculator` as a tool, it translates natural-language requests into calculator inputs, calls the computation engine, and formats results into conversational responses. The LLM never performs the financial calculations -- it only translates between natural language and the calculator API.

---

## Data Architecture

### Database Schema Design

PostgreSQL with three schemas for logical isolation:

| Schema | Purpose | Tables |
|--------|---------|--------|
| `public` | Application data, auth, audit | `api_keys`, `loan_applications`, `documents`, `agent_decisions`, `review_actions`, `audit_events`, `fraud_flags`, `intake_conversations`, `intake_messages`, `confidence_thresholds`, `compliance_reports` |
| `rag` | Knowledge base for RAG | `knowledge_documents`, `knowledge_embeddings` |
| `langgraph` | LangGraph checkpoint storage | Managed by PostgresSaver |

**Core entities:**

```
api_keys
├── id: UUID (PK)
├── key_hash: VARCHAR(64) NOT NULL   -- HMAC-SHA256 hash of the API key
├── role: VARCHAR NOT NULL           -- enum: loan_officer, senior_underwriter, reviewer
├── description: VARCHAR             -- human-readable label
├── expires_at: TIMESTAMPTZ          -- configurable TTL (90 days protected, 24h dev seeds)
├── is_active: BOOLEAN DEFAULT true
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ

loan_applications
├── id: UUID (PK)
├── status: VARCHAR NOT NULL         -- draft, submitted, processing, awaiting_review,
│                                       approved, denied, withdrawn, processing_error
├── borrower_name: VARCHAR NOT NULL
├── ssn_encrypted: BYTEA             -- Fernet-encrypted SSN
├── ssn_last4: VARCHAR(4)            -- plaintext last 4 for display
├── account_numbers_encrypted: BYTEA -- Fernet-encrypted
├── government_id_encrypted: BYTEA   -- Fernet-encrypted
├── loan_amount_cents: INTEGER       -- monetary value in cents
├── property_value_cents: INTEGER
├── annual_income_cents: INTEGER
├── monthly_debts_cents: INTEGER
├── loan_term_months: INTEGER
├── interest_rate: NUMERIC(8,6)
├── property_address: JSONB
├── analysis_pass: INTEGER DEFAULT 1 -- incremented on resubmission
├── created_by: UUID FK -> api_keys.id
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ

documents
├── id: UUID (PK)
├── application_id: UUID FK -> loan_applications.id
├── storage_key: VARCHAR NOT NULL    -- MinIO object key (UUID-based, not filename)
├── original_filename: VARCHAR       -- sanitized original name for display
├── mime_type: VARCHAR NOT NULL      -- validated against allowlist
├── file_size_bytes: INTEGER
├── document_type: VARCHAR           -- classified type (w2, pay_stub, tax_return, etc.)
├── processing_status: VARCHAR       -- pending, processing, completed, failed
├── processing_error: JSONB          -- RFC 7807 error if failed
├── extracted_data: JSONB            -- structured extraction results
├── field_confidence: JSONB          -- per-field confidence scores
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ

audit_events
├── id: BIGSERIAL (PK)              -- auto-increment for append performance
├── application_id: UUID FK -> loan_applications.id (nullable for system events)
├── event_type: VARCHAR NOT NULL     -- state_transition, agent_decision, human_review,
│                                       auth_event, threshold_change, document_upload, etc.
├── actor_id: VARCHAR                -- API key ID or agent name
├── actor_type: VARCHAR              -- 'user' or 'agent'
├── actor_role: VARCHAR
├── agent_name: VARCHAR              -- for agent_decision events
├── confidence_score: NUMERIC(4,3)   -- for agent_decision events
├── reasoning: TEXT                   -- plain-language reasoning
├── input_data_hash: VARCHAR(64)     -- SHA-256 of input data
├── previous_state: VARCHAR          -- for state_transition events
├── new_state: VARCHAR
├── metadata: JSONB                  -- extensible event-specific data
├── prev_event_hash: VARCHAR(64)     -- hash chain for tamper detection
├── created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
└── (NO updated_at -- immutable)

agent_decisions
├── id: UUID (PK)
├── application_id: UUID FK -> loan_applications.id
├── agent_name: VARCHAR NOT NULL
├── analysis_pass: INTEGER NOT NULL  -- which pass this decision belongs to
├── recommendation: VARCHAR          -- approve, deny, review
├── confidence_score: NUMERIC(4,3)
├── reasoning: TEXT
├── result_data: JSONB               -- agent-specific structured output
├── created_at: TIMESTAMPTZ
└── (NO updated_at -- append-only per pass, new pass creates new rows)

review_actions
├── id: UUID (PK)
├── application_id: UUID FK -> loan_applications.id
├── reviewer_id: UUID FK -> api_keys.id
├── decision: VARCHAR NOT NULL       -- approved, denied, request_documents
├── rationale: TEXT
├── created_at: TIMESTAMPTZ
└── (NO updated_at)

confidence_thresholds
├── id: UUID (PK)
├── threshold_type: VARCHAR NOT NULL    -- auto_approve_min, escalate_below, fraud_override
├── value: NUMERIC(4,3) NOT NULL        -- confidence score threshold
├── is_active: BOOLEAN DEFAULT true
├── updated_by: UUID FK -> api_keys.id
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ
```

Threshold changes are captured via `audit_events` (event_type: `threshold_change`), so no separate `threshold_change_log` table is needed.

**RAG tables (rag schema):**

```
rag.knowledge_documents
├── id: UUID (PK)
├── title: VARCHAR NOT NULL
├── source_url: VARCHAR
├── document_type: VARCHAR           -- regulation, guidance, policy
├── content_hash: VARCHAR(64)        -- for deduplication on re-upload
├── version: INTEGER DEFAULT 1
├── is_active: BOOLEAN DEFAULT true
├── created_at: TIMESTAMPTZ
└── updated_at: TIMESTAMPTZ

rag.knowledge_embeddings
├── id: UUID (PK)
├── document_id: UUID FK -> rag.knowledge_documents.id
├── chunk_index: INTEGER             -- position within the document
├── chunk_text: TEXT                  -- the raw text chunk
├── embedding: VECTOR(1536)          -- pgvector column (dimension matches model)
├── metadata: JSONB                  -- section title, page number, etc.
└── created_at: TIMESTAMPTZ
```

**Indexes:**

- `loan_applications`: index on `(status, created_at)` (covers review queue query), `(created_by)`, `(created_at DESC)`
- `documents`: index on `(application_id)`, `(processing_status)`
- `audit_events`: index on `(application_id, id)` for cursor pagination, `(event_type)`, `(created_at)`
- `agent_decisions`: index on `(application_id, analysis_pass)`
- `rag.knowledge_embeddings`: HNSW index on `embedding` using `vector_cosine_ops` (appropriate for MVP document counts <10k chunks)
- `api_keys`: index on `(key_hash)` for auth lookups
- `confidence_thresholds`: index on `(threshold_type, is_active)`

### Data Flow

**Happy path: Loan application lifecycle**

```
1. Loan Officer creates application
   -> POST /v1/applications
   -> INSERT loan_applications (status: draft)
   -> audit_event: state_transition (null -> draft)

2. Upload documents
   -> POST /v1/applications/:id/documents (multipart)
   -> Validate file type (allowlist), size (<20MB), sanitize filename
   -> Store in MinIO with UUID key + SSE encryption
   -> INSERT documents (processing_status: pending)
   -> audit_event: document_upload

3. Submit application
   -> PATCH /v1/applications/:id (status: submitted -> processing)
   -> audit_event: state_transition (submitted -> processing)
   -> Enqueue LangGraph workflow invocation

4. Document Processing (LangGraph node)
   -> For each document: fetch from MinIO, send to GPT-4 Vision (PII-redacted)
   -> Parse extraction results, validate, compute field confidence
   -> UPDATE documents SET extracted_data, field_confidence, processing_status
   -> INSERT agent_decisions (document_processor)
   -> audit_event: agent_decision (per document)
   -> Checkpoint state

5. Parallel Analysis (LangGraph fan-out)
   -> Credit Analyst: mocked credit bureau data + extracted data -> Claude
   -> Risk Assessor: extracted financial data -> Claude (DTI, LTV, employment)
   -> Compliance Checker: all data + RAG knowledge base -> Claude
   -> Each: INSERT agent_decisions, audit_event: agent_decision
   -> Checkpoint state after each completes

6. Aggregation + Routing (LangGraph node)
   -> Load confidence thresholds from DB
   -> Apply routing rules (fraud -> escalate, conflict -> escalate, low conf -> escalate)
   -> audit_event: routing_decision
   -> Checkpoint state

7a. Auto-approve (high confidence, no conflicts)
    -> UPDATE loan_applications SET status = 'approved'
    -> audit_event: state_transition (processing -> approved)

7b. Escalate to review
    -> UPDATE loan_applications SET status = 'awaiting_review'
    -> audit_event: state_transition (processing -> awaiting_review)
    -> Application appears in review queue

8. Human Review (via API)
   -> Reviewer opens application, sees all agent analyses
   -> PATCH /v1/applications/:id/review (decision: approve|deny|request_documents)
   -> INSERT review_actions
   -> audit_event: human_review

8a. Approve -> status: approved
8b. Deny -> Denial Coach agent generates recommendations -> status: denied
8c. Request Documents -> status: awaiting_documents
    -> New uploads trigger fresh analysis pass (analysis_pass incremented)
    -> Entire pipeline re-runs from Document Processing
```

**Error path:**

At any LLM-calling step:
1. Retry with exponential backoff (3 attempts, 1s / 2s / 4s delays)
2. If all retries fail: agent records a `processing_error` result with error details
3. If a required agent fails (document processor, credit analyst, risk assessor): workflow transitions to `processing_error` status, audit event recorded, user can retry via `POST /v1/applications/:id/retry` (returns 202 Accepted; transitions status back to `processing` and re-invokes the graph asynchronously)
4. If an optional agent fails (fraud detector): workflow continues with remaining agents, error noted in audit trail
5. Retry re-invokes the same LangGraph thread (same `application_id` = `thread_id`), so PostgresSaver resumes from the last successful checkpoint and only the failed agent re-executes. Multiple rapid retries are idempotent -- only one in-flight workflow per application is allowed

---

## API Architecture

The API surface is organized into resource groups under a `/v1/` prefix. Full endpoint details are the API Designer's domain; this section defines the groupings, boundaries, and patterns.

### Endpoint Groups

| Group | Base Path | Auth Tier | Description |
|-------|-----------|-----------|-------------|
| Applications | `/v1/applications` | Protected | CRUD lifecycle. Sub-resources: `/:id/documents`, `/:id/audit-events`, `/:id/analyses`, `/:id/review`, `/:id/retry` |
| Review Queue | `/v1/review-queue` | Protected | Read-only projection over applications with `awaiting_review` status. Filtered by role-based confidence tier. |
| Documents | `/v1/documents/:id` | Protected | Direct document access (download, status). Creation via applications sub-resource. |
| Chat | `/v1/chat/sessions` | Public | Session management and messaging. SSE streaming at `/:id/messages` (POST with `Accept: text/event-stream`). |
| Calculator | `/v1/calculator/*` | Public | Stateless computation endpoints (POST). |
| Market Data | `/v1/market-data/*` | Public | Cached GET endpoints (FRED-sourced). |
| Admin | `/v1/admin/*` | Protected (reviewer) | Threshold configuration, knowledge base management. |
| Auth | `/v1/auth/keys` | Protected (reviewer) | API key management (create, revoke, list). |
| Health | `/health`, `/ready` | None | Liveness and readiness probes. No `/v1/` prefix. |

### Public vs. Protected Boundary

The boundary is enforced at the FastAPI router level. Public routers have rate limiting middleware; protected routers have the three-layer auth middleware chain (key resolver -> role asserter -> audit injector).

```python
# Public router: rate limiting, no auth
public_router = APIRouter(prefix="/v1")
public_router.include_router(chat_router)
public_router.include_router(calculator_router)
public_router.include_router(market_data_router)

# Protected router: auth middleware
protected_router = APIRouter(prefix="/v1", dependencies=[Depends(resolve_api_key)])
protected_router.include_router(applications_router)
protected_router.include_router(review_queue_router)
# ... etc
```

### Async Patterns

- **Document processing:** Asynchronous. Upload returns 201 immediately. Client polls document status.
- **Workflow execution:** Asynchronous. Submit transitions application to `processing`. Client polls application status.
- **Chat responses:** Synchronous streaming via SSE. POST sends message, response streams back as `text/event-stream`.
- **Calculator:** Synchronous. POST with input, 200 with result.
- **All other endpoints:** Synchronous request-response.

### Response Envelope

All responses follow the project convention:
- Single resource: `{ "data": { ... } }`
- Collection: `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true } }`
- Error: RFC 7807 Problem Details

### Financial Value Serialization Convention

Monetary values are stored as integer cents in the database. At the API JSON serialization layer, they are represented as **string decimals** (`"loanAmount": "250000.00"`) rather than bare integers or floats. This avoids JavaScript floating-point precision loss on large values, is unambiguous about the decimal point location, and is a common pattern in financial APIs. Interest rates and ratios are also serialized as strings (`"interestRate": "6.875"`, `"dtiRatio": "43.50"`). PII fields are never included in API responses in cleartext -- only masked values (e.g., `"ssn": "***-**-1234"`).

### Role-Based Review Queue Filtering

The review queue API filters results based on the caller's role (API-level filtering, not UI-level):
- `loan_officer`: sees applications with medium-confidence escalations only
- `senior_underwriter`: sees all escalated applications (medium + low confidence + fraud-flagged + conflict-escalated)
- `reviewer`: sees all escalated applications plus audit/compliance views

Fraud-flagged and conflict-escalated applications are treated as high-risk cases visible to `senior_underwriter` and above only. A `loan_officer` does not see these because they require more experienced judgment. This prevents data leakage -- a loan officer cannot see low-confidence, fraud-flagged, or conflict-escalated cases they are not authorized to review.

---

## Authentication and Authorization

### API Key Model with Server-Side Role Resolution

The authentication format is `Authorization: Bearer <role>:<key>` as mandated by the stakeholder. The critical design decision: **the role prefix is a routing hint only. The server resolves the authoritative role from the key alone.**

**How it works:**

1. Client sends `Authorization: Bearer loan_officer:abc123def456`
2. Key Resolver middleware extracts the key portion (`abc123def456`)
3. Computes HMAC-SHA256 of the key using the server-side `HMAC_SECRET_KEY`
4. Looks up the computed hash in the `api_keys` table (constant-time comparison)
5. Retrieves the key's actual role from the database
6. If the client-supplied role prefix does not match the key's actual role, the server logs the mismatch at `warn` level and continues with the database role
7. The client-supplied role prefix is **never** used for authorization decisions

This design:
- Eliminates the privilege escalation vector (client cannot claim a higher role)
- Preserves developer ergonomics (role prefix helps developers identify which key they are using)
- Matches the product plan's explicit clarification: "The role prefix is a routing hint only -- the server maintains the authoritative key-to-role mapping"

### Key Management

- Keys are hashed with HMAC-SHA256 (using a server-side `HMAC_SECRET_KEY`) before storage. HMAC-SHA256 is fast (microseconds per lookup) and appropriate for high-entropy API keys, unlike bcrypt which is designed for low-entropy passwords. The HMAC secret adds a defense layer: if the database is compromised, the attacker cannot verify keys without the server-side secret. Plaintext key is returned only on creation, never retrievable afterward.
- Keys have a configurable TTL: 90 days for protected tier, 24 hours for development seed keys.
- Expired keys return 401.
- Keys can be revoked (soft delete: `is_active = false`).
- Key creation and revocation are audited.

### Production Credential Safety

The system **refuses to start** in production mode (`ENVIRONMENT=production`) if default/seed credentials are detected. This applies to API keys, MinIO credentials (`minioadmin/minioadmin`), PostgreSQL default passwords, and Redis default configuration. This is a hard fail (process exits with error), not a warning log. Seed keys are clearly labeled in the seed data script and have 24-hour TTL.

### Role Hierarchy

```
loan_officer < senior_underwriter < reviewer
```

Each higher role inherits all permissions of lower roles. The `require_role(minimum_role)` dependency checks whether the key's role meets or exceeds the required minimum.

### Auth Context Propagation

After successful authentication, an `AuthContext` dataclass is attached to the FastAPI request state:

```python
@dataclass
class AuthContext:
    key_id: str          # UUID of the API key
    role: str            # Resolved role from database
    correlation_id: str  # Request correlation ID
```

This context flows via dependency injection to service layers and the audit service, avoiding thread-locals or globals.

---

## Security Architecture

### Data-at-Rest Encryption

| Data Store | Encryption Method | Scope |
|-----------|-------------------|-------|
| PostgreSQL (PII fields) | Application-level Fernet encryption | `ssn_encrypted`, `account_numbers_encrypted`, `government_id_encrypted` in `loan_applications` |
| MinIO (documents) | Server-side encryption (SSE) | All uploaded objects (tax returns, pay stubs, bank statements) |
| Redis | Not encrypted at MVP | Cache limited to non-PII data (rate limits, session tokens, cached market data). No PII transits through Redis. |
| Backups | Deferred to production maturity | MVP demonstrates the field-level pattern; full TDE and backup encryption are production concerns |

The Fernet encryption key is sourced from the `ENCRYPTION_KEY` environment variable (or secrets manager in production). The encryption service supports a key ring for rotation: `ENCRYPTION_KEY` is the current key used for all new encryption, and `ENCRYPTION_KEY_PREVIOUS` (optional) holds the prior key for decryption of older records. On read, the service attempts decryption with the current key first, then falls back to the previous key. A key version prefix byte is prepended to each ciphertext to route decryption to the correct key. Batch re-encryption (migrating all records to the current key) is deferred to production maturity.

### PII Redaction Pipeline

PII redaction is a mandatory step before any data is sent to external LLM APIs. It is operational from the first LLM call (Phase 2).

**Redaction service (`services/pii.py`):**
1. Accepts structured data (dict/dataclass) containing document fields
2. Identifies PII fields by name pattern and field registry (SSN, account numbers, government IDs, full names when associated with financial data)
3. Replaces PII values with redaction tokens: `[SSN_REDACTED]`, `[ACCOUNT_REDACTED]`, etc.
4. Returns the redacted data for LLM consumption
5. Maintains a mapping of redaction tokens to field paths (not values) for result re-association

The PII redaction service is a required dependency for all agent nodes in the loan processing graph. Agents that skip redaction fail the code review checklist.

### Document Upload Security

| Control | Implementation |
|---------|---------------|
| File type validation | Server-side MIME type validation against allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff` |
| File size limit | 20MB maximum per file, configurable |
| Filename sanitization | Strip path components, replace non-alphanumeric characters, truncate to 255 chars. Store with UUID key in MinIO, not original filename. |
| Content validation | Validate PDF structure / image headers before processing. Reject polyglot files. |
| Storage isolation | Each document stored under a UUID key in a dedicated MinIO bucket. No user-controlled paths. |

### Public Tier Sandboxing

The intake agent is sandboxed with explicit permission boundaries:

**CAN access:**
- Mortgage calculator (pure computation, no data store)
- FRED API (cached market data, public information)
- Property data service (mocked or real external API, no PII)
- Knowledge base search (RAG over regulatory documents only, `rag` schema)

**CANNOT access:**
- `loan_applications`, `documents`, `audit_events`, `agent_decisions`, `review_actions` tables
- Any authenticated API endpoint
- Any internal service that touches application data
- The `public` schema connection pool

This isolation is enforced architecturally: the intake graph's tool definitions only reference the calculator module, external API clients, and the RAG connection pool. There is no code path from the intake graph to application data.

### Audit Trail Integrity

Three layers of immutability enforcement:

1. **Database permissions:** A dedicated `audit_writer` PostgreSQL role has `INSERT`-only privileges on `audit_events`. `UPDATE` and `DELETE` are revoked. The application's database user for audit operations uses this role.

2. **Trigger guard:** A `BEFORE UPDATE OR DELETE` trigger on `audit_events` raises an exception. Defense-in-depth against misconfigured connection pools or ORM bugs.

3. **Hash chaining:** Each audit event includes `prev_event_hash` containing SHA-256 of the previous event's `(id, application_id, event_type, created_at, prev_event_hash)`. First event per application uses a null sentinel hash. This enables tamper detection during audit export.

**Hash chain concurrency:** During parallel agent fan-out, multiple audit events for the same application may be written concurrently. To preserve chain integrity, audit event inserts acquire a PostgreSQL advisory lock keyed on the `application_id`. This serializes audit writes per application, guaranteeing a linear hash chain. The performance impact is negligible -- a single application generates at most ~15 audit events per workflow run, and the lock is held only for the INSERT duration. The advisory lock serialization adds a few milliseconds during parallel fan-out, which is invisible relative to the LLM call latency (seconds).

**Hash chain validation:** The Phase 5 audit trail export endpoint validates the hash chain before generating the export. If a chain break is detected, the export includes a tamper warning flag. A background validation job runs daily to detect chain breaks and alert on integrity failures.

**Audit writer connection strategy:** The `audit_writer` PostgreSQL role is used via `SET ROLE audit_writer` within the transactional connection pool, not via a separate connection pool. The transactional pool's role is granted `SET ROLE` privilege to the `audit_writer` role. This avoids a third connection pool while maintaining the INSERT-only permission restriction.

### External API Security (SSRF Prevention)

All external API URLs (FRED, BatchData, LLM providers) are configured via environment variables and validated at startup. User-supplied data (property addresses, etc.) is passed as query parameters to known-good base URLs, never concatenated into URL paths or used to construct arbitrary URLs.

---

## Caching Strategy

Redis is used for four purposes, each with distinct TTL and eviction strategies:

| Use Case | Key Pattern | TTL | Notes |
|---------|-------------|-----|-------|
| RAG query cache | `rag:query:<hash>` | 1 hour | Cache similarity search results. Invalidated on knowledge base re-index. |
| FRED API responses | `fred:<series_id>` | 1 hour | Market rates, Treasury yields, housing indices. |
| Property data responses | `property:<address_hash>` | 24 hours | Cached mock or real API responses. |
| Rate limiting | `ratelimit:<tier>:<identifier>` | Sliding window | Per-IP for public tier, per-key for protected tier. |
| Chat session tokens | `session:<session_id>` | 24 hours | Session metadata for intake chat. No PII. |

**What is NOT cached:**
- Loan application data (always from PostgreSQL)
- Audit events (always from PostgreSQL)
- Document content (always from MinIO)
- PII of any kind

**Graceful degradation:** If Redis is unavailable, the system continues with degraded performance:
- RAG queries hit PostgreSQL directly (slower but functional)
- External API calls are not cached (higher latency, higher cost)
- Chat sessions fail to create (intake agent unavailable until Redis recovers) -- **fail closed**, preventing unmetered LLM usage
- Calculator and market data endpoints fall back to in-memory rate limiting counters (acceptable -- no LLM cost exposure)
- Property data lookups to a real external API (BatchData) fail closed if rate limiting is unavailable (prevents unmetered external API costs)
- Protected-tier endpoints fall back to in-memory rate limiting counters (functional for single-instance MVP)

---

## Observability

### Structured Logging

All log output is structured JSON with the following base fields:

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 |
| `level` | error, warn, info, debug |
| `message` | Human-readable description |
| `correlationId` | Request/trace ID from `X-Request-ID` header |
| `service` | `api`, `loan-graph`, `intake-graph` |

Additional context fields added per log entry: `userId`, `operation`, `durationMs`, `statusCode`, `agentName`, `applicationId`.

PII is never logged. Sensitive fields are masked: `ssn: "***-**-1234"`, auth headers: `"Authorization: Bearer [REDACTED]"`.

### Correlation ID Propagation

1. Correlation ID middleware generates a UUID for each incoming request (or uses `X-Request-ID` if provided).
2. The ID is attached to `request.state` and included in the `AuthContext`.
3. All service-layer log entries, audit events, and downstream calls include the correlation ID.
4. LangGraph graph invocations receive the correlation ID as part of the config/metadata, propagating it through all agent nodes.

### LangFuse Integration

LangFuse is integrated via callback handlers on LLM client calls:

- Each LangGraph node execution creates a LangFuse trace with the correlation ID
- Each LLM call within a node creates a span with: model name, token counts, latency, cost estimate
- Tool calls within the intake graph create sub-spans
- Trace metadata includes application ID, agent name, and analysis pass number

LangFuse is an optional dependency. If the `LANGFUSE_PUBLIC_KEY` environment variable is not set, the callback handlers are no-ops and the system operates without tracing. No code changes required to enable/disable.

### Health Checks

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `GET /health` | Liveness | Process is running, responds to HTTP |
| `GET /ready` | Readiness | PostgreSQL connection, Redis connection, MinIO connection |

Health endpoints are unauthenticated, unversioned (no `/v1/` prefix), and fast (no heavy computation). The readiness check performs lightweight connectivity tests (e.g., `SELECT 1` for PostgreSQL) rather than full dependency health checks.

---

## Mocked Service Architecture

### Abstraction Pattern

Mocked services use Python `Protocol` classes to define the interface contract. Both mock and real implementations conform to the same Protocol. Selection is via configuration.

```
packages/api/src/
├── contracts/                    # Protocol definitions (interface contracts)
│   ├── credit_bureau.py          # CreditBureauService Protocol
│   ├── property_data.py          # PropertyDataService Protocol
│   ├── notification.py           # NotificationService Protocol
│   └── employment_verification.py
└── services/
    ├── mocks/                    # Mock implementations
    │   ├── credit_bureau.py      # MockCreditBureau
    │   ├── property_data.py      # MockPropertyData
    │   ├── notification.py       # MockNotification (logs to console + DB)
    │   └── employment_verification.py
    └── real/                     # Real implementations (when available)
        └── property_data.py      # RealBatchDataPropertyService
```

### Swap Configuration

Each mocked service has a corresponding configuration flag:

```python
class Settings(BaseSettings):
    credit_bureau_provider: str = "mock"    # "mock" only at MVP
    property_data_provider: str = "mock"    # "mock" or "batchdata"
    property_data_api_key: str | None = None
    notification_provider: str = "mock"     # "mock" only at MVP
```

Factory functions in FastAPI dependencies read the configuration and return the appropriate implementation:

```python
def get_property_data_service(settings: Settings = Depends(get_settings)) -> PropertyDataService:
    if settings.property_data_provider == "batchdata" and settings.property_data_api_key:
        return RealBatchDataPropertyService(api_key=settings.property_data_api_key)
    return MockPropertyDataService()
```

This pattern ensures that switching from mock to real requires only a configuration change, not a code change.

---

## Deployment Architecture

### Local Development

`compose.yml` defines all infrastructure services:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    # pgvector extension pre-installed
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  langfuse:
    image: langfuse/langfuse
    ports: ["3001:3000"]
    # Optional: comment out to run without observability
```

Application services (API and UI) run directly on the host via `make dev` (not containerized in development, for hot-reload support).

**Setup flow:**
```bash
make setup    # Install Node + Python dependencies, create .env from .env.example
make dev      # Start compose services + API (uvicorn) + UI (vite dev server)
              # Runs Alembic migrations automatically on API startup
              # Loads seed data if database is empty
```

### Container Build

Podman-compatible Containerfiles for `packages/api` and `packages/ui`:

- `packages/api/Containerfile`: Multi-stage build. Installs Python deps with uv, copies source, runs uvicorn.
- `packages/ui/Containerfile`: Multi-stage build. Installs Node deps with pnpm, builds with Vite, serves with nginx.

### Helm / OpenShift

`deploy/helm/` contains Helm charts for OpenShift deployment:

- Deployments for: API, UI, PostgreSQL (with pgvector), Redis, MinIO
- ConfigMaps for non-secret configuration
- Secrets for: database credentials, API encryption key, LLM API keys, MinIO credentials
- Services and Routes (OpenShift equivalent of Ingress)
- Resource limits and requests
- Liveness and readiness probes pointing to `/health` and `/ready`

### Environment Configuration

| Variable | Required | Default | Description |
|---------|----------|---------|-------------|
| `DATABASE_URL` | Yes | (compose default) | PostgreSQL connection string |
| `REDIS_URL` | Yes | (compose default) | Redis connection string |
| `MINIO_ENDPOINT` | Yes | (compose default) | MinIO endpoint URL |
| `MINIO_ACCESS_KEY` | Yes | (compose default) | MinIO access credentials |
| `MINIO_SECRET_KEY` | Yes | (compose default) | MinIO secret credentials |
| `ANTHROPIC_API_KEY` | Yes (Phase 2+) | - | Claude API key |
| `OPENAI_API_KEY` | Yes (Phase 2+) | - | GPT-4 Vision API key |
| `ENCRYPTION_KEY` | Yes | - | Fernet key for PII field encryption (current key) |
| `ENCRYPTION_KEY_PREVIOUS` | No | - | Previous Fernet key for decryption during key rotation |
| `HMAC_SECRET_KEY` | Yes | - | Server-side secret for API key HMAC-SHA256 hashing |
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `LANGFUSE_PUBLIC_KEY` | No | - | LangFuse public key (optional) |
| `LANGFUSE_SECRET_KEY` | No | - | LangFuse secret key (optional) |
| `FRED_API_KEY` | No | - | FRED API key (free tier available) |
| `BATCHDATA_API_KEY` | No | - | BatchData API key (enables real property data) |

---

## Phased Implementation Mapping

The architecture supports incremental delivery across phases. Foundational components are built first; later phases add capabilities without restructuring.

### Phase 1: Foundation

**Components built:**
- FastAPI application skeleton with router structure (all endpoint groups registered, most returning 501)
- Auth middleware (key resolver + role asserter + audit injector)
- PostgreSQL schema: `api_keys`, `loan_applications`, `documents`, `audit_events` (with trigger + hash chain)
- `langgraph` schema setup (PostgresSaver configuration)
- Audit event recording service (foundational -- captures all events from day one)
- LangGraph loan processing graph skeleton with a single stub agent (proves orchestration + checkpointing)
- Correlation ID middleware
- Structured logging middleware
- Seed data (diverse test applications, development API keys with 24-hour TTL)
- `compose.yml` with PostgreSQL, Redis, MinIO
- `make setup && make dev` working end-to-end
- Basic dashboard UI: application list, application detail, status display
- Health endpoints (`/health`, `/ready`)
- Production credential hard-fail check

**What this proves:** The orchestration pattern works with persistent checkpointing. Auth is real. Audit events are captured and immutable. A developer can clone and run the system.

### Phase 2: First Real Agents

**Components added:**
- PII redaction service (operational before first LLM call)
- Document processor agent (GPT-4 Vision)
- Credit analyst agent (Claude + mocked credit bureau)
- Confidence-based routing logic in the aggregator node
- Minimal human review: review queue API (role-filtered), review action endpoint
- Document upload endpoint with file validation
- MinIO integration with SSE
- LangFuse integration (optional)
- Dashboard updates: document upload UI, agent analysis display, review queue

**Architecture note:** The minimal review queue is delivered in Phase 2 (not deferred to Phase 4) because confidence-based routing requires a destination for escalated applications. The full review workflow (request-additional-documents, cyclic resubmission) comes in Phase 4.

### Phase 3a: Full Analysis Pipeline

**Components added:**
- Risk assessor agent (Claude)
- Compliance checker agent (Claude + RAG)
- `rag` schema with knowledge documents and embeddings tables
- Knowledge base seeded with sample regulatory documents
- pgvector HNSW index
- RAG connection pool (separate from transactional pool)
- Parallel fan-out execution of all analysis agents
- Conflict detection in aggregator
- Audit trail query UI in dashboard

### Phase 3b: Public Access and Intake

**Components added:**
- Intake graph (separate LangGraph graph)
- Intake agent (Claude) with tool integrations
- Mortgage calculator module (pure computation)
- Calculator API endpoints (public tier)
- FRED API client + Redis caching
- Property data service (mock + protocol)
- Chat API with SSE streaming
- Rate limiting middleware (Redis-backed)
- Chat UI component
- Market data display

### Phase 4: Advanced Review, Fraud Detection, Coaching

**Components added:**
- Request-additional-documents workflow in review endpoint
- Cyclic resubmission (analysis_pass increment, full pipeline re-run)
- Fraud detector agent
- Denial coach agent
- `fraud_flags` table
- Dashboard updates: fraud flag display, denial coaching UI, document resubmission flow

### Phase 5: Observability, Deployment, Polish

**Components added:**
- Audit trail export endpoint
- Compliance reporting endpoints and UI
- Knowledge base management API (upload, version, re-index)
- Configurable thresholds admin UI
- LangFuse dashboard integration (if not already done)
- Cross-session chat context
- Containerfiles (API + UI)
- Helm charts
- CI pipeline configuration
- Full documentation

### Migration Strategy

Each phase adds schema via Alembic migrations. Migrations are forward-only at MVP. Seed data is additive: each phase's seeds augment rather than replace previous data, so existing test applications survive upgrades.

| Phase | New Migrations |
|-------|---------------|
| 1 | `api_keys`, `loan_applications`, `documents`, `audit_events` (with trigger + hash chain + advisory lock), `confidence_thresholds`, `langgraph` schema, seed data |
| 2 | `agent_decisions`, PII encrypted columns on `loan_applications` |
| 3a | `rag` schema, `knowledge_documents`, `knowledge_embeddings`, HNSW index |
| 3b | `intake_conversations`, `intake_messages` |
| 4 | `fraud_flags`, `review_actions` |
| 5 | `compliance_reports`, reporting indexes |

---

## Architecture Decision Records

The following decisions are significant enough to warrant formal ADRs. They are summarized here; full ADRs can be extracted to `plans/adr/` if needed during Technical Design.

### ADR-001: Persistent Checkpointing as Foundational Infrastructure

**Context:** The product plan's NFR requires workflow persistence across restarts. The stakeholder mandates LangGraph with PostgresSaver. The product plan originally had workflow persistence as a Phase 4 feature.

**Decision:** Workflow checkpointing via PostgresSaver is foundational from Phase 1. Every graph invocation is checkpointed after every node execution from the first workflow run.

**Rationale:** The mandated technology provides checkpointing as a core capability. Deferring it creates a reliability gap in Phases 1-3 where the NFR is not met. The cost of enabling it from day one is near-zero (PostgresSaver configuration).

### ADR-002: Server-Side Role Resolution for Bearer Token with HMAC-SHA256

**Context:** The stakeholder mandates `Authorization: Bearer <role>:<key>` format. All three Phase 2 reviewers flagged the privilege escalation risk of client-asserted roles. Phase 5 reviewers (Backend Developer, Security Engineer) identified that bcrypt is inappropriate for high-entropy API key hashing due to per-request latency.

**Decision:** The role prefix is a routing hint only. The server resolves the authoritative role from the API key alone. Client-supplied role mismatches are logged at `warn` level but the key's actual role is always used. Keys are hashed with HMAC-SHA256 using a server-side secret, not bcrypt.

**Rationale:** Eliminates privilege escalation while preserving the mandated format and developer ergonomics. HMAC-SHA256 is fast (microseconds) and appropriate for high-entropy API keys. The HMAC server-side secret adds a defense layer against database compromise. The key-to-role mapping is the single source of truth.

### ADR-003: Audit Trail Infrastructure from Phase 1

**Context:** Auditable events (state transitions, auth events) begin in Phase 1. The product plan originally scheduled the audit trail as a Phase 3 feature.

**Decision:** The audit event recording mechanism, append-only storage, database permission enforcement, trigger guard, and hash chaining are all delivered in Phase 1. The audit trail query UI and export are delivered in later phases.

**Rationale:** Retrofitting audit trail recording onto existing code is architecturally expensive and risks missing early events. The recording infrastructure is simple; the UI complexity comes later.

### ADR-004: Three-Schema Isolation in PostgreSQL

**Context:** The stakeholder mandates a single PostgreSQL instance with pgvector. The system has three distinct workloads: transactional (application data), vector search (RAG), and checkpoint storage (LangGraph).

**Decision:** Use three PostgreSQL schemas (`public`, `rag`, `langgraph`) with separate connection pools for transactional and RAG workloads. Each pool has independent `statement_timeout` settings.

**Rationale:** Schema isolation prevents table name collisions, enables independent access control, and combined with separate connection pools, prevents RAG vector scans from starving transactional queries.

### ADR-005: Minimal Review Queue in Phase 2

**Context:** Confidence-based routing starts in Phase 2, which means escalated applications need a destination. The full human review workflow (request-additional-documents, cyclic resubmission) is a Phase 4 feature.

**Decision:** Deliver a minimal review queue in Phase 2: view escalated applications with all agent analyses, approve or deny. Request-additional-documents and cyclic resubmission are Phase 4.

**Rationale:** Without a review queue, escalated applications in Phases 2-3 have nowhere to go. The minimal version (approve/deny) is low-cost and resolves the phasing dependency.

### ADR-006: Intake Agent Sandboxing

**Context:** The intake agent is public-facing (no authentication). A successful prompt injection attack on the intake agent must not compromise application data.

**Decision:** The intake graph is architecturally isolated: separate LangGraph graph, explicit tool allowlist (calculator, FRED, property data, knowledge base), no code path to application data, separate connection pool scoped to the `rag` schema only.

**Rationale:** Architectural isolation is stronger than runtime guards. The intake agent literally cannot access application data because it has no reference to the transactional connection pool or application service modules.

---

## Issues Found in Upstream Artifacts

The following product plan inconsistencies were identified during architecture design. These were flagged in the Phase 2 reviews and resolved in the updated product plan; this section confirms how the architecture addresses each resolution.

1. **Human review phasing (Architect C-1):** Resolved by delivering a minimal review queue in Phase 2 (ADR-005). The product plan was updated to split human review into Phase 2 (minimal: approve/deny) and Phase 4 (advanced: request-additional-documents, cyclic resubmission).

2. **Audit trail phasing (Architect C-2):** Resolved by making audit trail infrastructure foundational in Phase 1 (ADR-003). The product plan was updated to specify "foundational event recording mechanism and append-only storage from day one" in Phase 1.

3. **Workflow persistence phasing (Orchestrator O-C1):** Resolved by making persistent checkpointing foundational in Phase 1 (ADR-001). The stakeholder-mandated LangGraph/PostgresSaver provides this capability at near-zero incremental cost.

4. **Auth token privilege escalation (three-way convergence):** Resolved by server-side role resolution (ADR-002). The product plan was updated to clarify: "The role prefix is a routing hint only -- the server maintains the authoritative key-to-role mapping."

5. **Data-at-rest encryption (Security C-2):** Addressed in the Security Architecture section with field-level Fernet encryption for PII, MinIO SSE for documents, and explicit scoping of Redis to non-PII data only.

6. **PII redaction timing (Security W-1):** Addressed by making the PII redaction service operational from Phase 2 (the first phase with real LLM calls). It is a required dependency for all agent nodes.

7. **Phase 3 overload (Architect W-3, Orchestrator O-W1):** Addressed by splitting Phase 3 into 3a (full analysis pipeline + audit query UI) and 3b (public access + intake). These can be executed in parallel or sequentially depending on team capacity.

---

## Open Questions

The following architecture-level questions need resolution during Technical Design:

1. **Embedding model selection for RAG.** The architecture specifies `VECTOR(1536)` dimension (matching OpenAI `text-embedding-ada-002`). If a different embedding model is chosen, the dimension and index configuration need adjustment. The Technical Design should confirm the embedding model.

2. **Seed data composition.** How many test applications, what distribution of outcomes (approved, denied, escalated, fraud-flagged, processing-error), and how many documents per application. This affects both the seed data script and the demo experience.

3. **Knowledge base initial content.** What regulatory documents and guidance should be included for the compliance checker's RAG knowledge base. A curated set is needed before Phase 3a.

4. **Redis cache invalidation on knowledge base update.** When the knowledge base is re-indexed (Phase 5 feature), cached RAG query results become stale. The Technical Design should specify whether cache invalidation is eager (flush `rag:query:*` keys on re-index) or lazy (TTL-based expiry).

5. **LLM cost controls.** The architecture specifies rate limiting for public-tier LLM-invoking endpoints. The Technical Design should define specific rate limits (requests per minute per IP) and whether there is a per-session or per-day cost cap for intake chat.

6. **Incremental document resubmission (Phase 4 P2 optimization).** The Phase 4 basic behavior re-runs the full pipeline on document resubmission. The P2 optimization resumes mid-pipeline. The Technical Design should specify how LangGraph state is manipulated to skip completed agents -- whether by modifying the state before re-invocation or by adding conditional logic to each agent node.
