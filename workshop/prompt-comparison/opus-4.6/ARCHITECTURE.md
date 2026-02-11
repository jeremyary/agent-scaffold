# Scheduled Reports — Feature Architecture Plan

## 1. Problem Statement

Users want to generate reports on a recurring basis and have them delivered automatically to their team, without manually triggering each run. Product requires:

- **Report type selection** — user picks from available report types
- **Cadence configuration** — user sets a schedule (daily, weekly, monthly, custom cron)
- **Automatic delivery** — reports are generated and delivered to specified recipients without manual intervention

---

## 2. Key Assumptions

These assumptions shape the plan. If any are wrong, the affected sections need revisiting.

| # | Assumption | Impact if wrong |
|---|-----------|-----------------|
| A1 | An on-demand report generation system already exists (report types, parameters, rendering) | Without this, the scope roughly doubles — you'd need to build report generation first |
| A2 | Multi-tenant architecture with org/team/user hierarchy | Delivery targeting and permissions model changes significantly |
| A3 | An email or notification delivery channel exists | Need to build or integrate one (SendGrid, SES, etc.) |
| A4 | A background job system exists or can be introduced (Sidekiq, Celery, Bull, Temporal, etc.) | Core scheduler infrastructure must be built from scratch |
| A5 | Reports are exportable to at least PDF or CSV today | If not, rendering pipeline is a prerequisite |

---

## 3. User Stories

### P0 — Must have for launch
1. As a user, I can create a scheduled report by selecting a report type, configuring its parameters, and setting a cadence.
2. As a user, I can specify one or more recipients (team members) who will receive the report.
3. As a user, I can choose a delivery format (PDF, CSV, or both).
4. As a user, I receive the report at the scheduled time via email with the report attached or linked.
5. As a user, I can view, edit, pause, resume, and delete my scheduled reports.
6. As a user, I can see the history of past deliveries for a scheduled report (success/failure, timestamp).

### P1 — Fast follow
7. As an admin, I can view and manage all scheduled reports across my organization.
8. As a user, I can deliver reports to a Slack channel or webhook endpoint.
9. As a user, I can set a time-of-day preference for delivery (e.g., "every Monday at 9am EST").
10. As a user, I receive a notification if a scheduled report fails to generate.

### P2 — Future
11. As a user, I can set conditional delivery (only send if data changed, only send if metric exceeds threshold).
12. As a user, I can preview what the next scheduled run will look like before it fires.
13. As a user, I can use a report schedule as a template and share it with my team.

---

## 4. Data Model

### 4.1 New Entities

```
┌─────────────────────────────────────────────────┐
│ scheduled_reports                                │
├─────────────────────────────────────────────────┤
│ id              UUID PK                         │
│ org_id          UUID FK → organizations         │
│ created_by      UUID FK → users                 │
│ report_type     VARCHAR (enum key)              │
│ report_params   JSONB  (filters, date range,    │
│                         grouping, etc.)          │
│ cadence_type    ENUM (daily, weekly, monthly,   │
│                       custom)                    │
│ cron_expression VARCHAR (normalized cron)        │
│ timezone        VARCHAR (IANA tz, e.g.          │
│                         "America/New_York")      │
│ delivery_format ENUM (pdf, csv, both)           │
│ status          ENUM (active, paused, deleted)  │
│ next_run_at     TIMESTAMPTZ (precomputed)       │
│ created_at      TIMESTAMPTZ                     │
│ updated_at      TIMESTAMPTZ                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ scheduled_report_recipients                     │
├─────────────────────────────────────────────────┤
│ id                  UUID PK                     │
│ scheduled_report_id UUID FK → scheduled_reports │
│ recipient_type      ENUM (user, email, channel) │
│ recipient_value     VARCHAR (user_id, email     │
│                              addr, or channel)   │
│ created_at          TIMESTAMPTZ                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ scheduled_report_runs                           │
├─────────────────────────────────────────────────┤
│ id                  UUID PK                     │
│ scheduled_report_id UUID FK → scheduled_reports │
│ status              ENUM (pending, generating,  │
│                           delivering, completed,│
│                           failed)               │
│ started_at          TIMESTAMPTZ                 │
│ completed_at        TIMESTAMPTZ                 │
│ error_message       TEXT (nullable)             │
│ artifact_url        VARCHAR (nullable, link to  │
│                              stored report file)│
│ artifact_size_bytes BIGINT (nullable)           │
│ created_at          TIMESTAMPTZ                 │
└─────────────────────────────────────────────────┘
```

