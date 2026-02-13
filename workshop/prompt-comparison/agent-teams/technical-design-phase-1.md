<!-- This project was developed with assistance from AI tools. -->

# Phase 1 Technical Design: Foundation + Application Lifecycle

## Overview

Phase 1 delivers the foundational infrastructure and application lifecycle for the Multi-Agent Mortgage Loan Processing System. It covers 37 P0 stories across 9 feature areas: AUTH (8), AUDIT (4), PII (3 + PII-04 mechanism), CHECKPOINT (3), DX (4), OBS (3), DEPLOY-03 (1), APP (7), and DOC (4). This document defines the concrete interface contracts, data flows, database schema, file structure, error handling, and machine-verifiable exit conditions that all Phase 1 implementation tasks must conform to.

## System Context

Per the architecture document:

- **ADR-001:** Persistent checkpointing via PostgresSaver is foundational from Phase 1. Every graph invocation is checkpointed after every node execution.
- **ADR-002:** API key authentication uses `Bearer <role>:<key>` format. The role prefix is a routing hint only; the server resolves the authoritative role from the key alone via HMAC-SHA256 hash lookup.
- **ADR-003:** Audit trail infrastructure (INSERT-only role, trigger guard, hash chaining) is delivered in Phase 1. All state transitions and auth events are captured from day one.
- **ADR-004:** Three-schema isolation in PostgreSQL (`public`, `rag`, `langgraph`) with separate connection pools for transactional and RAG workloads.

The system uses FastAPI (async, Python) for the backend, React 19 for the frontend, PostgreSQL 16 with pgvector, Redis, and MinIO. Phase 1 builds the API skeleton, auth layer, audit infrastructure, PII encryption, checkpoint plumbing, application CRUD with status state machine, document upload/download, seed data, structured logging, correlation IDs, health endpoints, and developer experience tooling.

---

## Feature Design

### Components Affected

| Component | New/Modified | Change Description |
|-----------|-------------|-------------------|
| `packages/api/src/auth/` | New | Key resolver, role asserter, auth context, production credential check |
| `packages/api/src/middleware/` | New | Correlation ID, structured logging |
| `packages/api/src/routes/` | New | applications, documents, audit_events, auth_keys, health |
| `packages/api/src/services/` | New | Audit service, encryption service, PII masking |
| `packages/api/src/errors.py` | New | RFC 7807 error hierarchy |
| `packages/api/src/config.py` | New | Pydantic BaseSettings |
| `packages/api/src/main.py` | New | FastAPI app assembly |
| `packages/db/src/models/` | New | SQLAlchemy 2.0 async models for all Phase 1 tables |
| `packages/db/src/migrations/` | New | Alembic migrations for schema, triggers, seed data |
| `packages/db/src/seed.py` | New | Seed data generation script |
| `compose.yml` | New | PostgreSQL, Redis, MinIO containers |
| `Makefile` | New | `setup`, `dev`, `test`, `lint` targets |

### Data Flow

#### Application Creation (APP-01)

```
1. Client -> POST /v1/applications (JSON body with borrower data)
2. Auth middleware: extract key, HMAC-SHA256 hash, lookup in api_keys
   - Invalid/expired/revoked -> 401 + audit event (auth_event)
   - Insufficient role -> 403
3. Request validation (Pydantic model): validate all required fields, monetary values > 0
   - Validation failure -> 422 RFC 7807 with errors[]
4. Encryption service: encrypt SSN, account numbers, government ID with Fernet
   - Extract ssn_last4 before encryption
5. INSERT into loan_applications (status = 'draft', created_by = auth_context.key_id)
6. Audit service: INSERT audit_event (state_transition, null -> draft)
   - Acquire advisory lock on application_id
   - Compute prev_event_hash (null sentinel for first event)
   - SET ROLE audit_writer, INSERT, restore role
7. Return 201 with Location header, response body with masked PII
```

#### Document Upload (DOC-01, DOC-02)

```
1. Client -> POST /v1/applications/:id/documents (multipart/form-data)
2. Auth middleware: authenticate, verify loan_officer+ role
3. Load application: verify exists, verify created_by matches (loan_officer) or skip (senior_underwriter+)
   - Not found or not authorized -> 404
4. Verify application status is 'draft'
   - Not draft -> 409 Conflict
5. File validation:
   a. Read magic bytes to determine actual MIME type (python-magic)
   b. Validate against allowlist (pdf, jpeg, png, tiff) -> 422 if invalid
   c. Check file size <= 20MB -> 422 if exceeded
   d. Validate file structure (PDF structure / image headers) -> 422 if corrupt
   e. Sanitize filename: strip path components, replace non-alnum (keep . and -), truncate 255 chars
6. Generate UUID storage key
7. Upload to MinIO with SSE encryption, using UUID key
8. INSERT into documents (application_id, storage_key, original_filename, mime_type, file_size_bytes, processing_status='pending')
9. Audit service: INSERT audit_event (document_upload)
10. Return 201 with Location header, document metadata
```

#### Application Submission (APP-04)

```
1. Client -> PATCH /v1/applications/:id { "status": "submitted" }
2. Auth middleware: authenticate
3. Load application: verify ownership (loan_officer sees own only)
4. Verify current status is 'draft'
   - Invalid transition -> 409 Conflict
5. Verify at least one document exists for this application
   - No documents -> 422 with detail
6. Within DB transaction:
   a. UPDATE status = 'submitted', updated_at = now()
   b. Audit event: state_transition (draft -> submitted)
   c. UPDATE status = 'processing', updated_at = now()
   d. Audit event: state_transition (submitted -> processing)
7. Enqueue background workflow invocation (stub in Phase 1, real pipeline in Phase 2)
   - Pass correlation_id into graph config
8. Return 200 with updated application
```

#### Audit Event Querying (AUDIT-04)

```
1. Client -> GET /v1/applications/:id/audit-events?eventType=state_transition&cursor=MTIzNDY&limit=50
2. Auth middleware: authenticate
3. Verify application exists and caller is authorized
   - loan_officer: only their own applications
   - senior_underwriter+: all applications
4. Query audit_events WHERE application_id = :id
   - Apply eventType filter if provided
   - Apply dateFrom/dateTo filter if provided
   - Cursor pagination: WHERE id > decoded_cursor ORDER BY id ASC LIMIT limit+1
   - If result count > limit, hasMore = true, nextCursor = base64(last_item.id)
5. Return 200 with paginated audit events
```

#### List Documents for an Application (DOC-04)

```
1. Client -> GET /v1/applications/:id/documents
2. Auth middleware: authenticate
3. Verify application exists and caller is authorized
   - loan_officer: only their own applications
   - senior_underwriter+: all applications
4. Query documents WHERE application_id = :id ORDER BY created_at DESC
5. Return 200 with list of DocumentSummaryResponse in DataEnvelope
```

#### Document Detail (DOC-03)

```
1. Client -> GET /v1/documents/:id
2. Auth middleware: authenticate
3. Load document record, then load parent application
   - Verify caller authorized to view parent application
   - Not found or not authorized -> 404
4. Return 200 with DocumentDetailResponse in DataEnvelope
```

#### Document Download (DOC-03 sub-resource)

```
1. Client -> GET /v1/documents/:id/download
2. Auth middleware: authenticate
3. Load document record, then load parent application
   - Verify caller authorized to view parent application
   - Not found or not authorized -> 404
4. Retrieve file from MinIO using stored UUID storage_key
5. Return 200 with Content-Type = document.mime_type,
   Content-Disposition = attachment; filename="<sanitized_original_filename>"
```

---

## Interface Contracts

### Shared Python Types (Pydantic Models)

All shared types live in `packages/api/src/models/`. These are binding contracts; implementers must conform exactly.

#### Auth Context

```python
# packages/api/src/auth/context.py
from dataclasses import dataclass

@dataclass(frozen=True)
class AuthContext:
    key_id: str          # UUID of the API key (as string)
    role: str            # Resolved role from database: loan_officer | senior_underwriter | reviewer
    correlation_id: str  # Request correlation ID
```

#### Role Hierarchy

```python
# packages/api/src/auth/roles.py
from enum import IntEnum

class Role(IntEnum):
    loan_officer = 1
    senior_underwriter = 2
    reviewer = 3

ROLE_HIERARCHY: dict[str, int] = {
    "loan_officer": Role.loan_officer,
    "senior_underwriter": Role.senior_underwriter,
    "reviewer": Role.reviewer,
}

def meets_minimum_role(actual_role: str, minimum_role: str) -> bool:
    return ROLE_HIERARCHY.get(actual_role, 0) >= ROLE_HIERARCHY.get(minimum_role, 99)
```

#### Application Status State Machine

```python
# packages/api/src/models/status.py
from enum import StrEnum

class ApplicationStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    AWAITING_REVIEW = "awaiting_review"
    APPROVED = "approved"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    PROCESSING_ERROR = "processing_error"

# Valid transitions: from_status -> set of allowed to_statuses
VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"submitted", "withdrawn"},
    "submitted": {"processing", "withdrawn"},
    "processing": {"approved", "awaiting_review", "processing_error"},
    "awaiting_review": {"approved", "denied", "withdrawn"},
    "processing_error": {"processing"},
}

TERMINAL_STATES: set[str] = {"approved", "denied", "withdrawn"}

def is_valid_transition(from_status: str, to_status: str) -> bool:
    if from_status in TERMINAL_STATES:
        return False
    return to_status in VALID_TRANSITIONS.get(from_status, set())
```

#### Property Address Schema

```python
# packages/api/src/models/schemas.py
from pydantic import BaseModel, Field

class PropertyAddress(BaseModel):
    street: str = Field(..., min_length=1, max_length=500)
    city: str = Field(..., min_length=1, max_length=200)
    state: str = Field(..., min_length=2, max_length=2)  # US state abbreviation
    zip: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
```

