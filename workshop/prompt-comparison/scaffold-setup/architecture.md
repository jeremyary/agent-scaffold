# Architecture Design: Report Scheduling

**Author:** Architect
**Date:** 2026-02-10
**Input:** `plans/product-plan.md` (validated), Phase 2 reviews (Architect, API Designer, Security Engineer)
**Phase:** 1 (Core Scheduling)

---

## 1. System Overview

```
                                 +------------------+
                                 |                  |
                                 |   React 19 UI    |
                                 |   (packages/ui)  |
                                 |                  |
                                 +--------+---------+
                                          |
                                     HTTP (REST)
                                          |
                                 +--------v---------+
                                 |                  |
                                 |   FastAPI API    |
                                 |  (packages/api)  |
                                 |                  |
                                 +---+---------+----+
                                     |         |
                            Python   |         | enqueue
                            import   |         |
                                     |    +----v------+
                                     |    |           |
                                     |    |   Redis   |
                                     |    |  (broker) |
                                     |    |           |
                                     |    +----+------+
                                     |         |
                                +----v----+    | consume
                                |         |    |
                                |  Postgres|   |
                                |   (DB)  |<---+----+
                                |         |    |    |
                                +---------+    |    |
                                          +----v----+----+
                                          |              |
                                          | Celery Workers|
                                          | (tick, exec, |
                                          |  deliver)    |
                                          |              |
                                          +------+-------+
                                                 |
                                            SMTP |
                                                 |
                                          +------v-------+
                                          |              |
                                          |   Mailpit    |
                                          | (dev) / SMTP |
                                          | provider     |
                                          | (prod)       |
                                          +--------------+
```

### Components

| Component | Technology | Role |
|-----------|-----------|------|
| **UI** | React 19 + TypeScript + Vite | Schedule creation/management, delivery history display |
| **API** | FastAPI (async) | REST endpoints, request validation, authorization, task dispatch |
| **DB** | PostgreSQL 16 + SQLAlchemy 2.0 (async) + Alembic | Schedule storage, run history, session management |
| **Broker** | Redis | Celery message broker and result backend |
| **Workers** | Celery | Tick task (scheduling engine), execution tasks, delivery tasks |
| **Mail** | Mailpit (dev) / SMTP provider (prod) | Email delivery |

### Communication Patterns

- **UI to API:** HTTP REST. UI uses TanStack Query for server state.
- **API to DB:** Python import. `packages/api` imports models and session factory from `packages/db`.
- **API to Workers:** Celery task dispatch via Redis broker. API enqueues tasks; workers consume them.
- **Workers to DB:** Direct database access. Workers import models and session factory from `packages/db` (same as API).
- **Workers to Mail:** Protocol-based abstraction (`EmailSender`). Workers call the email sender protocol; implementation is injected at startup.
- **Workers to Report Generator:** Protocol-based abstraction (`ReportGenerator`). Workers call the generator protocol; MVP uses a stub.

---

## 2. Component Boundaries

### `packages/db` -- Data Layer

**Owns:** SQLAlchemy model definitions, Alembic migrations, database connection/session management.

**Exports (public API):**
- Model classes: `Schedule`, `ScheduleRun`, `Recipient`
- Session factory: `get_session()` (async context manager)
- Engine: `engine` (for startup/shutdown lifecycle)
- Base: `Base` (for migration autogeneration)
- Enums: `ScheduleStatus`, `CadenceType`, `RunStatus`, `RunStepStatus`

**Does not contain:** Business logic, validation rules, API schemas, Celery task definitions.

**Consumers:** `packages/api` (via Python import), Celery workers (via Python import).

### `packages/api` -- Application Layer

**Owns:** FastAPI application, route handlers, Pydantic request/response schemas, authorization logic, Celery task definitions, service protocols and implementations.

**Structure:**
- `src/routes/` -- Route handlers (schedules, schedule-runs, report-types)
- `src/schemas/` -- Pydantic models for API request/response validation
- `src/services/` -- Protocol definitions (`ReportGenerator`, `EmailSender`) and implementations
- `src/tasks/` -- Celery task definitions (tick, execute, deliver)
- `src/core/` -- Configuration, dependency injection, authorization helpers
- `src/main.py` -- FastAPI app factory, router registration, startup/shutdown

