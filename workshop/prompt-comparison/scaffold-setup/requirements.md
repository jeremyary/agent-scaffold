# Requirements: Report Scheduling (Phase 1)

**Author:** Requirements Analyst
**Date:** 2026-02-10
**Input:** Product Plan (validated), Architecture (validated)
**Scope:** Phase 1 — Core Scheduling (8 P0 features)

---

## 1. Overview

Phase 1 delivers a self-service report scheduling feature that allows users to create, manage, and monitor recurring report deliveries via email. Users select a report type, define a delivery cadence (daily, weekly, or monthly), add email recipients, and have the system automatically generate and deliver reports on schedule. The system provides visibility into delivery status and allows users to pause, resume, edit, and delete schedules.

---

## 2. User Stories and Acceptance Criteria

### US-001: Select Report Type

**As a** report owner (Maya),
**I want to** choose from available report types when creating a schedule,
**so that** I can automate delivery of the specific reports my team needs.

**Acceptance Criteria:**

- **Given** I am authenticated and navigated to the schedule creation page,
  **when** I view the report type selection field,
  **then** I see a list of all available report types with their names and descriptions.

- **Given** I am authenticated and creating a schedule,
  **when** I select a report type and proceed,
  **then** the system validates that the report type exists and is available for scheduling.

- **Given** I am creating a schedule with a report type that does not exist (invalid ID),
  **when** I attempt to submit the form,
  **then** the system returns a 422 error with a message "Report type not found" and the schedule is not created.

- **Given** the report types list is empty,
  **when** I navigate to the schedule creation page,
  **then** the system displays a message "No report types available for scheduling" and disables the create schedule button.

---

### US-002: Configure Delivery Cadence

**As a** report owner,
**I want to** set a delivery frequency (daily, weekly, or monthly) with a specific time and day,
**so that** my team receives reports on a predictable schedule that matches their workflow.

**Acceptance Criteria:**

- **Given** I am creating a schedule,
  **when** I configure the cadence,
  **then** I can select from three frequency options: Daily, Weekly, or Monthly.

- **Given** I select a daily cadence,
  **when** I configure the time,
  **then** I specify a time of day (HH:MM in 24-hour format or 12-hour with AM/PM) and the system stores it in my configured timezone.

- **Given** I select a weekly cadence,
  **when** I configure the schedule,
  **then** I specify a day of the week (Monday through Sunday) and a time of day.

- **Given** I select a monthly cadence,
  **when** I configure the schedule,
  **then** I specify a day of the month (1-31) and a time of day.

- **Given** I configure a monthly schedule for the 31st day,
  **when** the schedule runs in a month with fewer than 31 days (e.g., February, April),
  **then** the system delivers the report on the last day of that month.

- **Given** I submit a schedule with an invalid time format (e.g., "25:00", "abc"),
  **when** the system validates my input,
  **then** the system returns a 422 error with field-level validation: "Invalid time format. Expected HH:MM."

- **Given** I submit a monthly schedule with a day value outside 1-31,
  **when** the system validates my input,
  **then** the system returns a 422 error: "Day of month must be between 1 and 31."

- **Given** I have successfully created a schedule,
  **when** I view the schedule summary,
  **then** I see the next scheduled delivery date and time displayed in my local timezone.

---

### US-003: Manage Recipients

**As a** report owner,
**I want to** add and remove email recipients for a schedule,
**so that** the right people receive the reports without manual distribution.

**Acceptance Criteria:**

- **Given** I am creating or editing a schedule,
  **when** I add a recipient,
  **then** I enter an email address and the system validates it against RFC 5322 format.

- **Given** I submit an invalid email address (e.g., "notanemail", "user@", "@domain.com"),
  **when** the system validates my input,
  **then** the system returns a 422 error with the message "Invalid email address format: [email]."

- **Given** I am creating a schedule,
  **when** I add multiple recipients,
  **then** the system accepts up to 50 unique email addresses.

