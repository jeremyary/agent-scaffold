<!-- This project was developed with assistance from AI tools. -->

# Technical Design Review -- Phase 1: Foundation

| Field | Value |
|-------|-------|
| **Document Reviewed** | `plans/technical-design-phase-1.md` v1.0 |
| **Reviewer** | Code Reviewer |
| **Review Date** | 2026-02-12 |
| **Upstream Documents** | `plans/architecture.md` v1.0, `plans/requirements.md`, `plans/product-plan.md` |
| **Verdict** | **APPROVE WITH CONDITIONS** |

---

## Review Summary

This Phase 1 Technical Design is a strong document that significantly improves on the architecture's abstract contracts by providing concrete Pydantic models, fully typed ORM definitions, repository signatures, and LangGraph state TypedDicts. The 24 work units cover the full Phase 1 scope with a well-structured dependency graph and clear parallelization opportunities. The conditions for approval are: (1) resolve the test file ownership gap where exit conditions reference test files that no WU creates, (2) add the missing `base.py` repository file or remove its reference, and (3) acknowledge the unmapped P0 cross-cutting NFRs with a documented deferral rationale.

---

## Findings

### Critical

**CR-01: Exit conditions reference test files that no WU creates**
- **Severity:** Critical
- **Affected WUs:** P1-WU06, P1-WU07, P1-WU11, P1-WU18
- **Description:** Four WUs have exit conditions that invoke `pytest` against test files that are not listed in any WU's "Files created" section:
  - P1-WU06 and P1-WU07 reference `packages/db/tests/test_repositories.py` (line 1378, 1406)
  - P1-WU11 references `packages/api/tests/integration/test_auth.py` (line 1551)
  - P1-WU18 references `packages/api/tests/integration/test_audit_trail.py` (line 1804)

  Additionally, `packages/db/tests/conftest.py` is never created by any WU, but the db-package pytest invocations will likely need test fixtures for database setup/teardown.

  These exit conditions are impossible to satisfy as specified. Per `agent-workflow.md`, every task must have a machine-verifiable exit condition -- if the test files do not exist, the exit commands will fail with import errors, not with test results.
- **Recommendation:** Either (a) add the test files to the respective WU's "Files created" lists (WU06 creates `packages/db/tests/conftest.py` and `packages/db/tests/test_repositories.py`; WU11 creates `packages/api/tests/integration/test_auth.py`; WU18 creates `packages/api/tests/integration/test_audit_trail.py`), or (b) create a dedicated test infrastructure WU that sits between the repository WUs and the route WUs. Option (a) is simpler but pushes WU06 to 5 files and WU07 to 5 files. Option (b) follows the existing pattern of WU23 (dedicated test WU) more closely.

---

### Warning

**WN-01: P1-WU20 creates 7 files, exceeding the chunking heuristic**
- **Severity:** Warning
- **Affected WU:** P1-WU20 (LangGraph State, Stub Nodes, and Graph Definition)
- **Description:** WU20 creates 7 files spanning three separate directory trees (`agents/`, `agents/nodes/`, `agents/graphs/`). Per `agent-workflow.md`, WUs should touch 3-5 files. While 3 of the 7 are `__init__.py` files (minimal content), the substantive files -- `state.py`, `supervisor.py`, `stubs.py`, and `loan_processing.py` -- cover three distinct concerns: state type definitions, node implementations (supervisor logic + stub logic), and graph wiring.
- **Recommendation:** Split into two WUs: (a) WU20a: State types + graph definition (`state.py`, `loan_processing.py`, `agents/__init__.py`, `agents/graphs/__init__.py`, `agents/graphs/loan_processing.py`) -- pure structural definitions; (b) WU20b: Node implementations (`agents/nodes/__init__.py`, `supervisor.py`, `stubs.py`) -- the behavioral logic. This separates the "what is the shape" concern from the "what do the nodes do" concern.

