# Scheduled Reports - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  - Scheduled Reports Dashboard                                      │
│  - Report Configuration Wizard                                       │
│  - Execution History View                                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
│  - Authentication/Authorization                                      │
│  - Request Validation                                                │
│  - Rate Limiting                                                     │
└───┬──────────────────────┬──────────────────────┬───────────────────┘
    │                      │                      │
    │                      │                      │
    ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐
│  Scheduled   │   │   Report     │   │     Delivery             │
│  Report      │   │   Execution  │   │     Service              │
│  Service     │   │   Service    │   │                          │
└──────┬───────┘   └──────┬───────┘   └──────┬───────────────────┘
       │                  │                   │
       │ CRUD ops         │ Track status      │ Send notifications
       │                  │                   │
       ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE                                     │
│  - scheduled_reports                                                 │
│  - report_executions                                                 │
│  - report_deliveries                                                 │
│  - users, organizations                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND JOB SYSTEM                             │
│                                                                       │
│  ┌────────────────┐         ┌──────────────────────────────┐       │
│  │   Scheduler    │────────>│      Job Queue (Redis)       │       │
│  │   (Cron/Loop)  │ Enqueue │                              │       │
│  │                │         │  - report_generation_queue   │       │
│  │ Runs every     │         │  - delivery_queue            │       │
│  │ minute         │         │  - retry_queue               │       │
│  └────────────────┘         └──────────┬───────────────────┘       │
│                                         │                            │
│                                         │ Workers consume            │
│                                         ▼                            │
│              ┌─────────────────────────────────────────┐            │
│              │      Report Generation Workers          │            │
│              │      (Pool of 5-10 processes)           │            │
│              │                                          │            │
│              │  For each job:                          │            │
│              │  1. Fetch data from DB                  │            │
│              │  2. Apply filters/transformations       │            │
│              │  3. Generate file (CSV/PDF/Excel)       │            │
│              │  4. Upload to storage                   │            │
│              │  5. Update execution record             │            │
│              │  6. Enqueue delivery jobs               │            │
│              └─────────────────────────────────────────┘            │
│                                         │                            │
│                                         │                            │
│                                         ▼                            │
│              ┌─────────────────────────────────────────┐            │
│              │      Delivery Workers                   │            │
│              │      (Pool of 3-5 processes)            │            │
│              │                                          │            │
│              │  For each recipient:                    │            │
│              │  1. Fetch report file URL               │            │
│              │  2. Send via appropriate channel        │            │
│              │     (email/Slack/webhook)               │            │
│              │  3. Track delivery status               │            │
│              │  4. Retry on failure                    │            │
│              └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                 │
│                                                                       │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │ File Storage  │  │ Email Service│  │ Notification Services │   │
│  │ (S3/GCS)      │  │ (SendGrid/   │  │ (Slack, Webhooks)     │   │
│  │               │  │  SES)        │  │                       │   │
│  │ - Store       │  │              │  │                       │   │
│  │   generated   │  │ - Send       │  │ - Send to channels    │   │
│  │   reports     │  │   reports    │  │ - POST to webhooks    │   │
│  │ - Signed URLs │  │ - Track      │  │                       │   │
│  │               │  │   bounces    │  │                       │   │
│  └───────────────┘  └──────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORING & LOGGING                              │
│  - Application logs (structured JSON)                                │
│  - Metrics (execution time, success rate, queue depth)              │
│  - Alerting (high failure rate, worker down, queue backup)          │
│  - Tracing (distributed trace for each report execution)            │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Scheduler Component

**Purpose:** Identify scheduled reports that are due to run and enqueue them

**Logic:**
```
Every minute:
  1. Query database: SELECT * FROM scheduled_reports 
     WHERE is_active = true 
     AND next_run_at <= NOW()
  
  2. For each report:
     - Enqueue job: {report_id, execution_id, scheduled_at}
     - Calculate next_run_at based on schedule_config
     - UPDATE scheduled_reports SET next_run_at = ?, last_run_at = NOW()
  
  3. Handle edge cases:
     - Skip if already running
     - Catch-up logic if system was down
     - Timezone conversions
```

