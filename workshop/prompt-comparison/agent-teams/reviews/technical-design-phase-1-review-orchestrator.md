<!-- This project was developed with assistance from AI tools. -->

# Technical Design Phase 1 -- Orchestrator Cross-Cutting Review

**Reviewer:** Orchestrator (Architect agent)
**Artifact:** `plans/technical-design-phase-1.md`
**Date:** 2026-02-12
**Verdict:** APPROVE (with Warnings)

---

## Review Focus

This review evaluates the Technical Design Document from the orchestrator perspective: cross-cutting coherence, scope discipline, assumption gaps, compounding scope creep, downstream feasibility, architecture alignment, and advisory memo incorporation. It does not duplicate specialist reviews (code quality, security depth, database correctness). The guiding question: "What would I miss if I only read the specialist reviews?"

---

## Findings

### Critical

No critical findings.

---

### Warning

**W-1: `analysiPass` typo in response JSON contracts -- two locations**

The `ApplicationResponse` Pydantic model (line 335) uses `alias="analysiPass"` and the JSON response example (line 307) shows `"analysiPass": 1`. The correct spelling should be `"analysisPass"` (matching the database column `analysis_pass` and the `LoanProcessingState.analysis_pass` field). This typo propagates into a binding API contract -- any frontend or test code written against the documented response shape will embed the misspelling. Since the TD explicitly states "These are binding contracts; implementers must conform exactly" (line 139), a backend developer implementing the Pydantic model will either replicate the typo into the API surface or diverge from the TD and break conformance.

**Location:** Lines 307, 335
**Impact:** Frontend and backend implementers may encode different spellings, causing integration failures.

---

**W-2: `ApplicationListItem` response shape includes `ssn` but DOC list endpoint contracts omit document count**

The `ApplicationListItem` model (lines 384-393) includes `ssn` (masked) in the list response. This is appropriate for the application list, but it creates a cross-cutting concern: the DOC-04 story ("List Documents for an Application") is assigned to Phase 1 (story map, line 76), yet the TD never defines a `GET /v1/applications/:id/documents` collection endpoint or response shape. The GET detail response (APP-03) includes an inline `documents` array, but there is no standalone document listing endpoint with its own pagination.

