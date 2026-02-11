# Architecture Review: API Design Perspective

**Reviewer:** API Designer
**Date:** 2026-02-10
**Document Reviewed:** `plans/architecture.md` (Phase 1: Core Scheduling)

---

## Verdict

**APPROVE WITH SUGGESTIONS**

The architecture establishes clean component boundaries and a clear separation between packages/api, packages/db, and packages/ui. The resource model (Schedule, ScheduleRun, Recipient) maps naturally to REST resources. The state machines for Schedule and ScheduleRun status support consistent API contracts. Integration patterns between UI and API follow standard HTTP/JSON conventions.

All suggestions are improvements that can be addressed in Technical Design -- they do not block the architecture.

---

## Findings

### SUGGESTION-1: Clarify Schedule Creation Response Shape

**Issue:** Section 3 (Flow 1) states the API returns "201 with the created schedule, including `nextRunAt` as a UTC ISO 8601 timestamp." However, the response shape is not fully specified.

**Why it matters:** Downstream Technical Design needs to know whether the response includes the full Schedule resource (with nested Recipients array) or just schedule fields (with recipients handled separately via a sub-resource endpoint).

**Recommendation:** In Technical Design, specify the exact response shape. Suggest returning the full Schedule resource with inline recipients array for creation (reduces round-trips). Example:

```json
{
  "data": {
    "id": 123,
    "reportType": {...},
    "cadenceType": "weekly",
    "cadenceDay": 1,
    "scheduleTime": "09:00",
    "timezone": "America/New_York",
    "status": "active",
    "nextRunAt": "2026-02-17T14:00:00Z",
    "recipients": [
      {"email": "user@example.com", "isActive": true}
    ],
    "createdAt": "2026-02-10T18:30:00Z",
    "updatedAt": "2026-02-10T18:30:00Z"
  }
}
```

If recipients are managed via `/v1/schedules/:id/recipients` sub-resource, document that pattern in the TD.

---

### SUGGESTION-2: Specify Pagination for Schedule List Endpoint

**Issue:** Section 5.2 mentions "pagination" as part of the UI-to-API integration, but the architecture does not specify whether schedule list endpoints use cursor-based or offset-based pagination.

**Why it matters:** Per `api-conventions.md`, cursor-based pagination is preferred for dynamic datasets, offset-based for small/static. Schedule lists are likely small per user (persona context: 1-10 schedules per user), but could grow in admin view (Phase 2).

**Recommendation:** In Technical Design, specify:
- Owner schedule list (`GET /v1/schedules`): Use offset-based pagination (small, static per user). Default limit: 20, max: 100.
- Admin schedule list (Phase 2): Use cursor-based if the list spans many users and grows dynamically.

---

### SUGGESTION-3: Define Run History Pagination and Filtering

**Issue:** Section 3 (Flow 3) describes viewing "delivery history" for a schedule, but does not specify the endpoint or query parameters for filtering runs by date, status, or limiting result count.

**Why it matters:** Delivery history can grow large over time. Without pagination and filtering, the UI cannot efficiently display recent runs or search for a specific failure.

**Recommendation:** In Technical Design, define:
- Endpoint: `GET /v1/schedules/:id/runs` (sub-resource pattern per `api-conventions.md`)
- Pagination: Cursor-based (runs are ordered by `created_at DESC`, list grows unbounded)
- Query parameters: `?status=<status>&cursor=<cursor>&limit=<number>`
- Response includes `pagination.nextCursor` and `pagination.hasMore`

---

### SUGGESTION-4: Clarify Report Type Endpoint Design

**Issue:** Section 10 (Product Plan Consistency) mentions a `/v1/report-types` read-only endpoint but does not describe its structure or whether it supports filtering/searching.

**Why it matters:** If there are many report types, the schedule creation UI needs efficient discovery (search, categories, pagination). If there are only a handful, a simple list suffices.

**Recommendation:** In Technical Design, specify:
- Endpoint: `GET /v1/report-types`
- If report types are few (< 20): return a simple unpaginated list. Example: `{"data": [{"id": 1, "name": "Sales Summary", "description": "..."}, ...]}`
- If report types are many (> 20): add pagination and optional search query parameter (`?search=<term>`)

Open question for stakeholder: How many report types exist today? This affects the API design.

---

### SUGGESTION-5: State Transition Validation at API Boundary

**Issue:** Section 6.5 defines valid Schedule status transitions (active <-> paused, both -> deleted) and states "The API rejects invalid transitions with 409 Conflict." However, the architecture does not specify how the API receives a transition request.

**Why it matters:** REST convention for PATCH operations is to send the changed fields, not the transition name. The API must infer the intended transition from the current state and the new `status` value. This logic should be explicit.

**Recommendation:** In Technical Design, define:
- Endpoint: `PATCH /v1/schedules/:id` with body `{"status": "paused"}`
- The handler validates: current status is "active" (transition is valid), returns 409 if current status is "deleted" or already "paused"
- Document the valid transitions in the OpenAPI spec as a state machine diagram or table in the endpoint description

---

### INFO-1: Authentication Token Handling Aligns with Conventions

**Observation:** Section 5.2 states the UI passes authentication tokens via `Authorization: Bearer <token>` header and stores tokens in memory (not localStorage). This aligns with the `api-conventions.md` requirement to use Bearer tokens and avoid URL query parameters.

