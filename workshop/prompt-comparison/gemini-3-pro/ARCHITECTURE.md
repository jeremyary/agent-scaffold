# System Architecture: Scheduled Reports

This document details the architecture for the Scheduled Reports feature.

## 1. High-Level Diagram

```mermaid
graph TD
    User[User] -->|Create/Manage Schedules| API[API Service]
    API -->|Store Schedule| DB[(Database)]
    API -->|Enqueue Job (optional)| Queue[(Job Queue)]
    
    Scheduler[Scheduler / Cron Worker] -->|Query Due Schedules| DB
    Scheduler -->|Enqueue Job| Queue
    
    Worker[Report Worker] -->|Process Job| Queue
    Worker -->|Fetch Data| DB
    Worker -->|Generate Report| ReportGen[Report Generator]
    Worker -->|Send Email| Email[Email Service]
    Worker -->|Log Result| DB
```

## 2. Component Details

### A. Database Schema (PostgreSQL)

**`report_schedules` Table**

```sql
CREATE TABLE report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL, -- User-friendly name for the schedule
  report_type VARCHAR(50) NOT NULL, -- e.g., 'usage_summary', 'invoice_summary'
  frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  frequency_config JSONB NOT NULL DEFAULT '{}', 
    -- Examples: 
    -- Daily: { "time": "09:00" } (UTC)
    -- Weekly: { "day": 1, "time": "09:00" } (1=Monday)
    -- Monthly: { "date": 1, "time": "09:00" } (1st of month)
  recipients JSONB NOT NULL DEFAULT '[]', -- Array of email strings
  format VARCHAR(10) NOT NULL DEFAULT 'pdf', -- 'pdf', 'csv', 'html'
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'error'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE status = 'active';
```

**`report_execution_logs` Table**

```sql
CREATE TABLE report_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES report_schedules(id),
  status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'success', 'failed'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB -- Store file size, generation time, etc.
);
```

### B. Scheduler Logic

**Strategy: Polling (Robust & Simple)**

1.  **Cron Job**: Runs every minute (e.g., via system cron or a library like `node-cron` / `apscheduler`).
2.  **Query**: 
    ```sql
    SELECT * FROM report_schedules 
    WHERE status = 'active' 
      AND next_run_at <= NOW() 
    LIMIT 100 FOR UPDATE SKIP LOCKED;
    ```
    *Note: `FOR UPDATE SKIP LOCKED` ensures multiple scheduler instances don't pick up the same job.*
3.  **Process**:
    -   For each schedule found:
        -   Calculate the *new* `next_run_at` based on frequency.
        -   Update the record with the new `next_run_at` and set `last_run_at = NOW()`.
        -   Push a job to the Job Queue (e.g., `generate-report` queue) with the `schedule_id` and `report_type`.

### C. Worker Logic (Job Processor)

The worker consumes jobs from the `generate-report` queue.

1.  **Receive Job**: `{ scheduleId: "...", reportType: "usage_summary", ... }`
2.  **Fetch Data**: Retrieve the schedule configuration and necessary report data from the DB.
3.  **Generate**:
    -   **HTML/PDF**: Render an HTML template (e.g., Handlebars/Jinja2) with data, then use a headless browser (Puppeteer/Playwright) or PDF library (WeasyPrint) to convert to PDF.
    -   **CSV**: Use a CSV stringifier library.
4.  **Send**: Construct an email with the file attached. Use a provider API (SendGrid/AWS SES).
5.  **Log**: Update `report_execution_logs` with success/failure status.

## 3. Scalability Considerations

-   **Queue Separation**: Use a dedicated queue for report generation to prevent blocking critical user-facing tasks (like password resets).
-   **Concurrency**: Control the number of concurrent report generations to avoid overloading the DB or memory.
-   **Idempotency**: Ensure the scheduler doesn't trigger the same report multiple times (handled by DB transaction/locking).
-   **Time Zones**: Store all times in UTC. Convert to user's local time only for display in UI.

## 4. Security

-   **Data Access**: Ensure the report generation process respects user permissions (Row-Level Security or strict scoping queries by `user_id`).
-   **Output Handling**: Don't expose generated files publicly. Email attachments are secure; S3 links should be pre-signed and short-lived if used.

