<!-- This project was developed with assistance from AI tools. -->

# Requirements: Multi-Agent Mortgage Loan Processing System

## Overview

This requirements document provides the complete specification for an AI-powered mortgage loan processing system built as a developer quickstart on the Red Hat AI Quickstart template. The system serves three distinct audiences: AI developers learning multi-agent patterns, loan officers processing applications, and borrowers exploring mortgage options.

User stories are organized by feature area with detailed Given/When/Then acceptance criteria. Each story has a unique ID and is prioritized (P0 = Must Have, P1 = Should Have, P2 = Could Have).

### Document Structure

The detailed story specifications are organized into four chunk documents by feature area. This master document provides the story map index, cross-cutting requirements, merged non-functional requirements, open questions, assumptions, and coverage validation. The chunk documents contain the full Given/When/Then acceptance criteria for every story.

| Chunk | File | Stories | ACs | Feature Areas |
|-------|------|---------|-----|---------------|
| 1 | [requirements-chunk-1-foundation.md](requirements-chunk-1-foundation.md) | 26 | 157 | AUTH, AUDIT, PII, CHECKPOINT, DX, OBS |
| 2 | [requirements-chunk-2-core-workflow.md](requirements-chunk-2-core-workflow.md) | 25 | 121 | APP, DOC, PIPE (core), REV (minimal) |
| 3 | [requirements-chunk-3-public-tier.md](requirements-chunk-3-public-tier.md) | 17 | 58 | CHAT, CALC, MARKET |
| 4 | [requirements-chunk-4-extensions-admin.md](requirements-chunk-4-extensions-admin.md) | 25 | 127 | PIPE (ext), REV (adv), THRESHOLD, KB, COMPLIANCE, AUDIT (ext), OBS (ext), DEPLOY, CHAT (ext) |
| **Total** | | **93** | **463** | |

> **Note:** DX-05 (Quickstart Tutorial Guide) is listed in the story map but detailed ACs are deferred. Total including DX-05: 94 stories.

### How to Use This Document

- **Master document (this file):** Use for the story map index, cross-cutting concerns, dependency analysis, phase planning, and reconciled open questions/assumptions. The story map is the authoritative source for story IDs, priorities, and phase assignments.
- **Chunk files:** Use for the full Given/When/Then acceptance criteria when implementing or testing a specific story. Each chunk contains all the detail needed for its stories.
- **When a story spans chunks** (e.g., DOC stories in chunks 2 and 4, AUDIT stories in chunks 1 and 4), both chunk files must be consulted.
- **Intake Agent Isolation and Safety** is documented as a cross-cutting section in Chunk 3 (not a numbered story). It applies to all CHAT stories.
- **Rate limiting** acceptance criteria are specified in Chunk 3 cross-cutting sections (20 req/min for CHAT, 60 req/min for CALC/MARKET) and in individual story ACs (CHAT-01 AC-5, CALC-01 AC-6, MARKET-01 AC-7). AUTH-08 covers API key expiration, not rate limiting middleware. A dedicated rate limiting story may be added during Technical Design.

---

## Conventions

### Financial Precision

All monetary values are stored as integer cents in the database and serialized as string decimals in API JSON responses (e.g., `"loanAmount": "250000.00"`). Interest rates and ratios are also serialized as strings (e.g., `"interestRate": "6.875"`). No floating-point arithmetic is used for financial calculations.

### Cross-Cutting Prerequisites

All protected endpoints require valid authentication (AUTH-01 through AUTH-08). All state transitions and significant actions generate audit events (AUDIT-01 through AUDIT-03). These cross-cutting concerns are specified in the Foundation stories (Chunk 1) and apply to every story in Chunks 2-4.

### Response Envelope

All API endpoints follow the project response conventions:
- Success (single): `{ "data": { ... } }`
- Success (collection): `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true/false } }`
- Error: RFC 7807 Problem Details format
- SSE: `Content-Type: text/event-stream` (chat streaming only)

---

## Story Map

