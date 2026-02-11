# Scheduled Reports: Feature Plan

## Status

**Planning -- not yet validated.** This plan identifies the decisions, architecture, risks, and phases for building scheduled report delivery. Several critical unknowns (marked with **[UNKNOWN]** throughout) must be resolved before implementation begins.

---

## 0. Critical Unknowns

These questions must be answered before the plan can be finalized. Each one materially changes the architecture, scope, or phasing.

| # | Question | Why It Matters | Impact If Wrong |
|---|----------|---------------|-----------------|
| 1 | **Do on-demand reports already exist in the product?** | If yes, we're adding scheduling to an existing system, not building reports from scratch. The generator, data queries, and output formatting may already exist. | Building a parallel report system when we could extend the existing one. Months of wasted work. |
| 2 | **What is the existing tech stack?** (Language, framework, database, existing job/queue infrastructure) | Every technology choice in this plan depends on it. | Designing for Node.js when the platform is Python, or proposing Redis queues when the team already runs RabbitMQ. |
| 3 | **What report types does Product want for launch?** (Specific names and descriptions) | Determines data model complexity, query patterns, and whether we need a pluggable generator or can hardcode 2-3 types. | Over-engineering a plugin system for 2 reports, or under-engineering for 20. |
| 4 | **Is this a premium/gated feature?** (Available to all tiers or only paid plans? Per-tier schedule limits?) | Affects data model (need plan-level limits), API (need entitlement checks), and UI (need upgrade prompts). | Shipping without tier enforcement, then scrambling to add it retroactively across the stack. |
| 5 | **What is the expected scale?** (Number of organizations, users, and estimated scheduled reports at 6 and 12 months) | Determines whether we need distributed workers and queues at all, or whether a cron job is fine for v1. | Over-provisioning infrastructure for 50 users, or under-provisioning for 50,000. |
| 6 | **What delivery channels does Product actually want for v1?** (Email only? Slack? Webhooks? In-app?) | Each channel adds integration work, error handling, and recipient management complexity. | Building Slack and webhook delivery that nobody uses at launch. |
| 7 | **Who are the recipients?** (Only users within the same org? External email addresses? Stakeholders without accounts?) | External recipients change the security model, require consent flows, and affect compliance. | Shipping external email without consent management, creating compliance exposure. |

**Proceed with architecture design after questions 1-3 are answered. Questions 4-7 can be resolved during Phase 1 design.**

---

## 1. Feature Definition

### What We're Building

Users can take any report available in the product and schedule it for recurring automatic generation and delivery. They pick a report type, set when it should run, choose who receives it, and the system handles the rest.

### Core User Stories

| Story | Priority | Notes |
|-------|----------|-------|
| As a user, I can select a report type and schedule it to run on a cadence (daily, weekly, monthly) | P0 | Core feature |
| As a user, I can specify who receives each scheduled report | P0 | Must support at least internal users by email |
| As a user, I can choose the output format (CSV, PDF, Excel) | P0 | Minimum: CSV. PDF and Excel can come later if needed. |
| As a user, I can see all my scheduled reports and their status | P0 | List view with last run status, next run time |
| As a user, I can pause, resume, edit, or delete a scheduled report | P0 | Standard lifecycle management |
| As a user, I can see the execution history for a report and download past runs | P1 | Debugging and audit trail |
| As a user, I can trigger a scheduled report immediately ("Run Now") | P1 | Testing and ad-hoc needs |
| As a user, I can preview the next 5 scheduled run times before saving | P2 | Reduces scheduling mistakes |
| As a user, I receive a notification when a scheduled report fails | P1 | Creator should know about failures |
| As an admin, I can see all scheduled reports across my organization | P1 | Operational visibility |
| As an admin, I can set limits on scheduled reports per user or team | P2 | Resource governance |

### Explicit Non-Goals for v1

- **Report builder/designer.** Users schedule existing report types, not custom queries.
- **Real-time/streaming reports.** Scheduled reports are batch jobs, not live dashboards.
- **Cross-organization sharing.** Reports stay within the organization boundary.
- **Mobile-specific UI.** Desktop-first; mobile can use responsive layout.

---

## 2. Architecture

### Guiding Principles