**Boundary rules:**
- Route handlers call service functions. They do not contain business logic beyond request parsing and response formatting.
- Service protocols define the contract for external integrations (report generation, email delivery). Implementations are selected via configuration.
- Celery tasks live in this package because they orchestrate business logic (generate + deliver). They import models from `packages/db` and call service protocols.
- Authorization checks happen in route handlers via FastAPI dependencies, not in service or task code.

### `packages/ui` -- Presentation Layer

**Owns:** React pages, components, hooks (TanStack Query wrappers), API client services, Zod schemas for response validation.

**Structure:**
- `src/routes/` -- TanStack Router file-based routes (schedule list, schedule detail/create/edit)
- `src/components/` -- Atomic design (atoms, molecules, organisms)
- `src/hooks/` -- TanStack Query hooks for schedule and run data
- `src/services/` -- Fetch functions that call the API
- `src/schemas/` -- Zod schemas matching the API response shapes

**Boundary rules:**
- All server state flows through TanStack Query hooks. Components never call fetch directly.
- The UI assumes the API handles all authorization. It uses the API response (403) to determine access, not local role logic.
- Timezone display: the UI receives `schedule_time` (local) + `timezone` (IANA) from the API and displays them directly. It receives `next_run_at` as a UTC ISO 8601 timestamp and converts to the user's local timezone for display.

### Boundary Crossings Summary

| From | To | Mechanism | What Crosses |
|------|----|-----------|-------------|
| UI | API | HTTP REST | JSON request/response bodies (Pydantic schemas) |
| API | DB | Python import | Model instances, session objects |
| API | Redis | Celery `.delay()` | Task name + serialized arguments (JSON) |
| Worker | DB | Python import | Model instances, session objects |
| Worker | ReportGenerator | Protocol call | Report type ID, parameters -> bytes + content type |
| Worker | EmailSender | Protocol call | Recipients, subject, body, attachments -> delivery results |

---

## 3. Data Flow

### Flow 1: Schedule Creation (UI -> API -> DB)

```
User fills form      POST /v1/schedules          Validate + Persist          Compute next_run_at
in React UI    --->  with JSON body         --->  to PostgreSQL         --->  using zoneinfo
                     (Pydantic validation)        (Schedule + Recipients)     (write to schedule row)
                                                                                    |
                                             201 Created  <-------------------------+
                                             with schedule data
                                             (including nextRunAt)
```

**Happy path:**
1. User selects report type, cadence (daily/weekly/monthly), time, timezone, and recipients in the UI.
2. UI sends `POST /v1/schedules` with the schedule payload.
3. API validates the request (Pydantic schema validation), checks authorization (authenticated user becomes owner), and validates business rules (report type exists, timezone is valid IANA identifier, recipient count within limits).
4. API computes `next_run_at` by resolving the schedule time in the given timezone to UTC for the next occurrence date.
5. API persists the `Schedule` (status=active) and associated `Recipient` rows in a single transaction.
6. API returns 201 with the created schedule, including `nextRunAt` as a UTC ISO 8601 timestamp.
7. UI displays the schedule with the next delivery time converted to the user's display timezone.

**Error paths:**
- **Validation failure** (invalid cadence, invalid timezone, too many recipients): API returns 422 with field-level errors. UI displays inline validation messages. No database write.
- **Report type not found:** API returns 422. Schedule is not created.
- **Database error** (connection failure, constraint violation): API returns 500. Transaction is rolled back. UI shows a generic error with a retry option.
- **Duplicate schedule** (same owner + report type + cadence): Not a constraint in Phase 1 -- users can create duplicates. May add a warning in Phase 2 (schedule validation feature).

### Flow 2: Report Delivery (Tick -> Generate -> Deliver -> Status Update)

```
Celery Beat (every 60s)
       |
       v
  Tick Task
  SELECT ... WHERE next_run_at <= now()
  FOR UPDATE SKIP LOCKED
       |
       +-- for each due schedule:
       |       |
       |       v
       |   Create ScheduleRun (status=pending)
       |   Update next_run_at to next occurrence
       |   Dispatch execute_schedule task
       |       |
       |       v
       |   Execute Task
       |   Call ReportGenerator.generate(report_type, params)
       |       |
       |       +-- success: update ScheduleRun (status=generating -> generated)
       |       |            dispatch deliver_report task
       |       |
       |       +-- failure: update ScheduleRun (status=generation_failed)
       |                    STOP (no delivery attempted)
       |
       v
  Deliver Task
  For each recipient:
      Call EmailSender.send(recipient, subject, body, attachment)
      Record per-recipient result
       |
       +-- all succeeded: update ScheduleRun (status=delivered)
       |
       +-- some failed: update ScheduleRun (status=partially_delivered)
       |
       +-- all failed: update ScheduleRun (status=delivery_failed)
```