### Application Lifecycle (APP) -- Chunk 2

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| APP-01 | Create a New Loan Application | P0 | 1 |
| APP-02 | List All Applications with Current Status | P0 | 1 |
| APP-03 | View Single Application Details | P0 | 1 (basic), 2+ (analyses) |
| APP-04 | Submit a Draft Application for Processing | P0 | 1 (transition), 2 (pipeline) |
| APP-05 | Application Status Transitions | P0 | 1 |
| APP-06 | Withdraw an Application | P0 | 1 |
| APP-07 | Retry a Failed Application | P0 | 1 (transition), 2 (retry) |

### Document Management (DOC) -- Chunks 2, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| DOC-01 | Upload Supporting Documents | P0 | 1 | 2 |
| DOC-02 | Document Validation on Upload | P0 | 1 | 2 |
| DOC-03 | Download a Document | P0 | 1 | 2 |
| DOC-04 | List Documents for an Application | P0 | 1 | 2 |
| DOC-05 | Additional Document Request and Resubmission | P0 | 4 | 4 |

### Agent Analysis Pipeline (PIPE) -- Chunks 2, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| PIPE-01 | Document Processing Agent | P0 | 2 | 2 |
| PIPE-02 | Document Data Extraction | P0 | 2 | 2 |
| PIPE-03 | Credit Analysis Agent | P0 | 2 | 2 |
| PIPE-04 | Risk Assessment Agent | P0 | 3a | 2 |
| PIPE-05 | Compliance Checker Agent | P0 | 3a | 2 |
| PIPE-06 | Aggregator/Router Agent | P0 | 2 | 2 |
| PIPE-07 | Workflow Checkpoint Strategy | P0 | 2 | 2 |
| PIPE-08 | Agent Prompt Governance | P1 | 2 | 2 |
| PIPE-09 | Agent Audit Trail | P0 | 2 | 2 |
| PIPE-10 | Parallel Agent Execution | P0 | 2 | 2 |
| PIPE-11 | Fraud Detection | P1 | 4 | 4 |
| PIPE-12 | Denial Coaching | P1 | 4 | 4 |
| PIPE-13 | Incremental Resubmission Analysis | P2 | 4 | 4 |

### Human Review (REV) -- Chunks 2, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| REV-01 | Review Queue | P0 | 2 | 2 |
| REV-02 | View Escalated Application with Agent Analyses | P0 | 2 | 2 |
| REV-03 | Approve an Escalated Application | P0 | 2 | 2 |
| REV-04 | Deny an Escalated Application | P0 | 2 | 2 |
| REV-05 | Request Additional Documents | P0 | 4 | 4 |
| REV-06 | Document Resubmission Cycle | P0 | 4 | 4 |
| REV-07 | Review Priority Scoring | P2 | 4 | 4 |

### Public Tier -- Intake Chat (CHAT) -- Chunks 3, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| CHAT-01 | Create and Use Chat Session | P1 | 3b | 3 |
| CHAT-02 | Plain Language Mortgage Explanations | P1 | 3b | 3 |
| CHAT-03 | Source Citations in Responses | P1 | 3b | 3 |
| CHAT-04 | Real-Time Rate Information | P1 | 3b | 3 |
| CHAT-05 | Property Information Lookup | P1 | 3b | 3 |
| CHAT-06 | Mortgage Calculator Tool Use in Chat | P1 | 3b | 3 |
| CHAT-07 | Streaming Chat Responses (SSE) | P1 | 3b | 3 |
| CHAT-08 | Cross-Session Chat Context | P2 | 5 | 4 |
| CHAT-09 | Chat Sentiment Analysis | P2 | 5 | 4 |

### Public Tier -- Mortgage Calculator (CALC) -- Chunk 3

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| CALC-01 | Calculate Monthly Payment | P1 | 3b |
| CALC-02 | Generate Amortization Schedule | P1 | 3b |
| CALC-03 | DTI Ratio Preview | P1 | 3b |
| CALC-04 | Affordability Estimate | P1 | 3b |
| CALC-05 | Scenario Comparison | P1 | 3b |
| CALC-06 | Input Validation with Helpful Errors | P1 | 3b |
| CALC-07 | Financial Precision Guarantees | P1 | 3b |
| CALC-08 | Calculator with Live Rates | P2 | 3b |

### Public Tier -- Market Data (MARKET) -- Chunk 3

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| MARKET-01 | Current Rate Display with FRED Integration | P1 | 3b |
| MARKET-02 | Historical Rate Trends | P2 | 3b |