### API Request/Response Shapes

#### POST /v1/applications -- Create Application (APP-01)

**Request:**
```json
{
  "borrowerName": "string (required, 1-500 chars)",
  "ssn": "string (required, pattern: NNN-NN-NNNN)",
  "annualIncome": "string decimal (required, > 0, e.g. '85000.00')",
  "monthlyDebts": "string decimal (required, >= 0, e.g. '1200.00')",
  "loanAmount": "string decimal (required, > 0, e.g. '250000.00')",
  "propertyValue": "string decimal (required, > 0, e.g. '300000.00')",
  "loanTermMonths": "integer (required, > 0, e.g. 360)",
  "interestRate": "string decimal (required, > 0, e.g. '6.875')",
  "propertyAddress": {
    "street": "string (required)",
    "city": "string (required)",
    "state": "string (required, 2-char US state code)",
    "zip": "string (required, NNNNN or NNNNN-NNNN)"
  },
  "accountNumbers": "string[] (optional, encrypted at rest)",
  "governmentId": "string (optional, encrypted at rest)"
}
```

**Pydantic model:**
```python
# packages/api/src/models/requests.py
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

class CreateApplicationRequest(BaseModel):
    borrower_name: str = Field(..., alias="borrowerName", min_length=1, max_length=500)
    ssn: str = Field(..., pattern=r"^\d{3}-\d{2}-\d{4}$")
    annual_income: str = Field(..., alias="annualIncome")
    monthly_debts: str = Field(..., alias="monthlyDebts")
    loan_amount: str = Field(..., alias="loanAmount")
    property_value: str = Field(..., alias="propertyValue")
    loan_term_months: int = Field(..., alias="loanTermMonths", gt=0)
    interest_rate: str = Field(..., alias="interestRate")
    property_address: PropertyAddress = Field(..., alias="propertyAddress")
    account_numbers: list[str] | None = Field(None, alias="accountNumbers")
    government_id: str | None = Field(None, alias="governmentId")

    model_config = {"populate_by_name": True}

    @field_validator("annual_income", "loan_amount", "property_value", "interest_rate")
    @classmethod
    def validate_positive_decimal(cls, v: str) -> str:
        d = Decimal(v)
        if d <= 0:
            raise ValueError("Must be greater than zero")
        return v

    @field_validator("monthly_debts")
    @classmethod
    def validate_non_negative_decimal(cls, v: str) -> str:
        d = Decimal(v)
        if d < 0:
            raise ValueError("Must be zero or greater")
        return v
```

**Response (201):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "draft",
    "borrowerName": "Maria Garcia",
    "ssn": "***-**-3456",
    "annualIncome": "85000.00",
    "monthlyDebts": "1200.00",
    "loanAmount": "250000.00",
    "propertyValue": "300000.00",
    "loanTermMonths": 360,
    "interestRate": "6.875",
    "propertyAddress": {
      "street": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "zip": "62701"
    },
    "accountNumbers": "[REDACTED]",
    "governmentId": "[REDACTED]",
    "analysisPass": 1,
    "createdBy": "key-uuid-here",
    "createdAt": "2026-02-12T14:30:00.000Z",
    "updatedAt": "2026-02-12T14:30:00.000Z"
  }
}
```

**Response Pydantic model:**
```python
# packages/api/src/models/responses.py
from datetime import datetime
from pydantic import BaseModel, Field

class ApplicationResponse(BaseModel):
    id: str
    status: str
    borrower_name: str = Field(..., alias="borrowerName")
    ssn: str  # Always masked: "***-**-1234"
    annual_income: str = Field(..., alias="annualIncome")
    monthly_debts: str = Field(..., alias="monthlyDebts")
    loan_amount: str = Field(..., alias="loanAmount")
    property_value: str = Field(..., alias="propertyValue")
    loan_term_months: int = Field(..., alias="loanTermMonths")
    interest_rate: str = Field(..., alias="interestRate")
    property_address: PropertyAddress = Field(..., alias="propertyAddress")
    account_numbers: str | None = Field(None, alias="accountNumbers")  # "[REDACTED]" or None
    government_id: str | None = Field(None, alias="governmentId")  # "[REDACTED]" or None
    analysis_pass: int = Field(..., alias="analysisPass")
    created_by: str = Field(..., alias="createdBy")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    documents: list["DocumentSummaryResponse"] | None = None

    model_config = {"populate_by_name": True, "by_alias": True}

class DocumentSummaryResponse(BaseModel):
    id: str
    original_filename: str = Field(..., alias="originalFilename")
    mime_type: str = Field(..., alias="mimeType")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    document_type: str | None = Field(None, alias="documentType")
    processing_status: str = Field(..., alias="processingStatus")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = {"populate_by_name": True, "by_alias": True}

class DataEnvelope[T](BaseModel):
    data: T

class PaginatedEnvelope[T](BaseModel):
    data: list[T]
    pagination: "PaginationInfo"

class PaginationInfo(BaseModel):
    next_cursor: str | None = Field(None, alias="nextCursor")
    has_more: bool = Field(..., alias="hasMore")

    model_config = {"populate_by_name": True, "by_alias": True}
```

#### GET /v1/applications -- List Applications (APP-02)

**Query params:** `?status=draft&cursor=<opaque>&limit=20`

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-...",
      "status": "draft",
      "borrowerName": "Maria Garcia",
      "ssn": "***-**-3456",
      "loanAmount": "250000.00",
      "createdAt": "2026-02-12T14:30:00.000Z",
      "updatedAt": "2026-02-12T14:30:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "NTUwZTg0MDAuLi4=",
    "hasMore": true
  }
}
```

**Pydantic model:**
```python
class ApplicationListItem(BaseModel):
    id: str
    status: str
    borrower_name: str = Field(..., alias="borrowerName")
    ssn: str  # Masked
    loan_amount: str = Field(..., alias="loanAmount")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True, "by_alias": True}
```

- Default limit: 20, max: 100
- Cursor: base64-encoded `created_at:id` pair for stable ordering
- Order: `created_at DESC`
- Visibility: `loan_officer` sees only `created_by = auth_context.key_id`; `senior_underwriter`+ sees all

#### GET /v1/applications/:id -- View Application Details (APP-03)

**Response (200):**
```json
{
  "data": {
    "id": "550e8400-...",
    "status": "processing",
    "borrowerName": "Maria Garcia",
    "ssn": "***-**-3456",
    "annualIncome": "85000.00",
    "monthlyDebts": "1200.00",
    "loanAmount": "250000.00",
    "propertyValue": "300000.00",
    "loanTermMonths": 360,
    "interestRate": "6.875",
    "propertyAddress": { "street": "123 Main St", "city": "Springfield", "state": "IL", "zip": "62701" },
    "accountNumbers": "[REDACTED]",
    "governmentId": "[REDACTED]",
    "analysisPass": 1,
    "createdBy": "key-uuid",
    "createdAt": "2026-02-12T14:30:00.000Z",
    "updatedAt": "2026-02-12T14:45:00.000Z",
    "documents": [
      {
        "id": "doc-uuid",
        "originalFilename": "pay_stub_jan_2026.pdf",
        "mimeType": "application/pdf",
        "fileSizeBytes": 1048576,
        "documentType": null,
        "processingStatus": "pending",
        "createdAt": "2026-02-12T14:35:00.000Z"
      }
    ],
    "analyses": null
  }
}
```

- `analyses` is `null` in Phase 1 (populated from Phase 2 onward)
- `documents` is always included with summary info
- Non-UUID `:id` returns 400; nonexistent UUID returns 404
- `loan_officer` who did not create -> 404 (not 403, prevents info leakage)

#### PATCH /v1/applications/:id -- Status Transitions (APP-04, APP-05, APP-06)

**Request:**
```json
{
  "status": "submitted"
}
```

**Pydantic model:**
```python
class UpdateApplicationRequest(BaseModel):
    status: str = Field(..., pattern="^(submitted|withdrawn)$")
```

**Status transition rules:**
- `submitted`: Only from `draft`. Requires at least one document. Triggers double transition: `draft -> submitted -> processing`.
- `withdrawn`: From `draft`, `submitted`, or `awaiting_review`. Not from `processing` (409), not from terminal states (409).
- Invalid transition -> 409 Conflict.

**Response (200):** Same shape as GET application detail.

#### POST /v1/applications/:id/retry -- Retry Failed (APP-07)

**Request:** No body required.

**Response (202):**
```json
{
  "data": {
    "id": "550e8400-...",
    "status": "processing",
    "message": "Workflow retry enqueued."
  }
}
```

- Only from `processing_error` status -> 409 otherwise
- Returns 202 Accepted (async workflow)
- If already `processing` (concurrent retry) -> 409

#### POST /v1/applications/:id/documents -- Upload Document (DOC-01, DOC-02)

**Request:** `multipart/form-data` with field name `document`.

**Response (201):**
```json
{
  "data": {
    "id": "660e8400-...",
    "originalFilename": "pay_stub_jan_2026.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 1048576,
    "documentType": null,
    "processingStatus": "pending",
    "createdAt": "2026-02-12T14:35:00.000Z"
  }
}
```

**Pydantic model:**
```python
class DocumentResponse(BaseModel):
    id: str
    original_filename: str = Field(..., alias="originalFilename")
    mime_type: str = Field(..., alias="mimeType")
    file_size_bytes: int = Field(..., alias="fileSizeBytes")
    document_type: str | None = Field(None, alias="documentType")
    processing_status: str = Field(..., alias="processingStatus")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = {"populate_by_name": True, "by_alias": True}

class DocumentDetailResponse(DocumentResponse):
    extracted_data: dict | None = Field(None, alias="extractedData")
    field_confidence: dict | None = Field(None, alias="fieldConfidence")
    processing_error: dict | None = Field(None, alias="processingError")
```