**Detailed step-by-step:**

1. **Tick task** runs every 60 seconds (triggered by Celery Beat -- a single static Beat entry).
2. Tick queries: `SELECT * FROM schedules WHERE status = 'active' AND next_run_at <= now() FOR UPDATE SKIP LOCKED`. The `SKIP LOCKED` clause allows multiple tick workers to run safely -- if two tick tasks fire simultaneously, the second one skips rows already locked by the first.
3. For each due schedule, the tick task:
   a. Creates a `ScheduleRun` row with `status=pending`.
   b. Computes the next `next_run_at` using the schedule's cadence, timezone, and the current occurrence date.
   c. Updates the schedule's `next_run_at` to the next occurrence.
   d. Commits the transaction (the schedule is now "claimed" -- its `next_run_at` is in the future).
   e. Dispatches an `execute_schedule` Celery task with the `ScheduleRun` ID.
4. **Execute task** receives the run ID, loads the schedule configuration, and calls `ReportGenerator.generate()`.
   - On success: updates the run status to `generated`, stores the output reference, and dispatches `deliver_report`.
   - On failure: updates the run status to `generation_failed` with the error message. No delivery is attempted. The run is terminal.
5. **Deliver task** receives the run ID and the generated report. For each recipient on the schedule:
   - Calls `EmailSender.send()` with the recipient's email, a formatted subject line, HTML body, and the report as an attachment.
   - Records the per-recipient result (sent or failed with error).
   - After all recipients are processed, updates the run's overall status based on results.

**Error paths:**
- **Tick task fails** (database connection error): The tick task logs the error and exits. Celery Beat will trigger it again in 60 seconds. Schedules that were due are picked up on the next tick (their `next_run_at` is still in the past). No data is lost because the transaction was not committed.
- **Report generation fails:** The `ScheduleRun` is marked `generation_failed` with a human-readable error message (e.g., "Report generation timed out", "Report type not available"). The schedule remains active -- the next occurrence will try again. The owner sees the failure in delivery history.
- **Email delivery fails for some recipients:** The run is marked `partially_delivered`. The delivery detail records which recipients succeeded and which failed, with per-recipient error messages (e.g., "Mailbox not found", "Connection refused"). The owner can see exactly who did and did not receive the report.
- **Email delivery fails for all recipients:** The run is marked `delivery_failed`. Same per-recipient detail.
- **Celery worker crashes mid-execution:** The task is retried by Celery's built-in retry mechanism (configurable retry count and backoff). If all retries are exhausted, the run is marked failed. The `ScheduleRun` row exists (created by the tick) so the failure is visible in delivery history.

---

## 4. Technology Decisions

### 4.1 Scheduling Approach: Custom Tick Task
**Decision:** Use a custom tick task with `SELECT FOR UPDATE SKIP LOCKED` instead of dynamic Celery Beat entries.
**Rationale and trade-off analysis:** See [ADR-0001](/home/jary/redhat/git/claude-collective-example/docs/adr/0001-scheduling-engine-approach.md).
**Summary:** The database is already the source of truth for schedule configuration. Making it the source of truth for "what is due" eliminates a synchronization layer. One-minute polling latency is imperceptible for daily/weekly/monthly cadences.

### 4.2 Report Generation Boundary: Protocol Interface
**Decision:** Define a `ReportGenerator` Python Protocol. MVP ships with a stub implementation.
**Rationale and trade-off analysis:** See [ADR-0002](/home/jary/redhat/git/claude-collective-example/docs/adr/0002-report-generation-boundary.md).
**Summary:** Clean integration boundary. Scheduling code is decoupled from generation implementation. Tests inject mocks. Real implementation is a configuration change, not a code change.

### 4.3 Email Delivery: Protocol Interface with SMTP Default
**Decision:** Define an `EmailSender` Python Protocol. MVP uses SMTP pointed at Mailpit (local dev) or a configured SMTP server (production).
**Rationale and trade-off analysis:** See [ADR-0003](/home/jary/redhat/git/claude-collective-example/docs/adr/0003-email-delivery-abstraction.md).
**Summary:** Same abstraction pattern as report generation. Local development works with Mailpit (no external accounts needed). Production email provider is a deployment configuration choice.