**WN-02: P1-WU01 creates 7 files (scaffolding)**
- **Severity:** Warning
- **Affected WU:** P1-WU01 (Project Scaffolding and Infrastructure)
- **Description:** WU01 creates 7 files. These are all configuration/scaffolding files rather than application code, so the cognitive load is lower than a 7-file code WU. However, the `Makefile` and `compose.yml` are non-trivial infrastructure files that require careful implementation.
- **Recommendation:** Acceptable as-is given the configuration-only nature of these files. Note for implementer: if the Makefile grows beyond the target commands listed, consider splitting infrastructure setup into a separate WU.

**WN-03: Untyped `list[dict]` fields remain in IntakeState**
- **Severity:** Warning
- **Affected Section:** Section 2.6, `IntakeState` (lines 1057-1058)
- **Description:** The `IntakeState` TypedDict contains two untyped fields:
  ```python
  tool_results: list[dict]
  citations: list[dict]
  ```
  This was flagged in the architecture review as a pattern to avoid in contracts that serve as cross-component interfaces. While the `LoanProcessingState` fields have been significantly improved (e.g., `thresholds` is now `ThresholdsSnapshot`, `previous_analyses` is now `list[PreviousAnalysis]`), the Intake state was not given the same treatment.
- **Recommendation:** Since `IntakeState` is not actively used until Phase 3b, this is acceptable for Phase 1. However, add a comment on these fields: `# TODO: Define concrete TypedDicts before Phase 3b implementation` to ensure they are resolved before the Intake Graph is implemented.

**WN-04: P0 cross-cutting NFRs US-071 and US-072 unmapped to any WU**
- **Severity:** Warning
- **Affected Section:** Section 1.4 (Phase 1 User Stories Covered)
- **Description:** US-071 (Non-Functional Performance Targets) and US-072 (Graceful Degradation When Optional Services Unavailable) are P0 stories with "All Phases" scope, meaning they apply from Phase 1. Neither story appears in the TD's story mapping table or in any WU's "User stories" field. While Phase 1 is mostly stubs (performance is moot for stubs), US-072's acceptance criteria about Redis/MinIO unavailability handling are relevant to Phase 1's readiness check (WU13) and document upload (WU17).
- **Recommendation:** Either (a) add US-072 coverage to WU13 (readiness endpoint already checks dependencies -- add explicit graceful degradation behavior documentation) and WU17 (document upload when MinIO is down), or (b) document in Section 6 (Risks) that these stories are intentionally deferred to Phase 2 with a rationale.

**WN-05: Section 2.4 references `packages/db/src/repositories/base.py` but no WU creates it**
- **Severity:** Warning
- **Affected Section:** Section 2.4 (Repository Interfaces), line 722
- **Description:** The repository interfaces section header states `File: packages/db/src/repositories/base.py`, but this file does not appear in any WU's "Files created" list. WU06 creates `__init__.py`, `application.py`, `document.py`. WU07 creates `audit.py`, `user.py`, `agent_decision.py`, `configuration.py`. If `base.py` is intended to hold shared repository logic or the interface signatures themselves, it needs to be assigned to a WU.
- **Recommendation:** Either (a) add `base.py` to WU06's file list if it contains shared patterns used by all repositories, or (b) change the section header to reference `__init__.py` if the signatures are purely documentary and each repository is self-contained.

**WN-06: TD introduces files not present in architecture file tree**
- **Severity:** Warning
- **Affected Files:** `packages/api/src/errors.py` (WU09), `packages/api/src/routes/submit.py` (WU21), `packages/api/src/agents/nodes/stubs.py` (WU20)
- **Description:** The architecture's file structure (Section 9) does not include `errors.py`, `submit.py`, or `stubs.py`. The TD introduces these as new files. While the TD is the more detailed document and is expected to refine the architecture, these additions should be acknowledged as deviations so that the architecture document can be updated to stay consistent.
  - `errors.py`: Contains the error hierarchy -- a reasonable addition not anticipated by the architecture, which assumed errors would be handled inline or in a framework-default way.
  - `submit.py`: A separate route module for the submit endpoint -- the architecture's `applications.py` route file would become overloaded without this split.
  - `stubs.py`: Consolidates all stub node implementations into one file -- the architecture assumed individual agent node files (`document_processing.py`, `credit_analysis.py`, etc.) which makes sense for Phase 2+ but is unnecessary overhead for Phase 1 stubs.