- **Given** I attempt to add a 51st recipient to a schedule,
  **when** the system validates my input,
  **then** the system returns a 422 error: "Maximum 50 recipients per schedule. Remove recipients to add more."

- **Given** I am editing a schedule with existing recipients,
  **when** I remove a recipient,
  **then** the recipient is marked as `is_active=false` in the database (soft delete) and excluded from future deliveries, but past delivery history for that recipient is retained.

- **Given** I remove all recipients from a schedule,
  **when** I attempt to save the schedule,
  **then** the system returns a 422 error: "At least one recipient is required."

- **Given** I add the same email address twice,
  **when** the system validates recipients,
  **then** the system deduplicates and stores only one entry.

- **Given** a recipient's email address is on the schedule,
  **when** I view the schedule detail,
  **then** I see a list of all active recipients.

---

### US-004: Deliver Reports via Email

**As a** report owner,
**I want to** have the system automatically generate and deliver scheduled reports to recipients via email,
**so that** I do not have to manually run and distribute reports.

**Acceptance Criteria:**

- **Given** a schedule is active and its `next_run_at` time has passed,
  **when** the tick task runs (every 60 seconds),
  **then** the system selects the schedule, creates a `ScheduleRun` with status `pending`, computes the next `next_run_at`, and dispatches an `execute_schedule` task.

- **Given** the execute task receives a run ID,
  **when** the task calls the `ReportGenerator.generate()` protocol,
  **then** the system attempts to generate the report and updates the run status to `generating`.

- **Given** report generation succeeds,
  **when** the execute task completes,
  **then** the system updates the run status to `generated` and dispatches a `deliver_report` task.

- **Given** report generation fails (timeout, report type unavailable),
  **when** the execute task handles the failure,
  **then** the system updates the run status to `generation_failed`, stores a human-readable error message, and does NOT dispatch the deliver task.

- **Given** the deliver task receives a run ID and generated report,
  **when** the task sends emails to all active recipients,
  **then** the system calls `EmailSender.send()` for each recipient with the report as an attachment.

- **Given** email delivery succeeds for all recipients,
  **when** the deliver task completes,
  **then** the system updates the run status to `delivered`.

- **Given** email delivery fails for some recipients (mailbox not found, SMTP error),
  **when** the deliver task completes,
  **then** the system updates the run status to `partially_delivered` and records which recipients succeeded and which failed with per-recipient error messages.

- **Given** email delivery fails for all recipients,
  **when** the deliver task completes,
  **then** the system updates the run status to `delivery_failed` and records per-recipient error messages.

- **Given** an email is sent to a recipient,
  **when** the recipient receives the email,
  **then** the email contains:
    - Subject line: "[Report Name] - [Cadence Summary]" (e.g., "Sales Summary - Weekly Monday 9:00 AM EST")
    - Body: Brief description of the report
    - Attachment: The generated report file
    - Footer: "You are receiving this report because [owner name] added you to a scheduled delivery. To stop receiving this report, contact [owner name] or your account administrator."

- **Given** the tick task encounters a database connection error,
  **when** the task exits with an error,
  **then** the transaction is rolled back, no schedules are marked as claimed, and the next tick (60 seconds later) retries the same schedules.

---

### US-005: View and Edit Schedules

**As a** report owner,
**I want to** view all my schedules in a central list and edit their configuration,
**so that** I can adjust cadence, recipients, or timezone as my team's needs change.

**Acceptance Criteria:**

- **Given** I am authenticated,
  **when** I navigate to "My Schedules",
  **then** I see a paginated list of all schedules I own, showing: report name, cadence summary, next delivery time, last run status, and active/paused state.

- **Given** I have more than 20 schedules,
  **when** I view the schedule list,
  **then** the system paginates results with a default limit of 20 and provides cursor-based pagination controls.

- **Given** I click on a schedule in the list,
  **when** the schedule detail page loads,
  **then** I see: report type, full cadence configuration (frequency, day, time, timezone), list of recipients, next delivery time, and delivery history.