### 4.4 Timezone Strategy: Local Time + IANA Timezone
**Decision:** Store cadence time in the owner's local time with an IANA timezone identifier. Compute `next_run_at` as UTC. Tick task operates purely in UTC.
**Rationale and trade-off analysis:** See [ADR-0004](/home/jary/redhat/git/claude-collective-example/docs/adr/0004-timezone-strategy.md).
**Summary:** Correctly handles DST transitions. "9:00 AM Eastern" always means 9:00 AM in the user's timezone, regardless of whether it is EST or EDT. The tick task never reasons about timezones -- it compares UTC timestamps.

---

## 5. Integration Patterns

### 5.1 API Imports from DB (`packages/api` -> `packages/db`)

The `api` package declares `db` as a Python dependency in its `pyproject.toml`. Import path:

```python
from db import get_session, Schedule, ScheduleRun, Recipient, ScheduleStatus
```

The session factory is used as a FastAPI dependency:

```python
@router.get("/v1/schedules")
async def list_schedules(session: AsyncSession = Depends(get_session)):
    ...
```

The `db` package exports only its public API (models, session factory, engine, enums). Internal implementation details (connection pooling config, migration scripts) are not exposed.

### 5.2 UI Calls the API (`packages/ui` -> `packages/api`)

The UI uses the standard project pattern (see `ui-development.md` rule):

```
Component -> Hook (TanStack Query) -> Service (fetch) -> API
```

The API base URL is configured via the `VITE_API_BASE_URL` environment variable. All API responses are validated against Zod schemas in `packages/ui/src/schemas/`. This provides runtime type safety at the UI boundary.

Authentication tokens are passed via the `Authorization: Bearer <token>` header on every request. The UI stores the token in memory (not localStorage) and refreshes it as needed. (Authentication infrastructure is assumed to exist -- it is listed as P0 but is not a new system; the scheduling feature integrates with the existing auth mechanism.)

### 5.3 Celery Workers Access the Database

Workers import from `packages/db` the same way the API does. However, workers use **synchronous** SQLAlchemy sessions (not async) because Celery tasks run in a thread/process pool, not an asyncio event loop.

The `db` package must export both:
- `get_session()` -- async session factory (for FastAPI)
- `get_sync_session()` -- synchronous session factory (for Celery workers)

Both factories connect to the same database with the same connection string. The sync factory uses a separate connection pool sized for the expected number of concurrent worker tasks.

### 5.4 Celery Task Dispatch (API -> Workers)

The API does not dispatch tasks directly for schedule creation/editing (those are synchronous database writes). Tasks are dispatched only by:
- **Celery Beat** dispatches the tick task every 60 seconds (static configuration).
- **The tick task** dispatches `execute_schedule` tasks for due schedules.
- **The execute task** dispatches `deliver_report` tasks after successful generation.

This creates a clean task chain: `tick -> execute -> deliver`. Each task is independently retryable and independently observable.

### 5.5 Configuration and Dependency Injection

Service implementations (ReportGenerator, EmailSender) are selected at application startup based on configuration:

```
APP_REPORT_GENERATOR=stub    # or "real" when the generation system is ready
APP_EMAIL_SENDER=smtp        # or "sendgrid", "ses", etc.
SMTP_HOST=localhost
SMTP_PORT=1025               # Mailpit default
```

The FastAPI app factory and the Celery app factory both read this configuration and wire the correct implementations. This is simple constructor injection -- no DI framework needed.

---

## 6. Decisions on Deferred Review Items

### 6.1 Orphan Schedule Policy (Architect S1)

**Decision: Schedules continue running when the owner is deactivated. Only admins (Phase 2) or direct database intervention (Phase 1) can modify or disable them.**

**Rationale:** The product plan's persona context shows Maya (Report Owner) distributes reports to a team. When Maya leaves, her team still needs those reports. Auto-disabling would silently break the team's information flow -- the opposite of the product's reliability promise. Keeping schedules running is the safer default. The risk is "stale report spam" (noted in the product plan), but this risk exists regardless of owner status and is mitigated by the admin dashboard in Phase 2.

