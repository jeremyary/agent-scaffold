# Technical Design Phase 1 -- Chunk: Data Layer and HMDA

**Covers:** WU-1 (Database Schema, Roles, Migrations), WU-3 (HMDA Collection Endpoint), WU-6 (Demo Data Seeding)
**Features:** F25 (HMDA Demographic Data Collection and Isolation), F20 (Demo Data Seeding)

---

## WU-1: Database Schema, Roles, and Migrations

### Description

Create all SQLAlchemy models for Phase 1 tables, the initial Alembic migration, PostgreSQL role setup, dual connection pool configuration, and the audit trail immutability trigger.

### Stories Covered

- S-1-F25-02: PostgreSQL role separation (lending_app / compliance_app)
- S-1-F20-04: Idempotent seeding (partial -- creates `demo_data_manifest` table)

### Data Flow: Database Initialization

1. PostgreSQL container starts with init script (`packages/db/init/01-roles.sql`)
2. Init script creates `hmda` schema, `lending_app` role, `compliance_app` role
3. Init script grants appropriate permissions (see hub document HMDA Isolation section)
4. API container starts, runs Alembic migration
5. Migration creates all tables in `public` schema (lending data)
6. Migration creates tables in `hmda` schema (HMDA data)
7. Migration creates audit immutability trigger
8. Migration adjusts grants for `audit_events` (revoke UPDATE/DELETE from lending_app)
9. Dual connection pools are initialized in `database.py`

### Error Paths

- PostgreSQL init script fails: Container exits, restart triggers re-run. Init scripts are idempotent (IF NOT EXISTS).
- Alembic migration fails: API container exits with error. Compose restart policy retries. Migration errors logged with specific table/column info.
- Role already exists: Handled by `IF NOT EXISTS` in init script.
- Schema already exists: Handled by `IF NOT EXISTS` in init script.
- Connection pool creation fails (wrong password): Application fails to start with connection error. Logs include DSN (without password).

### File Manifest

```
packages/db/src/summit_cap_db/__init__.py
packages/db/src/summit_cap_db/database.py              # Dual engines, sessions
packages/db/src/summit_cap_db/models/__init__.py        # Model registry
packages/db/src/summit_cap_db/models/base.py            # DeclarativeBase, mixins
packages/db/src/summit_cap_db/models/application.py     # Application, ApplicationFinancials
packages/db/src/summit_cap_db/models/borrower.py        # Borrower
packages/db/src/summit_cap_db/models/document.py        # Document, DocumentExtraction
packages/db/src/summit_cap_db/models/audit.py           # AuditEvent, AuditViolation
packages/db/src/summit_cap_db/models/hmda.py            # HmdaDemographics (hmda schema)
packages/db/src/summit_cap_db/models/demo.py            # DemoDataManifest
packages/db/src/summit_cap_db/models/conversation.py    # ConversationCheckpoint
packages/db/alembic/env.py                              # Alembic environment config
packages/db/alembic/versions/001_initial_schema.py      # Initial migration
packages/db/init/01-roles.sql                           # PostgreSQL role setup
```

### Key File Contents: SQLAlchemy Models

**packages/db/src/summit_cap_db/models/base.py:**
```python
# This project was developed with assistance from AI tools.
"""SQLAlchemy declarative base and common mixins."""

import uuid
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns."""

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


class UUIDPrimaryKeyMixin:
    """Mixin that adds a UUID primary key."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
```

