# Scheduled Reports Feature - Implementation Plan

## Feature Overview

Build a system that allows users to schedule automated report generation and delivery. Users can select report types, configure delivery cadence, specify recipients, and receive reports automatically via email/notification channels.

## Core Requirements

### User Capabilities
- Select from available report types
- Configure delivery schedule (daily, weekly, monthly, custom cron)
- Specify recipients (team members, email addresses, channels)
- Choose output format (PDF, CSV, Excel, etc.)
- Set filters/parameters specific to each report type
- Enable/disable/pause scheduled reports
- View history of delivered reports
- Manage multiple scheduled reports

### System Capabilities
- Execute scheduled jobs reliably at specified times
- Generate reports with current data at execution time
- Handle failures with retry logic
- Send notifications on delivery or failure
- Track delivery status and history
- Support timezone-aware scheduling

## Technical Architecture

### 1. Data Model

#### ScheduledReport Table
```
id: UUID (primary key)
user_id: UUID (creator)
organization_id: UUID
report_type: ENUM/String (invoice_summary, usage_report, etc.)
name: String (user-friendly name)
description: Text (optional)
schedule_config: JSONB
  - cadence: String (daily, weekly, monthly, cron)
  - cron_expression: String (if cadence=cron)
  - time: Time (execution time)
  - timezone: String (e.g., America/New_York)
  - day_of_week: Integer (for weekly)
  - day_of_month: Integer (for monthly)
recipients: JSONB[]
  - type: String (email, user_id, slack_channel)
  - value: String
report_parameters: JSONB (filters, date ranges, etc.)
output_format: String (pdf, csv, xlsx)
is_active: Boolean
last_run_at: Timestamp
next_run_at: Timestamp
created_at: Timestamp
updated_at: Timestamp
created_by: UUID
```

#### ReportExecution Table
```
id: UUID (primary key)
scheduled_report_id: UUID (foreign key)
status: ENUM (pending, running, completed, failed)
started_at: Timestamp
completed_at: Timestamp
error_message: Text
file_url: String (S3/storage location)
file_size: Integer
execution_time_ms: Integer
retry_count: Integer
metadata: JSONB (rows_generated, filters_applied, etc.)
```

#### ReportDelivery Table
```
id: UUID (primary key)
report_execution_id: UUID (foreign key)
recipient_type: String
recipient_value: String
status: ENUM (pending, sent, failed, bounced)
delivered_at: Timestamp
error_message: Text
metadata: JSONB
```

### 2. Core Components

#### Scheduler Service
**Responsibilities:**
- Poll for reports due to run
- Enqueue report generation jobs
- Calculate next execution times
- Handle timezone conversions
- Update `next_run_at` timestamps

**Implementation Options:**
- **Cron-based:** System cron triggers scheduler every minute
- **Event-loop:** Long-running process with internal scheduler
- **Queue-based:** Use job queue with delayed jobs (Sidekiq, Bull, Celery)
- **Managed service:** AWS EventBridge, Google Cloud Scheduler, cron-job.org

**Recommended:** Queue-based with recurring jobs for better observability and retry capabilities

#### Report Generator Service
**Responsibilities:**
- Fetch data based on report type and parameters
- Apply filters and transformations
- Generate output in requested format
- Store generated file in blob storage
- Update execution record
- Handle timeouts and resource limits

**Key Considerations:**
- Memory management for large datasets
- Streaming data for CSV/Excel generation
- PDF rendering service (Puppeteer, wkhtmltopdf, LaTeX)
- Parallelization for multi-sheet reports

#### Delivery Service
**Responsibilities:**
- Send reports to recipients
- Handle different delivery channels (email, Slack, webhook)
- Track delivery status
- Implement retry logic for failures
- Generate shareable links for large files

**Email Considerations:**
- Attachment size limits (typically 25MB)
- Link to download for large reports
- Unsubscribe mechanism
- Branded email templates
- SPF/DKIM/DMARC configuration

### 3. Job Queue Architecture

```
┌─────────────────┐
│   Scheduler     │ ──> Checks DB every minute for due reports
└────────┬────────┘
         │ Enqueues jobs
         ▼
┌─────────────────────────────────────────────┐
│          Job Queue (Redis/RabbitMQ)         │
├─────────────────┬───────────────────────────┤
│ High Priority   │ Low Priority              │
│ - On-demand     │ - Scheduled reports       │
└────────┬────────┴───────────┬───────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐   ┌──────────────────┐
│  Report Workers  │   │  Report Workers  │
│  (Pool of 5-10)  │   │  (Pool of 2-5)   │
└────────┬─────────┘   └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌──────────────────────┐
         │   Delivery Workers   │
         │   (Pool of 3-5)      │
         └──────────────────────┘
```

