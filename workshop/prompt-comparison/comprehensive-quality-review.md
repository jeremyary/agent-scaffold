# Comprehensive Quality Review: Subagents vs. Agent Teams as Application Plans

This document evaluates both SDD result sets not as process comparisons, but as **plans for actually building a Multi-Agent Mortgage Loan Processing System**. Four specialist perspectives contributed: architecture, requirements, implementation readiness, and security/review quality.

Both approaches processed the same 396-line product brief (`product-brief-prompt.md`).

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Interpretation and Priority Divergence](#feature-interpretation-and-priority-divergence)
3. [Database Schema: Head-to-Head](#database-schema-head-to-head)
4. [Agent Architecture and LangGraph Design](#agent-architecture-and-langgraph-design)
5. [API Design Decisions](#api-design-decisions)
6. [Security Architecture](#security-architecture)
7. [Requirements Quality for Implementation](#requirements-quality-for-implementation)
8. [Phasing Strategy](#phasing-strategy)
9. [Work Breakdown Buildability](#work-breakdown-buildability)
10. [Review Findings: What Each Approach Caught](#review-findings-what-each-approach-caught)
11. [What Would Go Wrong First](#what-would-go-wrong-first)
12. [Blind Spots Neither Approach Caught](#blind-spots-neither-approach-caught)
13. [The Ideal Plan: Best of Both](#the-ideal-plan-best-of-both)
14. [Final Verdict](#final-verdict)

---

## Executive Summary

The **subagents approach** produces a plan that is more immediately executable: explicit dependency graphs, a capstone integration test, forward-compatible LangGraph state types, and copy-paste-ready Python contracts. Its greatest strength is architectural foresight -- defining the full graph topology with all nodes as stubs in Phase 1 prevents checkpoint migration pain across phases.

The **agent-teams approach** produces a plan with deeper domain analysis, stronger security posture, and more implementable acceptance criteria. Its greatest strengths are the advisory pattern (front-loading specialist knowledge before artifacts are written), API-level acceptance criteria precision, and three-layer audit immutability. However, it lacks a dependency graph in the work breakdown and its minimal Phase 1 LangGraph stub proves little about the actual agent architecture.

Neither plan is complete. Both have gaps that would require course corrections during implementation. An ideal plan would combine elements from both.

---

## Feature Interpretation and Priority Divergence

The most consequential divergence is how each approach interprets the stakeholder preference for "feature richness over minimal scope."

### Priority Distribution

| Priority | Subagents | Agent Teams |
|----------|-----------|-------------|
| P0 (Must Have) | 70 of 81 stories (86%) | 54 of 94 stories (57%) |
| P1 (Should Have) | 2 stories (2%) | 20 stories (21%) |
| P2 (Could Have) | 9 stories (11%) | 20 stories (21%) |

**The subagents approach has a priority inflation problem.** When 86% of stories are Must Have, the prioritization provides almost no guidance for trade-off decisions. If Phase 3b slips, every calculator story, every intake agent story, every rate integration story, and every prompt injection defense story would be considered a blocker for MVP completion. There is no meaningful "cut line."

The agent-teams approach provides more realistic prioritization. Fraud detection (PIPE-11) and denial coaching (PIPE-12) are P1 in Phase 4, not P0. The intake chat and mortgage calculator are P1 in Phase 3b. This gives the team flexibility if timelines compress while still signaling that these features are expected.

### Specific Feature Differences

| Feature | Subagents | Agent Teams |
|---------|-----------|-------------|
| Fraud detection | P0, Phase 3a | P1, Phase 4 |
| Denial coaching | P0, Phase 3a | P1, Phase 4 |
| Mortgage calculator | P0, Phase 3b (7 stories) | P1, Phase 3b (8 stories) |
| Default key handling | Warning only (US-060) | Hard fail in production (AUTH-07 AC-3) |
| Document upload formats | PDF only, 10MB limit (US-008) | PDF/JPEG/PNG/TIFF via magic bytes, 20MB (DOC-02) |
| PII handling | Single story (US-011), defers mechanism | 4 dedicated stories (PII-01 through PII-04) with Fernet encryption, masking, isolation, and key rotation |
| API key lifecycle | Deferred to Phase 4 (US-080) | Full CRUD in Phase 1 (AUTH-02 through AUTH-06) |

### Stakeholder Preference Alignment

The product brief's Section 9 establishes: "Security posture: upgrade, don't defer." Agent-teams is more aligned with this -- production hard-fail for default keys, magic byte validation, four PII stories, and full API key lifecycle in Phase 1. The subagents approach defers API key management and uses warning-only for default keys.

---

## Database Schema: Head-to-Head

### Where They Agree

- UUID primary keys, PostgreSQL with pgvector, Alembic migrations
- Core entity set: applications, documents, audit_events, agent_decisions, API keys
- `TIMESTAMPTZ` for all timestamps
- LangGraph checkpoint tables in a separate schema
- Integer cents for monetary values
- Fernet-based PII encryption

### Where They Diverge

| Decision | Subagents | Agent Teams | Better Choice |
|----------|-----------|-------------|---------------|
| **Applications table** | `applications` | `loan_applications` | Teams -- more descriptive in a multi-table schema |
| **User identity** | Separate `users` table; `api_keys.user_id -> users.id` | No users table; `loan_applications.created_by -> api_keys.id` | **Subagents** -- separates identity from credential; allows multiple keys per user |
| **Status values** | UPPERCASE StrEnum, 12 values, no DB CHECK constraint | lowercase strings, 8 values, DB CHECK constraint | **Teams** -- CHECK constraint provides defense-in-depth; subagents relies solely on application-layer validation |
| **Configuration** | Single `configuration` key/value JSONB table | Separate `confidence_thresholds` table with typed columns | **Teams** -- typed columns enable DB-level validation and simpler queries |
| **Property address** | Plain TEXT column | JSONB with structured sub-fields | **Teams** -- enables future geo-queries and structured validation |
| **SSN lookup hash** | `ssn_hash VARCHAR(64)` for indexed lookups | No SSN hash column | **Subagents** -- without this, duplicate-SSN detection requires decrypting every stored SSN |
| **Audit event PK** | UUID | BIGSERIAL | **Teams** -- monotonic ordering is essential for audit trails; UUID ordering is non-deterministic |
| **Audit event columns** | Generic `details JSONB` | Explicit typed columns (`agent_name`, `confidence_score`, `reasoning`, etc.) + `metadata JSONB` | **Teams** -- explicit columns enable indexing, querying, and reporting without JSON path expressions |
| **Hash chain** | Mentioned in text, absent from Phase 1 DDL | `prev_event_hash VARCHAR(64) NOT NULL` in DDL with formula specified | **Teams** -- the hash chain is a binding contract; it must be in the DDL |
| **Monetary API serialization** | Integer cents in JSON | String decimals (`"250000.00"`) | **Teams** -- avoids JavaScript floating-point precision loss; industry standard (Stripe, Plaid) |
| **Schema separation** | All tables in `public` schema | Three schemas (`public`, `rag`, `langgraph`) with separate connection pools | **Teams** -- prevents RAG vector scans from starving OLTP queries |
| **Seed data** | 3 users, 3 API keys, 3 config rows | 3 keys, 12 applications in diverse statuses, documents, audit trails | **Teams** -- dramatically more useful for development and demo |

### Audit Trail Immutability

This is the most significant schema divergence. Agent-teams implements a three-layer defense:

1. **Dedicated `audit_writer` role** -- INSERT-only permissions; no UPDATE or DELETE
2. **Trigger guard** -- `BEFORE UPDATE OR DELETE` trigger that raises an exception
3. **Hash chain** -- `prev_event_hash` column with SHA-256 linking; formula specified; `pg_advisory_xact_lock(hashtext(application_id))` for concurrent writes during parallel agent fan-out

The subagents approach describes these concepts in architecture text but does not fully specify them in Phase 1 DDL. The `SET LOCAL ROLE` pattern (transaction-scoped, not session-scoped) in the agent-teams TD is a subtle but important correctness detail that prevents role leakage across connection pool reuse.

### Encryption Inconsistency (Subagents Only)

The subagents architecture specifies Fernet (AES-128-CBC + HMAC-SHA256) but the TD's WU14 specifies AES-256-GCM with manual nonce + ciphertext + tag concatenation. These are different algorithms. An implementer would not know which to use. The agent-teams approach uses Fernet consistently throughout all documents.

---

## Agent Architecture and LangGraph Design

### Graph Topology in Phase 1

This is the single most consequential technical divergence between the two approaches.

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Phase 1 graph | **Full graph** -- all nodes defined as stubs, all edges, conditional routing, parallel fan-out | **Single stub node** -- `stub_agent` -> END |
| State TypedDict | All future-phase fields with `| None` defaults; typed sub-TypedDicts for each agent result (`CreditAnalysisResult`, `RiskAssessmentResult`, etc.) | Minimal fields; generic `agent_results: dict[str, dict]` |
| Stub behavior | Each stub returns realistic typed data (credit score 720, confidence 0.85, `[STUB]` prefix in reasoning, `model_used="stub"`) | Single stub returns `{"current_step": "stub_complete"}` |
| Forward compatibility | All enums include all values from all phases; all tables created in Phase 1 | Tables created per phase via migrations; state expanded between phases |

**The subagents approach is dramatically better here.** Defining the complete graph topology with all typed stubs in Phase 1 means:

1. **No checkpoint migration risk** -- the state schema is stable across all phases. LangGraph checkpoints serialize TypedDicts; adding fields between phases risks deserialization failures on existing checkpoints.
2. **Phase 2 is a logic swap, not a structural change** -- implementers replace stub return values, not graph edges.
3. **The parallel fan-out pattern is tested from day one** -- the supervisor dispatches to credit, risk, compliance, and fraud nodes in parallel, proving the orchestration pattern works before real LLM calls are added.
4. **The aggregation logic is exercisable** -- confidence thresholds, routing decisions, and audit event creation work with realistic stub data.

The agent-teams single-stub approach proves only that PostgresSaver can persist a trivial state. It provides zero confidence that the actual supervisor-worker topology, parallel fan-out, or conditional routing will function. The Phase 1 -> Phase 2 transition in agent-teams requires a non-trivial structural change to the graph, introducing risk at the moment real LLM costs are introduced.

### Thread ID Conventions

| Subagents | Agent Teams |
|-----------|-------------|
| `loan:{application_id}` for loan processing, `intake:{session_id}` for intake | `str(application_id)` for loan processing; `f"{application_id}:{analysis_pass}"` for resubmission |

Agent-teams' resubmission thread ID pattern (`{application_id}:{analysis_pass}`) is a concrete design decision for the cyclic resubmission workflow. Subagents' `loan:` / `intake:` prefix convention provides namespace isolation within a shared checkpoint store. An ideal design combines both: `loan:{application_id}:{analysis_pass}`.

---

## API Design Decisions

### Endpoint Design

| Decision | Subagents | Agent Teams | Assessment |
|----------|-----------|-------------|------------|
| Submit action | `POST /v1/applications/{id}/submit` | `PATCH /v1/applications/:id` with `{"status": "submitted"}` | **Subagents** -- explicit action endpoint is more RESTful; prevents accidental state transitions from generic PATCH |
| Retry action | Not specified in Phase 1 | `POST /v1/applications/:id/retry` | **Teams** -- explicit retry endpoint |
| Calculator | Three endpoints (`/monthly-payment`, `/affordability`, `/amortization`) | Single `POST /v1/public/calculator` with type discriminator | **Subagents** -- purpose-specific endpoints with dedicated schemas are cleaner |
| Auth key management | `POST /v1/admin/keys` (reviewer only) | Full CRUD: `POST`, `GET`, `DELETE /v1/auth/keys` | **Teams** -- complete lifecycle in Phase 1 |
| Async document processing | Synchronous in Phase 1 stubs; returns final status | `202 Accepted`; client polls for completion | **Teams** -- architecturally correct for production; subagents' synchronous model must change when real LLM calls take minutes |

### Error Responses

Both use RFC 7807 Problem Details. Both address PII redaction in validation errors. The agent-teams TD provides a concrete implementation: `PII_FIELDS = {"ssn"}` constant with overridden `RequestValidationError` handler. The subagents architecture specifies the pattern but defers the implementation.

### Pagination

Both use cursor-based pagination with base64-encoded opaque cursors. Agent-teams is more precise: compound cursor (`base64(created_at:id)`) for timestamp-ordered data, simple ID cursor (`base64(id)`) for monotonic sequences. Different cursor strategies for different resources shows awareness of pagination correctness under concurrent writes.

---

## Security Architecture

### API Key Hashing

| Subagents | Agent Teams |
|-----------|-------------|
| SHA-256 hash of the API key | HMAC-SHA256 with server-side `HMAC_SECRET_KEY` |

**Agent-teams is decisively better.** HMAC-SHA256 with a server-side secret provides defense-in-depth: even if an attacker compromises the database, they cannot verify API keys without the HMAC secret. The agent-teams TD explicitly documents why bcrypt was rejected (50-200ms per-request latency is inappropriate for high-entropy API keys) via an ADR. The subagents approach never addresses this tradeoff.

### Security Findings Found by One Approach but Missed by the Other

**Found only by agent-teams reviewers:**
- Data-at-rest encryption requirements entirely missing (Security Engineer C2)
- Document upload security (file type validation, malicious file handling) at product plan stage
- SSRF risk in external data integrations
- bcrypt performance concern for per-request API key hashing
- Hash chain concurrency during parallel agent fan-out
- Intake agent indirect prompt injection via tool results
- Fernet key rotation gap for long-lived records
- LangGraph graph invocation pattern (sync vs async) affecting error handling
- Three effective connection pools creating connection pressure

**Found only by subagents reviewers:**
- Session hijacking via correlation ID reuse
- Explicit HTTPS enforcement and security header specification (HSTS, CSP, X-Frame-Options)
- Per-session token budget for public tier cost control
- Application-level access control scoping for loan officers

### Which Approach Produces a More Secure Application?

Agent-teams, for three reasons:

1. **Earlier critical finding resolution.** Product plan reviews forced resolution of privilege escalation, data-at-rest encryption, and PII timing *before* the architecture was written.
2. **More attack surface coverage.** The Backend Developer and API Designer reviewers identify security-relevant implementation concerns (bcrypt latency, connection pool pressure, graph invocation patterns) that pure security reviewers miss.
3. **Three-reviewer convergence.** When 3 independent reviewers flag the same issue (auth token privilege escalation), the finding has very high confidence and is more likely to be fixed.

### Intake Agent Sandboxing

Both isolate the intake graph from application data. Agent-teams goes further: the intake graph's connection pool is scoped to the `rag` schema only -- it literally cannot query the `public` schema. This is enforced by PostgreSQL, not by code discipline. The subagents approach relies on "no code path" isolation, which is a softer guarantee.

---

## Requirements Quality for Implementation

### Acceptance Criteria Precision

This is the most important quality difference between the two approaches. Agent-teams acceptance criteria are consistently **API-level testable** with specific HTTP methods, paths, status codes, and response structures.

**Example -- Application creation:**

Subagents US-053:
> 1. API endpoint accepts: borrower name, SSN, loan amount, property address, loan term, application date
> 2. Validates required fields are present
> 3. Creates application record in database with unique application ID
> 4. Initializes application status as "DRAFT"
> 5. Returns application ID in response

Agent-teams APP-01 AC-1:
> Given an authenticated user with role loan_officer or higher / When they send a POST request to /v1/applications with valid borrower data / Then the system creates a new application in draft status, returns 201 with a Location header pointing to the new resource, the response body contains `{ "data": { ... } }` with the application ID, all monetary values are serialized as string decimals, SSN is returned masked as "***-**-1234", and an audit event of type state_transition is recorded with previous_state: null, new_state: "draft"

The agent-teams version specifies the HTTP method, endpoint path, response status code (201), Location header, response envelope format, monetary serialization convention, SSN masking format, and audit event cross-reference. An implementer can build the endpoint directly from the AC. The subagents version requires the implementer to make decisions about response format, status codes, and cross-cutting concerns.

### Integration Artifacts

Agent-teams includes artifacts that subagents lacks entirely:

- **Application status state machine diagram** with valid transitions and Phase 4 additions marked
- **Complete data flow trace** (13-step happy path with story ID cross-references at each step)
- **Cross-feature dependency map** (sequential and parallel execution points)
- **Coverage validation matrix** mapping every product plan feature to stories and phases
- **Architecture consistency notes** flagging 4 specific upstream document gaps
- **Financial precision convention** established once and referenced throughout

Without these, a team working from the subagents requirements must reconstruct relationships by reading all 81 stories.

### Duplicate Stories (Subagents Only)

The subagents requirements document has overlapping stories. US-053 (Create Loan Application) and US-054 (View Application Detail) in section 10 partially duplicate earlier application management concerns. The agent-teams approach avoids this with domain-prefixed IDs (APP-01, DOC-01, PIPE-01) and explicit chunk boundaries.

---

## Phasing Strategy

### Phase 1 Scope

| Subagents Phase 1 (15 stories) | Agent Teams Phase 1 (37 stories) |
|---|---|
| API skeleton with most routes returning 501 | Working CRUD endpoints with full test coverage |
| Auth middleware | Auth middleware + full API key lifecycle |
| All database tables (including future-phase) | Core tables only (created per phase) |
| Full LangGraph graph with all nodes as stubs | Minimal stub graph (single node) |
| Correlation ID + structured logging | Correlation ID + structured logging + health checks |
| Minimal seed data (3 users, 3 keys) | Rich seed data (3 keys, 12 applications, documents, audit trails) |
| No PII encryption stories | 4 PII stories (encrypt, mask, isolate, rotate) |
| API key management deferred | Full API key CRUD |

**Agent-teams front-loads more infrastructure.** All auth, audit, PII, and checkpointing stories are in Phase 1. This ensures foundation infrastructure is battle-tested before any real agent work begins.

**Subagents front-loads more architecture.** The full graph topology, all database tables, and all enum values are defined in Phase 1. This prevents structural surprises in later phases.

### Cyclic Resubmission Timing

Subagents places the cyclic document resubmission workflow in Phase 3a. Agent-teams defers it to Phase 4, building only approve/deny in Phase 2. The agent-teams phasing is more realistic -- the cyclic workflow requires LangGraph state manipulation, re-entry to document processing, and analysis pass tracking. Building it after the pipeline is stable reduces risk.

### Observability Separation

Subagents lumps observability and deployment into Phase 4 alongside feature work (fraud, coaching). Agent-teams creates a dedicated Phase 5 for observability, deployment, and polish. The agent-teams separation is cleaner -- it avoids mixing feature development with operational infrastructure.

---

## Work Breakdown Buildability

### Implementation Readiness

| Dimension | Subagents | Agent Teams |
|-----------|-----------|-------------|
| Stories | 25 | 37 stories, 67 tasks |
| Specified-to-implementer ratio | ~90/10 | ~85/15 |
| Dependency graph | Explicit ASCII diagram with wave scheduling | **Missing** -- dependencies must be inferred from task cross-references |
| Capstone integration test | S-P1-23 exercises full Phase 1 flow including edge cases | **None** -- per-task exit conditions only |
| Task prompt format | Story descriptions with TD section references | Structured Read/Do/Verify prompts with TD line numbers |
| File references | By TD section number (stable) | By TD line number (brittle -- shifts with edits) |

### Critical Path

**Subagents:** 11 sequential stories. The parallel API types track (S-P1-08 onward) provides slack if the database track runs long.

**Agent-teams:** ~15-20 tasks on the critical path (reconstructed -- not explicitly documented). Finer granularity means more context switches but no individual task exceeds 1 hour.

### Which Gets to "Something Running" Faster?

Subagents. S-P1-01 is explicitly the first story with zero dependencies, and the wave structure ensures infrastructure is done first. The health check (S-P1-13) returns 200 by Wave 3. Agent-teams has the right advisory insight (DevOps engineer recommends splitting DX into bootstrap vs. polish) but does not operationalize it in the work breakdown.

### Overloaded Tasks

**Subagents S-P1-21 (Checkpointer + Submit Endpoint)** is the most overloaded story in either plan. It requires: creating a separate asyncpg pool for PostgresSaver, initializing the checkpointer, compiling the graph, building the submit endpoint with complex business logic (status validation, graph invocation, audit events, agent_decisions rows), and modifying main.py. This is realistically 3 stories compressed into one.

**Agent-teams T-012 (Seed Applications and Documents)** requires encryption logic during an Alembic migration (cross-package dependency), hash chain computation with exact timestamp formatting, and fixed UUIDs for 12 applications with documents. The DB engineer advisory correctly calls this out but the WB does not fully resolve it.

### Exit Condition Quality

Subagents exit conditions range from simple import checks to complex multi-step integration tests. The capstone S-P1-23 exercises the entire Phase 1 flow. Some intermediate conditions are too loose (S-P1-02 only tests that `async_session_factory` can be imported, not that it works).

Agent-teams exit conditions use targeted `pytest` commands, which is more rigorous per-task. However, there is no capstone integration test. Passing all 67 individual task conditions does not guarantee the system works end-to-end (middleware ordering could be wrong, dependency injection could be misconfigured).

---

## Review Findings: What Each Approach Caught

### Cross-Approach Convergent Findings

These issues were independently identified by reviewers from **both** approaches, making them the highest-confidence findings:

| Issue | Subagents Severity | Agent-Teams Severity |
|-------|-------------------|---------------------|
| API key privilege escalation (role in bearer token) | Suggestion | Critical (3-way convergence) |
| PII redaction complexity/timing | Critical | Warning |
| Audit trail immutability enforcement gaps | Warning | Warning + Critical (phasing) |
| Phase 3 overload | Warning | Warning (2 reviewers) |
| SSN encryption key management | Critical | Warning + TD Warning |
| Missing user stories for P2 features | Critical (2 reviewers) | Critical (3 reviewers) |
| Requirements summary statistics inaccurate | Warning (2 reviewers) | Warning (3 reviewers) |

### Orchestrator Review Value (Agent-Teams Only)

The agent-teams orchestrator reviews caught findings that **no specialist reviewer** identified:

1. **Workflow persistence three-way contradiction** (product plan) -- feature scope says P1, NFR says baseline requirement, stakeholder constraint mandates LangGraph with PostgresSaver. No specialist caught this because each reads different sections.
2. **Human-in-the-loop / document resubmission overlap** -- P0 and P2 features describe the same user action at different priority levels without clear boundaries.
3. **Hash chain concurrency + validation synthesized** -- the Backend Developer flagged concurrency and the Security Engineer flagged validation, but only the orchestrator saw that the combination affects integrity during normal parallel fan-out operations.
4. **14+ story map inconsistencies** -- systematic cross-check between master document and chunk files that no specialist performed.
5. **`SET LOCAL ROLE` autocommit assumption** -- sits at the intersection of database config, security enforcement, and backend implementation; no single specialist covers all three.

### Finding Category Distribution

| Category | Subagents | Agent Teams |
|----------|-----------|-------------|
| Security | ~25 findings | ~35 findings |
| Correctness | ~12 | ~18 |
| Performance | ~3 | ~6 |
| Maintainability | ~8 | ~10 |
| Compliance | ~5 | ~7 |
| Completeness | ~15 | ~22 |

The agent-teams approach finds more issues across every category, primarily due to broader reviewer panels and the orchestrator's cross-cutting analysis. Performance findings are notably stronger in agent-teams because the Backend Developer reviewer identifies implementation-feasibility concerns (bcrypt latency, connection pool pressure) that pure security/code reviewers miss.

---

## What Would Go Wrong First

### Subagents: First Failures

1. **S-P1-21 (Checkpointer + Submit)** -- the most overloaded story. Creating a separate asyncpg pool, initializing PostgresSaver, compiling the graph, building complex endpoint logic, and modifying main.py is realistically 3 stories of work. If the checkpointer pool configuration is wrong, the entire story fails with no partial credit.

2. **S-P1-04 (Initial Migration)** -- creates 8 tables, database roles, grants, pgvector extension, and a vector column in a single migration. The `CREATE ROLE app_role` / `GRANT` statements assume superuser privileges, which may not be true in the Docker PostgreSQL setup.

3. **Monorepo import pattern** -- `from packages.db.src.engine import ...` is unusual and may not work without `pyproject.toml` path configuration. Exit conditions use this pattern but S-P1-01 does not specify how cross-package imports work.

4. **Encryption algorithm contradiction** -- the architecture says Fernet; the TD says AES-256-GCM. An implementer would need to ask which one to use.

### Agent-Teams: First Failures

1. **T-012 (Seed Applications)** -- requires encryption logic during an Alembic migration (cross-package dependency that may not work in migration context). Hash chain computation requires exact timestamp formatting matching the AuditService logic.

2. **Missing dependency graph** -- tasks would be attempted out of order. Without explicit wave scheduling, a PM might assign T-030 (Application Create Endpoint) before T-023 (Audit Service Core), causing runtime failures.

3. **Advisory recommendations not operationalized** -- the DevOps engineer recommends splitting DX into bootstrap vs. polish; the DB engineer recommends splitting seed data into 3 sub-tasks. The WB acknowledges these but does not fully implement them.

4. **HMAC secret management** -- a new secret to manage. If rotated, all existing keys become invalid. The security engineer advisory catches this risk but the WB does not resolve it.

5. **24-hour seed API key TTL** -- a developer who sets up Monday and returns Tuesday has expired credentials. The subagents approach uses keys with no expiration for dev.

### Course Corrections Needed

**Agent-teams would need more corrections** (no dependency graph, seed data complexity, HMAC management, 67-task coordination overhead, unincorporated advisory recommendations), but the corrections are smaller individually.

**Subagents would need fewer corrections** (S-P1-21 split, encryption algorithm resolution, test database strategy), but the ones it needs are more painful because they affect the critical path.

---

## Blind Spots Neither Approach Caught

These issues exist in both plans and were not flagged by any reviewer from either approach:

1. **Denial-of-service via document processing.** No per-application storage quota beyond the document count limit. A user uploading 25 documents at 20MB each (500MB total) incurs substantial storage and processing cost.

2. **LLM model version pinning.** Neither addresses what happens when the LLM provider updates model versions. Model behavior changes could alter confidence scores, routing decisions, and audit trail consistency without any code change -- a critical concern for AI-assisted decision systems in regulated industries.

3. **Checkpoint data retention and GDPR/CCPA.** If a borrower requests data deletion, checkpoints containing their name and property address must also be deleted -- but the audit trail is immutable and may reference the application. This is a genuine compliance tension that neither plan resolves.

4. **Rate limit bypass via authenticated tier.** Neither addresses a scenario where a malicious actor obtains a valid API key and uses the authenticated tier to bypass the more restrictive public tier rate limits for cost-generating endpoints.

5. **Adverse action notice timing.** ECOA requires adverse action notices within 30 days of receiving a completed application. Neither plan specifies how the system tracks this timeline or alerts when approaching the deadline.

6. **HMDA reporting data collection.** The Home Mortgage Disclosure Act requires demographic data collection for reporting. The product plan excludes this, but neither review validates that the system does not inadvertently collect or infer demographic data through document processing.

7. **Operational security gaps.** Neither approach systematically addresses monitoring and alerting configuration, log retention and rotation, container image update strategy, database backup verification, or secrets rotation operational procedures.

---

## The Ideal Plan: Best of Both

If building this application, the optimal plan would take:

### From Subagents

- **Full LangGraph graph topology in Phase 1** with all nodes as typed stubs returning realistic data. This is the single most important architectural decision in either plan.
- **Typed state TypedDicts** (`CreditAnalysisResult`, `RiskAssessmentResult`, etc.) instead of generic `dict[str, dict]`. Static type checking and IDE autocompletion prevent an entire class of runtime bugs.
- **Explicit dependency graph and wave scheduling** for the work breakdown. Without this, task execution ordering is guesswork.
- **Capstone integration test** (S-P1-23 equivalent) that exercises the full Phase 1 flow end-to-end.
- **Separate `users` table** from API keys. Decoupling identity from credential is architecturally cleaner and supports multiple keys per user.
- **SSN lookup hash column** for duplicate detection without decryption.
- **Forward-compatible enums and tables** -- defining all values and tables in Phase 1 prevents structural migrations between phases.
- **Simpler auth for development** -- non-expiring dev keys, no HMAC secret management in Phase 1.

### From Agent-Teams

- **Three-layer audit immutability** (INSERT-only role + trigger guard + hash chain with advisory locks). Production-grade, not aspirational.
- **HMAC-SHA256 for API key hashing** with server-side secret. Defense-in-depth against database compromise.
- **String decimal monetary serialization** in API responses. Industry standard for financial applications.
- **Database CHECK constraints** on status fields, MIME types, file sizes, confidence scores. Defense-in-depth beyond application-layer validation.
- **API-level acceptance criteria** with HTTP methods, status codes, response structures, and cross-references. Eliminates ambiguity for implementers.
- **Advisory documents** for architecture and work breakdown. Front-loading specialist knowledge before artifacts are written catches issues when they are cheapest to fix.
- **Orchestrator reviews** at every gate. The cross-cutting findings these produce are genuinely valuable.
- **Conservative MoSCoW prioritization** (57% P0 vs. 86%). Provides meaningful trade-off guidance.
- **Separate `rag` schema** with distinct connection pool. Prevents vector scans from starving OLTP queries.
- **Dedicated Phase 5** for observability and deployment. Clean separation from feature work.
- **State machine diagram** with valid transitions. Prevents ad-hoc status management.
- **Coverage validation matrix** mapping features to stories. Prevents coverage gaps.
- **`SET LOCAL ROLE` transaction pattern** for audit writes. Prevents role leakage across connection pool reuse.
- **Rich seed data** (12 applications in diverse statuses). Immediately useful for development and demos.
- **LangFuse PII warning** -- operational security detail about not enabling tracing for PII-containing workflows.
- **Connection-pool-level intake sandboxing** -- enforced by PostgreSQL, not code discipline.

### Fix in Both

- **Split S-P1-21** (or equivalent) -- checkpointer setup and submit endpoint should be separate tasks.
- **Add explicit dependency graph** to agent-teams work breakdown.
- **Add capstone integration test** to agent-teams work breakdown.
- **Resolve encryption algorithm** (Fernet vs. AES-256-GCM) before implementation.
- **Add per-application storage quota** for document uploads.
- **Specify LLM model version pinning strategy.**
- **Address data retention / deletion rights tension** with immutable audit trails.

---

## Final Verdict

### As Plans for Building the Application

| Dimension | Better Plan | Margin |
|-----------|-------------|--------|
| LangGraph architecture | Subagents | **Large** -- full graph vs. single stub |
| State type safety | Subagents | **Large** -- typed TypedDicts vs. generic dict |
| Forward compatibility | Subagents | **Large** -- all tables/enums/state upfront |
| Dependency management | Subagents | **Large** -- explicit graph vs. none |
| Integration testing | Subagents | **Moderate** -- capstone test vs. none |
| Database security (audit trail) | Agent Teams | **Large** -- 3-layer defense vs. 2-layer |
| API key security | Agent Teams | **Large** -- HMAC-SHA256 vs. plain SHA-256 |
| Schema robustness | Agent Teams | **Large** -- CHECK constraints, typed columns |
| Acceptance criteria quality | Agent Teams | **Large** -- API-level vs. behavioral |
| Priority discipline | Agent Teams | **Large** -- 57% P0 vs. 86% P0 |
| Risk identification | Agent Teams | **Large** -- advisories surface hidden risks |
| Review thoroughness | Agent Teams | **Moderate** -- orchestrator + broader panels |
| Seed data usefulness | Agent Teams | **Moderate** -- 12 diverse apps vs. 3 minimal |
| PII handling completeness | Agent Teams | **Moderate** -- 4 stories vs. 1 |
| Operational security | Agent Teams | **Moderate** -- LangFuse warning, sandbox isolation |

**Subagents wins on architecture and executability.** If you need to start building tomorrow with minimal clarification, the subagents plan is more immediately actionable. Its dependency graph, wave scheduling, and typed contracts mean a team can execute without reconstructing relationships.

**Agent-teams wins on security, requirements quality, and risk awareness.** If you need confidence that the plan addresses the right concerns at the right depth, the agent-teams plan is more thorough. Its acceptance criteria, advisory documents, and three-layer audit trail reflect deeper domain analysis.

**The gap is closable from either direction.** Adding a dependency graph and capstone test to the agent-teams plan is straightforward. Adding advisory reviews and three-layer audit immutability to the subagents plan is also straightforward. The hardest thing to retrofit is the LangGraph graph topology decision (subagents' full graph vs. agent-teams' single stub) -- this is an architectural choice that propagates through the entire Phase 1 implementation and is expensive to change after the fact.

**Bottom line:** A team that combines the subagents approach's graph architecture with the agent-teams approach's security posture and requirements precision would have the strongest possible plan for this application.
