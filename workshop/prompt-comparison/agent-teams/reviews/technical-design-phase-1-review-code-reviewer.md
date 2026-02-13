<!-- This project was developed with assistance from AI tools. -->

# Technical Design Phase 1 Review -- Code Reviewer

**Reviewer:** Code Reviewer (Opus)
**Document:** `plans/technical-design-phase-1.md` (2085 lines)
**Cross-referenced:** `plans/requirements.md`, `plans/requirements-chunk-1-foundation.md`, `plans/requirements-chunk-2-core-workflow.md`
**Date:** 2026-02-12

---

## Review Summary

This is a thorough, well-structured Technical Design Document that covers 37 Phase 1 stories across 9 feature areas with concrete interface contracts, database schema, implementation code, and machine-verifiable exit conditions. The document is highly implementable. However, it contains several internal inconsistencies between its own sections (e.g., a column decided but not added to the schema, a Pydantic model referenced but never defined, a checkpointer parameter accepted but not wired), one financial precision mismatch between the API validation layer and the database constraints, and a typo in a binding JSON field name. These issues would cause bugs if implemented as-written.

---

## Findings

### Critical

- **[technical-design-phase-1.md:1551-1587]** -- The stub graph is compiled without a checkpointer, and the `invoke_workflow` function accepts a `checkpointer` parameter but never passes it to the graph. At line 1562, `graph.compile()` is called without `checkpointer=checkpointer`. At line 1587, `graph.ainvoke()` runs the graph but the compiled graph has no checkpoint persistence. This means CHECKPOINT-01 (save workflow state after each agent node) and CHECKPOINT-02 (application ID as thread ID for resumability) cannot work as designed.
  **Suggestion:** Change `build_loan_processing_graph()` to accept a `checkpointer` parameter and compile with it: `return graph.compile(checkpointer=checkpointer)`. Alternatively, pass the checkpointer at invocation time in `invoke_workflow`: `graph = build_loan_processing_graph(checkpointer)`.

- **[technical-design-phase-1.md:335, 307, 420]** -- The JSON alias for `analysis_pass` is `"analysiPass"` (missing the `s` -- should be `"analysisPass"`). This appears in the Pydantic response model at line 335 (`alias="analysiPass"`) and in the JSON response examples at lines 307 and 420. This is a binding contract, so implementers would faithfully reproduce this typo, creating a misspelled field in every API response.
  **Suggestion:** Change the alias to `"analysisPass"` (with the `s`) in the `ApplicationResponse` model and all JSON examples.

### Warning

- **[technical-design-phase-1.md:786 vs 268-273]** -- The database constraint for `annual_income_cents` is `CHECK (annual_income_cents >= 0)` (non-negative, allows zero), but the Pydantic validator at line 268 enforces `annual_income > 0` (strictly positive, rejects zero). The requirements (APP-01 AC-3) say "zero (for loan amount, property value, annual income)" should be rejected, confirming the Pydantic validator is correct and the DB constraint is wrong. The DB should use `CHECK (annual_income_cents > 0)` to match.
  **Suggestion:** Change line 786 from `CONSTRAINT chk_annual_income_non_negative CHECK (annual_income_cents >= 0)` to `CONSTRAINT chk_annual_income_positive CHECK (annual_income_cents > 0)`.

- **[technical-design-phase-1.md:2049 vs 760-798]** -- The Risks section explicitly decides to add an `escalated_at TIMESTAMPTZ` column to `loan_applications` and states "Decision: add the column in the Phase 1 migration." However, the `CREATE TABLE loan_applications` at lines 760-798 does not include this column. This is a self-contradictory gap -- implementers will follow the CREATE TABLE and omit the column, defeating the decision.
  **Suggestion:** Add `escalated_at TIMESTAMPTZ` to the `loan_applications` CREATE TABLE statement (nullable, set when transitioning to `awaiting_review`). Also add it to the `ApplicationResponse` Pydantic model if it should be exposed in the API.

- **[technical-design-phase-1.md:339]** -- The `ApplicationResponse` model references `list["DocumentSummaryResponse"]` at line 339, but `DocumentSummaryResponse` is never defined anywhere in the TD. `DocumentResponse` (line 507) and `DocumentDetailResponse` (line 518) are defined, but there is no summary variant. Implementers will have to guess the shape of this model.
  **Suggestion:** Define `DocumentSummaryResponse` explicitly. Based on the JSON example at lines 424-434, it would include `id`, `originalFilename`, `mimeType`, `fileSizeBytes`, `documentType`, `processingStatus`, and `createdAt`. It could be identical to `DocumentResponse` or a subset. Define it as a concrete Pydantic model in the Interface Contracts section.