Headers: `Location: /v1/documents/{id}`

#### GET /v1/applications/:id/documents -- List Documents (DOC-04)

**Response (200):** Uses `list[DocumentSummaryResponse]` wrapped in `DataEnvelope`.

Returns all documents attached to the given application, ordered by `created_at DESC`.

#### GET /v1/documents/:id -- View Document Detail (DOC-03)

**Response (200):** Uses `DocumentDetailResponse` wrapped in `DataEnvelope`.

#### GET /v1/documents/:id/download -- Download Document (DOC-03 sub-resource)

**Response (200):** Binary file content.
- `Content-Type`: document's MIME type
- `Content-Disposition`: `attachment; filename="<sanitized_original_filename>"`

#### POST /v1/auth/keys -- Create API Key (AUTH-02)

**Request:**
```json
{
  "role": "loan_officer",
  "description": "Maria's development key",
  "expiresInDays": 90
}
```

**Pydantic model:**
```python
class CreateApiKeyRequest(BaseModel):
    role: str = Field(..., pattern="^(loan_officer|senior_underwriter|reviewer)$")
    description: str | None = Field(None, max_length=500)
    expires_in_days: int | None = Field(None, alias="expiresInDays", gt=0, le=365)
```

**Response (201):**
```json
{
  "data": {
    "id": "key-uuid",
    "key": "ak_a1b2c3d4e5f6g7h8i9j0...",
    "role": "loan_officer",
    "description": "Maria's development key",
    "expiresAt": "2026-05-13T14:30:00.000Z",
    "isActive": true,
    "createdAt": "2026-02-12T14:30:00.000Z"
  }
}
```

- `key` field is the plaintext key, returned ONLY in this response, never again.
- Default `expiresInDays`: 90.
- Requires `reviewer` role -> 403 otherwise.

#### GET /v1/auth/keys -- List API Keys (AUTH-04)

**Query params:** `?cursor=<opaque>&limit=20&role=loan_officer&isActive=true`

**Response (200):**
```json
{
  "data": [
    {
      "id": "key-uuid",
      "role": "loan_officer",
      "description": "Maria's development key",
      "expiresAt": "2026-05-13T14:30:00.000Z",
      "isActive": true,
      "createdAt": "2026-02-12T14:30:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "abc123",
    "hasMore": false
  }
}
```

- No `key` or `keyHash` in response.
- Requires `reviewer` role.
- Default limit: 20, max: 100.

#### DELETE /v1/auth/keys/:id -- Revoke API Key (AUTH-03)

**Response (204):** No body.

- Sets `is_active = false` (soft delete).
- Idempotent: revoking already-revoked key returns 204.
- Self-revocation (`:id` matches caller's key) returns 409.
- Nonexistent key returns 404.
- Requires `reviewer` role.

#### GET /v1/applications/:id/audit-events -- Query Audit Trail (AUDIT-04)

**Query params:** `?eventType=state_transition&dateFrom=2026-01-01T00:00:00Z&dateTo=2026-02-01T00:00:00Z&cursor=MTIzNDY&limit=50`

**Response (200):**
```json
{
  "data": [
    {
      "id": 12345,
      "eventType": "state_transition",
      "actorId": "key-uuid",
      "actorType": "user",
      "actorRole": "loan_officer",
      "agentName": null,
      "confidenceScore": null,
      "reasoning": null,
      "inputDataHash": null,
      "previousState": "draft",
      "newState": "submitted",
      "metadata": {"correlationId": "req-abc-123"},
      "prevEventHash": "0000000000000000000000000000000000000000000000000000000000000000",
      "createdAt": "2026-02-12T14:40:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "MTIzNDY=",
    "hasMore": true
  }
}
```

**Pydantic model:**
```python
class AuditEventResponse(BaseModel):
    id: int
    event_type: str = Field(..., alias="eventType")
    actor_id: str | None = Field(None, alias="actorId")
    actor_type: str | None = Field(None, alias="actorType")
    actor_role: str | None = Field(None, alias="actorRole")
    agent_name: str | None = Field(None, alias="agentName")
    confidence_score: str | None = Field(None, alias="confidenceScore")  # String decimal
    reasoning: str | None = None
    input_data_hash: str | None = Field(None, alias="inputDataHash")
    previous_state: str | None = Field(None, alias="previousState")
    new_state: str | None = Field(None, alias="newState")
    metadata: dict = Field(default_factory=dict)
    prev_event_hash: str = Field(..., alias="prevEventHash")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = {"populate_by_name": True, "by_alias": True}
```

- Default limit: 50, max: 200.
- Order: chronological (oldest first, by `id` ascending).
- Cursor: base64-encoded event `id`.
- Event type filter: `state_transition`, `agent_decision`, `human_review`, `auth_event`, `document_upload`, `routing_decision`.

#### GET /health -- Liveness (DEPLOY-03)

**Response (200):**
```json
{
  "status": "ok"
}
```

No authentication required. Returns 200 if the process is running.

#### GET /ready -- Readiness (DEPLOY-03)

**Response (200):**
```json
{
  "status": "ok",
  "dependencies": {
    "postgresql": "ok",
    "redis": "ok",
    "minio": "ok"
  }
}
```

**Response (503) -- dependency unhealthy:**
```json
{
  "status": "degraded",
  "dependencies": {
    "postgresql": "ok",
    "redis": "error",
    "minio": "ok"
  }
}
```

No authentication required. Lightweight checks: `SELECT 1` for PostgreSQL, `PING` for Redis, `list_buckets` or HEAD request for MinIO.

### RFC 7807 Error Response Format

```python
# packages/api/src/models/errors.py
from pydantic import BaseModel, Field

class ProblemDetail(BaseModel):
    type: str = Field(..., description="Error type URI")
    title: str = Field(..., description="Short human-readable summary")
    status: int = Field(..., description="HTTP status code")
    detail: str | None = Field(None, description="Detailed explanation")
    instance: str | None = Field(None, description="URI of the specific resource")
    errors: list["ValidationErrorItem"] | None = None

class ValidationErrorItem(BaseModel):
    field: str
    message: str
```

---

## Database Schema

### Complete CREATE TABLE Statements

All tables are in the `public` schema unless otherwise noted.

#### api_keys

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) NOT NULL,
    role VARCHAR NOT NULL,
    description VARCHAR(500),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_seed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_api_keys_role CHECK (role IN ('loan_officer', 'senior_underwriter', 'reviewer'))
);

CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;
```

#### loan_applications

```sql
CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR NOT NULL DEFAULT 'draft',
    borrower_name VARCHAR(500) NOT NULL,
    ssn_encrypted BYTEA,
    ssn_last4 VARCHAR(4),
    account_numbers_encrypted BYTEA,
    government_id_encrypted BYTEA,
    loan_amount_cents BIGINT NOT NULL,
    property_value_cents BIGINT NOT NULL,
    annual_income_cents BIGINT NOT NULL,
    monthly_debts_cents BIGINT NOT NULL,
    loan_term_months INTEGER NOT NULL,
    interest_rate NUMERIC(8,6) NOT NULL,
    property_address JSONB NOT NULL,
    analysis_pass INTEGER NOT NULL DEFAULT 1,
    escalated_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES api_keys(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_loan_applications_status CHECK (
        status IN ('draft', 'submitted', 'processing', 'awaiting_review',
                   'approved', 'denied', 'withdrawn', 'processing_error')
    ),
    CONSTRAINT chk_loan_amount_positive CHECK (loan_amount_cents > 0),
    CONSTRAINT chk_property_value_positive CHECK (property_value_cents > 0),
    CONSTRAINT chk_annual_income_positive CHECK (annual_income_cents > 0),
    CONSTRAINT chk_monthly_debts_non_negative CHECK (monthly_debts_cents >= 0),
    CONSTRAINT chk_loan_term_positive CHECK (loan_term_months > 0),
    CONSTRAINT chk_interest_rate_positive CHECK (interest_rate > 0)
);

CREATE INDEX idx_loan_applications_status_updated_at
    ON loan_applications(status, updated_at DESC);
CREATE INDEX idx_loan_applications_created_by
    ON loan_applications(created_by);
CREATE INDEX idx_loan_applications_created_at_desc
    ON loan_applications(created_at DESC);
```

**Note:** Using `BIGINT` for monetary cents columns to support loan amounts exceeding ~$21M (INT max is 2,147,483,647 cents = $21.4M). BIGINT supports up to ~$92 quadrillion.

#### documents

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    storage_key VARCHAR NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    document_type VARCHAR,
    processing_status VARCHAR NOT NULL DEFAULT 'pending',
    processing_error JSONB,
    extracted_data JSONB,
    field_confidence JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_documents_mime_type CHECK (
        mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/tiff')
    ),
    CONSTRAINT chk_documents_file_size CHECK (
        file_size_bytes > 0 AND file_size_bytes <= 20971520
    ),
    CONSTRAINT chk_documents_processing_status CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed')
    ),
    CONSTRAINT chk_documents_document_type CHECK (
        document_type IS NULL OR document_type IN (
            'w2', 'pay_stub', 'tax_return', 'bank_statement', 'appraisal', 'unknown'
        )
    )
);

CREATE UNIQUE INDEX idx_documents_storage_key ON documents(storage_key);
CREATE INDEX idx_documents_application_id ON documents(application_id);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
```

#### audit_events