**Deployment Options:**
- System cron job triggering script
- Kubernetes CronJob
- Long-running process with sleep loop
- Serverless function on schedule (AWS EventBridge)

**Fault Tolerance:**
- If scheduler crashes, missed jobs should be catchable
- Implement "catch-up" logic for reports missed during downtime
- Idempotency: don't double-enqueue if run twice

### 2. Report Generation Worker

**Purpose:** Generate report files from database queries

**Process Flow:**
```
1. Receive job from queue
   - report_id
   - execution_id
   - parameters

2. Update execution status to 'running'

3. Fetch report metadata
   - Report type
   - Parameters/filters
   - Output format

4. Execute data query
   - Build query based on report type
   - Apply user-defined filters
   - Handle date ranges
   - Use read replica to avoid impacting production DB

5. Generate output file
   - Stream data to avoid memory issues
   - Apply formatting
   - Add headers, footers, branding
   
6. Upload to storage
   - Generate unique filename
   - Upload to S3/GCS
   - Set appropriate permissions
   - Get signed URL

7. Update execution record
   - Status: completed/failed
   - File URL
   - File size
   - Execution time
   - Metadata (rows generated, etc.)

8. Enqueue delivery jobs
   - One job per recipient
   - Include file URL and recipient info

9. Error handling
   - Catch and log errors
   - Update execution status to 'failed'
   - Retry logic (up to 3 attempts)
   - Send failure notification to creator
```

**Performance Optimizations:**
- Use database connection pooling
- Stream large datasets
- Compress files before upload
- Cache common queries (if applicable)
- Parallel processing for multi-sheet reports

### 3. Delivery Worker

**Purpose:** Send generated reports to recipients

**Process Flow:**
```
1. Receive delivery job
   - execution_id
   - recipient (type + value)
   - file_url

2. Fetch file metadata
   - File size
   - Format

3. Determine delivery method
   - Email: attachment vs link
   - Slack: message with download link
   - Webhook: POST file URL

4. Send notification
   - Format message
   - Include report details
   - Send via appropriate channel

5. Track delivery
   - Update delivery status
   - Log timestamp
   - Capture any errors

6. Retry logic
   - Exponential backoff (1m, 5m, 30m)
   - Max 3 retry attempts
   - Different failures may need different handling:
     - Email bounce: don't retry
     - Timeout: retry
     - Rate limit: retry with longer delay
```

**Delivery Methods:**

**Email:**
```javascript
if (fileSize < 10MB) {
  sendEmail({
    to: recipient,
    subject: `Scheduled Report: ${reportName}`,
    body: template,
    attachment: fileUrl
  })
} else {
  sendEmail({
    to: recipient,
    subject: `Scheduled Report: ${reportName}`,
    body: templateWithLink,
    downloadLink: signedUrl(fileUrl, expiresIn: '7 days')
  })
}
```

**Slack:**
```javascript
postMessage({
  channel: recipient,
  text: `Your scheduled report "${reportName}" is ready`,
  attachments: [{
    title: reportName,
    title_link: signedUrl(fileUrl),
    fields: [
      {title: 'Format', value: format},
      {title: 'Generated At', value: timestamp},
      {title: 'File Size', value: humanReadableSize}
    ]
  }]
})
```

**Webhook:**
```javascript
postToWebhook({
  url: recipient,
  payload: {
    event: 'report.generated',
    report_id: reportId,
    report_name: reportName,
    execution_id: executionId,
    file_url: signedUrl(fileUrl),
    format: format,
    generated_at: timestamp,
    file_size: fileSize
  }
})
```

## Data Flow Diagrams

### Creating a Scheduled Report