**packages/db/src/summit_cap_db/models/application.py:**
```python
# This project was developed with assistance from AI tools.
"""Application domain models."""

import uuid
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from summit_cap_db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Application(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Mortgage application -- core entity tracking the lending lifecycle."""

    __tablename__ = "applications"

    borrower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("borrowers.id"), nullable=False
    )
    stage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="prospect",
        comment="Current stage: prospect, application, underwriting, etc."
    )
    loan_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="30yr_fixed, 15yr_fixed, arm, jumbo, fha, va"
    )
    loan_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    property_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    property_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    property_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    property_state: Mapped[str | None] = mapped_column(String(2), nullable=True, default="CO")
    property_zip: Mapped[str | None] = mapped_column(String(10), nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
        comment="Keycloak user ID of assigned loan officer"
    )
    co_borrower_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("borrowers.id"), nullable=True
    )

    # Relationships (lazy loaded)
    borrower = relationship("Borrower", foreign_keys=[borrower_id], lazy="select")
    financials = relationship("ApplicationFinancials", back_populates="application", lazy="select")
    rate_lock = relationship("RateLock", back_populates="application", lazy="select", uselist=False)
    conditions = relationship("Condition", back_populates="application", lazy="select")
    decisions = relationship("Decision", back_populates="application", lazy="select")
    documents = relationship("Document", back_populates="application", lazy="select")


class ApplicationFinancials(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Financial data for an application."""

    __tablename__ = "application_financials"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False
    )
    gross_monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_debts: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_assets: Mapped[float | None] = mapped_column(Float, nullable=True)
    credit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dti_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    ltv_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="w2, self_employed, retired"
    )
    years_employed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    application = relationship("Application", back_populates="financials")


class RateLock(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Rate lock tracking for an application."""

    __tablename__ = "rate_locks"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False, unique=True
    )
    locked_rate: Mapped[float] = mapped_column(Float, nullable=False)
    lock_date: Mapped[date] = mapped_column(nullable=False)
    expiration_date: Mapped[date] = mapped_column(nullable=False)
    lock_term_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    is_active: Mapped[bool] = mapped_column(default=True)

    application = relationship("Application", back_populates="rate_lock")


class Condition(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Underwriting conditions issued during review."""

    __tablename__ = "conditions"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default="standard",
        comment="critical, standard, optional"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="issued",
        comment="issued, responded, under_review, cleared, waived"
    )
    issued_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    application = relationship("Application", back_populates="conditions")


class Decision(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Underwriting decisions on applications."""

    __tablename__ = "decisions"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False
    )
    decision_type: Mapped[str] = mapped_column(
        String(30), nullable=False,
        comment="approve, conditional_approval, suspend, deny"
    )
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    ai_recommendation: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="What the AI recommended"
    )
    ai_recommendation_followed: Mapped[bool | None] = mapped_column(nullable=True)
    decided_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    adverse_action_reasons: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    application = relationship("Application", back_populates="decisions")
```

**packages/db/src/summit_cap_db/models/borrower.py:**
```python
# This project was developed with assistance from AI tools.
"""Borrower identity model."""

import uuid

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from summit_cap_db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Borrower(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Borrower identity and contact information."""

    __tablename__ = "borrowers"

    keycloak_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False,
        comment="Links to Keycloak user ID"
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    ssn_encrypted: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Encrypted SSN -- displayed as ***-**-XXXX for CEO"
    )
    dob: Mapped[str | None] = mapped_column(
        String(10), nullable=True,
        comment="Date of birth YYYY-MM-DD -- masked for CEO"
    )
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**packages/db/src/summit_cap_db/models/document.py:**
```python
# This project was developed with assistance from AI tools.
"""Document domain models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from summit_cap_db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Document(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Document metadata -- tracks uploaded documents for an application."""

    __tablename__ = "documents"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False
    )
    doc_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="pay_stub, w2, tax_return, bank_statement, appraisal, etc."
    )
    file_path: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="Path to raw file in object storage"
    )
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="uploaded",
        comment="uploaded, processing, extracted, failed, reviewed, accepted, rejected"
    )
    quality_flags: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True,
        comment='{"blurry": false, "wrong_period": false, "missing_pages": false, ...}'
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    freshness_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="When this document expires and needs to be refreshed"
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    application = relationship("Application", back_populates="documents")
    extractions = relationship("DocumentExtraction", back_populates="document", lazy="select")