```sql
CREATE TABLE audit_events (
    id BIGSERIAL PRIMARY KEY,
    application_id UUID REFERENCES loan_applications(id),
    event_type VARCHAR NOT NULL,
    actor_id VARCHAR,
    actor_type VARCHAR,
    actor_role VARCHAR,
    agent_name VARCHAR,
    confidence_score NUMERIC(4,3),
    reasoning TEXT,
    input_data_hash VARCHAR(64),
    previous_state VARCHAR,
    new_state VARCHAR,
    metadata JSONB NOT NULL DEFAULT '{}',
    prev_event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_audit_events_event_type CHECK (
        event_type IN ('state_transition', 'agent_decision', 'human_review',
                       'auth_event', 'threshold_change', 'document_upload',
                       'routing_decision')
    ),
    CONSTRAINT chk_audit_events_actor_type CHECK (
        actor_type IS NULL OR actor_type IN ('user', 'agent', 'system')
    ),
    CONSTRAINT chk_audit_events_confidence CHECK (
        confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
    )
);

-- NO updated_at column. This table is append-only.

CREATE INDEX idx_audit_events_application_id_id
    ON audit_events(application_id, id);
CREATE INDEX idx_audit_events_event_type
    ON audit_events(event_type);
CREATE INDEX idx_audit_events_created_at
    ON audit_events(created_at);
```

#### Audit Event Immutability: Trigger Guard

```sql
CREATE OR REPLACE FUNCTION prevent_audit_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_immutability_guard
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_event_modification();
```

#### Audit Event Immutability: INSERT-Only Role

```sql
CREATE ROLE audit_writer NOLOGIN;
GRANT USAGE ON SCHEMA public TO audit_writer;
GRANT INSERT ON audit_events TO audit_writer;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO audit_writer;
-- NO UPDATE, NO DELETE grants

-- Grant app_user the ability to SET ROLE to audit_writer
GRANT audit_writer TO app_user;
```

#### confidence_thresholds

```sql
CREATE TABLE confidence_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold_type VARCHAR NOT NULL,
    value NUMERIC(4,3) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES api_keys(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_threshold_type CHECK (
        threshold_type IN ('auto_approve_min', 'escalate_below', 'fraud_override')
    ),
    CONSTRAINT chk_threshold_value CHECK (value >= 0 AND value <= 1)
);

CREATE INDEX idx_confidence_thresholds_type_active
    ON confidence_thresholds(threshold_type, is_active) WHERE is_active = true;
```

**Note:** The `confidence_thresholds` table is created in the Phase 1 migration and seeded with default values via DX-02, but has **no Phase 1 API surface**. The THRESHOLD-01/02/03 management stories are Phase 5. In Phase 1, the aggregator stub reads thresholds directly from the database. The table exists to support the Phase 2+ routing logic without a schema migration.

#### langgraph schema

```sql
CREATE SCHEMA IF NOT EXISTS langgraph;
-- Tables within this schema are created and managed by PostgresSaver.
-- Do not create tables manually.
```

### Alembic Migration Ordering

```
packages/db/src/migrations/
  versions/
    001_create_extensions.py           # uuid-ossp, pgcrypto (if not using gen_random_uuid)
    002_create_api_keys.py             # No dependencies
    003_create_loan_applications.py    # Depends on api_keys (FK: created_by)
    004_create_documents.py            # Depends on loan_applications (FK: application_id)
    005_create_audit_events.py         # Depends on loan_applications (nullable FK)
    006_audit_immutability.py          # Trigger guard + audit_writer role on audit_events
    007_create_confidence_thresholds.py # No dependencies
    008_create_langgraph_schema.py     # Schema creation only
    009_seed_data.py                   # Data migration: API keys, applications, docs, audit events, thresholds
```

### Seed Data Specification (DX-01, DX-02)

Seed data is an Alembic data migration. It is idempotent: checks for existence before inserting. All records use fixed UUIDs for reproducibility.

**API Keys (3 keys, 24-hour TTL):**

| Role | Description | Key Prefix |
|------|------------|-----------|
| `loan_officer` | `SEED - Loan Officer (Maria)` | `ak_lo_...` |
| `senior_underwriter` | `SEED - Senior Underwriter (James)` | `ak_su_...` |
| `reviewer` | `SEED - Reviewer (Admin)` | `ak_rv_...` |

All seed keys have `is_seed = true` and `expires_at = now() + 24 hours`. Plaintext keys are printed to console during migration.

**Applications (12 total):**

| # | Status | Borrower | Loan Amount | Notes |
|---|--------|----------|-------------|-------|
| 1 | approved | Emily Chen | $320,000 | High confidence auto-approve |
| 2 | approved | David Park | $275,000 | Human-approved after medium confidence |
| 3 | approved | Sarah Johnson | $450,000 | Auto-approved |
| 4 | denied | Robert Williams | $600,000 | High DTI (52%) |
| 5 | denied | Lisa Thompson | $350,000 | Low credit score |
| 6 | awaiting_review | Michael Brown | $500,000 | Fraud flag escalation |
| 7 | awaiting_review | Jennifer Davis | $280,000 | Agent conflict (credit approve, risk deny) |
| 8 | awaiting_review | Carlos Rodriguez | $375,000 | Low confidence escalation |
| 9 | processing | Amanda Wilson | $310,000 | Mid-pipeline |
| 10 | processing_error | Kevin Lee | $425,000 | LLM failure (simulated) |
| 11 | draft | Nicole Martinez | $290,000 | Not yet submitted |
| 12 | withdrawn | Thomas Anderson | $340,000 | Withdrawn by borrower |

- SSNs use 900-999 range (SSA test range). Example: `900-12-3456`.
- Each non-draft application has 2-3 associated document records.
- Approved and denied applications have complete audit event chains.
- All monetary values are realistic for US mortgage scenarios.

**Confidence Thresholds (seeded defaults):**

| Threshold Type | Value |
|---------------|-------|
| `auto_approve_min` | 0.85 |
| `escalate_below` | 0.60 |

---

## Error Handling Strategy

### Error Class Hierarchy

```python
# packages/api/src/errors.py

class AppError(Exception):
    """Base application error. All domain errors extend this."""
    def __init__(self, status: int, title: str, detail: str | None = None,
                 error_type: str = "about:blank", instance: str | None = None):
        self.status = status
        self.title = title
        self.detail = detail
        self.error_type = error_type
        self.instance = instance

class ValidationError(AppError):
    """422: Request well-formed but semantically invalid."""
    def __init__(self, detail: str, errors: list[dict] | None = None,
                 instance: str | None = None):
        super().__init__(422, "Validation Failed", detail, instance=instance)
        self.errors = errors

class NotFoundError(AppError):
    """404: Resource does not exist."""
    def __init__(self, detail: str = "Resource not found.", instance: str | None = None):
        super().__init__(404, "Not Found", detail, instance=instance)

class ConflictError(AppError):
    """409: Conflict with current state."""
    def __init__(self, detail: str, instance: str | None = None):
        super().__init__(409, "Conflict", detail, instance=instance)

class AuthenticationError(AppError):
    """401: Missing or invalid credentials."""
    def __init__(self, detail: str = "Authentication required."):
        super().__init__(401, "Unauthorized", detail)

class AuthorizationError(AppError):
    """403: Authenticated but not authorized."""
    def __init__(self, detail: str = "You do not have permission to perform this action."):
        super().__init__(403, "Forbidden", detail)
```

### Exception Handler Middleware

```python
# packages/api/src/middleware/error_handler.py

from fastapi import Request
from fastapi.responses import JSONResponse

async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    body = {
        "type": exc.error_type,
        "title": exc.title,
        "status": exc.status,
        "detail": exc.detail,
        "instance": exc.instance or str(request.url.path),
    }
    if isinstance(exc, ValidationError) and exc.errors:
        body["errors"] = exc.errors
    return JSONResponse(status_code=exc.status, content=body)
```

### Error Handling Rules

1. **Auth errors (401, 403):** Never reveal whether a key exists. Both revoked and fabricated keys return identical 401 responses. 403 does not reveal what role is required.
2. **Ownership check failures:** `loan_officer` accessing another user's resource -> 404 (not 403), preventing information leakage about resource existence.
3. **State transition violations:** Return 409 Conflict with detail explaining the invalid transition (e.g., "Cannot transition from 'approved' to 'withdrawn'. Application is in a terminal state.").
4. **Validation errors:** Return 422 with `errors[]` array listing each field-level error. Never echo PII values in error messages.
5. **Internal errors:** Return 500 with generic message. Log full error details server-side (with PII masked). Never expose stack traces, SQL errors, or internal state.
6. **Audit event failures:** If audit write fails, the triggering operation also fails (audit is within the same transaction). Log the failure. Do not swallow audit errors.

---

## Observability Implementation

### Correlation ID Middleware (OBS-01, OBS-02)

```python
# packages/api/src/middleware/correlation.py
import re
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

VALID_REQUEST_ID = re.compile(r"^[a-zA-Z0-9_-]{1,128}$")

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract or generate correlation ID
        provided_id = request.headers.get("X-Request-ID", "")
        if provided_id and VALID_REQUEST_ID.match(provided_id):
            correlation_id = provided_id
        else:
            correlation_id = str(uuid.uuid4())

        # Attach to request state
        request.state.correlation_id = correlation_id

        # Process request
        response: Response = await call_next(request)

        # Echo in response
        response.headers["X-Request-ID"] = correlation_id
        return response
```

This middleware runs **before** authentication middleware so that even failed auth attempts are traceable.

### Structured Logging (OBS-03, PII-02)

Use `structlog` for structured JSON logging. Configure a PII-aware filter that:

1. Replaces any field matching `ssn*`, `social_security*` with masked value `***-**-NNNN`
2. Replaces any field matching `account_number*` with `[ACCOUNT_REDACTED]`
3. Replaces any field matching `government_id*` with `[GOV_ID_REDACTED]`
4. Replaces `authorization` header values with `Bearer [REDACTED]`
5. Replaces `original_filename` with `[uuid storage key]` when logging document operations

**Base log entry fields:**

