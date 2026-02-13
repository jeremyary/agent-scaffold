<!-- This project was developed with assistance from AI tools. -->

# Product Plan Review -- API Designer

**Reviewer:** API Designer
**Artifact:** plans/product-plan.md
**Date:** 2026-02-12

## Verdict: NEEDS_DISCUSSION

The product plan is strong overall but has several gaps that will create ambiguity when designing API contracts. Two items require clarification before API design can proceed confidently: the authentication token format's interaction with standard Bearer token conventions, and the lack of specification for real-time/streaming transport. The remaining findings are addressable during the Architecture or Technical Design phases but should be acknowledged now so they are not missed.

## Findings

### Critical

**C1: Authentication token format conflicts with API conventions.**

The Stakeholder-Mandated Constraints section specifies `Authorization: Bearer <role>:<key>` (line 558). This embeds authorization data (the role) into the authentication credential. Our `api-conventions.md` specifies standard `Authorization: Bearer <token>` semantics, where the token is opaque to the client and the server resolves identity and permissions from it.

Embedding the role in the token means:
- The client selects its own role at request time, which is a privilege escalation vector unless the server independently validates the role claim against the key.
- API documentation must explain a non-standard token format, which hurts developer experience for Alex (P1 persona).
- It deviates from standard OAuth/JWT Bearer token semantics that developers expect.

The plan should clarify: is the role in the token purely for server-side lookup (the key maps to a user who has that role, and the role prefix is just a routing hint), or can a user present different roles with the same key? If the former, the format is unusual but workable. If the latter, it is a security concern that the Security Engineer should evaluate.

**Recommendation:** Clarify the semantics of the `<role>:<key>` format. At minimum, state that the server MUST validate the role claim against the key's actual permissions. Ideally, reconsider whether the role needs to be in the token at all -- the server can resolve permissions from the key alone.

---

**C2: Real-time transport for streaming chat is unspecified.**

The plan includes "Streaming chat responses" (P1) where "chat responses from the intake agent [are] delivered incrementally so users see text appearing in real time" (line 157). It also mentions "workflow status" updates and a review queue.

The plan does not specify the transport mechanism. From an API design perspective, this matters because:
- Server-Sent Events (SSE) is a fundamentally different API contract than WebSockets or HTTP long-polling.
- SSE works cleanly with REST conventions (it is just a GET endpoint with `text/event-stream` content type). WebSockets require a separate protocol upgrade and do not fit into OpenAPI specs natively.
- The "Won't Have" section says "Real-time collaborative editing (UI uses polling for status updates)" (line 196), which implies the plan intends polling for workflow status but streaming for chat. This split needs to be explicit so API contracts are designed correctly.

