<!-- This project was developed with assistance from AI tools. -->

# Architecture Review -- Code Reviewer

**Reviewer:** Code Reviewer
**Document reviewed:** `plans/architecture.md`
**Date:** 2026-02-12

---

## Technical Design Review Checklist

### 1. Contracts are concrete

**Verdict: PASS with minor gaps.**

The architecture document is exceptionally concrete. It includes:

- Full SQL DDL for all seven application tables (`applications`, `documents`, `agent_decisions`, `audit_events`, `users`, `api_keys`, `configuration`, `embeddings`) with column types, constraints, and indexes (Section 3.1, lines 312-498).
- Complete JSON request/response shapes for every major endpoint: create application, application detail, human review action, review queue, mortgage calculator, chat, and streaming chat (Section 4.2, lines 685-993).
- Concrete Python type definitions: `LoanProcessingState` TypedDict (lines 1064-1103), `IntakeState` TypedDict (lines 1211-1216), `Role` IntEnum (lines 1491-1494).
- Actual LangGraph graph definitions with node and edge specifications (lines 1107-1172, lines 1218-1238).
- Concrete Redis key patterns for all five cache functions (Section 2.4, lines 230-236).
- Real file paths for the entire monorepo layout (Section 9, lines 1914-2075).

The document clearly goes beyond "use a clean pattern" -- it provides implementable specifications.

### 2. Data flow covers error paths

**Verdict: PASS.**

Section 3.4 (lines 544-628) documents the full application processing data flow with a dedicated "Error paths at each boundary" table covering seven failure modes: MinIO unavailable during upload, LLM API timeout during classification/extraction, single agent failure during parallel fan-out, all agents timing out, configuration table unreachable during routing, and database write failure during review.

Section 2.6 (line 266-273) specifies fallback behavior for each external integration (FRED, BatchData, Claude, GPT-4 Vision, LangFuse).

Section 8.4 (lines 1876-1884) provides a graceful degradation matrix for Redis, LangFuse, FRED, BatchData, and LLM APIs.

The auth flow at the middleware level (Section 2.1, lines 149-197) specifies exact error status codes (401, 403, 429) and when each is returned.

### 3. Exit conditions are machine-verifiable

**Verdict: PASS.**

Every phase in Section 11 (lines 2200-2435) includes machine-verifiable exit criteria:

- Phase 1: "`make setup && make dev` completes in under 30 minutes", "curl localhost:8000/health returns 200", "UPDATE/DELETE on audit_events fails with permission error"
- Phase 2: "Upload W-2 PDF; agent classifies it as W2 with confidence > 0.6; extracts employer name, wages, tax withheld"
- Phase 3a: "Application with income discrepancy -> fraud flag -> forced escalation"
- Phase 3b: "21st chat message in an hour returns 429"
- Phase 4: "CI pipeline passes on clean branch"

Each step within each phase also has its own exit criterion. These are specific, automatable, and pass/fail -- not subjective assessments.

### 4. File structure maps to actual codebase

**Verdict: PASS with explicit acknowledgment.**

Section 9 (line 1916) explicitly states: "The `packages/` directory does not yet exist and must be created as part of Phase 1 scaffolding." This is correct -- the current repository root contains only `plans/`, `docs/`, `.claude/`, and configuration files. No `packages/`, `compose.yml`, `Makefile`, or `turbo.json` exists yet.

The proposed structure follows the template defined in `.claude/rules/architecture.md` (Turborepo monorepo with `packages/ui`, `packages/api`, `packages/db`, `deploy/helm/`, `compose.yml`, `turbo.json`, `Makefile`).

The file structure is a reasonable forward-looking design that acknowledges the current state.

### 5. No TBDs in binding contracts

**Verdict: PASS.**

The document handles undefined items responsibly:

- Open questions are explicitly catalogued in Section 10 (lines 2079-2197).
- OQ-9 (PII redaction) is the most significant open question. The document provides a concrete recommendation (Option A: local OCR + NER) with rationale, fallback behavior, and explicit status: "Pending stakeholder confirmation" (line 2101). The binding contract (Section 6.4, lines 1575-1580) specifies invariants that hold regardless of the chosen approach.
- OQ-7 (connection pools) and OQ-10 (checkpoint forward-compatibility) are resolved within the document itself (Sections 10.2 and 10.3).
- OQ-4 (API key lifecycle) documents the MVP approach and the Phase 4 extension (Section 10.4).

No binding contract contains a silent "TBD" -- every unresolved item is flagged as an open question.

---

## Findings

### Critical

None.

### Warning

#### W-1: Dangling tree node in file structure (Section 9, line 1929)

Line 1929 of the architecture document contains a dangling file-structure tree entry:

```
|   |   |   +--
```

This is immediately after `dependencies.py` and before the `middleware/` directory. The line appears to be an artifact of editing -- a file was removed or the line was left incomplete.

**Suggestion:** Remove the dangling line or fill it with the intended file reference. If this was meant to be `errors.py` (for the AppError class hierarchy described in the error handling conventions) or another module, add it explicitly. If it was an editing artifact, delete line 1929.

---

#### W-2: `chat_history` table missing from schema for cross-session context (Section 5.2 / Section 3.1)

Section 5.2 (line 1241) references a `chat_history` table for authenticated cross-session chat context (Phase 4, P2): "conversation history is stored in a separate `chat_history` table and loaded into the graph state on each invocation." However, no `chat_history` table is defined in Section 3.1 (Database Schema). The schema covers `applications`, `documents`, `agent_decisions`, `audit_events`, `users`, `api_keys`, `configuration`, and `embeddings` -- but no `chat_history`.

Since cross-session context is a P2/Phase 4 feature, this is not blocking, but the reference creates an expectation without a corresponding schema definition.

**Suggestion:** Either add a `chat_history` table definition to Section 3.1 (even if marked as Phase 4), or qualify the reference in Section 5.2 with a note such as "schema to be defined in Phase 4 technical design." Leaving the reference without a schema could cause an implementer to invent a schema ad hoc.

---

#### W-3: `LoanProcessingState` uses `list[dict]` and `dict` instead of typed structures (Section 5.1, lines 1064-1103)

The `LoanProcessingState` TypedDict uses untyped `dict` and `list[dict]` for several fields:

```python
documents: list[dict]           # [{doc_id, type, confidence, extracted_data, metadata}]
credit_analysis: dict | None
risk_assessment: dict | None
compliance_check: dict | None
fraud_detection: dict | None
aggregated_results: dict | None
coaching_output: dict | None
thresholds: dict
previous_analyses: list[dict]
tool_results: list[dict]        # In IntakeState
```

Comments document the intended shapes, but there are no concrete TypedDicts for these nested structures. This means the contract between agents is informally defined by comments rather than by type-checked interfaces. An implementer could write a credit analysis node that returns `{"score": 0.85}` instead of `{"confidence": 0.85, "recommendation": "APPROVE", ...}` and the type checker would not catch the mismatch.

The file structure (line 1963) references `packages/api/src/agents/state.py` as the location for these types. The JSON response shapes in Section 4.2 (lines 755-794) show the expected structure at the API boundary, but the internal agent-to-agent contracts via graph state are not formally typed.

**Suggestion:** Define concrete TypedDicts (or Pydantic models) for each agent's output structure: `CreditAnalysisResult`, `RiskAssessmentResult`, `ComplianceCheckResult`, `FraudDetectionResult`, `DocumentResult`, `CoachingOutput`, `AggregatedResults`. These should be defined in `state.py` and used as the value types in `LoanProcessingState`. This makes the agent-to-agent contract verifiable at implementation time and prevents subtle shape mismatches between agents.

---

#### W-4: Product plan references `Authorization: Bearer <role>:<key>` format, architecture uses `Bearer <api_key>` (Section 4.1 / Product Plan)