### Authentication and RBAC (AUTH) -- Chunk 1

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| AUTH-01 | Require Authentication for All Protected Endpoints | P0 | 1 |
| AUTH-02 | Provision API Keys | P0 | 1 |
| AUTH-03 | Revoke API Keys | P0 | 1 |
| AUTH-04 | List Active API Keys | P0 | 1 |
| AUTH-05 | Role-Based Access Control | P0 | 1 |
| AUTH-06 | Role Hierarchy | P0 | 1 |
| AUTH-07 | Seed Key Bootstrapping | P0 | 1 |
| AUTH-08 | API Key Expiration | P0 | 1 |

### Audit Trail (AUDIT) -- Chunks 1, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| AUDIT-01 | State Transition Events | P0 | 1 | 1 |
| AUDIT-02 | Agent Decision Events | P0 | 1 | 1 |
| AUDIT-03 | Audit Event Immutability | P0 | 1 | 1 |
| AUDIT-04 | Query Audit Events for an Application | P0 | 1 | 1 |
| AUDIT-05 | Audit Trail Export | P2 | 4 | 4 |
| AUDIT-06 | Hash Chain Validation on Export | P2 | 4 | 4 |

### Compliance Reporting (COMPLIANCE) -- Chunk 4

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| COMPLIANCE-01 | Adverse Action Notice Data | P1 | 3a |
| COMPLIANCE-02 | Fair Lending Summary Report | P2 | 4 |
| COMPLIANCE-03 | HMDA-Like Data Collection | P2 | 4 |

### Knowledge Base Management (KB) -- Chunk 4

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| KB-01 | Upload Knowledge Base Documents | P2 | 5 |
| KB-02 | Knowledge Base Versioning | P2 | 5 |
| KB-03 | Knowledge Base Search/Query | P2 | 5 |

### Threshold Configuration (THRESHOLD) -- Chunk 4

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| THRESHOLD-01 | View Current Threshold Configuration | P2 | 5 |
| THRESHOLD-02 | Update Threshold Configuration | P2 | 5 |
| THRESHOLD-03 | Threshold Safety Constraints | P2 | 5 |

### PII Protection (PII) -- Chunk 1

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| PII-01 | Encrypt PII at Rest | P0 | 1 |
| PII-02 | Mask PII in API Responses | P0 | 1 |
| PII-03 | PII Isolation in Agent Prompts | P0 | 2 |
| PII-04 | PII Audit and Compliance | P0 | 1 |

### Workflow Persistence (CHECKPOINT) -- Chunk 1

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| CHECKPOINT-01 | Save Workflow State After Each Agent | P0 | 1 |
| CHECKPOINT-02 | Resume Workflow from Last Checkpoint | P0 | 1 |
| CHECKPOINT-03 | Checkpoint Cleanup | P0 | 1 |

### Developer Experience (DX) -- Chunk 1

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| DX-01 | Seed Data Loading | P0 | 1 |
| DX-02 | One-Command Local Development | P0 | 1 |
| DX-03 | API Documentation (OpenAPI) | P0 | 1 |
| DX-04 | Architecture Documentation with System Diagram | P0 | 1 |
| DX-05 | Quickstart Tutorial Guide | P1 | 5 |

### Observability (OBS) -- Chunks 1, 4

| Story | Title | Priority | Phase | Chunk |
|-------|-------|----------|-------|-------|
| OBS-01 | Correlation ID Generation | P0 | 1 | 1 |
| OBS-02 | Correlation ID Propagation | P0 | 1 | 1 |
| OBS-03 | Structured Logging | P0 | 1 | 1 |
| OBS-04 | LangFuse Tracing Integration | P2 | 5 | 4 |

### Deployment (DEPLOY) -- Chunk 4

| Story | Title | Priority | Phase |
|-------|-------|----------|-------|
| DEPLOY-01 | Containerized Application | P2 | 5 |
| DEPLOY-02 | Helm Chart for OpenShift/Kubernetes | P2 | 5 |
| DEPLOY-03 | Health Check Endpoints | P0 | 1 |
| DEPLOY-04 | CI Pipeline | P2 | 5 |

---

## Complete Data Flow: Happy Path

This section traces the complete data flow for a successful loan application processed through the multi-agent pipeline, cross-referencing each step to the stories above.

