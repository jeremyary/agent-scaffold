# Architecture Review -- Security Engineer

**Reviewer:** Security Engineer
**Document reviewed:** `/home/jary/redhat/git/agent-scaffold-test-0212/plans/architecture.md`
**Date:** 2026-02-12

---

## Security Architecture Assessment

### Authentication and Authorization

**Strengths:**
- API key authentication with SHA-256 hashing is appropriate for MVP scope
- Server-side role resolution prevents client-asserted privilege escalation
- Three-role hierarchy enforces least privilege effectively
- Redis caching (60-second TTL) for auth lookups reduces database load without creating long-lived stale mappings
- Startup warning for default keys addresses a common production misconfiguration vector

**Findings:**
- Key revocation mechanism is well-defined in architecture (sets `revoked_at` timestamp)
- Key expiration is optional (`expires_at` can be NULL) which is acceptable for MVP
- Authorization middleware checks role hierarchy correctly using IntEnum comparison

### PII Protection

**Critical Issue - PII Redaction:**
The architecture defers the PII redaction mechanism to OQ-9 but provides a strong recommendation (local OCR + NER using Tesseract and Presidio). The fallback behavior is well-defined: if OCR confidence is below threshold, processing fails safely and escalates to human review rather than sending potentially unredacted data externally. This is the correct fail-safe approach.

