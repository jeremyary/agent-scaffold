<!-- This project was developed with assistance from AI tools. -->

# Architecture Review -- Backend Developer

| Field | Value |
|-------|-------|
| **Reviewer** | Backend Developer |
| **Artifact** | `plans/architecture.md` |
| **Date** | 2026-02-12 |
| **Verdict** | **APPROVE** |

---

## Critical Findings

### B-C1: bcrypt for API Key Lookup on Every Request Is a Performance Bottleneck

**Section:** Authentication and Authorization, line 655 ("Looks up `key_hash` in `api_keys` table (bcrypt comparison)")

bcrypt is intentionally slow by design (100-300ms per comparison depending on cost factor). Using bcrypt comparison on every authenticated request means every protected API call incurs this latency. With even moderate concurrency (10 concurrent users), auth resolution alone could saturate the event loop or force unacceptable response times.

**Recommendation:** Use a fast hash (SHA-256 or BLAKE2b) for the key lookup/comparison, with bcrypt reserved for password-like scenarios. Alternatively, resolve the key once and cache the `AuthContext` in Redis with a short TTL (e.g., 5 minutes) keyed on a fast hash of the bearer token. The architecture should specify which approach to use; leaving it to Technical Design risks inconsistent implementations.

---

## Warning Findings

### B-W1: LangGraph Graph Invocation Pattern Left as Open Question Creates Phase 1 Implementation Ambiguity

**Section:** Open Questions, line 1156 ("The Technical Design should specify whether this is synchronous ... or asynchronous")

