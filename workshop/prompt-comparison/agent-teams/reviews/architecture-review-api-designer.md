<!-- This project was developed with assistance from AI tools. -->

# Architecture Review -- API Designer

**Reviewer:** API Designer
**Artifact:** plans/architecture.md
**Date:** 2026-02-12

## Verdict: APPROVE

The architecture document defines a well-organized API surface with clear groupings, consistent async patterns, and strong alignment with the advisory memo recommendations. The public/protected boundary enforcement at the router level is concrete and implementable. Financial value serialization, role-based review queue filtering, and the mocked service abstraction are all well-specified at the architecture level without over-specifying into full endpoint contracts. The few findings below are suggestions and minor warnings -- none block downstream Technical Design work.

---

## Findings

### Critical

None.

### Warning

**A-W1: SSE streaming uses POST with Accept header negotiation -- document the non-standard pattern explicitly.**

The architecture specifies (lines 588-589, 617-618):

> Chat: `/v1/chat/sessions` -- Session management and messaging. SSE streaming at `/:id/messages` (POST with `Accept: text/event-stream`).
> Chat responses: Synchronous streaming via SSE. POST sends message, response streams back as `text/event-stream`.

This matches my Phase 4 advisory recommendation (section 4), and the pattern is sound -- POST is correct because the client sends a message body. However, POST + SSE is non-standard (most SSE documentation and browser `EventSource` API examples assume GET). This means:

1. The browser-native `EventSource` API cannot be used directly (it only supports GET). The frontend will need a library like `fetch` with `ReadableStream` or a polyfill that supports POST.
2. The OpenAPI spec will need a custom annotation to represent the dual `Accept` header behavior (JSON vs. SSE).
3. Developers unfamiliar with this pattern may expect WebSockets or GET-based SSE.

This is not a design flaw -- it is the right trade-off for a REST-first API. But it needs explicit documentation in the Technical Design, including a note about `EventSource` limitations and the recommended frontend implementation approach.

---

**A-W2: Review queue role-based filtering semantics need clarification for edge cases.**

The architecture defines review queue filtering by role (lines 634-639):

> - `loan_officer`: sees applications with medium confidence escalations only
> - `senior_underwriter`: sees all escalated applications (medium + low confidence)
> - `reviewer`: sees all escalated applications plus audit/compliance views

This is good -- API-level filtering rather than UI-level filtering, which prevents data leakage (exactly what my Phase 2 review W3 recommended). Two edge cases need resolution during Technical Design:

1. **Fraud-flagged applications:** The aggregator routes fraud flags to `AWAIT_REVIEW` (line 214). Which roles see fraud-flagged applications? The current taxonomy only mentions confidence-level tiers. Given that fraud flags "force human review" (line 261), they likely need senior_underwriter or reviewer visibility, not loan_officer. This should be explicit.

2. **Conflict-escalated applications:** When agents conflict (line 212-213), the application is escalated. Are conflicts treated as medium or low confidence for role-filtering purposes? The aggregator routes them to `AWAIT_REVIEW` but the confidence-tier mapping is not specified.

Neither of these is architecturally blocking, but they will cause ambiguity during Technical Design if unresolved.

### Suggestion

**A-S1: Consider adding a `GET /v1/applications/:id/analyses` summary endpoint to the endpoint group table.**

The endpoint group table (lines 585-594) lists `/:id/analyses` as a sub-resource of applications, but it is bundled into the Applications row description rather than being a distinct group entry. The analyses sub-resource serves a different purpose than the application CRUD endpoints -- it provides a summary of all agent decisions for a given application (used by the review UI to show side-by-side agent results).

During Technical Design, it would be clearer to either:
- Give analyses its own row in the endpoint group table, or
- Explicitly note that analyses data is embedded in the application detail response (i.e., `GET /v1/applications/:id` returns agent results inline, making a separate analyses endpoint unnecessary).

This is purely a documentation clarity issue. The architecture is correct either way.

---

**A-S2: The `POST /v1/applications/:id/retry` action endpoint should document its idempotency behavior.**

The error path section (line 572) describes:

> user can retry via `POST /v1/applications/:id/retry` (returns 202 Accepted with updated application; processing restarts asynchronously)