This matters because:
- A loan officer viewing an application sees embedded documents in the detail response, but if an application has many documents (up to 25 per the TD's own limit), embedding them all inline without pagination violates the API conventions (pagination for all collections).
- The test engineer writing tests for DOC-04 will have no contract to verify against.

**Location:** DOC-04 story coverage gap in Interface Contracts section
**Impact:** DOC-04 acceptance criteria cannot be verified against a binding contract.

---

**W-3: `confidence_thresholds` table created in Phase 1 but not exposed via any Phase 1 endpoint**

The TD creates the `confidence_thresholds` table (migration 007, lines 913-932), seeds it with default values (lines 996-1001), and defines a full CREATE TABLE with indexes. However, no Phase 1 endpoint reads or writes this table. The thresholds are consumed by the aggregator in Phase 2. Creating the table and seed data in Phase 1 is reasonable (it supports `DX-01` seed data story), but the TD should make this explicit -- currently it appears as if the table is part of the active Phase 1 contract when it is purely a seeded-and-waiting resource. A test engineer may write tests expecting CRUD operations on thresholds that do not exist yet.

**Location:** Lines 913-932 (schema), 996-1001 (seed), no corresponding endpoint
**Impact:** Low. The table is correctly seeded. But the context package section does not call out that thresholds have no Phase 1 API surface, which could confuse downstream agents.

---

**W-4: Document listing endpoint (DOC-04) assigned to Phase 1 but mapped to `/v1/documents/:id` for detail only**

Reviewing the Interface Contracts section, the TD defines:
- `POST /v1/applications/:id/documents` (DOC-01: upload)
- `GET /v1/documents/:id` (DOC-03: view detail)
- `GET /v1/documents/:id/download` (DOC-04: download)

But DOC-04 in the requirements is "List Documents for an Application" (not "Download a Document"). Cross-referencing the story map (requirements.md line 76): `DOC-04 | List Documents for an Application | P0 | 1`. The TD maps DOC-04 to the download endpoint (`GET /v1/documents/:id/download`) in the data flow section (line 120-131: "Document Download (DOC-03, DOC-04)"). This appears to be a story-to-endpoint mapping error:

- DOC-03 in the requirements is "Download a Document" (line 75)
- DOC-04 in the requirements is "List Documents for an Application" (line 76)

The TD reverses these, assigning DOC-03 to "View Document Detail" and DOC-04 to "Download Document". The listing behavior is covered only by the embedded `documents` array in the APP-03 response, not as a standalone endpoint. This means the project manager cannot create a discrete task for DOC-04 (list) with a clear exit condition separate from APP-03 (detail).

**Location:** Interface Contracts section, Data Flow section (lines 120-131)
**Impact:** Story-to-contract mapping is incorrect. Implementers and test engineers may build the wrong thing.

---

**W-5: `SET LOCAL ROLE audit_writer` requires the connection to NOT be in autocommit mode**

The audit service uses `SET LOCAL ROLE audit_writer` (line 1402) which is scoped to the current transaction. However, SQLAlchemy async sessions can operate in autocommit mode depending on configuration. If the session is in autocommit mode, `SET LOCAL ROLE` has no effect (it applies to the next transaction, which ends immediately). The TD specifies `RESET ROLE` (line 1435) as the cleanup, but `SET LOCAL ROLE` auto-resets at transaction end, so `RESET ROLE` is a belt-and-suspenders approach.

The assumption gap: the TD never specifies whether the database session factory uses `autocommit=False` (the SQLAlchemy 2.0 default for async sessions) or explicitly configures transaction behavior. If a backend developer configures the session with `expire_on_commit=False` and `autocommit=True` for performance, the audit immutability enforcement breaks silently.

**Location:** Lines 1401-1435 (audit service), line 1764 (`database.py` in file structure)
**Impact:** A backend developer implementing `database.py` without explicit transaction mode guidance could break audit integrity.

---

### Suggestion

**S-1: Add `escalated_at` column to Phase 1 migration as decided**

The Risks section (line 2049) states the decision: "add the column in the Phase 1 migration." However, the `CREATE TABLE loan_applications` SQL (lines 760-798) does not include `escalated_at`. The decision is made but not reflected in the binding schema contract. The backend developer implementing migration 003 will follow the CREATE TABLE verbatim and omit the column. Either add the column to the CREATE TABLE or explicitly note in the schema section that Phase 2's review queue migration will add it.

**Location:** Lines 760-798 (CREATE TABLE), line 2049 (decision)
**Impact:** Internal inconsistency between the decision and the schema contract.

---

**S-2: Specify `autocommit=False` in database session factory guidance**

Per W-5, the TD should include a brief note in the Configuration or Implementation Approach section stating that the async session factory must use `autocommit=False` (SQLAlchemy 2.0 default) to ensure `SET LOCAL ROLE` operates within a transaction context.

---

**S-3: Clarify Application List response differs from Application Detail response**

The TD defines two different response shapes: `ApplicationListItem` (compact, for lists) and `ApplicationResponse` (full, for detail). This is good API design. However, the context package for "Application Lifecycle" (line 1929) references only "POST /v1/applications request/response shapes" without noting that GET list and GET detail return different shapes. A backend developer implementing `routes/applications.py` should know up front that there are two distinct serializations.

---

**S-4: `DocumentSummaryResponse` referenced but never defined**

The `ApplicationResponse` model (line 339) references `list["DocumentSummaryResponse"]` for the embedded documents array. This type is never defined in the Interface Contracts section. The `DocumentResponse` model is defined (lines 507-522), but `DocumentSummaryResponse` is a different name. Either rename the reference to `DocumentResponse` or define the summary variant (which would have fewer fields than the detail variant).

**Location:** Line 339
**Impact:** The backend developer will encounter an undefined type reference.

---

**S-5: Auth failure audit events use system advisory lock key 0, potential contention under load**

System-level audit events (e.g., auth failures with no application_id) acquire advisory lock `pg_advisory_xact_lock(0)` (line 1395). Under heavy load with many concurrent auth failures (e.g., a brute-force attempt), all auth failure audit events contend on the same lock key. For Phase 1 MVP this is acceptable, but the choice should be documented as a known limitation with a note that a partitioned lock scheme (e.g., `hashtext(actor_id)`) could be used if system event volume becomes significant.

---

**S-6: Seed data migration (009) should document relationship integrity**

The seed data specification (lines 959-1001) describes 12 applications with various statuses and notes that "Approved and denied applications have complete audit event chains." The migration should ensure that the seeded audit events have valid hash chains (each event's `prev_event_hash` is actually the SHA-256 of the prior event in the chain). A broken hash chain in seed data would undermine the demo value. Consider noting that the seed data script must compute hash chains programmatically rather than using static values.

---

### Positive

**P-1: Exceptional coherence between data flows and interface contracts**

The data flow narratives (Application Creation, Document Upload, Application Submission, Audit Event Querying) map cleanly to the interface contracts. Each flow step references the correct endpoint, the correct Pydantic model, and the correct error code. The step-by-step numbering (e.g., the 10-step document upload flow at lines 65-81) provides implementers with an unambiguous sequence that doubles as a test scenario script. This level of traceability is rare in technical design documents.

---

**P-2: Complete machine-verifiable exit conditions for every task group**

The exit conditions table (lines 1801-1821) provides a `pytest` or `curl` command for every task group. The verification commands are specific enough to catch regressions (e.g., `pytest -k "immutability or hash_chain or set_role"` for audit) while remaining composable for CI. The dev setup exit condition (`make setup && make dev &; sleep 15 && curl -sf http://localhost:8000/health`) is pragmatic and tests the actual developer experience, not just code correctness.

---

**P-3: Requirements inconsistencies discovered and resolved inline**

Section "Requirements Inconsistencies Discovered" (lines 2059-2068) identifies four specific conflicts between the requirements and the TD's design decisions, explains the resolution for each, and justifies the choices. This is precisely the kind of upstream feedback the SDD workflow demands -- catching contradictions before they propagate into implementation. The PII-01 resolution (line 2065: "There is no phase where plaintext PII is stored") is particularly valuable as it eliminates a security ambiguity.

---

**P-4: Advisory memo incorporation is thorough and well-documented**

All three advisory memos are substantively incorporated:

- **API Designer:** Endpoint hierarchy matches exactly. Request/response shapes adopted with full Pydantic models. Pagination strategy (cursor-based, opaque token) adopted. All six "concerns for Technical Design" addressed (state machine validation, document upload status constraint, audit index, retry idempotency, file upload size, correlation ID propagation).

- **Database Engineer:** Table structures match with one upgrade (INTEGER -> BIGINT for monetary cents, documented as enhancement). Index strategy adopted verbatim. Migration ordering follows the advisory's dependency chain. All seven schema concerns addressed (escalated_at decided, document limit added, thread ID confirmed, hash chain validation noted, connection pools documented, pgvector index type confirmed, statement timeout noted in architecture cross-reference). The `is_seed` flag recommendation was adopted.

- **Security Engineer:** All five critical implementation pitfalls addressed (HMAC rotation documented as limitation, Fernet version byte positioned correctly, advisory lock scoped per-application, auth header redaction specified, PII in error messages prohibited). Production credential check covers all items from the memo. Health endpoint information exposure minimized per recommendation.

---

**P-5: `BIGINT` upgrade for monetary columns with explicit justification**

The upgrade from the architecture's `INTEGER` to `BIGINT` for monetary cents columns (line 800) is documented with clear rationale (loan amounts exceeding $21.4M), noted as consistent with the architecture's intent (no floating-point), and flagged as an enhancement rather than an override (line 2067). This is the correct way to diverge from upstream: transparently, with justification, and acknowledging the delta.

---

## Cross-Cutting Coherence Assessment

The TD tells a consistent story across all sections. Interface contracts match data flows. Error strategies conform to RFC 7807 throughout. The context packages reference the correct contracts and binding types. The status state machine is defined once (lines 177-206) and referenced consistently in data flows, PATCH endpoint logic, and the context package. Financial serialization (cents in DB, string decimals in JSON) is applied consistently across all monetary fields.

One coherence gap noted: the `DocumentSummaryResponse` type reference (S-4) and the `analysiPass` typo (W-1) are the only internal inconsistencies found across 2,085 lines.

## Scope Discipline Assessment

The TD stays tightly within Phase 1's 37 P0 stories. No Phase 2+ contracts are specified (no pipeline agent interfaces, no review queue sorting, no compliance checker contracts). The stub graph (lines 1531-1563) correctly demonstrates the checkpoint pattern without specifying real agent behavior. The `review_actions` table is deliberately omitted from Phase 1 migrations (it appears in the architecture's Phase 4 migration list). The `agent_decisions` table is correctly deferred to Phase 2 per the database engineer's advisory.

The TD does not include work breakdown or estimation, correctly staying within the Tech Lead's scope boundary.

Minor scope observation: The `confidence_thresholds` table is created and seeded in Phase 1 but has no API surface until Phase 5. This is forward-looking but defensible (seed data story DX-01 needs representative data).

## Downstream Feasibility Assessment

The project manager can break this TD into 3-5 file tasks per the chunking heuristics:

- AUTH work area: 4 files (context.py, resolver.py, roles.py, startup_checks.py) + tests = single task
- Audit work area: audit.py + migration + trigger migration + tests = single task
- Application CRUD: routes/applications.py + services/application.py + models/* = 1-2 tasks
- Document management: routes/documents.py + services/document.py + minio_client.py = single task
- Infrastructure: compose.yml + Makefile + .env.example + config.py + migrations = single task

Each context package provides the binding contracts, files to read, key decisions, and scope boundaries needed for autonomous implementation. The exit conditions are machine-verifiable.

## Architecture Alignment Assessment

- **ADR-001 (PostgresSaver checkpointing):** Faithfully implemented. `langgraph` schema created in migration 008. `AsyncPostgresSaver.from_conn_string()` configuration documented. Stub graph proves the pattern. Checkpoint cleanup task defined.
- **ADR-002 (Server-side role resolution):** Faithfully implemented. Key resolution flow ignores client-supplied role, logs mismatch, uses database role. HMAC-SHA256 hashing matches architecture specification.
- **ADR-003 (Audit from Phase 1):** Faithfully implemented. All three immutability layers present: INSERT-only role, trigger guard, hash chain with advisory lock. System events use null sentinel per architecture.
- **ADR-004 (Three-schema isolation):** `langgraph` schema created. `rag` schema deferred to Phase 3a (correct -- no RAG in Phase 1). `public` schema used for all transactional tables.

No ADR overrides detected. The `BIGINT` upgrade is documented as a refinement, not an override.

---

## Verdict: APPROVE

The Technical Design Document is ready for task breakdown by the Project Manager and implementation by the Backend Developer. The warnings identified (W-1 through W-5) should be addressed before or during implementation:

- **W-1** (typo) and **S-4** (undefined type) are quick fixes to the document.
- **W-2/W-4** (DOC-04 mapping) requires clarifying whether document listing is a standalone endpoint or embedded in APP-03, and updating the story-to-endpoint mapping.
- **W-3** (thresholds table) needs a brief note in the context package.
- **W-5** (autocommit mode) needs a one-line note in the database session guidance.
- **S-1** (escalated_at column) needs to be added to the CREATE TABLE or explicitly deferred.

None of these require re-architecture or re-design. They are documentation corrections and clarifications that can be resolved in a single pass before task breakdown begins.