**Phase 1 data model implications:**
- The `Schedule.owner_id` column references the user but is **not** a cascading foreign key. If the user is deactivated, the schedule row is unaffected.
- The `Schedule` table does not need an "orphaned" status. The schedule remains `active` or `paused`. The owner's account status is irrelevant to the scheduling engine.
- Authorization: in Phase 1, if the owner is deactivated, no one can modify the schedule via the API (since the owner cannot authenticate). This is acceptable -- the schedule continues on autopilot. Phase 2's admin dashboard provides the escape hatch.
- The `owner_id` field supports Phase 2 reassignment (admin updates the owner_id to a new user) without schema changes.

**Escalation check:** This decision is forward-compatible. The ownership model supports both "keep running" (Phase 1) and "admin reassignment" (Phase 2) without data model changes. No escalation to Product Manager needed.

### 6.2 Recipient Limits (Architect S2, Security Engineer abuse prevention)

**Decision: Phase 1 enforces the following limits:**

| Limit | Value | Rationale |
|-------|-------|-----------|
| Recipients per schedule | 50 | Persona says 3-20. 50 provides headroom without enabling abuse. |
| Active schedules per user | 25 | Persona says 1-10. 25 provides headroom. |
| Recipients per account (soft) | 500 | Monitoring threshold, not a hard block. Alerts ops. |

These limits are enforced at the API layer (validation) and stored in configuration (not hardcoded) so they can be adjusted without code changes. The API returns 422 with a clear message when a limit is exceeded.

**Rationale:** The persona (Maya) manages 1-10 schedules distributing to 3-20 people. These limits are 2.5x to 5x the persona's upper bound, providing room for larger teams while preventing abuse. The per-account soft limit provides an operational safety net.

### 6.3 Generation/Delivery Separation (Architect W1)

**Decision: Confirmed. Report generation and email delivery are modeled as separate pipeline steps with independent status tracking.**

The `ScheduleRun` records the outcome of each step independently. The run status state machine (section 6.5) tracks generation and delivery as distinct phases. This enables:
- Presenting "generation failed" vs. "delivery failed" to the user (addresses the delivery status visibility P0 feature and the failure transparency NFR).
- Retrying delivery without re-generating the report (Phase 2).
- Adding new delivery channels (in-app notifications, Phase 2) as additional steps after generation.

### 6.4 Recipient Storage Model (API Designer SUGGESTION-1)

**Decision: Recipients are stored as email strings in a separate `recipients` table, not as references to user accounts.**

**Rationale:** The product plan says "add and remove email recipients." The persona context implies organizational recipients, but the plan does not require recipients to have accounts in the system. Storing email strings:
- Supports both internal users and external parties (partners, stakeholders).
- Avoids coupling to a user directory that may not exist or may change.
- Keeps the data model simple for Phase 1.

Phase 2 considerations: if team/group recipients (P2) require user directory integration, the `recipients` table can be extended with an optional `user_id` column alongside the `email` column. The email string remains the delivery-time identifier regardless.

**Schema shape (for Tech Lead to refine):**
```
recipients
  id:           int (PK)
  schedule_id:  int (FK -> schedules.id)
  email:        varchar(255)
  is_active:    boolean (default true, supports unsubscribe)
  created_at:   timestamptz
```

### 6.5 Status State Machine (API Designer SUGGESTION-2)

**Decision: Separate state machines for Schedule and ScheduleRun.**

**Schedule status (lifecycle of the schedule configuration):**

```
        create
          |
          v
       active  <----+
          |         |
    pause |  resume |
          |         |
          v         |
       paused ------+
          |
   delete |  (also from active)
          v
       deleted  (soft delete -- row retained, excluded from queries)
```

Valid transitions:
- `active -> paused` (user pauses)
- `paused -> active` (user resumes)
- `active -> deleted` (user deletes)
- `paused -> deleted` (user deletes)

No other transitions are valid. The API rejects invalid transitions with 409 Conflict.

**ScheduleRun status (lifecycle of a single execution):**

```
  pending -> generating -> generated -> delivering -> delivered
                |                          |
                v                          v
        generation_failed          delivery_failed
                                         |
                                         v
                                  partially_delivered
```

Valid transitions:
- `pending -> generating` (execute task starts)
- `generating -> generated` (report generation succeeds)
- `generating -> generation_failed` (report generation fails -- terminal)
- `generated -> delivering` (deliver task starts)
- `delivering -> delivered` (all recipients succeeded -- terminal)
- `delivering -> partially_delivered` (some recipients failed -- terminal)
- `delivering -> delivery_failed` (all recipients failed -- terminal)

Terminal states: `generation_failed`, `delivered`, `partially_delivered`, `delivery_failed`.