The 202 Accepted response is appropriate for an async action. During Technical Design, this endpoint should specify:
- Whether multiple rapid retries create multiple workflow invocations or are idempotent (only one in-flight workflow per application).
- Whether retry is only valid from `processing_error` status, or also from other terminal/stuck states.

This is a detail for Technical Design, not the architecture document, but flagging it now avoids ambiguity later.

---

**A-S3: Audit event cursor pagination keyed on BIGSERIAL `id` -- confirm this is the cursor key.**

The architecture specifies (line 429):

> `id: BIGSERIAL (PK)` -- auto-increment for append performance

And the index (line 497):

> `audit_events`: index on `(application_id, id)` for cursor pagination

My advisory memo (section 5) recommended cursor pagination keyed on a monotonically increasing sequence number. The architecture uses BIGSERIAL `id`, which satisfies this requirement (auto-increment is monotonically increasing within a single database). This is a good choice. The Technical Design should confirm that the cursor encodes the `id` value, not the `created_at` timestamp (timestamps can collide; BIGSERIAL cannot).

### Positive

**A-P1: Public vs. protected boundary enforcement is concrete and well-designed.**

The router-level enforcement (lines 600-611) is exactly what I recommended:

```python
# Public router: rate limiting, no auth
public_router = APIRouter(prefix="/v1")
# Protected router: auth middleware
protected_router = APIRouter(prefix="/v1", dependencies=[Depends(resolve_api_key)])
```

This is the correct enforcement boundary. Public endpoints cannot accidentally acquire authentication requirements, and protected endpoints cannot accidentally lose them. The three-layer auth middleware chain (key resolver -> role asserter -> audit injector) is clean and matches my advisory memo section 2 exactly.

---

**A-P2: Financial value serialization convention is well-specified and appropriate.**

The architecture specifies (lines 629-631):

> Monetary values are stored as integer cents in the database. At the API JSON serialization layer, they are represented as **string decimals** (`"loanAmount": "250000.00"`) rather than bare integers or floats.

This is excellent. String decimal serialization avoids JavaScript floating-point precision issues, is unambiguous about decimal placement, and is standard practice in financial APIs. The extension to interest rates and ratios (`"interestRate": "6.875"`, `"dtiRatio": "43.50"`) is consistent. This gives the Technical Design a clear serialization rule to follow for all financial fields.

---

**A-P3: Response envelope and error format are consistently specified.**

The architecture explicitly states (lines 624-627):

> - Single resource: `{ "data": { ... } }`
> - Collection: `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true } }`
> - Error: RFC 7807 Problem Details

This matches `api-conventions.md` and `error-handling.md` exactly. The document processing error field also uses an RFC 7807-shaped error object (line 422: `processing_error: JSONB -- RFC 7807 error if failed`), which shows the pattern is applied consistently even for embedded error states.

---

**A-P4: Mocked service abstraction with Protocol classes and factory injection is clean.**

The architecture defines (lines 847-887) a contracts/mocks/real directory structure with Python Protocol classes and FastAPI dependency injection factories. This matches my advisory memo section 6 closely. The pattern ensures:
- Interface contracts are formally defined (not just informally mocked).
- Swap from mock to real requires only a configuration change.
- The factory pattern integrates with FastAPI's dependency injection, making testing straightforward.

---

**A-P5: Endpoint groupings align with advisory memo recommendations.**

The endpoint group table (lines 584-594) matches my advisory memo section 1 in structure and organization. Specific alignment:
- Applications with sub-resources at max 2 levels of nesting.
- Review queue as a read-only projection (not a separate data model).
- Calculator as stateless POST endpoints in the public tier.
- Market data as cached GET endpoints.
- Health endpoints unversioned at the root.
- Auth and admin properly scoped to the reviewer role.

---

## Phase 2 Product Plan Review Findings -- Disposition

