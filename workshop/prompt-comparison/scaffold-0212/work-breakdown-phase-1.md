<!-- This project was developed with assistance from AI tools. -->

# Work Breakdown — Phase 1: Foundation

**Version:** 1.0
**Date:** 2026-02-12
**Status:** Proposed
**Upstream:** Technical Design Phase 1 v1.1, Architecture v1.0, Requirements v1.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Epics](#2-epics)
3. [Stories](#3-stories)
4. [Dependency Graph](#4-dependency-graph)
5. [Execution Order and Parallelism](#5-execution-order-and-parallelism)
6. [Risk Register](#6-risk-register)
7. [Open Questions](#7-open-questions)

---

## 1. Overview

Phase 1 establishes the project skeleton, database, API core with middleware, application/document CRUD, and the LangGraph orchestration framework with stub agent nodes. This work breakdown translates Technical Design Phase 1 into 25 executable stories (S-P1-01 through S-P1-24, with S-P1-20 split into S-P1-20a and S-P1-20b), each mapping 1:1 to a work unit from the TD.

### Summary

- **Epics:** 5 (Infrastructure, Database, API Core, Agent Framework, Validation)
- **Stories:** 25 (S-P1-01 through S-P1-24)
- **Exit Condition:** All 25 stories pass their verification commands
- **Parallelization:** Up to 6 stories can execute concurrently (Wave 3)

### Scope

By the end of Phase 1, a developer can:

1. Start the full stack with `make setup && make dev`
2. Create a loan application via API
3. Upload a PDF document to MinIO
4. Submit the application for processing
5. Watch the workflow execute through stub nodes with checkpoint persistence
6. Verify the complete audit trail records every step
7. Confirm that authentication and RBAC enforce role boundaries

### User Stories Covered

Phase 1 implements 17 user stories from the requirements document:

- US-001 (Supervisor Agent Initialization)
- US-002 (Document Processing Routing)
- US-006 (Workflow Checkpoint Persistence)
- US-008 (Document Upload and Storage)
- US-021 (Immutable Audit Trail Storage)
- US-053 (Create Loan Application)
- US-054 (View Application Detail)
- US-058 (API Key Authentication)
- US-059 (Role-Based Access Control)
- US-060 (Startup Warning for Default Keys)
- US-064 (Structured Logging)
- US-065 (Correlation ID Propagation)
- US-067 (Health Check Endpoints)
- US-068 (Developer Setup Command Sequence)
- US-069 (README with Architecture Overview)
- US-073 (Database Schema, Migration Idempotency, Rollback)
- US-081 (Inline Code Documentation for Multi-Agent Patterns)

---

## 2. Epics

### E-P1-01: Infrastructure and Scaffolding

Establishes the monorepo structure, package configuration, Docker Compose infrastructure, and developer setup flow.

**Stories:** S-P1-01, S-P1-24

### E-P1-02: Database Foundation

Creates the database engine, ORM models, migrations (schema + seed data), and repository layer.

**Stories:** S-P1-02, S-P1-03, S-P1-04, S-P1-05, S-P1-06, S-P1-07

### E-P1-03: API Core and Middleware

Implements the FastAPI application factory, middleware stack (correlation ID, logging, auth, RBAC), core schemas and settings, health checks, and external service clients (encryption, MinIO).

**Stories:** S-P1-08, S-P1-09, S-P1-10, S-P1-11, S-P1-12, S-P1-13, S-P1-14, S-P1-15, S-P1-16, S-P1-17, S-P1-18, S-P1-19

### E-P1-04: Agent Framework

Defines the LangGraph state types, graph structure, stub node implementations, and checkpointer integration with the submit endpoint.

**Stories:** S-P1-20a, S-P1-20b, S-P1-21

### E-P1-05: Validation and Testing

Integration tests verifying end-to-end functionality, audit immutability enforcement, and developer documentation.

**Stories:** S-P1-22, S-P1-23

---

## 3. Stories

### S-P1-01: Project Scaffolding and Infrastructure

**Epic:** E-P1-01
**Agent:** @devops-engineer
**Dependencies:** None (root story)

**Description:**

Create the monorepo package structure with build configurations for API (FastAPI + Python), database (SQLAlchemy + Alembic), and UI (React + Vite placeholder). Configure Turborepo pipeline, Makefile commands, Docker Compose for PostgreSQL/Redis/MinIO, and `.env.example` with all required environment variables including well-known dev API keys and SSN_ENCRYPTION_KEY generation instructions.

**Files Created:**
- `packages/api/pyproject.toml`
- `packages/db/pyproject.toml`
- `packages/ui/package.json`
- `turbo.json`
- `Makefile`
- `compose.yml`
- `.env.example`

**Key Implementation Details:**
- FastAPI, uvicorn, pydantic-settings, sqlalchemy[asyncpg], langgraph, minio, structlog, tenacity in `packages/api/pyproject.toml` (Python >=3.11)
- SQLAlchemy[asyncpg], alembic, asyncpg, pgvector in `packages/db/pyproject.toml`
- React 19, Vite, TanStack Router/Query, Tailwind CSS, shadcn/ui in `packages/ui/package.json` (placeholder)
- Turborepo pipeline with build, dev, test, lint tasks
- Makefile targets: `setup`, `dev`, `test`, `lint`, `db-start`, `db-upgrade`, `db-rollback`, `containers-build`, `containers-up`
- Docker Compose services: PostgreSQL (pgvector/pgvector:pg16), Redis (redis:7-alpine), MinIO (minio/minio) with healthchecks
- `.env.example` includes: DATABASE_URL, REDIS_URL, MINIO_* vars, SSN_ENCRYPTION_KEY placeholder with generation command (`openssl rand -base64 32`), LLM API keys, CORS_ORIGINS, LOG_LEVEL, PRODUCTION flag
- LangFuse PII security warning as comment in `.env.example`: "WARNING: LangFuse logs full LLM prompts. Do not enable for PII-processing workflows without prompt sanitization."

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && make setup 2>&1 | tail -1 | grep -q "Setup complete" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-068

---

### S-P1-02: Database Engine and Session Factory

**Epic:** E-P1-02
**Agent:** @database-engineer
**Dependencies:** S-P1-01

**Description:**

Create the async SQLAlchemy engine factory and session factory. Engine uses asyncpg with pool_size=5, max_overflow=15. Exports `async_session_factory` and `get_db_session` async generator for FastAPI dependency injection. Uses lazy import of `Base` from `models.py` to allow WU02 implementation before WU03.

**Files Created:**
- `packages/db/src/__init__.py`
- `packages/db/src/engine.py`

**Key Implementation Details:**
- `create_async_engine` from `Settings.DATABASE_URL`
- Async sessionmaker bound to engine
- `get_db_session` async generator for FastAPI Depends
- Engine disposal on shutdown
- Lazy `Base` import to decouple from models.py creation timing

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "from packages.db.src.engine import async_session_factory; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-073

---

### S-P1-03: SQLAlchemy ORM Models

**Epic:** E-P1-02
**Agent:** @database-engineer
**Dependencies:** S-P1-02

**Description:**

Implement all ORM models per TD Section 2.3: `users`, `api_keys`, `applications`, `documents`, `agent_decisions`, `audit_events`, `configuration`, `embeddings`. Include all indexes. The `embeddings` table vector column is handled via raw SQL in migration (ORM defines non-vector columns only).

**Files Created:**
- `packages/db/src/models.py`

**Key Implementation Details:**
- All tables from architecture Section 3.1
- UUID v4 primary keys
- DateTime fields with timezone=True, UTC defaults
- All columns, relationships, and indexes as specified in TD Section 2.3
- `embeddings` table includes metadata column; vector column added in migration

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.db.src.models import Base, User, ApiKey, Application, Document, AgentDecision, AuditEvent, Configuration, Embedding
tables = Base.metadata.tables.keys()
expected = {'users','api_keys','applications','documents','agent_decisions','audit_events','configuration','embeddings'}
assert expected.issubset(tables), f'Missing: {expected - tables}'
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-073

---

### S-P1-04: Alembic Initial Schema Migration

**Epic:** E-P1-02
**Agent:** @database-engineer
**Dependencies:** S-P1-03

**Description:**

Set up Alembic with async support. Create the initial migration (001) that creates all 8 tables with columns/constraints/indexes, creates `app_role` and `migration_role` database roles, applies grants (app_role gets SELECT/INSERT/UPDATE/DELETE on all tables EXCEPT audit_events which is SELECT/INSERT only), creates pgvector extension, adds `embedding vector(1536)` column via raw SQL, and creates IVFFlat index on embedding column. Includes both upgrade() and downgrade().

**Files Created:**
- `packages/db/alembic.ini`
- `packages/db/alembic/env.py`
- `packages/db/alembic/versions/001_initial_schema.py`

**Key Implementation Details:**
- Alembic env.py uses asyncpg, imports Base.metadata
- Migration creates all 8 tables from ORM models
- Database roles: `app_role` (application runtime), `migration_role` (Alembic)
- Grants: `app_role` cannot UPDATE/DELETE audit_events
- pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector`
- Raw SQL: `ALTER TABLE embeddings ADD COLUMN embedding vector(1536);`
- IVFFlat index on embedding column
- Full downgrade support

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && make db-upgrade && make db-rollback && make db-upgrade && echo "PASS" || echo "FAIL"
```

**User Stories:** US-073, US-021

---

### S-P1-05: Seed Data Migration

**Epic:** E-P1-02
**Agent:** @database-engineer
**Dependencies:** S-P1-04

**Description:**

Create seed data migration (002) that inserts three users (Maria Lopez/loan_officer, David Chen/senior_underwriter, James Wilson/reviewer), three API keys (well-known deterministic dev keys with SHA-256 hashes, is_default=True), and three configuration rows (confidence_thresholds, fraud_sensitivity, rate_limits) per TD Section 2.9. Includes both upgrade and downgrade.

**Files Created:**
- `packages/db/alembic/versions/002_seed_data.py`

**Key Implementation Details:**
- Three users per TD Section 2.9 seed data contract
- API keys: `mq_lo_dev_key_do_not_use_in_production_1`, `mq_su_dev_key_do_not_use_in_production_2`, `mq_rv_dev_key_do_not_use_in_production_3`
- Keys stored as SHA-256 hashes with `is_default=True` flag
- Configuration rows: `confidence_thresholds` (auto_approve: 0.85, escalation: 0.60, denial: 0.40), `fraud_sensitivity` (level: MEDIUM), `rate_limits` (chat_per_hour: 20, property_per_session: 5, calc_per_hour: 100)
- Plaintext keys documented in `.env.example` (created in S-P1-01)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && make db-upgrade && python -c "
import asyncio
from packages.db.src.engine import async_session_factory
from sqlalchemy import text
async def check():
    async with async_session_factory() as s:
        users = (await s.execute(text('SELECT count(*) FROM users'))).scalar()
        keys = (await s.execute(text('SELECT count(*) FROM api_keys'))).scalar()
        config = (await s.execute(text('SELECT count(*) FROM configuration'))).scalar()
        assert users == 3, f'Expected 3 users, got {users}'
        assert keys == 3, f'Expected 3 keys, got {keys}'
        assert config == 3, f'Expected 3 config rows, got {config}'
        print('PASS')
asyncio.run(check())
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-058, US-060

---

### S-P1-06: Repository Implementations — Application and Document

**Epic:** E-P1-02
**Agent:** @backend-developer
**Dependencies:** S-P1-04

**Description:**

Implement `ApplicationRepository` and `DocumentRepository` per TD Section 2.4 signatures. ApplicationRepository provides `create()`, `get_by_id()`, `list_applications()` (cursor-based pagination using (updated_at, id) composite cursor, base64 JSON encoding, default sort: updated_at DESC), and `update_status()`. DocumentRepository provides `create()`, `get_by_id()`, and `list_by_application()`. All methods use AsyncSession passed at construction. Include unit tests.

**Files Created:**
- `packages/db/src/repositories/__init__.py`
- `packages/db/src/repositories/application.py`
- `packages/db/src/repositories/document.py`
- `packages/db/tests/__init__.py`
- `packages/db/tests/conftest.py`
- `packages/db/tests/test_application_repository.py`
- `packages/db/tests/test_document_repository.py`

**Key Implementation Details:**
- Cursor-based pagination: `(updated_at, id)` composite cursor, base64-encoded JSON
- `update_status()` updates status, updated_at, and optionally escalation_reason, required_reviewer_role, workflow_thread_id
- All async methods, AsyncSession injected via constructor
- Test fixtures for database setup/teardown in conftest.py

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_application_repository.py packages/db/tests/test_document_repository.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-053, US-054, US-008

---

### S-P1-07: Repository Implementations — Audit, User, AgentDecision, Configuration

**Epic:** E-P1-02
**Agent:** @backend-developer
**Dependencies:** S-P1-04

**Description:**

Implement `AuditRepository` (create, list_by_application with cursor pagination on (created_at, id), NO update/delete), `UserRepository` (get_by_id, get_by_api_key_hash with revoked_at/expires_at filtering, has_default_keys), `AgentDecisionRepository` (create, list_by_application), and `ConfigurationRepository` (get, set with upsert pattern) per TD Section 2.4. Include unit tests.

**Files Created:**
- `packages/db/src/repositories/audit.py`
- `packages/db/src/repositories/user.py`
- `packages/db/src/repositories/agent_decision.py`
- `packages/db/src/repositories/configuration.py`
- `packages/db/tests/test_audit_repository.py`
- `packages/db/tests/test_user_repository.py`
- `packages/db/tests/test_agent_decision_repository.py`
- `packages/db/tests/test_configuration_repository.py`

**Key Implementation Details:**
- AuditRepository: append-only, no update/delete methods
- UserRepository.get_by_api_key_hash: joins api_keys + users, filters by `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`
- UserRepository.has_default_keys: checks for `is_default=True AND revoked_at IS NULL`
- ConfigurationRepository.set: INSERT ON CONFLICT UPDATE (upsert)
- All async, AsyncSession injected via constructor

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_audit_repository.py packages/db/tests/test_user_repository.py packages/db/tests/test_agent_decision_repository.py packages/db/tests/test_configuration_repository.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-021, US-058, US-060

---

### S-P1-08: Pydantic Enums and Schemas

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** None

**Description:**

Implement all enums (ApplicationStatus, DocumentType, Role, RoleStr, AgentName, EventType, ActorType, Recommendation, RoutingDecision, FraudSensitivity) and Pydantic schemas (DataEnvelope, PaginatedEnvelope, PaginationMeta, ProblemDetail, ValidationErrorItem, CreateApplicationRequest, ApplicationResponse, ApplicationDetailResponse, ApplicationListItem, DocumentResponse, AuditEventResponse, HealthResponse, DependencyStatus, ReadinessResponse, AuthenticatedUser) exactly as specified in TD Sections 2.1 and 2.2. Configure camelCase aliases on all response models.

**Files Created:**
- `packages/api/src/__init__.py`
- `packages/api/src/models/__init__.py`
- `packages/api/src/models/enums.py`
- `packages/api/src/models/schemas.py`

**Key Implementation Details:**
- All enums from TD Section 2.1
- All Pydantic models from TD Section 2.2
- camelCase aliases via Pydantic `Field(alias="...")`
- `model_config = ConfigDict(populate_by_name=True, from_attributes=True)` where needed
- SSN validation in CreateApplicationRequest: 9 digits, format XXX-XX-XXXX or XXXXXXXXX

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.models.enums import ApplicationStatus, Role, EventType, AgentName
from packages.api.src.models.schemas import (
    CreateApplicationRequest, ApplicationResponse, ApplicationDetailResponse,
    DocumentResponse, AuditEventResponse, HealthResponse, ReadinessResponse,
    ProblemDetail, DataEnvelope, PaginatedEnvelope, AuthenticatedUser,
)
import json
resp = ApplicationResponse(
    id='00000000-0000-0000-0000-000000000001',
    borrower_name='Test', loan_amount_cents=100, property_address='123 Main St',
    loan_term_months=360, status='DRAFT',
    created_at='2026-01-01T00:00:00Z', updated_at='2026-01-01T00:00:00Z',
)
d = json.loads(resp.model_dump_json(by_alias=True))
assert 'borrowerName' in d, f'Missing camelCase alias: {d.keys()}'
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** Cross-cutting (used by all route and middleware stories)

---

### S-P1-09: Pydantic Settings and Error Handling

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-08

**Description:**

Implement `Settings` per TD Section 2.7 (pydantic-settings loading from environment, SSN_ENCRYPTION_KEY required with no default) and error classes per TD Section 2.8 (AppError base, ValidationError, NotFoundError, AuthenticationError, AuthorizationError, ConflictError, ServiceUnavailableError). Application fails to start if SSN_ENCRYPTION_KEY is missing.

**Files Created:**
- `packages/api/src/settings.py`
- `packages/api/src/errors.py`

**Key Implementation Details:**
- Settings fields: DATABASE_URL, REDIS_URL, MINIO_*, SSN_ENCRYPTION_KEY (required), ANTHROPIC_API_KEY, OPENAI_API_KEY, FRED_API_KEY, LANGFUSE_*, CORS_ORIGINS, LOG_LEVEL, PRODUCTION
- Error classes: AppError base with `type`, `title`, `detail`, `status` attributes
- Domain-specific errors map to HTTP status codes (ValidationError: 422, NotFoundError: 404, etc.)
- ERROR_BASE_URL = "https://mortgage-quickstart.example.com/errors"

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && SSN_ENCRYPTION_KEY=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTE= python -c "
from packages.api.src.settings import Settings
from packages.api.src.errors import AppError, NotFoundError, AuthenticationError
s = Settings()
assert s.SSN_ENCRYPTION_KEY != ''
e = NotFoundError('Application not found')
assert e.status == 404
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-067, US-068

---

### S-P1-10: Correlation ID Middleware and Structured Logging

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-09

**Description:**

Implement correlation ID middleware (reads X-Request-ID header or generates UUID v4, sets correlation_id_var context variable, attaches to request.state.correlation_id, adds X-Request-ID response header) and structured logging middleware (structlog with JSON output, logs request start/completion with method/path/correlation_id/status/duration_ms, never logs request/response bodies or PII). Configures structlog processors with JSON renderer for production, console for development.

**Files Created:**
- `packages/api/src/middleware/__init__.py`
- `packages/api/src/middleware/correlation_id.py`
- `packages/api/src/middleware/logging.py`

**Key Implementation Details:**
- Correlation ID middleware per TD Section 2.5 contract
- `correlation_id_var: ContextVar[str]` in correlation_id.py
- Structured logging with structlog, JSON output
- Log request start: method, path, correlation_id
- Log request completion: status, duration_ms, correlation_id
- PII fields (SSN, financial data) never logged

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.middleware.correlation_id import correlation_id_var
from packages.api.src.middleware.logging import configure_logging
assert correlation_id_var.get() == ''
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-064, US-065

---

### S-P1-11: Authentication Middleware

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-07, S-P1-09

**Description:**

Implement API key authentication middleware per TD Section 2.5 contract. Skips `/health`, `/ready`, `/v1/public/*`. Extracts Bearer token from Authorization header, computes SHA-256 hash, looks up via UserRepository.get_by_api_key_hash, attaches AuthenticatedUser to request.state.user on success, returns 401 RFC 7807 on failure. Logs auth events per architecture Section 8.1. Redis caching deferred to Phase 2 (hits database every time in Phase 1). Include integration tests.

**Files Created:**
- `packages/api/src/middleware/auth.py`
- `packages/api/tests/integration/__init__.py`
- `packages/api/tests/integration/test_auth.py`

**Key Implementation Details:**
- Path skipping: `/health`, `/ready`, `/v1/public/*`
- Bearer token extraction from Authorization header
- SHA-256 hash computation
- UserRepository.get_by_api_key_hash database lookup (no Redis cache in Phase 1)
- AuthenticatedUser creation and attachment to request.state.user
- 401 RFC 7807 response on missing/invalid key
- Security event logging (success/failure)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_auth.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-058

---

### S-P1-12: RBAC Dependency and Dependencies Module

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-08, S-P1-11

**Description:**

Implement FastAPI dependency injection functions: `get_settings()` (singleton Settings), `get_db_session()` (yields async session from engine), `get_current_user(request)` (extracts from request.state.user, raises 401 if not set), and `require_role(minimum: Role)` (checks Role[user.role.upper()] >= minimum, returns AuthenticatedUser on success, raises 403 on failure). Role comparison uses IntEnum ordering.

**Files Created:**
- `packages/api/src/dependencies.py`

**Key Implementation Details:**
- `get_settings()`: Singleton settings instance
- `get_db_session()`: Async generator yielding session from engine
- `get_current_user()`: Extracts request.state.user, raises 401 if not set
- `require_role(minimum: Role)`: Returns dependency that checks role hierarchy via IntEnum comparison
- Role hierarchy per TD Section 2.1: LOAN_OFFICER=1, SENIOR_UNDERWRITER=2, REVIEWER=3

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.dependencies import require_role, get_current_user
from packages.api.src.models.enums import Role
dep = require_role(Role.REVIEWER)
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-059

---

### S-P1-13: Health Check Routes

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-09, S-P1-08

**Description:**

Implement `GET /health` (always returns 200 with {"status": "ok", "timestamp": "..."}, no dependency checks) and `GET /ready` (checks database via SELECT 1, Redis via PING, MinIO bucket exists; returns 200 if all pass with per-dependency status and latency, 503 if any fail). Both endpoints unauthenticated. The /ready endpoint covers US-072 (graceful degradation) by reporting per-dependency status.

**Files Created:**
- `packages/api/src/routes/__init__.py`
- `packages/api/src/routes/health.py`

**Key Implementation Details:**
- `/health`: No checks, always 200, HealthResponse schema
- `/ready`: Checks database (SELECT 1), Redis (PING), MinIO (bucket exists)
- Returns 200 with ReadinessResponse if all healthy
- Returns 503 with ReadinessResponse identifying failed dependencies if any unhealthy
- Both endpoints skip authentication

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf http://localhost:8000/health | python -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-067

---

### S-P1-14: SSN Encryption Service

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-09

**Description:**

Implement AES-256-GCM encryption/decryption for SSNs per architecture Section 6.4. `encrypt_ssn(ssn: str, key: bytes) -> bytes` returns nonce + ciphertext + tag. `decrypt_ssn(encrypted: bytes, key: bytes) -> str` decrypts. `hash_ssn(ssn: str, salt: str) -> str` computes SHA-256 hash with salt for lookups. Key loaded from Settings.SSN_ENCRYPTION_KEY (base64-decoded). Startup validation: key must be at least 32 bytes after decoding; application refuses to start if invalid. Include unit tests.

**Files Created:**
- `packages/api/src/services/__init__.py`
- `packages/api/src/services/encryption.py`
- `packages/api/tests/unit/test_encryption.py`

**Key Implementation Details:**
- AES-256-GCM encryption
- encrypt_ssn: returns nonce || ciphertext || tag concatenated
- decrypt_ssn: extracts nonce, ciphertext, tag; decrypts
- hash_ssn: SHA-256 with salt
- Key from Settings.SSN_ENCRYPTION_KEY, base64-decoded
- Startup validation: key >= 32 bytes, else refuse to start

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_encryption.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-053

---

### S-P1-15: MinIO Client Service

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-09

**Description:**

Implement MinIO client service for document upload/download per architecture Section 2.5. `MinioService` class with methods: `ensure_bucket()` (creates bucket if absent), `upload_document(application_id, document_id, filename, data, content_type) -> str` (uploads file, returns storage key with format `{application_id}/{document_id}/{filename}`, sanitizes filename via `os.path.basename()` to strip path traversal, limits filename to 255 chars), and `get_presigned_url(storage_key, expires_seconds=900) -> str` (generates 15-minute default expiry presigned download URL). Uses minio Python SDK. Include unit tests.

**Files Created:**
- `packages/api/src/services/minio_client.py`
- `packages/api/tests/unit/test_minio_client.py`

**Key Implementation Details:**
- MinioService class with ensure_bucket, upload_document, get_presigned_url methods
- Storage key format: `{application_id}/{document_id}/{filename}`
- Filename sanitization: `os.path.basename(filename)` to prevent path traversal
- Filename length limit: 255 characters
- Presigned URL: 15-minute default expiry
- Connection from Settings: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_USE_SSL

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_minio_client.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-008

---

### S-P1-16: Application CRUD Routes

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-06, S-P1-07, S-P1-12, S-P1-14

**Description:**

**Imports from:** ApplicationRepository (S-P1-06), AuditRepository (S-P1-07), require_role (S-P1-12), encrypt_ssn/hash_ssn (S-P1-14)

Implement application CRUD endpoints per architecture Section 4.2. `POST /v1/applications` (auth required: any role, validates CreateApplicationRequest, encrypts SSN, hashes SSN, creates application, creates audit event application_created, returns 201 with DataEnvelope[ApplicationResponse] and Location header, SSN never returned). `GET /v1/applications/{id}` (auth: any role, returns DataEnvelope[ApplicationDetailResponse] with documents list, 404 if not found). `GET /v1/applications` (auth: any role, query params cursor/limit/status, returns PaginatedEnvelope[ApplicationListItem]).

**Files Created:**
- `packages/api/src/routes/applications.py`

**Key Implementation Details:**
- POST /v1/applications: CreateApplicationRequest validation, SSN encryption + hashing, ApplicationRepository.create, AuditRepository.create (application_created event), 201 with Location header, SSN never in response
- GET /v1/applications/{id}: ApplicationRepository.get_by_id, includes documents via DocumentRepository.list_by_application, returns ApplicationDetailResponse, 404 if not found
- GET /v1/applications: query params (cursor, limit default 20 max 100, status filter), ApplicationRepository.list_applications, returns PaginatedEnvelope[ApplicationListItem]
- All endpoints require authentication (any role)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf -X POST http://localhost:8000/v1/applications \
  -H "Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1" \
  -H "Content-Type: application/json" \
  -d '{"borrowerName":"Test Borrower","ssn":"123-45-6789","loanAmountCents":32000000,"propertyAddress":"123 Main St","loanTermMonths":360}' \
  | python -c "import sys,json; d=json.load(sys.stdin); assert d['data']['status']=='DRAFT'; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-053, US-054

---

### S-P1-17: Document Upload Route

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-06, S-P1-07, S-P1-12, S-P1-15

**Description:**

**Imports from:** DocumentRepository (S-P1-06), AuditRepository (S-P1-07), require_role (S-P1-12), MinioService (S-P1-15)

Implement document upload and listing endpoints per architecture Section 4.2 and US-008. `POST /v1/applications/{id}/documents` (auth: any role, accepts multipart file upload, validates PDF via magic bytes `%PDF` in first 4 bytes, max 10 MB, uploads to MinIO via MinioService.upload_document, creates document record via DocumentRepository.create, creates audit event documents_uploaded, returns 201 with DataEnvelope[DocumentResponse], rejects non-PDF with 400, oversized with 413, MinIO unreachable returns 503). `GET /v1/applications/{id}/documents` (auth: any role, returns document list). Include test for path traversal filename sanitization.

**Files Created:**
- `packages/api/src/routes/documents.py`

**Key Implementation Details:**
- POST /v1/applications/{id}/documents: multipart upload, PDF validation (Content-Type + magic bytes %PDF check), max 10 MB, MinIO upload, document record creation, audit event, 201 response, 400 for non-PDF, 413 for oversized, 503 if MinIO unreachable
- GET /v1/applications/{id}/documents: DocumentRepository.list_by_application
- Test case: upload filename='../../test.pdf', verify stored filename does not contain path separators
- All endpoints require authentication (any role)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
import subprocess, json, tempfile, os
AUTH='Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1'
# Create application
r1 = subprocess.run(['curl','-sf','-X','POST','http://localhost:8000/v1/applications',
    '-H',AUTH,'-H','Content-Type: application/json',
    '-d',json.dumps({'borrowerName':'Doc Test','ssn':'987-65-4321','loanAmountCents':100000,'propertyAddress':'456 Oak Ave','loanTermMonths':360})
], capture_output=True, text=True)
app_id = json.loads(r1.stdout)['data']['id']
# Create minimal valid PDF
pdf_path = tempfile.mktemp(suffix='.pdf')
with open(pdf_path, 'wb') as f:
    f.write(b'%PDF-1.4 minimal test content')
# Upload valid PDF -> expect 201
r2 = subprocess.run(['curl','-sf','-o','/dev/null','-w','%{http_code}',
    '-X','POST',f'http://localhost:8000/v1/applications/{app_id}/documents',
    '-H',AUTH,'-F',f'file=@{pdf_path};type=application/pdf;filename=test.pdf'
], capture_output=True, text=True)
assert r2.stdout.strip() == '201', f'Expected 201 for valid PDF, got {r2.stdout}'
# Upload non-PDF -> expect 400
r3 = subprocess.run(['curl','-sf','-o','/dev/null','-w','%{http_code}',
    '-X','POST',f'http://localhost:8000/v1/applications/{app_id}/documents',
    '-H',AUTH,'-F','file=@/dev/null;type=text/plain;filename=test.txt'
], capture_output=True, text=True)
assert r3.stdout.strip() == '400', f'Expected 400 for non-PDF, got {r3.stdout}'
os.unlink(pdf_path)
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-008

---

### S-P1-18: Audit Trail Route

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-07, S-P1-12

**Description:**

Implement audit trail query endpoint per architecture Section 4.2. `GET /v1/applications/{id}/audit` (auth: any role, query params cursor/limit default 20 max 100, returns PaginatedEnvelope[AuditEventResponse], events sorted by created_at ASC for chronological audit trail readability, 404 if application does not exist). Include integration test.

**Files Created:**
- `packages/api/src/routes/audit.py`
- `packages/api/tests/integration/test_audit_trail.py`

**Key Implementation Details:**
- GET /v1/applications/{id}/audit: query params (cursor, limit default 20 max 100)
- AuditRepository.list_by_application with cursor pagination
- Events sorted by created_at ASC (chronological order)
- Returns PaginatedEnvelope[AuditEventResponse]
- 404 if application does not exist
- Authentication required (any role)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_audit_trail.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-021

---

### S-P1-19: FastAPI Application Factory and Startup

**Epic:** E-P1-03
**Agent:** @backend-developer
**Dependencies:** S-P1-10, S-P1-11, S-P1-13, S-P1-16, S-P1-17, S-P1-18

**Description:**

Create FastAPI application factory per architecture Sections 2.1 and 7.3. `create_app() -> FastAPI`: create instance with /docs and /redoc, add middleware in order (CORS, correlation ID, structured logging, auth), register exception handlers (AppError -> RFC 7807, RequestValidationError -> 422 with PII redaction for "ssn" field, unhandled Exception -> 500), register routes (health, applications, documents, audit), add lifespan handler (startup: validate SSN_ENCRYPTION_KEY, create MinIO bucket, check for default API keys and log ERROR warning per US-060, init database engine; shutdown: dispose engine), configure request size limits (1 MB JSON, 10 MB per file, 50 MB multipart).

**Files Created:**
- `packages/api/src/main.py`

**Key Implementation Details:**
- FastAPI instance with /docs (Swagger UI) and /redoc
- Middleware order: [0] CORS (outermost), [1] correlation ID, [2] logging, [4] auth
- Exception handlers: AppError -> RFC 7807, RequestValidationError -> 422 with PII_FIELDS = {"ssn"} redaction (replace value with "[REDACTED]"), Exception -> 500 RFC 7807 (detail hidden, logged at ERROR)
- Route modules: health, applications, documents, audit
- Lifespan: startup (validate SSN_ENCRYPTION_KEY, MinIO bucket creation, default API keys warning per US-060, database engine init), shutdown (engine disposal)
- Request size limits: 1 MB JSON, 10 MB per file, 50 MB multipart (returns 413 if exceeded)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf http://localhost:8000/health | python -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; print('PASS')" && curl -sf http://localhost:8000/docs -o /dev/null && echo "PASS" || echo "FAIL"
```

**User Stories:** US-060, US-067, US-068

---

### S-P1-20a: LangGraph State Types and Graph Definition

**Epic:** E-P1-04
**Agent:** @backend-developer
**Dependencies:** S-P1-08

**Description:**

Implement all TypedDicts from TD Section 2.6 (ThresholdsSnapshot, DocumentResult, CreditAnalysisResult, RiskAssessmentResult, ComplianceCheckResult, FraudDetectionResult, AggregatedResults, CoachingOutput, PreviousAnalysis, LoanProcessingState, IntakeState) and define graph structure with all nodes and edges per architecture Section 5.1. Graph nodes: `supervisor_init`, `document_processing`, `credit_analysis`, `risk_assessment`, `compliance_check`, `fraud_detection`, `aggregation`, `routing_decision`, `denial_coaching`, `human_review_wait`. Graph defined with placeholder supervisor nodes (will be replaced by imports from WU20b). Graph compiled but not connected to checkpointer (WU21). Include inline comments explaining supervisor-worker pattern, parallel fan-out, checkpoint persistence per US-081.

**Files Created:**
- `packages/api/src/agents/__init__.py`
- `packages/api/src/agents/state.py`
- `packages/api/src/agents/graphs/__init__.py`
- `packages/api/src/agents/graphs/loan_processing.py`

**Key Implementation Details:**
- All TypedDicts from TD Section 2.6 in state.py
- loan_processing.py: graph definition with all nodes (supervisor_init, document_processing, credit_analysis, risk_assessment, compliance_check, fraud_detection, aggregation, routing_decision, denial_coaching, human_review_wait) and edges per architecture Section 5.1
- Supervisor nodes defined inline as placeholders (replaced in WU20b)
- Graph compiled but not connected to checkpointer (WU21)
- Inline comments per US-081: supervisor-worker pattern, parallel fan-out, checkpoint persistence

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.agents.state import LoanProcessingState, IntakeState
from packages.api.src.agents.graphs.loan_processing import build_loan_processing_graph
assert 'application_id' in LoanProcessingState.__annotations__
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-006, US-081

---

### S-P1-20b: LangGraph Stub Node Implementations

**Epic:** E-P1-04
**Agent:** @backend-developer
**Dependencies:** S-P1-20a

**Description:**

Implement stub versions of all agent nodes in their FINAL file locations (matching architecture Section 9). supervisor.py: real implementation of supervisor_init_node, aggregation_node, routing_decision_node (confidence-based routing logic per architecture Section 5.4), route_after_documents/route_after_decision/route_after_review conditional edges, human_review_wait_node. Stub node files (document_processing, credit_analysis, risk_assessment, compliance, fraud_detection, denial_coaching): return synthetic data with [STUB] prefix in reasoning, model_used="stub". Update loan_processing.py to import nodes from final file locations. Include inline comments per US-081.

**Files Created:**
- `packages/api/src/agents/nodes/__init__.py`
- `packages/api/src/agents/nodes/supervisor.py`
- `packages/api/src/agents/nodes/document_processing.py`
- `packages/api/src/agents/nodes/credit_analysis.py`
- `packages/api/src/agents/nodes/risk_assessment.py`
- `packages/api/src/agents/nodes/compliance.py`
- `packages/api/src/agents/nodes/fraud_detection.py`
- `packages/api/src/agents/nodes/denial_coaching.py`
- `packages/api/tests/unit/test_graph_nodes.py`

**Key Implementation Details:**
- supervisor.py: supervisor_init_node (sets workflow_status DOCUMENT_PROCESSING, populates initial state), aggregation_node (collects agent results, checks disagreements/fraud), routing_decision_node (confidence-based routing), conditional edge functions
- Stub nodes: document_processing (confidence 0.95), credit_analysis (score 720, confidence 0.85, APPROVE), risk_assessment (score 0.3, confidence 0.80, APPROVE), compliance (confidence 0.90, no violations), fraud_detection (confidence 0.95, no flags, LOW), denial_coaching (generic suggestions)
- All stubs: [STUB] prefix in reasoning, model_used="stub"
- Update loan_processing.py to import from final node files
- Inline comments per US-081

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_graph_nodes.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-001, US-002, US-006, US-081

---

### S-P1-21: LangGraph Checkpointer and Submit Endpoint

**Epic:** E-P1-04
**Agent:** @backend-developer
**Dependencies:** S-P1-19, S-P1-20b, S-P1-06, S-P1-07

**Description:**

**Imports from:** build_loan_processing_graph (S-P1-20b), ApplicationRepository (S-P1-06), AuditRepository/AgentDecisionRepository (S-P1-07), create_app lifespan (S-P1-19)

Connect LangGraph graph to PostgresSaver and expose submit endpoint. checkpointer.py: creates separate asyncpg connection pool (min 2, max 5) per architecture Section 5.5, initializes AsyncPostgresSaver, exports setup_checkpointer (called at startup) and get_checkpointer, compiles loan processing graph with checkpointer. submit.py: `POST /v1/applications/{id}/submit` (auth: any role, validates application exists and is DRAFT else 409, updates status to PROCESSING, creates LangGraph thread `loan:{application_id}`, invokes graph synchronously, updates application status based on routing_decision, creates audit events for each step, creates agent_decisions rows, stores workflow_thread_id, returns 200 with ApplicationResponse). Modify main.py to add setup_checkpointer to lifespan and register submit route.

**Files Created:**
- `packages/api/src/agents/checkpointer.py`
- `packages/api/src/routes/submit.py`

**Files Modified:**
- `packages/api/src/main.py` (add checkpointer setup to lifespan, register submit route)

**Key Implementation Details:**
- checkpointer.py: separate asyncpg pool (min 2, max 5), AsyncPostgresSaver initialization, graph compilation with checkpointer
- POST /v1/applications/{id}/submit: auth required (any role), validate application exists and is DRAFT (409 Conflict otherwise), update status to PROCESSING, LangGraph thread ID `loan:{application_id}`, invoke graph synchronously (stubs run instantly in Phase 1), update application status from routing_decision (AUTO_APPROVED/ESCALATED/DENIED), create audit events (workflow_initialized, agent_dispatched/agent_completed for each node, aggregation_completed, routing_decision, final status event), create agent_decisions rows, store workflow_thread_id, return 200 with ApplicationResponse
- main.py modification: add setup_checkpointer() to lifespan startup, register submit route blueprint

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
import subprocess, json
# Create application
r1 = subprocess.run(['curl','-sf','-X','POST','http://localhost:8000/v1/applications',
    '-H','Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1',
    '-H','Content-Type: application/json',
    '-d',json.dumps({'borrowerName':'Submit Test','ssn':'111-22-3333','loanAmountCents':25000000,'propertyAddress':'789 Pine Rd','loanTermMonths':360})
], capture_output=True, text=True)
app_id = json.loads(r1.stdout)['data']['id']
# Submit for processing
r2 = subprocess.run(['curl','-sf','-X','POST',f'http://localhost:8000/v1/applications/{app_id}/submit',
    '-H','Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1',
], capture_output=True, text=True)
status = json.loads(r2.stdout)['data']['status']
assert status in ('AUTO_APPROVED','ESCALATED','DENIED'), f'Unexpected status: {status}'
# Verify audit trail
r3 = subprocess.run(['curl','-sf',f'http://localhost:8000/v1/applications/{app_id}/audit',
    '-H','Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1',
], capture_output=True, text=True)
events = json.loads(r3.stdout)['data']
event_types = [e['eventType'] for e in events]
assert 'workflow_initialized' in event_types, f'Missing workflow_initialized: {event_types}'
assert 'routing_decision' in event_types, f'Missing routing_decision: {event_types}'
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User Stories:** US-001, US-002, US-006

---

### S-P1-22: Audit Immutability Verification Test

**Epic:** E-P1-05
**Agent:** @test-engineer
**Dependencies:** S-P1-04, S-P1-07

**Description:**

Integration test verifying audit trail immutability at database level. Insert audit event using app_role credentials, attempt UPDATE using app_role (assert permission error), attempt DELETE using app_role (assert permission error), verify event unchanged after failed mutation attempts. Test connects as app_role (not superuser/migration role) to verify grants from WU04 are correctly applied.

**Files Created:**
- `packages/db/tests/test_audit_immutability.py`

**Key Implementation Details:**
- Connect to database as app_role (not migration_role or superuser)
- Insert audit event via AuditRepository.create
- Attempt UPDATE using raw SQL -> expect permission denied error
- Attempt DELETE using raw SQL -> expect permission denied error
- Verify event unchanged after failed mutation attempts
- Test validates grants from S-P1-04 (app_role SELECT/INSERT only on audit_events)

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_audit_immutability.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** US-021

---

### S-P1-23: Phase 1 Integration Test

**Epic:** E-P1-05
**Agent:** @test-engineer
**Dependencies:** S-P1-21

**Description:**

End-to-end integration test exercising complete Phase 1 flow: health check, readiness check with healthy dependencies, auth rejection without token, create application (DRAFT status, SSN not in response), upload document (PDF accepted, non-PDF rejected), view application (includes documents), submit application (triggers workflow), final status (AUTO_APPROVED due to stub high confidence), audit trail (contains all events), RBAC enforcement (reviewer-only action with loan_officer key returns 403), list applications (paginated), resubmit rejected (409 Conflict), PII redaction in errors (invalid SSN format returns 422 without SSN value in any field). Includes conftest.py with test fixtures for client, database setup/teardown, and auth headers per role.

**Files Created:**
- `packages/api/tests/conftest.py`
- `packages/api/tests/integration/test_application_lifecycle.py`

**Key Implementation Details:**
- Test steps: health (200), ready (200 with healthy deps), auth rejected (401), create app (201, DRAFT), SSN not in response, upload PDF (201), upload non-PDF (400), view app (includes docs), submit (triggers workflow), final status (AUTO_APPROVED), audit trail (all events present), RBAC enforcement (403), list apps (paginated), resubmit (409), PII redaction (invalid SSN -> 422 without SSN value in response)
- conftest.py: test client factory, test database setup/teardown, auth header fixtures for each role
- Verifies all Phase 1 user stories integration

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_application_lifecycle.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User Stories:** All Phase 1 user stories (integration verification)

---

### S-P1-24: Developer Documentation

**Epic:** E-P1-01
**Agent:** @technical-writer
**Dependencies:** S-P1-01, S-P1-21

**Description:**

Update project README per US-069. Include: project description (AI Mortgage Quickstart, who it serves), architecture overview (text-based diagram: FastAPI, LangGraph, PostgreSQL, Redis, MinIO), key technology decisions (from architecture Section 1.2), quickstart (git clone, .env setup with key generation instructions `openssl rand -base64 32` for SSN_ENCRYPTION_KEY, make setup && make dev with expected output at each step), API endpoints table (all Phase 1 endpoints with methods and auth requirements), demo walkthrough (step-by-step curl commands for create app, upload doc, submit, view audit trail), troubleshooting (Docker not running, port conflicts, missing env vars), code walkthrough (codebase structure with file references for supervisor agent, parallel fan-out, checkpoint patterns per US-081).

**Files Created/Modified:**
- `README.md` (update existing)

**Key Implementation Details:**
- Project description: AI Mortgage Quickstart purpose and audience
- Architecture overview: text-based diagram showing component relationships
- Key decisions: from architecture Section 1.2
- Quickstart: git clone, .env setup (include SSN_ENCRYPTION_KEY generation: `openssl rand -base64 32`), make setup && make dev, expected output
- API endpoints: table with method, path, auth requirement for all Phase 1 routes
- Demo walkthrough: curl commands for full lifecycle (create, upload, submit, audit)
- Troubleshooting: common setup issues
- Code walkthrough: codebase structure with references to supervisor agent, parallel fan-out, checkpoint patterns per US-081

**Exit Condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && test -f README.md && grep -q "make setup" README.md && grep -q "Architecture" README.md && grep -q "Quickstart" README.md && echo "PASS" || echo "FAIL"
```

**User Stories:** US-068, US-069, US-081

---

## 4. Dependency Graph

```
S-P1-01 (Scaffolding)
  |
  +---> S-P1-02 (Engine) ---> S-P1-03 (Models) ---> S-P1-04 (Migration)
  |                                                       |
  |                                          +------------+------------+
  |                                          |            |            |
  |                                     S-P1-05      S-P1-06      S-P1-07
  |                                     (Seed)     (App/Doc Repo) (Audit/User/
  |                                                    |          AgentDecision/
  |                                                    |          Config Repo)
  |                                                    |              |
  |      S-P1-08 (Enums+Schemas) ------+              |              |
  |            |                        |              |   +----------+
  |       S-P1-09 (Settings+Errors)  S-P1-20a         |   |
  |            |                        |              |   |
  |    +-------+-------+          S-P1-20b             |   |
  |    |       |       |          (Stub Nodes)         |   |
  |  S-P1-10  S-P1-14 S-P1-15                         |   |
  |  (CorrelID (SSN    (MinIO                          |   |
  |  +Logging) Encrypt) Client)                        |   |
  |    |       |       |                               |   |
  |    |       |       |  S-P1-07 + S-P1-09            |   |
  |    |       |       |       |                       |   |
  |    |       |       |  S-P1-11 (Auth Middleware)     |   |
  |    |       |       |       |                       |   |
  |    |       |       |  S-P1-12 (RBAC Dependency)    |   |
  |    |       |       |       |                       |   |
  |    |       |       |       +----> S-P1-16 (App CRUD) <-+ S-P1-14
  |    |       |       |       +----> S-P1-17 (Doc Upload) <--- S-P1-15
  |    |       |       |       +----> S-P1-18 (Audit Route)
  |    |       |       |
  |    +-------+-------+----> S-P1-13 (Health Routes) <--- S-P1-09, S-P1-08
  |                    |
  |                    +----> S-P1-19 (App Factory) <--- S-P1-10,11,13,16,17,18
  |                              |
  |                              +----> S-P1-21 (Checkpointer+Submit) <--- S-P1-20b,06,07
  |                                        |
  |                                        +----> S-P1-23 (Integration Test)
  |
  +----> S-P1-24 (README) <--- S-P1-21
  |
  S-P1-04 + S-P1-07 -----> S-P1-22 (Audit Immutability Test)
```

**Critical Path:** S-P1-01 → S-P1-02 → S-P1-03 → S-P1-04 → S-P1-07 → S-P1-11 → S-P1-12 → S-P1-16 → S-P1-19 → S-P1-21 → S-P1-23 (11 sequential stories)

**Longest Duration:** Database track (S-P1-02 through S-P1-07) plus convergence to S-P1-21

---

## 5. Execution Order and Parallelism

**Note:** Stories within a wave can start as soon as their specific dependencies complete, not when the entire previous wave finishes. Wave groupings represent the earliest possible start given the dependency graph, but fine-grained parallelism is per-dependency.

### Wave 1: Root Stories (no dependencies)

Execute immediately after project kickoff:

- **S-P1-01** (Scaffolding) — DevOps Engineer
- **S-P1-08** (Enums+Schemas) — Backend Developer

**Parallelism:** 2 concurrent stories

---

### Wave 2: Database Foundation + API Types

Execute after Wave 1 completes:

**Parallel Track A — Database:**
- **S-P1-02** (Engine) — Database Engineer

**Parallel Track B — API Types:**
- **S-P1-09** (Settings+Errors) — Backend Developer (requires S-P1-08)
- **S-P1-20a** (State Types+Graph Def) — Backend Developer (requires S-P1-08)

**Parallelism:** 3 concurrent stories

---

### Wave 3: ORM Models + Services + Health

Execute after Wave 2 completes:

**Parallel Track A — Database:**
- **S-P1-03** (ORM Models) — Database Engineer (requires S-P1-02)

**Parallel Track B — Services:**
- **S-P1-10** (Correlation ID + Logging) — Backend Developer (requires S-P1-09)
- **S-P1-14** (SSN Encryption) — Backend Developer (requires S-P1-09)
- **S-P1-15** (MinIO Client) — Backend Developer (requires S-P1-09)
- **S-P1-20b** (Stub Nodes) — Backend Developer (requires S-P1-20a)

**Parallel Track C — Health:**
- **S-P1-13** (Health Routes) — Backend Developer (requires S-P1-09 + S-P1-08)

**Parallelism:** 6 concurrent stories

---

### Wave 4: Migration

Execute after Wave 3 completes:

- **S-P1-04** (Initial Migration) — Database Engineer (requires S-P1-03)

**Parallelism:** 1 story

---

### Wave 5: Seed Data + Repositories

Execute after Wave 4 completes:

**Parallel Track — Database:**
- **S-P1-05** (Seed Data) — Database Engineer (requires S-P1-04)
- **S-P1-06** (App/Doc Repos) — Backend Developer (requires S-P1-04)
- **S-P1-07** (Audit/User/AgentDecision/Config Repos) — Backend Developer (requires S-P1-04)

**Parallelism:** 3 concurrent stories

---

### Wave 6: Auth Middleware + Audit Immutability

Execute after Wave 5 completes:

- **S-P1-11** (Auth Middleware) — Backend Developer (requires S-P1-07 + S-P1-09)
- **S-P1-22** (Audit Immutability Test) — Test Engineer (requires S-P1-04 + S-P1-07)

**Parallelism:** 2 concurrent stories

---

### Wave 7: RBAC + Routes

Execute after Wave 6 completes:

- **S-P1-12** (RBAC Dependency) — Backend Developer (requires S-P1-08 + S-P1-11)

Then after S-P1-12:

**Parallel Routes:**
- **S-P1-16** (App CRUD Routes) — Backend Developer (requires S-P1-06, S-P1-07, S-P1-12, S-P1-14)
- **S-P1-17** (Doc Upload Route) — Backend Developer (requires S-P1-06, S-P1-07, S-P1-12, S-P1-15)
- **S-P1-18** (Audit Route) — Backend Developer (requires S-P1-07, S-P1-12)

**Parallelism:** 3 concurrent stories after S-P1-12

---

### Wave 8: Application Factory

Execute after Wave 7 completes:

- **S-P1-19** (App Factory + Startup) — Backend Developer (requires S-P1-10, S-P1-11, S-P1-13, S-P1-16, S-P1-17, S-P1-18)

**Parallelism:** 1 story

---

### Wave 9: Checkpointer + Submit

Execute after Wave 8 completes:

- **S-P1-21** (Checkpointer+Submit) — Backend Developer (requires S-P1-19, S-P1-20b, S-P1-06, S-P1-07)

**Parallelism:** 1 story

---

### Wave 10: Integration Test + Documentation

Execute after Wave 9 completes:

**Parallel Track:**
- **S-P1-23** (Integration Test) — Test Engineer (requires S-P1-21)
- **S-P1-24** (README) — Technical Writer (requires S-P1-01, S-P1-21)

**Parallelism:** 2 concurrent stories

---

## 6. Risk Register

| Risk | Impact | Mitigation | Owner |
|------|--------|------------|-------|
| LangGraph version compatibility across phases | If LangGraph API changes between Phase 1 and Phase 2, checkpoint schema may break | Pin exact LangGraph version in pyproject.toml. Test checkpoint resume across service restarts in S-P1-23. | Backend Developer |
| asyncpg pool sizing inadequate | Phase 1 defaults (app: 5-20, checkpoint: 2-5) may need tuning under load | Monitor connection usage in development. Pool sizes are in Settings and easily adjustable. | Database Engineer |
| SSN encryption key management error | Missing or invalid key prevents startup | Startup validation in S-P1-19. .env.example includes generation instructions. | Backend Developer |
| Docker Compose startup ordering issues | Services may start before dependencies are ready | Healthchecks with `condition: service_healthy` in compose.yml. Retry logic in readiness checks. | DevOps Engineer |
| Alembic + asyncpg compatibility edge cases | Alembic async migrations have known edge cases | Use `run_async` in Alembic env.py. Test upgrade/downgrade cycle in S-P1-04. | Database Engineer |
| Phase 1 is the largest phase (25 stories) | Long dependency chain may bottleneck | Two parallel tracks (database + API types) converge late. S-P1-08 has no deps and can start immediately. | Project Manager |

---

## 7. Open Questions

| ID | Question | Impact | Default if Unresolved | Owner |
|----|----------|--------|----------------------|-------|
| P1-OQ-1 | Should Phase 1 integration test use dedicated test database or development database? | Test isolation | Use dedicated test database (`mortgage_test`) created in conftest.py | Test Engineer |
| P1-OQ-2 | Should `GET /v1/applications` list endpoint be included in Phase 1 or deferred to Phase 2? | List endpoint availability | [RESOLVED] Included in Phase 1 via S-P1-16 per TD and architecture build order. | Product Manager |
| P1-OQ-3 | Should submit endpoint run graph synchronously (blocking request) or asynchronously? | Request latency for submit | Synchronous in Phase 1 (stubs are instant). Async execution is Phase 2+ optimization. | Tech Lead |
| P1-OQ-4 | How should US-071 (performance targets) and US-072 (graceful degradation) apply in Phase 1? | Phase 1 completeness | US-071: Not applicable (stubs have no meaningful performance). US-072: S-P1-13 readiness endpoint checks dependencies and returns 503 when unavailable. S-P1-17 returns 503 when MinIO unreachable. Full graceful degradation (circuit breakers, cached fallbacks) is Phase 2+. | Product Manager |

---

## Summary

Phase 1 Work Breakdown defines 25 executable stories organized into 5 epics, covering infrastructure, database, API core, agent framework, and validation. The critical path runs through 11 sequential stories, with opportunities for up to 6 concurrent stories in mid-phase waves. All stories include machine-verifiable exit conditions and trace to upstream technical design work units and user stories. After successful completion of all 25 stories, the system will support the complete Phase 1 scope: developer setup, application CRUD, document upload, stub workflow execution with checkpoint persistence, and audit trail verification.