1. **Maria authenticates** with her `loan_officer` API key (AUTH-01, AUTH-05)
2. **Create application** -- POST `/v1/applications` with borrower info and loan terms. Application created in `draft` status. SSN encrypted at rest. Audit event: `state_transition (null -> draft)`. (APP-01)
3. **Upload documents** -- POST `/v1/applications/:id/documents` (multipart) for each document. File validated for type (magic bytes) and size (<20MB). Stored in MinIO with UUID key + SSE. Document record created with `processing_status: pending`. Audit event: `document_upload`. (DOC-01, DOC-02)
4. **Submit application** -- PATCH `/v1/applications/:id` with `status: submitted`. Transitions to `submitted` then `processing`. Audit events for both transitions. Background workflow invocation enqueued. (APP-04, APP-05)
5. **Document Processing** -- For each document: fetch from MinIO, classify type via GPT-4 Vision (PII redacted from prompt context), extract structured data with per-field confidence, update document record. Checkpoint after completion. Audit event per document. (PIPE-01, PIPE-02, PIPE-08, PIPE-09, PIPE-07)
6. **Progressive Fan-Out** -- Phase 2: credit analyst only. Phase 3a: credit analyst, risk assessor, and compliance checker run concurrently. Each follows the 7-step pattern. Each records agent_decision audit event. Each checkpointed. (PIPE-03, PIPE-04, PIPE-05, PIPE-10, PIPE-07, PIPE-08, PIPE-09)
7. **Aggregation + Routing** -- Aggregator loads thresholds from DB, evaluates routing rules in priority order. Records routing_decision audit event. Checkpoint. (PIPE-06, PIPE-07, PIPE-09)
8. **Route A: Auto-Approve** -- All confidence >=0.85, no conflicts. Application status -> `approved`. Audit event: `state_transition (processing -> approved)`. (PIPE-06 AC-4, APP-05)
9. **Route B: Escalate** -- Confidence below threshold or conflict detected. Application status -> `awaiting_review`. Appears in review queue filtered by role. (PIPE-06 AC-5, REV-01)
10. **Human Review** -- Reviewer opens application, sees all agent analyses side by side. Makes decision with rationale. (REV-02, REV-03 or REV-04)
11. **Approve** -- Status -> `approved`. Review action recorded. Audit event: `human_review`. (REV-03, APP-05)
12. **Deny** -- Status -> `denied`. Review action recorded. Audit event: `human_review`. Denial coaching triggered (Phase 4). (REV-04, APP-05, PIPE-12)

---

## Application Status State Machine

```
                    +-----------+
                    |   draft   |
                    +-----+-----+
                          |
                    submit (user)
                          |
                    +-----v-----+
                    | submitted |-----> withdrawn (user)
                    +-----+-----+
                          |
                    enqueue (system)
                          |
                    +-----v------+
                    | processing |
                    +--+---+---+-+
                       |   |   |
          auto-approve |   |   | agent failure
          (system)     |   |   | (system)
                       |   |   |
               +-------+   |   +--------+
               |            |            |
        +------v---+  +----v-------+ +--v-----------+
        | approved |  | awaiting   | | processing   |
        +----------+  | _review    | | _error       |
                       +--+--+--+--+ +------+-------+
                          |  |  |           |
              approve     |  |  | withdraw  | retry (user)
              (reviewer)  |  |  | (user)    |
                          |  |  |           |
                   +------+  |  +----+  +---+
                   |         |       |  |
            +------v---+  +--v---+ +-v--v------+
            | approved |  |denied| | processing|
            +----------+  +-----+ +-----------+
                                     (re-enters)

Terminal states: approved, denied, withdrawn
```

Valid transitions:
- `draft` -> `submitted` (user action: submit)
- `draft` -> `withdrawn` (user action: withdraw)
- `submitted` -> `processing` (system action: workflow enqueued)
- `submitted` -> `withdrawn` (user action: withdraw)
- `processing` -> `approved` (system action: auto-approve on high confidence)
- `processing` -> `awaiting_review` (system action: escalation)
- `processing` -> `processing_error` (system action: agent failure)
- `awaiting_review` -> `approved` (user action: reviewer approves)
- `awaiting_review` -> `denied` (user action: reviewer denies)
- `awaiting_review` -> `withdrawn` (user action: withdraw)
- `processing_error` -> `processing` (user action: retry)