The architecture acknowledges this is unresolved (Open Question #2) but the data flow section (lines 519-522) already describes "Enqueue LangGraph workflow invocation" -- implying async. Meanwhile, Phase 1 is supposed to deliver a working orchestration skeleton with checkpointing. Without a clear decision here, the Phase 1 implementer has to make an architectural choice that should have been made at this level.

**Recommendation:** Commit to the async background task pattern now. The architecture already describes all the polling infrastructure (application status, document status). A synchronous graph invocation that blocks for minutes is incompatible with FastAPI's async design and would require a fundamentally different error handling model. This should not be deferred.

### B-W2: Dual Connection Pool with Separate `audit_writer` Role Creates Three Effective Pools

**Section:** Data Architecture (line 171, "Two async pools") and Security Architecture (line 758, "dedicated `audit_writer` PostgreSQL role")

The architecture describes two connection pools (transactional and RAG) plus a dedicated `audit_writer` PostgreSQL role for audit event inserts. If the audit_writer role requires a separate connection string (different role credentials), that is effectively a third connection pool. With SQLAlchemy 2.0 async, each `create_async_engine()` call creates an independent pool. Three pools against a single PostgreSQL instance (plus LangGraph's PostgresSaver, which also opens connections) means significant connection pressure.

**Recommendation:** Clarify whether the `audit_writer` role uses a separate connection pool or whether audit inserts run through the transactional pool with a `SET ROLE audit_writer` per-transaction. The latter is simpler and avoids the third pool, though it requires the transactional pool's role to have `SET ROLE` privilege. The Technical Design needs this decision, not just the role name.

### B-W3: Hash Chaining for Audit Events Has Concurrency Implications

**Section:** Security Architecture, line 762 ("Each audit event includes `prev_event_hash` containing SHA-256 of the previous event")

Hash chaining requires knowing the hash of the most recent event before inserting the next one. With concurrent requests writing audit events for the same application (e.g., parallel agent decisions in the fan-out step), this creates serialization pressure. Two concurrent inserts for the same `application_id` must be ordered, which either requires explicit locking or results in failed inserts due to stale `prev_event_hash`.

This is especially problematic during the parallel analysis fan-out (lines 532-537) where credit analyst, risk assessor, and compliance checker all complete around the same time and each needs to write an audit event.

**Recommendation:** Specify the concurrency strategy. Options: (a) hash chain is global per application with an advisory lock on insert, (b) hash chain is global but the chain links are established asynchronously by a background worker rather than inline with the insert, or (c) accept that concurrent events may have the same `prev_event_hash` (weakens tamper detection but simplifies implementation). The Technical Design should not have to invent this.

### B-W4: Retry Endpoint Semantics Need Clarification for LangGraph Checkpoint Interaction

**Section:** Error path (line 572-574), "user can retry via `POST /v1/applications/:id/retry`"

The architecture states that on retry "only the failed agent re-executes" via LangGraph checkpointing (line 574). However, it also states that the application transitions to `processing_error` status (line 572). Resuming a checkpointed LangGraph graph from a specific node requires re-invoking the graph with the existing thread_id/checkpoint. The retry endpoint needs to:
1. Transition status back from `processing_error` to `processing`
2. Re-invoke the graph with the same thread_id so PostgresSaver resumes from the checkpoint
3. Handle the case where the checkpoint itself is corrupted or the error was in state serialization

The architecture should at minimum confirm that retry means "re-invoke the same graph thread" rather than "create a new graph invocation with the same input data," as these have very different implementation implications.

**Recommendation:** Add a sentence confirming the retry mechanism: re-invoke the existing LangGraph thread (same `thread_id`) so the graph resumes from the last successful checkpoint. Note that this means the `thread_id` must be stored on or derivable from the `loan_applications` record.

---

## Suggestion Findings

### B-S1: Protocol Classes Should Use `async` Method Signatures Consistently

**Section:** Mocked Service Architecture, lines 848-865

The Protocol class examples show method signatures without `async`:

```python
class CreditBureauService(Protocol):
    async def get_credit_report(self, ssn_token: str) -> CreditReport: ...
```

Wait -- looking again, the API Designer advisory (line 148-155) does include `async` in the Protocol signatures, and the architecture document's factory function example (lines 881-885) returns synchronous constructors. This is actually consistent.

However, the architecture does not specify whether mock implementations should be `async` (returning completed awaitables) or synchronous. With FastAPI's async handlers, calling a synchronous mock from an async handler without `run_in_executor` will block the event loop. Since the architecture mandates "All endpoints are async" (line 155), the mocks must also be async.

**Recommendation:** Add a note that all Protocol methods are `async` and both mock and real implementations must be `async def`. This prevents a subtle blocking bug in development where synchronous mocks appear to work but degrade under concurrent load.

### B-S2: Financial Value Conversion Between Cents (DB) and String Decimals (API) Needs a Defined Location

**Section:** Financial Value Serialization Convention (lines 629-631), Financial Precision (DB advisory section 6)

The architecture specifies: integer cents in DB, `Decimal` in Python, string decimals in API JSON. This is a sound pattern, but the conversion logic needs to live somewhere specific. Without guidance, each route handler may implement its own cents-to-string conversion, leading to inconsistencies (e.g., `"250000"` vs `"250000.00"` vs `"$250,000.00"`).

**Recommendation:** Note that conversion should be handled in the Pydantic response model layer (custom serializers on model fields), not in route handlers or service functions. This centralizes the conversion and ensures all monetary fields serialize consistently.

### B-S3: Consider Storing `langgraph_thread_id` Explicitly on `loan_applications`

**Section:** Loan Processing Graph (lines 240-249), Open Questions #2

The graph state contains `application_id` and the checkpoint is stored by LangGraph's thread_id. The architecture does not specify how the application record maps to its LangGraph thread. Without an explicit `langgraph_thread_id` column on `loan_applications`, the system must derive the thread_id (e.g., use `application_id` as the thread_id, or maintain a lookup). Using `application_id` directly as the thread_id is the simplest approach but should be stated explicitly.

**Recommendation:** Either add a `langgraph_thread_id` column to `loan_applications` or explicitly state that `application_id` is used as the LangGraph `thread_id`. This is needed for retry logic (B-W4) and status polling.

### B-S4: `confidence_thresholds` Table Referenced but Not Defined in Schema

**Section:** Database Schema Design (line 375) lists `confidence_thresholds` in the public schema table list. Confidence Aggregation (line 266) references "loaded from the database (`admin/thresholds` table)."

The `confidence_thresholds` table appears in the schema overview list but has no column definition like the other core entities. Since thresholds drive the critical routing logic (auto-approve vs escalate), the structure matters.

**Recommendation:** Add a column definition for `confidence_thresholds` (likely: `id`, `threshold_name`, `value NUMERIC`, `updated_by FK`, `updated_at`, `is_active`) or explicitly note it is deferred to Technical Design.

---

## Positive Findings

### B-P1: Protocol + Factory Pattern for Mocked Services Is Excellent

**Section:** Mocked Service Architecture, lines 848-888

The `Protocol` class approach with factory functions wired through FastAPI `Depends()` is a clean, idiomatic pattern that works extremely well with FastAPI's dependency injection. It provides type safety (Protocol structural subtyping), testability (swap in test doubles trivially), and runtime flexibility (config-driven implementation selection). This is the right abstraction level -- not over-engineered, immediately practical.

### B-P2: Intake Agent Architectural Isolation Is Well-Designed

**Section:** Intake Graph (lines 293-339), Public Tier Sandboxing (lines 738-752)

The decision to make the intake graph a completely separate LangGraph instance with its own tool set and no code path to application data is a strong security boundary. This is not just a permission check -- it is an architectural impossibility for the intake agent to access loan data. The explicit enumeration of "CAN access" vs "CANNOT access" makes the boundary auditable.

### B-P3: Three-Schema Isolation with Separate Pools Is Pragmatic

**Section:** ADR-004, Data Architecture

Using `public`, `rag`, and `langgraph` schemas within a single PostgreSQL instance is the right trade-off for an MVP. It provides workload isolation (separate pools, separate timeouts) without the operational complexity of multiple databases. The separate `statement_timeout` for RAG queries is a thoughtful detail that prevents vector scans from blocking transactional queries.

### B-P4: Phase 1 Includes Audit Trail and Checkpointing as Foundational Infrastructure

**Section:** ADR-001, ADR-003, Phased Implementation Phase 1

The decision to deliver audit trail infrastructure and LangGraph checkpointing in Phase 1 (rather than deferring them) is architecturally sound. Retrofitting either of these after multiple phases of development would be significantly more expensive. The architecture correctly identifies that the cost of including them from day one is near-zero while the cost of retrofitting is high.

### B-P5: Error Path Design Is Realistic

**Section:** Error path (lines 569-575)

The distinction between required agents (failure halts workflow) and optional agents (failure continues with degraded results) is practical and reflects real-world processing pipelines. The retry-with-backoff strategy (3 attempts, exponential) is standard and appropriate for LLM API calls. The `processing_error` status with explicit retry endpoint gives operators clear control.

---

## Cross-References

No teammate reviews were available at the time of this review. Cross-references will be noted if applicable in a follow-up.

**Alignment with API Designer advisory:** The API Designer's endpoint groupings, auth middleware pattern, and mocked service protocol approach are all faithfully reflected in the architecture. No conflicts observed.

**Alignment with Database Engineer advisory:** The DB advisory's schema design, PII encryption strategy, financial precision types, and audit trail immutability enforcement are incorporated. One minor difference: the DB advisory mentions `ivfflat` as an option alongside `HNSW` for the vector index; the architecture correctly chose HNSW for the expected document count. No conflicts.

---

## Summary

The architecture is well-structured and implementation-feasible for the described scope. The package layout, dependency boundaries, and technology choices are sound. The most significant implementation concern is the **bcrypt-on-every-request authentication pattern** (B-C1), which will cause measurable latency on all authenticated endpoints and should be addressed before Technical Design. The **hash chaining concurrency** issue (B-W3) and **graph invocation pattern** (B-W1) are the next most important items to resolve, as they affect Phase 1 and Phase 2 implementation directly.

The architecture appropriately defers implementation details (exact class hierarchies, specific library API calls) to Technical Design while providing enough structure for implementers to work without ambiguity on most components. The open questions are well-identified and reasonable to resolve during Technical Design, with the exception of graph invocation (B-W1), which should be resolved at the architecture level.

Verdict: **APPROVE** -- the architecture is ready for Technical Design with the caveat that B-C1 should be addressed (either in a revision or as a binding constraint in the Technical Design).
