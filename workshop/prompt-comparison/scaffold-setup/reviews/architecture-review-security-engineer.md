# Architecture Security Review: Report Scheduling

**Reviewer:** Security Engineer
**Date:** 2026-02-10
**Artifact:** `/home/jary/redhat/git/claude-collective-example/plans/architecture.md`
**Phase:** 1 (Core Scheduling)

---

## Verdict

**APPROVE WITH SUGGESTIONS**

The architecture provides a reasonable security foundation for MVP maturity. The authorization model is sound, rate limiting is appropriately placed, and the protocol abstractions for email and report generation create clean security boundaries. However, several areas require attention in the Technical Design phase to prevent common vulnerabilities.

---

## Findings

### WARNING-1: Email Header Injection Risk in EmailSender Protocol

**Category:** OWASP A03:2021 – Injection
**Location:** Section 5.5 (Configuration and Dependency Injection), Section 2 (API package structure - src/services/)

**Description:**
The architecture defines an `EmailSender` protocol but does not specify input sanitization requirements for email headers. If recipient email addresses or subject lines are constructed from user input without validation, attackers can inject SMTP headers (CRLF injection) to manipulate email routing, add BCC recipients, or insert malicious headers.

**Impact:**
An attacker who can control recipient email addresses (e.g., via the schedule creation API) could inject newline characters followed by additional SMTP headers, potentially sending emails to unintended recipients, bypassing spam filters, or exfiltrating report data.

**Recommendation:**
The Tech Lead must specify in the `EmailSender` protocol contract that:
1. All recipient email addresses are validated against RFC 5322 format using Pydantic `EmailStr` (already mentioned in section 6.6, but must be enforced at the protocol boundary, not just API validation)
2. No CRLF characters (`\r`, `\n`) are permitted in recipient addresses or subject lines
3. The protocol implementation sanitizes inputs by rejecting any recipient or subject containing control characters
4. Add an explicit test case for header injection attempts in the Tech Lead's task definition

