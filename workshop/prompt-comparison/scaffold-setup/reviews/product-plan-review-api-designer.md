# Product Plan Review: Report Scheduling (API Designer)

**Reviewer:** API Designer
**Date:** 2026-02-10
**Artifact:** `/home/jary/redhat/git/claude-collective-example/plans/product-plan.md`

## Verdict

**APPROVE WITH SUGGESTIONS**

The product plan is well-structured and maintains clean separation between product concerns and implementation details. The feature scope implies a straightforward API surface area with clear resource boundaries. Minor clarifications would help downstream API contract design.

## Product Plan Review Checklist

| Check | Result | Notes |
|-------|--------|-------|
| **No technology names in feature descriptions** | PASS | Feature descriptions focus on capabilities. Technology choices properly isolated in Stakeholder-Mandated Constraints section. |
| **MoSCoW prioritization used** | PASS | Features clearly categorized as Must/Should/Could/Won't. |
| **No epic or story breakout** | PASS | No implementation decomposition, dependency graphs, or agent assignments present. |
| **NFRs are user-facing** | PASS | NFRs framed as user expectations ("feels immediate", "arrives within reasonable window") rather than technical metrics. |
| **User flows present** | PASS | Four comprehensive user flows covering creation, management, failure investigation, and admin oversight. |
| **Phasing describes capability milestones** | PASS | Each phase describes system capabilities, not implementation units. |

## Findings

### INFO-1: Implied API Resources

The feature scope implies the following top-level API resources:

1. **Schedules** (`/schedules`) — CRUD for report schedules with pause/resume operations
2. **Schedule Runs** (`/schedules/:id/runs` or `/schedule-runs`) — Delivery history and status for a schedule
3. **Report Types** (`/report-types`) — Read-only catalog of available reports that can be scheduled

Nested sub-resource vs. top-level resource decision for runs depends on query patterns (e.g., "show me all failed runs across all schedules" suggests top-level `/schedule-runs?status=failed`).

### SUGGESTION-1: Clarify "Recipient Management" Scope

Feature describes "Users can add and remove email recipients" but user flows show only email address input. API contract questions:

- Are recipients stored as simple email strings, or as references to user accounts?
- If stored as strings, is there any validation beyond email format (e.g., domain whitelist)?
- Does "remove recipient" mean deleting from a future run, or also retroactively from history?

Recommendation: Tech Lead should specify whether recipients are primitive strings or references to a user directory during technical design.

### SUGGESTION-2: "Pause/Resume" Implies State Machine

Schedule management includes "pause" and "resume" operations. This implies at minimum two states (active/paused), possibly more (draft, active, paused, archived, failed).

API design consideration: Use a `status` field with enumerated values rather than boolean flags (avoids the "isPaused and isActive both true" trap). Consider whether state transitions need explicit validation (e.g., can you resume a deleted schedule?).

### INFO-2: List Endpoint Filtering and Sorting Needs

User flows imply the following list query patterns:

- **My Schedules list**: Filter by owner (implicit from auth), status (active/paused), sort by next delivery time or last delivery status
- **Admin dashboard**: Filter by owner, report type, status; likely needs pagination for large organizations
- **Delivery history**: Filter by schedule, status (success/failure), date range; sort by timestamp descending

Standard cursor-based pagination should suffice unless history logs grow very large per schedule.

### SUGGESTION-3: "Delivery Status Visibility" Data Contract

Feature includes "Users can see whether each scheduled run succeeded or failed" but doesn't specify:

- Is status binary (success/fail) or enumerated (pending, running, success, failed, retrying)?
- What metadata accompanies a failed run (error message, retry count, timestamp)?
- Is there a distinction between "report generation failed" and "email delivery failed"?

These details don't need to be in the product plan, but Tech Lead should define a concrete `ScheduleRun` schema that covers success, failure, and in-progress states.

### INFO-3: Timezone Handling Convention

Feature includes "Schedules run according to the owner's configured timezone." API contracts should:

- Store all timestamps in UTC in the database (standard practice)
- Accept timezone as IANA timezone identifier (e.g., `America/New_York`) in the schedule creation request
- Return `nextDeliveryTime` in responses as an ISO 8601 timestamp with timezone offset for client display

No product plan change needed — this is implementation guidance for Tech Lead.

### SUGGESTION-4: Admin Reassignment Implies Ownership Transfer Endpoint

User Flow 4 includes "Admin can reassign a schedule to a new owner." This implies either:

- A `PATCH /schedules/:id` with `ownerId` field (general-purpose), or
- A dedicated `POST /schedules/:id/transfer` endpoint (explicit operation)

Given that ownership transfer has authorization implications (only admins can do it), consider making it an explicit operation rather than overloading the generic update endpoint.

## API-Relevant Observations

### Resource Modeling

The feature naturally decomposes into:

- **Schedule** (noun): The configuration (report type, cadence, recipients, timezone, owner)
- **ScheduleRun** (noun): A historical record of a single execution (timestamp, status, delivered recipients, errors)
- **ReportType** (noun): Metadata about available report types (read-only reference data)

This maps cleanly to RESTful resource design. No complex nested relationships or many-to-many joins implied.

### Write Operations

| Operation | HTTP Method | Likely Endpoint |
|-----------|-------------|----------------|
| Create schedule | POST | `/schedules` |
| Update schedule | PATCH | `/schedules/:id` |
| Pause schedule | PATCH | `/schedules/:id` (set `status: "paused"`) or POST `/schedules/:id/pause` |
| Resume schedule | PATCH | `/schedules/:id` (set `status: "active"`) or POST `/schedules/:id/resume` |
| Delete schedule | DELETE | `/schedules/:id` |
| Transfer ownership | POST | `/schedules/:id/transfer` (admin-only) |

Prefer PATCH with status field over dedicated pause/resume endpoints unless there's a need to include a reason or timestamp in the request.

### Authorization Layers

The feature implies three permission levels:

1. **Owner**: Can view, edit, pause, resume, delete their own schedules
2. **Admin**: Can view, edit, pause, resume, delete, reassign any schedule in the account
3. **Recipient**: Can view delivery history for schedules where they are a recipient (P1 feature "in-app notifications" implies this)

These map to standard role-based access control. No complex attribute-based authorization needed.

### Open Questions for Tech Lead

1. Should `/schedules/:id/runs` be nested under schedules, or should runs be a top-level resource with a `scheduleId` filter?
2. Are "pause" and "resume" modeled as status updates, or as separate operations with audit trails?
3. Should recipients be normalized into a separate table, or stored as a JSON array of email strings in the schedule record?
4. What is the retention policy for schedule runs (affects pagination and query performance)?

These are technical design questions, not product gaps.

## Summary

The product plan provides a clear foundation for API design. Feature scope is well-bounded, user flows reveal the necessary read/write patterns, and NFRs are appropriately user-facing. The suggestions above are minor clarifications that will streamline downstream technical design — none block moving forward.

The implied API surface area is straightforward: three resources (schedules, runs, report-types), standard CRUD operations, and no complex relationships. This is a good candidate for contract-first development using OpenAPI specifications.

**Recommendation:** Proceed to technical design phase. Tech Lead should define concrete JSON schemas for Schedule, ScheduleRun, and ReportType resources, specify state machine transitions for schedule status, and document authorization rules per endpoint.