This state machine is enforced in the task code, not in the database (no database triggers). The Tech Lead should implement a state transition function that validates transitions and raises an error on invalid ones.

### 6.6 Abuse Prevention (Security Engineer)

**Decision:** Rate limits and caps are implemented at the API layer.

| Control | Implementation | Value |
|---------|---------------|-------|
| Schedule creation rate | API rate limit (per user) | 10 creates per minute |
| Recipient count per schedule | Pydantic validation | 50 max |
| Active schedules per user | Database count check before create | 25 max |
| Email validation | Pydantic `EmailStr` + RFC 5322 | Reject invalid format |
| Timezone validation | Check against `zoneinfo.available_timezones()` | Reject unknown timezone |

Rate limiting is implemented via a FastAPI middleware or dependency that checks a Redis counter. This reuses the existing Redis instance (Celery broker). The rate limit applies to schedule creation and update endpoints.

### 6.7 Unsubscribe Mechanism (Security Engineer)

**Decision: Phase 1 provides a minimal, owner-mediated unsubscribe path. No self-service unsubscribe link in emails for MVP.**

**Rationale:** The product plan's persona context indicates organizational recipients (team members, 3-20 people). These are internal recipients added by a known report owner -- not unsolicited marketing emails. CAN-SPAM's unsubscribe requirement applies to "commercial electronic messages," which internal operational reports likely are not. GDPR's right to object applies, but the appropriate channel for an internal recipient is to ask the report owner (Maya) to remove them.

**Phase 1 implementation:**
- Emails include a footer: "You are receiving this report because [owner name] added you to a scheduled delivery. To stop receiving this report, contact [owner name] or your account administrator."
- The `recipients` table has an `is_active` boolean. The owner can deactivate a recipient via the schedule management UI.
- No tokenized unsubscribe link. No self-service endpoint.

**Phase 2 path:** If the feature expands to external recipients or higher volumes, implement a tokenized unsubscribe link (HMAC-signed, schedule-scoped, time-limited) that sets `is_active=false` on the recipient row. The data model already supports this -- no schema change needed.

**Escalation check:** This decision assumes recipients are organizational/internal for MVP, which is supported by the persona context. If the Product Manager intends to support arbitrary external recipients in Phase 1, this must be revisited -- external recipients create CAN-SPAM/GDPR obligations that require self-service unsubscribe. Based on the persona ("distributes to a team of 3-20 people"), this escalation is not needed.

---

## 7. Deployment Model (Local Development)

### compose.yml Services

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: reportscheduler
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports: ["6379:6379"]

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI for inspecting emails

  api:
    build: packages/api
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://dev:dev@postgres:5432/reportscheduler
      REDIS_URL: redis://redis:6379/0
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      APP_REPORT_GENERATOR: stub
      APP_EMAIL_SENDER: smtp
    depends_on: [postgres, redis, mailpit]

  worker:
    build: packages/api
    command: celery -A src.tasks worker --loglevel=info
    environment:
      DATABASE_URL: postgresql://dev:dev@postgres:5432/reportscheduler
      REDIS_URL: redis://redis:6379/0
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      APP_REPORT_GENERATOR: stub
      APP_EMAIL_SENDER: smtp
    depends_on: [postgres, redis, mailpit]

  beat:
    build: packages/api
    command: celery -A src.tasks beat --loglevel=info
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on: [redis]

  ui:
    build: packages/ui
    ports: ["5173:5173"]
    environment:
      VITE_API_BASE_URL: http://localhost:8000

volumes:
  pgdata:
```

### Service Roles

| Service | Purpose | Notes |
|---------|---------|-------|
| **postgres** | Schedule and run data storage | Persistent volume for data durability across restarts |
| **redis** | Celery broker + rate limit counters | Ephemeral -- no persistence needed for dev |
| **mailpit** | Local email sink with web UI | Browse sent emails at http://localhost:8025 |
| **api** | FastAPI server | Serves REST endpoints, hot-reload in dev |
| **worker** | Celery worker processes | Executes tick, generate, and deliver tasks |
| **beat** | Celery Beat scheduler | Fires the tick task every 60 seconds. Single instance only. |
| **ui** | Vite dev server | React app with HMR, proxied to API |

### Key Operational Notes

- **Beat is a singleton.** Only one Beat process should run at a time. In production, this is enforced via a lock (Redis or database). In local dev, the single `beat` container handles this naturally.
- **Workers scale horizontally.** Multiple worker containers can run safely because the tick task uses `SELECT FOR UPDATE SKIP LOCKED`. For local dev, one worker is sufficient.
- **Database migrations** are run via `alembic upgrade head` before starting the API or workers. In the compose setup, this should be an entrypoint script or a one-off `docker compose run` command.
- **Worker uses synchronous DB URL.** Note that the worker's `DATABASE_URL` uses `postgresql://` (not `postgresql+asyncpg://`) because Celery tasks use synchronous SQLAlchemy sessions.