```
User → [Web UI] → POST /api/scheduled-reports
                      ↓
                  [API Layer]
                  - Validate input
                  - Check permissions
                  - Validate report type exists
                  - Validate recipients
                      ↓
                  [Database]
                  - INSERT INTO scheduled_reports
                  - Calculate initial next_run_at
                      ↓
                  [Response]
                  - Return created report with ID
                      ↓
                  [User sees confirmation]
```

### Executing a Scheduled Report

```
[Scheduler] → Runs every minute
              ↓
          [Query DB for due reports]
              ↓
          [For each due report]:
              ↓
          [Create execution record]
          - INSERT INTO report_executions (status: pending)
              ↓
          [Enqueue job]
          - LPUSH report_generation_queue
              ↓
          [Update next_run_at]
          - UPDATE scheduled_reports

[Worker Pool] → Consumes from queue
                ↓
            [Fetch job]
                ↓
            [Update status: running]
                ↓
            [Generate report]
            - Query database
            - Transform data
            - Create file
                ↓
            [Upload to storage]
                ↓
            [Update execution record]
            - status: completed
            - file_url
            - metadata
                ↓
            [Enqueue delivery jobs]
            - One per recipient

[Delivery Workers] → Consume delivery jobs
                     ↓
                 [Send notifications]
                 - Email/Slack/Webhook
                     ↓
                 [Track delivery status]
```

### Handling Failures

```
[Report Generation Fails]
    ↓
[Update execution status: failed]
    ↓
[Log error details]
    ↓
[Check retry count]
    ↓
If retry_count < 3:
    ↓
[Re-enqueue with delay]
[Exponential backoff: 1m, 5m, 15m]
    ↓
Else:
    ↓
[Mark as permanently failed]
    ↓
[Send failure notification to creator]
    ↓
[Alert monitoring system if failure rate > threshold]
```

## Database Schema Relationships

```
┌─────────────────────────┐
│   organizations         │
│                         │
│  - id                   │
│  - name                 │
└────────┬────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────┐
│   users                 │
│                         │
│  - id                   │
│  - organization_id (FK) │
│  - email                │
└────────┬────────────────┘
         │
         │ 1:N (creator)
         ▼
┌──────────────────────────────────┐
│   scheduled_reports              │
│                                  │
│  - id (PK)                       │
│  - organization_id (FK)          │
│  - created_by (FK → users)       │
│  - report_type                   │
│  - schedule_config (JSONB)       │
│  - recipients (JSONB[])          │
│  - report_parameters (JSONB)     │
│  - is_active                     │
│  - next_run_at                   │
└────────┬─────────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────────────┐
│   report_executions              │
│                                  │
│  - id (PK)                       │
│  - scheduled_report_id (FK)      │
│  - status                        │
│  - started_at                    │
│  - completed_at                  │
│  - file_url                      │
│  - error_message                 │
└────────┬─────────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────────────┐
│   report_deliveries              │
│                                  │
│  - id (PK)                       │
│  - report_execution_id (FK)      │
│  - recipient_type                │
│  - recipient_value               │
│  - status                        │
│  - delivered_at                  │
└──────────────────────────────────┘
```

## Scalability Architecture

### Horizontal Scaling

```
                    [Load Balancer]
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
    [API-1]           [API-2]           [API-3]
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                 [Database Primary]
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    [Read Replica 1]            [Read Replica 2]
    (for reports)               (for reports)


        [Redis/Queue Cluster]
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    [Worker]  [Worker]  [Worker] ... [Worker N]
    (Pool 1)  (Pool 2)  (Pool 3)    (Pool N)
```

### Auto-Scaling Strategy

**API Tier:**
- Scale based on CPU usage (target: 70%)
- Min: 2 instances
- Max: 10 instances

**Worker Pools:**
- Scale based on queue depth
- If queue depth > 100: add workers
- If queue depth < 10 for 10 minutes: remove workers
- Min: 3 workers
- Max: 20 workers