Phase 4 additions (not in Phase 2):
- `awaiting_review` -> `awaiting_documents` (reviewer requests docs)
- `awaiting_documents` -> `processing` (borrower resubmits)

---

## Confidence-Based Routing Rules

The aggregator/router (PIPE-06) evaluates these rules in priority order:

| Priority | Rule | Condition | Action |
|----------|------|-----------|--------|
| 1 | Fraud flag | Any agent set `fraud_flag: true` | Route to `awaiting_review` (senior_underwriter only) |
| 2 | Agent conflict | Agents disagree (one approve, one deny) | Route to `awaiting_review` |
| 3 | Low confidence | Any agent confidence < 0.60 | Route to `awaiting_review` |
| 4 | Medium confidence | All agents >= 0.60 but any < 0.85 | Route to `awaiting_review` |
| 5 | High confidence | All agents >= 0.85, no conflicts | Auto-approve |

Confidence thresholds are configurable via THRESHOLD-01/02/03.

---

## Cross-Feature Dependencies

### Sequential Dependencies

1. AUTH-01 -> All protected endpoints (everything except public tier)
2. AUDIT-01/02/03 -> All state transitions and agent decisions
3. PII-01 -> APP-01 (SSN encryption on create)
4. APP-01 -> DOC-01 (documents belong to applications)
5. DOC-01/02 -> APP-04 (submission requires documents)
6. APP-04 -> PIPE-01 (pipeline triggered by submission)
7. PIPE-01/02 -> PIPE-03/04/05 (extraction before analysis)
8. PIPE-03/04/05 -> PIPE-06 (analysis before aggregation)
9. PIPE-06 -> REV-01 (escalation creates review queue entries)
10. KB-01/02 -> CHAT-03 (knowledge base required for citations)

### Parallel Execution Points

1. PIPE-03, PIPE-04, PIPE-05 run concurrently (progressive fan-out: Phase 2 credit-only, Phase 3a adds risk + compliance)
2. CHAT, CALC, MARKET feature areas are independent of each other
3. DX-01 through DX-05 are independent of feature implementation
4. DEPLOY-01 through DEPLOY-04 are independent of each other

---

## Non-Functional Requirements (Merged)

### Authentication & Security
- API key validation (HMAC-SHA256 hash + DB lookup) must add minimal overhead. Target: under 10ms per request for auth middleware. (Chunk 1)
- Fernet encryption/decryption of PII fields must not noticeably delay API responses. Target: under 1ms per field operation. (Chunk 1)
- All administration endpoints require `reviewer` role authorization. (Chunk 4)
- Knowledge base uploads are validated for file type and size, consistent with document upload security controls. (Chunk 4)
- No PII is collected by public-tier endpoints. (Chunk 3)
- Chat input has prompt injection defenses via system prompt and sandboxing. (Chunk 3)

### Performance & Responsiveness
- Audit event inserts (advisory lock + hash computation + INSERT) must not noticeably delay API responses. (Chunk 1)
- Structured JSON logging middleware must not become a bottleneck. (Chunk 1)
- Chat responses begin streaming within a conversational pause (perceived latency before first token). (Chunk 3)
- Calculator responses return without noticeable delay (pure computation, no LLM). (Chunk 3)
- Market data responses return without noticeable delay (served from cache). (Chunk 3)
- Health check endpoints respond sub-second. (Chunk 4)
- CI pipeline provides feedback within a reasonable time. (Chunk 4)

### Reliability
- Checkpoint data per workflow is bounded. 30-day cleanup (CHECKPOINT-03) prevents unbounded growth. (Chunk 1)
- Chat sessions persist for 24 hours from creation. (Chunk 3)
- Calculator endpoints are stateless with no external failure dependencies. (Chunk 3)
- Market data degrades gracefully when FRED API is unavailable (serve stale cache or 503). (Chunk 3)
- If Redis is unavailable, chat sessions cannot be created (fail closed), but calculator continues. (Chunk 3)
- Fraud detection and denial coaching failures do not block the main workflow. (Chunk 4)
- Incremental resubmission falls back to full re-run on ambiguity. (Chunk 4)