- **Recommendation:** Add a note in Section 6 (Risks or Downstream Inconsistencies) documenting these file additions and flag the architecture file tree for update after Phase 1 implementation.

**WN-07: `DocumentResult.extracted_data` remains `dict[str, Any]`**
- **Severity:** Warning
- **Affected Section:** Section 2.6, `DocumentResult` (line 945)
- **Description:** The `extracted_data` field on `DocumentResult` is typed as `dict[str, Any]`. In Phase 1, stubs return synthetic data so this is tolerable. However, this field is the primary payload flowing from the document processing agent to all downstream agents -- credit analysis, risk assessment, compliance, and fraud detection all consume it. An untyped dict here means downstream agents must make assumptions about the shape of extracted data, leading to fragile coupling.
- **Recommendation:** Add a TODO comment on this field: `# TODO: Define per-document-type extraction schemas (W2ExtractedData, PayStubExtractedData, etc.) before Phase 2 document processing implementation`. This defers the work but ensures it is tracked.

---

### Suggestion

**SG-01: WU21 description says "Modify main.py" -- should be explicit about the modification pattern**
- **Severity:** Suggestion
- **Affected WU:** P1-WU21 (line 1942)
- **Description:** WU21's description states "Modify main.py to call setup_checkpointer() at startup and register the submit route." This is the only WU that modifies a file created by a different WU (WU19 creates `main.py`). The current phrasing is clear about the intent, but the dependency could be made more explicit.
- **Recommendation:** Add to WU21's description: "This WU modifies `packages/api/src/main.py` (created in WU19) to add checkpointer initialization to the lifespan handler and register the submit route." This makes the cross-WU file modification pattern explicit for the implementer.

**SG-02: Exit conditions use `grep -q "passed"` which is fragile**
- **Severity:** Suggestion
- **Affected WUs:** P1-WU06, P1-WU07, P1-WU11, P1-WU18, P1-WU22, P1-WU23
- **Description:** Several exit conditions pipe pytest output through `grep -q "passed"`. If pytest outputs "1 passed" this works, but if any test fails, pytest also outputs "X passed, Y failed" which still matches the grep. A failing test suite could produce a false positive PASS if at least one test passes.
- **Recommendation:** Use `pytest --tb=short && echo "PASS"` (rely on pytest's exit code, which is non-zero if any test fails) instead of grepping for "passed" in the output. This is the standard pattern for machine-verifiable exit conditions with pytest.

**SG-03: Recommendation enum values diverge from architecture**
- **Severity:** Suggestion
- **Affected Section:** Section 2.1, `Recommendation` enum (lines 198-203)
- **Description:** The architecture's agent result TypedDicts use `APPROVE, DENY, REVIEW` for recommendation values (architecture Section 5.1, lines 1196-1221). The TD's `Recommendation` enum uses `APPROVE, DENY, ESCALATE, FLAG`. The TD's values are arguably better (`ESCALATE` is more precise than `REVIEW`; `FLAG` supports fraud detection's distinct semantics). This divergence is reasonable but undocumented.
- **Recommendation:** Add this to the "Downstream Inconsistencies Detected" section (Section 6): "Architecture uses REVIEW as a recommendation value; TD corrects this to ESCALATE (routing-aligned) and adds FLAG (fraud detection use case)."