**Database:**
- Use connection pooling
- Route report queries to read replicas
- Consider caching layer for frequently accessed data

## Monitoring Dashboard

### Key Metrics to Track

**System Health:**
- Queue depth (current jobs pending)
- Worker utilization (% busy)
- Average execution time per report type
- Success rate (last hour, last 24h)
- Failure rate with breakdown by error type

**Business Metrics:**
- Total scheduled reports (active/paused)
- Reports executed today/this week
- Most popular report types
- Average recipients per report
- Storage used (total file size)

**Performance:**
- P50, P95, P99 execution time
- Database query time
- File upload time
- Email delivery time

**Alerts:**
- 🚨 Worker pool down
- 🚨 Queue depth > 500 for 5 minutes
- 🚨 Failure rate > 10% for 15 minutes
- ⚠️  Execution time > 5 minutes (P95)
- ⚠️  Storage usage > 80%
- ⚠️  Email bounce rate > 5%

## Security Architecture

### Authentication & Authorization Flow

```
[User Request] → [API Gateway]
                      ↓
                 [Auth Middleware]
                 - Verify JWT/session
                 - Extract user_id
                      ↓
                 [Permission Check]
                 - Can user create reports?
                 - Can user access this report type?
                 - Can user send to these recipients?
                      ↓
                 [Resource Ownership Check]
                 - User owns this scheduled report, OR
                 - User is in same organization, OR
                 - User has admin role
                      ↓
                 [Process Request]
```

### Data Protection

**At Rest:**
- Encrypt database with AES-256
- Encrypt files in storage (S3 server-side encryption)
- Secure secrets in vault (AWS Secrets Manager, HashiCorp Vault)

**In Transit:**
- TLS 1.3 for all API communications
- Signed URLs for file downloads (time-limited)
- Secure SMTP for email delivery

**Access Control:**
- Row-level security in database (organization_id filtering)
- IAM roles for service accounts
- Principle of least privilege

### Audit Logging

Log all significant events:
```
- scheduled_report.created
- scheduled_report.updated
- scheduled_report.deleted
- scheduled_report.paused
- scheduled_report.resumed
- report_execution.started
- report_execution.completed
- report_execution.failed
- report.downloaded (by whom, when)
- recipient.added
- recipient.removed
```

## Disaster Recovery

### Backup Strategy

**Database:**
- Automated daily snapshots
- Point-in-time recovery enabled
- Retention: 30 days

**Generated Reports:**
- Lifecycle policy: delete after 90 days
- Critical reports: manual backup option
- Replication across availability zones

### Recovery Procedures

**Scheduler Downtime:**
- System automatically catches up when restored
- Query for reports with next_run_at in past
- Execute in chronological order
- May need to prioritize recent reports

**Worker Failure:**
- Jobs automatically retry
- Manual intervention for stuck jobs
- Replay from execution log

**Database Failure:**
- Automatic failover to replica
- RPO: 5 minutes (max data loss)
- RTO: 15 minutes (max downtime)

## Cost Optimization

### Storage Costs
- Auto-delete reports older than retention period
- Compress files (gzip for CSV, already compressed PDF/Excel)
- Move to cheaper storage tier after 30 days (S3 Glacier)
- Estimate: $0.023/GB/month (S3 Standard)

### Compute Costs
- Use spot instances for worker pools (50-70% savings)
- Auto-scale down during off-peak hours
- Optimize queries to reduce execution time
- Estimate: $0.05-0.10 per report generated

### Email Costs
- SendGrid: $0.0005 per email (first 40K free)
- AWS SES: $0.10 per 1000 emails
- Optimize by combining multiple reports in one email if appropriate

### Monitoring Costs
- Use CloudWatch/Stackdriver (included in cloud platform)
- Sample traces at 10% to reduce costs
- Alert on unusual cost spikes