### Auditability
- All threshold changes, knowledge base operations, compliance reports, and audit exports are recorded as audit events with the same immutability guarantees (INSERT-only, trigger guard, hash chain). (Chunk 4)

---

## Architecture Consistency Notes

During the writing of these requirements, the following observations were made about upstream documents. These should be addressed in Technical Design.

1. **Review queue sorting:** The specification requires "sort by escalation time (oldest first)." The architecture's index on `loan_applications (status, created_at)` supports this, but requires an additional column or derived value for escalation time. The `updated_at` column serves this purpose since the transition to `awaiting_review` updates it. Confirm in Technical Design.

2. **Document upload status constraint:** Documents can only be uploaded to `draft` applications (DOC-01 AC-3). Phase 4 extends this to `awaiting_documents` status (REV-05/REV-06). Consistent with the architecture's data flow.

3. **Fraud flag routing in Phase 2:** PIPE-06 AC-1 rule 1 references fraud flags, but the fraud detector (PIPE-11) is Phase 4. In Phases 2-3, fraud flags can only arise from seed data. The routing rule should be present from Phase 2 (simple conditional logic) even though no agent produces fraud flags until Phase 4.

4. **Compliance checker parallel timing:** The architecture shows compliance checker running in parallel with credit and risk, but PIPE-05 AC-1 references "all agent results." If it runs in parallel, it would not have credit/risk results. The compliance checker should use document extraction results and application record data -- not credit/risk agent outputs. Full aggregation happens in the aggregator (PIPE-06). Technical Design should clarify exact inputs available to compliance checker at execution time.

---

## Open Questions (Merged)

### From Chunk 1 (Foundation)

1. **Audit event hash chain for system-level events:** The architecture specifies hash chaining per application. System-level audit events (e.g., auth failures not tied to an application) need a defined hash chain strategy. AUDIT-03 AC-8 proposes a null sentinel, meaning system events are not chain-linked to each other. Is a separate system-level hash chain needed?

2. **Self-revocation prevention:** AUTH-03 AC-5 adds a safeguard preventing a reviewer from revoking their own key. This prevents accidental lockout but is not explicitly stated in upstream documents. Confirm this is desired.

### From Chunk 2 (Core Workflow)

3. **Escalation timestamp tracking:** Should the system track a dedicated `escalated_at` timestamp for review queue sorting, or is `updated_at` sufficient? Using `updated_at` is simpler but could be overwritten by other updates while in `awaiting_review` status.

4. **Document upload limit per application:** Is there a maximum number of documents per application? A reasonable default (e.g., 25 documents) would prevent abuse.

5. **Reviewer self-review prevention:** Can the loan officer who created/submitted an application also review it if escalated? Production lending typically prohibits this (separation of duties). For MVP/quickstart, this constraint may be relaxed.

### From Chunk 3 (Public Tier)

6. **Stale cache policy for FRED data:** When the FRED API is unavailable and the 1-hour cache TTL has expired, should stale data be served with a staleness indicator, or return 503? Current ACs suggest serving stale when available (MARKET-01 AC-4), but may need a configurable stale TTL (e.g., up to 24 hours, then 503).

7. **Chat session storage model:** The architecture mentions `intake_conversations` and `intake_messages` tables alongside Redis session metadata and LangGraph state. The exact split between Redis (session token/metadata) and PostgreSQL (conversation history) should be confirmed in Technical Design.

8. **Calculator endpoint structure:** Whether DTI preview (CALC-03) and scenario comparison (CALC-05) are separate endpoints, parameters on existing endpoints, or client-side compositions is a Technical Design decision.

### From Chunk 4 (Extensions & Admin)

9. **Fraud detection sensitivity defaults:** Specific default sensitivity values and configurable parameters (income discrepancy threshold %, property flip time window) should be determined in Technical Design.

10. **Knowledge base re-indexing strategy:** Whether re-indexing invalidates Redis RAG cache eagerly (flush on re-index) or lazily (TTL-based expiry) is a Technical Design decision.

11. **Review priority score weights:** The specific formula and weights for computing review priority scores (REV-07) are Technical Design details.

12. **CI platform selection:** The specific CI platform (GitHub Actions, GitLab CI, etc.) is not specified and should be determined in Technical Design.

