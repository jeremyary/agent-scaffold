<!-- This project was developed with assistance from AI tools. -->

# Technical Design Phase 1 Advisory: API Designer

**To:** Tech Lead
**From:** API Designer
**Re:** Phase 1 endpoint design guidance for Technical Design Document
**Date:** 2026-02-12

## Scope

Phase 1 delivers 37 P0 stories across AUTH, AUDIT, PII, CHECKPOINT, DX, OBS, DEPLOY, APP, and DOC feature areas. This advisory covers API-level design concerns the Technical Design Document should address.

## Recommended Endpoint Structure

### Resource Hierarchy

```
/v1/applications
  POST   /                          # APP-01: Create application
  GET    /                          # APP-02: List with pagination
  GET    /:id                       # APP-03: View details
  PATCH  /:id                       # APP-04, APP-06: Submit, withdraw
  POST   /:id/retry                 # APP-07: Retry failed

  POST   /:id/documents             # DOC-01: Upload (multipart/form-data)
  GET    /:id/audit-events          # AUDIT-04: Query audit trail

/v1/documents/:id
  GET    /                          # DOC-03: View status
  GET    /download                  # DOC-04: Download file

/v1/auth/keys
  POST   /                          # AUTH-02: Create key
  GET    /                          # AUTH-04: List keys
  DELETE /:id                       # AUTH-03: Revoke key

/health                             # DEPLOY-03: Liveness (no /v1/ prefix)
/ready                              # DEPLOY-03: Readiness
```

**Design rationale:**
- Applications as primary resource; documents and audit events as sub-resources under `/:id/`.
- Actions on single resources use HTTP verbs (PATCH for status transitions). The `/retry` action is POST-to-collection-member pattern (idempotent retry operation).
- Documents have a top-level `/v1/documents/:id` for direct access (download, status polling) but creation only via the application context.

## Complex Endpoint Shapes

### APP-01: Create Application (POST /v1/applications)

**Request:**
```json
{
  "borrowerName": "Maria Garcia",
  "ssn": "900-12-3456",
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
  }
}
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
    "loanAmount": "250000.00",
    "propertyValue": "300000.00",
    "createdAt": "2026-02-12T14:30:00.000Z"
  }
}
```

**Key considerations:**
- Monetary values serialized as **string decimals** (not bare integers or floats) to avoid JavaScript precision loss.
- SSN masked in response (`***-**-1234`). Backend stores `ssn_encrypted` (Fernet) and `ssn_last4` (plaintext).
- Status defaults to `draft` server-side.
- `Location` header: `/v1/applications/:id`

### DOC-01: Upload Document (POST /v1/applications/:id/documents)

**Request:** `multipart/form-data` with single file field `document`.

**Response (201):**
```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "originalFilename": "pay_stub_jan_2026.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 1048576,
    "processingStatus": "pending",
    "createdAt": "2026-02-12T14:35:00.000Z"
  }
}
```

**Key considerations:**
- Magic byte validation (not just `Content-Type` header) — see DOC-02.
- Max file size: 20MB. Allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`.
- Storage key is UUID (never original filename). MinIO object key: `{uuid}`, not `documents/{filename}`.
- Document can only be uploaded to `draft` applications (409 otherwise).

### AUDIT-04: Query Audit Events (GET /v1/applications/:id/audit-events)

**Request:** `GET /v1/applications/:id/audit-events?cursor=<value>&limit=50&eventType=state_transition&dateFrom=2026-01-01T00:00:00Z&dateTo=2026-02-01T00:00:00Z`

**Response (200):**
```json
{
  "data": [
    {
      "id": 12345,
      "eventType": "state_transition",
      "actorType": "user",
      "actorRole": "loan_officer",
      "previousState": "draft",
      "newState": "submitted",
      "createdAt": "2026-02-12T14:40:00.000Z",
      "correlationId": "req-abc-123"
    }
  ],
  "pagination": {
    "nextCursor": "MTIzNDY=",
    "hasMore": true
  }
}
```

**Key considerations:**
- Cursor-based pagination (opaque cursor token, base64-encoded ID). Default limit: 50, max: 200.
- Chronological order (oldest first) for audit events.
- Filtering by `eventType`, date range via query params.
- Role-based visibility: `loan_officer` sees only their own applications' events; `senior_underwriter+` see all.

## Pagination Strategy

**Cursor-based pagination for all collections:**
- Query param: `?cursor=<opaque_token>&limit=<number>`
- Response: `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true/false } }`
- Default limit varies by endpoint (20 for applications, 50 for audit events).
- Cursor encodes the last item's sort key (e.g., base64-encoded ID for chronological order).

**Why cursor-based:** Offset pagination breaks under concurrent writes (items added/removed shift pages). Cursor pagination is stable and performant at scale. Requirements specify cursor-based explicitly.

## Authentication and Error Responses

### Authentication Header

`Authorization: Bearer <role>:<key>`

**Server behavior:**
- Extract key portion (ignore role prefix).
- Compute HMAC-SHA256 hash with `HMAC_SECRET_KEY`.
- Lookup hash in `api_keys` table.
- Use **database role** as authoritative (not client-supplied role prefix).
- Mismatch logs warning but proceeds with DB role.

**Error responses:**
- Missing/malformed header: 401
- Invalid/expired/revoked key: 401
- Insufficient role: 403

### RFC 7807 Error Shape

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "Request validation failed on 2 fields.",
  "instance": "/v1/applications",
  "errors": [
    { "field": "loanAmount", "message": "Must be greater than zero." },
    { "field": "borrowerName", "message": "Required field." }
  ]
}
```

**All error responses use this format.** Extension fields (like `errors[]`) are added as needed.

## Concerns for Technical Design

1. **Status transition validation:** APP-05 defines a state machine with specific allowed transitions. The Technical Design should specify whether this is enforced via DB constraints, application logic, or both. Recommend application-layer validation with explicit error messages.

2. **Document upload status constraint:** Documents can only be uploaded to `draft` applications (DOC-01 AC-3). Phase 4 extends this to `awaiting_documents`. Consider a DB check constraint or status validation in the upload handler.

3. **Audit event querying at scale:** AUDIT-04 supports filtering by event type and date range. If an application has 100+ audit events, cursor pagination must be efficient. Confirm index on `(application_id, id)` for cursor stability.

4. **Retry idempotency:** APP-07 retry endpoint returns 409 if a workflow is already in progress. The Technical Design should specify how "in-flight" is detected — likely checking `status = 'processing'` before enqueuing.

5. **File upload size limit enforcement:** DOC-02 specifies 20MB max. FastAPI has `UploadFile` size limits configurable via middleware. Confirm this is set to reject oversized files before MinIO storage, not after.

6. **Correlation ID propagation to async workflows:** OBS-02 requires correlation IDs in all audit events and logs. When APP-04 enqueues a background workflow, the correlation ID must propagate into the LangGraph graph state. Confirm this is part of the graph invocation config.

---

**Recommendation:** Use FastAPI's dependency injection for auth context, structured response models (Pydantic) for all endpoints, and OpenAPI schema generation for `/docs`. All monetary fields should be `Decimal` internally, serialized as strings via custom JSON encoder.