- **Given** I am viewing a schedule I own,
  **when** I click "Edit",
  **then** I can modify the cadence, recipients, or timezone and save the changes.

- **Given** I edit a schedule's cadence,
  **when** I save the changes,
  **then** the system recomputes `next_run_at` based on the new cadence, timezone, and current time, and the updated next delivery time is displayed.

- **Given** I edit a schedule's timezone,
  **when** I save the changes,
  **then** the system recomputes `next_run_at` to preserve the local schedule time in the new timezone.

- **Given** I attempt to edit a schedule I do not own (not the owner and not an admin),
  **when** the system validates authorization,
  **then** the system returns a 403 error: "You do not have permission to modify this schedule."

- **Given** I view a schedule with no delivery history,
  **when** the schedule detail page loads,
  **then** the delivery history section displays "No deliveries yet. Next delivery: [date/time]."

---

### US-006: Pause and Resume Schedules

**As a** report owner,
**I want to** pause a schedule to stop future deliveries without deleting the configuration,
**so that** I can temporarily disable a report during a project hiatus or organizational change.

**Acceptance Criteria:**

- **Given** I am viewing an active schedule I own,
  **when** I click "Pause",
  **then** the system updates the schedule status to `paused` and the schedule is excluded from the tick task's due schedule query.

- **Given** a schedule is paused,
  **when** the tick task runs,
  **then** the schedule is NOT selected for execution (status filter excludes `paused`).

- **Given** I am viewing a paused schedule I own,
  **when** I click "Resume",
  **then** the system updates the schedule status to `active`, recomputes `next_run_at` based on the current time and cadence, and includes the schedule in future tick queries.

- **Given** I pause a schedule while a delivery is in progress,
  **when** the pause operation completes,
  **then** the in-progress delivery completes normally (the pause does not cancel running tasks), but no new runs are created after completion.

- **Given** I resume a paused schedule,
  **when** the next tick task runs and the `next_run_at` is due,
  **then** the schedule executes normally.

- **Given** I attempt to pause a schedule I do not own,
  **when** the system validates authorization,
  **then** the system returns a 403 error: "You do not have permission to modify this schedule."

---

### US-007: Delete Schedules

**As a** report owner,
**I want to** delete a schedule when I no longer need it,
**so that** I can remove obsolete schedules and keep my schedule list clean.

**Acceptance Criteria:**

- **Given** I am viewing a schedule I own (active or paused),
  **when** I click "Delete",
  **then** the system displays a confirmation prompt: "Are you sure you want to delete this schedule? Past delivery history will be retained."

- **Given** I confirm deletion,
  **when** the system processes the request,
  **then** the schedule status is updated to `deleted` (soft delete), the schedule is excluded from all queries (list and tick), and past delivery history remains accessible.

- **Given** I cancel the deletion prompt,
  **when** I return to the schedule detail page,
  **then** the schedule remains unchanged (active or paused).

- **Given** I attempt to delete a schedule I do not own,
  **when** the system validates authorization,
  **then** the system returns a 403 error: "You do not have permission to delete this schedule."

- **Given** a schedule is deleted,
  **when** I view "My Schedules",
  **then** the deleted schedule does NOT appear in the list.

- **Given** a schedule is deleted,
  **when** the tick task runs,
  **then** the schedule is NOT selected for execution (soft-deleted rows are excluded via status filter).

- **Given** I delete a schedule while a delivery is in progress,
  **when** the delete operation completes,
  **then** the in-progress delivery completes normally (deletion does not cancel running tasks), but no new runs are created after completion.

---

### US-008: View Delivery Status

**As a** report owner,
**I want to** see whether each scheduled delivery succeeded or failed,
**so that** I know my team is receiving the reports and can take corrective action if a delivery fails.

**Acceptance Criteria:**

