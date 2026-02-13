<!-- This project was developed with assistance from AI tools. -->

# Architecture Advisory -- API Designer

**Date:** 2026-02-12
**Input for:** Architect (plans/architecture.md)

---

## 1. API Surface Groupings

Organize endpoints into these resource groups. All under `/v1/` prefix (see section 7).

| Group | Base Path | Auth | Notes |
|-------|-----------|------|-------|
| Applications | `/v1/applications` | Protected | Full CRUD lifecycle. Sub-resources: `/applications/:id/documents`, `/applications/:id/audit-events`, `/applications/:id/analyses` |
| Review Queue | `/v1/review-queue` | Protected | Read-only filtered view over applications awaiting human review. Not a separate data model -- query projection over applications with status `awaiting_review`. Supports `?priority=high&assignee=unassigned` filtering. |
| Documents | `/v1/documents/:id` | Protected | Top-level for direct document access (download, status check). Creation happens via `/applications/:id/documents` (POST). |
| Audit Events | `/v1/applications/:id/audit-events` | Protected (reviewer) | Read-only sub-resource. No POST/PUT/DELETE exposed to clients -- events are written server-side only. |
| Chat / Intake | `/v1/chat/sessions`, `/v1/chat/sessions/:id/messages` | Public | Rate-limited. Session-scoped. SSE endpoint for streaming at `/v1/chat/sessions/:id/stream`. |
| Calculator | `/v1/calculator/monthly-payment`, `/v1/calculator/affordability`, `/v1/calculator/amortization` | Public | Stateless computation endpoints (POST with input, 200 with result). Rate-limited. |
| Market Data | `/v1/market-data/rates`, `/v1/market-data/indices` | Public | Cached GET endpoints. FRED-sourced. |
| Admin / Config | `/v1/admin/thresholds`, `/v1/admin/knowledge-base` | Protected (reviewer) | Threshold CRUD, knowledge base management. All mutations audited. |
| Auth | `/v1/auth/keys` | Protected (reviewer) | API key management. Key creation, revocation, listing. |
| Health | `/health`, `/ready` | None | No version prefix. Standard liveness/readiness probes. |

Keep nesting to two levels maximum. `/applications/:id/documents` and `/applications/:id/audit-events` are the deepest paths. If analyses grow complex, promote to `/v1/analyses/:id` with an `applicationId` query filter.

## 2. Auth Middleware Pattern

Implement as a three-layer middleware chain on the FastAPI dependency injection system:

1. **Key Resolver** (`resolve_api_key`) -- Extracts the key from `Authorization: Bearer <role>:<key>`, looks up the key in the database, and returns the key record (actual role, expiry, scopes). If the client-supplied role prefix does not match the key's actual role, log the mismatch at `warn` level but continue with the key's actual role. Return 401 if key is missing, invalid, or expired.

2. **Role Asserter** (`require_role(minimum_role)`) -- Takes the resolved key record and checks whether the key's role meets the minimum required for the endpoint. Role hierarchy: `loan_officer` < `senior_underwriter` < `reviewer`. Return 403 if insufficient. Implemented as a parameterized FastAPI dependency: `Depends(require_role("senior_underwriter"))`.

3. **Audit Injector** -- After auth succeeds, attach `actor_id`, `actor_role`, and `correlation_id` to the request state so downstream handlers and service layers can record audit events without re-resolving auth context.

For public-tier endpoints, skip all three layers and apply rate limiting middleware instead (Redis-backed, keyed on client IP or session token).

Define `AuthContext` as a dataclass passed through FastAPI's dependency injection -- not a global/thread-local.

## 3. Async Document Processing (Status Polling)

Document upload (`POST /v1/applications/:id/documents`) returns `201` with a `Location` header pointing to `/v1/documents/:docId`. The document resource includes a `processingStatus` field:

```json
{
    "data": {
        "id": "doc_abc123",
        "applicationId": "app_xyz",
        "fileName": "w2-2024.pdf",
        "documentType": null,
        "processingStatus": "pending",
        "processingError": null,
        "createdAt": "2026-02-12T10:00:00Z"
    }
}
```

`processingStatus` values: `pending` -> `processing` -> `completed` | `failed`.

