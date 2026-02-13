<!-- This project was developed with assistance from AI tools. -->

# Technical Design -- Phase 1: Foundation

**Version:** 1.1
**Date:** 2026-02-12
**Status:** Proposed (post-review revision -- 22 triage changes applied)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Interface Contracts](#2-interface-contracts)
3. [Work Units](#3-work-units)
4. [Dependency Graph](#4-dependency-graph)
5. [Context Package](#5-context-package)
6. [Risks and Open Questions](#6-risks-and-open-questions)

---

## 1. Overview

### 1.1 Phase Scope

Phase 1 establishes the project skeleton, infrastructure, database, API core with middleware, application/document CRUD, and the LangGraph orchestration framework with stub agent nodes. By the end of Phase 1, a developer can:

1. Start the full stack with `make setup && make dev`
2. Create a loan application via API
3. Upload a PDF document to MinIO
4. Submit the application for processing
5. Watch the workflow execute through stub nodes with checkpoint persistence
6. Verify the complete audit trail records every step
7. Confirm that authentication and RBAC enforce role boundaries

### 1.2 Upstream Inputs

- **Architecture:** `plans/architecture.md` -- system design, schema, API shapes, agent graphs, middleware stack, file structure
- **Requirements:** `plans/requirements.md` -- 81 user stories with acceptance criteria
- **Product Plan:** `plans/product-plan.md` -- features, personas, phasing, constraints

### 1.3 Conventions

- All monetary values: integer cents in database, `Decimal` in Python calculations
- All timestamps: UTC, ISO 8601
- All primary keys: UUID v4
- API responses: `{"data": {...}}` envelope for success, RFC 7807 for errors
- JSON field names: camelCase in API responses, snake_case in Python internals
- File paths: relative to project root unless stated otherwise
- Python code style: PEP 8, Ruff, Google-style docstrings, type hints on all public functions
- AI compliance comment at top of every source file

### 1.4 Phase 1 User Stories Covered

| Story ID | Title | Phase |
|----------|-------|-------|
| US-001 | Supervisor Agent Initialization | Phase 1 |
| US-002 | Document Processing Routing | Phase 1 |
| US-006 | Workflow Checkpoint Persistence | Phase 1 |
| US-008 | Document Upload and Storage | Phase 1 |
| US-021 | Immutable Audit Trail Storage | Phase 1 |
| US-053 | Create Loan Application | Phase 1 |
| US-054 | View Application Detail | Phase 1 |
| US-058 | API Key Authentication | Phase 1 |
| US-059 | Role-Based Access Control | Phase 1 |
| US-060 | Startup Warning for Default Keys | Phase 1 |
| US-064 | Structured Logging | Phase 1 |
| US-065 | Correlation ID Propagation | Phase 1 |
| US-067 | Health Check Endpoints | Phase 1 |
| US-068 | Developer Setup Command Sequence | Phase 1 |
| US-069 | README with Architecture Overview | Phase 1 |
| US-073 | Database Schema, Migration Idempotency, Rollback | Phase 1 (first verifiable) |
| US-081 | Inline Code Documentation for Multi-Agent Patterns | Phase 1 (first verifiable) |

---

## 2. Interface Contracts

This section defines every shared type, schema, and interface signature that multiple work units must agree on. These are **binding contracts** -- implementers must conform exactly. Contracts are Phase 1 scoped: they include only values needed for Phase 1, with notes on where later phases extend them.

### 2.1 Enums

File: `packages/api/src/models/enums.py`

```python
# This project was developed with assistance from AI tools.
"""Domain enums for the AI Mortgage Quickstart.

Phase 1 defines all enum values used by the complete system. Stub nodes
in Phase 1 use a subset; real agent implementations in later phases use
the full set. Defining all values upfront ensures checkpoint compatibility.
"""
from enum import IntEnum, StrEnum


class ApplicationStatus(StrEnum):
    """Application lifecycle states.

    Phase 1 active: DRAFT, PROCESSING, DOCUMENT_PROCESSING,
        PARALLEL_ANALYSIS, AGGREGATED, AUTO_APPROVED, ESCALATED,
        DENIED, PROCESSING_FAILED
    Phase 2 adds active use of: AWAITING_DOCUMENTS, HUMAN_APPROVED, HUMAN_DENIED
    """
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    DOCUMENT_PROCESSING = "DOCUMENT_PROCESSING"
    PARALLEL_ANALYSIS = "PARALLEL_ANALYSIS"
    AGGREGATED = "AGGREGATED"
    AUTO_APPROVED = "AUTO_APPROVED"
    ESCALATED = "ESCALATED"
    DENIED = "DENIED"
    PROCESSING_FAILED = "PROCESSING_FAILED"
    AWAITING_DOCUMENTS = "AWAITING_DOCUMENTS"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    HUMAN_DENIED = "HUMAN_DENIED"


class DocumentType(StrEnum):
    """Document classification categories.

    Phase 1: documents are uploaded but not classified (classification is Phase 2).
    All values defined here for forward compatibility.
    """
    W2 = "W2"
    PAY_STUB = "PAY_STUB"
    TAX_RETURN = "TAX_RETURN"
    BANK_STATEMENT = "BANK_STATEMENT"
    APPRAISAL = "APPRAISAL"
    PHOTO = "PHOTO"
    UNKNOWN = "UNKNOWN"


class Role(IntEnum):
    """User role hierarchy. Higher numeric value = more permissions.

    Permission check: user_role >= required_role
    """
    LOAN_OFFICER = 1
    SENIOR_UNDERWRITER = 2
    REVIEWER = 3


class RoleStr(StrEnum):
    """String representation of roles for database storage and API responses."""
    LOAN_OFFICER = "loan_officer"
    SENIOR_UNDERWRITER = "senior_underwriter"
    REVIEWER = "reviewer"


class AgentName(StrEnum):
    """Agent identifiers used in audit events and agent_decisions."""
    SUPERVISOR = "supervisor"
    DOCUMENT_PROCESSING = "document_processing"
    CREDIT_ANALYSIS = "credit_analysis"
    RISK_ASSESSMENT = "risk_assessment"
    COMPLIANCE = "compliance"
    FRAUD_DETECTION = "fraud_detection"
    DENIAL_COACHING = "denial_coaching"
    INTAKE = "intake"


class EventType(StrEnum):
    """Audit event types.

    Phase 1 active: application_created, documents_uploaded,
        workflow_initialized, agent_dispatched, agent_completed,
        aggregation_completed, routing_decision, auto_approved,
        escalated, denied
    Later phases add active use of human review, threshold, and key events.
    """
    APPLICATION_CREATED = "application_created"
    DOCUMENTS_UPLOADED = "documents_uploaded"
    WORKFLOW_INITIALIZED = "workflow_initialized"
    AGENT_DISPATCHED = "agent_dispatched"
    AGENT_COMPLETED = "agent_completed"
    AGGREGATION_COMPLETED = "aggregation_completed"
    ROUTING_DECISION = "routing_decision"
    AUTO_APPROVED = "auto_approved"
    ESCALATED = "escalated"
    DENIED = "denied"
    HUMAN_REVIEW_STARTED = "human_review_started"
    HUMAN_APPROVED = "human_approved"
    HUMAN_DENIED = "human_denied"
    DOCUMENTS_REQUESTED = "documents_requested"
    THRESHOLD_CHANGED = "threshold_changed"
    SENSITIVITY_CHANGED = "sensitivity_changed"
    AUDIT_EXPORTED = "audit_exported"
    KEY_GENERATED = "key_generated"
    KEY_REVOKED = "key_revoked"


class ActorType(StrEnum):
    """Actor type for audit events."""
    AGENT = "agent"
    USER = "user"


class Recommendation(StrEnum):
    """Agent recommendation values."""
    APPROVE = "APPROVE"
    DENY = "DENY"
    ESCALATE = "ESCALATE"
    FLAG = "FLAG"


class RoutingDecision(StrEnum):
    """Final routing decision values."""
    AUTO_APPROVE = "AUTO_APPROVE"
    ESCALATE = "ESCALATE"
    DENY = "DENY"


class FraudSensitivity(StrEnum):
    """Fraud detection sensitivity levels."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
```

### 2.2 Pydantic Request/Response Schemas

File: `packages/api/src/models/schemas.py`

```python
# This project was developed with assistance from AI tools.
"""Pydantic models for API request/response validation.

All response models use the generic DataEnvelope[T] wrapper.
All error responses use ProblemDetail (RFC 7807).
"""
from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


# --- Generic Envelopes ---

class DataEnvelope(BaseModel, Generic[T]):
    """Standard response envelope: {"data": <payload>}."""
    data: T


class PaginatedEnvelope(BaseModel, Generic[T]):
    """Paginated response envelope."""
    data: list[T]
    pagination: "PaginationMeta"


class PaginationMeta(BaseModel):
    """Cursor-based pagination metadata."""
    next_cursor: str | None = Field(None, alias="nextCursor")
    has_more: bool = Field(alias="hasMore")

    model_config = ConfigDict(populate_by_name=True)


class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details error response."""
    type: str
    title: str
    status: int
    detail: str | None = None
    instance: str | None = None
    errors: list["ValidationErrorItem"] | None = None


class ValidationErrorItem(BaseModel):
    """Individual field validation error."""
    field: str
    message: str
    value: Any = None  # Set to "[REDACTED]" for PII fields


# --- Application Schemas ---

class CreateApplicationRequest(BaseModel):
    """POST /v1/applications request body."""
    borrower_name: str = Field(
        ..., min_length=1, max_length=255, alias="borrowerName",
    )
    ssn: str = Field(...)
    loan_amount_cents: int = Field(..., gt=0, alias="loanAmountCents")
    property_address: str = Field(
        ..., min_length=1, max_length=1000, alias="propertyAddress",
    )
    loan_term_months: int = Field(..., gt=0, le=600, alias="loanTermMonths")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("ssn")
    @classmethod
    def validate_ssn_format(cls, v: str) -> str:
        """Validate SSN format: 123-45-6789 or 123456789."""
        import re
        cleaned = v.replace("-", "")
        if not re.match(r"^\d{9}$", cleaned):
            raise ValueError("SSN must be 9 digits (format: XXX-XX-XXXX or XXXXXXXXX)")
        return v


class ApplicationResponse(BaseModel):
    """Application data in API responses. SSN is NEVER included."""
    id: UUID
    borrower_name: str = Field(alias="borrowerName")
    loan_amount_cents: int = Field(alias="loanAmountCents")
    property_address: str = Field(alias="propertyAddress")
    loan_term_months: int = Field(alias="loanTermMonths")
    interest_rate_bps: int | None = Field(None, alias="interestRateBps")
    status: str
    escalation_reason: str | None = Field(None, alias="escalationReason")
    required_reviewer_role: str | None = Field(None, alias="requiredReviewerRole")
    workflow_thread_id: str | None = Field(None, alias="workflowThreadId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ApplicationDetailResponse(ApplicationResponse):
    """Extended application response with documents and agent analysis.

    In Phase 1, documents is a list; agentAnalysis is None (populated in Phase 2).
    """
    documents: list["DocumentResponse"] = []
    agent_analysis: dict[str, Any] | None = Field(None, alias="agentAnalysis")


class ApplicationListItem(BaseModel):
    """Abbreviated application for list endpoints."""
    id: UUID
    borrower_name: str = Field(alias="borrowerName")
    status: str
    loan_amount_cents: int = Field(alias="loanAmountCents")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# --- Document Schemas ---

class DocumentResponse(BaseModel):
    """Document metadata in API responses."""
    id: UUID
    filename: str
    content_type: str = Field(alias="contentType")
    file_size_bytes: int = Field(alias="fileSizeBytes")
    document_type: str | None = Field(None, alias="documentType")
    classification_confidence: float | None = Field(
        None, alias="classificationConfidence",
    )
    uploaded_at: datetime = Field(alias="uploadedAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# --- Audit Schemas ---

class AuditEventResponse(BaseModel):
    """Audit event in API responses."""
    id: UUID
    application_id: UUID | None = Field(None, alias="applicationId")
    event_type: str = Field(alias="eventType")
    actor_type: str = Field(alias="actorType")
    actor_id: str = Field(alias="actorId")
    actor_role: str | None = Field(None, alias="actorRole")
    details: dict[str, Any] = {}
    correlation_id: UUID | None = Field(None, alias="correlationId")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# --- Health Check Schemas ---

class HealthResponse(BaseModel):
    """GET /health response."""
    status: str
    timestamp: datetime


class DependencyStatus(BaseModel):
    """Individual dependency health status."""
    status: str
    latency_ms: int | None = Field(None, alias="latencyMs")

    model_config = ConfigDict(populate_by_name=True)


class ReadinessResponse(BaseModel):
    """GET /ready response."""
    status: str
    timestamp: datetime
    dependencies: dict[str, DependencyStatus]


# --- Auth Schemas (internal, not returned to clients) ---

class AuthenticatedUser(BaseModel):
    """User context attached to request state after authentication."""
    user_id: UUID
    name: str
    role: str  # RoleStr value
    key_prefix: str

    model_config = ConfigDict(from_attributes=True)
```

### 2.3 ORM Models

File: `packages/db/src/models.py`

```python
# This project was developed with assistance from AI tools.
"""SQLAlchemy ORM models for the AI Mortgage Quickstart.

All tables defined here. Phase 1 creates all tables in the initial migration.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="user")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    key_prefix: Mapped[str] = mapped_column(String(8), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="api_keys")

    __table_args__ = (
        Index("idx_api_keys_hash", "key_hash", postgresql_where="revoked_at IS NULL"),
        Index("idx_api_keys_user", "user_id"),
    )


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    borrower_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ssn_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    ssn_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    loan_amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    property_address: Mapped[str] = mapped_column(Text, nullable=False)
    loan_term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    interest_rate_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="DRAFT",
    )
    escalation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    required_reviewer_role: Mapped[str | None] = mapped_column(
        String(30), nullable=True,
    )
    workflow_thread_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="application")

    __table_args__ = (
        Index("idx_applications_status", "status"),
        Index("idx_applications_created_by", "created_by"),
        Index("idx_applications_updated_at", "updated_at", postgresql_using="btree"),
        Index("idx_applications_ssn_hash", "ssn_hash"),
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="application/pdf",
    )
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    redacted_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    classification_confidence: Mapped[float | None] = mapped_column(
        Numeric(3, 2), nullable=True,
    )
    # Numeric(3,2) allows 0.00-9.99; application-layer Pydantic validation
    # enforces the 0.00-1.00 range. No CHECK constraint needed.
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_confidence: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    pdf_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )

    application: Mapped["Application"] = relationship(back_populates="documents")

    __table_args__ = (
        Index("idx_documents_application", "application_id"),
        Index("idx_documents_type", "document_type"),
    )


class AgentDecision(Base):
    __tablename__ = "agent_decisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False,
    )
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    decision_type: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    # Numeric(3,2) allows 0.00-9.99; application-layer Pydantic validation
    # enforces the 0.00-1.00 range. No CHECK constraint needed.
    recommendation: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    findings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    correlation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False,
    )
    parent_step_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_agent_decisions_application", "application_id"),
        Index("idx_agent_decisions_agent", "agent_name"),
        Index("idx_agent_decisions_correlation", "correlation_id"),
    )


class AuditEvent(Base):
    """Append-only audit event table.

    The application database role has only INSERT and SELECT grants.
    No UPDATE or DELETE. This is enforced in the migration.
    """
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False)
    actor_role: Mapped[str | None] = mapped_column(String(30), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    correlation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_audit_events_application", "application_id"),
        Index("idx_audit_events_type", "event_type"),
        Index("idx_audit_events_created", "created_at"),
        Index("idx_audit_events_correlation", "correlation_id"),
    )


class Configuration(Base):
    __tablename__ = "configuration"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("key", name="uq_configuration_key"),
    )


class Embedding(Base):
    """Vector embeddings for RAG (compliance documents, mortgage knowledge).

    Phase 1 creates the table; Phase 3a populates it.
    """
    __tablename__ = "embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # embedding column uses pgvector -- defined in migration SQL directly,
    # not in ORM (SQLAlchemy pgvector extension handles this)
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict,
    )
    collection: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_embeddings_collection", "collection"),
    )
```

### 2.4 Repository Interfaces

File: `packages/db/src/repositories/__init__.py`

All repositories follow async patterns and accept an `AsyncSession` via constructor injection. Signatures below are binding; implementations must match.

```python
# Repository interface signatures (binding contracts)

# packages/db/src/repositories/application.py
class ApplicationRepository:
    def __init__(self, session: AsyncSession): ...

    async def create(
        self,
        borrower_name: str,
        ssn_encrypted: bytes,
        ssn_hash: str,
        loan_amount_cents: int,
        property_address: str,
        loan_term_months: int,
        created_by: uuid.UUID,
    ) -> Application: ...

    async def get_by_id(self, application_id: uuid.UUID) -> Application | None: ...

    async def list_applications(
        self,
        cursor: str | None = None,
        limit: int = 20,
        status_filter: str | None = None,
    ) -> tuple[list[Application], str | None]: ...
    # Returns (items, next_cursor). next_cursor is None when no more items.

    async def update_status(
        self,
        application_id: uuid.UUID,
        status: str,
        *,
        escalation_reason: str | None = None,
        required_reviewer_role: str | None = None,
        workflow_thread_id: uuid.UUID | None = None,
    ) -> Application: ...


# packages/db/src/repositories/document.py
class DocumentRepository:
    def __init__(self, session: AsyncSession): ...

    async def create(
        self,
        application_id: uuid.UUID,
        filename: str,
        content_type: str,
        file_size_bytes: int,
        storage_key: str,
        uploaded_by: uuid.UUID,
    ) -> Document: ...

    async def get_by_id(self, document_id: uuid.UUID) -> Document | None: ...

    async def list_by_application(
        self, application_id: uuid.UUID,
    ) -> list[Document]: ...


# packages/db/src/repositories/audit.py
class AuditRepository:
    """Append-only repository. No update() or delete() methods exist."""

    def __init__(self, session: AsyncSession): ...

    async def create(
        self,
        event_type: str,
        actor_type: str,
        actor_id: str,
        *,
        application_id: uuid.UUID | None = None,
        actor_role: str | None = None,
        details: dict | None = None,
        correlation_id: uuid.UUID | None = None,
    ) -> AuditEvent: ...

    async def list_by_application(
        self,
        application_id: uuid.UUID,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[AuditEvent], str | None]: ...


# packages/db/src/repositories/user.py
class UserRepository:
    def __init__(self, session: AsyncSession): ...

    async def get_by_id(self, user_id: uuid.UUID) -> User | None: ...

    async def get_by_api_key_hash(self, key_hash: str) -> tuple[User, ApiKey] | None:
        """Look up user by API key hash. Returns None if key is revoked/expired."""
        ...

    async def has_default_keys(self) -> bool:
        """Check if any non-revoked default API keys exist."""
        ...


# packages/db/src/repositories/agent_decision.py
class AgentDecisionRepository:
    def __init__(self, session: AsyncSession): ...

    async def create(
        self,
        application_id: uuid.UUID,
        agent_name: str,
        decision_type: str,
        reasoning: str,
        correlation_id: uuid.UUID,
        *,
        confidence_score: float | None = None,
        recommendation: str | None = None,
        findings: dict | None = None,
        model_used: str | None = None,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        latency_ms: int | None = None,
        parent_step_id: uuid.UUID | None = None,
    ) -> AgentDecision: ...

    async def list_by_application(
        self, application_id: uuid.UUID,
    ) -> list[AgentDecision]: ...


# packages/db/src/repositories/configuration.py
class ConfigurationRepository:
    def __init__(self, session: AsyncSession): ...

    async def get(self, key: str) -> dict | None:
        """Get configuration value by key. Returns the JSONB value or None."""
        ...

    async def set(
        self, key: str, value: dict, updated_by: uuid.UUID | None = None,
    ) -> Configuration: ...
```

### 2.5 Middleware Contracts

#### Correlation ID Middleware

File: `packages/api/src/middleware/correlation_id.py`

```python
# Contract:
# - Reads X-Request-ID header from request
# - If absent, generates UUID v4
# - Sets contextvars.ContextVar[str] named "correlation_id"
# - Attaches correlation_id to request.state.correlation_id
# - Adds X-Request-ID header to response

import contextvars
correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default="",
)
```

#### Authentication Middleware

File: `packages/api/src/middleware/auth.py`

```python
# Contract:
# - Skips /health, /ready, /v1/public/* paths
# - Extracts Bearer token from Authorization header
# - Computes SHA-256 hash of token
# - Looks up hash via UserRepository.get_by_api_key_hash()
# - On success: attaches AuthenticatedUser to request.state.user
# - On failure: returns RFC 7807 response with status 401
# - Redis cache (60s TTL) for key lookups is deferred to Phase 2
#   (Phase 1 always hits the database for simplicity)
```

#### RBAC Dependency

File: `packages/api/src/dependencies.py`

```python
# Contract:
# require_role(minimum_role: Role) -> Depends[AuthenticatedUser]
# - Reads request.state.user (set by auth middleware)
# - Compares user.role against minimum_role using Role IntEnum
# - Returns AuthenticatedUser if authorized
# - Raises HTTP 403 (RFC 7807) if insufficient permissions
```

### 2.6 LangGraph State Types

File: `packages/api/src/agents/state.py`

These TypedDicts define the complete checkpoint-serialized state. All fields are defined in Phase 1 for forward compatibility. Fields not used in Phase 1 are initialized to `None`, `False`, `0`, or empty.

```python
# This project was developed with assistance from AI tools.
"""LangGraph state definitions for the Loan Processing and Intake graphs.

The full state schema is defined in Phase 1 to ensure checkpoint
compatibility across all phases. Fields not yet active are initialized
to None/default values. Stub nodes populate synthetic values.
"""
from typing import Any, Annotated, TypedDict
from langgraph.graph import add_messages


class ThresholdsSnapshot(TypedDict):
    """Configuration snapshot captured at routing time."""
    auto_approve: float
    escalation: float
    denial: float


class DocumentResult(TypedDict):
    doc_id: str
    type: str
    confidence: float
    extracted_data: dict[str, Any]  # TODO: Define per-document-type extraction schemas before Phase 2
    metadata: dict[str, Any]


class CreditAnalysisResult(TypedDict):
    confidence: float
    recommendation: str
    credit_score: int
    debt_to_income: float
    findings: list[str]


class RiskAssessmentResult(TypedDict):
    confidence: float
    recommendation: str
    risk_score: float
    risk_factors: list[str]
    ltv_ratio: float


class ComplianceCheckResult(TypedDict):
    confidence: float
    recommendation: str
    violations: list[str]
    regulatory_references: list[str]


class FraudDetectionResult(TypedDict):
    confidence: float
    recommendation: str
    flags: list[str]
    severity: str


class AggregatedResults(TypedDict):
    final_recommendation: str
    confidence: float
    agent_recommendations: dict[str, str]
    explanation: str


class CoachingOutput(TypedDict):
    suggestions: list[str]
    missing_documents: list[str]
    next_steps: list[str]


class PreviousAnalysis(TypedDict):
    """Archived analysis from a prior resubmission cycle."""
    cycle_number: int
    credit_analysis: CreditAnalysisResult | None
    risk_assessment: RiskAssessmentResult | None
    compliance_check: ComplianceCheckResult | None
    fraud_detection: FraudDetectionResult | None
    aggregated_results: AggregatedResults | None


class LoanProcessingState(TypedDict):
    """Complete state for the Loan Processing Graph.

    Every field is defined here for checkpoint forward-compatibility.
    Phase 1 stubs populate synthetic values for most fields.
    """
    # Core identifiers
    application_id: str
    correlation_id: str
    workflow_status: str

    # Document processing results
    documents: list[DocumentResult]
    document_processing_complete: bool

    # Agent analysis results (populated by parallel fan-out)
    credit_analysis: CreditAnalysisResult | None
    risk_assessment: RiskAssessmentResult | None
    compliance_check: ComplianceCheckResult | None
    fraud_detection: FraudDetectionResult | None

    # Aggregation
    aggregated_results: AggregatedResults | None
    consolidated_narrative: str | None
    has_disagreements: bool
    has_fraud_flags: bool

    # Routing
    routing_decision: str | None
    routing_rationale: str | None
    required_reviewer_role: str | None

    # Denial coaching (populated when denied/low confidence)
    coaching_output: CoachingOutput | None

    # Configuration snapshot (captured at routing time)
    thresholds: ThresholdsSnapshot

    # Resubmission tracking
    resubmission_count: int
    previous_analyses: list[PreviousAnalysis]

    # Messages for LLM context
    messages: Annotated[list, add_messages]


class IntakeState(TypedDict):
    """State for the Intake Graph (public chat). Defined for completeness.

    Not actively used until Phase 3b. Defined here so the Intake Graph
    can be registered in Phase 1 if desired for forward compatibility.
    """
    session_id: str
    messages: Annotated[list, add_messages]
    sentiment: str | None
    tool_results: list[dict]  # TODO: Define concrete TypedDict before Phase 3b
    citations: list[dict]  # TODO: Define concrete TypedDict before Phase 3b
```

**Security note:** `LoanProcessingState` is serialized into the `checkpoint_blobs` table by PostgresSaver. The state does not contain SSNs but does include PII (borrower name, property address via `application_id` lookup). Checkpoint data must be treated with the same access control as the `applications` table. Post-Phase 1: implement checkpoint pruning (retain 90 days after application reaches terminal state).

### 2.7 Pydantic Settings

File: `packages/api/src/settings.py`

```python
# This project was developed with assistance from AI tools.
"""Application configuration via environment variables.

Uses Pydantic Settings for validation and type coercion.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://app_user:password@localhost:5432/mortgage"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "mortgage-documents"
    MINIO_USE_SSL: bool = False

    # SSN Encryption
    SSN_ENCRYPTION_KEY: str  # Required, no default -- app refuses to start without it

    # LLM APIs (not used in Phase 1 stubs, but validated at startup)
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # FRED API (not used in Phase 1)
    FRED_API_KEY: str = ""

    # LangFuse (optional)
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    # SECURITY: LangFuse traces include full LLM prompts and completions.
    # Do NOT enable for workflows processing PII (loan processing graph)
    # unless prompts are sanitized. Safe for public intake chatbot only.

    # App
    CORS_ORIGINS: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    PRODUCTION: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```

#### SSN Encryption Key Management

**Key generation:** Generate with `openssl rand -base64 32` (provides 256 bits of entropy). Never manually type a base64 string.

**Environment separation:** Use different keys for development, staging, and production. Never reuse keys across environments.

**Key rotation:** Rotation requires a data migration -- decrypt all SSNs with the old key and re-encrypt with the new key. This is not implemented in Phase 1 but the constraint must be understood: changing the key without migration makes existing encrypted SSNs unrecoverable. Rotation strategy is a Phase 2+ concern.

**Production hardening:** Environment variables are acceptable for MVP. For production maturity, migrate to a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager). Document this transition path in operational documentation.

### 2.8 Error Handling Contract

File: `packages/api/src/errors.py`

```python
# This project was developed with assistance from AI tools.
"""Application error classes and RFC 7807 error handler.

All errors raised in route handlers or services are caught by the
exception handler and converted to RFC 7807 ProblemDetail responses.
"""

ERROR_BASE_URL = "https://mortgage-quickstart.example.com/errors"


class AppError(Exception):
    """Base error class. All domain errors inherit from this."""
    def __init__(
        self, title: str, detail: str, status: int, error_type: str,
    ):
        self.title = title
        self.detail = detail
        self.status = status
        self.type = f"{ERROR_BASE_URL}/{error_type}"
        super().__init__(detail)


class ValidationError(AppError):
    def __init__(self, detail: str, errors: list | None = None):
        super().__init__("Validation Error", detail, 422, "validation-error")
        self.errors = errors


class NotFoundError(AppError):
    def __init__(self, detail: str):
        super().__init__("Not Found", detail, 404, "not-found")


class AuthenticationError(AppError):
    def __init__(self, detail: str = "Authentication required"):
        super().__init__("Authentication Required", detail, 401, "authentication-required")


class AuthorizationError(AppError):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__("Insufficient Permissions", detail, 403, "insufficient-permissions")


class ConflictError(AppError):
    def __init__(self, detail: str):
        super().__init__("Conflict", detail, 409, "conflict")


class ServiceUnavailableError(AppError):
    def __init__(self, detail: str):
        super().__init__("Service Unavailable", detail, 503, "service-unavailable")
```

### 2.9 Seed Data Contract

The seed migration (002) creates these exact records. API key values are deterministic for developer experience -- they are printed once during `make setup` and documented in `.env.example`.

```python
# Well-known development API keys (printed to console, stored hashed)
SEED_USERS = [
    {"name": "Maria Lopez", "role": "loan_officer"},
    {"name": "David Chen", "role": "senior_underwriter"},
    {"name": "James Wilson", "role": "reviewer"},
]

# API key format: mq_{role_abbrev}_{32_random_chars}
# Deterministic keys for development (generated once, committed to .env.example):
#   Loan Officer:        mq_lo_dev_key_do_not_use_in_production_1
#   Senior Underwriter:  mq_su_dev_key_do_not_use_in_production_2
#   Reviewer:            mq_rv_dev_key_do_not_use_in_production_3
# These are flagged is_default=True to trigger the startup warning.
```

**Production keys:** Must be generated via `openssl rand -hex 32` (64-character hex string, 256 bits entropy). The readable `mq_*` format is for developer convenience only. Production API key generation should use a CSPRNG; a key management endpoint (`POST /v1/admin/keys`) is planned for Phase 2.

```python
SEED_CONFIG = [
    {"key": "confidence_thresholds", "value": {"auto_approve": 0.85, "escalation": 0.60, "denial": 0.40}},
    {"key": "fraud_sensitivity", "value": {"level": "MEDIUM"}},
    {"key": "rate_limits", "value": {"chat_per_hour": 20, "property_per_session": 5, "calc_per_hour": 100}},
]
```

---

## 3. Work Units

### P1-WU01: Project Scaffolding and Infrastructure

**Agent:** DevOps Engineer
**Dependencies:** None (root WU)

**Files created:**
- `packages/api/pyproject.toml`
- `packages/db/pyproject.toml`
- `packages/ui/package.json`
- `turbo.json`
- `Makefile`
- `compose.yml`
- `.env.example`

**Description:**

Create the monorepo package structure. Each package gets its build configuration:
- `packages/api/pyproject.toml`: FastAPI, uvicorn, pydantic-settings, sqlalchemy[asyncpg], langgraph, minio, structlog, tenacity. Python >=3.11.
- `packages/db/pyproject.toml`: sqlalchemy[asyncpg], alembic, asyncpg, pgvector. Shared as a dependency of packages/api.
- `packages/ui/package.json`: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui. Placeholder -- Phase 1 focuses on API.
- `turbo.json`: Pipeline for build, dev, test, lint tasks across packages.
- `Makefile`: `setup` (install deps + start infra + migrate + seed), `dev` (start all servers), `test`, `lint`, `db-start`, `db-upgrade`, `db-rollback`, `containers-build`, `containers-up`.
- `compose.yml`: PostgreSQL (pgvector/pgvector:pg16), Redis (redis:7-alpine), MinIO (minio/minio) with healthchecks per architecture Section 7.2.
- `.env.example`: All environment variables with comments. Include well-known dev API keys and SSN_ENCRYPTION_KEY placeholder. Include SSN_ENCRYPTION_KEY generation command (`openssl rand -base64 32`) in a comment in `.env.example`. Include LangFuse PII security warning as a comment above the LangFuse keys in `.env.example`: 'WARNING: LangFuse logs full LLM prompts. Do not enable for PII-processing workflows without prompt sanitization.'

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && make setup 2>&1 | tail -1 | grep -q "Setup complete" && echo "PASS" || echo "FAIL"
```

**User stories:** US-068 (Developer Setup)

---

### P1-WU02: Database Engine and Session Factory

**Agent:** Database Engineer
**Dependencies:** P1-WU01

**Files created:**
- `packages/db/src/__init__.py`
- `packages/db/src/engine.py`

**Description:**

Create the async SQLAlchemy engine factory and session factory.
- `engine.py`: Creates `create_async_engine` with pool_size=5, max_overflow=15. Exports `async_session_factory` (async sessionmaker bound to engine). Exports `get_db_session` async generator for FastAPI dependency injection. Handles engine disposal on shutdown.
- The engine URL is passed from `Settings.DATABASE_URL`.
- Uses a lazy import of `Base` from `models.py` (created in WU03) -- imported at function call time (e.g., in `create_tables()`), not at module load time. This allows WU02 to be implemented before WU03 exists, as long as WU03 completes before any engine operations execute.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "from packages.db.src.engine import async_session_factory; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-073 (Database Schema)

---

### P1-WU03: SQLAlchemy ORM Models

**Agent:** Database Engineer
**Dependencies:** P1-WU02

**Files created:**
- `packages/db/src/models.py`

**Description:**

Implement all ORM models exactly as specified in Section 2.3. All tables from architecture Section 3.1: `users`, `api_keys`, `applications`, `documents`, `agent_decisions`, `audit_events`, `configuration`, `embeddings`. Include all indexes. The `embeddings` table vector column is handled via raw SQL in the migration (ORM defines non-vector columns only).

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.db.src.models import Base, User, ApiKey, Application, Document, AgentDecision, AuditEvent, Configuration, Embedding
tables = Base.metadata.tables.keys()
expected = {'users','api_keys','applications','documents','agent_decisions','audit_events','configuration','embeddings'}
assert expected.issubset(tables), f'Missing: {expected - tables}'
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-073 (Database Schema)

---

### P1-WU04: Alembic Initial Schema Migration

**Agent:** Database Engineer
**Dependencies:** P1-WU03

**Files created:**
- `packages/db/alembic.ini`
- `packages/db/alembic/env.py`
- `packages/db/alembic/versions/001_initial_schema.py`

**Description:**

Set up Alembic with async support. Create the initial migration that:
1. Creates all 8 tables with all columns, constraints, and indexes as defined in the ORM models.
2. Creates the `app_role` and `migration_role` database roles.
3. Applies grants: `app_role` gets SELECT/INSERT/UPDATE/DELETE on all tables EXCEPT `audit_events` (SELECT/INSERT only).
4. Creates the pgvector extension (`CREATE EXTENSION IF NOT EXISTS vector`).
5. Adds the `embedding` vector(1536) column to the `embeddings` table via raw SQL.
6. Creates the IVFFlat index on the embedding column.
7. Includes both `upgrade()` and `downgrade()` functions.

The `env.py` must use `asyncpg` and import `Base.metadata` from `packages/db/src/models.py`.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && make db-upgrade && make db-rollback && make db-upgrade && echo "PASS" || echo "FAIL"
```

**User stories:** US-073 (Database Schema, Migration Idempotency), US-021 (Immutable Audit Trail -- grants)

---

### P1-WU05: Seed Data Migration

**Agent:** Database Engineer
**Dependencies:** P1-WU04

**Files created:**
- `packages/db/alembic/versions/002_seed_data.py`

**Description:**

Create the seed data migration that inserts:
1. Three users per Section 2.9 seed data contract.
2. Three API keys -- well-known deterministic development keys, hashed with SHA-256, `is_default=True`.
3. Three configuration rows: `confidence_thresholds`, `fraud_sensitivity`, `rate_limits` per Section 2.9.
4. Both `upgrade()` (insert) and `downgrade()` (delete) functions.

Key generation: The migration computes SHA-256 hashes of the well-known dev keys and stores the hashes. The plaintext keys are documented in `.env.example` (created in WU01).

**Exit condition:**
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

**User stories:** US-058 (API Key Authentication -- seed keys), US-060 (Startup Warning -- default keys)

---

### P1-WU06: Repository Implementations -- Application and Document

**Agent:** Backend Developer
**Dependencies:** P1-WU04

**Files created:**
- `packages/db/src/repositories/__init__.py`
- `packages/db/src/repositories/application.py`
- `packages/db/src/repositories/document.py`
- `packages/db/tests/__init__.py`
- `packages/db/tests/conftest.py`
- `packages/db/tests/test_application_repository.py`
- `packages/db/tests/test_document_repository.py`

**Description:**

Implement `ApplicationRepository` and `DocumentRepository` per the signatures in Section 2.4. Key implementation details:
- `list_applications`: cursor-based pagination using `(updated_at, id)` composite cursor. Encode cursor as base64 JSON. Default sort: `updated_at DESC`.
- `update_status`: updates `status`, `updated_at`, and optionally `escalation_reason`, `required_reviewer_role`, `workflow_thread_id`.
- All methods use the `AsyncSession` passed at construction.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_application_repository.py packages/db/tests/test_document_repository.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-053 (Create Application), US-054 (View Application Detail), US-008 (Document Upload)

---

### P1-WU07: Repository Implementations -- Audit, User, AgentDecision, Configuration

**Agent:** Backend Developer
**Dependencies:** P1-WU04

**Files created:**
- `packages/db/src/repositories/audit.py`
- `packages/db/src/repositories/user.py`
- `packages/db/src/repositories/agent_decision.py`
- `packages/db/src/repositories/configuration.py`
- `packages/db/tests/test_audit_repository.py`
- `packages/db/tests/test_user_repository.py`
- `packages/db/tests/test_agent_decision_repository.py`
- `packages/db/tests/test_configuration_repository.py`

**Description:**

Implement `AuditRepository`, `UserRepository`, `AgentDecisionRepository`, and `ConfigurationRepository` per Section 2.4 signatures. Key details:
- `AuditRepository`: Only `create()` and `list_by_application()`. No update or delete methods. Cursor pagination on `(created_at, id)`.
- `UserRepository.get_by_api_key_hash()`: joins `api_keys` and `users`, filters by `revoked_at IS NULL` and `(expires_at IS NULL OR expires_at > now())`.
- `UserRepository.has_default_keys()`: checks for `is_default=True AND revoked_at IS NULL`.
- `ConfigurationRepository.set()`: uses upsert pattern (INSERT ON CONFLICT UPDATE).

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_audit_repository.py packages/db/tests/test_user_repository.py packages/db/tests/test_agent_decision_repository.py packages/db/tests/test_configuration_repository.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-021 (Immutable Audit Trail), US-058 (API Key Auth), US-060 (Default Keys Warning)

---

### P1-WU08: Pydantic Enums and Schemas

**Agent:** Backend Developer
**Dependencies:** None (pure type definitions)

**Files created:**
- `packages/api/src/__init__.py`
- `packages/api/src/models/__init__.py`
- `packages/api/src/models/enums.py`
- `packages/api/src/models/schemas.py`

**Description:**

Implement all enums and Pydantic schemas exactly as specified in Sections 2.1 and 2.2. These are imported by routes, middleware, and services across the API package. Ensure camelCase aliases are configured on all response models for JSON serialization.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.models.enums import ApplicationStatus, Role, EventType, AgentName
from packages.api.src.models.schemas import (
    CreateApplicationRequest, ApplicationResponse, ApplicationDetailResponse,
    DocumentResponse, AuditEventResponse, HealthResponse, ReadinessResponse,
    ProblemDetail, DataEnvelope, PaginatedEnvelope, AuthenticatedUser,
)
# Verify camelCase alias works
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

**User stories:** Cross-cutting -- used by all Phase 1 route and middleware WUs.

---

### P1-WU09: Pydantic Settings and Error Handling

**Agent:** Backend Developer
**Dependencies:** P1-WU08

**Files created:**
- `packages/api/src/settings.py`
- `packages/api/src/errors.py`

**Description:**

Implement `Settings` per Section 2.7 and error classes per Section 2.8. `Settings` uses `pydantic-settings` to load from environment. `SSN_ENCRYPTION_KEY` has no default -- the application fails to start without it. Error classes define the hierarchy: `AppError` base, then `ValidationError`, `NotFoundError`, `AuthenticationError`, `AuthorizationError`, `ConflictError`, `ServiceUnavailableError`.

**Exit condition:**
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

**User stories:** US-067 (Health Checks -- settings), US-068 (Developer Setup -- env config)

---

### P1-WU10: Correlation ID Middleware and Structured Logging

**Agent:** Backend Developer
**Dependencies:** P1-WU09

**Files created:**
- `packages/api/src/middleware/__init__.py`
- `packages/api/src/middleware/correlation_id.py`
- `packages/api/src/middleware/logging.py`

**Description:**

Implement the correlation ID middleware and structured logging middleware per architecture Section 2.1 middleware stack positions [1] and [2].

Correlation ID middleware:
- Reads `X-Request-ID` header or generates UUID v4.
- Sets `correlation_id_var` context variable.
- Attaches to `request.state.correlation_id`.
- Adds `X-Request-ID` response header.

Logging middleware:
- Uses `structlog` for JSON-formatted output.
- Logs request start: method, path, correlation_id.
- Logs request completion: status, duration_ms, correlation_id.
- Never logs request/response bodies.
- PII fields are never logged (SSN, financial data).
- Configures structlog processors chain with JSON renderer for production, console renderer for development.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.middleware.correlation_id import correlation_id_var
from packages.api.src.middleware.logging import configure_logging
assert correlation_id_var.get() == ''
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-064 (Structured Logging), US-065 (Correlation ID Propagation)

---

### P1-WU11: Authentication Middleware

**Agent:** Backend Developer
**Dependencies:** P1-WU07 (UserRepository), P1-WU09 (errors, settings)

**Files created:**
- `packages/api/src/middleware/auth.py`
- `packages/api/tests/integration/__init__.py`
- `packages/api/tests/integration/test_auth.py`

**Description:**

Implement the API key authentication middleware per architecture Section 2.1 position [4] and Section 6.1.

- Skips paths: `/health`, `/ready`, anything starting with `/v1/public/`.
- Extracts `Bearer <token>` from `Authorization` header.
- Computes SHA-256 hash of the token.
- Uses `UserRepository.get_by_api_key_hash(hash)` to look up user and key.
- On success: creates `AuthenticatedUser` and attaches to `request.state.user`.
- On missing/invalid key: returns 401 RFC 7807 response.
- Logs auth events (success/failure) per architecture Section 8.1 security events table.

Note: Redis caching of key lookups is deferred to Phase 2 for simplicity. Phase 1 hits the database on every authenticated request.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_auth.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-058 (API Key Authentication)

---

### P1-WU12: RBAC Dependency and Dependencies Module

**Agent:** Backend Developer
**Dependencies:** P1-WU08 (enums), P1-WU11 (auth middleware)

**Files created:**
- `packages/api/src/dependencies.py`

**Description:**

Implement FastAPI dependency injection functions:
- `get_settings() -> Settings`: Singleton settings instance.
- `get_db_session()`: Yields async database session from engine.
- `get_current_user(request) -> AuthenticatedUser`: Extracts from `request.state.user`, raises 401 if not set.
- `require_role(minimum: Role)`: Returns a dependency that checks `Role[user.role.upper()] >= minimum`. Returns the `AuthenticatedUser` on success, raises 403 on failure.

The `require_role` pattern per architecture Section 6.2:
```python
@router.get("/v1/applications/{id}/audit")
async def get_audit(user: AuthenticatedUser = require_role(Role.LOAN_OFFICER)):
    ...
```

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.dependencies import require_role, get_current_user
from packages.api.src.models.enums import Role
dep = require_role(Role.REVIEWER)
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-059 (Role-Based Access Control)

---

### P1-WU13: Health Check Routes

**Agent:** Backend Developer
**Dependencies:** P1-WU09 (settings), P1-WU08 (schemas)

**Files created:**
- `packages/api/src/routes/__init__.py`
- `packages/api/src/routes/health.py`

**Description:**

Implement `GET /health` and `GET /ready` per architecture Section 7.4.

`/health`: Always returns 200 with `{"status": "ok", "timestamp": "..."}`. No dependency checks.

`/ready`: Checks database (simple `SELECT 1`), Redis (`PING`), and MinIO (bucket exists). Returns 200 if all pass, 503 if any fail. Response body includes per-dependency status and latency. LLM API readiness checks are deferred to Phase 2 (stubs do not call LLMs). The /ready endpoint implicitly covers US-072 (graceful degradation) by reporting per-dependency status. When MinIO or Redis is unavailable, /ready returns 503 with the failing dependency identified.

Both endpoints are unauthenticated.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf http://localhost:8000/health | python -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-067 (Health Check Endpoints)

---

### P1-WU14: SSN Encryption Service

**Agent:** Backend Developer
**Dependencies:** P1-WU09 (settings)

**Files created:**
- `packages/api/src/services/__init__.py`
- `packages/api/src/services/encryption.py`
- `packages/api/tests/unit/test_encryption.py`

**Description:**

Implement AES-256-GCM encryption/decryption for SSNs per architecture Section 6.4.

- `encrypt_ssn(ssn: str, key: bytes) -> bytes`: Encrypts SSN. Returns nonce + ciphertext + tag concatenated.
- `decrypt_ssn(encrypted: bytes, key: bytes) -> str`: Decrypts SSN.
- `hash_ssn(ssn: str, salt: str) -> str`: SHA-256 hash with salt for lookups.
- Key is loaded from `Settings.SSN_ENCRYPTION_KEY` (base64-decoded).
- Startup validation: key must be at least 32 bytes after base64 decoding. If invalid, application refuses to start.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_encryption.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-053 (Create Application -- SSN encryption)

---

### P1-WU15: MinIO Client Service

**Agent:** Backend Developer
**Dependencies:** P1-WU09 (settings)

**Files created:**
- `packages/api/src/services/minio_client.py`
- `packages/api/tests/unit/test_minio_client.py`

**Description:**

Implement MinIO client service for document upload/download per architecture Section 2.5.

- `MinioService` class with methods:
  - `async def ensure_bucket()`: Creates the bucket if it does not exist.
  - `async def upload_document(application_id: UUID, document_id: UUID, filename: str, data: bytes, content_type: str) -> str`: Uploads file, returns storage key. Key format: `{application_id}/{document_id}/{filename}`. Sanitize filename before constructing storage key: `filename = os.path.basename(filename)` to strip path traversal sequences. Limit filename to 255 characters.
  - `async def get_presigned_url(storage_key: str, expires_seconds: int = 900) -> str`: Generates presigned download URL (15-minute default expiry).
- Uses the `minio` Python SDK.
- Connection configured from `Settings`.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_minio_client.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-008 (Document Upload and Storage)

---

### P1-WU16: Application CRUD Routes

**Agent:** Backend Developer
**Dependencies:** P1-WU06 (ApplicationRepo), P1-WU07 (AuditRepo), P1-WU12 (RBAC), P1-WU14 (encryption)

**Files created:**
- `packages/api/src/routes/applications.py`

**Description:**

Implement application CRUD endpoints per architecture Section 4.2:

`POST /v1/applications`:
- Auth required: any role (loan_officer+).
- Validates request body via `CreateApplicationRequest`.
- Encrypts SSN, hashes SSN, creates application via `ApplicationRepository.create()`.
- Creates audit event: `application_created`.
- Returns 201 with `DataEnvelope[ApplicationResponse]` and `Location` header.
- SSN is never returned in the response.

`GET /v1/applications/{id}`:
- Auth required: any role.
- Returns `DataEnvelope[ApplicationDetailResponse]` with documents list.
- Returns 404 if not found.

`GET /v1/applications`:
- Auth required: any role.
- Query params: `cursor`, `limit` (default 20, max 100), `status` (optional filter).
- Returns `PaginatedEnvelope[ApplicationListItem]`.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf -X POST http://localhost:8000/v1/applications \
  -H "Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1" \
  -H "Content-Type: application/json" \
  -d '{"borrowerName":"Test Borrower","ssn":"123-45-6789","loanAmountCents":32000000,"propertyAddress":"123 Main St","loanTermMonths":360}' \
  | python -c "import sys,json; d=json.load(sys.stdin); assert d['data']['status']=='DRAFT'; print('PASS')" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-053 (Create Application), US-054 (View Application Detail)

---

### P1-WU17: Document Upload Route

**Agent:** Backend Developer
**Dependencies:** P1-WU06 (DocumentRepo), P1-WU07 (AuditRepo), P1-WU12 (RBAC), P1-WU15 (MinIO)

**Files created:**
- `packages/api/src/routes/documents.py`

**Description:**

Implement document upload and listing endpoints per architecture Section 4.2 and requirements US-008:

`POST /v1/applications/{id}/documents`:
- Auth required: any role.
- Accepts multipart file upload.
- Validates: file must be PDF (`application/pdf`), max 10 MB.
- Validate PDF content by checking magic bytes: first 4 bytes must be `%PDF` (hex: 25 50 44 46). Reject files that fail magic byte check with 400, even if Content-Type header says `application/pdf`.
- Uploads to MinIO via `MinioService.upload_document()`.
- Creates document record via `DocumentRepository.create()`.
- Creates audit event: `documents_uploaded`.
- Returns 201 with `DataEnvelope[DocumentResponse]`.
- Rejects non-PDF with 400; rejects oversized with 413.
- If MinIO is unreachable, return 503 Service Unavailable (per US-072 graceful degradation).

`GET /v1/applications/{id}/documents`:
- Auth required: any role.
- Returns list of documents for the application.

Add a test that uploads a file with `filename='../../test.pdf'` and verifies the stored filename does not contain path separators.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
import subprocess, json, tempfile, os
AUTH='Authorization: Bearer mq_lo_dev_key_do_not_use_in_production_1'
# Create an application
r1 = subprocess.run(['curl','-sf','-X','POST','http://localhost:8000/v1/applications',
    '-H',AUTH,'-H','Content-Type: application/json',
    '-d',json.dumps({'borrowerName':'Doc Test','ssn':'987-65-4321','loanAmountCents':100000,'propertyAddress':'456 Oak Ave','loanTermMonths':360})
], capture_output=True, text=True)
app_id = json.loads(r1.stdout)['data']['id']
# Create a minimal valid PDF
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

**User stories:** US-008 (Document Upload and Storage)

---

### P1-WU18: Audit Trail Route

**Agent:** Backend Developer
**Dependencies:** P1-WU07 (AuditRepo), P1-WU12 (RBAC)

**Files created:**
- `packages/api/src/routes/audit.py`
- `packages/api/tests/integration/test_audit_trail.py`

**Description:**

Implement the audit trail query endpoint per architecture Section 4.2:

`GET /v1/applications/{id}/audit`:
- Auth required: any role.
- Query params: `cursor`, `limit` (default 20, max 100).
- Returns `PaginatedEnvelope[AuditEventResponse]`.
- Events sorted by `created_at ASC` (chronological order for audit trail readability).
- Returns 404 if application does not exist.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_audit_trail.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-021 (Immutable Audit Trail Storage)

---

### P1-WU19: FastAPI Application Factory and Startup

**Agent:** Backend Developer
**Dependencies:** P1-WU10 (middleware), P1-WU11 (auth), P1-WU13 (health routes), P1-WU16 (app routes), P1-WU17 (doc routes), P1-WU18 (audit routes)

**Files created:**
- `packages/api/src/main.py`

**Description:**

Create the FastAPI application factory per architecture Sections 2.1 and 7.3.

`create_app() -> FastAPI`:
1. Create FastAPI instance with `/docs` (Swagger UI) and `/redoc`.
2. Add CORS middleware (outermost) with origins from `Settings.CORS_ORIGINS`.
3. Add correlation ID middleware.
4. Add structured logging middleware.
5. Add authentication middleware.
6. Register exception handlers: `AppError` -> RFC 7807; Pydantic `RequestValidationError` -> 422 RFC 7807 with field errors; unhandled `Exception` -> 500 RFC 7807 (detail hidden, logged at ERROR). Define `PII_FIELDS = {"ssn"}` constant. Override FastAPI's `RequestValidationError` handler to replace the `value` field with `"[REDACTED]"` for any validation error where the field name matches a PII field.
7. Register route modules: health, applications, documents, audit.
8. Add lifespan handler for startup/shutdown:
   - Startup: validate `SSN_ENCRYPTION_KEY`, create MinIO bucket, check for default API keys (log ERROR warning per US-060), initialize database engine.
   - Shutdown: dispose database engine.
9. Configure request size limits: 1 MB for JSON request bodies, 10 MB per file upload, 50 MB total multipart request size.

Note: LangGraph setup and submit route are added in P1-WU21. The application factory uses a lifespan context manager so that WU21 can add to the startup sequence.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && curl -sf http://localhost:8000/health | python -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; print('PASS')" && curl -sf http://localhost:8000/docs -o /dev/null && echo "PASS" || echo "FAIL"
```

**User stories:** US-060 (Startup Warning), US-067 (Health Checks), US-068 (Developer Setup)

---

### P1-WU20a: LangGraph State Types and Graph Definition

**Agent:** Backend Developer
**Dependencies:** P1-WU08 (enums)

**Files created:**
- `packages/api/src/agents/__init__.py`
- `packages/api/src/agents/state.py`
- `packages/api/src/agents/graphs/__init__.py`
- `packages/api/src/agents/graphs/loan_processing.py`

**Description:**

Implement all TypedDicts from Section 2.6 and define the graph structure with all nodes and edges per architecture Section 5.1.

`state.py`: All TypedDicts exactly as specified in Section 2.6.

`loan_processing.py`: Graph definition with all nodes and edges per architecture Section 5.1. Supervisor nodes (supervisor_init, aggregation, routing_decision, human_review_wait) are defined inline in this file as placeholders that will be replaced by imports from WU20b. Graph is compiled but not connected to checkpointer (WU21). Include inline comments explaining the supervisor-worker pattern, parallel fan-out, and checkpoint persistence per US-081.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -c "
from packages.api.src.agents.state import LoanProcessingState, IntakeState
from packages.api.src.agents.graphs.loan_processing import build_loan_processing_graph
assert 'application_id' in LoanProcessingState.__annotations__
print('PASS')
" 2>&1 | grep -q "PASS" && echo "PASS" || echo "FAIL"
```

**User stories:** US-006 (Checkpoint Persistence), US-081 (Inline Documentation)

---

### P1-WU20b: LangGraph Stub Node Implementations

**Agent:** Backend Developer
**Dependencies:** P1-WU20a

**Files created:**
- `packages/api/src/agents/nodes/__init__.py`
- `packages/api/src/agents/nodes/supervisor.py`
- `packages/api/src/agents/nodes/document_processing.py`
- `packages/api/src/agents/nodes/credit_analysis.py`
- `packages/api/src/agents/nodes/risk_assessment.py`
- `packages/api/src/agents/nodes/compliance.py`
- `packages/api/src/agents/nodes/fraud_detection.py`
- `packages/api/src/agents/nodes/denial_coaching.py`
- `packages/api/tests/unit/test_graph_nodes.py`

**Description:**

Implement stub versions of all agent nodes in their FINAL file locations (matching architecture Section 9). Each file contains the stub implementation for Phase 1; Phase 2+ replaces the stub logic with real LLM calls without changing file names or function signatures.

`supervisor.py`: Real implementation of:
- `supervisor_init_node`: Sets `workflow_status` to `DOCUMENT_PROCESSING`, populates initial state.
- `aggregation_node`: Collects all non-None agent results, checks for disagreements, sets `has_disagreements` and `has_fraud_flags`.
- `routing_decision_node`: Implements the confidence-based routing logic per architecture Section 5.4. In Phase 1, reads thresholds from state.
- `route_after_documents`: Conditional edge function.
- `route_after_decision`: Conditional edge function.
- `route_after_review`: Conditional edge function (returns "approved" as default in Phase 1).
- `human_review_wait_node`: Sets `workflow_status` to `ESCALATED`. (Actual pause/resume is Phase 2.)

Stub node files (`document_processing.py`, `credit_analysis.py`, `risk_assessment.py`, `compliance.py`, `fraud_detection.py`, `denial_coaching.py`):
- `document_processing.py`: Returns synthetic documents with confidence 0.95.
- `credit_analysis.py`: Returns credit score 720, confidence 0.85, recommendation APPROVE.
- `risk_assessment.py`: Returns risk score 0.3, confidence 0.80, recommendation APPROVE.
- `compliance.py`: Returns confidence 0.90, no violations.
- `fraud_detection.py`: Returns confidence 0.95, no flags, severity LOW.
- `denial_coaching.py`: Returns generic coaching suggestions.

All stubs include `[STUB]` prefix in reasoning and set `model_used="stub"`. Include inline comments per US-081.

Update `loan_processing.py` to import nodes from their final file locations and wire them into the graph.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/unit/test_graph_nodes.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-001 (Supervisor Initialization), US-002 (Document Processing Routing), US-006 (Checkpoint Persistence), US-081 (Inline Documentation)

---

### P1-WU21: LangGraph Checkpointer and Submit Endpoint

**Agent:** Backend Developer
**Dependencies:** P1-WU19 (main.py), P1-WU20b (graph with stub nodes), P1-WU06 (ApplicationRepo), P1-WU07 (AuditRepo, AgentDecisionRepo)

**Files created:**
- `packages/api/src/agents/checkpointer.py`
- `packages/api/src/routes/submit.py`

**Description:**

Connect the LangGraph graph to PostgresSaver and expose the submit endpoint.

`checkpointer.py`:
- Creates a separate `asyncpg` connection pool (min 2, max 5) per architecture Section 5.5.
- Initializes `AsyncPostgresSaver` with the pool.
- Exports `setup_checkpointer()` (called at startup) and `get_checkpointer()`.
- Compiles the loan processing graph with the checkpointer.

`submit.py`:
- `POST /v1/applications/{id}/submit`:
  - Auth required: any role.
  - Validates application exists and is in `DRAFT` status (returns 409 Conflict otherwise).
  - Updates application status to `PROCESSING`.
  - Creates a LangGraph thread with ID `loan:{application_id}`.
  - Invokes the compiled graph with initial state.
  - The graph runs through all stub nodes synchronously within the request.
  - After graph completion, updates application status based on `routing_decision` in final state (AUTO_APPROVED, ESCALATED, or DENIED).
  - Creates audit events at each step: `workflow_initialized`, `agent_dispatched`/`agent_completed` for each agent node, `aggregation_completed`, `routing_decision`, and the final event (`auto_approved`, `escalated`, or `denied`).
  - Creates `agent_decisions` rows for each agent node result.
  - Stores `workflow_thread_id` on the application.
  - Returns 200 with `DataEnvelope[ApplicationResponse]` showing the final status.

Modify `packages/api/src/main.py` (created in WU19) to add `setup_checkpointer()` to the lifespan handler and register the submit route blueprint. This is the only WU that modifies a file created by a different WU.

**Exit condition:**
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

**User stories:** US-001 (Supervisor Initialization), US-002 (Document Routing), US-006 (Checkpoint Persistence)

---

### P1-WU22: Audit Immutability Verification Test

**Agent:** Test Engineer
**Dependencies:** P1-WU04 (schema with grants), P1-WU07 (AuditRepo)

**Files created:**
- `packages/db/tests/test_audit_immutability.py`

**Description:**

Integration test that verifies the audit trail immutability at the database level:

1. Insert an audit event using `app_role` credentials.
2. Attempt to UPDATE the audit event using `app_role` -- assert permission error.
3. Attempt to DELETE the audit event using `app_role` -- assert permission error.
4. Verify the event is unchanged after the failed mutation attempts.

This test connects to the database as `app_role` (not the superuser/migration role) to verify that the grants from WU04 are correctly applied.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/db/tests/test_audit_immutability.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** US-021 (Immutable Audit Trail Storage)

---

### P1-WU23: Phase 1 Integration Test

**Agent:** Test Engineer
**Dependencies:** P1-WU21 (all routes and graph connected)

**Files created:**
- `packages/api/tests/conftest.py`
- `packages/api/tests/integration/test_application_lifecycle.py`

**Description:**

End-to-end integration test that exercises the complete Phase 1 flow:

1. **Health check**: `GET /health` returns 200.
2. **Readiness**: `GET /ready` returns 200 with healthy dependencies.
3. **Auth rejected**: `GET /v1/applications` without auth returns 401.
4. **Create application**: `POST /v1/applications` with valid data returns 201, status DRAFT.
5. **Create duplicate check**: SSN is not in response body.
6. **Upload document**: `POST /v1/applications/{id}/documents` with PDF returns 201.
7. **Upload non-PDF rejected**: Non-PDF upload returns 400.
8. **View application**: `GET /v1/applications/{id}` includes documents list.
9. **Submit application**: `POST /v1/applications/{id}/submit` triggers workflow.
10. **Final status**: Application status is AUTO_APPROVED (stubs produce high confidence).
11. **Audit trail**: `GET /v1/applications/{id}/audit` contains events: `application_created`, `documents_uploaded`, `workflow_initialized`, and all agent dispatch/complete events.
12. **RBAC enforcement**: Attempt reviewer-only action with loan_officer key returns 403.
13. **List applications**: `GET /v1/applications` returns paginated list.
14. **Resubmit rejected**: `POST /v1/applications/{id}/submit` on already-processed app returns 409.
15. **PII redaction in errors**: Submit an application with invalid SSN format and verify the 422 error response does not contain the SSN value in any field.

`conftest.py`: Test fixtures for creating test client, test database setup/teardown, and auth headers for each role.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && python -m pytest packages/api/tests/integration/test_application_lifecycle.py -v --tb=short && echo "PASS" || echo "FAIL"
```

**User stories:** All Phase 1 user stories (integration verification)

---

### P1-WU24: Developer Documentation

**Agent:** Technical Writer
**Dependencies:** P1-WU01 (scaffolding), P1-WU21 (full stack working)

**Files created:**
- `README.md` (update existing)

**Description:**

Update the project README per US-069. Include:

1. **Project description**: What the AI Mortgage Quickstart is and who it serves.
2. **Architecture overview**: High-level diagram (text-based) showing FastAPI, LangGraph, PostgreSQL, Redis, MinIO.
3. **Key technology decisions**: From architecture Section 1.2.
4. **Quickstart**: `git clone`, `cp .env.example .env`, configure API keys, `make setup && make dev`. Expected output at each step. Include key generation instructions (`openssl rand -base64 32` for SSN_ENCRYPTION_KEY) as part of the quickstart setup steps.
5. **API endpoints**: Table of all Phase 1 endpoints with methods and auth requirements.
6. **Demo walkthrough**: Step-by-step curl commands to create an application, upload a document, submit for processing, and view the audit trail.
7. **Troubleshooting**: Common issues (Docker not running, port conflicts, missing env vars).
8. **Code walkthrough**: Brief guide to the codebase structure with file references for supervisor agent, parallel fan-out, and checkpoint patterns per US-081.

**Exit condition:**
```bash
cd /home/jary/redhat/git/agent-scaffold-test-0212 && test -f README.md && grep -q "make setup" README.md && grep -q "Architecture" README.md && grep -q "Quickstart" README.md && echo "PASS" || echo "FAIL"
```

**User stories:** US-068 (Developer Setup), US-069 (README), US-081 (Inline Documentation)

---

## 4. Dependency Graph

```
P1-WU01 (Scaffolding)
  |
  +---> P1-WU02 (Engine) ---> P1-WU03 (Models) ---> P1-WU04 (Migration)
  |                                                       |
  |                                          +------------+------------+
  |                                          |            |            |
  |                                     P1-WU05      P1-WU06      P1-WU07
  |                                     (Seed)     (App/Doc Repo) (Audit/User/
  |                                                               AgentDecision/
  |                                                               Config Repo)
  |
  |      P1-WU08 (Enums+Schemas) ------+
  |            |                        |
  |       P1-WU09 (Settings+Errors)    P1-WU20a (State Types+Graph Def)
  |            |                        |
  |    +-------+-------+          P1-WU20b (Stub Node Impls)
  |    |       |       |               |
  |  P1-WU10  P1-WU14 P1-WU15         |
  |  (CorrelID (SSN    (MinIO          |
  |  +Logging) Encrypt) Client)        |
  |    |                               |
  |  P1-WU11 (Auth Middleware)         |
  |    |                               |
  |  P1-WU12 (RBAC Dependency)        |
  |    |                               |
  |    +----> P1-WU16 (App CRUD Routes) <--- P1-WU06, P1-WU07, P1-WU14
  |    +----> P1-WU17 (Doc Upload Route) <--- P1-WU06, P1-WU07, P1-WU15
  |    +----> P1-WU18 (Audit Route) <--- P1-WU07
  |    |
  |    +----> P1-WU13 (Health Routes)
  |           |
  |           +----> P1-WU19 (App Factory + Startup) <--- WU10,11,13,16,17,18
  |                     |
  |                     +----> P1-WU21 (Checkpointer+Submit) <--- WU19,20b,06,07
  |                               |
  |                               +----> P1-WU23 (Integration Test)
  |
  +----> P1-WU24 (README) <--- P1-WU21
  |
  P1-WU04 -----> P1-WU22 (Audit Immutability Test) <--- P1-WU07
```

### Parallelization Opportunities

The following groups can execute in parallel once their dependencies are met:

**Parallel Track A -- Database (WU02-WU07):**
WU02 -> WU03 -> WU04 -> {WU05, WU06, WU07} (WU05/06/07 are parallel)

**Parallel Track B -- API Types + Services (WU08-WU15):**
WU08 -> {WU09, WU20a} (parallel)
WU09 -> {WU10, WU14, WU15} (parallel)
WU20a -> WU20b

**Convergence (WU11+):**
WU10 + WU07 -> WU11 -> WU12 -> {WU16, WU17, WU18} (parallel with their respective repo deps)
{WU16, WU17, WU18, WU13} -> WU19 -> WU21 (WU21 also requires WU20b)

**Independent test track:**
WU04 + WU07 -> WU22 (can run any time after WU04 and WU07)

---

## 5. Context Package

### 5.1 All Phase 1 WUs -- Shared Context

**Files to read before starting any Phase 1 WU:**
- `plans/technical-design-phase-1.md` Section 2 (Interface Contracts)
- `plans/architecture.md` Sections 1.2 (key decisions), 2.1 (middleware), 9 (file structure)

**Binding contracts:**
- Enums: Section 2.1 of this document
- Pydantic schemas: Section 2.2 of this document
- Error classes: Section 2.8 of this document

**Key decisions:**
- All monetary values: integer cents
- All timestamps: UTC
- camelCase in JSON responses (via Pydantic aliases), snake_case in Python
- RFC 7807 for all error responses
- SSN never returned in API responses, never logged

**Scope boundaries:**
- Phase 1 does NOT include: real LLM calls, PII redaction, rate limiting, Redis caching of auth, UI implementation, review queue endpoints, configuration management endpoints

### 5.2 Database Work Area (WU02-WU07)

**Additional files to read:**
- `plans/architecture.md` Section 3 (Data Architecture) -- full schema SQL
- `plans/architecture.md` Section 3.2 (Database Roles) -- grants
- `plans/architecture.md` Section 3.3 (Migration Strategy) -- Alembic conventions

**Binding contracts:**
- ORM models: Section 2.3 of this document
- Repository signatures: Section 2.4 of this document
- Seed data: Section 2.9 of this document

**Key decisions:**
- VARCHAR for status/role fields, not PostgreSQL ENUM (migration flexibility)
- `app_role` cannot UPDATE/DELETE `audit_events`
- pgvector extension + vector(1536) column on embeddings table
- Cursor-based pagination using `(sort_field, id)` composite cursor

### 5.3 Middleware and Auth Work Area (WU10-WU12)

**Additional files to read:**
- `plans/architecture.md` Section 2.1 (Middleware Stack) -- execution order
- `plans/architecture.md` Section 6.1 (Authentication) -- flow
- `plans/architecture.md` Section 6.2 (Role Hierarchy) -- permissions table
- `plans/architecture.md` Section 8.1 (Structured Logging) -- security events
- `plans/architecture.md` Section 8.2 (Correlation ID) -- implementation pattern

**Binding contracts:**
- Middleware contracts: Section 2.5 of this document
- `AuthenticatedUser` schema: Section 2.2
- `Role` IntEnum: Section 2.1
- Error classes: Section 2.8

**Key decisions:**
- Middleware order: CORS -> Correlation ID -> Logging -> Auth -> Authorization
- Auth skips: `/health`, `/ready`, `/v1/public/*`
- Redis auth cache deferred to Phase 2 (hit DB every time in Phase 1)
- Role hierarchy via IntEnum comparison
- Correlation ID via Python `contextvars`

### 5.4 Routes Work Area (WU13, WU16-WU18)

**Additional files to read:**
- `plans/architecture.md` Section 4.2 (Request/Response Shapes) -- API contracts
- `plans/architecture.md` Section 4.3 (Error Response Format) -- RFC 7807
- `plans/architecture.md` Section 4.4 (Pagination) -- cursor format
- `plans/architecture.md` Section 7.4 (Health Check Strategy) -- response shapes

**Binding contracts:**
- Request/response schemas: Section 2.2 of this document
- Repository signatures: Section 2.4 of this document
- Error classes: Section 2.8

**Key decisions:**
- `POST /v1/applications` returns 201 with Location header
- SSN accepted on create only, never returned
- Audit events created inline (same transaction) for create/upload
- Pagination: base64-encoded JSON cursor with `{updated_at, id}`

### 5.5 LangGraph Work Area (WU20a, WU20b, WU21)

**Additional files to read:**
- `plans/architecture.md` Section 5.1 (Loan Processing Graph) -- full graph definition
- `plans/architecture.md` Section 5.3 (Agent Communication) -- state-based pattern
- `plans/architecture.md` Section 5.4 (Routing Logic) -- confidence thresholds
- `plans/architecture.md` Section 5.5 (Checkpoint Strategy) -- separate pool
- `plans/architecture.md` Section 10.3 (Forward Compatibility) -- all nodes from day one

**Binding contracts:**
- LangGraph state types: Section 2.6 of this document
- Graph node names: `supervisor_init`, `document_processing`, `credit_analysis`, `risk_assessment`, `compliance_check`, `fraud_detection`, `aggregation`, `routing_decision`, `denial_coaching`, `human_review_wait`
- Edge routing functions: `route_after_documents`, `route_after_decision`, `route_after_review`
- Thread ID convention: `loan:{application_id}`

**Key decisions:**
- Full graph defined in Phase 1 with stubs for checkpoint compatibility
- Separate asyncpg pool for checkpointer (min 2, max 5)
- Stubs return synthetic data with `[STUB]` prefix in reasoning
- All stubs set `model_used="stub"` for traceability
- Graph runs synchronously within request in Phase 1 (no background workers)

---

## 6. Risks and Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| LangGraph version compatibility | If LangGraph API changes between Phase 1 and Phase 2, checkpoint schema may break | Pin exact LangGraph version in `pyproject.toml`. Test checkpoint resume across service restarts in WU23. |
| asyncpg pool sizing | Phase 1 defaults (app: 5-20, checkpoint: 2-5) may need tuning | Monitor connection usage in development. Pool sizes are in `Settings` and easily adjustable. |
| SSN encryption key management | Missing or invalid key prevents startup | Startup validation in WU19. `.env.example` includes generation instructions. |
| Docker Compose startup ordering | Services may start before dependencies are ready | Healthchecks with `condition: service_healthy` in compose.yml. Retry logic in readiness checks. |
| Alembic + asyncpg compatibility | Alembic async migrations have known edge cases | Use `run_async` in Alembic env.py. Test upgrade/downgrade cycle in WU04. |
| Phase 1 is the largest phase (25 WUs) | Long dependency chain may bottleneck | Two parallel tracks (database + API types) converge late. WU08 has no deps and can start immediately. |

### Open Questions (Phase 1 Specific)

| ID | Question | Impact | Default if Unresolved |
|----|----------|--------|----------------------|
| P1-OQ-1 | Should the Phase 1 integration test use a dedicated test database or the development database? | Test isolation | Use a dedicated test database (`mortgage_test`) created in conftest.py |
| P1-OQ-2 | Should `GET /v1/applications` be included in Phase 1 or deferred to Phase 2 (US-055 is Phase 2)? | List endpoint availability | Include in Phase 1 -- it is a basic CRUD operation needed for development and testing, even though the dashboard is Phase 2. |
| P1-OQ-3 | Should the submit endpoint run the graph synchronously (blocking the request) or asynchronously? | Request latency for submit | Synchronous in Phase 1 (stubs are instant). Async execution is a Phase 2+ optimization. |
| P1-OQ-4 | US-071 (performance targets) and US-072 (graceful degradation) are P0 cross-cutting stories. How should they apply in Phase 1? | Phase 1 completeness | US-071: Not applicable -- Phase 1 stubs have no meaningful performance characteristics. US-072: WU13 readiness endpoint already checks dependencies and returns 503 when unavailable. WU17 should return 503 when MinIO is unreachable. Full graceful degradation (cached fallbacks, circuit breakers) is Phase 2+. |

### Downstream Inconsistencies Detected

1. **US-055 (List Applications) is Phase 2 but needed in Phase 1.** The architecture build order (Section 11, step 5) includes "list applications" in Phase 1. The requirements doc assigns US-055 to Phase 2. Resolution: Include list in Phase 1 WU16 as a basic CRUD operation. The Phase 2 story adds filtering, sorting, and dashboard integration.

2. **Product plan auth format vs. architecture auth format.** The product plan references `Bearer <role>:<key>` format. The architecture corrected this to `Bearer <api_key>` with server-side role resolution (Section 1.2, Section 6.1). This TD follows the architecture.

3. **TD introduces files not in architecture file tree.** Three files created by this TD are not listed in architecture Section 9: `packages/api/src/errors.py` (error class hierarchy -- WU09), `packages/api/src/routes/submit.py` (submit endpoint separation -- WU21), and individual stub node files in `packages/api/src/agents/nodes/` (using architecture's final file names with stub implementations -- WU20b). The architecture file tree should be updated after Phase 1 implementation to reflect `errors.py` and `submit.py` additions.

4. **Recommendation enum values refined from architecture.** Architecture uses `APPROVE, DENY, REVIEW` for agent recommendation values. This TD uses `APPROVE, DENY, ESCALATE, FLAG` -- `ESCALATE` is more precise than `REVIEW` (aligns with routing decision terminology) and `FLAG` supports fraud detection's distinct semantics (flagging without recommending denial).

---

## Checklist

- [x] All cross-task interface contracts defined with concrete types (Sections 2.1-2.9)
- [x] Data flow covers happy path and primary error paths (WU descriptions + architecture Section 3.4)
- [x] Error handling strategy specified: RFC 7807, AppError hierarchy (Section 2.8)
- [x] File/module structure maps to existing project layout (architecture Section 9)
- [x] Every WU has a machine-verifiable exit condition
- [x] Key technical decisions documented with rationale
- [x] Cross-task dependency map complete (Section 4)
- [x] Context Package defined per work area (Section 5)
- [x] No TBDs in binding contracts
- [x] Phase 1 user stories mapped to WUs (Section 1.4 + per-WU)
