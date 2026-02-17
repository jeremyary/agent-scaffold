# This project was developed with assistance from AI tools.

# Work Breakdown: Phase 1 -- Data Layer and HMDA Chunk

**Covers:** WU-1 (Database Schema, Roles, Migrations), WU-3 (HMDA Collection Endpoint), WU-6 (Demo Data Seeding)

**Features:** F25 (HMDA Demographic Data Collection and Isolation), F20 (Demo Data Seeding)

**Stories:** 8 unique (WU-1: 2, WU-3: 3, WU-6: 3)

**Source:** `plans/technical-design-phase-1-chunk-data.md` (detailed WU specs), `plans/technical-design-phase-1.md` (binding contracts), `plans/requirements-chunk-1-foundation.md` (acceptance criteria)

---

## Work Unit: WU-1 -- Database Schema, Roles, and Migrations

**Dependencies:** WU-0 (Bootstrap)

**Blocks:** WU-3, WU-4, WU-6, WU-7

**Agent:** @database-engineer

**Complexity:** M (Medium)

**Description:** Create all SQLAlchemy models for Phase 1 tables, the initial Alembic migration, PostgreSQL role setup, dual connection pool configuration, and the audit trail immutability trigger. This WU establishes the foundation for all data layer work.

**Ownership note:** WU-1 creates the `audit_events` table, the immutability trigger, and the `AuditEvent` SQLAlchemy model. The audit *service* (`packages/api/src/summit_cap/services/audit.py` with `write_audit_event()`) is created by WU-3/S-1-F25-01, which is its first consumer. If WU-1 and WU-3 run in parallel streams, WU-3 must not start `services/audit.py` until WU-1's migration has created the underlying table.

---

### Story: S-1-F25-02 -- PostgreSQL role separation (lending_app / compliance_app)

**WU:** WU-1

**Feature:** F25 -- HMDA Demographic Data Collection and Isolation

**Complexity:** M

#### Acceptance Criteria

**Given** the database is initialized
**When** the schema and roles are created
**Then** two PostgreSQL roles exist: `lending_app` (full CRUD on lending schema, no `hmda` access) and `compliance_app` (SELECT on `hmda`, SELECT on lending, INSERT+SELECT on `audit_events`)

**Given** a query is executed using the `lending_app` role
**When** the query attempts `SELECT * FROM hmda.demographics`
**Then** the database returns a permission denied error

**Given** a query is executed using the `compliance_app` role
**When** the query runs `SELECT * FROM hmda.demographics`
**Then** the query succeeds and returns HMDA data

**Given** a query is executed using the `compliance_app` role
**When** the query attempts `INSERT INTO applications (...)`
**Then** the database returns a permission denied error (compliance_app is read-only on lending schema)

**Given** the FastAPI application starts
**When** connection pools are initialized
**Then** two pools are created: one for `lending_app` (used by all services except Compliance) and one for `compliance_app` (used only by Compliance Service)

**Given** the database role verification test runs
**When** the test executes `psql -U lending_app -c "SELECT * FROM hmda.demographics"`
**Then** the test asserts that the query fails with a permission denied error

#### Files

- `packages/db/init/01-roles.sql` -- PostgreSQL role and schema initialization
- `packages/db/src/summit_cap_db/database.py` -- Dual connection pool configuration
- `packages/db/alembic/versions/001_initial_schema.py` -- Migration with role grants
- `packages/db/src/summit_cap_db/models/base.py` -- Base model and mixins
- `packages/db/src/summit_cap_db/models/hmda.py` -- HmdaDemographics model

#### Implementation Prompt

**Role:** @database-engineer

**Context files:**
- None (greenfield -- all files will be created from scratch)

**Requirements:**

Per the acceptance criteria above, you must:
1. Create a PostgreSQL init script that creates two database roles (`lending_app`, `compliance_app`) and the `hmda` schema
2. Configure grants so `lending_app` has full CRUD on `public` schema tables but ZERO access to `hmda` schema
3. Configure grants so `compliance_app` has read-only access to `public` schema, full access to `hmda` schema, and INSERT+SELECT on `audit_events`
4. Create dual SQLAlchemy engine configuration in `database.py`
5. Verify role separation in the Alembic migration by revoking UPDATE/DELETE on `audit_events` from `lending_app`

**Steps:**

1. **Create `packages/db/init/01-roles.sql`** with the following:
   - `CREATE SCHEMA IF NOT EXISTS hmda;`
   - Create roles `lending_app` and `compliance_app` with LOGIN and passwords from environment variables
   - Grant all privileges on `public` schema to `lending_app`
   - Grant usage on `public` schema + SELECT only to `compliance_app`
   - Grant all privileges on `hmda` schema to `compliance_app`
   - Explicitly `REVOKE ALL ON SCHEMA hmda FROM lending_app;`
   - Use `IF NOT EXISTS` for idempotent role creation

2. **Create `packages/db/src/summit_cap_db/database.py`** with:
   - Import `create_async_engine`, `AsyncSession`, `sessionmaker` from `sqlalchemy.ext.asyncio`
   - Read `DATABASE_URL_LENDING` and `DATABASE_URL_COMPLIANCE` from `summit_cap.core.settings`
   - Create `lending_engine` with `pool_size=10, max_overflow=5`
   - Create `compliance_engine` with `pool_size=3, max_overflow=2`
   - Export `LendingSession` and `ComplianceSession` sessionmakers

3. **Create `packages/db/src/summit_cap_db/models/base.py`** with:
   - `Base` class extending `DeclarativeBase`
   - `UUIDPrimaryKeyMixin` with `id: Mapped[uuid.UUID]` using `UUID(as_uuid=True)` and `default=uuid4`
   - `TimestampMixin` with `created_at` and `updated_at` using `DateTime(timezone=True)` and `server_default=func.now()`

4. **Create all SQLAlchemy models** per the TD chunk specs (12 models: Application, ApplicationFinancials, Borrower, Document, DocumentExtraction, AuditEvent, AuditViolation, HmdaDemographics, DemoDataManifest, ConversationCheckpoint, RateLock, Condition, Decision)

5. **Create the Alembic migration `packages/db/alembic/versions/001_initial_schema.py`** that:
   - Creates all tables in `public` schema
   - Creates `hmda.demographics` table (note `__table_args__ = {"schema": "hmda"}` in the model)
   - Creates the audit immutability trigger (see below)
   - Revokes UPDATE/DELETE on `audit_events` from `lending_app`
   - Grants INSERT+SELECT on `audit_events` to `compliance_app`