### 4.2 Indexes

- `scheduled_reports`: composite on `(status, next_run_at)` — the scheduler polls this
- `scheduled_reports`: on `(org_id, created_by)` — user list views
- `scheduled_report_runs`: on `(scheduled_report_id, created_at DESC)` — run history
- `scheduled_report_runs`: on `(status)` where status IN ('pending','generating') — monitoring stuck jobs

### 4.3 Notes on `report_params`

Using JSONB for report parameters keeps the schema flexible as new report types are added. Each report type should define a JSON schema for its params, validated at write time. Example:

```json
{
  "date_range": "last_30_days",
  "filters": { "team_id": "uuid-here", "status": ["active"] },
  "grouping": "weekly",
  "columns": ["name", "revenue", "churn_rate"]
}
```

---

## 5. System Architecture

### 5.1 Component Overview

```
                    ┌──────────────┐
                    │   Frontend   │
                    │  (Schedule   │
                    │   Builder)   │
                    └──────┬───────┘
                           │ REST / GraphQL
                           ▼
                    ┌──────────────┐
                    │   API Layer  │
                    │  (CRUD for   │
                    │  schedules)  │
                    └──────┬───────┘
                           │ writes to DB
                           ▼
                    ┌──────────────┐
                    │   Database   │
                    │  (Postgres)  │
                    └──────┬───────┘
                           │ polled / event-driven
                           ▼
              ┌────────────────────────┐
              │   Scheduler Service    │
              │  (finds due schedules, │
              │   enqueues jobs)       │
              └────────────┬───────────┘
                           │ enqueues
                           ▼
              ┌────────────────────────┐
              │   Job Queue            │
              │  (Redis / SQS / etc.)  │
              └────────────┬───────────┘
                           │ dequeues
                           ▼
              ┌────────────────────────┐
              │   Report Worker        │
              │  1. Generate report    │
              │  2. Store artifact     │
              │  3. Deliver to recips  │
              │  4. Update run record  │
              └────────────────────────┘
                      │          │
                      ▼          ▼
               ┌──────────┐ ┌──────────┐
               │  Object  │ │  Email / │
               │  Storage │ │  Notif   │
               │  (S3)    │ │  Service │
               └──────────┘ └──────────┘
```

### 5.2 Scheduler Service — Design Decision

**Option A: Polling-based (recommended for P0)**
- A cron job or lightweight service runs every minute
- Queries: `SELECT * FROM scheduled_reports WHERE status = 'active' AND next_run_at <= NOW()`
- Enqueues a job for each, updates `next_run_at` to the next occurrence
- Simple, debuggable, works at moderate scale (thousands of schedules)

**Option B: Event-driven with delayed messages**
- When a schedule is created/updated, push a delayed message to the queue timed for `next_run_at`
- More scalable but harder to debug; cancellation requires message deletion
- Better for 100K+ active schedules

**Recommendation:** Start with Option A. Migrate to B only if polling query becomes a bottleneck (which likely means >50K active schedules).

### 5.3 Report Worker — Pipeline

Each job follows this pipeline:

```
1. VALIDATE   — schedule still active? params still valid?
2. GENERATE   — call existing report generation with report_type + report_params
3. RENDER     — produce PDF/CSV artifact(s)
4. STORE      — upload artifact to object storage, get signed URL (time-limited)
5. DELIVER    — send to each recipient (email w/ attachment or link, future: Slack/webhook)
6. RECORD     — write scheduled_report_runs row with outcome
7. RESCHEDULE — compute and write next_run_at on the schedule
```