| Field | Source |
|-------|--------|
| `timestamp` | ISO 8601 with timezone |
| `level` | error, warn, info, debug |
| `message` | Human-readable description |
| `correlationId` | From `request.state.correlation_id` |
| `service` | `"api"` (configurable) |

**Contextual fields (when available):** `userId`, `operation`, `durationMs`, `statusCode`, `applicationId`, `agentName`.

**Log level defaults:** `info` in production (`ENVIRONMENT=production`), `debug` in development.

**Request logging:** A middleware emits one `info`-level log entry per request with method, path, status code, and duration in milliseconds.

---

## Authentication Implementation

### Key Resolution Flow (AUTH-01, AUTH-06)

```python
# packages/api/src/auth/resolver.py
import hashlib
import hmac
from fastapi import Depends, Request
from .context import AuthContext

async def resolve_api_key(request: Request) -> AuthContext:
    """
    Extract API key from Authorization header, compute HMAC-SHA256,
    look up in database, and return AuthContext with database role.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header:
        raise AuthenticationError("Authentication required.")

    if not auth_header.startswith("Bearer "):
        raise AuthenticationError("Invalid authentication format.")

    token = auth_header[7:]  # Remove "Bearer " prefix

    # Parse optional role prefix
    client_role = None
    if ":" in token:
        client_role, raw_key = token.split(":", 1)
    else:
        raw_key = token

    if not raw_key:
        raise AuthenticationError("Invalid authentication format.")

    # Compute HMAC-SHA256 hash
    hmac_secret = settings.hmac_secret_key.encode()
    key_hash = hmac.new(hmac_secret, raw_key.encode(), hashlib.sha256).hexdigest()

    # Constant-time lookup
    api_key_record = await api_key_repo.find_by_hash(key_hash)

    if api_key_record is None:
        await audit_service.record_auth_failure("unknown_key", request.state.correlation_id)
        raise AuthenticationError()

    if not api_key_record.is_active:
        await audit_service.record_auth_failure("revoked_key", request.state.correlation_id, api_key_record.id)
        raise AuthenticationError()

    if api_key_record.expires_at < utc_now():
        await audit_service.record_auth_failure("expired_key", request.state.correlation_id, api_key_record.id)
        raise AuthenticationError()

    # Log role mismatch if present
    if client_role and client_role != api_key_record.role:
        logger.warn("Role mismatch",
                     correlationId=request.state.correlation_id,
                     client_role=client_role,
                     actual_role=api_key_record.role)

    return AuthContext(
        key_id=str(api_key_record.id),
        role=api_key_record.role,
        correlation_id=request.state.correlation_id,
    )
```

### Role Authorization Dependency (AUTH-05)

```python
# packages/api/src/auth/roles.py

def require_role(minimum_role: str):
    """FastAPI dependency that checks the authenticated user meets the minimum role."""
    async def _check(auth: AuthContext = Depends(resolve_api_key)):
        if not meets_minimum_role(auth.role, minimum_role):
            raise AuthorizationError()
        return auth
    return _check
```

**Usage in routers:**

```python
@router.post("/v1/auth/keys", dependencies=[Depends(require_role("reviewer"))])
async def create_api_key(...): ...

@router.get("/v1/applications", dependencies=[Depends(require_role("loan_officer"))])
async def list_applications(...): ...
```

### Production Credential Check (AUTH-07)

Runs at application startup, before the HTTP server begins listening.

```python
# packages/api/src/auth/startup_checks.py

async def check_production_credentials(settings: Settings, db_session) -> None:
    if settings.environment != "production":
        if any_defaults_detected(settings):
            logger.warn("Default/seed credentials detected in development mode")
        return

    errors: list[str] = []

    # Check for seed API keys in DB
    seed_keys_exist = await db_session.execute(
        select(ApiKey).where(ApiKey.is_seed == True, ApiKey.is_active == True)
    )
    if seed_keys_exist.scalar():
        errors.append("Active seed API keys detected")

    # Check MinIO credentials
    if settings.minio_access_key == "minioadmin" or settings.minio_secret_key == "minioadmin":
        errors.append("Default MinIO credentials detected")

    # Check database password (match user:password pattern, not scheme)
    if ":postgres@" in settings.database_url:
        errors.append("Default PostgreSQL password detected")

    # Check Redis password
    if settings.redis_url and (
        "redis://localhost" in settings.redis_url or ":6379" in settings.redis_url
    ) and "@" not in settings.redis_url:
        errors.append("Redis has no password configured")

    # Check required secrets
    if not settings.encryption_key:
        errors.append("ENCRYPTION_KEY is required in production")
    if not settings.hmac_secret_key:
        errors.append("HMAC_SECRET_KEY is required in production")

    if errors:
        for error in errors:
            logger.error(f"Production credential check failed: {error}")
        raise SystemExit(1)
```

---

## PII Encryption Implementation

### Encryption Service (PII-01, PII-04)

```python
# packages/api/src/services/encryption.py
from cryptography.fernet import Fernet

# Key version bytes
KEY_VERSION_CURRENT = b"\x01"
KEY_VERSION_PREVIOUS = b"\x00"

class EncryptionService:
    def __init__(self, current_key: str, previous_key: str | None = None):
        self._current_fernet = Fernet(current_key.encode())
        self._previous_fernet = Fernet(previous_key.encode()) if previous_key else None

    def encrypt(self, plaintext: str) -> bytes:
        """Encrypt with current key. Prepend version byte."""
        ciphertext = self._current_fernet.encrypt(plaintext.encode())
        return KEY_VERSION_CURRENT + ciphertext

    def decrypt(self, data: bytes) -> str:
        """Decrypt using version byte to select correct key."""
        if not data or len(data) < 2:
            raise ValueError("Invalid encrypted data")

        version_byte = data[0:1]
        ciphertext = data[1:]

        if version_byte == KEY_VERSION_CURRENT:
            return self._current_fernet.decrypt(ciphertext).decode()
        elif version_byte == KEY_VERSION_PREVIOUS:
            if self._previous_fernet is None:
                raise ValueError(
                    "Encrypted with previous key but ENCRYPTION_KEY_PREVIOUS is not configured"
                )
            return self._previous_fernet.decrypt(ciphertext).decode()
        else:
            raise ValueError(f"Unknown key version: {version_byte!r}")

    @staticmethod
    def extract_last4(ssn: str) -> str:
        """Extract last 4 digits of SSN for masked display."""
        digits = ssn.replace("-", "")
        return digits[-4:]

    @staticmethod
    def mask_ssn(last4: str) -> str:
        """Format masked SSN for API response."""
        return f"***-**-{last4}"
```

### PII Masking in Responses (PII-02)

All API responses mask PII:
- SSN: `"***-**-1234"` (using stored `ssn_last4`)
- Account numbers: `"[REDACTED]"`
- Government IDs: `"[REDACTED]"`
- Cleartext PII is **never** included in API responses.

This masking happens in the response serialization layer (Pydantic model `model_validator` or explicit serialization function), not in the database model.

---

## Audit Service Implementation

### Core Audit Service (AUDIT-01, AUDIT-02, AUDIT-03)

```python
# packages/api/src/services/audit.py
import hashlib
from sqlalchemy import text

NULL_SENTINEL_HASH = "0" * 64

class AuditService:
    def __init__(self, db_session):
        self._session = db_session

    async def record_event(
        self,
        event_type: str,
        correlation_id: str,
        application_id: str | None = None,
        actor_id: str | None = None,
        actor_type: str | None = None,
        actor_role: str | None = None,
        agent_name: str | None = None,
        confidence_score: float | None = None,
        reasoning: str | None = None,
        input_data_hash: str | None = None,
        previous_state: str | None = None,
        new_state: str | None = None,
        metadata: dict | None = None,
    ) -> int:
        """
        Insert an audit event with hash chain integrity.
        Uses advisory lock to serialize writes per application.
        Uses SET ROLE audit_writer for INSERT-only permissions.
        """
        meta = metadata or {}
        meta["correlationId"] = correlation_id

        # Acquire advisory lock (per application, or global for system events)
        # Advisory locks are transaction-scoped (pg_advisory_xact_lock) and release
        # automatically at COMMIT/ROLLBACK. If concurrent inserts contend on the same
        # application, one will block until the other commits. Under normal load this
        # adds negligible latency; under pathological contention, PostgreSQL's
        # lock_timeout setting (default: 0 = wait forever) governs behavior. Consider
        # setting a session-level lock_timeout if bounded wait time is required.
        if application_id:
            await self._session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:app_id))"),
                {"app_id": str(application_id)}
            )
        else:
            # System events use a fixed lock key
            await self._session.execute(
                text("SELECT pg_advisory_xact_lock(0)")
            )

        # Get previous event hash for this application
        prev_hash = await self._get_previous_hash(application_id)

        # SET ROLE for INSERT-only permissions
        # Note: SET LOCAL ROLE requires the session to be in a transaction
        # (non-autocommit mode). The async_sessionmaker must use autocommit=False (default).
        await self._session.execute(text("SET LOCAL ROLE audit_writer"))

        # INSERT the audit event
        result = await self._session.execute(
            text("""
                INSERT INTO audit_events
                    (application_id, event_type, actor_id, actor_type, actor_role,
                     agent_name, confidence_score, reasoning, input_data_hash,
                     previous_state, new_state, metadata, prev_event_hash)
                VALUES
                    (:application_id, :event_type, :actor_id, :actor_type, :actor_role,
                     :agent_name, :confidence_score, :reasoning, :input_data_hash,
                     :previous_state, :new_state, :metadata::jsonb, :prev_event_hash)
                RETURNING id
            """),
            {
                "application_id": application_id,
                "event_type": event_type,
                "actor_id": actor_id,
                "actor_type": actor_type,
                "actor_role": actor_role,
                "agent_name": agent_name,
                "confidence_score": confidence_score,
                "reasoning": reasoning,
                "input_data_hash": input_data_hash,
                "previous_state": previous_state,
                "new_state": new_state,
                "metadata": json.dumps(meta),
                "prev_event_hash": prev_hash,
            }
        )

        # Restore role
        await self._session.execute(text("RESET ROLE"))

        return result.scalar_one()

    async def _get_previous_hash(self, application_id: str | None) -> str:
        """Compute hash of the most recent event for this application."""
        if application_id:
            row = await self._session.execute(
                text("""
                    SELECT id, application_id, event_type, created_at, prev_event_hash
                    FROM audit_events
                    WHERE application_id = :app_id
                    ORDER BY id DESC
                    LIMIT 1
                """),
                {"app_id": application_id}
            )
        else:
            # System events: hash chain not linked; use null sentinel
            return NULL_SENTINEL_HASH

        prev_event = row.first()
        if prev_event is None:
            return NULL_SENTINEL_HASH

        # Compute SHA-256 of concatenated fields
        hash_input = (
            f"{prev_event.id}"
            f"{prev_event.application_id}"
            f"{prev_event.event_type}"
            f"{prev_event.created_at.isoformat()}"
            f"{prev_event.prev_event_hash}"
        )
        return hashlib.sha256(hash_input.encode()).hexdigest()
```