| Finding | Status | How Addressed |
|---------|--------|---------------|
| **C1: Auth token format privilege escalation** | Resolved | Architecture ADR-002 (lines 1088-1094) specifies server-side role resolution. The role prefix is a routing hint only. Client-supplied role is never used for authorization. This eliminates the privilege escalation vector. |
| **C2: Streaming transport unspecified** | Resolved | Architecture specifies SSE for chat streaming (line 618), polling for all other status updates (line 617). This split is exactly what my review recommended. |
| **W1: Audit trail API as read-only** | Resolved | Architecture specifies audit events as a read-only sub-resource with no POST/PUT/DELETE exposed to clients. Append-only enforcement via database permissions, trigger guard, and hash chaining (lines 756-762). |
| **W2: Document upload async lifecycle** | Resolved | Architecture specifies async upload (201 immediate return) with status polling (line 616). Document processing status field progression is defined. |
| **W3: Role-based review queue filtering** | Resolved | Architecture specifies API-level filtering by role with confidence tier mapping (lines 634-639). See A-W2 above for edge cases that still need Technical Design clarification. |
| **W4: Pagination for audit events** | Resolved | Architecture specifies cursor-based pagination on BIGSERIAL id with `(application_id, id)` index (line 497). |
| **S1: Formal mocked service contracts** | Resolved | Architecture defines Protocol classes in a `contracts/` directory with factory injection (lines 847-887). |
| **S2: Agent processing failure behavior** | Resolved | Architecture specifies `processing_error` status, audit trail recording, and retry via `POST /v1/applications/:id/retry` returning 202 (lines 569-574). |
| **S3: Calculator as stateless API endpoint** | Resolved | Architecture defines three calculator POST endpoints in the public tier (lines 356-360). |

All nine findings from my Phase 2 product plan review have been addressed. The auth token resolution (C1) and streaming transport specification (C2) -- the two critical items that drove my NEEDS_DISCUSSION verdict -- are both resolved cleanly.

## Phase 4 Advisory Memo Recommendations -- Adoption

| Advisory Section | Adopted? | Notes |
|-----------------|----------|-------|
| **1. API Surface Groupings** | Yes | Endpoint group table (lines 584-594) matches advisory structure. All groups present with correct auth tiers. |
| **2. Auth Middleware Pattern** | Yes | Three-layer chain (key resolver, role asserter, audit injector) matches advisory exactly. `AuthContext` dataclass with dependency injection (lines 686-696). |
| **3. Async Document Processing** | Yes | 201 return with polling pattern adopted (line 616). |
| **4. Streaming Chat (SSE)** | Yes | POST with `Accept: text/event-stream` adopted (line 589). See A-W1 for documentation note. Advisory's SSE event type taxonomy (token, tool_use, tool_result, done) is not in the architecture -- appropriate for Technical Design. |
| **5. Audit Trail API Pattern** | Yes | Read-only, cursor-based pagination on monotonic id adopted. Architecture uses BIGSERIAL which satisfies the monotonic requirement. |
| **6. Mocked Service Contracts** | Yes | Protocol classes with factory injection adopted exactly as recommended. Directory structure matches (`contracts/`, `services/mocks/`, `services/real/`). |
| **7. Versioning** | Yes | `/v1/` prefix on all versioned routes. Health endpoints unversioned. Single version at MVP. |

All seven advisory sections were adopted. No significant divergences. The architecture correctly deferred SSE event type taxonomy details to Technical Design.

## Cross-References

No other teammate reviews were available at the time of this review. If findings from the Security Engineer or Backend Developer reviews conflict with or reinforce findings here, the orchestrator cross-cutting review should reconcile them.

Of note: the Security Engineer is reviewing in parallel (task #1). Given the auth token and PII handling patterns in the architecture, I expect alignment on ADR-002 (server-side role resolution). If the Security Engineer flags any API-surface concerns (e.g., SSE connection hijacking, rate limiting gaps, or CORS policy for public endpoints), those should be cross-referenced with this review's A-W1 (SSE documentation) and A-P1 (public/protected boundary).

## Summary

The architecture document is well-designed from an API perspective. All nine findings from my Phase 2 product plan review are addressed, and all seven advisory memo recommendations were adopted. The API surface groupings, public/protected boundary enforcement, async patterns, response envelope, financial serialization, and mocked service abstraction are all consistent with project conventions and appropriate for the architecture level of detail. The two warnings (SSE documentation needs and review queue edge cases) are minor items for the Technical Design phase. The architecture provides a solid foundation for writing the OpenAPI specification. Verdict: APPROVE.