### 4. API Design

#### REST Endpoints

**Create Scheduled Report**
```
POST /api/scheduled-reports
Body: {
  name: string
  report_type: string
  schedule_config: {
    cadence: 'daily' | 'weekly' | 'monthly' | 'cron'
    time: '09:00'
    timezone: 'America/New_York'
    day_of_week?: 1-7
    day_of_month?: 1-31
    cron_expression?: string
  }
  recipients: Array<{type: string, value: string}>
  report_parameters: object
  output_format: 'pdf' | 'csv' | 'xlsx'
}
```

**List Scheduled Reports**
```
GET /api/scheduled-reports?page=1&limit=20&status=active
```

**Update Scheduled Report**
```
PUT /api/scheduled-reports/:id
```

**Pause/Resume**
```
POST /api/scheduled-reports/:id/pause
POST /api/scheduled-reports/:id/resume
```

**Delete**
```
DELETE /api/scheduled-reports/:id
```

**Execution History**
```
GET /api/scheduled-reports/:id/executions?page=1&limit=50
```

**Run Now (on-demand)**
```
POST /api/scheduled-reports/:id/run
```

**Download Report**
```
GET /api/report-executions/:id/download
```

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
1. Database schema and migrations
2. Basic CRUD API for scheduled reports
3. Simple scheduler (check every minute for due reports)
4. Job queue setup
5. Basic report generator for one report type
6. Email delivery integration

**Success Criteria:**
- Can create, read, update, delete scheduled reports
- Can generate and email a simple CSV report on schedule
- Execution history is tracked

### Phase 2: Report Generation Engine
1. Abstract report generator interface
2. Implement multiple report types
3. Add output format support (CSV, PDF, Excel)
4. File storage integration (S3/blob storage)
5. Memory-efficient streaming for large datasets
6. Report templating system

**Success Criteria:**
- Support 3-5 different report types
- Can generate reports in multiple formats
- Handles reports with 100K+ rows efficiently

### Phase 3: Advanced Scheduling
1. Cron expression support
2. Timezone handling
3. Business day awareness (skip weekends/holidays)
4. Custom recurrence patterns
5. Schedule preview ("Next 5 execution times")

**Success Criteria:**
- Support complex scheduling patterns
- Accurate timezone conversions
- Users can preview when reports will run

### Phase 4: Delivery & Notifications
1. Multiple delivery channels (Slack, webhook, etc.)
2. Delivery status tracking
3. Retry logic with exponential backoff
4. Failure notifications to creator
5. Shareable links for large reports
6. Unsubscribe mechanism

**Success Criteria:**
- Can deliver to email, Slack, webhook
- Failed deliveries are retried appropriately
- Users are notified of failures

### Phase 5: UI/UX
1. Scheduled reports management dashboard
2. Report creation wizard
3. Schedule configuration UI (visual cron builder)
4. Execution history view
5. Report preview/download
6. Real-time status updates

**Success Criteria:**
- Intuitive report scheduling workflow
- Clear visibility into execution history
- Easy troubleshooting of failures

### Phase 6: Optimization & Scale
1. Horizontal scaling of workers
2. Query optimization for report generation
3. Caching layer for common datasets
4. Rate limiting and throttling
5. Cost monitoring and optimization
6. Performance monitoring and alerting

**Success Criteria:**
- System handles 10K+ scheduled reports
- Report generation completes within SLA
- Infrastructure costs are optimized

## Security & Permissions

### Access Control
- Users can only create reports they have permission to view
- Organization-level permissions for creating scheduled reports
- Recipient validation (can only send to team members or verified emails)
- Report parameter validation to prevent unauthorized data access

### Data Security
- Encrypt report files at rest in storage
- Signed URLs with expiration for downloads
- Audit log of who accessed which reports
- PII handling in reports
- GDPR compliance (right to access scheduled reports about user)

### Rate Limiting
- Limit number of scheduled reports per user/organization
- Prevent abuse of on-demand "run now" feature
- Throttle report generation to prevent resource exhaustion

## Scalability Considerations

### Performance Bottlenecks
1. **Database queries for report data**
   - Add indexes on commonly filtered columns
   - Consider read replicas for report queries
   - Implement query timeout limits

2. **Report generation for large datasets**
   - Stream data instead of loading all into memory
   - Pagination for very large reports
   - Background processing with status updates

3. **File storage**
   - Auto-delete old reports after retention period
   - Lifecycle policies to move to cheaper storage tier
   - Consider file size limits

4. **Email delivery**
   - Use transactional email service (SendGrid, AWS SES)
   - Implement exponential backoff for retries
   - Monitor bounce rates and deliverability