**Convenience methods:**

```python
    async def record_state_transition(
        self, application_id: str, previous_state: str | None,
        new_state: str, auth: AuthContext
    ) -> int:
        return await self.record_event(
            event_type="state_transition",
            correlation_id=auth.correlation_id,
            application_id=application_id,
            actor_id=auth.key_id,
            actor_type="user",
            actor_role=auth.role,
            previous_state=previous_state,
            new_state=new_state,
        )

    async def record_auth_failure(
        self, reason: str, correlation_id: str, key_id: str | None = None
    ) -> int:
        return await self.record_event(
            event_type="auth_event",
            correlation_id=correlation_id,
            actor_id=key_id or "anonymous",
            actor_type="system",
            metadata={"reason": reason},
        )

    async def record_document_upload(
        self, application_id: str, document_id: str, auth: AuthContext
    ) -> int:
        return await self.record_event(
            event_type="document_upload",
            correlation_id=auth.correlation_id,
            application_id=application_id,
            actor_id=auth.key_id,
            actor_type="user",
            actor_role=auth.role,
            metadata={"documentId": document_id},
        )
```

---

## Checkpoint Infrastructure (CHECKPOINT-01, CHECKPOINT-02, CHECKPOINT-03)

### PostgresSaver Configuration

```python
# packages/api/src/graphs/checkpoint.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def get_checkpointer(db_url: str) -> AsyncPostgresSaver:
    """Create PostgresSaver instance using the langgraph schema."""
    checkpointer = AsyncPostgresSaver.from_conn_string(db_url)
    await checkpointer.setup()  # Creates tables in langgraph schema if not exists
    return checkpointer
```

### Stub Graph for Phase 1

In Phase 1, a minimal LangGraph graph proves the checkpoint pattern. It has a single stub node that sets `current_step = "stub_complete"` and returns.

```python
# packages/api/src/graphs/loan_processing/graph.py
from langgraph.graph import StateGraph, END
from typing import TypedDict

class LoanProcessingState(TypedDict):
    application_id: str
    documents: list[dict]
    agent_results: dict[str, dict]
    aggregated_confidence: float | None
    routing_decision: str | None
    review_result: dict | None
    analysis_pass: int
    current_step: str
    errors: list[str]

def build_loan_processing_graph(checkpointer):
    graph = StateGraph(LoanProcessingState)

    async def stub_node(state: LoanProcessingState) -> dict:
        """Phase 1 stub. Replaced by real agents in Phase 2."""
        return {"current_step": "stub_complete"}

    graph.add_node("stub_agent", stub_node)
    graph.set_entry_point("stub_agent")
    graph.add_edge("stub_agent", END)

    return graph.compile(checkpointer=checkpointer)
```

### Graph Invocation

Application ID is used as LangGraph thread ID. Correlation ID is passed in config metadata.

```python
async def invoke_workflow(application_id: str, correlation_id: str, checkpointer):
    graph = build_loan_processing_graph(checkpointer)
    config = {
        "configurable": {"thread_id": str(application_id)},
        "metadata": {"correlation_id": correlation_id},
    }
    initial_state = {
        "application_id": str(application_id),
        "documents": [],
        "agent_results": {},
        "aggregated_confidence": None,
        "routing_decision": None,
        "review_result": None,
        "analysis_pass": 1,
        "current_step": "start",
        "errors": [],
    }
    await graph.ainvoke(initial_state, config=config)
```

### Checkpoint Cleanup (CHECKPOINT-03)

A daily background task deletes checkpoints for terminal applications older than 30 days.

```python
# packages/api/src/tasks/checkpoint_cleanup.py

async def cleanup_old_checkpoints(db_session, checkpointer):
    """Remove checkpoint data for terminal workflows older than 30 days."""
    terminal_apps = await db_session.execute(
        text("""
            SELECT id, analysis_pass FROM loan_applications
            WHERE status IN ('approved', 'denied', 'withdrawn')
            AND updated_at < now() - interval '30 days'
        """)
    )
    for app in terminal_apps:
        thread_ids = [str(app.id)]
        if app.analysis_pass > 1:
            for p in range(1, app.analysis_pass + 1):
                thread_ids.append(f"{app.id}:{p}")
        for tid in thread_ids:
            await checkpointer.adelete({"configurable": {"thread_id": tid}})
```

Schedule via `asyncio` background task or APScheduler, running daily.

---

## Configuration (packages/api/src/config.py)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Environment
    environment: str = "development"
    log_level: str = "debug"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mortgage_app"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "documents"
    minio_use_ssl: bool = False

    # Encryption
    encryption_key: str = ""
    encryption_key_previous: str | None = None

    # Auth
    hmac_secret_key: str = ""

    # LLM (Phase 2+)
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # LangFuse (optional)
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None

    # Upload limits
    max_file_size_bytes: int = 20_971_520  # 20MB

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}
```

---

## File/Module Structure

```
packages/
  api/
    src/
      __init__.py
      main.py                           # FastAPI app assembly, middleware registration
      config.py                         # Pydantic BaseSettings

      auth/
        __init__.py
        context.py                      # AuthContext dataclass
        resolver.py                     # resolve_api_key dependency
        roles.py                        # Role enum, hierarchy, require_role dependency
        startup_checks.py              # Production credential validation

      errors.py                         # AppError hierarchy + RFC 7807 models

      middleware/
        __init__.py
        correlation.py                  # X-Request-ID generation/propagation
        logging.py                      # Structured JSON logging + PII filter
        error_handler.py                # Exception -> RFC 7807 response mapping

      models/
        __init__.py
        schemas.py                      # PropertyAddress, shared value objects
        requests.py                     # Pydantic request models (CreateApplicationRequest, etc.)
        responses.py                    # Pydantic response models (ApplicationResponse, etc.)
        status.py                       # ApplicationStatus, VALID_TRANSITIONS, state machine

      routes/
        __init__.py
        applications.py                 # /v1/applications CRUD + status transitions
        documents.py                    # /v1/documents/:id + /v1/applications/:id/documents
        audit_events.py                 # /v1/applications/:id/audit-events
        auth_keys.py                    # /v1/auth/keys CRUD
        health.py                       # /health, /ready

      services/
        __init__.py
        audit.py                        # AuditService (hash chain, advisory lock, SET ROLE)
        encryption.py                   # EncryptionService (Fernet, key ring, version byte)
        application.py                  # Application business logic
        document.py                     # Document upload, validation, MinIO operations
        minio_client.py                 # MinIO client wrapper

      graphs/
        __init__.py
        checkpoint.py                   # PostgresSaver configuration
        loan_processing/
          __init__.py
          graph.py                      # Stub graph (Phase 1), state definition
          state.py                      # LoanProcessingState TypedDict

      tasks/
        __init__.py
        checkpoint_cleanup.py           # Daily checkpoint cleanup

    tests/
      __init__.py
      conftest.py                       # Fixtures: test client, DB session, seed data
      test_auth.py                      # AUTH-01 through AUTH-08 tests
      test_applications.py              # APP-01 through APP-07 tests
      test_documents.py                 # DOC-01 through DOC-04 tests
      test_audit.py                     # AUDIT-01 through AUDIT-04 tests
      test_encryption.py                # PII-01, PII-04 tests
      test_health.py                    # DEPLOY-03 tests
      test_observability.py             # OBS-01, OBS-02, OBS-03 tests
      test_checkpoint.py                # CHECKPOINT-01 through CHECKPOINT-03 tests

    pyproject.toml

  db/
    src/
      __init__.py
      models/
        __init__.py
        api_key.py                      # SQLAlchemy ApiKey model
        loan_application.py             # SQLAlchemy LoanApplication model
        document.py                     # SQLAlchemy Document model
        audit_event.py                  # SQLAlchemy AuditEvent model
        confidence_threshold.py         # SQLAlchemy ConfidenceThreshold model

      migrations/
        env.py                          # Alembic environment
        versions/
          001_create_extensions.py
          002_create_api_keys.py
          003_create_loan_applications.py
          004_create_documents.py
          005_create_audit_events.py
          006_audit_immutability.py
          007_create_confidence_thresholds.py
          008_create_langgraph_schema.py
          009_seed_data.py

      seed.py                           # Seed data generation helpers
      database.py                       # Async engine, session factory, connection pools

    pyproject.toml