1. **Extend, don't duplicate.** If the product already generates reports, the scheduler invokes the existing generation logic. We do not build a second report engine.
2. **Timezone-correct from day one.** All internal timestamps are UTC. User-facing times convert through an explicit timezone stored on each schedule. No shortcuts.
3. **Decouple schedule from generation from delivery.** These are three distinct concerns that fail independently and should be retried independently.
4. **Tenant isolation.** One organization's heavy reports must not degrade service for others. This means per-tenant rate limiting at the queue level, not just API rate limiting.
5. **Observability from day one.** Every scheduled run produces a traceable execution record with timing, status, and error details. This is not a Phase 6 concern.

### System Components

```
                          ┌──────────────────────────┐
                          │       User Interface      │
                          │  Schedule management UI   │
                          │  integrated into existing │
                          │  Reports section          │
                          └────────────┬─────────────┘
                                       │
                                       ▼
                          ┌──────────────────────────┐
                          │        API Layer          │
                          │  REST endpoints           │
                          │  AuthN / AuthZ            │
                          │  Entitlement checks       │
                          │  Rate limiting            │
                          └──┬──────────┬──────────┬─┘
                             │          │          │
                    ┌────────┘          │          └────────┐
                    ▼                   ▼                   ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │ Schedule Manager│ │ Execution Engine │ │ Delivery Service│
          │                 │ │                  │ │                 │
          │ CRUD operations │ │ Report generator │ │ Email, Slack,   │
          │ Next-run calc   │ │ Output formatter │ │ webhook, in-app │
          │ Validation      │ │ File storage     │ │ Retry logic     │
          └────────┬────────┘ └────────┬─────────┘ └────────┬────────┘
                   │                   │                     │
                   ▼                   ▼                     ▼
          ┌──────────────────────────────────────────────────────────┐
          │                     Data Layer                           │
          │  PostgreSQL: schedules, executions, deliveries, recipients│
          │  Object Storage: generated report files                  │
          │  Cache/Queue: job queue, rate limit counters             │
          └──────────────────────────────────────────────────────────┘

          ┌──────────────────────────────────────────────────────────┐
          │                    Scheduler (Clock)                     │
          │  Runs on interval (e.g., every 60s)                     │
          │  Queries for due schedules                              │
          │  Enqueues generation jobs                               │
          │  Distributed-lock protected (single leader)             │
          └──────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Scheduler (Clock Process)**
- Runs periodically (every 60 seconds)
- Queries `scheduled_reports` for rows where `next_run_at <= NOW()` and `is_active = true`
- Creates an `execution` record (status: `queued`)
- Enqueues a generation job onto the job queue
- Advances `next_run_at` to the next occurrence
- Protected by a distributed lock so only one instance runs the poll cycle at a time (prevents double-enqueue in multi-instance deployments)
- Implements catch-up logic: if the scheduler was down, it finds overdue reports and runs them in chronological order, skipping any that overlap with already-running executions

**Execution Engine (Workers)**
- Consumes generation jobs from the queue
- Loads the report type definition and user-supplied parameters
- Invokes the report generation logic (ideally the same code path as on-demand reports **[UNKNOWN: depends on whether existing report generation exists]**)
- Streams data to the output formatter (CSV writer, PDF renderer, Excel builder)
- Uploads the finished file to object storage
- Updates the execution record with status, file URL, timing, and row count
- On success: enqueues one delivery job per recipient
- On failure: updates execution record, applies retry policy (up to 3 attempts with exponential backoff), notifies the schedule creator on final failure
- Per-tenant concurrency limits prevent one org from monopolizing the worker pool

**Delivery Service (Workers)**
- Consumes delivery jobs from the queue
- Sends the report via the recipient's channel (email with attachment or download link, Slack message, webhook POST, in-app notification)
- Records delivery status per recipient
- Retries transient failures (network errors, rate limits) with backoff
- Does NOT retry permanent failures (bounced email, invalid Slack channel)
- For large files (>10MB), sends a download link instead of an attachment

**Schedule Manager (API)**
- CRUD operations on scheduled reports
- Validates that the user has permission to access the specified report type
- Validates recipients (internal users exist and are in the same org; external emails subject to org policy)
- Enforces per-user and per-org schedule limits based on SaaS tier **[UNKNOWN: depends on whether feature is tiered]**
- Computes and returns the next N run times for preview

---

## 3. Data Model

### Design Decisions

**Recipients are a separate table**, not embedded JSON. This enables:
- Querying "which schedules deliver to user X?" (needed for unsubscribe, user deletion, audit)
- Foreign key integrity for internal user recipients
- Per-recipient delivery preferences and opt-out
- Clean audit trail of recipient changes

**Schedule configuration is structured JSON** (not a raw cron string for the common cases). The UI presents simple cadence options; cron is available as an advanced escape hatch. The JSON is validated on write and always accompanied by a pre-computed `next_run_at` timestamp so the scheduler can query with a simple index scan.

**Report parameters are opaque JSON** scoped by report type. Each report type defines its own parameter schema (date ranges, filters, groupings). Validation is delegated to the report type's parameter validator, not the scheduling system.

### Schema

```sql
-- The schedule: what, when, and configuration
CREATE TABLE scheduled_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by      UUID NOT NULL REFERENCES users(id),
    updated_by      UUID NOT NULL REFERENCES users(id),

    -- What to generate
    name            TEXT NOT NULL,
    report_type     TEXT NOT NULL,           -- e.g., 'invoice_summary', 'usage_report'
    report_params   JSONB NOT NULL DEFAULT '{}',
    output_format   TEXT NOT NULL DEFAULT 'csv',  -- 'csv', 'pdf', 'xlsx'

    -- When to run
    schedule_config JSONB NOT NULL,
    /*
        Standard cadences:
        { "cadence": "daily",   "time": "09:00", "timezone": "America/New_York" }
        { "cadence": "weekly",  "time": "09:00", "timezone": "America/New_York", "day_of_week": 1 }
        { "cadence": "monthly", "time": "09:00", "timezone": "America/New_York", "day_of_month": 1 }

        Advanced:
        { "cadence": "cron", "cron_expression": "0 9 * * 1-5", "timezone": "America/New_York" }
    */
    next_run_at     TIMESTAMPTZ NOT NULL,
    last_run_at     TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,             -- distinct from last_run_at; useful for alerting

    -- Lifecycle
    is_active       BOOLEAN NOT NULL DEFAULT true,
    paused_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the scheduler's hot path