- **[technical-design-phase-1.md:526-534]** -- The TD maps DOC-03 to `GET /v1/documents/:id` (View Document Detail) and DOC-04 to `GET /v1/documents/:id/download` (Download Document). However, the master requirements story map (`requirements.md` lines 75-76) defines DOC-03 as "Download a Document" and DOC-04 as "List Documents for an Application." The chunk-2 requirements redefine these differently again (DOC-03 = "View Document Processing Status", DOC-04 = "Download Uploaded Documents"). The TD follows the chunk-2 ACs, which is correct since those have the binding acceptance criteria, but there is no explicit `GET /v1/applications/:id/documents` list endpoint. The document listing is only available embedded within the application detail response.
  **Suggestion:** Note the story map inconsistency explicitly in the TD's Requirements Inconsistencies section. Consider whether a dedicated `GET /v1/applications/:id/documents` list endpoint is needed for cases where a client wants document metadata without loading the full application detail. If not needed, document the rationale.

- **[technical-design-phase-1.md:1254-1256]** -- The production credential check uses `ApiKey.is_seed == True` (Python `True`, not SQLAlchemy `true()`). While this works in SQLAlchemy 2.0 due to operator overloading on mapped columns, it triggers a `SAWarning` in many SQLAlchemy versions and is flagged by linters. The idiomatic SQLAlchemy 2.0 way is `ApiKey.is_seed.is_(True)` or `ApiKey.is_seed == sa.true()`.
  **Suggestion:** Use `ApiKey.is_seed.is_(True)` for clarity and to avoid linter warnings.

- **[technical-design-phase-1.md:1265-1266]** -- The production credential check for default database password uses string matching: `"postgres" in settings.database_url and ":postgres@" in settings.database_url`. The first condition (`"postgres" in settings.database_url`) will always be true for any PostgreSQL database URL since the scheme itself is `postgresql+asyncpg://...`. This makes the check depend entirely on the second condition. The first condition should be removed or made more specific.
  **Suggestion:** Remove the redundant `"postgres" in settings.database_url` check. The `:postgres@` check alone is sufficient to detect the default password, or use URL parsing to extract the password component properly.

### Suggestion

- **[technical-design-phase-1.md:852]** -- The `audit_events.confidence_score` column is `NUMERIC(4,3)`, which supports values from 0.000 to 9.999. Since confidence scores are defined as 0.0-1.0, the precision is correct but the range is unnecessarily wide. A `NUMERIC(4,4)` would constrain to 0.0000-0.9999, or the CHECK constraint at line 869 (`confidence_score >= 0 AND confidence_score <= 1`) could be tightened. This is cosmetic since the CHECK handles it, but `NUMERIC(4,3)` could store 9.999 which the CHECK prevents.
  **Suggestion:** Consider `NUMERIC(5,4)` for 0.0000-1.0000 if you want 4-decimal precision, or leave as-is since the CHECK constraint provides the real guard.

- **[technical-design-phase-1.md:807]** -- The `documents.file_size_bytes` column uses `INTEGER`, which caps at ~2.1GB. The max upload size is 20MB, so INTEGER is sufficient. However, if the max file size is ever increased, this could silently overflow. Using `BIGINT` here (as was done for monetary cents) would be more future-proof.
  **Suggestion:** Keep `INTEGER` since 20MB is well within range, but add a comment noting the INT limit if the max file size setting is ever raised significantly.

- **[technical-design-phase-1.md:1619-1661]** -- The `Settings` class has `encryption_key: str = ""` and `hmac_secret_key: str = ""` with empty string defaults. In development mode this means the encryption and HMAC services will receive empty strings, which could cause cryptographic errors (Fernet requires a valid base64-encoded 32-byte key). The production check at line 1269-1272 catches missing secrets, but in development mode an empty string will cause a runtime crash on first PII encryption rather than a clear startup error.
  **Suggestion:** Either generate development-only default keys (like the MinIO defaults) and document them in `.env.example`, or add a development-mode startup warning that these are required even in dev mode.

- **[technical-design-phase-1.md:1799-1821]** -- Several exit condition verification commands assume specific test function names (e.g., `pytest ... -k "seed_data"`, `-k "production_credential"`). These naming assumptions create a soft coupling between the TD and test implementation. If tests are named differently, the exit condition commands will pass vacuously (selecting zero tests and returning success).
  **Suggestion:** Add a note that exit condition test filters assume the naming convention documented here, and that test files should use these keywords in test function names.

- **[technical-design-phase-1.md:overall]** -- The TD resolves Open Question 4 from requirements.md ("Document upload limit per application") by adding a 25-document maximum (line 2050), but this limit does not appear in the Pydantic request validation, the document upload route handler description, or the database schema. It is only in the Risks table.
  **Suggestion:** Add the 25-document limit to the data flow for DOC-01 (step 3 or 4), as a check before upload proceeds. Also add it to the Settings class as a configurable value.

### Positive

- **[technical-design-phase-1.md:192-206]** -- The state machine implementation is clean and correct. The `VALID_TRANSITIONS` dict, `TERMINAL_STATES` set, and `is_valid_transition()` function match the requirements exactly for Phase 1 scope, including the deliberate omission of Phase 4 transitions (`awaiting_documents`). The explicit check for terminal states before consulting the transitions map is a good defensive pattern.