**SSN Handling:**
- AES-256-GCM encryption is appropriate
- Salted SHA-256 hash for lookups is correct
- Never returned in API responses - verified
- Never logged - verified in observability section
- Encryption key via environment variable is acceptable for MVP (production systems would use a key management service, but that's out of scope)

**Document PII Redaction Architecture:**
- Two-tier storage (original + redacted) in MinIO with access controls is correct
- Only redacted versions sent to external LLM APIs - verified
- Redaction events recorded in audit trail - verified
- Fail-safe behavior specified - verified

**Logging PII Protection:**
- Structured logging middleware strips PII fields - specified
- Explicit "never logged" list includes SSN, bank account numbers, DOB, income - verified
- Correlation IDs used instead of PII for tracing - verified

### Audit Trail Immutability

**Three-level enforcement is excellent:**

1. **Database level:** `REVOKE UPDATE, DELETE ON audit_events FROM app_role` - This is the strongest control and is correctly specified in the migration strategy (Section 3.2).

2. **Application level:** Audit repository exposes only `create()` and `query()` methods with no `update()` or `delete()` - This prevents accidental modification by developers.

3. **API level:** No API endpoint accepts PATCH or DELETE on audit events - This prevents external tampering.

**Verification approach:** Integration test attempts UPDATE and DELETE on audit_events and asserts permission error. This is the correct test strategy.

**Positive:** The append-only constraint is not just documented but multiply enforced. This meets the "immutability as guarantee, not claim" requirement from the product plan review.

### Public Tier Security

**Rate Limiting:**
- Two-layer approach (session + IP) is correct for preventing both single-session and distributed abuse
- Concurrency limit (max 1 active inference per session) prevents request queueing attacks
- Redis `SET NX` with 60-second TTL for concurrency lock is appropriate
- Rate limit key namespaces (`ratelimit:session:*`, `ratelimit:ip:*`) prevent cross-concern key collisions
- **Critical isolation confirmed:** Public and protected tiers use separate rate limit namespaces, preventing cross-tier interference

**Prompt Injection Defenses:**
Multi-layer approach is strong:
1. Input sanitization (removes system-prompt markers)
2. Length validation (2,000 character limit for chat)
3. Semantic detection (pattern matching for common injection attempts)
4. Output filtering (removes reflected injection content)
5. Structured prompting (clear system/user boundaries)

**Security logging:** Flagged inputs are logged with hashed content (not verbatim) to avoid logging malicious payloads - this is a subtle but important detail that demonstrates security maturity.

**Cost Caps:**
- Session token limits not explicitly specified as a cap (architectural gap - see findings)
- Per-session concurrency limit (1 active) indirectly limits cost
- IP-based daily caps are specified
- Calculator has higher rate limits than chat (500 vs 100) due to lower cost - appropriate

### External Service Boundaries

**LLM API Security:**
- No PII sent to external LLMs (redacted documents only) - verified
- Retry strategy distinguishes transient (429, 502, 503, 504) from permanent errors (400, 401, 403) - correct
- No retry on authentication/authorization failures prevents credential brute-forcing
- LangFuse integration is optional (silently skipped if unavailable) - correct for operational resilience

**FRED/BatchData Input Validation:**
- Architecture does not explicitly specify input validation for external API responses
- Caching strategy (Redis, 1h for FRED, 24h for BatchData) reduces attack surface by limiting external calls
- Fallback behavior defined (last cached value, hardcoded 6.5% if never cached)

**Mocked Service Pattern:**
- Python Protocol interface ensures real/mock implementations have identical signatures - reduces risk of security property divergence
- Environment variable selection allows zero-code swap

### Transport Security

**Container-to-container communication:**
- Architecture diagram shows services communicating within a Docker network
- No explicit mention of TLS for internal service communication (PostgreSQL, Redis, MinIO)
- For MVP local development, unencrypted internal communication is acceptable
- **Gap:** No guidance for production deployment where internal TLS should be enabled

**External API connections:**
- HTTPS for LLM APIs (Anthropic, OpenAI) - implicit in LangChain usage
- HTTPS for FRED API - specified
- MinIO S3 API - no explicit TLS requirement stated

**Client-facing:**
- No explicit HSTS header or HTTPS enforcement specified
- Missing Content-Security-Policy header specification

### Secrets Management

**Environment variables:**
- All secrets sourced from environment variables - correct for container deployment
- `.env.example` template provided, `.env` gitignored - verified
- No hardcoded secrets - verified

**Secrets inventory:**
- `SSN_ENCRYPTION_KEY` - AES-256-GCM key for SSN encryption
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` - LLM provider credentials
- `FRED_API_KEY` - FRED API credential
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` - Optional tracing keys
- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - Object storage credentials
- `DATABASE_URL` - Contains database password

**Key rotation:**
- API keys support revocation (sets `revoked_at`)
- No rotation mechanism for service credentials (LLM API keys, SSN encryption key) specified
- For MVP, manual rotation via environment variable update is acceptable

### Dependency Security

**Container base images:**
- `pgvector/pgvector:pg16` - Third-party image, security updates depend on maintainer
- No explicit image scanning or vulnerability monitoring specified
- No base image pinning to specific digest (uses tag only)

**Dependency scanning:**
- No mention of `npm audit`, `pip audit`, or container scanning in CI
- Requirements.txt / package.json lock files ensure reproducible builds but don't prevent vulnerable dependency installation

**Python/Node dependencies:**
- LangChain, LangGraph, FastAPI, React, Vite - large dependency trees
- No mention of dependency review process or license compatibility checks (Red Hat AI compliance requirement)

### Error Information Leakage

**RFC 7807 error responses:**
- Structure is correct (type, title, status, detail, instance)
- Error types are generic (authentication-required, validation-error, etc.) - correct
- `detail` field contains human-readable context - needs review for information leakage

**What is NOT leaked (verified):**
- Stack traces not sent to clients - confirmed by "Never expose internal error details" in error-handling.md
- SQL errors not sent to clients - same confirmation
- Full error details logged internally, sanitized response sent externally - verified

**Potential leak:**
- Application ID in `instance` field exposes UUID format (acceptable, not sensitive)
- Validation errors include field names and rejected values - acceptable for usability
- No mention of redacting PII from validation error messages (e.g., if SSN validation fails, error should not echo the SSN)

---

## Findings

### 1. [CRITICAL] SSN Encryption Key Management Lacks Rotation Strategy and Security Guidance

**Category:** Cryptographic Failures (OWASP #2)
**Location:** Section 6.4 (PII Handling), Section 7.2 (Docker Compose)
**Description:** The architecture specifies that SSN encryption uses AES-256-GCM with the key stored in the `SSN_ENCRYPTION_KEY` environment variable. However, there is no guidance on key generation (entropy requirements, format), key rotation (how to re-encrypt existing SSNs with a new key), or operational security (key should never be committed, logged, or exposed in process listings).

**Impact:**
- Weak key generation (e.g., a 16-character password instead of 256 bits of entropy) undermines the encryption
- No key rotation strategy means a compromised key cannot be safely replaced without data loss
- Developers unfamiliar with cryptographic key management may make dangerous mistakes (storing key in source control, using a predictable value)

**Recommendation:**
Add a subsection to Section 6.4 titled "SSN Encryption Key Management":

1. **Key generation:** Use `openssl rand -base64 32` or equivalent to generate a 256-bit key. Store in environment variable, never commit to source control.
2. **Key format:** Base64-encoded 32-byte random value (256 bits).
3. **Key rotation:** Out of scope for MVP. Production systems would implement dual-key decryption (old key + new key) and background re-encryption. For MVP, key rotation requires database export, re-encryption, and import.
4. **Operational security:** Key must never appear in logs, error messages, or process listings. Use secret management service (e.g., Vault, AWS Secrets Manager) in production; environment variable is acceptable for local development only.
5. **Startup validation:** On startup, verify `SSN_ENCRYPTION_KEY` is set and has sufficient length (minimum 32 bytes base64-encoded). Log error and refuse to start if missing or weak.

Add to Phase 1 build order: "SSN encryption key validation on startup."

**References:** OWASP Top 10 2021 - A02:2021 Cryptographic Failures, NIST 800-57 Key Management

---

### 2. [HIGH] PII in Validation Error Messages Could Leak Sensitive Data

**Category:** Cryptographic Failures (OWASP #2), Data Integrity Failures (OWASP #8)
**Location:** Section 4.3 (Error Response Format)
**Description:** The RFC 7807 error response format includes an `errors` array with `field`, `message`, and `value` for validation failures. If SSN validation fails, the error response would include the rejected SSN in the `value` field, logging it and transmitting it to the client. The architecture does not specify PII redaction in validation error responses.

**Impact:**
- SSN appears in API error response body
- SSN appears in structured logs (request/response logging middleware)
- SSN appears in browser developer tools and network monitoring
- Violates "SSN is NEVER returned in API responses" requirement from Section 4.2

**Recommendation:**
Add to Section 4.3 under the error response format:

**PII Redaction in Validation Errors:** For fields containing PII (SSN, bank account numbers, date of birth), the `value` field in validation errors must be redacted or omitted. Replace with a generic placeholder:

```json
{
    "field": "ssn",
    "message": "Must be a valid 9-digit SSN",
    "value": "[REDACTED]"
}
```

Add to Section 8.1 (Structured Logging): "Logging middleware must redact PII fields from validation error messages before writing to logs."

Add integration test: Submit application with invalid SSN format; verify error response does not contain the SSN value.

**References:** OWASP Top 10 2021 - A02:2021 Cryptographic Failures

---

### 3. [HIGH] No Explicit Token/Cost Limit Per Session for Public Tier

**Category:** Insecure Design (OWASP #4), Lack of Resources & Rate Limiting (OWASP API #4)
**Location:** Section 6.3 (Public Tier Protections)
**Description:** The architecture specifies per-session message limits (20 chat/hour) and per-session concurrency limits (max 1 active), but does not specify a per-session cumulative token limit or total cost cap. An attacker could send 20 short messages followed by extremely long responses (via prompt manipulation or adversarial input design) to generate unbounded LLM costs within the message limit.

**Impact:**
- Cost abuse via prompt engineering to generate long responses
- 20 messages x 4000 tokens/message = 80,000 tokens per session (high cost)
- No protection against "make the LLM talk forever" attacks
- Rate limits alone do not cap cost if response length varies

**Recommendation:**
Add to Section 6.3 under "Rate Limiting":

**Per-session token budget:** Each 24-hour session has a cumulative token budget (prompt + completion tokens across all chat messages). Recommended limit: 50,000 tokens per session (approximately 20 average messages with 2,500 tokens each). When the budget is exhausted, return 429 with message: "Session token limit exceeded. Please start a new session tomorrow."

Track cumulative tokens in Redis:
```
ratelimit:tokens:session:{session_id} -> <cumulative_token_count> (TTL: 24 hours)
```

After each LLM invocation, increment the counter by `prompt_tokens + completion_tokens`. Check before invoking LLM; if budget exhausted, reject request before calling LLM.

Add to US-042 acceptance criteria: "Session token budget enforced; 51st thousand tokens in a session returns 429."

**References:** OWASP API Security Top 10 - API4:2019 Lack of Resources & Rate Limiting

---

### 4. [HIGH] Missing Input Validation for External API Responses

**Category:** Injection (OWASP #3), Server-Side Request Forgery (OWASP #10)
**Location:** Section 2.6 (External Integrations)
**Description:** The architecture specifies caching and retry strategies for FRED and BatchData APIs but does not specify input validation for responses from external services. Malicious or compromised external APIs could inject unexpected data types, excessively large responses, or malicious payloads (e.g., XSS in property address fields).

**Impact:**
- FRED API returns malicious JSON that crashes parser or causes excessive memory allocation
- BatchData API returns address with embedded script tags that are stored and later rendered in UI without sanitization
- Compromised external API serves as injection vector into application data

**Recommendation:**
Add to Section 2.6 under "External Integrations" a subsection titled "External Response Validation":

All responses from external APIs must be validated before use:

1. **Type validation:** Use Pydantic models to validate response structure. Reject responses that do not match expected schema.
2. **Length limits:** Reject responses exceeding reasonable size (e.g., FRED rate response > 1KB, BatchData property response > 10KB).
3. **Content sanitization:** Strip HTML tags, script blocks, and special characters from string fields (property address, employer name) before storage.
4. **Numeric bounds:** Validate mortgage rates are within reasonable bounds (0.1% - 20%), property values are positive integers.

Failed validation results in a logged warning and graceful degradation (use cached value or hardcoded default).

Add to Phase 3b build order: "External API response validation with Pydantic models."

**References:** OWASP Top 10 2021 - A03:2021 Injection, OWASP Input Validation Cheat Sheet

---

### 5. [MEDIUM] Audit Trail Export Requires Additional Access Control

**Category:** Broken Access Control (OWASP #1)
**Location:** Section 2.1 (API Layer), Section 6.2 (Role Hierarchy)
**Description:** The architecture specifies `/v1/applications/{id}/audit/export` as a reviewer-only endpoint. However, it does not specify whether reviewers can export audit trails for ANY application or only applications they have reviewed. Unrestricted export allows a reviewer to download audit trails for all applications in the system, which may exceed their need-to-know for compliance purposes.

**Impact:**
- Reviewer with legitimate access can export audit trails for applications outside their responsibility
- Bulk audit export could be used to exfiltrate sensitive business data (approval rates, escalation reasons, denial patterns)
- Violates least-privilege principle

**Recommendation:**
Add to Section 6.2 under "Role Hierarchy" permissions table:

**Audit export restrictions:** Reviewers can export audit trails only for applications they have reviewed (recorded in `audit_events` with `actor_id` matching their user ID and `event_type` in ['human_approved', 'human_denied', 'documents_requested']). Attempting to export an audit trail for an application not reviewed by the requester returns 403.

Alternatively, if unrestricted export is required for compliance audits, add explicit justification in the architecture and consider adding a fourth role (`compliance_auditor`) with read-only access to all audit trails but no decision-making authority.

Add integration test: Loan officer reviews application A; attempts to export audit for application B (not reviewed); receives 403.

**References:** OWASP Top 10 2021 - A01:2021 Broken Access Control

---

### 6. [MEDIUM] Container Base Image Pinning and Vulnerability Scanning Not Specified

**Category:** Vulnerable Components (OWASP #6), Security Misconfiguration (OWASP #5)
**Location:** Section 7.2 (Docker Compose)
**Description:** The architecture uses `pgvector/pgvector:pg16` for PostgreSQL but does not pin to a specific image digest. Tags like `pg16` are mutable and can point to different images over time, introducing supply chain risk. Additionally, no container vulnerability scanning (e.g., Trivy, Clair) is specified for CI.

**Impact:**
- Tag mutation could introduce vulnerable versions of PostgreSQL or pgvector
- No visibility into known CVEs in container images
- Supply chain compromise via base image substitution
- Violates Red Hat AI compliance requirement to scan dependencies for vulnerabilities

**Recommendation:**
Add to Section 7.2 under "Docker Compose" a subsection titled "Container Security":

1. **Image pinning:** Pin all container images to specific SHA256 digests, not tags:
   ```yaml
   postgres:
     image: pgvector/pgvector:pg16@sha256:<digest>
   ```
   Update digests periodically via a controlled process (not automatically).

2. **Vulnerability scanning:** Run Trivy or equivalent in CI for all custom-built images (api, ui) and periodically for third-party images (postgres, redis, minio). Fail CI build if HIGH or CRITICAL vulnerabilities detected without exception approval.

3. **Base image selection:** For custom images, use minimal base images (e.g., `python:3.12-slim`, `node:22-alpine`) to reduce attack surface.

Add to Phase 1 build order: "Container vulnerability scanning in CI."

**References:** OWASP Top 10 2021 - A06:2021 Vulnerable and Outdated Components, NIST 800-190 Application Container Security Guide

---

### 7. [MEDIUM] Session Hijacking via Correlation ID Reuse

**Category:** Broken Access Control (OWASP #1), Authentication Failures (OWASP #7)
**Location:** Section 8.2 (Correlation ID Propagation)
**Description:** The architecture uses correlation IDs for tracing but does not clarify whether correlation IDs are distinct from session IDs. If a correlation ID is reused across multiple requests by different users or persisted across sessions, it could be used to correlate activity for privacy violations or session hijacking if session state is incorrectly keyed by correlation ID instead of session ID.

**Impact:**
- Correlation ID collision or reuse could allow one user's activity to be traced to another user
- If session state is mistakenly keyed by correlation ID (implementation error), correlation ID reuse enables session hijacking
- Privacy violation if multiple users' activity is linked via reused correlation ID

**Recommendation:**
Add to Section 8.2 under "Correlation ID Propagation":

**Correlation ID vs. Session ID:** Correlation IDs are used ONLY for tracing and logging. They are request-scoped (generated per request) and must never be used as session identifiers or for authorization decisions. Session IDs are stored in Redis with `session:{session_id}` keys and are distinct from correlation IDs.

Correlation IDs are either:
- Generated fresh per request (UUID v4 via middleware), OR
- Accepted from `X-Request-ID` header if provided by the client (for distributed tracing), but validated to ensure uniqueness.

Session IDs are:
- Generated server-side on first request to public tier (stored in `X-Session-ID` response header)
- Provided by client in subsequent requests via `X-Session-ID` header
- Validated to exist in Redis before processing request

Add integration test: Verify session state is keyed by session ID, not correlation ID. Send two requests with the same correlation ID but different session IDs; verify they access separate session state.

**References:** OWASP Top 10 2021 - A07:2021 Identification and Authentication Failures

---

### 8. [MEDIUM] Lack of HTTPS Enforcement and Security Headers

**Category:** Security Misconfiguration (OWASP #5)
**Location:** Section 7 (Infrastructure Architecture)
**Description:** The architecture does not specify HTTPS enforcement for production deployments or HTTP security headers (HSTS, Content-Security-Policy, X-Content-Type-Options, X-Frame-Options). These are critical for preventing man-in-the-middle attacks, clickjacking, and content injection.

**Impact:**
- Traffic between browser and API server could be intercepted (credentials, application data exposed)
- Missing CSP allows XSS if application has input sanitization gaps
- Missing X-Frame-Options allows clickjacking attacks
- Missing HSTS allows protocol downgrade attacks

**Recommendation:**
Add to Section 7 (Infrastructure Architecture) a new subsection "7.5 Production Security Configuration":

**HTTPS Enforcement:**
- All production deployments must serve traffic over HTTPS only
- HTTP requests must redirect to HTTPS (301 Moved Permanently)
- TLS 1.2 minimum, TLS 1.3 preferred
- Certificate validation required (no self-signed certificates in production)

**HTTP Security Headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.anthropic.com https://api.openai.com
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

FastAPI middleware to set these headers on all responses.

Add to Phase 1 build order: "Security headers middleware."

**References:** OWASP Top 10 2021 - A05:2021 Security Misconfiguration, OWASP Secure Headers Project

---

### 9. [MEDIUM] Redis Authentication Not Specified

**Category:** Security Misconfiguration (OWASP #5)
**Location:** Section 7.2 (Docker Compose)
**Description:** The `REDIS_URL` environment variable format `redis://redis:6379/0` suggests no authentication. The architecture does not specify whether Redis requires authentication (ACLs, password) or relies solely on network isolation. For production deployments, unauthenticated Redis is a significant risk.

**Impact:**
- If Redis port is exposed (misconfiguration), attackers can read/write session data, rate limit state, and cache
- Cache poisoning attacks could inject malicious data
- Rate limit bypass via direct Redis manipulation
- Session hijacking via session data modification

**Recommendation:**
Add to Section 7.2 under "Docker Compose" and Section 2.4 (Cache Layer):

**Redis Authentication:**
- MVP/local development: Redis runs without authentication, isolated within Docker network (acceptable for local-only deployment)
- Production: Redis must require authentication via `requirepass` directive or Redis 6+ ACLs
- Connection URL format: `redis://:password@redis:6379/0` (password in environment variable)
- Use separate Redis users with limited command access for different application functions (e.g., cache_user cannot execute FLUSHDB)

Add to `.env.example`:
```
REDIS_PASSWORD=<generate_strong_password>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
```

Add to Phase 1 build order: "Redis authentication configuration for production."

**References:** Redis Security Documentation, OWASP Top 10 2021 - A05:2021 Security Misconfiguration

---

### 10. [LOW] LangFuse Tracing Could Log Sensitive Prompts

**Category:** Logging Failures (OWASP #9), Data Integrity Failures (OWASP #8)
**Location:** Section 8.5 (LangFuse Integration)
**Description:** LangFuse traces include full prompt and completion content. If prompts contain PII (e.g., "Analyze this application for John Smith with SSN 123-45-6789"), LangFuse would log that PII to an external service. The architecture does not specify PII scrubbing for LangFuse traces.

**Impact:**
- PII transmitted to third-party tracing service (LangFuse)
- Violates "PII never sent to external services" principle
- Regulatory compliance violation (GDPR, CCPA)

**Recommendation:**
Add to Section 8.5 under "LangFuse Integration":

**PII in Traces:** LangFuse tracing is OPTIONAL and should be disabled in production if prompts may contain PII. For demonstration/development use, ensure prompts are sanitized before LLM invocation (e.g., replace SSN with hash, replace borrower name with application ID). Do not enable LangFuse in environments processing real PII unless LangFuse deployment is self-hosted and compliant with data handling policies.

Add warning to `.env.example`:
```
# LANGFUSE_PUBLIC_KEY=  # WARNING: Enabling LangFuse will log full prompts/completions.
# LANGFUSE_SECRET_KEY=  # Only use with synthetic/test data, not real PII.
```

Add to Phase 1 documentation: "LangFuse integration should be disabled when processing real borrower data."

**References:** OWASP Top 10 2021 - A09:2021 Security Logging and Monitoring Failures

---

### 11. [SUGGESTION] Add Principle of Least Privilege to Database Connection Pools

**Category:** Security Misconfiguration (OWASP #5)
**Location:** Section 10.2 (OQ-7: LangGraph Async + Connection Pool Interaction)
**Description:** The architecture specifies separate connection pools for application and LangGraph checkpointer, both connecting with the same `app_role` database user. However, the LangGraph checkpointer only needs access to checkpoint tables, not application tables. Using separate database roles with narrower grants would improve defense-in-depth.

**Impact:**
- If LangGraph checkpointer is compromised (code injection, dependency vulnerability), it has full application database access
- Reduces blast radius if either pool is exploited

**Recommendation:**
Consider using separate database roles:
- `app_role` - Full access to application tables (applications, documents, agent_decisions, audit_events, users, api_keys, configuration, embeddings), read-only access to checkpoint tables
- `checkpoint_role` - Full access to checkpoint tables only (checkpoint_blobs, checkpoint_writes, checkpoint_metadata), no access to application tables

Update connection pools:
```python
# Application pool
app_engine = create_async_engine(
    settings.DATABASE_URL,  # Uses app_role
    pool_size=5,
    max_overflow=15,
)

# LangGraph checkpoint pool
checkpoint_pool = await asyncpg.create_pool(
    dsn=settings.CHECKPOINT_DATABASE_URL,  # Uses checkpoint_role
    min_size=2,
    max_size=5,
)
```

This is a defense-in-depth improvement, not critical for MVP but recommended if time permits.

**References:** NIST 800-53 AC-6 (Least Privilege)

---

### 12. [SUGGESTION] Add API Request Size Limits

**Category:** Insecure Design (OWASP #4), Lack of Resources & Rate Limiting (OWASP API #4)
**Location:** Section 4 (API Design)
**Description:** The architecture specifies rate limits but does not specify request body size limits. Excessively large request bodies could cause memory exhaustion or slowdown.

**Impact:**
- Denial of service via large request body upload
- Memory exhaustion on API server
- Slow request processing affects other users

**Recommendation:**
Add to Section 4 (API Design) under middleware stack:

**Request size limits:**
- JSON request bodies: 1 MB maximum (enforced by FastAPI middleware)
- File uploads (documents): 10 MB maximum per file (enforced by upload handler)
- Multipart requests: 50 MB maximum total (for multiple document uploads)

Return 413 Payload Too Large if limits exceeded.

Add to Phase 1 build order: "Request size limit middleware."

**References:** OWASP API Security Top 10 - API4:2019 Lack of Resources & Rate Limiting

---

### 13. [POSITIVE] Excellent PII Redaction Fail-Safe Design

**Section:** Section 6.4 (PII Handling), Section 10.1 (OQ-9)
**Finding:** The architecture's PII redaction approach is exemplary: if redaction fails or confidence is below threshold, processing fails safely and the application is escalated to human review rather than proceeding with potentially unredacted data. The recommended local OCR + NER approach (Option A) provides the strongest security guarantee: PII never leaves the system boundary. The decision to fail closed rather than open demonstrates strong security design thinking.

---

### 14. [POSITIVE] Multi-Layer Rate Limiting with Concurrency Control

**Section:** Section 6.3 (Public Tier Protections)
**Finding:** The rate limiting architecture is sophisticated and production-ready: session limits prevent single-session abuse, IP limits prevent distributed abuse from the same source, and concurrency limits prevent request queueing attacks. The use of separate Redis key namespaces for public/protected tiers prevents cross-tier interference. This is a strong reference implementation for public-facing LLM applications.

---

### 15. [POSITIVE] Comprehensive Prompt Injection Defense Strategy

**Section:** Section 6.3 (Public Tier Protections)
**Finding:** The five-layer prompt injection defense (input sanitization, length validation, semantic detection, output filtering, structured prompting) demonstrates security depth. The decision to hash flagged inputs before logging (rather than logging verbatim) prevents the logs themselves from becoming an attack vector. This level of detail is appropriate for a teaching quickstart.

---

## Summary of Findings

| # | Severity | Section | Summary |
|---|----------|---------|---------|
| 1 | CRITICAL | 6.4 | SSN encryption key management lacks rotation strategy and security guidance |
| 2 | HIGH | 4.3 | PII in validation error messages could leak sensitive data |
| 3 | HIGH | 6.3 | No explicit token/cost limit per session for public tier |
| 4 | HIGH | 2.6 | Missing input validation for external API responses |
| 5 | MEDIUM | 2.1, 6.2 | Audit trail export requires additional access control |
| 6 | MEDIUM | 7.2 | Container base image pinning and vulnerability scanning not specified |
| 7 | MEDIUM | 8.2 | Session hijacking via correlation ID reuse |
| 8 | MEDIUM | 7 | Lack of HTTPS enforcement and security headers |
| 9 | MEDIUM | 7.2, 2.4 | Redis authentication not specified |
| 10 | LOW | 8.5 | LangFuse tracing could log sensitive prompts |
| 11 | SUGGESTION | 10.2 | Add principle of least privilege to database connection pools |
| 12 | SUGGESTION | 4 | Add API request size limits |
| 13 | POSITIVE | 6.4, 10.1 | Excellent PII redaction fail-safe design |
| 14 | POSITIVE | 6.3 | Multi-layer rate limiting with concurrency control |
| 15 | POSITIVE | 6.3 | Comprehensive prompt injection defense strategy |

---

## Follow-up on Product Plan Review

The architecture successfully addresses the two CRITICAL findings from the product plan review:

1. **Public Tier Cost Abuse and Prompt Injection Defense Details** (RESOLVED): Section 6.3 provides concrete mitigation patterns for prompt injection (five-layer defense) and rate limiting (session + IP + concurrency). However, per-session token budget is missing (new finding #3 above).

2. **PII Redaction Mechanism** (RESOLVED): Section 10.1 provides a strong recommendation (local OCR + NER) with clear rationale, fallback behavior, and security guarantee. The fail-safe approach (escalate rather than proceed on redaction failure) addresses the core concern.

The architecture also addresses most WARNING-level findings from the product plan review:

- **Audit trail immutability enforcement** (RESOLVED): Three-level enforcement specified in Section 6.5.
- **Rate limiting isolation** (RESOLVED): Separate key namespaces confirmed in Section 6.3.
- **Input validation strategy** (RESOLVED): Specified in Section 6.3 for public tier chat inputs.
- **Session TTL enforcement** (RESOLVED): Redis key expiration specified in Section 2.4.

Outstanding gaps from product plan review:
- **API key rotation** (DEFERRED): Phase 4 (P2) feature, acceptable for MVP.
- **Security implications of mocked services** (ACKNOWLEDGED): Mocked services use Protocol pattern, but security blind spots are not explicitly documented in architecture (this is a product plan documentation issue, not architectural).
- **Confidence threshold tampering controls** (ACKNOWLEDGED): Single-reviewer authority with audit trail is the MVP approach (no maker/checker pattern).

---

## Verdict

**APPROVE WITH CONDITIONS**

### Conditions for Approval

The following findings must be addressed before implementation begins:

1. **[CRITICAL] Finding #1 - SSN Encryption Key Management** - Add key generation, rotation, and operational security guidance to Section 6.4. Add startup validation to Phase 1 build order.

2. **[HIGH] Finding #2 - PII in Validation Error Messages** - Add PII redaction specification to Section 4.3 and Section 8.1. Add integration test to Phase 1 exit criteria.

3. **[HIGH] Finding #3 - No Token/Cost Limit Per Session** - Add per-session token budget specification to Section 6.3. Update US-042 acceptance criteria.

4. **[HIGH] Finding #4 - Missing Input Validation for External API Responses** - Add external response validation subsection to Section 2.6. Add to Phase 3b build order.

### Recommended Improvements (Non-Blocking)

The MEDIUM and LOW findings should be addressed during implementation or prior to production deployment:

- Finding #5 (audit export access control)
- Finding #6 (container vulnerability scanning)
- Finding #7 (correlation ID vs session ID clarification)
- Finding #8 (HTTPS enforcement and security headers)
- Finding #9 (Redis authentication)
- Finding #10 (LangFuse PII warning)
- Finding #11 (database role separation)
- Finding #12 (API request size limits)

### Strengths

- **PII redaction fail-safe design** (Finding #13) demonstrates security-first thinking
- **Multi-layer rate limiting** (Finding #14) is production-ready and exemplary for a teaching quickstart
- **Prompt injection defense depth** (Finding #15) is comprehensive and detailed
- **Audit trail immutability** enforcement at three levels (database, application, API) is robust
- **Server-side role resolution** prevents client-asserted privilege escalation
- **Separate rate limit namespaces** prevent cross-tier interference
- **Correlation ID propagation** architecture supports distributed tracing without compromising security (pending clarification in Finding #7)

### Summary

This architecture document demonstrates strong security awareness and provides a solid foundation for a regulated industry quickstart. The CRITICAL SSN key management gap and HIGH-severity PII leakage risks in validation errors must be addressed immediately. The token budget gap is an important cost control that should be added before public tier implementation. Once these four conditions are met, the architecture will be ready for technical design and implementation.

The architecture successfully resolves the two CRITICAL findings from the product plan review and addresses most WARNING-level concerns. The remaining gaps are well-scoped and addressable during implementation phases.