**References:**
- OWASP: [SMTP Header Injection](https://owasp.org/www-community/attacks/Header_Injection)
- CWE-93: Improper Neutralization of CRLF Sequences

---

### WARNING-2: Celery Task Deserialization Risks

**Category:** OWASP A08:2021 – Data Integrity Failures
**Location:** Section 3 (Data Flow), Section 5.4 (Celery Task Dispatch)

**Description:**
The architecture uses Redis as the Celery broker with task arguments serialized as JSON. While JSON is safer than pickle, the architecture does not address task signature validation. If an attacker gains write access to Redis, they could inject malicious task payloads with crafted arguments (e.g., SQL injection strings, path traversal sequences, arbitrary report type IDs).

**Impact:**
Compromised Redis access could allow an attacker to:
- Forge `execute_schedule` tasks with arbitrary `ScheduleRun` IDs, potentially triggering generation for schedules they do not own
- Inject large or malformed payloads to cause worker crashes or resource exhaustion
- Trigger delivery tasks with manipulated recipient lists

**Recommendation:**
1. The Tech Lead should specify that all Celery task functions validate their input arguments at task entry (not just at the API layer). For example, `execute_schedule(run_id: int)` should verify the `ScheduleRun` exists and is in the correct state before proceeding.
2. Use Celery's `task_reject_on_worker_lost` and `task_acks_late` settings to prevent task loss on worker crashes.
3. Document Redis as a trusted boundary -- access must be restricted to API and worker containers only (no external access). The DevOps Engineer should configure Redis with `requirepass` and bind it to a private network in production.
4. Consider enabling Celery task signature validation in Phase 2 (not required for MVP, but note as a hardening opportunity).

**References:**
- Celery Security: [Task Message Protocol](https://docs.celeryq.dev/en/stable/userguide/security.html)
- CWE-502: Deserialization of Untrusted Data

---

### SUGGESTION-1: Enforce Owner Authorization at Database Query Level

**Category:** OWASP A01:2021 – Broken Access Control
**Location:** Section 6.1 (Orphan Schedule Policy), Section 2 (API package - authorization logic)

**Description:**
The architecture states that "authorization checks happen in route handlers via FastAPI dependencies" but does not specify how queries are scoped to the authenticated user. If authorization is implemented as a post-query check (fetch schedule, then check if `owner_id` matches the current user), there is a risk of IDOR (Insecure Direct Object Reference) vulnerabilities if the check is bypassed or implemented inconsistently.

**Impact:**
An attacker could enumerate schedule IDs and attempt to access or modify schedules they do not own if the authorization check is missing or improperly implemented in any endpoint.

**Recommendation:**
The Tech Lead should establish a pattern where database queries are **pre-filtered** by the authenticated user's ID, not post-checked. For example:

```python
# GOOD: Query scoped to owner
schedule = await session.get(
    select(Schedule).where(
        Schedule.id == schedule_id,
        Schedule.owner_id == current_user.id
    )
)
if not schedule:
    raise HTTPException(status_code=404)

# BAD: Fetch first, check after
schedule = await session.get(Schedule, schedule_id)
if schedule.owner_id != current_user.id:
    raise HTTPException(status_code=403)
```

The first approach prevents information disclosure (attacker cannot distinguish "does not exist" from "not authorized"). The Tech Lead should document this pattern as the project convention for owner-scoped queries.

Admin access (Phase 2) should be implemented as an explicit bypass of the owner filter, not by checking permissions after fetching.

**References:**
- OWASP A01:2021 – Broken Access Control
- CWE-639: Authorization Bypass Through User-Controlled Key

---

### SUGGESTION-2: Add Explicit Rate Limit on Email Delivery Volume

**Category:** OWASP A04:2021 – Insecure Design (Abuse Prevention)
**Location:** Section 6.6 (Abuse Prevention)

**Description:**
The architecture defines rate limits for schedule creation (10 creates per minute) and caps for recipients per schedule (50) and active schedules per user (25), but does not specify a rate limit on total **email delivery volume** per user or per account. A user could stay within the schedule limits (25 active schedules, 50 recipients each) but trigger 1,250 emails per delivery cycle. For a daily cadence, this is 1,250 emails/day per user -- potentially overwhelming the SMTP provider or appearing as abuse.

**Impact:**
Without a delivery volume limit, a malicious or misconfigured user could:
- Exhaust outbound email quota, affecting other users
- Trigger spam filtering that degrades deliverability for the entire account
- Incur unexpected costs if the SMTP provider charges per email

**Recommendation:**
Add a monitoring threshold (not a hard block for MVP) on total emails sent per user per day (e.g., 500 emails/day/user). If a user exceeds this threshold, log a warning and alert ops. The architecture's "per-account soft limit" (section 6.2) captures this concept but does not specify an actionable value.

For Phase 2, implement a hard limit with a 429 response at delivery time if the user exceeds their quota within a rolling 24-hour window. Store the counter in Redis (reusing the existing instance).

**References:**
- OWASP A04:2021 – Insecure Design
- CAN-SPAM Act compliance (rate limits reduce spam risk)

---

### SUGGESTION-3: Token-Based Unsubscribe Deferred -- Document Compliance Risk

**Category:** Compliance (GDPR, CAN-SPAM)
**Location:** Section 6.7 (Unsubscribe Mechanism)

**Description:**
The architecture defers self-service unsubscribe links to Phase 2, relying on an owner-mediated path for MVP ("contact the owner to be removed"). The rationale is that recipients are organizational/internal based on the persona context. This is reasonable for MVP, but the architecture does not document the **compliance boundary**: at what point does the feature cross into CAN-SPAM or GDPR territory requiring self-service unsubscribe?

**Impact:**
If the feature is used for external recipients (partners, customers) or if recipient volume exceeds "organizational team" scale without implementing self-service unsubscribe, the organization could face regulatory risk. The architecture's Phase 2 path is sound, but the decision to defer is undocumented from a compliance perspective.

**Recommendation:**
1. Document in the architecture (or escalate to Product Manager) the **explicit assumption** that Phase 1 recipients are internal/organizational only, and external recipients are out of scope for MVP.
2. Define a trigger condition for Phase 2 self-service unsubscribe: "If recipient count per schedule exceeds 20 (the persona's upper bound) OR if external recipients are added, implement tokenized unsubscribe links immediately."
3. The Tech Lead should add a comment in the email template footer implementation noting this assumption, so future developers are aware when the constraint changes.

This is not a blocker for MVP but should be on the SRE Engineer's operational radar -- if usage patterns deviate from the persona, escalate to Product Manager.

**References:**
- CAN-SPAM Act: [FTC Compliance Guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- GDPR Article 21: Right to Object

---

### INFO-1: Redis Access Should Be Network-Isolated

**Category:** OWASP A05:2021 – Security Misconfiguration
**Location:** Section 7 (Deployment Model)

**Description:**
The `compose.yml` exposes Redis on port 6379 with no authentication. This is acceptable for local development but should not carry over to production. The architecture does not specify network isolation or authentication requirements for Redis in production.

**Impact:**
In production, an exposed Redis instance allows unauthorized task injection, rate limit bypass, and potential data exfiltration if Redis is used for session storage or caching in the future.

**Recommendation:**
The DevOps Engineer should:
1. Bind Redis to a private network (not exposed to the public internet)
2. Enable `requirepass` authentication in production
3. Use TLS for Redis connections if the deployment spans multiple hosts
4. Document Redis as a "trusted component" boundary in the architecture's security model

For local dev, the current open configuration is fine.

**References:**
- Redis Security: [Official Guide](https://redis.io/docs/management/security/)
- OWASP A05:2021 – Security Misconfiguration

---

### INFO-2: SMTP Credentials Management Not Specified

**Category:** Secrets Management
**Location:** Section 5.5 (Configuration and Dependency Injection)

**Description:**
The architecture specifies `SMTP_HOST` and `SMTP_PORT` as environment variables but does not address how SMTP credentials (username, password, API keys for services like SendGrid or SES) are managed. For Mailpit in local dev, no credentials are needed, but production SMTP providers require authentication.

**Impact:**
If SMTP credentials are passed as plain environment variables in production, they may be logged, exposed in process listings, or committed to version control. This violates the project's security baseline ("never hardcode secrets, use environment variables or a secrets manager").

**Recommendation:**
The Tech Lead should specify in the configuration design:
1. SMTP credentials are loaded from environment variables prefixed with `SMTP_` (e.g., `SMTP_USERNAME`, `SMTP_PASSWORD`) or from a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) if available
2. The FastAPI startup script validates that SMTP credentials are present before starting the server (fail-fast if misconfigured)
3. The DevOps Engineer should use Kubernetes Secrets or OpenShift sealed secrets for production deployment, not plain environment variables in `compose.yml`

For MVP, environment variables are acceptable if the deployment platform (e.g., OpenShift) manages them securely. Document this assumption in the deployment section.

**References:**
- Security Baseline: `.claude/rules/security.md` (Secrets section)
- OWASP A02:2021 – Cryptographic Failures (Exposed Secrets)

---

## Security-Relevant Observations for Downstream Agents

### For the Tech Lead (Technical Design)

1. **Input validation boundaries:** Define validation rules for all user-controlled inputs that cross into the email system (recipient addresses, subject lines, report parameters). Specify that validation happens at both the API layer (Pydantic) and the protocol boundary (EmailSender).

2. **State machine enforcement:** The ScheduleRun status transitions (section 6.5) are enforced in task code, not the database. Ensure that invalid transitions raise exceptions rather than silently succeeding -- this prevents privilege escalation via task argument manipulation.

3. **Authorization pattern:** Document the owner-scoped query pattern (SUGGESTION-1) as the project convention for all owner-resource access. Include a code example in the Technical Design.

4. **Task argument validation:** Every Celery task must validate its input arguments at task entry, not just at the API boundary. This defends against Redis compromise (WARNING-2).

### For the Database Engineer

1. **No cascading foreign key for owner_id:** Confirmed in section 6.1. This is correct for the orphan schedule policy. No schema change needed for security.

2. **Index on (status, next_run_at):** Ensure this index exists for the tick query. An attacker cannot exploit the absence of this index for privilege escalation, but a missing index could cause performance degradation that appears as a denial of service under load.

### For the API Designer (OpenAPI Specification)

1. **Document authorization requirements:** Every endpoint that accesses a schedule must document the ownership requirement in the OpenAPI spec. For example: `GET /v1/schedules/{id}` returns 404 if the schedule does not exist OR if the caller is not the owner (do not distinguish these cases in the response).

2. **Rate limit headers:** Include `X-RateLimit-*` headers in the OpenAPI spec for schedule creation endpoints (documented in section 6.6).

### For the SRE Engineer (Architecture Review)

1. **Monitor recipient volume:** Section 6.2 defines a "soft limit" of 500 recipients per account. Ensure this is monitored and alerts are configured. SUGGESTION-2 adds a delivery volume threshold (500 emails/day/user) -- confirm this is logged and alertable.

2. **Redis security in production:** INFO-1 notes that Redis should be network-isolated and password-protected in production. Verify this in the deployment configuration review.

3. **SMTP failure handling:** The architecture's error path (section 3, Flow 2) handles email delivery failures gracefully, but does not specify what happens if the SMTP server is unreachable (connection timeout, auth failure). Ensure the EmailSender implementation has a timeout and logs SMTP connection failures as `error` level events for operational visibility.

---

## Summary

The architecture provides a solid security baseline for MVP. The primary risks are:
- Email header injection (WARNING-1) -- requires explicit input sanitization in the protocol contract
- Task deserialization (WARNING-2) -- requires input validation at task entry and Redis access control

Both are addressable in the Technical Design phase without architectural changes. The authorization model (owner + admin) is sound. Rate limiting is appropriately layered. The protocol abstractions (ReportGenerator, EmailSender) create clean security boundaries that simplify testing and auditing.

The unsubscribe mechanism (SUGGESTION-3) is acceptable for MVP given the persona context but should be revisited if usage patterns deviate from organizational/internal recipients.

No critical vulnerabilities identified. Proceed with Technical Design.