CREATE INDEX idx_scheduled_reports_next_run
    ON scheduled_reports (next_run_at)
    WHERE is_active = true;

CREATE INDEX idx_scheduled_reports_org
    ON scheduled_reports (organization_id);

-- Recipients: who receives each report
CREATE TABLE schedule_recipients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL,        -- 'email', 'slack', 'webhook', 'in_app'
    destination         TEXT NOT NULL,        -- email address, Slack channel ID, webhook URL, user ID
    user_id             UUID REFERENCES users(id),  -- NULL for external emails / webhooks
    is_active           BOOLEAN NOT NULL DEFAULT true,
    added_by            UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (scheduled_report_id, channel, destination)
);

CREATE INDEX idx_schedule_recipients_user
    ON schedule_recipients (user_id)
    WHERE user_id IS NOT NULL;

-- Execution: each run of a scheduled report
CREATE TABLE report_executions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id),
    scheduled_for       TIMESTAMPTZ NOT NULL, -- the intended run time
    status              TEXT NOT NULL DEFAULT 'queued',
                        -- 'queued', 'running', 'completed', 'failed', 'cancelled'
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    duration_ms         INTEGER,

    -- Output
    file_url            TEXT,                 -- object storage path
    file_size_bytes     BIGINT,
    row_count           INTEGER,
    output_format       TEXT,

    -- Errors
    error_message       TEXT,
    error_category      TEXT,                 -- 'transient', 'permanent', 'timeout'
    retry_count         INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    report_params_snapshot JSONB,             -- frozen copy of params at execution time
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_executions_schedule
    ON report_executions (scheduled_report_id, created_at DESC);

CREATE INDEX idx_report_executions_status
    ON report_executions (status)
    WHERE status IN ('queued', 'running');

-- Delivery: per-recipient delivery tracking
CREATE TABLE report_deliveries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_execution_id UUID NOT NULL REFERENCES report_executions(id),
    recipient_id        UUID NOT NULL REFERENCES schedule_recipients(id),
    status              TEXT NOT NULL DEFAULT 'pending',
                        -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
    channel             TEXT NOT NULL,
    destination         TEXT NOT NULL,
    sent_at             TIMESTAMPTZ,
    error_message       TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_deliveries_execution
    ON report_deliveries (report_execution_id);