- **Given** I am viewing a schedule detail page,
  **when** I view the delivery history section,
  **then** I see a paginated list of past runs with: run date/time, status (delivered, partially delivered, delivery failed, generation failed), and a link to view details.

- **Given** I click on a run in the delivery history,
  **when** the run detail page loads,
  **then** I see: run status, start time, completion time, report generation outcome, and per-recipient delivery results.

- **Given** a run has status `delivered`,
  **when** I view the run detail,
  **then** I see a list of all recipients with status "Sent" and the timestamp of successful delivery.

- **Given** a run has status `partially_delivered`,
  **when** I view the run detail,
  **then** I see a list of recipients with per-recipient status: "Sent" for successful deliveries and "Failed: [error message]" for failures (e.g., "Failed: Mailbox not found").

- **Given** a run has status `delivery_failed`,
  **when** I view the run detail,
  **then** I see a list of all recipients with status "Failed: [error message]" for each.

- **Given** a run has status `generation_failed`,
  **when** I view the run detail,
  **then** I see: "Report generation failed: [error message]" (e.g., "Report generation timed out") and no recipient delivery information.

- **Given** I view the schedule list,
  **when** I see the "Last Run Status" column,
  **then** successful runs display a success indicator, failed runs display a failure indicator with the failure type (generation or delivery).

- **Given** a delivery fails,
  **when** I view the run detail within 1 business day,
  **then** I have access to sufficient information (error message, affected recipients) to diagnose and resolve the issue without contacting support.

---

### US-009: Timezone Support

**As a** report owner,
**I want to** configure schedules in my local timezone,
**so that** "9:00 AM" means 9:00 AM in my timezone regardless of daylight saving time transitions.

**Acceptance Criteria:**

- **Given** I am creating a schedule,
  **when** I set the timezone,
  **then** the system defaults to my user profile's configured timezone (if available) and allows me to select any valid IANA timezone identifier (e.g., "America/New_York", "Europe/London").

- **Given** I submit a schedule with an invalid timezone identifier (e.g., "Invalid/Zone"),
  **when** the system validates my input,
  **then** the system returns a 422 error: "Invalid timezone. Expected a valid IANA timezone identifier."

- **Given** I configure a daily schedule for 9:00 AM in "America/New_York",
  **when** the schedule is created,
  **then** the system computes `next_run_at` as the next occurrence of 9:00 AM Eastern Time converted to UTC.

- **Given** a schedule is configured for 2:30 AM in a timezone that observes DST,
  **when** a DST transition skips that time (spring forward from 2:00 to 3:00),
  **then** the system advances to the next valid minute (3:00 AM) on the same day, per ADR-0004.

- **Given** a schedule is configured for 1:30 AM in a timezone that observes DST,
  **when** a DST transition repeats that time (fall back from 2:00 to 1:00),
  **then** the system executes the schedule once at the first occurrence of 1:30 AM (before the clock falls back).

- **Given** I view a schedule detail page,
  **when** I see the next delivery time,
  **then** it is displayed as a UTC ISO 8601 timestamp converted to my browser's local timezone for display.

- **Given** I view the schedule list,
  **when** I see the "Next Delivery" column,
  **then** all times are displayed in my local timezone.

- **Given** I change a schedule's timezone from "America/New_York" to "America/Los_Angeles",
  **when** the system recomputes `next_run_at`,
  **then** the schedule still runs at the same local time (e.g., 9:00 AM remains 9:00 AM, but the UTC value shifts by 3 hours).

---

### US-010: Authorization and Ownership

**As a** report owner,
**I want to** control access to my schedules,
**so that** only I (and account admins) can modify or delete them.

**Acceptance Criteria:**

- **Given** I create a schedule,
  **when** the schedule is saved,
  **then** the `owner_id` is set to my user ID and I am the owner.

- **Given** I am the owner of a schedule,
  **when** I attempt to view, edit, pause, resume, or delete it,
  **then** the system grants access.

