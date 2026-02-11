# Scheduled Reports - Decision Guide & FAQ

## Technology Selection Matrix

### Job Queue Selection

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Redis + Bull (Node.js)** | - Excellent dashboard (Bull Board)<br>- Easy retry logic<br>- Good documentation<br>- Priority queues built-in | - Redis memory limits<br>- Single point of failure without cluster | Node.js/TypeScript stacks |
| **Sidekiq (Ruby)** | - Extremely mature<br>- Battle-tested at scale<br>- Great monitoring<br>- Ruby-native | - Requires Ruby runtime<br>- Learning curve if not Ruby dev | Rails applications |
| **Celery (Python)** | - Very powerful<br>- Complex workflow support<br>- Multiple broker options | - Complex configuration<br>- Steeper learning curve | Python applications, complex workflows |
| **AWS SQS + Lambda** | - Fully managed<br>- Infinite scale<br>- Pay per use | - Cold start latency<br>- 15min Lambda limit<br>- Harder to debug | Serverless-first, variable load |
| **RabbitMQ** | - Very reliable<br>- Complex routing<br>- Multiple protocols | - More ops overhead<br>- Steeper learning curve | Enterprise, complex messaging |

**Recommendation:** Start with Redis + Bull if Node.js, Sidekiq if Rails, otherwise AWS SQS for simplicity.

### Report Generation Format

| Format | Use Case | Library Recommendations | Size Considerations |
|--------|----------|------------------------|---------------------|
| **CSV** | Large datasets, data exports | csv (Node), csv (Python) | Can handle millions of rows |
| **Excel** | Business users, formatted data | ExcelJS, openpyxl | Limit to ~100K rows for performance |
| **PDF** | Formatted reports, invoices | Puppeteer, wkhtmltopdf, PDFKit | Best for <100 pages |
| **JSON** | API consumers, webhooks | Native JSON | Very efficient |
| **HTML Email** | Simple summaries | Template engine + inline CSS | Keep under 102KB |

**Recommendation:** Support CSV (for data), PDF (for formatted reports), and Excel (for business users) as minimum viable set.

### Email Service Provider

| Provider | Cost | Deliverability | Features | Best For |
|----------|------|----------------|----------|----------|
| **SendGrid** | $15/mo for 40K emails<br>$0.0005/email after | Excellent | Email validation, templates, analytics | General use, good balance |
| **AWS SES** | $0.10 per 1K emails | Very good (requires warmup) | Flexible, integrates with AWS | High volume, AWS-native |
| **Postmark** | $15/mo for 10K emails | Excellent | Focus on transactional, great support | Mission-critical emails |
| **Mailgun** | $35/mo for 50K emails | Very good | Powerful API, good analytics | Developers, API-first |
| **Mailchimp Transactional** | $20/mo for 25K emails | Good | Marketing + transactional | Unified platform |

**Recommendation:** SendGrid for most use cases, AWS SES for high-volume/cost optimization.

### File Storage

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| **AWS S3** | $0.023/GB/month | Industry standard, very reliable, lifecycle policies | None significant |
| **Google Cloud Storage** | $0.020/GB/month | Slightly cheaper, good for GCP users | Less common |
| **Cloudflare R2** | $0.015/GB/month | Cheaper, no egress fees | Newer, less mature |
| **Azure Blob Storage** | $0.018/GB/month | Good for Azure users | Less common |

**Recommendation:** AWS S3 unless you're already on another cloud platform.

## Common Implementation Questions

### Q: How often should the scheduler check for due reports?

**Answer:** Every 1 minute is the sweet spot.

**Reasoning:**
- Every 30 seconds: Unnecessary database load, minimal benefit
- Every 1 minute: Good balance, acceptable delay
- Every 5 minutes: Too coarse, users expect hourly reports to run on the hour

**Implementation:**
```javascript
// Check every minute for reports due in the next 2 minutes (buffer)
SELECT * FROM scheduled_reports 
WHERE is_active = true 
  AND next_run_at <= NOW() + INTERVAL '2 minutes'
  AND next_run_at <= NOW()
```

### Q: Should we use cron expressions or a custom schedule format?

**Answer:** Start with predefined options (daily/weekly/monthly), add cron later.

