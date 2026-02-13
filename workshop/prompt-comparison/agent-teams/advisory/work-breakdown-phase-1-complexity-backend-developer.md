<!-- This project was developed with assistance from AI tools. -->

# Phase 1 Work Breakdown Complexity Assessment — Backend Developer

**To:** Project Manager
**From:** Backend Developer Agent
**Date:** 2026-02-12
**Re:** Backend implementation complexity assessment for Phase 1 Work Breakdown

This memo flags undersized tasks, hidden dependencies, domain-specific risks, and shared infrastructure requirements for Phase 1 backend work based on Technical Design review.

## Undersized Tasks

The following tasks appear to exceed the 3-5 file / ~1 hour complexity threshold and should be split:

**AUTH task group (8 stories):**
- **AUTH-01 + AUTH-05 + AUTH-06 combined** — Key resolution, role enforcement, and expiration checking touch 5+ files (resolver.py, roles.py, context.py, config.py, errors.py, audit.py for auth failures). Estimate 7-9 files if tests are included. Suggest split: (1) Core key resolution + HMAC lookup (AUTH-01), (2) Role hierarchy + require_role dependency (AUTH-05), (3) Expiration + audit integration (AUTH-06).

**APP task group (7 stories):**
- **APP-01** (Create application) — Touches 8+ files: routes/applications.py, services/application.py, services/encryption.py, services/audit.py, models/requests.py, models/responses.py, db models, test. This is the heaviest single endpoint. Suggest split: (1) Route handler + request validation, (2) Encryption + audit integration.
- **APP-04** (Submit transition with double-transition logic) — Double transition (draft → submitted → processing) with audit event for each + workflow enqueue touches 5+ files. Split: (1) State machine validation + first audit, (2) Second transition + workflow stub invocation.

**DOC task group (4 stories):**
- **DOC-01 + DOC-02** (Upload with validation) — File upload with magic byte validation, PDF/image structure check, MinIO upload, audit event, status guard touches 7+ files: routes/documents.py, services/document.py, services/minio_client.py, services/audit.py, models, db models, test. Split: (1) Basic upload + MinIO, (2) MIME + structure validation, (3) Status guard + audit.

**CHECKPOINT task group:**
- **CHECKPOINT-01 + CHECKPOINT-02** (PostgresSaver setup + stub graph) — Setting up LangGraph checkpointing, defining LoanProcessingState TypedDict, building stub graph, and proving invocation pattern touches 6+ files: graphs/checkpoint.py, graphs/loan_processing/graph.py, graphs/loan_processing/state.py, config changes, tests. Split: (1) PostgresSaver setup + schema, (2) State definition + stub graph build.

## Hidden Dependencies

**Critical ordering:**
1. **Correlation middleware before auth middleware** — Auth failures must be traceable. `request.state.correlation_id` must exist before `resolve_api_key` runs.
2. **Error hierarchy before any route handler** — All routes depend on `AppError` subclasses. Build errors.py first.
3. **Audit service before application/document routes** — Every state transition calls `audit_service.record_event()`. Audit must be functional before APP/DOC routes are testable.
4. **Encryption service before APP-01** — Cannot create applications without encrypting SSN. Encryption service blocks APP-01.
5. **Status state machine before status transition routes (APP-04/05/06)** — `VALID_TRANSITIONS` dict and `is_valid_transition()` function must exist before any PATCH /applications/:id handler.
6. **Database models + Alembic migrations before all service layer code** — SQLAlchemy models must be defined and migrations applied before any service can query.

**Testing dependencies:**
- **conftest.py test fixtures before any test** — DB session, test client, seed data fixtures must exist first.
- **Seed data migration before integration tests** — Tests for APP-02 (list), APP-03 (detail) assume seed data exists.

**Implicit service dependencies:**
- **MinIO client wrapper before DOC-01** — Document service assumes `minio_client.py` exists with upload/download methods.
- **AuditService assumes AuthContext exists** — `record_state_transition()` takes `auth: AuthContext` parameter.

## Domain-Specific Risks

**SQLAlchemy 2.0 async:**
- `SET LOCAL ROLE audit_writer` requires the session to be in a transaction (non-autocommit mode). If using `async_sessionmaker(autocommit=True)`, the `SET LOCAL ROLE` will fail with "SET LOCAL can only be used in transaction blocks." Verify `autocommit=False` in session factory config.
- Advisory locks (`pg_advisory_xact_lock`) are transaction-scoped and release at commit/rollback. Under pathological contention (many concurrent updates to the same application), one transaction will block. PostgreSQL's `lock_timeout` defaults to 0 (wait forever). Consider setting a session-level `lock_timeout` if bounded wait time is required.

