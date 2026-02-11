# Scheduled Reports Feature Plan

This document outlines the architecture and implementation plan for adding scheduled reports to the SaaS platform.

## 1. Feature Overview
Allow users to automate the delivery of specific reports on a recurring schedule (e.g., daily, weekly, monthly) to their team via email or other channels.

## 2. Requirements & Scope
- **Report Types:** Initially support [List Report Types - e.g., Usage Summary, billing, Custom Analytics].
- **Cadence:** Daily, Weekly (pick day), Monthly (pick date).
- **Delivery Methods:** Email (initially), potentially Slack/Teams later.
- **Recipients:** User who created it, or a list of emails.
- **Format:** PDF, CSV, or HTML body.

## 3. Architecture

### High-Level Design
1.  **API Service**: Handles CRUD operations for report schedules.
2.  **Scheduler**: A reliable job scheduler (e.g., BullMQ, Celery, Quartz) to trigger report generation jobs.
3.  **Worker**: A background worker that:
    -   Fetches data for the report.
    -   Generates the report file (PDF/CSV).
    -   Sends the report via email/notification service.
4.  **Database**: Stores schedule configurations and execution logs.

### Data Model (Schema)

#### `report_schedules`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | Owner of the schedule |
| `report_type` | String/Enum | Type of report (e.g., `usage_summary`) |
| `frequency` | String/Enum | `daily`, `weekly`, `monthly` |
| `frequency_config` | JSONB | Specifics (e.g., `{ "day_of_week": 1, "time": "09:00" }`) |
| `recipients` | Array[String] | List of email addresses |
| `format` | String/Enum | `pdf`, `csv` |
| `next_run_at` | Timestamp | Calculated next execution time |
| `status` | String/Enum | `active`, `paused`, `error` |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

#### `report_execution_logs`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `schedule_id` | UUID | FK to `report_schedules` |
| `status` | String/Enum | `success`, `failed` |
| `started_at` | Timestamp | |
| `completed_at` | Timestamp | |
| `error_message` | Text | If failed |
| `file_url` | String | Optional link to generated report (if stored) |

## 4. API Endpoints

- `POST /api/v1/schedules` - Create a new schedule.
- `GET /api/v1/schedules` - List schedules for the user.
- `GET /api/v1/schedules/:id` - Get details of a schedule.
- `PUT /api/v1/schedules/:id` - Update a schedule.
- `DELETE /api/v1/schedules/:id` - Delete/Pause a schedule.
- `POST /api/v1/schedules/:id/test` - Trigger a test run immediately.

## 5. Technology Stack Recommendations
- **Backend**: [Your Current Stack - e.g., Node.js/Python]
- **Database**: PostgreSQL (for reliability and JSONB support).
- **Queue/Scheduler**: Redis + BullMQ (Node) / Celery (Python) for robust job handling.
- **Email Service**: SendGrid / AWS SES / Postmark.
- **PDF Generation**: Puppeteer / Playwright (Node) or WeasyPrint (Python).

## 6. Implementation Plan

### Phase 1: Foundation
1.  **Database Migration**: Create `report_schedules` and `report_execution_logs` tables.
2.  **API Implementation**: Build CRUD endpoints for managing schedules.
3.  **Frontend UI**: Create a "Scheduled Reports" tab in settings.
    -   Form to select report type, frequency, and recipients.

### Phase 2: The Engine
1.  **Scheduler Setup**: Implement the logic to check for due schedules.
    -   *Option A (Cron-like)*: Run a job every minute that queries `report_schedules` where `next_run_at <= NOW()` and `status = 'active'`.
    -   *Option B (Queue)*: When a schedule is created/updated, calculate the delay and add a delayed job to the queue.
2.  **Worker Implementation**:
    -   **Job Processor**: Receives the job (schedule ID).
    -   **Data Fetching**: Queries the necessary data for the report type.
    -   **Generation**: Converts data to the requested format (CSV/PDF).
    -   **Delivery**: Sends the email with attachment.
    -   **Logging**: Updates `report_execution_logs` and calculates/updates `next_run_at`.

### Phase 3: Reliability & Polish
1.  **Retries**: Configure queue to retry failed jobs (e.g., temporary email service outage).
2.  **Error Handling**: If a report fails repeatedly, pause the schedule and notify the user.
3.  **UI Feedback**: Show "Last Run Status" in the UI.

## 7. Testing Strategy

-   **Unit Tests**:
    -   Test schedule recurrence calculation logic (e.g., ensure "Monthly" logic handles Feb 28/29 correctly).
    -   Test report generation functions with mock data.
-   **Integration Tests**:
    -   Test the API endpoints (create, update, delete schedules).
    -   Test the full flow: Create Schedule -> Trigger Test Run -> Verify Email Sent (mocked).
-   **Load Testing**:
    -   Simulate a large number of schedules due at the same time (e.g., 9:00 AM on Monday) to ensure the queue and database handle the burst.

## 8. Open Questions
- Are there specific report types that are computationally expensive? (May need a separate "heavy" queue).
- Should we store the generated reports (S3) or just email them ephemeral?
- Is there a limit on the number of schedules a user can create?