---

## Assumptions (Merged)

### Foundation (Chunk 1)
1. HMAC-SHA256 for API key hashing confirmed by architecture (ADR-002).
2. Fernet encryption for PII fields confirmed by architecture.
3. PostgresSaver for LangGraph checkpointing confirmed by architecture (ADR-001).
4. Advisory lock for audit hash chain concurrency confirmed by architecture.
5. `SET ROLE audit_writer` connection strategy confirmed by architecture.
6. 24-hour seed key TTL confirmed by product plan and architecture.
7. 12 test applications in seed data is the agreed default.
8. Rate limits (60/20/120 req/min) apply to public and protected tiers; rate limiting acceptance criteria are in Chunk 3 cross-cutting sections and individual story ACs. AUTH-08 covers API key expiration (TTL), not rate limiting middleware.

### Core Workflow (Chunk 2)
9. Application ID used as LangGraph thread ID is a UUID, ensuring uniqueness and compatibility.
10. `processing_error` -> `processing` retry uses the same analysis pass number; `analysis_pass` only increments on document resubmission (Phase 4).
11. Credit bureau mock is deterministic per application ID for reproducible test scenarios.
12. Phase 2 delivers minimal review queue (approve/deny only). Request-additional-documents is Phase 4.
13. Compliance checker evaluates fair lending based on document extraction data and application record, not credit/risk agent outputs.

### Public Tier (Chunk 3)
14. Knowledge base (RAG infrastructure) from Phase 3a is available before CHAT-03 (source citations) can be fully tested.
15. FRED API access (free tier API key) is available for development and testing.
16. Mock property data service provides sufficient fixture data for testing CHAT-05.
17. 24-hour chat session TTL is absolute from creation time, not sliding.
18. Intake agent's system prompt and tool definitions are sufficient to enforce plain language responses and source citation behavior.

### Extensions & Admin (Chunk 4)
19. Fraud detection is best-effort for MVP -- demonstrates the pattern, not production-grade accuracy.
20. Knowledge base content is demonstrative (sample ECOA, Fair Housing Act, TILA, RESPA excerpts).
21. Audit export format is JSON; PDF/human-readable formats are out of scope for P2.
22. Cross-session chat uses session tokens (cookies/local storage) since public tier users are unauthenticated.
23. Sentiment analysis uses the intake agent's LLM, not a separate ML model.

---

## Coverage Validation

### Product Plan Features -> Story Coverage

| Feature | Stories | Phase |
|---------|---------|-------|
| Multi-agent pipeline (LangGraph) | PIPE-01 through PIPE-13 | 2, 3a, 4 |
| Document classification + extraction (GPT-4V) | PIPE-01, PIPE-02 | 2 |
| Credit analysis | PIPE-03 | 2 |
| Risk assessment | PIPE-04 | 2 |
| Compliance checking | PIPE-05, COMPLIANCE-01/02/03 | 3a, 4 |
| Confidence-based routing | PIPE-06, THRESHOLD-01/02/03 | 2, 3a |
| Fraud detection (optional) | PIPE-11 | 4 |
| Denial coaching | PIPE-12 | 4 |
| Incremental resubmission | PIPE-13 | 4 |
| Application lifecycle (CRUD + status) | APP-01 through APP-07 | 1, 2 |
| Document management | DOC-01 through DOC-05 | 1, 4 |
| Human review workflow | REV-01 through REV-07 | 2, 4 |
| API key auth + RBAC | AUTH-01 through AUTH-08 | 1 |
| Audit trail (immutable, hash chain) | AUDIT-01 through AUDIT-06 | 1, 4 |
| PII protection (encrypt, mask, isolate) | PII-01 through PII-04 | 1, 2 |
| Workflow persistence (checkpoint/resume) | CHECKPOINT-01 through CHECKPOINT-03 | 1 |
| Intake chat (public) | CHAT-01 through CHAT-09 | 3b, 5 |
| Mortgage calculator (public) | CALC-01 through CALC-08 | 3b |
| Market data (FRED integration) | MARKET-01, MARKET-02 | 3b |
| Knowledge base (RAG) | KB-01 through KB-03 | 5 |
| Configurable thresholds | THRESHOLD-01 through THRESHOLD-03 | 5 |
| Developer experience | DX-01 through DX-05 | 1, 5 |
| Observability | OBS-01 through OBS-04 | 1, 5 |
| Deployment | DEPLOY-01 through DEPLOY-04 | 1, 5 |