**Pydantic v2 serialization:**
- `populate_by_name` and aliasing (`Field(..., alias="borrowerName")`) can conflict with SQLAlchemy model attribute names. Explicitly map DB columns to Pydantic fields. Use `model_config = {"from_attributes": True}` when loading from ORM models.
- Decimal serialization: Using `str` for monetary fields (e.g., `loan_amount: str`) in Pydantic models. Ensure SQLAlchemy BIGINT cents columns are converted to decimal strings at the Pydantic boundary, not in the DB model.

**LangGraph integration:**
- `AsyncPostgresSaver.from_conn_string()` requires a full connection string including credentials. Phase 1 uses a separate connection pool for LangGraph (`langgraph` schema). Ensure connection string passed to `PostgresSaver` grants CREATE TABLE in the `langgraph` schema.
- Graph state must be JSON-serializable. The `LoanProcessingState` TypedDict includes `documents: list[dict]`, `agent_results: dict[str, dict]`, etc. Ensure no SQLAlchemy ORM objects leak into graph state (pass dicts, not model instances).

**Python-magic file type detection:**
- `python-magic` requires `libmagic` system library. If missing, import fails. Fallback to `Content-Type` header should be guarded with a try/except on import and a warning log. Add to README/Dockerfile dependencies.

**Fernet key rotation:**
- Prepending a version byte before Fernet ciphertext: Fernet tokens already have internal structure (version, timestamp, IV, ciphertext, HMAC). Prepending a byte is safe, but don't modify the Fernet token itself. The TD specifies `KEY_VERSION_CURRENT + ciphertext`, which is correct. Just ensure decrypt strips the first byte before passing to Fernet.

**Multipart/form-data streaming:**
- Large file uploads (up to 20MB) should stream to MinIO, not load into memory. FastAPI's `UploadFile` uses `SpooledTemporaryFile` (in-memory up to a threshold, then disk). Ensure temp file cleanup on error paths.

## Shared Infrastructure

The following components are dependencies for multiple tasks but aren't called out as separate stories:

1. **Base test fixtures (conftest.py)** — Required by all test tasks. Should be the first test infrastructure work item.
   - Async test client fixture
   - Database session fixture (clean schema per test or transaction rollback)
   - Seed data fixture for integration tests
   - Mock MinIO client for unit tests

2. **Error handling middleware** — The TD specifies `app_error_handler` in `middleware/error_handler.py` that maps `AppError` → RFC 7807 JSON response. This middleware must be registered in `main.py` before any route handler can throw domain errors. Not listed as a discrete task in DX or OBS.

3. **Database session dependency** — FastAPI dependency that provides `AsyncSession` to route handlers. This is foundational for all routes but not explicitly called out. Should be in database.py or a `dependencies.py` module.

4. **Async engine + session factory** — `packages/db/src/database.py` must provide `create_async_engine()`, `async_sessionmaker()`, and connection pool config. Required before any service or route can query the DB.

5. **MinIO bucket initialization** — The bucket must exist before document upload. Either create it in `compose.yml` init script, or add a startup check that creates the bucket if missing (like `PostgresSaver.setup()`). Not mentioned in DOC stories.

6. **PII-aware log processor** — The TD specifies a `structlog` processor that filters PII from log entries. This processor must be defined and configured before structured logging can be tested. It's part of OBS-03 but could be split out as a discrete unit.

## Recommendations

1. **Split AUTH-01/05/06 into 3 tasks** as outlined above.
2. **Split APP-01 into route handler + encryption integration** to keep file count under 5.
3. **Split DOC-01/02 into 3 tasks** (basic upload, validation, audit integration).
4. **Add explicit task for shared test infrastructure** (conftest.py fixtures) before first test task.
5. **Add explicit task for error handler middleware registration** in main.py (or fold into DX-01).
6. **Add explicit task for database session dependency** (or fold into first DB-touching task).
7. **Flag LangGraph connection pool config** as needing validation early — ensure `langgraph` schema permissions before CHECKPOINT-01.
8. **Document python-magic / libmagic system dependency** in README and compose setup.

All other task groups appear appropriately scoped.

---

**Files referenced in this assessment:**
- `/home/jary/redhat/git/agent-scaffold-test-teams/plans/technical-design-phase-1.md`