- **Given** I am an authenticated user but NOT the owner of a schedule,
  **when** I attempt to edit, pause, resume, or delete it,
  **then** the system returns a 403 error: "You do not have permission to modify this schedule."

- **Given** I am an account admin,
  **when** I attempt to view, edit, pause, resume, or delete any schedule in my account (even if I am not the owner),
  **then** the system grants access.

- **Given** I am not authenticated,
  **when** I attempt to access any schedule endpoint,
  **then** the system returns a 401 error: "Authentication required."

- **Given** I am the owner of a schedule and my user account is deactivated,
  **when** the schedule's next run time arrives,
  **then** the schedule continues to execute normally (the tick task does not check owner account status).

- **Given** I am the owner of a schedule and my user account is deactivated,
  **when** I (or anyone) attempts to modify the schedule via the API,
  **then** the system returns a 403 error (because the owner cannot authenticate, and no one else has permission).

- **Given** I view "My Schedules",
  **when** the page loads,
  **then** I see only schedules I own (the query filters by `owner_id = my_user_id`).

- **Given** I am an account admin,
  **when** I view a schedule in the admin context (Phase 2 feature, not implemented in Phase 1),
  **then** I can see all schedules across the account (Phase 1 does not implement account-wide views).

---

## 3. Edge Cases and Boundary Conditions

### Monthly Schedule on the 31st

- **Given** a monthly schedule is configured for the 31st,
  **when** the schedule runs in February (28 or 29 days),
  **then** the system clamps the delivery to the last day of February.

- **Given** a monthly schedule is configured for the 31st,
  **when** the schedule runs in April (30 days),
  **then** the system delivers on April 30th.

### Timezone DST Transitions

- **Given** a schedule is configured for 2:30 AM in a DST-observing timezone,
  **when** DST spring forward skips 2:00-3:00 AM,
  **then** the system advances to the next valid minute (3:00 AM) on the same day, per ADR-0004.

- **Given** a schedule is configured for 1:30 AM in a DST-observing timezone,
  **when** DST fall back repeats 1:00-2:00 AM,
  **then** the system executes the schedule once at the first occurrence of 1:30 AM (before the clock repeats).

### Concurrent Schedule Modifications

- **Given** two users attempt to edit the same schedule simultaneously (e.g., owner and admin),
  **when** both submit changes,
  **then** the database uses optimistic locking or last-write-wins semantics, and the second write overwrites the first.

- **Given** the tick task is updating `next_run_at` for a schedule,
  **when** a user simultaneously edits the schedule's cadence,
  **then** the database row lock ensures one operation completes before the other (isolation level prevents dirty reads).

### Schedule with All Recipients Removed

- **Given** a schedule has 5 recipients,
  **when** the owner removes all 5 recipients,
  **then** the system rejects the change with a 422 error: "At least one recipient is required."

### Paused Schedule Behavior During Editing

- **Given** I pause a schedule,
  **when** I edit the schedule's cadence or recipients,
  **then** the changes are saved but the schedule remains paused (editing does not implicitly resume).

- **Given** I resume a paused schedule,
  **when** the system recomputes `next_run_at`,
  **then** the next run is computed from the current time, not from the time when the schedule was paused.

### Maximum Limits Reached

- **Given** I have 25 active schedules (the per-user limit),
  **when** I attempt to create a 26th schedule,
  **then** the system returns a 422 error: "Maximum 25 active schedules per user. Pause or delete a schedule to create a new one."

- **Given** I have 24 active schedules and 5 paused schedules,
  **when** I attempt to create a new schedule,
  **then** the system allows creation (only active schedules count toward the limit).

- **Given** a schedule has 50 recipients (the per-schedule limit),
  **when** I attempt to add a 51st recipient,
  **then** the system returns a 422 error: "Maximum 50 recipients per schedule."

### Delivery Failure for All Recipients

- **Given** all recipients on a schedule have invalid or unreachable email addresses,
  **when** the deliver task attempts to send emails,
  **then** all deliveries fail, the run status is `delivery_failed`, and the owner can see per-recipient error messages.