**No action needed** -- documenting alignment for completeness.

---

### INFO-2: Response Envelope Matches Project Standard

**Observation:** Section 3 (Flow 1) implies responses use `{"data": {...}}` envelope. Section 10 (Product Plan Consistency) confirms schedule and run endpoints return data in this format. This matches the `api-conventions.md` response envelope pattern.

**No action needed** -- confirming consistency across architecture and conventions.

---

### INFO-3: Rate Limiting Design Supports API Conventions

**Observation:** Section 6.6 defines a Redis-backed rate limit for schedule creation (10 creates per minute per user). The architecture states this is implemented as a FastAPI middleware or dependency. The `api-conventions.md` rule requires 429 responses with `X-RateLimit-*` headers when limits are exceeded.

**Recommendation for Technical Design:** Ensure the rate limit implementation returns the standard headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) per conventions.

---

## API-Relevant Observations for Technical Design

The following observations are inputs for the Tech Lead during Technical Design. They do not require architecture changes but should be addressed when defining concrete API contracts.

### 1. URL Structure Follows Resource-Oriented Pattern

The implied resource hierarchy is:
```
/v1/schedules
/v1/schedules/:id
/v1/schedules/:id/runs
/v1/report-types
```

This follows the `api-conventions.md` pattern (resources as nouns, max 2 levels of nesting). However, the architecture does not explicitly state whether recipients are managed via `/v1/schedules/:id/recipients` or inline in the schedule resource. **Clarify this in TD.**

### 2. Field Naming Consistency

The architecture uses `next_run_at` (snake_case) in the conceptual data model (section 8) and database column names, but the API response example in Flow 1 should use `nextRunAt` (camelCase) per `api-conventions.md` JSON field naming. **Confirm the TD applies the camelCase convention to all API responses**, even though the database uses snake_case.

### 3. Error Response Format

The architecture does not explicitly reference RFC 7807 error responses, but the `error-handling.md` rule requires this format. Validation errors (422), not-found errors (404), and conflict errors (409 for invalid state transitions) must all return RFC 7807 responses. **Confirm the TD specifies RFC 7807 for all error cases.**

### 4. Timezone Handling in API Responses

Section 2 (UI boundary rules) states the UI receives `schedule_time` (local) + `timezone` (IANA) as-is, and `next_run_at` as UTC ISO 8601. This is a clean API contract. **Confirm the TD specifies ISO 8601 format with Z suffix for all timestamp fields (`next_run_at`, `created_at`, `updated_at`, `completed_at`).**

### 5. Recipient Modification Workflow

The architecture states users can "add and remove email recipients" but does not specify whether this is done via:
- PATCH on the schedule resource with an updated recipients array
- POST/DELETE on `/v1/schedules/:id/recipients/:recipientId`
- Inline during schedule update

**Recommendation:** For MVP simplicity, support inline recipient management (PATCH `/v1/schedules/:id` with `{"recipients": [...]}` replaces the entire list). Phase 2 can add a sub-resource endpoint if fine-grained recipient auditing is needed.

---

## Consistency with API Conventions

| Convention | Architecture Alignment | Notes |
|------------|----------------------|-------|
| Resource-oriented URLs | Yes | Schedules, runs, report types are nouns; HTTP methods represent operations |
| kebab-case URLs | Not specified | Assume `/schedule-runs` if exposed as top-level; currently nested under `/schedules/:id/runs` which is fine |
| camelCase JSON fields | Implied but not explicit | Architecture mentions `nextRunAt` in Flow 1; confirm TD applies this consistently |
| Cursor pagination | Partially specified | Mentioned in UI integration but not defined for specific endpoints (see SUGGESTION-2, SUGGESTION-3) |
| RFC 7807 errors | Not mentioned | Must be applied in TD per `error-handling.md` |
| Versioned paths (`/v1/`) | Yes | Section 10 uses `/v1/schedules`, `/v1/report-types` |
| Bearer token auth | Yes | Section 5.2 specifies `Authorization: Bearer <token>` |
| 201 with Location header | Not specified | POST `/v1/schedules` returns 201; confirm TD includes `Location: /v1/schedules/:id` header |

---

## Summary

The architecture provides a solid foundation for API design. Component boundaries are clean, the resource model is well-structured, and integration patterns align with project conventions. The suggestions above focus on details that must be resolved during Technical Design -- they do not require architecture revisions.

**Key API design decisions confirmed by this architecture:**
1. Schedule, ScheduleRun, and ReportType are top-level resources
2. Runs are accessed as a sub-resource under schedules (`/v1/schedules/:id/runs`)
3. State transitions are managed via PATCH with status field changes, validated server-side
4. Timezone handling is explicit (IANA identifier + local time in schedule, UTC timestamps in responses)
5. Delivery detail is captured per-recipient for transparency

**Actions for Tech Lead:**
- Define exact API request/response schemas (Pydantic models) for all endpoints
- Specify pagination strategy for each list endpoint (offset vs. cursor)
- Apply camelCase JSON field naming and RFC 7807 error format
- Document valid state transitions in OpenAPI specs
- Clarify recipient management pattern (inline vs. sub-resource)

All action items are scoped to Technical Design. The architecture is approved as-is.