class DocumentExtraction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Extracted data points from a document."""

    __tablename__ = "document_extractions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="e.g., 'gross_income', 'employer_name', 'account_balance'"
    )
    field_value: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    human_corrected: Mapped[bool] = mapped_column(default=False)
    corrected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    document = relationship("Document", back_populates="extractions")
```

**packages/db/src/summit_cap_db/models/audit.py:**
```python
# This project was developed with assistance from AI tools.
"""Audit trail models -- append-only event log."""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from summit_cap_db.models.base import Base


class AuditEvent(Base):
    """Append-only audit event.

    This table has INSERT+SELECT only grants for the application role.
    A database trigger rejects UPDATE and DELETE attempts.
    Hash chain (prev_hash) provides tamper evidence at PoC level.
    """

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    prev_hash: Mapped[str] = mapped_column(Text, nullable=False, default="")
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_role: Mapped[str] = mapped_column(String(30), nullable=False)
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="query, tool_call, data_access, decision, override, system, "
                "state_transition, security_event, hmda_collection, hmda_exclusion, "
                "compliance_check, communication_sent"
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class AuditViolation(Base):
    """Records rejected UPDATE/DELETE attempts on audit_events."""

    __tablename__ = "audit_violations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    attempted_operation: Mapped[str] = mapped_column(String(10), nullable=False)
    user_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    table_name: Mapped[str] = mapped_column(String(100), nullable=False, default="audit_events")
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**packages/db/src/summit_cap_db/models/hmda.py:**
```python
# This project was developed with assistance from AI tools.
"""HMDA demographic data model -- isolated in hmda schema.

This table is ONLY accessible via the compliance_app connection pool.
The lending_app role has NO grants on the hmda schema.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from summit_cap_db.models.base import Base, UUIDPrimaryKeyMixin