The product plan (line 392) specifies the authentication format as `Authorization: Bearer <role>:<key>`. The architecture document (Section 4.1, line 638; Section 6.1, line 1447) specifies `Authorization: Bearer <api_key>` with role resolved entirely server-side. The architecture explicitly states: "The key format uses a prefix convention (`mq_` for mortgage quickstart) for human readability, but the server never parses the key -- it simply hashes and looks up. The role is determined entirely by the server-side mapping" (lines 668-669).

The architecture's approach is the correct and more secure design (client-asserted roles in the token would be a security vulnerability). However, this is a deviation from the product plan that should be explicitly noted as a design decision.

**Suggestion:** Add a note in Section 1.2 (Key Architectural Decisions) or Section 6.1 explicitly stating this deviation: "The product plan referenced `Bearer <role>:<key>` format. This was changed to `Bearer <api_key>` with server-side role resolution to prevent client-asserted role escalation." This prevents confusion when an implementer reads both documents.

---

#### W-5: `applications` table missing status enum constraint (Section 3.1, lines 311-338)

The `applications.status` column is defined as `VARCHAR(30)` with a comment listing valid values, but no `CHECK` constraint is defined in the DDL:

```sql
status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
-- Status enum: DRAFT, PROCESSING, DOCUMENT_PROCESSING, PARALLEL_ANALYSIS,
--   AGGREGATED, AUTO_APPROVED, ESCALATED, DENIED,
--   AWAITING_DOCUMENTS, HUMAN_APPROVED, HUMAN_DENIED
```

Similarly, `agent_decisions.agent_name`, `agent_decisions.decision_type`, `audit_events.event_type`, and `users.role` are all `VARCHAR` with comments listing allowed values but no `CHECK` constraints. This means invalid values can be written to the database without error.

**Suggestion:** Add `CHECK` constraints for these columns, or use PostgreSQL `ENUM` types. For example:

```sql
CREATE TYPE application_status AS ENUM (
    'DRAFT', 'PROCESSING', 'DOCUMENT_PROCESSING', ...
);
```

Alternatively, note this as a deliberate decision ("VARCHAR chosen over ENUM for migration flexibility") and enforce the constraint at the application layer via Pydantic validation. Either way, the choice should be explicit.

---

#### W-6: No application-level access control scoping for loan officers (Section 6.2)

The role hierarchy (Section 6.2, lines 1460-1484) defines what actions each role can perform, but does not address data scoping. Can any loan officer view any application? Or can they only view applications they created? The requirements (US-054, line 1505) state "user can only view applications they have access to (role-based)" and (US-055, line 1532) "Only applications the user has access to (based on role) are returned."

The architecture does not specify the access control scoping model. Options include:

1. All authenticated users see all applications (simplest, likely intended for MVP).
2. Users see only applications they created, plus those escalated to their role.
3. Full ownership model with application-level ACLs.

The `applications` table has `created_by UUID NOT NULL REFERENCES users(id)` (line 331) which enables option 2, but no query filter or access check is specified in the architecture.

**Suggestion:** Explicitly state the access scoping model for MVP. If all authenticated users can see all applications, state that as a simplification. If scoping is intended, specify the query filtering logic in the repository layer and document it in the API design section.

---

### Suggestion

#### S-1: Consider adding a `PROCESSING_FAILED` status (Section 3.4)

The current status enum includes `ESCALATED` as the catch-all when processing fails. However, there is a semantic difference between "processing completed but confidence was medium, so a human should review" (which is `ESCALATED`) and "the LLM API was down and processing could not complete" (which is also routed to `ESCALATED` per the error paths table at line 625).

Adding a `PROCESSING_FAILED` status would allow the UI to distinguish between "this needs human judgment" and "this had a technical failure and should be retried or investigated." This distinction is useful for the loan officer dashboard (US-057) and for platform engineers monitoring system health.

---

#### S-2: SSE endpoint uses POST for streaming (Section 4.2, line 959)

The streaming chat endpoint `POST /v1/public/chat/stream` uses the POST method, which is the correct choice since it sends a request body. However, some older SSE client libraries expect a GET-based EventSource pattern. The architecture should confirm that the frontend will use the `fetch` API with a streaming body reader rather than the native `EventSource` API (which only supports GET).