**SG-04: WU02 imports from WU03 -- circular timing concern**
- **Severity:** Suggestion
- **Affected WU:** P1-WU02 (line 1248)
- **Description:** WU02's description says: "Import `Base` from `models.py` (created in WU03) for metadata access." But WU02's dependency is listed as P1-WU01, not P1-WU03. If WU02 literally imports from `models.py`, it cannot be completed before WU03. The dependency graph (Section 4) shows WU02 -> WU03 as a dependency chain (WU02 first, then WU03), which is the reverse of what the description implies.
- **Recommendation:** Clarify the implementation pattern. Either: (a) WU02's `engine.py` uses a lazy import of `Base` (imported at function call time, not module load time), making it safe to implement WU02 before WU03 as long as WU03 completes before any engine operations run. Or (b) add P1-WU03 as a dependency of P1-WU02 and restructure the chain. Option (a) is standard practice for async engine setup and is likely the intent, but should be explicit in the WU description.

**SG-05: Consider adding `__init__.py` files to WU01 for package structure**
- **Severity:** Suggestion
- **Affected WU:** P1-WU01
- **Description:** WU01 creates the package scaffolding (`pyproject.toml` files, etc.) but does not create the `packages/api/src/` or `packages/db/src/` directory structures or their `__init__.py` files. These are created piecemeal by later WUs (WU02 creates `packages/db/src/__init__.py`, WU08 creates `packages/api/src/__init__.py`). This means WU01's exit condition (`make setup`) would succeed even if the Python package structure is not importable.
- **Recommendation:** Not blocking, but consider whether WU01 should create the top-level `__init__.py` files to establish the package structure early, allowing all downstream WUs to focus on their specific modules.

**SG-06: `classification_confidence` column precision may be insufficient**
- **Severity:** Suggestion
- **Affected Section:** Section 2.3, Document ORM model (line 569-571)
- **Description:** The `classification_confidence` column is defined as `Numeric(3, 2)`, which allows values from 0.00 to 9.99. Since confidence scores should range from 0.00 to 1.00, a `Numeric(3,2)` is technically too wide -- it accepts values like 5.67 which are invalid. The same applies to `confidence_score` on `AgentDecision` (line 606).
- **Recommendation:** The architecture uses the same precision, so this is consistent. Consider adding a CHECK constraint (`CHECK (classification_confidence >= 0 AND classification_confidence <= 1)`) or documenting that application-layer validation via Pydantic is the enforcement mechanism.

---

### Positive

**PS-01: Interface contracts are exceptionally concrete**
- **Affected Section:** Sections 2.1 through 2.9
- **Description:** The contracts section is the strongest part of this document. Every enum, Pydantic model, ORM model, repository signature, middleware contract, and LangGraph state type is defined with actual code. The `CreateApplicationRequest` model includes field validators, the `ApplicationResponse` includes camelCase aliases, and the error hierarchy includes actual HTTP status codes. This leaves almost no room for implementer interpretation, which is exactly what binding contracts should achieve.

**PS-02: Significant improvement on architecture's untyped state fields**
- **Affected Section:** Section 2.6 (LangGraph State Types)
- **Description:** The architecture review flagged `thresholds: dict` and `previous_analyses: list[dict]` as untyped contracts. This TD resolves both: `thresholds` is now `ThresholdsSnapshot` (a concrete TypedDict with `auto_approve`, `escalation`, `denial` float fields), and `previous_analyses` is now `list[PreviousAnalysis]` (a TypedDict with typed agent result references). Six concrete result types (`CreditAnalysisResult`, `RiskAssessmentResult`, `ComplianceCheckResult`, `FraudDetectionResult`, `AggregatedResults`, `CoachingOutput`) replace the architecture's `dict` placeholders.