**Recommendation:** Specify the intended transport for streaming chat (SSE is the recommendation given the REST-first architecture). Confirm that workflow status updates use polling (which aligns with the Won't Have statement). This distinction directly affects the OpenAPI spec structure.

### Warning

**W1: Audit trail "append-only, no updates or deletes" creates an API design constraint that needs acknowledgment.**

The plan states audit records are "Append-only -- no updates or deletes" (line 131, line 288). This means the audit trail API should expose only `GET` (list/detail) and possibly `POST` (for the export action). The `PUT`, `PATCH`, and `DELETE` methods must be explicitly absent.

This is fine and appropriate for the domain, but it departs from the standard CRUD resource pattern in `api-conventions.md`. The API spec will need to document this as an intentional design choice. Additionally, the audit trail export (P2, line 167) implies a separate action endpoint (e.g., `POST /v1/applications/:id/audit-trail/export`) rather than a resource, which is an action-oriented pattern that needs careful naming to stay consistent with resource-oriented conventions.

**Recommendation:** During API design, define the audit trail as a read-only sub-resource of applications (`GET /v1/applications/:id/audit-events`) with a separate action for export. Document the immutability constraint explicitly in the OpenAPI spec.

---

**W2: Document upload lifecycle needs clearer API surface definition.**

The plan describes document upload as part of the loan application flow (Flow 1, steps 3-5). Documents are uploaded, classified, and processed. But the plan does not clarify:
- Is document upload a synchronous operation (upload returns immediately with a document ID, processing happens asynchronously)?
- How does the client learn that document processing is complete? Polling the application status? A dedicated document status endpoint?
- The "Application document resubmission workflow" (P2, line 177) implies documents can be added to an existing application mid-workflow. Does this use the same upload endpoint or a different one?

This matters for API design because synchronous upload with asynchronous processing requires a status polling pattern (or webhook/SSE notification), which is a different contract than synchronous upload-and-process.

**Recommendation:** Clarify that document upload is asynchronous (upload returns 201 with document metadata, processing status is queryable separately). This is almost certainly the intended design given that document analysis involves LLM calls, but it should be stated explicitly.

---

**W3: The role hierarchy's API enforcement boundaries are underspecified.**

The role model (line 345-349) defines three roles with hierarchical permissions, but the permission boundaries are described in terms of capabilities, not API operations. For example:
- `loan_officer` can do "standard application processing, review of medium-confidence escalations"
- `senior_underwriter` adds "review of low-confidence escalations"
- `reviewer` adds "audit trail export, compliance reports, threshold configuration, knowledge base management"

For API design, I need to know: does "review of medium-confidence escalations" mean the API filters the review queue by confidence level per role, or does the API return all escalations and the UI filters? This affects whether the API needs role-aware query behavior or just endpoint-level access control.

**Recommendation:** During Technical Design, specify whether role-based filtering is an API responsibility (the API returns different result sets based on role) or a UI responsibility (the API returns everything the user can access and the UI filters). For the review queue specifically, API-level filtering is strongly recommended to prevent data leakage.

---

**W4: Pagination requirements for key list endpoints are implicit.**

The plan mentions several list-style interactions that will need pagination:
- Application list on the dashboard (Flow 1, step 1)
- Review queue with filtering by priority and status (line 135)
- Audit trail events for an application (Flow 2, steps 2-3)
- Chat message history for the intake agent (cross-session context, line 471)

Our `api-conventions.md` specifies cursor-based pagination as the default. The plan does not discuss expected data volumes, but the audit trail (which is append-only and grows monotonically) is the most likely candidate for large result sets.

**Recommendation:** No action needed in the product plan itself, but note for Technical Design: audit trail event lists should use cursor-based pagination. Application lists and review queues can likely use either cursor or offset pagination given MVP data volumes.

### Suggestion

**S1: Define the mocked service interface contract expectations more precisely.**

The plan states each mocked service "implements the same interface that its real counterpart would use" (line 370). This is exactly right for API design -- it means we should define OpenAPI specs for the mocked service interfaces (Credit Bureau, Property Data, Employment Verification, Email Notifications) as internal contracts.

The plan would benefit from explicitly stating that these internal service interfaces should be formally specified (even if as internal OpenAPI specs or typed Python interfaces), not just informally mocked. This prevents drift between mock and real implementations.

**Recommendation:** Add a note that mocked service interfaces should have formal contract definitions (e.g., typed Python Protocol classes or internal OpenAPI specs). This is a small addition that significantly improves the "swap to real service" developer experience.

---

**S2: Consider specifying the error response behavior for agent processing failures.**

The plan covers the happy path and human-escalation path well, but does not describe what happens when an agent fails (e.g., LLM API timeout, credit bureau mock returns an error, document extraction fails entirely). From an API perspective:
- Does the application status change to an error state?
- Can the user retry the processing?
- Are partial results preserved or discarded?

The NFR section mentions "Transient failures from external AI services are retried automatically before reporting failure" (line 281), which is good, but the user-facing behavior after retries are exhausted is not specified.

**Recommendation:** Add a brief note on the expected API behavior when agent processing fails after retries. A reasonable default: the application moves to a "processing_error" status, the error is logged in the audit trail, and the user can retry via an action endpoint.

---

**S3: The mortgage calculator could be specified as a stateless API resource.**

The mortgage calculator (P1, line 151) is described as both a "standalone UI widget" and a "tool available to the intake agent." This implies it should be an API endpoint as well, usable by both the UI and the chat agent internally.

Since it is purely computational (no state, no database), it maps cleanly to a stateless `POST /v1/calculators/mortgage` endpoint (or similar) that takes inputs and returns calculations. This is worth calling out because it is a public-tier endpoint (no auth required) that differs from typical CRUD patterns.

**Recommendation:** During API design, model the mortgage calculator as a stateless computation endpoint in the public tier. This keeps it consistent with "all functionality accessible via API" (line 137).

### Positive

**P1: The public vs. protected access tier split is clearly defined and API-friendly.**

The Security Considerations section (lines 328-339) cleanly separates public endpoints (chat, calculator, rates, property lookups) from protected endpoints (application management, review queue, admin). This maps directly to two API surface areas with different auth requirements, rate limiting, and documentation sections. This clarity will make the OpenAPI spec clean and the developer experience straightforward.

---

**P2: MoSCoW prioritization is well-applied and avoids scope confusion.**

The feature scope is organized by priority (P0/P1/P2) with clear descriptions. No feature description contains technology mandates -- technology choices are properly isolated in the Stakeholder-Mandated Constraints section. This separation means API design can focus on the resource model and user flows without being distracted by implementation choices.

---

**P3: The "Won't Have" section is specific and actionable.**

Items like "Real-time collaborative editing (UI uses polling for status updates)" (line 196) and "API key authentication" (line 192) directly inform API design decisions. A vague "Won't Have" list would leave ambiguity; this one removes it.

---

**P4: User flows are concrete enough to derive API contracts.**

The four user flows (lines 205-259) describe step-by-step interactions that translate fairly directly to API call sequences. For example, Flow 1 implies: POST application -> POST documents (multipart upload) -> PATCH application (submit) -> GET application (poll status) -> GET review-queue -> PATCH review (approve/deny/request-docs). This level of specificity is ideal for downstream API design.

---

**P5: Mocked service design with "same interface" principle is excellent for API contracts.**

The explicit statement that mocks implement "the same interface that its real counterpart would use" and "the mock is a different implementation, not a different interface" (line 370) is the right pattern. It means API contracts for external service boundaries are first-class artifacts, enabling clean swap-in of real services.

## Cross-References from Teammate Reviews

### Architect Review

The Architect's review (`plans/reviews/product-plan-review-architect.md`, verdict: REQUEST_CHANGES) identified two phasing dependency issues that directly affect API design:

1. **Human-in-the-loop review deferred to Phase 4 but confidence-based routing starts in Phase 2.** This means the review queue API endpoints (which my finding W3 discusses in terms of role-based filtering) would need to exist earlier than Phase 4. If the routing logic sends medium/low-confidence applications to a review queue in Phase 2, the review queue API contract must be designed and implemented by Phase 2 as well. This reinforces W3: the review queue API surface needs to be scoped and designed early.

2. **Audit trail deferred to Phase 3 but auditable events begin in Phase 1.** This directly affects my finding W1 (audit trail API design). If the audit trail infrastructure is foundational from Phase 1 (as the Architect recommends), the audit trail API contract (`GET /v1/applications/:id/audit-events`) should also be designed in Phase 1, not deferred. The append-only, read-only API pattern I described in W1 becomes a Phase 1 deliverable, not a Phase 3 one.

Both of these phasing issues strengthen the case for my NEEDS_DISCUSSION verdict. The API surface cannot be cleanly designed if the phasing of its backing features is inconsistent.

### Security Engineer Review

The Security Engineer's review (`plans/reviews/product-plan-review-security-engineer.md`, verdict: REQUEST_CHANGES) confirms and extends the auth token finding:

1. **Three-way convergence on auth token format.** The Security Engineer's C1 independently identifies the `Bearer <role>:<key>` privilege escalation vector -- the same issue flagged by my C1 and the Architect's W-5. All three reviewers agree: the client-asserted role in the token is a security risk. This is now the highest-confidence finding across all reviews and should be resolved before Technical Design proceeds.

2. **Document upload security.** The Security Engineer flagged document upload attack surface (malicious file uploads, filename-based attacks). This reinforces my W2 (document upload lifecycle): the upload API contract must include file type validation, size limits, and filename sanitization as part of the request/response specification, not just implementation details. These constraints should be documented in the OpenAPI spec (e.g., `maxLength` on filename, `enum` on accepted content types).

3. **Audit trail immutability enforcement.** The Security Engineer flagged that the plan states immutability but does not specify enforcement mechanism. From an API perspective, this reinforces W1: the audit trail API must not expose `PUT`, `PATCH`, or `DELETE` methods, and the OpenAPI spec should document that these methods return 405 Method Not Allowed. The enforcement at the database/infrastructure level is an architecture concern, but the API contract must reflect the constraint.

## Summary

The product plan provides a solid foundation for API design. The two critical findings -- the non-standard auth token format and the unspecified streaming transport -- need resolution before API contracts can be finalized, as they affect the structure of the OpenAPI spec and the authentication middleware design. The auth token format (`Bearer <role>:<key>`) was independently flagged as a risk by all three reviewers (API Designer C1, Architect W-5, Security Engineer C1), making it the highest-confidence finding across all reviews. The Architect's phasing dependency findings (review queue and audit trail phased too late) compound the warnings in this review: the review queue API (W3) and audit trail API (W1) need earlier phasing than currently planned. The Security Engineer's document upload and audit immutability findings reinforce the need for explicit API-level constraints in the OpenAPI spec. The plan's clear access tier separation, concrete user flows, and disciplined scope boundaries are strengths that will make API design significantly easier once the critical items are resolved.