---

## 8. Conceptual Data Model

This section outlines the data model at the architecture level. The Tech Lead and Database Engineer will refine column types, constraints, and indexes during technical design.

### Entities

```
+------------------+       +------------------+       +------------------+
|    Schedule      |       |  ScheduleRun     |       |   Recipient      |
+------------------+       +------------------+       +------------------+
| id (PK)          |<---+  | id (PK)          |       | id (PK)          |
| owner_id         |    |  | schedule_id (FK) |------>| schedule_id (FK) |
| report_type_id   |    |  | status           |       | email            |
| cadence_type     |    |  | started_at       |       | is_active        |
| cadence_day      |    +--| error_message    |       | created_at       |
| schedule_time    |       | created_at       |       +------------------+
| timezone         |       | completed_at     |
| status           |       +------------------+
| next_run_at      |                |
| created_at       |                |
| updated_at       |       +------------------+
+------------------+       | RunRecipient     |
                           +------------------+
                           | id (PK)          |
                           | run_id (FK)      |
                           | recipient_email  |
                           | status           |
                           | error_message    |
                           +------------------+
```

### Entity Descriptions

- **Schedule:** The configuration for a recurring report delivery. Owned by a user. Contains the cadence definition, timezone, and precomputed `next_run_at`.
- **ScheduleRun:** A record of a single execution attempt. Tracks status through the generation and delivery pipeline. One-to-many with Schedule.
- **Recipient:** An email address associated with a schedule. The `is_active` flag supports removal without hard-deleting (preserves referential integrity with past runs).
- **RunRecipient:** Per-recipient delivery outcome for a specific run. Records whether each recipient received the email and any error that occurred. This enables the "partially delivered" status and lets the owner see exactly who got the report.

### Key Design Points

- **`next_run_at` is UTC.** The tick task queries this column. It is indexed.
- **`schedule_time` is local time.** Stored as a time value (e.g., "09:00") in the owner's timezone. Used with `timezone` and `cadence_*` fields to compute the next `next_run_at` after each execution.
- **Soft delete for schedules.** `status=deleted` rather than row deletion. Preserves delivery history references.
- **Soft delete for recipients.** `is_active=false` rather than row deletion. Preserves `RunRecipient` referential integrity and supports future unsubscribe tracking.

---

## 9. Observability

### Structured Logging

All components (API, workers) emit structured JSON logs with the fields required by the project's observability rule:

| Field | Source |
|-------|--------|
| `timestamp` | ISO 8601 |
| `level` | info, warn, error |
| `message` | Human-readable description |
| `correlationId` | Request ID (API) or Run ID (workers) |
| `service` | `api`, `worker`, `beat` |

### Key Events to Log

| Event | Level | Component | Fields |
|-------|-------|-----------|--------|
| Schedule created | info | API | `schedule_id`, `owner_id`, `report_type_id` |
| Schedule paused/resumed/deleted | info | API | `schedule_id`, `owner_id`, `new_status` |
| Tick fired | info | Worker | `schedules_found`, `schedules_dispatched` |
| Report generation started | info | Worker | `run_id`, `schedule_id`, `report_type_id` |
| Report generation failed | error | Worker | `run_id`, `schedule_id`, `error` |
| Email delivery attempted | info | Worker | `run_id`, `recipient_count` |
| Email delivery failed (per recipient) | warn | Worker | `run_id`, `recipient_email`, `error` |
| Run completed | info | Worker | `run_id`, `final_status`, `duration_ms` |

### Health Checks

| Endpoint | Component | Checks |
|----------|-----------|--------|
| `GET /healthz` | API | Process is running |
| `GET /readyz` | API | Database connection, Redis connection |
| Celery `inspect ping` | Worker | Worker is responsive |

### Metrics (Phase 1 -- log-derived, not Prometheus)