Clients poll `GET /v1/documents/:id` to check status. When `completed`, the `documentType`, extracted fields, and confidence scores are populated. When `failed`, `processingError` contains an RFC 7807-shaped error object.

Also expose `GET /v1/applications/:id/documents?processingStatus=pending` so the UI can check if all documents for an application are processed before enabling submission.

Do NOT use WebSockets or SSE for document status -- polling is sufficient and simpler. The product plan explicitly states "polling for workflow status."

## 4. Streaming Chat (SSE)

The intake chat uses SSE for streaming responses. Recommended endpoint:

```
POST /v1/chat/sessions/:id/messages
Content-Type: application/json
Accept: text/event-stream

{ "content": "How much can I afford on $75k salary?" }
```

Use POST (not GET) because the client sends a message body. The response is `Content-Type: text/event-stream` with chunked transfer encoding. Event types:

```
event: token
data: {"content": "Based on"}

event: token
data: {"content": " your salary"}

event: tool_use
data: {"tool": "calculator", "input": {"salary": 75000}}

event: tool_result
data: {"tool": "calculator", "result": {"maxHome": 300000}}

event: done
data: {"messageId": "msg_123"}
```

The `tool_use` and `tool_result` events let the UI show calculator invocations inline. The `done` event signals stream completion and provides the final message ID for subsequent requests.

If the client sends `Accept: application/json` instead of `text/event-stream`, return the complete response synchronously (useful for testing and non-streaming clients).

FastAPI supports SSE natively via `StreamingResponse` with `media_type="text/event-stream"`.

## 5. Audit Trail API Pattern

Audit events are an append-only, read-only sub-resource of applications:

```
GET /v1/applications/:id/audit-events?cursor=<value>&limit=20
```

No POST, PUT, or DELETE endpoints exposed. Events are written internally by the audit service.

Use cursor-based pagination keyed on a monotonically increasing event sequence number (not timestamp -- timestamps can collide). The cursor encodes the last-seen sequence number. Default sort is chronological (ascending) since auditors read trails start-to-finish.

Support filtering: `?eventType=agent_decision&actorRole=reviewer&since=2026-01-01T00:00:00Z&until=2026-02-01T00:00:00Z`.

Response shape:

```json
{
    "data": [
        {
            "sequenceNumber": 42,
            "eventType": "agent_decision",
            "timestamp": "2026-02-12T10:05:00Z",
            "actor": {"id": "credit_agent", "type": "agent"},
            "confidence": 0.92,
            "reasoning": "Credit score of 745 with clean payment history...",
            "inputRef": "doc_abc123",
            "metadata": {}
        }
    ],
    "pagination": {
        "nextCursor": "eyJzZXEiOjQyfQ==",
        "hasMore": true
    }
}
```

## 6. Mocked Service Interface Contracts

Use Python `Protocol` classes (from `typing`) to define service interfaces. Each mocked service and its future real counterpart implement the same Protocol.

```python
class CreditBureauService(Protocol):
    async def get_credit_report(self, ssn_token: str) -> CreditReport: ...

class PropertyDataService(Protocol):
    async def get_property_valuation(self, address: PropertyAddress) -> PropertyValuation: ...

class NotificationService(Protocol):
    async def send_notification(self, notification: Notification) -> None: ...
```

Register implementations via FastAPI's dependency injection system. A factory function reads configuration to decide which implementation to instantiate:

```python
def get_credit_bureau(settings: Settings = Depends(get_settings)) -> CreditBureauService:
    if settings.credit_bureau_provider == "mock":
        return MockCreditBureau()
    return RealCreditBureau(api_key=settings.credit_bureau_api_key)
```

Place Protocol definitions in a `contracts/` module within the `api` package (e.g., `packages/api/src/contracts/credit_bureau.py`). Place mock implementations in `packages/api/src/services/mocks/`. This separation makes it obvious which services are mocked and what the swap-in point is.

## 7. Versioning

Include `/v1/` prefix from day one. The cost is near-zero (a single FastAPI router prefix), and retrofitting it later is a breaking change to every client. At MVP maturity, maintain only `v1`. Do not build version negotiation, sunset headers, or multi-version routing infrastructure -- just the prefix.

Mount all versioned routes under an `APIRouter(prefix="/v1")`. Health and readiness endpoints remain unversioned at the root.