compose.yml                             # PostgreSQL, Redis, MinIO containers
Makefile                                # setup, dev, test, lint targets
.env.example                            # Template with all required env vars
```

---

## Implementation Approach

### Pattern

FastAPI dependency injection is the primary composition mechanism. Auth context, DB sessions, and services are injected into route handlers via `Depends()`. This avoids globals and thread-locals.

**Service layer pattern:**
- Routes handle HTTP concerns: parse request, call service, format response.
- Services handle business logic: validation beyond Pydantic, state machine enforcement, audit recording, encryption.
- Repositories (or direct SQLAlchemy queries in services) handle data access.

### Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `BIGINT` for monetary cents columns | Supports loan amounts > $21.4M without overflow. Negligible storage overhead vs `INTEGER`. |
| `SET LOCAL ROLE audit_writer` (not `SET ROLE`) | `SET LOCAL ROLE` scopes the role change to the current transaction. No risk of role leak across requests in a connection pool. |
| `structlog` for logging | Structured JSON output, processor pipeline for PII filtering, zero-config async safety. Widely used in Python async apps. |
| `python-magic` for MIME validation | Reads file magic bytes, not Content-Type header. Prevents MIME type spoofing. Standard library for file type detection. |
| Cursor pagination via `base64(id)` for audit events | Audit events use `BIGSERIAL` id which is monotonically increasing. Using `id` as cursor is stable under concurrent writes and efficient (index seek). |
| Cursor pagination via `base64(created_at:id)` for applications | Applications are ordered by `created_at DESC`. Compound cursor ensures stable ordering even with identical timestamps. |
| `is_seed` flag on api_keys | Enables production credential check to detect seed keys without maintaining a separate list of known seed key hashes. |
| Fernet key version byte prepended **before** ciphertext | Fernet tokens have a fixed internal structure. Prepending a single byte is the only safe way to version without corrupting the token. |

### Exit Conditions per Task

| Task Group | Exit Condition | Verification Command |
|-----------|---------------|---------------------|
| Auth middleware (AUTH-01, AUTH-05, AUTH-06, AUTH-08) | Auth endpoints enforce key validation, role hierarchy, expiration | `pytest packages/api/tests/test_auth.py -v` |
| Auth key management (AUTH-02, AUTH-03, AUTH-04) | CRUD operations on /v1/auth/keys work correctly | `pytest packages/api/tests/test_auth.py -k "create or revoke or list" -v` |
| Production credential check (AUTH-07) | App refuses to start with default creds in production mode | `pytest packages/api/tests/test_auth.py -k "production_credential" -v` |
| Audit infrastructure (AUDIT-01, AUDIT-02, AUDIT-03) | Audit events are immutable, hash-chained, INSERT-only role enforced | `pytest packages/api/tests/test_audit.py -k "immutability or hash_chain or set_role" -v` |
| Audit querying (AUDIT-04) | Audit event endpoint with filtering and pagination | `pytest packages/api/tests/test_audit.py -k "query" -v` |
| PII encryption (PII-01, PII-04) | Fernet encrypt/decrypt with key rotation support | `pytest packages/api/tests/test_encryption.py -v` |
| PII masking (PII-02) | API responses mask SSN, account numbers; logs mask PII | `pytest packages/api/tests/test_encryption.py -k "mask" -v` |
| Application CRUD (APP-01, APP-02, APP-03) | Create, list, detail endpoints with RBAC | `pytest packages/api/tests/test_applications.py -k "create or list or detail" -v` |
| Status transitions (APP-04, APP-05, APP-06, APP-07) | Submit, withdraw, retry with state machine enforcement | `pytest packages/api/tests/test_applications.py -k "submit or withdraw or retry or transition" -v` |
| Document upload/download (DOC-01, DOC-02, DOC-03, DOC-04) | Upload with validation, download, status display | `pytest packages/api/tests/test_documents.py -v` |
| Checkpoint infra (CHECKPOINT-01, CHECKPOINT-02, CHECKPOINT-03) | PostgresSaver setup, stub graph invocation, cleanup | `pytest packages/api/tests/test_checkpoint.py -v` |
| Correlation ID (OBS-01, OBS-02) | Middleware generates/propagates X-Request-ID | `pytest packages/api/tests/test_observability.py -k "correlation" -v` |
| Structured logging (OBS-03) | JSON log output with required fields | `pytest packages/api/tests/test_observability.py -k "logging" -v` |
| Health endpoints (DEPLOY-03) | /health returns 200, /ready checks dependencies | `curl -sf http://localhost:8000/health \| python -m json.tool && curl -sf http://localhost:8000/ready \| python -m json.tool` |
| Database migrations | All migrations apply cleanly | `cd packages/db && alembic upgrade head` |
| Seed data (DX-01, DX-02) | 12 applications, 3 API keys, thresholds loaded | `pytest packages/api/tests/test_applications.py -k "seed_data" -v` |
| OpenAPI docs (DX-03) | Swagger UI accessible at /docs | `curl -sf http://localhost:8000/openapi.json \| python -c "import sys,json; d=json.load(sys.stdin); assert len(d['paths']) >= 10"` |
| Dev setup (DX-01) | make setup && make dev brings system up | `make setup && make dev &; sleep 15 && curl -sf http://localhost:8000/health` |
| Architecture docs (DX-04) | README contains architecture overview | `test -f README.md && grep -q "Architecture" README.md` |

---

## Cross-Task Dependencies

| Produces | Consumed By | Contract |
|----------|-------------|----------|
| Auth middleware (AUTH-01, AUTH-05, AUTH-06) | All protected route handlers | `AuthContext` dataclass via `Depends(resolve_api_key)` |
| Role hierarchy (AUTH-05) | Route handlers with role gates | `require_role(minimum_role)` dependency |
| Audit service (AUDIT-01, AUDIT-03) | Application routes, auth routes, document routes | `AuditService.record_event()` interface |
| Encryption service (PII-01, PII-04) | Application creation route | `EncryptionService.encrypt()` / `.decrypt()` interface |
| Status state machine (APP-05) | Application routes (submit, withdraw, retry) | `VALID_TRANSITIONS` dict, `is_valid_transition()` function |
| Correlation ID middleware (OBS-01) | All routes, audit service, logging | `request.state.correlation_id` |
| Structured logging (OBS-03) | All modules | `structlog` logger with PII filter |
| Database models (db package) | API service layer | SQLAlchemy model classes |
| Alembic migrations | All database operations | Schema must exist before app queries |
| PostgresSaver (CHECKPOINT-01) | Graph invocation (stub in Phase 1, real in Phase 2) | `AsyncPostgresSaver` instance |
| Error hierarchy (errors.py) | All routes and middleware | `AppError` subclasses |
| Pydantic models (models/) | Routes and services | Request/Response model classes |
| Config (config.py) | All services | `Settings` instance via dependency |

---

## Context Package

### Work Area: Authentication & Authorization (AUTH-01 through AUTH-08)

**Files to read:**
- `packages/api/src/auth/context.py` -- AuthContext dataclass
- `packages/api/src/auth/roles.py` -- Role hierarchy and require_role dependency
- `packages/api/src/auth/resolver.py` -- Key resolution logic
- `packages/api/src/config.py` -- Settings (HMAC_SECRET_KEY, ENVIRONMENT)

**Binding contracts:**
- `AuthContext(key_id: str, role: str, correlation_id: str)` -- populated after successful auth
- `Authorization: Bearer <role>:<key>` header format; role prefix ignored for authorization
- HMAC-SHA256 hash: `hmac.new(HMAC_SECRET_KEY, raw_key, sha256).hexdigest()`
- POST /v1/auth/keys, GET /v1/auth/keys, DELETE /v1/auth/keys/:id request/response shapes (see Interface Contracts)
- Role hierarchy: `loan_officer(1) < senior_underwriter(2) < reviewer(3)`

**Key decisions:**
- Server-side role resolution only; client-supplied role prefix is never used for authorization
- HMAC-SHA256 (not bcrypt) for API key hashing
- `is_seed` flag on api_keys for production credential detection
- Auth failures return identical 401 responses (no key existence leakage)

**Scope boundaries:**
- AUTH covers key validation, RBAC, key management, expiration, production checks
- Rate limiting middleware is NOT in Phase 1 scope

### Work Area: Audit Trail (AUDIT-01 through AUDIT-04)

**Files to read:**
- `packages/api/src/services/audit.py` -- AuditService with hash chain
- `packages/db/src/migrations/versions/005_create_audit_events.py` -- Table schema
- `packages/db/src/migrations/versions/006_audit_immutability.py` -- Trigger + role

**Binding contracts:**
- `AuditService.record_event()` interface (all parameters)
- Hash chain formula: `SHA-256(id || application_id || event_type || created_at || prev_event_hash)`
- Null sentinel hash: `"0" * 64`
- Advisory lock: `pg_advisory_xact_lock(hashtext(application_id::text))`
- `SET LOCAL ROLE audit_writer` for INSERT, `RESET ROLE` after
- Audit event response shape for AUDIT-04 endpoint

**Key decisions:**
- Three-layer immutability: INSERT-only role + trigger guard + hash chain
- System events (application_id = NULL) use null sentinel, not chained
- Advisory lock scoped per-application, not global
- `SET LOCAL ROLE` (transaction-scoped), not `SET ROLE` (session-scoped)

**Scope boundaries:**
- AUDIT covers event recording, immutability enforcement, and querying
- Audit export and hash chain validation are Phase 5

### Work Area: PII Protection (PII-01, PII-02, PII-04)

**Files to read:**
- `packages/api/src/services/encryption.py` -- EncryptionService
- `packages/api/src/middleware/logging.py` -- PII-aware log filter

**Binding contracts:**
- `EncryptionService.encrypt(plaintext) -> bytes` (version byte + Fernet ciphertext)
- `EncryptionService.decrypt(data) -> str` (version byte routes to correct key)
- Key version byte: `\x01` = current, `\x00` = previous
- PII masking: SSN = `"***-**-NNNN"`, accounts = `"[REDACTED]"`, gov ID = `"[REDACTED]"`