For MVP, key metrics are derived from structured logs rather than a dedicated metrics pipeline:
- Tick frequency (should be every ~60 seconds)
- Runs per status (delivered, failed, partially_delivered)
- Generation and delivery duration
- Queue depth (Redis)

A dedicated metrics endpoint (Prometheus) can be added in Phase 2 if needed.

---

## 10. Downstream Verification: Product Plan Consistency

During architecture design, I reviewed the product plan for internal consistency. Findings:

**No contradictions found.** The product plan is internally consistent. All Phase 1 features map to the architecture components without gaps:

| P0 Feature | Architecture Component |
|------------|----------------------|
| Report type selection | `report_type_id` on Schedule, `/v1/report-types` read-only endpoint |
| Cadence configuration | `cadence_type`, `cadence_day`, `schedule_time` on Schedule |
| Recipient management | `Recipient` entity, CRUD via schedule endpoints |
| Email delivery | Celery deliver task + EmailSender protocol |
| Schedule management | CRUD + pause/resume on Schedule entity |
| Delivery status visibility | `ScheduleRun` + `RunRecipient` entities, runs endpoint |
| Timezone support | `timezone` on Schedule + `next_run_at` computation (ADR-0004) |
| Auth and authorization | FastAPI dependencies, owner + admin roles |

**One clarification noted:** The product plan lists "authentication and authorization" as a P0 feature but also states it "assumes report types already exist in the system." The architecture assumes an existing authentication system (user identity, JWT/session tokens) that the scheduling feature integrates with. If no auth system exists yet, that is a prerequisite that must be built first -- it is not part of this architecture. The scheduling feature's authorization logic (owner and admin checks) is in scope.

---

## 11. Architecture Decision Records

The following ADRs were created as part of this architecture design:

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](/home/jary/redhat/git/claude-collective-example/docs/adr/0001-scheduling-engine-approach.md) | Scheduling Engine Approach | Proposed |
| [ADR-0002](/home/jary/redhat/git/claude-collective-example/docs/adr/0002-report-generation-boundary.md) | Report Generation Boundary | Proposed |
| [ADR-0003](/home/jary/redhat/git/claude-collective-example/docs/adr/0003-email-delivery-abstraction.md) | Email Delivery Abstraction | Proposed |
| [ADR-0004](/home/jary/redhat/git/claude-collective-example/docs/adr/0004-timezone-strategy.md) | Timezone Strategy | Proposed |

---

## 12. Next Steps for Downstream Agents

### For the Tech Lead (Technical Design)
1. Define concrete Pydantic schemas for all API request/response bodies (Schedule, ScheduleRun, Recipient, ReportType).
2. Specify the `ReportGenerator` and `EmailSender` protocol signatures (method names, parameter types, return types, error types).
3. Design the cadence-to-next-occurrence computation function (daily, weekly, monthly) with DST edge case handling per ADR-0004.
4. Define the state transition validation function for Schedule and ScheduleRun status machines (section 6.5).
5. Specify the Celery task signatures and retry configuration for tick, execute, and deliver tasks.
6. Design the authorization dependency (how owner and admin roles are checked in route handlers).

### For the Database Engineer
1. Define the exact SQLAlchemy models based on the conceptual data model (section 8).
2. Add appropriate indexes: `schedules(status, next_run_at)` for the tick query, `schedule_runs(schedule_id, created_at)` for delivery history, `recipients(schedule_id, is_active)` for active recipient lookup.
3. Create the initial Alembic migration.
4. Implement both `get_session()` (async) and `get_sync_session()` (sync) session factories.

### For the API Designer
1. Define the OpenAPI specification based on the resource model (Schedules, ScheduleRuns, ReportTypes) and the write operations outlined in the API Designer review.
2. Apply the project's API conventions (versioned paths, cursor-based pagination, RFC 7807 errors).

### For the Security Engineer (Architecture Review)
1. Review the authorization model (owner + admin, no cascading FK for orphan policy).
2. Review the unsubscribe decision (owner-mediated for MVP, tokenized link deferred to Phase 2).
3. Review rate limiting approach (Redis-backed, API-layer enforcement).
4. Assess whether the email footer is sufficient for MVP compliance.

### For the SRE Engineer (Architecture Review)
1. Review the observability approach (structured logging, health checks, log-derived metrics).
2. Assess the Beat singleton risk and recommend a production-grade lock mechanism.
3. Review the `SELECT FOR UPDATE SKIP LOCKED` pattern for operational implications.