**Reasoning:**
- 90% of users want simple schedules
- Cron is intimidating for non-technical users
- Can add "Advanced: Custom Schedule" later

**Recommended UI:**
```
Schedule:
( ) Daily at [09:00] [America/New_York ▾]
( ) Weekly on [Monday ▾] at [09:00] [America/New_York ▾]
( ) Monthly on day [1] at [09:00] [America/New_York ▾]
( ) Advanced: [0 9 * * 1-5] (cron expression)
```

### Q: How do we calculate the next run time?

**Answer:** Use a library like `cron-parser` (Node) or `croniter` (Python).

**Example (Node.js):**
```javascript
const parser = require('cron-parser');

function calculateNextRun(scheduleConfig) {
  const { cadence, time, timezone, day_of_week, day_of_month } = scheduleConfig;
  
  const now = moment.tz(timezone);
  
  switch (cadence) {
    case 'daily':
      return now.clone().add(1, 'day').set({
        hour: parseInt(time.split(':')[0]),
        minute: parseInt(time.split(':')[1]),
        second: 0
      }).tz('UTC').toDate();
      
    case 'weekly':
      let next = now.clone().day(day_of_week).set({
        hour: parseInt(time.split(':')[0]),
        minute: parseInt(time.split(':')[1]),
        second: 0
      });
      if (next <= now) next.add(1, 'week');
      return next.tz('UTC').toDate();
      
    case 'monthly':
      let nextMonth = now.clone().date(day_of_month).set({
        hour: parseInt(time.split(':')[0]),
        minute: parseInt(time.split(':')[1]),
        second: 0
      });
      if (nextMonth <= now) nextMonth.add(1, 'month');
      return nextMonth.tz('UTC').toDate();
      
    case 'cron':
      const interval = parser.parseExpression(scheduleConfig.cron_expression, {
        currentDate: now.toDate(),
        tz: timezone
      });
      return interval.next().toDate();
  }
}
```

### Q: What happens if a scheduled report is already running when the next run time comes?

**Answer:** Skip the run and log a warning.

**Implementation:**
```javascript
// In scheduler
const dueReports = await db.query(`
  SELECT sr.* FROM scheduled_reports sr
  LEFT JOIN report_executions re ON re.scheduled_report_id = sr.id 
    AND re.status = 'running'
  WHERE sr.is_active = true 
    AND sr.next_run_at <= NOW()
    AND re.id IS NULL  -- No running execution
`);

// Alternative: Use a distributed lock
const lockKey = `report:${reportId}:lock`;
const locked = await redis.set(lockKey, 'locked', 'NX', 'EX', 3600);
if (!locked) {
  console.warn(`Report ${reportId} is already running, skipping`);
  return;
}
```

### Q: How do we handle reports that take longer than the schedule interval?

**Example:** A report scheduled every hour but takes 90 minutes to run.

**Answer:** Skip overlapping runs, consider longer schedules, or optimize the query.

**Options:**
1. **Skip if running** (recommended for most cases)
2. **Queue and run after current finishes** (if order matters)
3. **Run in parallel** (if reports are independent)

**Warning to user:**
```javascript
if (estimatedDuration > scheduleInterval) {
  return {
    warning: `This report typically takes ${estimatedDuration}min but is scheduled every ${scheduleInterval}min. Consider changing the schedule to ${recommendedInterval}.`
  };
}
```

### Q: How do we handle timezones for users in different locations?

**Answer:** Store all times in UTC, convert for display, schedule based on creator's timezone.

**Best Practices:**
```javascript
// In database: always UTC
next_run_at: '2026-02-11 14:00:00+00'  // UTC

// Store timezone separately
schedule_config: {
  time: '09:00',
  timezone: 'America/New_York'  // User's timezone
}

// Display to user
const userTime = moment.utc(next_run_at)
  .tz(scheduleConfig.timezone)
  .format('YYYY-MM-DD HH:mm:ss z');
// Shows: "2026-02-11 09:00:00 EST"

// Calculate next run
const userLocalTime = moment.tz(`${date} ${time}`, timezone);
const utcTime = userLocalTime.utc();
```

### Q: What's the right retry strategy for failed report generation?

**Answer:** Exponential backoff with max 3 attempts.