The architecture specifies React 19 + TanStack Query on the frontend, so `fetch` is the expected approach. Consider adding a brief note in the SSE section clarifying the client-side consumption pattern.

---

#### S-3: Consider documenting the `aggregation_completed` audit event type

The data flow in Section 3.4 (line 585) references `audit_event: aggregation_completed`, but this event type is not listed in the `audit_events.event_type` comment at lines 405-411. The comment lists `workflow_initialized`, `agent_dispatched`, `agent_completed`, `routing_decision`, `escalated`, `auto_approved`, `denied`, etc. -- but not `aggregation_completed`.

**Suggestion:** Add `aggregation_completed` to the event_type comment in the `audit_events` DDL to maintain consistency between the schema definition and the data flow description.

---

#### S-4: Clarify ivfflat index parameters for embeddings table (Section 3.1, lines 496-497)

The embeddings table creates an ivfflat index with `lists = 100`:

```sql
CREATE INDEX idx_embeddings_vector ON embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

The `lists` parameter should be tuned based on the expected row count (typically `lists = sqrt(n)` or `lists = n/1000`). For a compliance knowledge base with hundreds of documents, 100 lists may be excessive (leading to many empty lists and suboptimal search). This is a Phase 3a concern, but worth noting.

**Suggestion:** Add a comment noting that the `lists` parameter should be re-evaluated when the knowledge base size is known, or set a lower default (e.g., `lists = 10`) for the MVP.

---

#### S-5: `FRED_API_KEY` listed as optional but FRED integration is P0 (Appendix A, line 2453)

Appendix A lists `FRED_API_KEY` under "Optional" environment variables. However, FRED integration for mortgage rates is a P0 feature (Phase 3b). Without the key, FRED API calls will fail and the system falls back to a hardcoded 6.5% rate.

The architecture correctly specifies fallback behavior (Section 2.6, line 268), so the system functions without it. But listing it as "Optional" may cause confusion for developers who expect P0 features to work out of the box.

**Suggestion:** Move `FRED_API_KEY` to a "Required for Phase 3b+" section, or add a note: "Optional for Phase 1-2; required for Phase 3b+ to enable live rate data."

---

### Positive

#### P-1: Checkpoint forward-compatibility strategy (Section 10.3, lines 2139-2167)

The decision to define the complete graph structure in Phase 1 with stub implementations is a particularly well-thought-out design choice. It prevents the most common LangGraph migration pain point (changing graph topology invalidates existing checkpoints) and is well-reasoned: the negative consequence (stub nodes in Phase 1) is minimal for a quickstart, while the positive consequence (zero checkpoint migration across all phases) is substantial. This is the kind of forward-looking decision that separates a thoughtful architecture from a phase-by-phase improvisation.

---

#### P-2: Separate connection pools for application and LangGraph (Section 10.2, lines 2103-2137)

The decision to use separate asyncpg connection pools for application queries and LangGraph checkpoint operations demonstrates an understanding of resource contention in concurrent async systems. The analysis includes total connection math (25 total vs. PostgreSQL's 100 default max_connections) and clearly explains the failure mode being prevented (checkpoint writes starving application queries). The code sample showing the DSN manipulation (`replace("+asyncpg", "")`) is practical and directly implementable.

---

#### P-3: Comprehensive error paths table (Section 3.4, lines 619-628)

The error paths table at each boundary of the application processing data flow is thorough and actionable. Each row specifies: the step, the failure mode, and the exact behavior (return code, state transition, escalation). This is the kind of specification that prevents implementers from guessing what the system should do when things go wrong.

---

#### P-4: Security-aware prompt injection defense design (Section 6.3, lines 1537-1554)

The multi-layer prompt injection defense is well-structured: input sanitization, length validation, semantic detection, output filtering, and structured prompting. The decision to hash (not log verbatim) flagged inputs is a good security practice -- it enables security monitoring without storing potentially malicious payloads. The generic rejection message ("I can only help with mortgage-related questions") avoids revealing detection logic to attackers.

---

#### P-5: Mocked service interface pattern with Protocol classes (Section 2.6, lines 274-300)

The use of Python `Protocol` classes for mocked services (credit bureau, employment verification, property data) is clean and practical. It enforces interface compatibility at the type-checking level while allowing environment-variable-based switching between real and mock implementations. The dependency injection pattern via FastAPI's `Depends()` is standard and well-documented.

---

#### P-6: Thorough phase-by-phase build order with dependency-aware sequencing (Section 11, lines 2200-2435)

Each phase specifies not just what to build, but the build order within the phase, with clear dependency relationships (e.g., Phase 2: PII redaction blocks document processing; document processing blocks credit analysis). Each step has an interface specification and an exit criterion. This level of planning significantly reduces the risk of blocked work and rework.

---

## Summary of Findings

| # | Severity | Section | Summary |
|---|----------|---------|---------|
| W-1 | Warning | 9 (File Structure), line 1929 | Dangling tree node (incomplete line) in file structure |
| W-2 | Warning | 5.2 / 3.1 | `chat_history` table referenced but not defined in schema |
| W-3 | Warning | 5.1, lines 1064-1103 | Agent state uses untyped `dict` / `list[dict]` instead of concrete TypedDicts |
| W-4 | Warning | 4.1 / 6.1 | Auth format deviation from product plan not explicitly documented as design decision |
| W-5 | Warning | 3.1 | Status and enum-like columns lack `CHECK` constraints or explicit justification |
| W-6 | Warning | 6.2 | Application-level data access scoping not specified |
| S-1 | Suggestion | 3.4 | Consider adding `PROCESSING_FAILED` status to distinguish technical failures from confidence-based escalation |
| S-2 | Suggestion | 4.2 | Clarify SSE client consumption pattern (fetch vs EventSource) |
| S-3 | Suggestion | 3.4 / 3.1 | `aggregation_completed` audit event type missing from schema comment |
| S-4 | Suggestion | 3.1 | ivfflat `lists` parameter may need tuning for knowledge base scale |
| S-5 | Suggestion | Appendix A | `FRED_API_KEY` listed as optional despite being required for P0 Phase 3b features |
| P-1 | Positive | 10.3 | Checkpoint forward-compatibility strategy is well-designed |
| P-2 | Positive | 10.2 | Separate connection pools prevent resource contention |
| P-3 | Positive | 3.4 | Error paths table is thorough and actionable |
| P-4 | Positive | 6.3 | Prompt injection defense design is security-aware |
| P-5 | Positive | 2.6 | Protocol-based mocked service pattern is clean |
| P-6 | Positive | 11 | Phase-by-phase build order is dependency-aware and well-sequenced |

---

## Verdict

**APPROVE WITH CONDITIONS**

This is an exceptionally thorough architecture document. It passes all five Technical Design Review Checklist items. The contracts are concrete (SQL DDL, JSON shapes, Python types, file paths), error paths are covered at every boundary, exit conditions are machine-verifiable, the file structure correctly acknowledges the current repository state, and open questions are explicitly flagged rather than silently left as TBDs.

The six Warning findings should be addressed before implementation begins, but none are blocking -- they are clarifications and tightening of contracts rather than fundamental design flaws:

**Conditions for unconditional approval:**

1. **Fix the dangling line in file structure** (W-1) -- trivial edit.
2. **Address `chat_history` table reference** (W-2) -- either add schema definition or qualify the reference as Phase 4.
3. **Define typed structures for agent state** (W-3) -- the most substantive condition. Define concrete TypedDicts for agent output shapes in `state.py`. This is the single largest gap in the architecture: the agent-to-agent contracts are documented in comments and JSON response examples but not in typed Python structures that the implementation can enforce.
4. **Document the auth format deviation** (W-4) -- brief note explaining the change from product plan.
5. **Decide on database-level or application-level enum enforcement** (W-5) -- either add `CHECK` constraints or document the decision to enforce at the application layer.
6. **Specify application data scoping model** (W-6) -- state whether all authenticated users see all applications, or whether scoping is per-user.