- **[technical-design-phase-1.md:1282-1333]** -- The encryption service design with key version byte prefix is well thought out. Using a single version byte prepended before the Fernet ciphertext is the correct approach (Fernet tokens have fixed internal structure). The dual-key rotation mechanism with `KEY_VERSION_CURRENT` and `KEY_VERSION_PREVIOUS` is clean, and the explicit error for missing previous key during decryption prevents silent failures.

- **[technical-design-phase-1.md:1347-1512]** -- The audit service implementation is thorough. Using `SET LOCAL ROLE` (transaction-scoped) instead of `SET ROLE` (session-scoped) prevents role leakage across connection-pooled requests. The advisory lock using `pg_advisory_xact_lock(hashtext(application_id))` is correct -- the xact variant auto-releases at transaction end, preventing lock leaks. The hash chain computation, null sentinel, and system event handling are all clearly specified.

- **[technical-design-phase-1.md:730-798]** -- The database schema is comprehensive with appropriate constraints, indexes, and deliberate design choices. Using `BIGINT` for monetary cents columns (with documented rationale), CHECK constraints on all enum-like columns, partial indexes on `is_active`, and a UNIQUE index on `key_hash` all demonstrate careful database design.

- **[technical-design-phase-1.md:1082-1113]** -- The correlation ID middleware correctly sanitizes malicious X-Request-ID values with a regex check before trusting client input. Running this middleware before authentication is the right ordering decision -- it ensures even failed auth attempts are traceable.

- **[technical-design-phase-1.md:2059-2068]** -- The Requirements Inconsistencies section proactively flags 4 discrepancies between the requirements and this TD, with clear resolutions for each. This is exactly what a TD should do with upstream ambiguities -- surface them explicitly rather than making silent assumptions.

- **[technical-design-phase-1.md:1845-2042]** -- The context packages are well-structured for downstream work breakdown. Each work area lists specific files to read, binding contracts, key decisions, and scope boundaries. This gives implementers a clear starting point without requiring them to read the full 2085-line document.

---

## Checklist Assessment

| TD Review Check | Status | Notes |
|---|---|---|
| Contracts concrete? | Pass (with exceptions) | JSON shapes, Pydantic models, and SQL DDL are concrete and typed. Two exceptions: `DocumentSummaryResponse` referenced but undefined; `analysiPass` typo in binding alias. |
| Error paths covered? | Pass | All 5 data flows include explicit error handling at each boundary (auth, validation, ownership, state machine, audit). Error class hierarchy maps cleanly to HTTP status codes. |
| Exit conditions verifiable? | Pass | All 20 exit conditions use `pytest`, `curl`, `alembic`, or `make` commands. Each returns pass/fail. Minor concern: `-k` filters could match zero tests and pass vacuously. |
| File structure maps to codebase? | Pass | All proposed paths use `packages/api/` and `packages/db/` per the monorepo architecture. Python package layout follows FastAPI conventions (routes, services, models, middleware). |
| No TBDs in binding contracts? | Pass | No "TBD", "to be determined", or vague placeholders found in any interface contract. All types are concrete. |
| Financial precision convention? | Partial pass | Pydantic models correctly use string decimals for API JSON. DB uses integer cents (`BIGINT`). However, `annual_income_cents` DB constraint allows zero while the API rejects it. |
| State machine matches requirements? | Pass | `VALID_TRANSITIONS` exactly matches the Phase 1 valid transitions from APP-05 AC-1. Phase 4 transitions are correctly omitted and documented. |
| All 37 stories covered? | Pass | AUTH-01 through AUTH-08 (8), AUDIT-01 through AUDIT-04 (4), PII-01/02/04 (3), CHECKPOINT-01 through CHECKPOINT-03 (3), DX-01 through DX-04 (4), OBS-01 through OBS-03 (3), DEPLOY-03 (1), APP-01 through APP-07 (7), DOC-01 through DOC-04 (4) = 37 stories. Each has at least one interface contract or data flow. |
| Context packages well-structured? | Pass | 7 work areas with clear file lists, binding contracts, key decisions, and scope boundaries. Good for downstream task decomposition. |
| Python/FastAPI conventions? | Pass | Dependency injection via `Depends()`, Pydantic models for validation, async handlers, structured logging with `structlog`, Alembic for migrations. All standard FastAPI patterns. |

---

## Verdict

**REQUEST_CHANGES**

The two Critical findings (checkpointer not wired to graph compilation, and `analysiPass` typo in a binding contract) would cause functional defects if implemented as-written. The Warning-level internal inconsistency between the decided `escalated_at` column and the actual schema, the undefined `DocumentSummaryResponse`, and the `annual_income_cents` constraint mismatch should also be resolved before this TD is used for work breakdown.

The overall quality of this document is high -- it is one of the most thorough TDs I have reviewed, with concrete code, complete SQL DDL, and explicit requirements traceability. The issues are fixable in a single revision pass.