**Strategy:**
```javascript
const retryDelays = [
  1 * 60 * 1000,   // 1 minute
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000   // 15 minutes
];

async function handleFailure(job, error, retryCount) {
  if (retryCount < 3) {
    const delay = retryDelays[retryCount];
    await queue.add(job.data, { 
      delay,
      attempts: 1  // Don't let queue retry, we handle it
    });
  } else {
    // Permanently failed
    await notifyUser({
      userId: job.data.createdBy,
      message: `Report "${job.data.reportName}" failed after 3 attempts`,
      error: error.message
    });
  }
}
```

**Don't retry for:**
- Invalid parameters (won't succeed on retry)
- Permission errors (won't change)
- Data not found (legitimate result)

**Do retry for:**
- Database timeouts
- Network errors
- Rate limits
- Temporary service outages

### Q: How big should the worker pool be?

**Answer:** Start with 5 workers, scale based on queue depth and execution time.

**Calculation:**
```
Workers needed = (Reports per hour × Avg execution time in hours) / Target completion window

Example:
- 100 reports/hour to execute
- Average execution time: 3 minutes (0.05 hours)
- Want to complete within 10 minutes (0.17 hours)

Workers = (100 × 0.05) / 0.17 = ~30 workers

But start small and scale up as needed.
```

**Monitoring:**
```javascript
// Alert if queue is backing up
if (queueDepth > 100 && avgWaitTime > 300) {
  alert('Consider adding more workers');
}

// Alert if workers are idle
if (queueDepth < 10 && workerUtilization < 0.3) {
  alert('Consider removing workers to save costs');
}
```

### Q: Should reports be generated fresh each time or can we cache them?

**Answer:** Generally generate fresh, but consider caching for:

**Cache if:**
- Report data doesn't change often (weekly summary of last month)
- Report is expensive to generate
- Multiple users request the same report
- Real-time data isn't critical

**Don't cache if:**
- Data changes frequently
- Report includes real-time metrics
- Security/compliance requires fresh data
- Different users see different data

**Implementation:**
```javascript
async function generateOrGetCached(reportConfig) {
  const cacheKey = `report:${reportType}:${hash(parameters)}`;
  const cacheWindow = 3600; // 1 hour
  
  const cached = await cache.get(cacheKey);
  if (cached && cached.timestamp > Date.now() - cacheWindow) {
    return cached.fileUrl;
  }
  
  const fileUrl = await generateReport(reportConfig);
  await cache.set(cacheKey, { fileUrl, timestamp: Date.now() }, cacheWindow);
  return fileUrl;
}
```

### Q: How do we handle reports with no data?

**Answer:** Still generate and deliver, but indicate "No data for selected period".

**Options:**
1. **Generate empty report** (recommended) - "0 results for February 1-10"
2. **Skip delivery** - Don't send if no data
3. **Send notification** - "No data available, report not generated"

**Implementation:**
```javascript
const results = await fetchReportData(parameters);

if (results.length === 0) {
  if (reportConfig.skipIfEmpty) {
    return { status: 'skipped', reason: 'No data' };
  }
  
  // Generate empty report with message
  return generateEmptyReport({
    title: reportConfig.name,
    message: 'No data available for the selected period',
    period: formatPeriod(parameters.dateRange)
  });
}
```

### Q: How long should we keep generated reports?

**Answer:** 90 days is a good default, make it configurable.

**Reasoning:**
- Keeps storage costs manageable
- Long enough for users to download if needed
- Can always regenerate if needed (for older data)

**Implementation:**
```javascript
// S3 lifecycle policy
{
  "Rules": [{
    "Id": "DeleteOldReports",
    "Status": "Enabled",
    "Expiration": { "Days": 90 },
    "Prefix": "scheduled-reports/"
  }]
}

// Database cleanup job (runs daily)
DELETE FROM report_executions 
WHERE created_at < NOW() - INTERVAL '90 days'
  AND file_url IS NOT NULL;
```

**Enterprise option:**
- Allow admins to set retention policy per organization
- Archive important reports before deletion
- Compliance requirements may need longer retention

### Q: Should we allow scheduling reports to external email addresses?

**Answer:** Yes, but with restrictions.

**Security considerations:**
- Verify email domain if in organization's allowed domains
- Require confirmation email to external addresses
- Rate limit external deliveries
- Allow admins to disable external emails
- Log all external deliveries for audit

**Implementation:**
```javascript
async function validateRecipient(email, organizationId) {
  // Check if internal user
  const internalUser = await db.users.findByEmail(email);
  if (internalUser && internalUser.organizationId === organizationId) {
    return { valid: true, type: 'internal' };
  }
  
  // Check if in allowed domains
  const domain = email.split('@')[1];
  const allowedDomains = await getOrgAllowedDomains(organizationId);
  if (allowedDomains.includes(domain)) {
    return { valid: true, type: 'external_allowed' };
  }
  
  // Check if external emails are enabled for org
  const orgSettings = await getOrgSettings(organizationId);
  if (!orgSettings.allowExternalEmails) {
    return { valid: false, reason: 'External emails not allowed' };
  }
  
  // Require confirmation for new external emails
  if (!await isEmailConfirmed(email, organizationId)) {
    await sendConfirmationEmail(email, organizationId);
    return { valid: false, reason: 'Confirmation required', pending: true };
  }
  
  return { valid: true, type: 'external_confirmed' };
}
```

## Performance Optimization Checklist

### Database Queries
- [ ] Add indexes on `next_run_at`, `is_active`, `organization_id`
- [ ] Use database connection pooling
- [ ] Route report queries to read replicas
- [ ] Add query timeout limits (30 seconds)
- [ ] Monitor slow queries and optimize

### Report Generation
- [ ] Stream large datasets instead of loading into memory
- [ ] Use pagination for very large reports
- [ ] Implement query result caching where appropriate
- [ ] Add execution time limits (5-10 minutes)
- [ ] Consider breaking up huge reports into chunks

### File Storage
- [ ] Compress files before upload (gzip for CSV)
- [ ] Use multipart upload for large files
- [ ] Set appropriate cache headers
- [ ] Implement lifecycle policies for auto-deletion
- [ ] Consider CDN for frequently accessed reports

### Email Delivery
- [ ] Batch email sending where possible
- [ ] Use link instead of attachment for files >10MB
- [ ] Implement exponential backoff for retries
- [ ] Monitor bounce rates and deliverability
- [ ] Warm up new IP addresses gradually

### Worker Pool
- [ ] Auto-scale based on queue depth
- [ ] Use spot instances for cost savings
- [ ] Implement graceful shutdown
- [ ] Monitor worker health and restart if hung
- [ ] Separate high-priority and low-priority queues

## Security Checklist

### Authentication & Authorization
- [ ] Verify user can access report type
- [ ] Check user can see data included in report
- [ ] Validate recipients are authorized
- [ ] Implement rate limiting per user/org
- [ ] Log all scheduled report operations

### Data Protection
- [ ] Encrypt files at rest in storage
- [ ] Use signed URLs with expiration
- [ ] Encrypt sensitive data in database
- [ ] Implement row-level security
- [ ] Sanitize report parameters to prevent SQL injection

### Compliance
- [ ] Add audit logging for all operations
- [ ] Implement data retention policies
- [ ] Support GDPR data export/deletion
- [ ] Add watermarks to sensitive reports
- [ ] Implement access controls for PII data

### Infrastructure
- [ ] Secure secrets in vault (not in code)
- [ ] Use IAM roles instead of API keys
- [ ] Enable multi-factor auth for admin operations
- [ ] Implement network security groups
- [ ] Regular security audits and penetration testing

## Launch Checklist

### Pre-Launch
- [ ] Database schema reviewed and finalized
- [ ] All indexes created and tested
- [ ] Worker pools configured and tested
- [ ] Job queue configured with appropriate limits
- [ ] File storage configured with lifecycle policies
- [ ] Email service configured and warmed up
- [ ] Monitoring and alerting configured
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Load testing completed
- [ ] Security review completed
- [ ] Documentation written
- [ ] Runbooks created for common issues

### Launch
- [ ] Feature flag enabled for beta users
- [ ] Monitor error rates and performance
- [ ] Collect user feedback
- [ ] Iterate on UX issues
- [ ] Gradual rollout to all users

### Post-Launch
- [ ] Monitor key metrics (success rate, execution time)
- [ ] Review and optimize slow queries
- [ ] Adjust worker pool sizing based on actual load
- [ ] Review and act on user feedback
- [ ] Plan next iteration of features