```

### Key Differences from Sonnet's Model

| Aspect | Sonnet | This Plan | Why |
|--------|--------|-----------|-----|
| Recipients | JSONB array on scheduled_reports | Separate `schedule_recipients` table | Queryable, FK-enforced, supports per-recipient unsubscribe |
| Last success | Not tracked | `last_success_at` column | Enables "hasn't succeeded in N days" alerting |
| Updated_by | Not tracked | `updated_by` column | Audit trail for schedule changes |
| Paused timestamp | Not tracked | `paused_at` column | Enables "paused for X days" reporting |
| Execution params | Not stored | `report_params_snapshot` on execution | Allows reproducing/debugging past runs even if schedule params later changed |
| Error categorization | Single error_message | `error_message` + `error_category` | Enables smarter retry (don't retry permanent errors) |
| Scheduled_for | Not tracked | `scheduled_for` on execution | Distinguishes intended time from actual start time; important for catch-up runs |
| Recipient FK on delivery | Not linked | `recipient_id` FK | Enables per-recipient delivery analytics and preference management |

---

## 4. API Design

```
POST   /api/v1/scheduled-reports              Create a new scheduled report
GET    /api/v1/scheduled-reports              List user's scheduled reports (filterable)
GET    /api/v1/scheduled-reports/:id          Get schedule details + next run times
PUT    /api/v1/scheduled-reports/:id          Update schedule configuration
DELETE /api/v1/scheduled-reports/:id          Delete a schedule (soft delete)

POST   /api/v1/scheduled-reports/:id/pause    Pause a schedule
POST   /api/v1/scheduled-reports/:id/resume   Resume a paused schedule
POST   /api/v1/scheduled-reports/:id/run      Trigger immediate execution

GET    /api/v1/scheduled-reports/:id/executions       Execution history (paginated)
GET    /api/v1/scheduled-reports/:id/executions/:eid  Single execution details + deliveries
GET    /api/v1/report-executions/:eid/download        Download generated file (signed URL)

POST   /api/v1/scheduled-reports/:id/recipients       Add a recipient
DELETE /api/v1/scheduled-reports/:id/recipients/:rid   Remove a recipient