Failure at any step logs the error, marks the run as `failed`, and still reschedules the next run (don't break the cadence because of one failure).

### 5.4 Idempotency & Concurrency

- Each run gets a deterministic idempotency key: `{scheduled_report_id}:{expected_run_timestamp}`
- The scheduler uses `SELECT ... FOR UPDATE SKIP LOCKED` (or equivalent) to prevent double-enqueue if multiple scheduler instances run
- Workers check for existing run records before starting to prevent duplicate execution

---

## 6. API Design

### 6.1 Endpoints

```
POST   /api/v1/scheduled-reports              — create a schedule
GET    /api/v1/scheduled-reports              — list user's schedules (paginated)
GET    /api/v1/scheduled-reports/:id          — get schedule detail
PATCH  /api/v1/scheduled-reports/:id          — update schedule (params, cadence, recipients)
DELETE /api/v1/scheduled-reports/:id          — soft-delete (sets status=deleted)
POST   /api/v1/scheduled-reports/:id/pause    — pause schedule
POST   /api/v1/scheduled-reports/:id/resume   — resume schedule
POST   /api/v1/scheduled-reports/:id/trigger  — manually trigger an immediate run
GET    /api/v1/scheduled-reports/:id/runs     — list run history (paginated)
GET    /api/v1/scheduled-reports/:id/runs/:runId — get single run detail
```

### 6.2 Create Request Body Example

```json
{
  "report_type": "revenue_summary",
  "report_params": {
    "date_range": "last_30_days",
    "filters": { "region": "north_america" }
  },
  "cadence": {
    "type": "weekly",
    "day_of_week": "monday",
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "delivery_format": "pdf",
  "recipients": [
    { "type": "user", "value": "uuid-of-teammate" },
    { "type": "email", "value": "external-stakeholder@example.com" }
  ]
}
```

### 6.3 Authorization Rules

| Action | Who can do it |
|--------|--------------|
| Create | Any user in the org with report access |
| View/Edit/Delete own | The creator |
| View/Edit/Delete any | Org admin (P1) |
| Trigger manual run | Creator or admin |
| Add external email recipients | Configurable org-level setting (allow/deny) |

---

## 7. Frontend UX

### 7.1 Entry Points

- **From report viewer:** "Schedule this report" button on any on-demand report (pre-fills report type and current params)
- **From dedicated page:** "Scheduled Reports" section in navigation, showing list of all user's schedules with status badges

### 7.2 Schedule Builder Flow

```
Step 1: Select Report Type
  └─ Dropdown of available report types (with descriptions)

Step 2: Configure Parameters
  └─ Dynamic form based on report type's parameter schema
  └─ Same UI components as the on-demand report builder

Step 3: Set Cadence
  └─ Quick picks: Daily, Weekly (pick day), Monthly (pick date)
  └─ Time of day picker + timezone selector
  └─ (P2: Advanced — raw cron expression input)
  └─ Preview: "This report will run every Monday at 9:00 AM EST. Next run: Feb 16, 2026"

Step 4: Choose Recipients & Format
  └─ Search/select team members from org
  └─ Optional: add external email addresses
  └─ Format: PDF / CSV / Both
  └─ Option: "Also send to me" (default checked)

Step 5: Review & Confirm
  └─ Summary of all selections
  └─ "Create Schedule" button
```

### 7.3 Schedule List View

Table with columns:
- Report name/type
- Cadence (human-readable, e.g., "Weekly on Mondays at 9am EST")
- Recipients (avatars + count)
- Status (Active / Paused)
- Last run (relative time + status icon)
- Next run (absolute date/time)
- Actions (Edit, Pause/Resume, Delete, Run Now)

---

## 8. Operational Concerns

### 8.1 Rate Limits & Guardrails

| Guardrail | Recommended Limit | Rationale |
|-----------|--------------------|-----------|
| Max schedules per user | 25 | Prevent runaway creation |
| Max schedules per org | 200 | Capacity planning |
| Max recipients per schedule | 50 | Email send rate limits |
| Min cadence interval | 1 hour | Prevent accidental minute-level scheduling |
| Max report generation time | 5 minutes | Kill and fail long-running reports |
| Report artifact max size | 50 MB | Storage and email attachment limits |

### 8.2 Monitoring & Alerting

- **Scheduler health:** alert if the scheduler hasn't run in 2+ minutes
- **Queue depth:** alert if pending jobs exceed 500 (capacity issue)
- **Failure rate:** alert if >10% of runs in the last hour failed
- **Stuck runs:** alert if any run has been in `generating` state for >10 minutes
- **Run latency:** track p50/p95/p99 of end-to-end run time (generation + delivery)

### 8.3 Data Retention

- **Run history:** keep for 90 days, then archive/purge
- **Report artifacts:** keep for 30 days (configurable per org), then delete from object storage
- **Soft-deleted schedules:** hard-delete after 30 days

### 8.4 Multi-Tenancy Isolation

- All queries scoped by `org_id` — no cross-tenant data leaks
- Per-org queue priority (prevent one org's 500 schedules from starving others) — implement via separate queues or weighted fair scheduling
- Resource accounting: track report generation CPU/time per org for future billing

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Cron expression parsing and next-run-time calculation
- Report parameter schema validation per report type
- Authorization rule enforcement
- Idempotency key generation and deduplication logic

### 9.2 Integration Tests
- Full pipeline: create schedule → scheduler picks it up → worker generates → artifact stored → email sent (use mocked email/storage)
- Pause/resume lifecycle
- Failure handling: report generation error → run marked failed → next run still scheduled
- Timezone correctness: schedule at "9am EST" actually fires at the right UTC instant across DST boundaries

### 9.3 Load / Soak Tests
- Simulate 10K active schedules all due at the same minute — verify throughput and no duplicate runs
- Simulate steady state for 48 hours — verify no memory leaks, no schedule drift

### 9.4 Manual / QA Scenarios
- Create schedule, wait for first delivery, verify email content
- Edit schedule mid-cadence, verify next run reflects the change
- Delete schedule, verify no further runs occur
- External recipient receives email with working report link

---

## 10. Migration & Rollout Plan

### Phase 0 — Foundation (if needed)
- [ ] Verify or build background job infrastructure
- [ ] Verify or build email delivery pipeline (attachments, templates)
- [ ] Verify or build object storage for report artifacts

### Phase 1 — Backend Core (est. 2-3 sprints)
- [ ] Database migrations for new tables + indexes
- [ ] CRUD API for scheduled reports
- [ ] Scheduler service (polling-based)
- [ ] Report worker pipeline (validate → generate → store → deliver → record)
- [ ] Idempotency and concurrency safety
- [ ] Basic monitoring and alerting

### Phase 2 — Frontend (est. 1-2 sprints, can overlap with Phase 1)
- [ ] Schedule builder wizard UI
- [ ] Schedule list view with status, history, actions
- [ ] "Schedule this report" entry point from existing report viewer
- [ ] Run history detail view

### Phase 3 — Hardening (est. 1 sprint)
- [ ] Rate limits and guardrails enforced
- [ ] Failure notification to schedule creator
- [ ] Data retention jobs (artifact cleanup, run history pruning)
- [ ] Load testing and performance tuning
- [ ] QA sign-off on all manual test scenarios

### Phase 4 — Rollout
- [ ] Feature flag: enable for internal team first
- [ ] Beta: enable for 5-10 design-partner customers
- [ ] GA: enable for all customers, announce in changelog

---

## 11. Open Questions

These should be resolved before or during Phase 1:

1. **Report generation isolation** — Should scheduled report generation run in the same process pool as on-demand reports, or a separate pool? Separate prevents scheduled load from degrading interactive experience but increases infrastructure cost.

2. **Timezone handling on cadence** — Do we always honor the user's configured timezone (including DST shifts), or do we let them choose UTC? Recommendation: always IANA timezone with DST awareness.

3. **Billing impact** — Are scheduled reports metered? Do they count against usage quotas? If so, what happens when a user hits their quota mid-cadence — skip the run? Pause the schedule? Notify?

4. **Artifact storage location** — Use the same object storage as the rest of the platform, or a dedicated bucket with its own lifecycle policy? Dedicated bucket simplifies retention management.

5. **External recipients** — Should external email addresses (non-org members) be allowed? If yes, should there be domain allowlisting or admin approval? This has security and data-leakage implications.

6. **Report type eligibility** — Are all existing report types eligible for scheduling, or should report type owners opt-in? Some reports may be expensive or not meaningful on a recurring basis.

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Large reports cause worker OOM or timeout | Medium | High | Enforce artifact size limit; stream generation; set worker memory ceiling |
| Clock skew across instances causes duplicate runs | Low | Medium | Idempotency keys + `SKIP LOCKED` pattern |
| Email delivery failures (rate limits, bounces) | Medium | Medium | Retry with exponential backoff; track bounce rates; surface delivery status in UI |
| Timezone/DST bugs cause runs at wrong time | Medium | High | Use well-tested library (e.g., `luxon`, `pytz`); integration test across DST boundaries |
| User creates schedule, leaves company — schedule runs forever | Medium | Low | Org admin management (P1); stale schedule detection (no opens in 90 days → auto-pause) |
| One org's schedules starve others | Low | High | Per-org queue fairness; concurrency limits per org |

---

*This plan is complete. Implementation should not begin until the open questions in Section 11 are resolved with Product and Engineering stakeholders.*