**PS-03: Dependency graph with parallelization opportunities is well-structured**
- **Affected Section:** Section 4 (Dependency Graph)
- **Description:** The dependency graph clearly identifies two parallel tracks (database and API types) that converge at the middleware/route layer. The explicit parallelization opportunities section (Track A, Track B, Convergence) makes it straightforward for the Project Manager to schedule WUs for maximum throughput. The independent test track (WU22, WU23) is correctly identified as runnable as soon as its specific dependencies are met.

**PS-04: Context Packages provide focused reading lists per work area**
- **Affected Section:** Section 5 (Context Package)
- **Description:** Each work area (database, middleware, routes, LangGraph) gets a targeted context package listing exactly which architecture sections and TD sections the implementer needs to read. The "Key decisions" subsections surface the most important constraints (e.g., "Redis auth cache deferred to Phase 2", "VARCHAR not ENUM for migration flexibility") that would otherwise require reading the full architecture document to discover. This is exactly the context engineering pattern described in `agent-workflow.md`.

**PS-05: Downstream inconsistencies are proactively documented**
- **Affected Section:** Section 6 (Downstream Inconsistencies Detected)
- **Description:** The TD identifies two inconsistencies with upstream documents (US-055 phasing, auth format divergence) and documents both the inconsistency and the resolution. This prevents implementers from being confused by conflicting instructions across documents and establishes the TD as the authoritative source for Phase 1 implementation details.

**PS-06: Seed data contract is deterministic and developer-friendly**
- **Affected Section:** Section 2.9 (Seed Data Contract)
- **Description:** Using well-known deterministic API keys (with self-documenting names like `mq_lo_dev_key_do_not_use_in_production_1`) eliminates the developer friction of having to generate or look up API keys during initial setup. Flagging them as `is_default=True` to trigger the startup warning (US-060) is a clean pattern that bridges developer experience with security awareness.

---

## Checklist Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Contracts are concrete | PASS | Actual Pydantic code, ORM models, repository signatures, TypedDicts |
| Data flow covers error paths | PASS (partial) | Happy path well-covered; error paths deferred to architecture Section 3.4 by reference. Phase 1 stubs simplify error handling. |
| Exit conditions are machine-verifiable | FAIL | Exit conditions use `pytest` against test files that no WU creates (CR-01). Also, `grep -q "passed"` pattern has false-positive risk (SG-02). |
| File structure maps to actual codebase | PASS (with notes) | Files match architecture layout except for 3 new files (WN-06). `base.py` referenced but not created (WN-05). |
| No TBDs in binding contracts | PASS | No TBDs found in any contract definition |
| WU granularity follows chunking heuristic | PARTIAL | 22 of 24 WUs are within 3-5 files. WU01 and WU20 have 7 files each (WN-01, WN-02). |
| Dependency graph correctly models dependencies | PASS (with note) | WU02's description implies a dependency on WU03 that is not in the graph (SG-04). All other dependencies are correctly modeled. |
| Context packages include required files | PASS | Each work area has targeted reading lists |
| Phase 1 user stories fully covered | PARTIAL | 17 stories mapped. US-071 and US-072 (P0, All Phases) are unmapped (WN-04). |

---

## Verdict

**APPROVE WITH CONDITIONS**

The conditions for unconditional approval are:

1. **[CR-01] Resolve test file ownership.** Every exit condition that references a test file must have that test file assigned to a WU. The recommended approach is to add the test files to the implementing WU's "Files created" list (WU06, WU07, WU11, WU18).

2. **[WN-05] Resolve the `base.py` reference.** Either add the file to a WU or remove the file path from Section 2.4's header.

3. **[WN-04] Document the US-071/US-072 deferral rationale.** Add a note to Section 6 explaining why these P0 cross-cutting NFRs do not have Phase 1 exit conditions, or add minimal coverage to WU13 and WU17.

The warnings (WN-01 through WN-07) and suggestions (SG-01 through SG-06) should be addressed before implementation begins but are not blocking. The positive findings (PS-01 through PS-06) reflect genuinely strong design work, particularly the concrete interface contracts and the context engineering discipline.