# Admin endpoints
GET    /api/v1/admin/scheduled-reports                 Org-wide list (admin only)
GET    /api/v1/admin/scheduled-reports/stats            Execution stats (admin only)
```

### Create Request Shape

```json
{
  "name": "Weekly Sales Summary",
  "report_type": "sales_summary",
  "report_params": {
    "date_range": "last_7_days",
    "group_by": "region"
  },
  "output_format": "pdf",
  "schedule": {
    "cadence": "weekly",
    "day_of_week": 1,
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "recipients": [
    { "channel": "email", "destination": "alice@company.com" },
    { "channel": "email", "destination": "bob@company.com" }
  ]
}
```

### Create Response Shape

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Weekly Sales Summary",
  "report_type": "sales_summary",
  "schedule": {
    "cadence": "weekly",
    "day_of_week": 1,
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "next_run_at": "2026-02-16T14:00:00Z",
  "upcoming_runs": [
    "2026-02-16T14:00:00Z",
    "2026-02-23T14:00:00Z",
    "2026-03-02T14:00:00Z",
    "2026-03-09T13:00:00Z",
    "2026-03-16T13:00:00Z"
  ],
  "recipients": [
    { "id": "...", "channel": "email", "destination": "alice@company.com" },
    { "id": "...", "channel": "email", "destination": "bob@company.com" }
  ],
  "is_active": true,
  "created_at": "2026-02-10T18:30:00Z"
}
```

Note the `upcoming_runs` array -- this lets the UI show users when their report will fire next. The March 9 entry shows 13:00 UTC instead of 14:00 because of DST transition (Eastern goes from EST to EDT). This is the kind of detail that makes timezone handling visible to users.

---

## 5. Authorization Model

This is the area Sonnet under-specified. For a SaaS platform, authorization is not just "check permissions" -- it determines the entire data flow.

### Principle

The report generator must enforce the same data access rules as the application UI. A user should never receive a scheduled report containing data they couldn't see if they opened the application and ran the same report manually.

### Design Options

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **A: Run as user** | Generator impersonates the schedule creator and uses the application's existing data access layer | Automatically enforces all existing access rules | Creator loses access to data → report silently shrinks. Need to handle token/session for background job. |
| **B: Pre-scoped queries** | Generator uses service-level DB access but applies the same scoping filters (org_id, team_id, role-based data visibility) | No user impersonation needed; works naturally in background jobs | Must replicate access logic; risk of divergence from UI access rules |
| **C: Snapshot permissions** | At schedule creation time, snapshot the user's data access scope; generator uses that snapshot | Deterministic; report content doesn't change unless explicitly refreshed | Stale permissions; user gains access to new data but report doesn't reflect it |

**Recommendation:** Option B for most SaaS platforms. The report generator queries data through the application's data layer, passing the organization_id and any relevant scope (team, role, data classification). This is the same pattern the existing report generation likely already uses.

**Validation rules at schedule creation:**
- User must have `reports.read` permission for the specified `report_type`
- User must belong to the specified `organization_id`
- All internal recipients must belong to the same organization
- External recipients subject to org-level policy setting **[UNKNOWN: requires answer to question 7]**
- Number of active schedules must be within the user's tier limit **[UNKNOWN: requires answer to question 4]**

---

## 6. Operational Concerns

### Tenant Isolation

In a multi-tenant SaaS, one organization running a report over 10 million rows must not cause another organization's simple 50-row daily summary to be delayed by 30 minutes.

**Approach: Per-tenant concurrency limits at the queue level.**

- Each organization gets a maximum of N concurrent report generation jobs (e.g., 3 for standard tier, 10 for enterprise)
- When an org is at its limit, additional jobs remain queued but don't consume worker capacity
- Workers pull from a fair queue that round-robins across organizations with pending work, not a simple FIFO

This must be designed into the queue architecture from the start. Retrofitting it is painful.

### Scheduler Reliability

The scheduler is a single point of failure. If it stops polling, no reports run.

**Mitigations:**
- Run the scheduler behind a distributed lock (e.g., database advisory lock, Redis lock, or leader election). Multiple instances can be deployed but only one polls at a time. If the leader dies, another takes over.
- Health check: if `scheduled_reports` has rows where `next_run_at < NOW() - INTERVAL '5 minutes'` and `is_active = true` and no execution is `queued` or `running`, fire an alert. Something is wrong.
- Catch-up: when the scheduler starts (or a new leader is elected), it finds all overdue reports and processes them in chronological order.

### Idempotency

The scheduler must not double-enqueue. If it runs, enqueues a job, then crashes before updating `next_run_at`, the next poll will see the same report as due.

**Solution:** Before enqueuing, check for an existing `queued` or `running` execution for that scheduled_report where `scheduled_for` matches the current intended run time. Skip if one exists. This makes the enqueue operation idempotent.

### File Retention

Generated report files accumulate in object storage.

**Policy:**
- Default retention: 90 days
- Apply object storage lifecycle rules to auto-delete expired files
- Run a nightly cleanup job to delete `report_executions` rows (or at least null out `file_url`) for expired files
- Allow org admins to configure shorter retention (cost savings) or request longer retention (compliance)
- **Always** make the retention period visible to users: "Reports are available for download for 90 days."

---

## 7. Phasing

### Phase 1: Usable End-to-End (Weeks 1-5)

**Goal:** A user can schedule a report through the UI and receive it by email. Nothing fancy. The entire pipeline works.

**Scope:**
- Database schema (all tables above -- build it right from the start)
- API: create, read, update, delete, pause, resume, run-now
- Scheduler: single-instance, runs every 60 seconds, with distributed lock
- Execution engine: supports 1-2 report types (the most requested ones -- **[UNKNOWN]**)
- Output: CSV only (simplest to implement, validates the pipeline)
- Delivery: email only (attachment for small files, download link for large)
- UI: schedule creation form, schedule list view, execution history list
  - Integrated into the existing Reports section of the product, not a separate page
  - Simple cadence picker (daily / weekly / monthly) with time and timezone
- Basic observability: execution records with status, timing, and errors
- Timezone handling: built in from the start, tested across DST boundaries

**What this phase proves:**
- The scheduling pipeline works end-to-end
- Users understand the UX and can complete the scheduling flow
- The data model supports real usage patterns
- The timezone approach is correct

**Success criteria:**
- A user can create a weekly CSV report and receive it by email at the right time in their timezone
- Execution history shows status and allows re-download
- Pause/resume works
- Run-now works
- No double-sends; no missed runs over a 1-week test period

### Phase 2: Report Quality (Weeks 6-9)

**Goal:** Reports are useful and professional, not just technically deliverable.

**Scope:**
- Additional report types (3-5 total -- driven by product priority)
- PDF output with professional formatting, headers, branding
- Excel output with proper column types, formatting, and sheet names
- Streaming generation for large datasets (target: handle 500K+ rows without OOM)
- Report parameter validation per report type (date ranges, filters, valid options)
- "Preview" mode: generate a sample of the report without scheduling (helps users verify parameters)
- Empty report handling: generate a report with "No data for selected period" message, or optionally skip delivery (user-configurable)

**Success criteria:**
- PDF and Excel outputs are professional enough that users would share them with external stakeholders
- A report with 500K rows generates successfully within 5 minutes
- Users can preview report output before scheduling

### Phase 3: Delivery and Recipient Management (Weeks 10-13)

**Goal:** Reports reach the right people through the right channels, and recipients have control.

**Scope:**
- Additional delivery channels (Slack, webhook -- as demanded by users)
- Recipient management: recipients can unsubscribe from a report without involving the creator
- Recipient consent: external email recipients receive a one-time confirmation before scheduled delivery begins **[UNKNOWN: depends on external recipient policy]**
- Delivery retry with category-aware backoff (transient errors retry; permanent errors don't)
- Failure notifications to the schedule creator (in-app + email)
- Download link fallback: even if email delivery fails, the report is available in-app
- Per-recipient delivery status visible in execution history

**Success criteria:**
- Recipients can self-manage their subscriptions
- Delivery failures are retried appropriately and the creator is notified
- A failed email delivery does not block other recipients from receiving the report

### Phase 4: Scale and Operations (Weeks 14-17)

**Goal:** The system handles production load reliably and is operable by the team.

**Scope:**
- Per-tenant concurrency limits (fair queuing across organizations)
- Horizontal scaling of workers (auto-scale based on queue depth)
- Advanced scheduling: cron expressions, business-day awareness, skip weekends/holidays
- Query optimization: read replicas for report data queries, query timeouts
- Monitoring dashboard: queue depth, execution latency (p50/p95/p99), success rate, storage usage
- Alerting: failed execution rate > threshold, scheduler health, queue backlog, worker pool health
- Admin UI: org-wide report list, execution stats, ability to disable a runaway schedule
- Rate limiting: per-user and per-org limits on schedule creation and run-now

**Success criteria:**
- System handles 1,000+ active schedules across 100+ organizations
- No single tenant can degrade performance for others
- Ops team can identify and resolve issues using the monitoring dashboard
- Alerts fire within 5 minutes of an anomaly

### Phase 5: Polish and Extend (Weeks 18+)

**Goal:** The feature is mature, delightful, and cost-optimized.

**Scope:**
- Visual cron builder for advanced schedules
- Report caching: if the same report (same type, params, and data window) was recently generated, serve the cached version instead of regenerating
- Cost optimization: storage lifecycle tiers, spot instances for workers, compression
- SaaS tier integration: schedule limits by plan, upgrade prompts
- Audit log: all schedule and delivery events queryable by org admins
- GDPR/compliance: data export, deletion of scheduled reports and generated files on user request
- Template sharing: allow users to share a schedule configuration with teammates (clone a schedule)

---

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Reports query production database under load** | High | Use read replicas for all report data queries. Add query timeouts (30s default). Monitor slow queries. |
| **Timezone bugs cause reports to fire at wrong times** | High | Use a well-tested library (not hand-rolled math). Store timezone name (IANA), not offset. Write explicit tests for DST spring-forward and fall-back transitions. Show users their next 5 run times to catch mistakes before they happen. |
| **Long-running reports block the worker pool** | High | Per-report execution timeout (configurable, default 10 min). Per-tenant concurrency limits. Separate queue priorities for fast vs. slow reports if the pattern emerges. |
| **Scheduler becomes a single point of failure** | Medium | Distributed lock with automatic failover. Health monitoring. Catch-up logic for missed runs. |
| **Email deliverability degrades** | Medium | Use a reputable transactional email provider. Proper SPF/DKIM/DMARC. Monitor bounce rates. Always provide in-app download as a fallback. |
| **Storage costs grow unchecked** | Medium | Enforce retention policies from day one. Lifecycle rules for tier migration (e.g., to cheaper storage after 30 days). Track storage per org. |
| **Report data doesn't match what user sees in the UI** | Medium | Document that reports reflect data at generation time, not viewing time. Include generation timestamp prominently in every report. If the application supports it, use consistent-read transactions. |
| **Users create too many schedules, overwhelming the system** | Low (at first) | Per-user and per-org limits. Monitoring. Can adjust limits dynamically. |

---

## 9. Testing Strategy

### Tests That Actually Matter for This Feature

Standard unit/integration/e2e testing applies. Here are the tests specific to scheduled reports that are easy to miss:

**Timezone correctness:**
- Schedule a report for "9 AM Eastern" and verify it runs at 14:00 UTC during EST (UTC-5) and 13:00 UTC during EDT (UTC-4)
- Schedule a report right before a DST transition and verify the next two runs are at the correct UTC times
- Schedule a monthly report for "the 31st" and verify it handles February, April, June, September, November correctly

**Scheduler reliability:**
- Stop the scheduler for 3 hours while reports come due. Restart it. Verify all overdue reports are caught up without double-execution.
- Run two scheduler instances simultaneously. Verify only one acquires the lock and no double-enqueues occur.

**Execution isolation:**
- Enqueue 10 reports for Org A (each takes 5 minutes) and 1 report for Org B. Verify Org B's report completes within its SLA, not after Org A's backlog.

**Delivery independence:**
- Generate a report with 3 recipients. Fail delivery to recipient 2. Verify recipients 1 and 3 still receive the report, and recipient 2 is retried.

**Idempotency:**
- Call the scheduler poll twice in rapid succession for the same `next_run_at`. Verify only one execution is created.

**Large report handling:**
- Generate a report with 1M rows in CSV format. Verify it completes without OOM, the file is correctly formatted, and it can be downloaded.

---

## 10. Technology Recommendations

These are conditional on the existing stack. **[UNKNOWN: depends on answer to question 2]**

| Component | If Node.js/TS | If Python | If Ruby/Rails | Cloud-Native |
|-----------|--------------|-----------|---------------|-------------|
| Job Queue | BullMQ + Redis | Celery + Redis/RabbitMQ | Sidekiq + Redis | SQS + Lambda |
| Scheduler | BullMQ repeatable jobs or custom poller | Celery Beat or custom poller | Sidekiq-Cron or custom poller | EventBridge rules |
| PDF Generation | Puppeteer or PDFKit | WeasyPrint or ReportLab | Prawn or WickedPDF | Lambda + Puppeteer layer |
| Object Storage | S3 via AWS SDK | S3 via boto3 | S3 via aws-sdk | S3 (native) |
| Email | SendGrid or AWS SES | SendGrid or AWS SES | SendGrid or AWS SES | SES (native) |
| Timezone Library | date-fns-tz or Luxon | zoneinfo (stdlib) or pytz | ActiveSupport::TimeZone | Depends on runtime |
| Distributed Lock | Redlock or DB advisory lock | Redlock or DB advisory lock | Redlock or DB advisory lock | DynamoDB lock or SQS FIFO dedup |

**Avoid moment.js** -- it is deprecated and in maintenance mode. Use Luxon, date-fns, or the Temporal API if available.

---

## 11. What This Plan Does NOT Cover

- **Specific report type implementations.** Each report type needs its own query, parameter schema, and output template. That's feature work, not platform architecture.
- **UI wireframes or design specs.** The plan defines what the UI needs to do, not what it looks like. Design should collaborate here.
- **Pricing/packaging.** Whether scheduled reports are free, premium, or metered is a business decision. The plan supports all options via configurable limits.
- **Migration from any existing scheduling system.** If there's a legacy approach being replaced, migration planning is a separate effort.

---

## Appendix: Comparison with Sonnet's Plan

This plan differs from Sonnet 4.5's plan in the following key ways:

1. **Starts with unknowns, not answers.** The critical questions are front-and-center, not buried at the end.
2. **Fewer documents.** One document instead of four. Detailed implementation guides (equivalent to Sonnet's Decision Guide) should be written during implementation, not during planning.
3. **UI is in Phase 1, not Phase 5.** Users validate the feature early.
4. **Timezone support is foundational, not Phase 3.** The data model and scheduler assume UTC-with-timezone from day one.
5. **Recipients are a proper table.** Enables querying, FK integrity, unsubscribe, and audit.
6. **Authorization model is explicitly designed.** Not just stated as a goal.
7. **Tenant isolation is addressed.** SaaS-specific concern that Sonnet didn't cover.
8. **Tests focus on the hard problems.** Timezone transitions, scheduler idempotency, tenant isolation -- not just "unit test the validation."
9. **No premature technology choices.** Recommendations are conditional on the stack, not assumed.
10. **Execution records snapshot parameters.** Enables debugging past runs even after the schedule is modified.