### Database Connection Failure During Tick

- **Given** the tick task queries for due schedules,
  **when** the database connection fails,
  **then** the task exits with an error, the transaction rolls back, and no schedules are marked as claimed (the next tick retries the same schedules 60 seconds later).

---

## 4. Cross-Cutting Requirements

### Authentication

- **Requirement:** All API endpoints except health checks (`/healthz`, `/readyz`) require a valid authentication token.
- **Mechanism:** The API validates tokens via FastAPI dependencies. The authentication system is assumed to exist (not part of this feature's scope).
- **Applies to:** All endpoints in US-001 through US-010.

### Authorization Model

- **Requirement:** Authorization is owner-based. Only the schedule owner or an account admin can modify a schedule.
- **Applies to:** US-005 (edit), US-006 (pause/resume), US-007 (delete), US-010 (ownership).
- **Implementation:** The API filters queries by `owner_id` and validates ownership on mutation operations. Admin role checks are performed via a FastAPI dependency.

### Timezone Handling

- **Requirement:** All schedule times are stored in the owner's local timezone (`schedule_time` + `timezone`). The `next_run_at` field is computed as UTC. The tick task operates purely in UTC.
- **Applies to:** US-002 (configure cadence), US-009 (timezone support).
- **Edge cases:** DST transitions (covered in Edge Cases section).

### Pagination

- **Requirement:** Lists with more than 20 items are paginated.
- **Applies to:** US-005 (schedule list), US-008 (delivery history).
- **Format:** Cursor-based pagination for schedules and runs. Response includes `nextCursor` and `hasMore` fields.

### Error Response Format

- **Requirement:** All error responses follow RFC 7807 Problem Details format.
- **Applies to:** All user stories.
- **Example:**
  ```json
  {
    "type": "https://api.example.com/errors/validation-failed",
    "title": "Validation Failed",
    "status": 422,
    "detail": "Invalid email address format: notanemail",
    "instance": "/v1/schedules"
  }
  ```

### Rate Limiting

- **Requirement:** Schedule creation and update operations are rate-limited to 10 requests per minute per user.
- **Applies to:** US-001, US-002, US-003, US-005.
- **Response:** When rate limit is exceeded, the API returns 429 with headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Soft Deletes

- **Requirement:** Schedules and recipients are soft-deleted (status flag or `is_active` boolean) rather than hard-deleted from the database.
- **Applies to:** US-007 (delete schedules), US-003 (remove recipients).
- **Rationale:** Preserves referential integrity with delivery history. Deleted schedules remain queryable for historical runs.

---

## 5. Non-Functional Requirements

### Delivery Timeliness

- **User Expectation:** Scheduled reports arrive within a reasonable window of the configured time.
- **Testable Criterion:** 95% of scheduled reports are delivered within 5 minutes of the scheduled time.
- **Measurement:** Compare `next_run_at` (expected) to `started_at` on `ScheduleRun` rows with status `delivered`.

### UI Responsiveness

- **User Expectation:** Creating, editing, and managing schedules feels immediate.
- **Testable Criterion:** All schedule CRUD operations complete and return a response within 2 seconds under normal load.
- **Measurement:** API endpoint latency (p95).

### Delivery Reliability

- **User Expectation:** Reports are delivered consistently; missed deliveries are rare.
- **Testable Criterion:** 98% of scheduled runs with status `delivered` or `partially_delivered` (not `generation_failed` or `delivery_failed`).
- **Measurement:** Ratio of successful runs to total runs over a 30-day period.

### Failure Transparency

- **User Expectation:** When a delivery fails, the owner knows about it promptly and can understand why.
- **Testable Criterion:** Failed runs (`generation_failed`, `delivery_failed`, `partially_delivered`) include human-readable error messages. The owner can view the failure within 1 business day (delivery history is queryable immediately after failure).
- **Measurement:** Manual verification that error messages are actionable (e.g., "Report generation timed out" vs. "Error 500").

### Scale with Team Growth

- **User Expectation:** The feature works smoothly as a team grows from a handful of schedules to dozens.
- **Testable Criterion:** The system supports 25 active schedules per user and 50 recipients per schedule without degradation in UI responsiveness or delivery timeliness.
- **Measurement:** Load testing with 100 users, each with 25 schedules, 50 recipients each, scheduled for overlapping delivery times.

### Data Integrity

- **User Expectation:** Schedule configurations are never silently lost or corrupted; changes are persisted reliably.
- **Testable Criterion:** All schedule mutations (create, update, delete) are wrapped in database transactions. Failed transactions roll back completely.
- **Measurement:** Code review verifies transaction boundaries. Integration tests verify rollback behavior on constraint violations.

---

## 6. State Machine Requirements

### Schedule Status State Machine

Valid states: `active`, `paused`, `deleted`

Valid transitions:

| From | To | Trigger | Acceptance Criteria |
|------|----|---------|--------------------|
| `active` | `paused` | User clicks "Pause" | Schedule is excluded from tick query; no new runs created |
| `paused` | `active` | User clicks "Resume" | `next_run_at` recomputed; schedule included in tick query |
| `active` | `deleted` | User confirms "Delete" | Schedule excluded from all queries; history retained |
| `paused` | `deleted` | User confirms "Delete" | Schedule excluded from all queries; history retained |

Invalid transitions: All other state changes are rejected with 409 Conflict.

**Acceptance Criteria:**

- **Given** a schedule is in state `active`,
  **when** the API receives a request to transition to `deleted` without pausing first,
  **then** the system allows the transition (direct delete from active is valid).

- **Given** a schedule is in state `deleted`,
  **when** the API receives a request to transition to `active` or `paused`,
  **then** the system returns a 409 error: "Cannot modify a deleted schedule."

### ScheduleRun Status State Machine

Valid states: `pending`, `generating`, `generated`, `delivering`, `delivered`, `partially_delivered`, `delivery_failed`, `generation_failed`

Valid transitions:

| From | To | Trigger | Acceptance Criteria |
|------|----|---------|--------------------|
| `pending` | `generating` | Execute task starts | Run is locked by the worker; generation begins |
| `generating` | `generated` | Report generation succeeds | Report output stored; deliver task dispatched |
| `generating` | `generation_failed` | Report generation fails | Error message stored; terminal state |
| `generated` | `delivering` | Deliver task starts | Email sending begins |
| `delivering` | `delivered` | All recipients succeed | Terminal state |
| `delivering` | `partially_delivered` | Some recipients fail | Per-recipient errors stored; terminal state |
| `delivering` | `delivery_failed` | All recipients fail | Per-recipient errors stored; terminal state |

Invalid transitions: All other state changes are rejected.

**Acceptance Criteria:**

- **Given** a run is in state `generation_failed`,
  **when** any task attempts to transition it to another state,
  **then** the system rejects the transition (terminal state).

- **Given** a run is in state `delivered`,
  **when** any task attempts to transition it to another state,
  **then** the system rejects the transition (terminal state).

- **Given** a run is in state `pending`,
  **when** the execute task updates it to `generating`,
  **then** the transition succeeds and the task proceeds.

---

## 7. Out of Scope (Phase 1)

The following are explicitly NOT included in Phase 1:

### Deferred to Phase 2 (P1 Features)

- Custom cadence expressions (e.g., "every other Monday", "first business day of the quarter")
- In-app notifications (recipients receive notifications within the app)
- Delivery history audit log (structured log of all mutations)
- Automatic retry on failure (system retries failed generation or delivery before marking as failed)
- Schedule validation warnings (e.g., warning about monthly 31st in short months)

### Deferred to Phase 3 (P2 Features)

- Report preview (users can preview a report before activating a schedule)
- Team/group recipients (add a team or group rather than listing individuals)
- Admin dashboard (account-wide schedule management view)
- Bulk operations (pause/resume/delete multiple schedules at once)
- Schedule templates (pre-configured cadences)

### Out of Scope for All Phases (Won't Have)

- Real-time or streaming report delivery
- Report builder or designer (report types must already exist)
- External delivery integrations (Slack, Teams, webhook)
- Report format customization (PDF layout, branding)
- Cross-account or multi-tenant schedule sharing
- Mobile-native scheduling interface (web responsive is sufficient)

---

## 8. Open Questions Resolved (from Product Plan)

All open questions from the product plan have been resolved in the architecture document:

1. **What report types exist today?** Architecture assumes report types exist and provides a read-only `/v1/report-types` endpoint. The `ReportGenerator` protocol abstracts generation; MVP uses a stub.

2. **Email sending constraints?** Architecture uses SMTP with Mailpit for local dev. Production email provider is a deployment configuration choice. Recipient limit is 50 per schedule.

3. **What happens to a schedule when its owner leaves?** Architecture decision: schedules continue running. The `owner_id` is not a cascading foreign key. Only admins (Phase 2) or direct database intervention can modify orphaned schedules.

4. **Report generation duration?** Architecture assumes asynchronous generation via Celery tasks. Generation timeout is a task configuration (not specified in requirements; Tech Lead defines). Long-running reports are supported via the async task pattern.

5. **Recipient limits?** 50 recipients per schedule, 25 active schedules per user (architecture decision, informed by persona: 1-10 schedules, 3-20 recipients).

6. **Time window for "monthly on the 31st"?** Architecture decision: clamp to the last day of the month when the target day does not exist (e.g., February 31st becomes February 28th or 29th).

---

## 9. Dependencies and Assumptions

### Dependencies

- **Authentication system:** The scheduling feature integrates with an existing authentication system (user identity, JWT/session tokens). Authentication implementation is out of scope.
- **User directory:** User IDs are assumed to exist. The `owner_id` field references a user in an existing user table.
- **Database:** PostgreSQL 16 with async support (SQLAlchemy 2.0).
- **Task queue:** Celery with Redis broker.
- **Email infrastructure:** SMTP server (Mailpit for dev, configured provider for production).

### Assumptions

- **Report types exist:** The system has at least one report type available for scheduling. If zero report types exist, the schedule creation UI is disabled.
- **User profile timezone:** Users have a configured timezone in their profile. If not, the system defaults to UTC.
- **Single account context:** Phase 1 does not implement multi-account or cross-account features. All operations are scoped to a single account (implicit from user authentication).
- **Admin role exists:** The authorization model references an "admin" role. This role must exist in the authentication system.

---

## 10. Verification Checklist

Requirements Analyst self-check before submitting for review:

- [x] All user stories meet INVEST criteria (independent, negotiable, valuable, estimable, small, testable)
- [x] Acceptance criteria are testable (Given/When/Then format)
- [x] Edge cases and error scenarios identified for each story
- [x] Non-functional requirements documented with testable criteria
- [x] Open questions from product plan explicitly resolved or flagged
- [x] Assumptions explicitly listed
- [x] Cross-cutting requirements (auth, pagination, error format) documented
- [x] State machines have acceptance criteria for valid and invalid transitions
- [x] Out-of-scope items clearly listed to prevent scope creep
- [x] No architecture decisions (technology choices, component structure) included
- [x] No task breakdown or implementation approach included
- [x] Requirements built from BOTH product plan AND architecture (downstream verification performed)

---

## 11. Next Steps

This requirements document is ready for review by the Product Manager and Architect. After review and any necessary resolution:

1. **Tech Lead** uses this document (plus the architecture) to write the Technical Design Document with concrete API contracts, data structures, and task signatures.
2. **Test Engineer** uses the acceptance criteria in this document to write test plans and test cases.
3. **Backend, Frontend, Database, and API Developers** implement features guided by the requirements and technical design.

---

**End of Requirements Document**