### Monitoring & Observability
- Execution time metrics per report type
- Success/failure rates
- Queue depth and worker utilization
- Storage costs
- Email delivery rates
- Alerts for:
  - High failure rates
  - Long-running reports
  - Queue backlog
  - Storage threshold exceeded

## Testing Strategy

### Unit Tests
- Schedule calculation logic
- Report parameter validation
- Output format generation
- Recipient parsing

### Integration Tests
- End-to-end report generation
- Email delivery
- Job queue processing
- Database transactions

### Load Tests
- 1000 concurrent report generations
- 10K scheduled reports checked per minute
- Large dataset generation (1M+ rows)

### User Acceptance Tests
- Create and schedule a report
- Receive report via email
- View execution history
- Pause and resume schedule
- Handle timezone changes

## Potential Challenges & Risks

### 1. Long-Running Reports
**Problem:** Some reports may take 10+ minutes to generate, blocking workers

**Solutions:**
- Set timeouts and fail gracefully
- Break large reports into chunks
- Provide estimated completion time
- Send "report is generating" notification

### 2. Timezone Complexity
**Problem:** Users travel, DST changes, organizational timezone changes

**Solutions:**
- Store all times in UTC
- Use timezone-aware libraries (date-fns-tz, pytz)
- Allow users to change timezone for existing schedules
- Clear UI showing "Next run at [local time] / [UTC]"

### 3. Data Consistency
**Problem:** Report shows different data than UI at same moment

**Solutions:**
- Use consistent database read timestamps
- Clearly label report generation time
- Option to generate "point-in-time" reports

### 4. Cost Management
**Problem:** Storage and compute costs grow with report volume

**Solutions:**
- Retention policies (auto-delete after 90 days)
- Compress large files
- Deduplicate identical reports
- Tier pricing based on report volume

### 5. Email Deliverability
**Problem:** Reports caught in spam filters, bounced emails

**Solutions:**
- Proper email authentication (SPF, DKIM, DMARC)
- Use reputable email service
- Monitor bounce rates
- Provide in-app access as backup

### 6. Failed Deliveries
**Problem:** Report generates successfully but delivery fails

**Solutions:**
- Retry delivery separately from generation
- Store generated report for manual download
- Notify user of delivery failure
- Provide shareable link as fallback

## Technology Stack Recommendations

### Job Queue
- **Redis + Bull (Node.js):** Excellent observability, easy retries
- **Sidekiq (Ruby):** Mature, reliable, great for Rails apps
- **Celery (Python):** Powerful, supports complex workflows
- **AWS SQS + Lambda:** Serverless, scales automatically

### Report Generation
- **CSV:** Built-in libraries (csv module, fast-csv)
- **Excel:** ExcelJS, openpyxl, Apache POI
- **PDF:** Puppeteer (HTML to PDF), PDFKit, wkhtmltopdf

### File Storage
- **AWS S3:** Industry standard, cheap, reliable
- **Google Cloud Storage:** Good alternative
- **Cloudinary:** If you need image manipulation
- **Self-hosted MinIO:** For on-prem deployments

### Email Delivery
- **SendGrid:** Easy integration, good deliverability
- **AWS SES:** Cost-effective, scales well
- **Postmark:** Focus on transactional email
- **Mailgun:** Powerful APIs

### Monitoring
- **Datadog:** Comprehensive APM and logging
- **New Relic:** Good for transaction tracing
- **Prometheus + Grafana:** Open-source, customizable
- **Sentry:** Error tracking and alerting

## Next Steps

1. **Validate Requirements:** Confirm report types needed and user workflows
2. **Choose Technology Stack:** Based on existing infrastructure
3. **Design Database Schema:** Review and refine data model
4. **Spike Critical Paths:** 
   - Test report generation performance with production-scale data
   - Evaluate job queue options
   - Test PDF generation quality
5. **Create Detailed Task Breakdown:** Break phases into 2-3 day tasks
6. **Set Up Development Environment:** Queue, storage, email sandbox
7. **Build Phase 1:** Start with minimal viable scheduling system

## Open Questions

Before implementation, clarify:

1. **Report Types:** What specific reports need scheduling? (This affects data model)
2. **Volume:** Expected number of scheduled reports and executions per day?
3. **Data Size:** Typical and maximum report sizes?
4. **Recipients:** Internal users only or external customers?
5. **Authentication:** How do recipients access reports? (Link only, login required, etc.)
6. **Retention:** How long to keep generated reports?
7. **Existing Infrastructure:** Current job queue, storage, email provider?
8. **Compliance:** Any regulatory requirements (HIPAA, SOC2, GDPR)?
9. **Budget:** Infrastructure and third-party service budget constraints?
10. **Timeline:** Hard launch date or phased rollout?