6. **Add audit immutability trigger** in migration:
   ```python
   op.execute("""
   CREATE OR REPLACE FUNCTION reject_audit_modification()
   RETURNS TRIGGER AS $$
   BEGIN
       INSERT INTO audit_violations (attempted_operation, table_name, details)
       VALUES (TG_OP, TG_TABLE_NAME, 'Rejected ' || TG_OP || ' on audit_events');
       RAISE EXCEPTION 'Modifications to audit_events are prohibited';
   END;
   $$ LANGUAGE plpgsql;
   """)

   op.execute("""
   CREATE TRIGGER audit_events_immutable
   BEFORE UPDATE OR DELETE ON audit_events
   FOR EACH ROW EXECUTE FUNCTION reject_audit_modification();
   """)
   ```

**Contracts:**

All models MUST conform to these binding contracts from the TD hub:

**Base model:**
```python
class Base(DeclarativeBase):
    pass

class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

**HmdaDemographics (CRITICAL -- must use `hmda` schema):**
```python
class HmdaDemographics(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "demographics"
    __table_args__ = {"schema": "hmda"}

    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    race: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ethnicity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    race_collected_method: Mapped[str] = mapped_column(String(30), nullable=False, default="self_reported")
    ethnicity_collected_method: Mapped[str] = mapped_column(String(30), nullable=False, default="self_reported")
    sex_collected_method: Mapped[str] = mapped_column(String(30), nullable=False, default="self_reported")
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

**DemoDataManifest:**
```python
class DemoDataManifest(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "demo_data_manifest"

    seeded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    config_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    user_count: Mapped[int] = mapped_column(default=0)
    application_count: Mapped[int] = mapped_column(default=0)
    historical_loan_count: Mapped[int] = mapped_column(default=0)
    document_count: Mapped[int] = mapped_column(default=0)
```

**ConversationCheckpoint:**
```python
class ConversationCheckpoint(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "conversation_checkpoints"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    thread_id: Mapped[str] = mapped_column(String(100), nullable=False)
    checkpoint_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    checkpoint_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

**AuditEvent:**
```python
class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    prev_hash: Mapped[str] = mapped_column(Text, nullable=False, default="")
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_role: Mapped[str] = mapped_column(String(30), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    application_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
```

**Document (CRITICAL triage fix -- `freshness_expires_at` is nullable):**
```python
class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "documents"

    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="uploaded")
    quality_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    freshness_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
```

**All other models:** See the TD chunk for full definitions. The models above are the ones with special attention needed.

**Important triage fixes:**
- Use `Mapped[uuid.UUID]` (not `Mapped[str]`) for all UUID columns
- `checkpoint_metadata` (not `metadata`) in ConversationCheckpoint
- `HmdaDemographics.application_id` has `index=True`
- `Document.freshness_expires_at` is `Mapped[datetime | None]`

**Exit condition:**

```bash
# Alembic migration runs successfully
cd /home/jary/git/agent-scaffold/packages/db && uv run alembic upgrade head

# All models import correctly
cd /home/jary/git/agent-scaffold/packages/db && uv run python -c "from summit_cap_db.models import *"

# HMDA role separation verified (requires running PostgreSQL)
psql -U lending_app -d summit_cap -c "SELECT * FROM hmda.demographics" 2>&1 | grep -q "permission denied"
psql -U compliance_app -d summit_cap -c "SELECT * FROM hmda.demographics"  # Should succeed

# Audit immutability trigger works
psql -U lending_app -d summit_cap -c "INSERT INTO audit_events (prev_hash, user_id, user_role, event_type, event_data) VALUES ('', '00000000-0000-0000-0000-000000000001', 'test', 'test', '{}'); UPDATE audit_events SET event_type='modified' WHERE id=1" 2>&1 | grep -q "prohibited"
```

---

### Story: S-1-F20-04 -- Idempotent seeding (partial -- manifest table creation)

**WU:** WU-1

**Feature:** F20 -- Pre-Seeded Demo Data

**Complexity:** S

#### Acceptance Criteria (Partial for WU-1)

**Given** the Alembic migration runs
**When** the migration creates tables
**Then** the `demo_data_manifest` table is created with columns: `id`, `seeded_at`, `config_hash`, `summary`, `user_count`, `application_count`, `historical_loan_count`, `document_count`

**Note:** The full idempotency logic is implemented in WU-6 (the seeding command itself). WU-1 only creates the table.

#### Files

- `packages/db/src/summit_cap_db/models/demo.py` -- DemoDataManifest model

#### Implementation Prompt

**Role:** @database-engineer

**Context files:**
- Already loaded from S-1-F25-02 task

**Requirements:**

Per the acceptance criteria above, you must:
1. Create the `DemoDataManifest` model in `packages/db/src/summit_cap_db/models/demo.py`
2. Include it in the Alembic migration (already covered by step 4 of S-1-F25-02)

**Steps:**

1. **Create `packages/db/src/summit_cap_db/models/demo.py`** with the `DemoDataManifest` model (see contract above)
2. **Import** the model in `packages/db/src/summit_cap_db/models/__init__.py` so it's included in Alembic's metadata

**Contracts:**

See `DemoDataManifest` contract above.

**Exit condition:**

```bash
# Verify model imports and table exists after migration
cd /home/jary/git/agent-scaffold/packages/db && uv run python -c "from summit_cap_db.models.demo import DemoDataManifest; print(DemoDataManifest.__tablename__)"
psql -U lending_app -d summit_cap -c "\d demo_data_manifest"
```

---

## Work Unit: WU-3 -- HMDA Collection Endpoint

**Dependencies:** WU-1 (Database Schema + Roles)

**Blocks:** WU-7 (Integration Tests)

**Agent:** @backend-developer

**Complexity:** M (Medium)

**Description:** Implement the HMDA demographic data collection API endpoint that writes to the isolated `hmda` schema using the `compliance_app` connection pool. This also includes the demographic data filter utility (for document extraction in Phase 2) and the CI lint check.

---

### Story: S-1-F25-01 -- HMDA collection endpoint writes to isolated schema

**WU:** WU-3

**Feature:** F25 -- HMDA Demographic Data Collection and Isolation

**Complexity:** M

#### Acceptance Criteria

**Given** a borrower submits HMDA demographic data via the collection form
**When** the data is posted to `POST /api/hmda/collect`
**Then** the endpoint writes the data to the `hmda.demographics` table in the isolated `hmda` schema

**Given** the HMDA collection endpoint writes data
**When** the database transaction is committed
**Then** the transaction involves only the `hmda` schema — no lending schema tables are touched

**Given** the HMDA collection endpoint is invoked
**When** the endpoint uses a database connection
**Then** the endpoint uses the `compliance_app` connection pool (not the `lending_app` pool)

**Given** the HMDA collection endpoint writes data
**When** the write is logged
**Then** an audit event is written to `audit_events` with `event_type = 'hmda_collection'`

**Given** the HMDA collection endpoint receives invalid data (e.g., missing required fields)
**When** the endpoint validates the data
**Then** the endpoint returns 400 (Bad Request) with field-level validation errors and does not write to the database

**Given** the `lending_app` connection pool is used to query the `hmda` schema
**When** the query is executed
**Then** the database returns a permission denied error (enforces role separation)

#### Files

- `packages/api/src/summit_cap/routes/hmda.py` -- HMDA collection endpoint
- `packages/api/src/summit_cap/services/compliance/__init__.py` -- Compliance service module
- `packages/api/src/summit_cap/services/compliance/hmda.py` -- HMDA data operations
- `packages/api/src/summit_cap/schemas/hmda.py` -- Pydantic request/response models
- `packages/api/tests/test_hmda.py` -- HMDA endpoint tests

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/db/src/summit_cap_db/database.py` -- Dual connection pools (LendingSession, ComplianceSession)
- `packages/db/src/summit_cap_db/models/hmda.py` -- HmdaDemographics model
- `packages/api/src/summit_cap/schemas/common.py` -- UserContext, UserRole enums
- `packages/api/src/summit_cap/services/audit.py` -- write_audit_event function (created in S-1-F25-01)

**Requirements:**

Per the acceptance criteria above, you must:
1. Create Pydantic request/response models for HMDA collection (`HmdaCollectionRequest`, `HmdaCollectionResponse`)
2. Create the HMDA collection route in `packages/api/src/summit_cap/routes/hmda.py` that requires `borrower` role
3. Create the Compliance Service in `packages/api/src/summit_cap/services/compliance/hmda.py` that uses `ComplianceSession` (NOT `LendingSession`)
4. Write an audit event after every HMDA collection
5. Write integration tests that verify role separation and audit event creation

**Steps:**

1. **Create `packages/api/src/summit_cap/schemas/hmda.py`** with:
   ```python
   from datetime import datetime
   from uuid import UUID
   from pydantic import BaseModel, Field

   class HmdaCollectionRequest(BaseModel):
       application_id: UUID
       race: str | None = None
       ethnicity: str | None = None
       sex: str | None = None
       race_collected_method: str = Field(default="self_reported")
       ethnicity_collected_method: str = Field(default="self_reported")
       sex_collected_method: str = Field(default="self_reported")

   class HmdaCollectionResponse(BaseModel):
       id: UUID
       application_id: UUID
       collected_at: datetime
       status: str = "collected"
   ```

2. **Create `packages/api/src/summit_cap/services/audit.py`** with the `write_audit_event` function per the TD hub contract (see below). **This WU (WU-3) is the definitive owner of this file** -- WU-1 creates the underlying table and model, but the service module is created here as its first consumer.

3. **Create `packages/api/src/summit_cap/services/compliance/hmda.py`** with:
   ```python
   import logging
   from uuid import UUID
   from sqlalchemy import insert

   from summit_cap.schemas.common import UserContext
   from summit_cap.schemas.hmda import HmdaCollectionRequest, HmdaCollectionResponse
   from summit_cap.services.audit import write_audit_event
   from summit_cap_db.database import ComplianceSession
   from summit_cap_db.models.hmda import HmdaDemographics

   logger = logging.getLogger("summit_cap.services.compliance.hmda")

   async def collect_hmda_data(
       application_id: UUID,
       data: HmdaCollectionRequest,
       user_context: UserContext,
   ) -> HmdaCollectionResponse:
       """Write HMDA demographic data to the isolated hmda schema."""
       async with ComplianceSession() as session:
           stmt = insert(HmdaDemographics).values(
               application_id=application_id,
               race=data.race,
               ethnicity=data.ethnicity,
               sex=data.sex,
               race_collected_method=data.race_collected_method,
               ethnicity_collected_method=data.ethnicity_collected_method,
               sex_collected_method=data.sex_collected_method,
           ).returning(HmdaDemographics.id, HmdaDemographics.collected_at)

           result = await session.execute(stmt)
           row = result.first()
           await session.commit()

       # Write audit event (uses lending_app pool)
       await write_audit_event(
           user_id=user_context.user_id,
           user_role=user_context.role.value,
           event_type="hmda_collection",
           event_data={
               "application_id": str(application_id),
               "fields_collected": [
                   f for f in ("race", "ethnicity", "sex")
                   if getattr(data, f) is not None
               ],
           },
           application_id=application_id,
       )

       return HmdaCollectionResponse(
           id=row.id,
           application_id=application_id,
           collected_at=row.collected_at,
           status="collected",
       )
   ```

4. **Create `packages/api/src/summit_cap/routes/hmda.py`** with:
   ```python
   import logging
   from fastapi import APIRouter, Depends, HTTPException

   from summit_cap.middleware.auth import get_current_user
   from summit_cap.middleware.rbac import require_roles
   from summit_cap.schemas.common import UserContext, UserRole
   from summit_cap.schemas.hmda import HmdaCollectionRequest, HmdaCollectionResponse
   from summit_cap.services.compliance.hmda import collect_hmda_data

   logger = logging.getLogger("summit_cap.routes.hmda")
   router = APIRouter()

   @router.post(
       "/collect",
       response_model=HmdaCollectionResponse,
       status_code=201,
       dependencies=[Depends(require_roles(UserRole.BORROWER))],
   )
   async def collect_hmda(
       request: HmdaCollectionRequest,
       user: UserContext = Depends(get_current_user),
   ) -> HmdaCollectionResponse:
       try:
           result = await collect_hmda_data(
               application_id=request.application_id,
               data=request,
               user_context=user,
           )
           return result
       except Exception:
           logger.error("HMDA collection failed", exc_info=True)
           raise HTTPException(status_code=503, detail="HMDA collection service unavailable")
   ```

5. **Write tests in `packages/api/tests/test_hmda.py`** that cover:
   - Valid HMDA data collection returns 201
   - Invalid data (missing fields) returns 400
   - Unauthorized role returns 403
   - Audit event is created for every collection
   - `lending_app` pool cannot query `hmda.demographics`

**Contracts:**

**Audit event writing function (from TD hub):**

Create `packages/api/src/summit_cap/services/audit.py` with:

```python
import json
from uuid import UUID, uuid4
import hashlib
from datetime import datetime, timezone

from sqlalchemy import select, text
from summit_cap_db.database import LendingSession
from summit_cap_db.models.audit import AuditEvent


async def write_audit_event(
    user_id: UUID,
    user_role: str,
    event_type: str,
    event_data: dict,
    application_id: UUID | None = None,
    decision_id: UUID | None = None,
    source_document_id: UUID | None = None,
    session_id: UUID | None = None,
) -> int:
    """Write an append-only audit event. Returns the event ID."""
    async with LendingSession() as session:
        # Acquire advisory lock for serial hash chain computation
        await session.execute(text("SELECT pg_advisory_lock(1)"))
        try:
            # Get previous event for hash chain
            result = await session.execute(
                select(
                    AuditEvent.id,
                    AuditEvent.prev_hash,
                    AuditEvent.user_id,
                    AuditEvent.event_type,
                    AuditEvent.event_data,
                ).order_by(AuditEvent.id.desc()).limit(1)
            )
            prev = result.first()
            prev_hash = ""
            if prev:
                hash_input = (
                    f"{prev.id}:{prev.prev_hash}:{prev.user_id}"
                    f":{prev.event_type}"
                    f":{json.dumps(prev.event_data, sort_keys=True)}"
                )
                prev_hash = hashlib.sha256(hash_input.encode()).hexdigest()

            # Insert new event
            new_event = AuditEvent(
                prev_hash=prev_hash,
                user_id=user_id,
                user_role=user_role,
                event_type=event_type,
                application_id=application_id,
                decision_id=decision_id,
                event_data=event_data,
                source_document_id=source_document_id,
                session_id=session_id,
            )
            session.add(new_event)
            await session.flush()
            event_id = new_event.id
            await session.commit()
            return event_id
        finally:
            await session.execute(text("SELECT pg_advisory_unlock(1)"))
```

**Exit condition:**

```bash
# HMDA endpoint tests pass
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_hmda.py -v

# Verify role separation manually (requires running PostgreSQL + API)
curl -X POST http://localhost:8000/api/hmda/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <borrower-token>" \
  -d '{"application_id": "00000000-0000-0000-0000-000000000001", "race": "White", "ethnicity": "Not Hispanic or Latino", "sex": "Male"}'
# Should return 201

psql -U lending_app -d summit_cap -c "SELECT * FROM hmda.demographics" 2>&1 | grep -q "permission denied"
# Should fail with permission denied
```

---

### Story: S-1-F25-04 -- Compliance Service is sole HMDA accessor

**WU:** WU-3

**Feature:** F25 -- HMDA Demographic Data Collection and Isolation

**Complexity:** S

#### Acceptance Criteria

**Given** the Compliance Service needs to compute fairness metrics
**When** the service queries the `hmda` schema
**Then** the service uses the `compliance_app` connection pool and successfully retrieves HMDA data

**Given** the Application Service needs to create an application record
**When** the service queries the database
**Then** the service uses the `lending_app` connection pool and has no access to the `hmda` schema

**Given** the CEO Assistant agent invokes the `get_hmda_aggregates` tool (Phase 2+)
**When** the tool executes
**Then** the tool calls the Compliance Service, which queries the `hmda` schema and returns pre-aggregated statistics

**Given** a developer attempts to add HMDA-querying code outside the Compliance Service
**When** the CI lint check runs
**Then** the check detects the violation and fails the build

#### Files

- `packages/api/src/summit_cap/services/compliance/__init__.py` -- Compliance service module init

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- Already loaded from S-1-F25-01 task

**Requirements:**

Per the acceptance criteria above, you must:
1. Ensure the Compliance Service is the ONLY module that imports `ComplianceSession`
2. Add docstring comments to `compliance/hmda.py` stating that this module is the sole HMDA accessor

**Steps:**

1. **Create `packages/api/src/summit_cap/services/compliance/__init__.py`** with:
   ```python
   """Compliance Service -- sole accessor of the hmda schema.

   This module is the ONLY module allowed to import ComplianceSession
   or reference tables in the hmda schema. All other services use
   LendingSession and have no access to HMDA data.

   Per ADR-0001 (HMDA Isolation), demographic data is stored in a
   separate PostgreSQL schema and accessed via a separate connection pool.
   """

   from summit_cap.services.compliance.hmda import collect_hmda_data

   __all__ = ["collect_hmda_data"]
   ```

2. **Add docstring to `compliance/hmda.py`** (already created in S-1-F25-01) at the top:
   ```python
   """HMDA data operations using the compliance_app connection pool.

   This module is the SOLE accessor of the hmda schema. No other module
   should import ComplianceSession or reference hmda tables.
   """
   ```

**Exit condition:**

```bash
# Verify Compliance Service is the only hmda accessor (manual grep -- CI lint check is S-1-F25-05)
cd /home/jary/git/agent-scaffold/packages/api && grep -rn "ComplianceSession" src/summit_cap/ | grep -v "services/compliance/" | grep -v "database.py" | wc -l
# Should output 0

cd /home/jary/git/agent-scaffold/packages/api && grep -rn "hmda" src/summit_cap/ | grep -v "services/compliance/" | grep -v "schemas/hmda.py" | grep -v "routes/hmda.py" | wc -l
# Should output 0
```

---

### Story: S-1-F25-05 -- CI lint check prevents HMDA schema access outside Compliance Service

**WU:** WU-3

**Feature:** F25 -- HMDA Demographic Data Collection and Isolation

**Complexity:** S

#### Acceptance Criteria

**Given** the CI pipeline runs
**When** the lint check step executes
**Then** the check scans all Python files in `packages/api/` for references to the `hmda` schema or the `compliance_app` connection pool

**Given** a Python file outside `services/compliance/` contains a query like `SELECT * FROM hmda.demographics`
**When** the CI lint check runs
**Then** the check detects the violation and fails the build with a descriptive error

**Given** a Python file outside `services/compliance/` imports the `compliance_app` connection pool
**When** the CI lint check runs
**Then** the check detects the violation and fails the build

**Given** the Compliance Service code references the `hmda` schema
**When** the CI lint check runs
**Then** the check allows the reference (it is within the permitted path)

**Given** the lint check runs in a pre-commit hook (optional for PoC)
**When** a developer attempts to commit code that violates HMDA isolation
**Then** the hook blocks the commit and displays the violation message

#### Files

- `Makefile` -- Add `lint-hmda` target

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- None (just adding a Makefile target)

**Requirements:**

Per the acceptance criteria above, you must:
1. Add a `lint-hmda` target to the root `Makefile` that uses `grep` to detect HMDA violations
2. The check must allow references in `services/compliance/`, `schemas/hmda.py`, and `routes/hmda.py`
3. The check must fail if any other file references `hmda` or `ComplianceSession`

**Steps:**

1. **Add to `Makefile`**:
   ```makefile
   lint-hmda:
   	@echo "Checking HMDA isolation..."
   	@if grep -rn --include="*.py" "hmda" packages/api/src/summit_cap/ \
   	    | grep -v "services/compliance/" \
   	    | grep -v "schemas/hmda.py" \
   	    | grep -v "routes/hmda.py" \
   	    | grep -v "__pycache__" \
   	    | grep -v ".pyc"; then \
   	    echo "ERROR: HMDA reference found outside Compliance Service"; exit 1; \
   	fi
   	@if grep -rn --include="*.py" "compliance_engine\|ComplianceSession" packages/api/src/summit_cap/ \
   	    | grep -v "services/compliance/" \
   	    | grep -v "database.py" \
   	    | grep -v "__pycache__"; then \
   	    echo "ERROR: compliance_app pool import found outside Compliance Service"; exit 1; \
   	fi
   	@echo "HMDA isolation check passed"
   ```

2. **Add `lint-hmda` to the main `lint` target**:
   ```makefile
   lint: lint-hmda
   	turbo run lint
   	uv run ruff check packages/api packages/db
   ```

**Exit condition:**

```bash
# CI lint check passes
make lint-hmda

# Verify it catches violations (inject a test violation and run again)
echo "SELECT * FROM hmda.demographics" > packages/api/src/summit_cap/services/application.py
make lint-hmda 2>&1 | grep -q "ERROR: HMDA reference found"
# Should fail with error

# Clean up test violation
rm packages/api/src/summit_cap/services/application.py
```

---

### Story: S-1-F25-03 -- Demographic data filter in document extraction pipeline (standalone utility)

**WU:** WU-3

**Feature:** F25 -- HMDA Demographic Data Collection and Isolation

**Complexity:** S

**Note:** Per TD-I-03, this story implements a standalone utility module with unit tests. Full integration with the document extraction pipeline occurs in Phase 2 when F5 (Document Extraction) is implemented.

#### Acceptance Criteria (Adapted for Standalone Utility)

**Given** extracted text contains demographic keywords (e.g., "race", "ethnicity", "sex")
**When** the demographic data filter evaluates the text
**Then** the filter returns `is_demographic=True` and lists the matched keywords

**Given** extracted text contains no demographic keywords
**When** the demographic data filter evaluates the text
**Then** the filter returns `is_demographic=False`

**Given** a list of extraction results is passed to the filter
**When** the filter processes the list
**Then** the filter returns two lists: clean extractions and excluded extractions

**Given** an extraction result is flagged as demographic data
**When** the result is excluded
**Then** the excluded result includes an `_exclusion_reason` field and `_matched_keywords` list

#### Files

- `packages/api/src/summit_cap/services/compliance/demographic_filter.py` -- Filter utility
- `packages/api/tests/test_demographic_filter.py` -- Unit tests

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- None (standalone utility)

**Requirements:**

Per the acceptance criteria above, you must:
1. Create a demographic data filter utility that detects HMDA keywords in extracted text
2. The filter uses regex pattern matching (no ML/embedding models at PoC level)
3. Write unit tests for keyword detection and extraction filtering

**Steps:**

1. **Create `packages/api/src/summit_cap/services/compliance/demographic_filter.py`** with:
   ```python
   import logging
   import re

   logger = logging.getLogger("summit_cap.services.compliance.demographic_filter")

   DEMOGRAPHIC_KEYWORDS = [
       r"\brace\b",
       r"\bethnicity\b",
       r"\bsex\b",
       r"\bgender\b",
       r"\bnational origin\b",
       r"\bhispanic\b",
       r"\blatino\b",
       r"\blatina\b",
       r"\bcaucasian\b",
       r"\bafrican.american\b",
       r"\basian\b",
       r"\bnative.american\b",
       r"\bpacific.islander\b",
       r"\brace.ethnicity\b",
   ]

   _PATTERNS = [re.compile(kw, re.IGNORECASE) for kw in DEMOGRAPHIC_KEYWORDS]

   class DemographicFilterResult:
       def __init__(
           self,
           is_demographic: bool,
           matched_keywords: list[str],
           original_text: str,
       ) -> None:
           self.is_demographic = is_demographic
           self.matched_keywords = matched_keywords
           self.original_text = original_text

   def detect_demographic_data(text: str) -> DemographicFilterResult:
       """Detect demographic data in extracted text."""
       matched = []
       for pattern in _PATTERNS:
           if pattern.search(text):
               matched.append(pattern.pattern)

       is_demographic = len(matched) > 0

       if is_demographic:
           logger.info(
               "Demographic data detected: keywords=%s text_preview=%s",
               matched,
               text[:100],
           )

       return DemographicFilterResult(
           is_demographic=is_demographic,
           matched_keywords=matched,
           original_text=text,
       )

   def filter_extraction_results(
       extractions: list[dict],
   ) -> tuple[list[dict], list[dict]]:
       """Filter extraction results, separating demographic data."""
       clean = []
       excluded = []

       for extraction in extractions:
           field_name = extraction.get("field_name", "")
           field_value = extraction.get("field_value", "")

           name_result = detect_demographic_data(field_name)
           value_result = detect_demographic_data(field_value)

           if name_result.is_demographic or value_result.is_demographic:
               excluded.append({
                   **extraction,
                   "_exclusion_reason": "demographic_data_detected",
                   "_matched_keywords": (
                       name_result.matched_keywords + value_result.matched_keywords
                   ),
               })
           else:
               clean.append(extraction)

       return clean, excluded
   ```

2. **Write tests in `packages/api/tests/test_demographic_filter.py`** that cover:
   - Text with demographic keywords is detected
   - Text without demographic keywords is not detected
   - Case-insensitive matching works
   - Extraction list filtering separates clean and excluded results
   - Excluded results include `_exclusion_reason` and `_matched_keywords`

**Exit condition:**

```bash
# Demographic filter tests pass
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_demographic_filter.py -v
```

---

## Work Unit: WU-6 -- Demo Data Seeding

**Dependencies:** WU-1 (Database Schema + Roles)

**Blocks:** WU-9 (Docker Compose -- optional seeding)

**Agent:** @backend-developer

**Complexity:** M (Medium)

**Description:** Implement the demo data seeding command and API endpoint. Seed realistic data for all application stages, borrowers, documents, conditions, decisions, rate locks, HMDA demographics, and historical loans. Seeding is idempotent via the `demo_data_manifest` table.

---

### Story: S-1-F20-01 -- Demo data seeding command

**WU:** WU-6

**Feature:** F20 -- Pre-Seeded Demo Data

**Complexity:** M

#### Acceptance Criteria

**Given** the database is empty (fresh deployment)
**When** I run the seeding command (`python -m summit_cap.seed`)
**Then** the command populates the database with demo users, applications, documents, conditions, decisions, rate locks, and HMDA data

**Given** the database already contains demo data
**When** I run the seeding command again
**Then** the command detects existing data (via `demo_data_manifest` table) and refuses to re-seed (idempotent)

**Given** the seeding command runs
**When** it completes successfully
**Then** the command prints a summary: number of users created, applications created, documents uploaded, and historical loans seeded

**Given** the seeding command encounters an error (e.g., Keycloak unavailable)
**When** the error occurs
**Then** the command rolls back any partial data insertion, logs the error, and exits with a non-zero status code

**Given** the seeding command includes Keycloak user creation (optional for PoC -- users can be pre-created via realm JSON)
**When** demo users are seeded
**Then** the command uses Keycloak's admin API to create users and assign roles

**Given** the seeding command completes
**When** I log in as any demo user
**Then** I can authenticate successfully with the seeded credentials

#### Files

- `packages/api/src/summit_cap/seed/__init__.py` -- Seed module
- `packages/api/src/summit_cap/seed/__main__.py` -- CLI entry point
- `packages/api/src/summit_cap/seed/seeder.py` -- Main seeding logic
- `packages/api/src/summit_cap/seed/data/borrowers.py` -- Borrower seed data
- `packages/api/src/summit_cap/seed/data/applications.py` -- Application seed data
- `packages/api/src/summit_cap/seed/data/documents.py` -- Document seed data
- `packages/api/src/summit_cap/seed/data/historical.py` -- Historical loan data

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/db/src/summit_cap_db/database.py` -- LendingSession, ComplianceSession
- `packages/db/src/summit_cap_db/models/` -- All models
- `packages/api/src/summit_cap/services/compliance/hmda.py` -- collect_hmda_data function

**Requirements:**

Per the acceptance criteria above, you must:
1. Create a seeding command (`python -m summit_cap.seed`) that populates demo data
2. Make seeding idempotent by checking the `demo_data_manifest` table before inserting data
3. Insert realistic data across all domain entities (borrowers, applications, financials, documents, conditions, decisions, rate locks, HMDA demographics, historical loans)
4. Support a `--force` flag to re-seed (deletes existing data first)
5. Support a `--check` flag that verifies seeding without modifying data (exits 0 if seeded, exits 1 if not)
6. Print a summary when complete

**Steps:**

1. **Create `packages/api/src/summit_cap/seed/__main__.py`** with CLI entry point:
   ```python
   import asyncio
   import sys
   from summit_cap.seed.seeder import seed_demo_data, check_demo_data

   async def main():
       force = "--force" in sys.argv
       check = "--check" in sys.argv
       if check:
           is_seeded = await check_demo_data()
           sys.exit(0 if is_seeded else 1)
       await seed_demo_data(force=force)

   if __name__ == "__main__":
       asyncio.run(main())
   ```

2. **Create `packages/api/src/summit_cap/seed/seeder.py`** with main logic:
   - Check `demo_data_manifest` for existing data
   - If exists and not `--force`, print "Already seeded" and exit
   - If `--force`, delete demo data (filtered by known demo user IDs)
   - Insert borrowers (7 demo users: Sarah Mitchell, Michael Johnson, Jennifer Williams, Robert Garcia, Emily Davis, Thomas Brown, Amanda Wilson)
   - Insert 7 active applications at various stages (see TD chunk for detailed specs)
   - Insert application financials with realistic data
   - Insert documents with various statuses and quality flags
   - Insert rate locks (some expiring soon)
   - Insert conditions (some issued, some cleared)
   - Insert decisions for completed stages
   - Insert HMDA demographics via `collect_hmda_data` (uses ComplianceSession)
   - Insert 20 historical closed loans with 6-month spread
   - Record seeding in `demo_data_manifest` with config hash and summary
   - Print summary

3. **Create data modules** (`borrowers.py`, `applications.py`, `documents.py`, `historical.py`) with structured data:
   - Use Python dataclasses or dicts to define seed data
   - Reference the TD chunk for exact application specs (loan amounts, credit scores, stages, assigned LOs, rate lock expiration dates)

4. **Write test** in `packages/api/tests/test_seeding.py` that verifies:
   - Seeding command completes without error
   - Re-running seeding is idempotent (no duplicate data)
   - `--force` flag re-seeds successfully
   - All entities have expected counts (7 active apps, 20 historical loans, 27 HMDA records)

**Contracts:**

**Demo data manifest entry:**

After seeding, the `demo_data_manifest` table should have one row with:
- `config_hash`: SHA-256 of seed data configuration (e.g., hash of the data module files)
- `summary`: Human-readable summary like "Seeded 7 borrowers, 7 active applications, 20 historical loans, 27 HMDA records"
- `user_count`, `application_count`, `historical_loan_count`, `document_count`: Actual counts

**Demo users (from TD chunk):**

| Username | Email | Role | Description |
|----------|-------|------|-------------|
| sarah.mitchell | sarah@example.com | borrower | Active application at `application` stage |
| james.torres | james@summitcap.example | loan_officer | LO 1 with 5 assigned applications |
| maria.chen | maria@summitcap.example | underwriter | Underwriter |
| david.park | david@summitcap.example | ceo | CEO with PII-masked access |
| admin | admin@summitcap.example | admin | Admin for dev operations |

**Demo applications (from TD chunk):**

7 active applications distributed across stages:
- 2-3 at `application` stage
- 2-3 at `underwriting` stage
- 1-2 at `conditional_approval` stage
- 1-2 at `final_approval` stage

See the TD chunk for exact specs (Sarah Mitchell: $325k 30yr_fixed, 720 credit, rate lock expires in 25 days, etc.).

**Exit condition:**

```bash
# Seeding command runs successfully
cd /home/jary/git/agent-scaffold/packages/api && uv run python -m summit_cap.seed

# Verify data was seeded
cd /home/jary/git/agent-scaffold/packages/api && uv run python -c "
from summit_cap_db.database import LendingSession
from summit_cap_db.models.application import Application
import asyncio
async def check():
    async with LendingSession() as s:
        from sqlalchemy import select, func
        result = await s.execute(select(func.count()).select_from(Application))
        count = result.scalar()
        assert count >= 7, f'Expected >= 7 applications, got {count}'
        print(f'Applications: {count}')
asyncio.run(check())
"

# Verify idempotency (running again does not duplicate)
cd /home/jary/git/agent-scaffold/packages/api && uv run python -m summit_cap.seed

# Verify --check flag reports seeded
cd /home/jary/git/agent-scaffold/packages/api && uv run python -m summit_cap.seed --check

# Verify HMDA data was seeded in hmda schema
psql -U compliance_app -d summit_cap -c "SELECT COUNT(*) FROM hmda.demographics"
# Should show 27 rows (7 active + 20 historical)
```

---

### Story: S-1-F20-02 -- Demo data includes 5-10 active applications

**WU:** WU-6

**Feature:** F20 -- Pre-Seeded Demo Data

**Complexity:** S

#### Acceptance Criteria

**Given** the seeding command runs
**When** active applications are created
**Then** the database contains 5-10 applications distributed across stages: `application` (2-3), `underwriting` (2-3), `conditional_approval` (1-2), `final_approval` (1-2)

**Given** the seeded applications exist
**When** I view the LO pipeline as a demo LO user (james.torres)
**Then** I see 3-5 applications assigned to my user (data scope enforced)

**Given** the seeded applications include financial data
**When** I query application details
**Then** the financial data is realistic: credit scores 620-780, DTI ratios 25%-43%, loan amounts $150k-$800k, down payments 5%-20%

**Given** the seeded applications include rate locks
**When** I query rate lock status
**Then** some applications have active rate locks (expiring in 8-45 days), demonstrating urgency indicators in the pipeline

**Given** the seeded applications include documents
**When** I query document status
**Then** some applications have complete document sets, some have missing documents, and some have documents flagged with quality issues

#### Files

- `packages/api/src/summit_cap/seed/data/applications.py` -- Application seed data (already created in S-1-F20-01)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- Already loaded from S-1-F20-01 task

**Requirements:**

Per the acceptance criteria above, you must ensure the `applications.py` module contains exactly 7 active applications with:
- 3 assigned to james.torres (LO 1)
- 2 assigned to lisa.park (LO 2, you will create this user if needed)
- 2 unassigned or assigned to other LOs
- Financial data in realistic ranges (see TD chunk)
- Rate locks with varying expiration dates (some urgent, some not)
- Document metadata with varying completeness and quality flags

**Steps:**

1. **Define application data in `applications.py`** with structured specs per the TD chunk:
   ```python
   DEMO_APPLICATIONS = [
       {
           "borrower": "sarah.mitchell",
           "stage": "application",
           "loan_type": "30yr_fixed",
           "loan_amount": 325000,
           "property_value": 400000,
           "credit_score": 720,
           "assigned_to": "james.torres",
           "rate_lock_expires_days": 25,
           "documents": ["pay_stub", "w2", "bank_statement"],  # 3/5 uploaded
           "quality_flags": {"pay_stub": {"blurry": True}},
       },
       # ... 6 more applications per TD specs
   ]
   ```

2. **Verify stage distribution** in your data module:
   - Count applications at each stage and ensure it matches TD specs

3. **No additional implementation needed** -- this story verifies that the data defined in S-1-F20-01 meets the detailed specs.

**Exit condition:**

```bash
# Verify application counts by stage
psql -U lending_app -d summit_cap -c "SELECT stage, COUNT(*) FROM applications WHERE stage IN ('application', 'underwriting', 'conditional_approval', 'final_approval') GROUP BY stage"
# Should show 2-3 at application, 2-3 at underwriting, 1-2 at conditional_approval, 1-2 at final_approval

# Verify LO assignment
psql -U lending_app -d summit_cap -c "SELECT assigned_to, COUNT(*) FROM applications WHERE assigned_to IS NOT NULL GROUP BY assigned_to"
# Should show james.torres with 3-5 applications
```

---

### Story: S-1-F20-03 -- Demo data includes 15-25 historical loans

**WU:** WU-6

**Feature:** F20 -- Pre-Seeded Demo Data

**Complexity:** S

#### Acceptance Criteria

**Given** the seeding command runs
**When** historical loans are created
**Then** the database contains 15-25 completed loans (stage: `closed`) with decision dates spanning 6+ months in the past

**Given** the historical loans are seeded
**When** I query the CEO dashboard's pipeline summary (Phase 2+)
**Then** I see trend data (approval rates, denial rates, turn times) over the past 6 months

**Given** the historical loans include HMDA demographic data
**When** I query fair lending metrics (F38, Phase 4a)
**Then** the demographic distribution includes at least 30% representation in protected classes

**Given** the historical loans are seeded
**When** I compute SPD and DIR metrics
**Then** the dataset is large enough to produce statistically meaningful results (at least 15 loans with HMDA data)

**Given** the historical loans include denials
**When** I query denial reasons
**Then** denials are distributed across realistic reasons: high DTI, low credit score, insufficient income, property appraisal issues

#### Files

- `packages/api/src/summit_cap/seed/data/historical.py` -- Historical loan seed data (already created in S-1-F20-01)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- Already loaded from S-1-F20-01 task

**Requirements:**

Per the acceptance criteria above, you must ensure the `historical.py` module contains 20 historical loans with:
- 17 closed (stage: `closed`)
- 3 denied (stage: `denied`)
- Decision dates spread across 6 months
- HMDA demographic data for all 20 loans with ~30% protected class representation
- Realistic denial reasons

**Steps:**

1. **Define historical loan data in `historical.py`** as a fixed static list. **Do NOT use `random`** -- demo data must be deterministic so every `seed` invocation produces identical, reproducible data for consistent showcase demos.

   ```python
   from datetime import datetime, timezone

   # Fixed historical loans -- deterministic for reproducible demos.
   # Distribution: 17 closed, 3 denied. ~35% protected class representation.
   # Decision dates use fixed offsets from a reference date, not datetime.now().
   REFERENCE_DATE = datetime(2025, 1, 15, tzinfo=timezone.utc)

   HISTORICAL_LOANS = [
       # Closed loans (17)
       {"borrower": "historical_borrower_01", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 285000, "credit_score": 740, "decision_days_ago": 30, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_02", "stage": "closed", "loan_type": "15yr_fixed", "loan_amount": 420000, "credit_score": 760, "decision_days_ago": 45, "hmda_race": "Asian", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_03", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 195000, "credit_score": 680, "decision_days_ago": 60, "hmda_race": "Black or African American", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_04", "stage": "closed", "loan_type": "fha", "loan_amount": 175000, "credit_score": 650, "decision_days_ago": 75, "hmda_race": "White", "hmda_ethnicity": "Hispanic or Latino"},
       {"borrower": "historical_borrower_05", "stage": "closed", "loan_type": "va", "loan_amount": 310000, "credit_score": 720, "decision_days_ago": 80, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_06", "stage": "closed", "loan_type": "arm", "loan_amount": 525000, "credit_score": 755, "decision_days_ago": 90, "hmda_race": "Asian", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_07", "stage": "closed", "loan_type": "jumbo", "loan_amount": 780000, "credit_score": 770, "decision_days_ago": 95, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_08", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 245000, "credit_score": 690, "decision_days_ago": 100, "hmda_race": "Black or African American", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_09", "stage": "closed", "loan_type": "fha", "loan_amount": 165000, "credit_score": 660, "decision_days_ago": 110, "hmda_race": "White", "hmda_ethnicity": "Hispanic or Latino"},
       {"borrower": "historical_borrower_10", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 350000, "credit_score": 735, "decision_days_ago": 120, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_11", "stage": "closed", "loan_type": "15yr_fixed", "loan_amount": 290000, "credit_score": 745, "decision_days_ago": 130, "hmda_race": "Native Hawaiian or Pacific Islander", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_12", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 410000, "credit_score": 710, "decision_days_ago": 140, "hmda_race": "Asian", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_13", "stage": "closed", "loan_type": "va", "loan_amount": 275000, "credit_score": 700, "decision_days_ago": 145, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_14", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 320000, "credit_score": 725, "decision_days_ago": 150, "hmda_race": "Black or African American", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_15", "stage": "closed", "loan_type": "fha", "loan_amount": 185000, "credit_score": 655, "decision_days_ago": 160, "hmda_race": "White", "hmda_ethnicity": "Hispanic or Latino"},
       {"borrower": "historical_borrower_16", "stage": "closed", "loan_type": "arm", "loan_amount": 475000, "credit_score": 750, "decision_days_ago": 170, "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "historical_borrower_17", "stage": "closed", "loan_type": "30yr_fixed", "loan_amount": 230000, "credit_score": 695, "decision_days_ago": 180, "hmda_race": "American Indian or Alaska Native", "hmda_ethnicity": "Not Hispanic or Latino"},
       # Denied loans (3)
       {"borrower": "denied_borrower_01", "stage": "denied", "loan_type": "30yr_fixed", "loan_amount": 350000, "credit_score": 590, "decision_days_ago": 55, "denial_reason": "low_credit_score", "hmda_race": "White", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "denied_borrower_02", "stage": "denied", "loan_type": "fha", "loan_amount": 225000, "credit_score": 640, "decision_days_ago": 105, "denial_reason": "high_dti", "hmda_race": "Black or African American", "hmda_ethnicity": "Not Hispanic or Latino"},
       {"borrower": "denied_borrower_03", "stage": "denied", "loan_type": "30yr_fixed", "loan_amount": 180000, "credit_score": 620, "decision_days_ago": 155, "denial_reason": "insufficient_income", "hmda_race": "White", "hmda_ethnicity": "Hispanic or Latino"},
   ]
   # Protected class representation: 7/20 = 35% (3 Black, 3 Asian, 1 Native Hawaiian/PI, 1 American Indian/AK Native)
   # Hispanic/Latino: 4/20 = 20%
   ```

2. **Compute decision dates** from `REFERENCE_DATE - timedelta(days=decision_days_ago)` in the seeder, not in the data module. This keeps dates relative and avoids drift.

3. **No additional implementation needed** -- this story verifies that the data defined in S-1-F20-01 meets the detailed specs.

**Exit condition:**

```bash
# Verify historical loan counts
psql -U lending_app -d summit_cap -c "SELECT stage, COUNT(*) FROM applications WHERE stage IN ('closed', 'denied') GROUP BY stage"
# Should show 15-20 closed, 2-3 denied

# Verify HMDA data exists for historical loans
psql -U compliance_app -d summit_cap -c "SELECT COUNT(*) FROM hmda.demographics WHERE application_id IN (SELECT id FROM applications WHERE stage IN ('closed', 'denied'))"
# Should show 15-25 rows

# Verify demographic distribution
psql -U compliance_app -d summit_cap -c "SELECT race, COUNT(*) FROM hmda.demographics GROUP BY race"
# Should show at least 30% non-White races
```

---

## Summary

This chunk defines **8 unique stories** (2 for WU-1, 3 for WU-3, 3 for WU-6) covering database schema, HMDA isolation, and demo data seeding.

**Key cross-WU dependencies:**
- **WU-1 → WU-3:** Dual connection pools and HMDA schema must exist before HMDA endpoint can be implemented
- **WU-1 → WU-6:** All tables must exist before seeding can populate data
- **WU-3 → WU-7:** HMDA endpoint must exist before integration tests can verify role separation

**Partial implementations flagged:**
- **WU-3 S-1-F25-03:** Demographic filter is standalone utility -- no extraction pipeline until Phase 2 (TD-I-03)

**Important triage fixes applied:**
- Use `Mapped[uuid.UUID]` (not `Mapped[str]`) for all UUID columns
- `checkpoint_metadata` (not `metadata`) in ConversationCheckpoint
- `HmdaDemographics.application_id` has `index=True`
- `Document.freshness_expires_at` is `Mapped[datetime | None]`

---

*Generated during SDD Phase 11 (Work Breakdown) -- Chunk: Data/HMDA*