**Key decisions:**
- Fernet for symmetric encryption (authenticated encryption: AES-128-CBC + HMAC-SHA256)
- Key version byte prepended before ciphertext, not embedded within
- Dual-key rotation: current key for encrypt, version byte for decrypt routing
- PII masking applied at response serialization layer, not in DB models

**Scope boundaries:**
- PII-03 (redaction before LLM calls) is Phase 2
- Batch re-encryption is deferred beyond MVP

### Work Area: Application Lifecycle (APP-01 through APP-07)

**Files to read:**
- `packages/api/src/routes/applications.py` -- Route handlers
- `packages/api/src/services/application.py` -- Business logic
- `packages/api/src/models/status.py` -- State machine
- `packages/api/src/models/requests.py` -- CreateApplicationRequest
- `packages/api/src/models/responses.py` -- ApplicationResponse

**Binding contracts:**
- POST /v1/applications request/response shapes
- PATCH /v1/applications/:id request (status transitions)
- POST /v1/applications/:id/retry (no body, returns 202)
- Status state machine: `VALID_TRANSITIONS` dict
- Terminal states: `approved`, `denied`, `withdrawn`
- Monetary values: stored as BIGINT cents, serialized as string decimals

**Key decisions:**
- Submission is a double transition: draft -> submitted -> processing (two audit events)
- `loan_officer` sees only own applications; `senior_underwriter`+ sees all
- Ownership check failures return 404 (not 403) to prevent info leakage
- Async workflow invocation: API returns before graph runs

**Scope boundaries:**
- Phase 1 enqueues stub workflow; real pipeline is Phase 2
- Review queue endpoint is Phase 2

### Work Area: Document Management (DOC-01 through DOC-04)

**Files to read:**
- `packages/api/src/routes/documents.py` -- Route handlers
- `packages/api/src/services/document.py` -- Upload, validation, MinIO ops
- `packages/api/src/services/minio_client.py` -- MinIO wrapper

**Binding contracts:**
- POST /v1/applications/:id/documents (multipart/form-data)
- GET /v1/documents/:id (detail), GET /v1/documents/:id/download (binary)
- MIME allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`
- Max file size: 20MB (20,971,520 bytes)
- Storage key: UUID, never original filename
- Document can only be uploaded to `draft` applications (Phase 4 adds `awaiting_documents`)

**Key decisions:**
- Magic byte validation via `python-magic`, not Content-Type header trust
- PDF structure validation and image header validation for polyglot detection
- Filename sanitization: strip path, replace non-alnum (keep `.` and `-`), truncate 255
- MinIO SSE for all stored objects

**Scope boundaries:**
- Document processing (classification, extraction) is Phase 2
- Upload to `awaiting_documents` applications is Phase 4

### Work Area: Observability & Health (OBS-01 through OBS-03, DEPLOY-03)

**Files to read:**
- `packages/api/src/middleware/correlation.py` -- Correlation ID middleware
- `packages/api/src/middleware/logging.py` -- Structured logging middleware
- `packages/api/src/routes/health.py` -- Health endpoints

**Binding contracts:**
- `request.state.correlation_id` -- string, available after correlation middleware
- `X-Request-ID` header in requests and responses
- JSON log entry: `{timestamp, level, message, correlationId, service, ...}`
- `/health` returns `{"status": "ok"}` (200) or nothing (process dead)
- `/ready` returns `{"status": "ok"|"degraded", "dependencies": {...}}` (200 or 503)

**Key decisions:**
- Correlation ID middleware runs before auth middleware
- Malicious X-Request-ID (non-alnum, >128 chars) replaced with UUID
- `structlog` with JSON renderer and PII-filtering processor
- Health endpoints are unauthenticated and not under `/v1/` prefix

**Scope boundaries:**
- LangFuse integration is Phase 5
- Rate limiting middleware is not in Phase 1

### Work Area: Developer Experience (DX-01 through DX-04)

**Files to read:**
- `compose.yml` -- Container definitions
- `Makefile` -- Build targets
- `.env.example` -- Environment template
- `packages/db/src/migrations/versions/009_seed_data.py` -- Seed data

**Binding contracts:**
- `make setup`: installs pnpm deps, uv deps, creates `.env` from `.env.example`
- `make dev`: starts compose services, runs alembic migrations, loads seed data, starts uvicorn + vite
- Seed data: 3 API keys, 12 applications, documents, audit trails, thresholds
- `/docs` serves Swagger UI

**Key decisions:**
- Seed data as Alembic data migration (idempotent, version-controlled)
- Seed keys printed to console during migration
- Migrations run automatically on API startup
- Infrastructure containers (PG, Redis, MinIO) via compose; app services run on host

**Scope boundaries:**
- DX-05 (Quickstart Tutorial) is Phase 5
- Container build (DEPLOY-01, DEPLOY-02) is Phase 5

### Work Area: Checkpoint Infrastructure (CHECKPOINT-01 through CHECKPOINT-03)

**Files to read:**
- `packages/api/src/graphs/checkpoint.py` -- PostgresSaver setup
- `packages/api/src/graphs/loan_processing/graph.py` -- Stub graph
- `packages/api/src/graphs/loan_processing/state.py` -- LoanProcessingState TypedDict
- `packages/api/src/tasks/checkpoint_cleanup.py` -- Cleanup task

**Binding contracts:**
- `LoanProcessingState` TypedDict (all fields defined)
- Thread ID = `str(application_id)` for initial pass, `f"{application_id}:{analysis_pass}"` for resubmission
- PostgresSaver manages tables in `langgraph` schema
- Cleanup: delete checkpoints for terminal apps older than 30 days

**Key decisions:**
- Phase 1 uses a single stub node to prove the pattern
- Graph state uses references (IDs), not embedded PII values
- Cleanup is a daily background task
- Only one in-flight workflow per application (409 on concurrent)

**Scope boundaries:**
- Real agents replace stub in Phase 2
- Resubmission thread ID pattern (`{id}:{pass}`) used from Phase 4

---

## Risks & Open Questions

| Risk / Open Question | Mitigation / Resolution |
|---------------------|------------------------|
| **Escalation timestamp tracking:** `updated_at` may be overwritten by other updates while in `awaiting_review`. | Added `escalated_at TIMESTAMPTZ` column to `loan_applications` DDL (see schema above). Set when transitioning to `awaiting_review`. Prevents subtle review queue sorting bugs. |
| **Document upload limit per application:** No limit specified in requirements. | Enforce a configurable max of 25 documents per application at the API layer. Not a DB constraint. Default value in `Settings`. |
| **HMAC secret rotation:** No rotation mechanism at MVP. Changing `HMAC_SECRET_KEY` invalidates all existing API keys. | Document as an operational constraint. Production deployments should treat HMAC secret as immutable at MVP. Dual-secret rotation (like Fernet) can be added later if needed. |
| **Redis unavailability in Phase 1:** Redis is started by compose but not heavily used in Phase 1 (no rate limiting, no cache). | `/ready` endpoint checks Redis connectivity. If Redis is down, readiness fails but the Phase 1 API functionality (no LLM calls, no cache) continues. |
| **Reviewer self-review prevention:** Can the loan officer who created an application also review it? | Defer to Phase 2 when review queue is delivered. For Phase 1, no review actions are available. Flag for Phase 2 TD. |
| **Magic byte validation library:** Confirm `python-magic` availability. | Add `python-magic` to `packages/api/pyproject.toml` dependencies. Falls back to `Content-Type` header if library unavailable (with warning log). |
| **Background task execution:** Phase 1 needs a mechanism to run async tasks (workflow invocation, checkpoint cleanup). | Use `asyncio.create_task()` for workflow invocation within the FastAPI process. For checkpoint cleanup, use APScheduler or a simple `asyncio` loop. Full task queue (Celery, etc.) is unnecessary at MVP scale. |

---

## Requirements Inconsistencies Discovered

1. **APP-06 AC-4 vs state machine:** APP-06 AC-4 says "Cannot withdraw from processing." However, the state machine in the master requirements document (Section "Application Status State Machine") does not explicitly list `processing -> withdrawn` as a transition, which is consistent. The TD follows this: `processing` is not a withdrawable state.

2. **AUDIT-01 AC-2 lists `awaiting_documents -> processing` transition:** This is a Phase 4 transition. The TD's `VALID_TRANSITIONS` for Phase 1 omits it. Phase 2+ TDs will add it.

3. **PII-01 notes "Phase 1 (schema with encrypted columns) / Phase 2 (encryption service operational)":** This creates ambiguity about whether Phase 1 stores plaintext PII. **Resolution:** Phase 1 builds and uses the encryption service from day one. The schema has encrypted columns, and the service encrypts on write / decrypts on read. There is no phase where plaintext PII is stored.

4. **Monetary column type:** Architecture says `INTEGER` for cents. This TD uses `BIGINT` to support loan amounts > $21.4M. This is an enhancement consistent with the architecture's intent (no floating-point), not an override.

---

## Checklist

- [x] All cross-task interfaces defined with concrete types (no TBDs)
- [x] Data flow covers happy path and primary error paths
- [x] Error handling strategy is feature-specific (RFC 7807, error hierarchy, PII masking in errors)
- [x] File/module structure maps to existing project layout (packages/api, packages/db)
- [x] Every implementation task can identify which contracts it must conform to
- [x] Database schema complete with CREATE TABLE, indexes, constraints, triggers
- [x] Alembic migration ordering specified
- [x] Seed data composition defined (12 apps, 3 keys, thresholds)
- [x] Machine-verifiable exit conditions for every task group
- [x] Cross-task dependency map complete
- [x] Context package defined for each work area
- [x] Requirements inconsistencies flagged