class HmdaDemographics(Base, UUIDPrimaryKeyMixin):
    """HMDA demographic data collected per application.

    Stored in the 'hmda' schema, accessible only via compliance_app role.
    """

    __tablename__ = "demographics"
    __table_args__ = {"schema": "hmda"}

    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    race: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ethnicity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    race_collected_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="self_reported"
    )
    ethnicity_collected_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="self_reported"
    )
    sex_collected_method: Mapped[str] = mapped_column(
        String(30), nullable=False, default="self_reported"
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

**packages/db/src/summit_cap_db/models/demo.py:**
```python
# This project was developed with assistance from AI tools.
"""Demo data manifest -- tracks seeding state for idempotency."""

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from summit_cap_db.models.base import Base, UUIDPrimaryKeyMixin


class DemoDataManifest(Base, UUIDPrimaryKeyMixin):
    """Tracks whether demo data has been seeded.

    Used for idempotent seeding -- seeding command checks this table
    before inserting data.
    """

    __tablename__ = "demo_data_manifest"

    seeded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    config_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="SHA-256 hash of seed configuration"
    )
    summary: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Human-readable seeding summary"
    )
    user_count: Mapped[int] = mapped_column(default=0)
    application_count: Mapped[int] = mapped_column(default=0)
    historical_loan_count: Mapped[int] = mapped_column(default=0)
    document_count: Mapped[int] = mapped_column(default=0)
```

**packages/db/src/summit_cap_db/models/conversation.py:**
```python
# This project was developed with assistance from AI tools.
"""Conversation checkpoint model for cross-session memory (F19).

In Phase 1, this table is created but not populated until Phase 2
when the agent layer is implemented.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from summit_cap_db.models.base import Base, UUIDPrimaryKeyMixin


class ConversationCheckpoint(Base, UUIDPrimaryKeyMixin):
    """LangGraph state checkpoint -- persists conversation across sessions.

    user_id is a mandatory isolation key. All queries include
    WHERE user_id = :requesting_user_id.
    """

    __tablename__ = "conversation_checkpoints"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True,
        comment="Mandatory isolation key -- queries always filter on this"
    )
    thread_id: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="LangGraph thread identifier"
    )
    checkpoint_data: Mapped[dict] = mapped_column(
        JSONB, nullable=False,
        comment="Serialized LangGraph checkpoint state"
    )
    checkpoint_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

**Alembic migration excerpt** (packages/db/alembic/versions/001_initial_schema.py):

The migration creates all tables above, plus these database-level enforcement items:

```python
# Audit immutability trigger
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

# Revoke UPDATE/DELETE on audit_events from lending_app
op.execute("REVOKE UPDATE, DELETE ON audit_events FROM lending_app;")

# Grant INSERT, SELECT to compliance_app on audit_events
op.execute("GRANT INSERT, SELECT ON audit_events TO compliance_app;")
op.execute("GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO compliance_app;")
```

### Exit Conditions

```bash
# Alembic migration runs successfully
cd packages/db && uv run alembic upgrade head

# All models import correctly
cd packages/db && uv run python -c "from summit_cap_db.models import *"

# HMDA role separation verified (requires running PostgreSQL)
psql -U lending_app -d summit_cap -c "SELECT * FROM hmda.demographics" 2>&1 | grep -q "permission denied"
psql -U compliance_app -d summit_cap -c "SELECT * FROM hmda.demographics"  # Should succeed

# Audit immutability trigger works
psql -U lending_app -d summit_cap -c "UPDATE audit_events SET event_type='test' WHERE id=1" 2>&1 | grep -q "prohibited"
```

---

## WU-3: HMDA Collection Endpoint

### Description

Implement the HMDA demographic data collection API endpoint that writes to the isolated `hmda` schema using the `compliance_app` connection pool. This also includes the demographic data filter utility (for document extraction in Phase 2) and the CI lint check.

### Stories Covered

- S-1-F25-01: HMDA collection endpoint writes to isolated schema
- S-1-F25-04: Compliance Service is sole HMDA accessor
- S-1-F25-05: CI lint check prevents HMDA schema access outside Compliance Service
- S-1-F25-03: Demographic data filter (utility module, tested standalone)

### Data Flow: HMDA Collection (Happy Path)

1. Borrower submits demographic form on HMDA collection page
2. Frontend sends `POST /api/hmda/collect` with `HmdaCollectionRequest` body
3. Auth middleware validates token, extracts `borrower` role
4. RBAC guard verifies `borrower` role is allowed
5. Route handler delegates to Compliance Service
6. Compliance Service opens a `compliance_app` session (NOT `lending_app`)
7. Service inserts row into `hmda.demographics`
8. Service writes audit event (`event_type = "hmda_collection"`)
9. Transaction commits
10. Returns `HmdaCollectionResponse` with collection timestamp

### Data Flow: Error Paths

**Invalid data (missing fields):**
1. Request body fails Pydantic validation
2. FastAPI returns 422 with field-level errors
3. No database write occurs

**lending_app tries to query HMDA:**
1. Code bug: lending_app connection attempts `SELECT * FROM hmda.demographics`
2. PostgreSQL returns permission denied error
3. SQLAlchemy raises `ProgrammingError`
4. Error logged, request fails with 500
5. The CI lint check prevents this from reaching production

**Compliance pool unavailable:**
1. `compliance_app` connection fails (wrong password, DB down)
2. SQLAlchemy connection error
3. Route returns 503 (Service Unavailable)
4. Error logged with DSN (no password)

**Application ID not found:**
1. Request contains an `application_id` that does not exist
2. The HMDA endpoint does NOT validate against the `applications` table (the compliance_app role is read-only on lending schema, and cross-schema referential integrity is not enforced)
3. The data is stored regardless -- the application_id is a link for aggregation, not a foreign key
4. This is a design tradeoff to maintain schema isolation

### File Manifest

```
packages/api/src/summit_cap/routes/hmda.py                    # HMDA collection endpoint
packages/api/src/summit_cap/services/compliance/__init__.py   # Compliance service
packages/api/src/summit_cap/services/compliance/hmda.py       # HMDA data operations
packages/api/src/summit_cap/services/compliance/demographic_filter.py  # Demographic filter utility
packages/api/tests/test_hmda.py                               # HMDA endpoint tests
packages/api/tests/test_demographic_filter.py                 # Filter utility tests
```

### Key File Contents

**packages/api/src/summit_cap/routes/hmda.py:**
```python
# This project was developed with assistance from AI tools.
"""HMDA demographic data collection endpoint.

This endpoint writes ONLY to the hmda schema via the compliance_app pool.
It does not share a transaction with any lending data operation.
"""

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
    """Collect HMDA demographic data for a mortgage application.

    Writes to the hmda schema using the compliance_app connection pool.
    An audit event is created for every collection.
    """
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

**packages/api/src/summit_cap/services/compliance/hmda.py:**
```python
# This project was developed with assistance from AI tools.
"""HMDA data operations using the compliance_app connection pool.

This module is the SOLE accessor of the hmda schema. No other module
should import ComplianceSession or reference hmda tables.
"""

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
    """Write HMDA demographic data to the isolated hmda schema.

    Uses the compliance_app connection pool -- NOT lending_app.
    Writes an audit event for every collection.
    """
    async with ComplianceSession() as session:
        # Insert into hmda.demographics
        stmt = insert(HmdaDemographics).values(
            application_id=str(application_id),
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

    # Write audit event (uses lending_app pool -- audit_events is in public schema)
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

**packages/api/src/summit_cap/services/compliance/demographic_filter.py:**
```python
# This project was developed with assistance from AI tools.
"""Demographic data filter for document extraction pipeline.

Detects HMDA demographic data in extracted text and excludes it from
the lending data path. Used as Stage 2 of HMDA isolation (per ADR-0001).

Phase 1: keyword-based detection only.
Phase 2+: add semantic similarity when embedding model is available.
"""

import logging
import re

logger = logging.getLogger("summit_cap.services.compliance.demographic_filter")

# Keywords that indicate demographic data
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
    """Result of demographic data filtering."""

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
    """Detect demographic data in extracted text.

    Args:
        text: Extracted text from a document field.

    Returns:
        DemographicFilterResult with detection outcome.
    """
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
    """Filter a list of extraction results, separating demographic data.

    Args:
        extractions: List of {"field_name": str, "field_value": str, ...} dicts.

    Returns:
        Tuple of (clean_extractions, excluded_extractions).
        Clean extractions go to the lending path.
        Excluded extractions are logged as audit events.
    """
    clean = []
    excluded = []

    for extraction in extractions:
        field_name = extraction.get("field_name", "")
        field_value = extraction.get("field_value", "")

        # Check both field name and value
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

### Exit Conditions

```bash
# HMDA endpoint tests
cd packages/api && uv run pytest tests/test_hmda.py -v

# Demographic filter tests
cd packages/api && uv run pytest tests/test_demographic_filter.py -v

# CI lint check for HMDA isolation
make lint-hmda
```

---

## WU-6: Demo Data Seeding

### Description

Implement the demo data seeding command and API endpoint. Seed realistic data for all application stages, borrowers, documents, conditions, decisions, rate locks, HMDA demographics, and historical loans.

### Stories Covered

- S-1-F20-01: Demo data seeding command
- S-1-F20-02: Demo data includes 5-10 active applications
- S-1-F20-03: Demo data includes 15-25 historical loans

### Data Flow: Seeding (Happy Path)

1. Developer runs `python -m summit_cap.seed` (or `POST /api/admin/seed`)
2. Seeder checks `demo_data_manifest` table for existing data
3. If data exists: exit with "Already seeded" message (idempotent)
4. If no data: begin seeding transaction
5. Create demo users in Keycloak via admin API (sarah.mitchell, james.torres, maria.chen, david.park, plus 2-3 additional borrowers)
6. Insert borrower records linking to Keycloak users
7. Insert 5-10 active applications at various stages
8. Insert application financials with realistic data
9. Insert documents with various statuses and quality flags
10. Insert rate locks (some expiring soon for urgency)
11. Insert conditions (some issued, some responded, some cleared)
12. Insert decisions for completed stages
13. Insert HMDA demographics (via compliance_app pool) for all applications
14. Insert 15-25 historical closed loans with 6-month spread
15. Record seeding in `demo_data_manifest`
16. Print summary

### Data Flow: Error Paths

**Keycloak unavailable:**
1. Seeder attempts to create users via Keycloak admin API
2. Connection fails
3. Transaction rolls back (no partial data)
4. Exit with error: "Keycloak unavailable -- cannot seed demo users"

**Database error during seeding:**
1. Insert fails (constraint violation, connection lost)
2. Transaction rolls back
3. `demo_data_manifest` is not written (seeding incomplete)
4. Next run detects no manifest, attempts full re-seed

**Already seeded (idempotent):**
1. Seeder checks `demo_data_manifest`
2. Finds existing record
3. Prints "Demo data already seeded at {timestamp}"
4. Exit with status 0 (success, no-op)

**Force re-seed:**
1. Developer runs with `--force` flag
2. Seeder deletes `demo_data_manifest` records
3. Seeder deletes demo data (filtered by known demo user IDs)
4. Proceeds with fresh seeding

### File Manifest

```
packages/api/src/summit_cap/seed/__init__.py
packages/api/src/summit_cap/seed/__main__.py            # CLI entry point
packages/api/src/summit_cap/seed/seeder.py              # Main seeding logic
packages/api/src/summit_cap/seed/data/borrowers.py      # Borrower seed data
packages/api/src/summit_cap/seed/data/applications.py   # Application seed data
packages/api/src/summit_cap/seed/data/documents.py      # Document seed data
packages/api/src/summit_cap/seed/data/historical.py     # Historical loan data
packages/api/src/summit_cap/seed/keycloak_admin.py      # Keycloak user creation
packages/api/src/summit_cap/routes/admin.py              # Admin seed API endpoint
data/demo/seed.json                                      # Seed configuration
```

### Seed Data Specifications

**Active applications (7):**

| Borrower | Stage | Loan Type | Loan Amount | Credit Score | LO Assigned | Rate Lock |
|----------|-------|-----------|-------------|--------------|-------------|-----------|
| Sarah Mitchell | application | 30yr_fixed | $325,000 | 720 | James Torres | Yes, expires in 25 days |
| Michael Johnson | application | fha | $250,000 | 660 | James Torres | No |
| Jennifer Williams | underwriting | 15yr_fixed | $450,000 | 750 | James Torres | Yes, expires in 10 days |
| Robert Garcia | underwriting | 30yr_fixed | $380,000 | 695 | Lisa Park (LO 2) | Yes, expires in 35 days |
| Emily Davis | conditional_approval | arm | $520,000 | 735 | James Torres | Yes, expires in 8 days |
| Thomas Brown | conditional_approval | jumbo | $780,000 | 760 | Lisa Park (LO 2) | Yes, expires in 20 days |
| Amanda Wilson | final_approval | va | $290,000 | 710 | James Torres | Yes, expires in 15 days |

**Historical loans (20):**

Spread across 6 months. Mix of all six loan types. 3 denials (high DTI, low credit, insufficient income), 17 closed. HMDA demographics with ~30% protected class representation.

**Document completeness:**
- Sarah Mitchell: 3/5 documents uploaded, 1 with quality flag (blurry)
- Jennifer Williams: All documents complete, in extraction
- Emily Davis: All documents complete, some conditions outstanding
- Others: Varying completeness levels

### Exit Conditions

```bash
# Seeding command runs successfully
cd packages/api && uv run python -m summit_cap.seed --check

# Verify data was seeded
cd packages/api && uv run python -c "
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
cd packages/api && uv run python -m summit_cap.seed  # Should print "Already seeded"

# Verify HMDA data was seeded in hmda schema
psql -U compliance_app -d summit_cap -c "SELECT COUNT(*) FROM hmda.demographics"
```

---

*This chunk is part of the Phase 1 Technical Design. See `plans/technical-design-phase-1.md` for the hub document with all binding contracts and the dependency graph.*