### Phase Breakdown

| Phase | Description | P0 Stories | P1 Stories | P2 Stories | Total |
|-------|-------------|------------|------------|------------|-------|
| 1 | Foundation + Application Lifecycle + Health Checks | 37 | 0 | 0 | 37 |
| 2 | Agent Pipeline + Review Queue | 12 | 1 | 0 | 13 |
| 3a | Compliance + Risk Assessment | 2 | 1 | 0 | 3 |
| 3b | Public Tier (Chat + Calculator + Market) | 0 | 15 | 2 | 17 |
| 4 | Extensions (Fraud, Coaching, Resubmission, Review) | 3 | 2 | 6 | 11 |
| 5 | Polish (KB, Thresholds, Containers, Helm, CI, Tutorial) | 0 | 1 | 12 | 13 |
| **Total** | | **54** | **20** | **20** | **94** |

---

## Phase Delivery Summary

### Phase 1: Foundation + Application Lifecycle
Core infrastructure: authentication, RBAC, API key expiration, audit trail (including audit event querying), PII encryption, structured logging, correlation IDs, health check endpoints, workflow checkpoint infrastructure. Application CRUD with status state machine. Document upload/download/validation. Seed data (including KB regulatory excerpts and default thresholds). OpenAPI spec. Architecture documentation.

### Phase 2: Agent Pipeline + Human Review
LangGraph workflow: document processing, credit analysis (single-agent fan-out), aggregation/routing with hardcoded thresholds from seed data, checkpoint/resume. Human review queue with approve/deny. Agent audit trail. Prompt governance. PII isolation in agent prompts.

### Phase 3a: Risk + Compliance Expansion
Risk assessment agent and compliance checker join the pipeline (progressive fan-out expands to 3 concurrent agents). Compliance checker uses document extraction + application data (not credit/risk outputs) plus RAG against seeded knowledge base. Adverse action notice data generation.

### Phase 3b: Public Access + Intake
Public-facing chat (SSE streaming, source citations, rate information, property lookup, calculator tool use, agent isolation). Mortgage calculator (monthly payment, amortization, DTI, affordability, comparison). Market data (FRED integration, historical trends).

### Phase 4: Extensions + Administration
Fraud detection (optional agent). Denial coaching. Incremental resubmission. Advanced review (document request cycle with resubmission, priority scoring). Compliance reporting (fair lending, HMDA-like). Audit export with hash chain validation.

### Phase 5: Polish + Deployment
Knowledge base management UI (upload, versioning, search). Configurable threshold management UI. Containerized application. Helm chart for OpenShift/Kubernetes. CI pipeline. Quickstart tutorial guide. LangFuse tracing integration. Cross-session chat context. Sentiment analysis.

### Deferred Items (Noted for Technical Design)

The following items were identified during requirements review but deferred to Technical Design or future story creation:

- **Loan Processing Dashboard UI stories:** The product plan lists a P0 "Loan processing dashboard" with application list, detail views, review queue filtering, and workflow progress visualization. These are fully covered by API stories (APP-02, APP-03, REV-01, REV-02) but have no UI-specific stories. The Technical Design should note that the dashboard implements these APIs and define any UI-specific acceptance criteria as needed.
- **Workflow progress polling:** No story defines what endpoint the UI polls for workflow progress, what data it returns (current step, completion percentage), or when to stop polling. Add as ACs on APP-03 or a dedicated story during Technical Design.
- **Email notification mock:** The product plan lists an email notification mock that "logs 'email sent' events." No story specifies when notifications trigger or what they contain. Add during Technical Design if needed.
- **Compliance officer search filters:** Product plan Flow 2 describes searching applications by date range and decision type. APP-02 supports status filtering but not date range or decision type. Consider extending APP-02 or adding a search story during Technical Design.
- **Rate limiting middleware story:** AUTH-08 covers API key expiration, not rate limiting. Rate limits are specified in Chunk 3 cross-cutting sections but lack a dedicated middleware story. Consider adding during Technical Design.
