<!-- This project was developed with assistance from AI tools. -->

# Requirements Chunk 1: Foundation (Infrastructure + Auth)

This document expands the Pass 1 story skeletons for the foundational infrastructure layer into full Given/When/Then acceptance criteria. These stories establish authentication, audit trail recording, PII protection, workflow persistence, developer experience, and observability. All downstream feature chunks depend on these.

**Stories covered:** AUTH-01 through AUTH-08, AUDIT-01 through AUDIT-04, PII-01 through PII-04, CHECKPOINT-01 through CHECKPOINT-03, DX-01 through DX-04, OBS-01 through OBS-03

---

## Authentication and RBAC (AUTH)

### AUTH-01: Require Authentication for All Protected Endpoints

**As a** system, **I want** to require authentication for all protected endpoints and refuse access without valid credentials, **so that** unauthorized users cannot access loan data.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Valid API key grants access**
- **Given** a valid, non-expired, active API key exists in the system
- **When** a request is sent to any protected endpoint with header `Authorization: Bearer <role>:<key>`
- **Then** the request is processed and a response with the appropriate status code is returned

**AC-2: Missing Authorization header returns 401**
- **Given** no `Authorization` header is present in the request
- **When** the request is sent to any protected endpoint
- **Then** the system returns HTTP 401 with an RFC 7807 error body containing `"title": "Unauthorized"` and `"detail"` explaining that authentication is required

**AC-3: Malformed Authorization header returns 401**
- **Given** an `Authorization` header is present but does not match the format `Bearer <role>:<key>` (e.g., missing "Bearer" prefix, missing colon separator, empty key segment)
- **When** the request is sent to any protected endpoint
- **Then** the system returns HTTP 401 with an RFC 7807 error body and the malformed header value is NOT logged (it may contain a partial key)

**AC-4: Invalid (unknown) API key returns 401**
- **Given** an `Authorization` header with a correctly formatted but unrecognized key (no matching hash in `api_keys` table)
- **When** the request is sent to any protected endpoint
- **Then** the system returns HTTP 401 and an audit event of type `auth_event` is recorded with `metadata.reason: "unknown_key"`

**AC-5: Revoked API key returns 401**
- **Given** an API key that has been revoked (`is_active = false`)
- **When** a request is sent with that key
- **Then** the system returns HTTP 401 and an audit event is recorded with `metadata.reason: "revoked_key"`

**AC-6: Public endpoints do not require authentication**
- **Given** no `Authorization` header is present
- **When** a request is sent to a public endpoint (`/v1/chat/*`, `/v1/calculator/*`, `/v1/market-data/*`, `/health`, `/ready`)
- **Then** the request is processed normally without authentication

**AC-7: Authentication failure does not leak key existence**
- **Given** two requests: one with a valid but revoked key and one with a completely fabricated key
- **When** both requests are sent to a protected endpoint
- **Then** both return HTTP 401 with indistinguishable response bodies (no timing or content difference that reveals whether the key exists)

#### Notes
- The key lookup uses HMAC-SHA256 hashing with a server-side secret (see AUTH-06 for role resolution details).
- All auth failures must be logged as audit events for security monitoring (see AUDIT-01).
- The `Authorization` header value must never appear in log output. Log only `"Authorization: Bearer [REDACTED]"`.

---

### AUTH-02: Create API Keys

**As a** reviewer, **I want** to create new API keys for loan officers and senior underwriters with descriptions and expiration dates, **so that** I can manage access.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Reviewer creates a new API key successfully**
- **Given** the caller is authenticated with `reviewer` role
- **When** the caller sends `POST /v1/auth/keys` with body `{"role": "loan_officer", "description": "Maria's key", "expiresInDays": 90}`
- **Then** the system returns HTTP 201 with a response containing the plaintext API key (returned only once, never retrievable afterward), the key ID, role, description, and expiration timestamp. An audit event of type `auth_event` is recorded with `metadata.action: "key_created"`.

**AC-2: Plaintext key is never stored**
- **Given** a new API key is created
- **When** the key is stored in the database
- **Then** only the HMAC-SHA256 hash of the key (computed with the server-side `HMAC_SECRET_KEY`) is stored in the `key_hash` column. The plaintext key is not stored anywhere.

**AC-3: Non-reviewer role cannot create keys**
- **Given** the caller is authenticated with `loan_officer` or `senior_underwriter` role
- **When** the caller sends `POST /v1/auth/keys`
- **Then** the system returns HTTP 403 with an RFC 7807 error body

**AC-4: Invalid role value rejected**
- **Given** the caller is authenticated with `reviewer` role
- **When** the caller sends `POST /v1/auth/keys` with body `{"role": "admin"}` (not one of the three valid roles)
- **Then** the system returns HTTP 422 with validation error details

**AC-5: Expiration defaults to 90 days if not specified**
- **Given** the caller sends `POST /v1/auth/keys` without an `expiresInDays` field
- **When** the key is created
- **Then** the key's `expires_at` is set to 90 days from creation time

**AC-6: Description is optional**
- **Given** the caller sends `POST /v1/auth/keys` without a `description` field
- **When** the key is created
- **Then** the key is created successfully with a null description

#### Notes
- A reviewer can create keys for any role, including other reviewers.
- The plaintext key must be returned in the creation response and never again. The API must clearly communicate this to the caller.
- See AUDIT-01 for audit event recording requirements.

---

### AUTH-03: Revoke API Keys

**As a** reviewer, **I want** to revoke an API key before its expiration date, **so that** I can remove access immediately when needed.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Reviewer revokes an active key**
- **Given** the caller is authenticated with `reviewer` role and a target API key ID exists and is active
- **When** the caller sends `DELETE /v1/auth/keys/:id`
- **Then** the system sets `is_active = false` on the key, returns HTTP 204, and records an audit event of type `auth_event` with `metadata.action: "key_revoked"` and `metadata.target_key_id` containing the revoked key's ID

**AC-2: Revoking an already-revoked key is idempotent**
- **Given** a key that has already been revoked
- **When** the caller sends `DELETE /v1/auth/keys/:id` for that key
- **Then** the system returns HTTP 204 (no error, idempotent)

**AC-3: Non-reviewer cannot revoke keys**
- **Given** the caller is authenticated with `loan_officer` or `senior_underwriter` role
- **When** the caller sends `DELETE /v1/auth/keys/:id`
- **Then** the system returns HTTP 403

**AC-4: Revoking a nonexistent key returns 404**
- **Given** no API key exists with the provided ID
- **When** the caller sends `DELETE /v1/auth/keys/:id`
- **Then** the system returns HTTP 404

**AC-5: A reviewer cannot revoke their own key**
- **Given** the caller is authenticated with `reviewer` role
- **When** the caller sends `DELETE /v1/auth/keys/:id` where `:id` matches their own key
- **Then** the system returns HTTP 409 with detail explaining that self-revocation is not allowed (prevents accidental lockout)

#### Notes
- Revocation is a soft delete (`is_active = false`), not a physical delete. The key record is preserved for audit trail purposes.
- Immediate effect: any subsequent request using the revoked key returns 401 (see AUTH-01 AC-5).

---

### AUTH-04: List API Keys

**As a** reviewer, **I want** to list all API keys with their roles and expiration dates, **so that** I can audit access.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Reviewer lists all keys**
- **Given** the caller is authenticated with `reviewer` role and multiple API keys exist
- **When** the caller sends `GET /v1/auth/keys`
- **Then** the system returns HTTP 200 with a paginated list of keys. Each key entry includes: `id`, `role`, `description`, `expiresAt`, `isActive`, `createdAt`. The plaintext key and key hash are NEVER included in the response.

**AC-2: List includes both active and revoked keys**
- **Given** some keys are active and some are revoked
- **When** the caller sends `GET /v1/auth/keys`
- **Then** both active and revoked keys appear in the list, with `isActive` indicating their status

**AC-3: Non-reviewer cannot list keys**
- **Given** the caller is authenticated with `loan_officer` or `senior_underwriter` role
- **When** the caller sends `GET /v1/auth/keys`
- **Then** the system returns HTTP 403

**AC-4: Pagination support**
- **Given** more keys exist than the default page size
- **When** the caller sends `GET /v1/auth/keys?cursor=<value>&limit=20`
- **Then** the system returns the requested page with `pagination.nextCursor` and `pagination.hasMore` fields

**AC-5: Empty key list returns empty array**
- **Given** no API keys exist (other than the caller's own key)
- **When** the caller sends `GET /v1/auth/keys`
- **Then** the system returns HTTP 200 with `{"data": [...], "pagination": {"hasMore": false}}`

#### Notes
- This endpoint is read-only. No key secrets are ever exposed.
- Keys can be filtered by `role` or `isActive` query parameters.

---

### AUTH-05: Enforce Role-Based Access Control with Hierarchical Permissions

**As a** system, **I want** to enforce role-based access control with three roles (`loan_officer`, `senior_underwriter`, `reviewer`) with hierarchical permissions, **so that** users can only perform authorized actions.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Role hierarchy is respected**
- **Given** three roles with hierarchy `loan_officer < senior_underwriter < reviewer`
- **When** an endpoint requires minimum role `senior_underwriter`
- **Then** callers with `senior_underwriter` or `reviewer` role are allowed, and callers with `loan_officer` role receive HTTP 403

**AC-2: Loan officer access scope**
- **Given** a caller with `loan_officer` role
- **When** the caller accesses protected endpoints
- **Then** the caller can: create applications, upload documents, view their own applications, submit applications, withdraw applications, retry failed applications, and review medium-confidence escalations in the review queue. The caller cannot: access the review queue for low-confidence, fraud-flagged, or conflict-escalated applications; manage API keys; access admin endpoints; export audit trails.

**AC-3: Senior underwriter access scope**
- **Given** a caller with `senior_underwriter` role
- **When** the caller accesses protected endpoints
- **Then** the caller has all `loan_officer` capabilities plus: review all escalated applications (medium-confidence, low-confidence, fraud-flagged, and conflict-escalated)

**AC-4: Reviewer access scope**
- **Given** a caller with `reviewer` role
- **When** the caller accesses protected endpoints
- **Then** the caller has all `senior_underwriter` capabilities plus: manage API keys (create, revoke, list), access admin endpoints (threshold configuration, knowledge base management), export audit trails, and view compliance reports

**AC-5: Insufficient role returns 403 with no information leakage**
- **Given** a caller with a valid key but insufficient role for the requested endpoint
- **When** the request is processed
- **Then** the system returns HTTP 403 with an RFC 7807 body containing `"title": "Forbidden"` and a generic detail message. The response does not reveal what role is required or what role the caller has.

**AC-6: Role-based filtering on review queue**
- **Given** escalated applications exist with different escalation reasons (medium-confidence, low-confidence, fraud-flagged, conflict-escalated)
- **When** a `loan_officer` queries the review queue
- **Then** only medium-confidence escalations are returned. Low-confidence, fraud-flagged, and conflict-escalated applications are not visible.

#### Notes
- Role checking is implemented via a `require_role(minimum_role)` dependency that compares the authenticated key's role against the required minimum using the hierarchy ordering.
- The review queue filtering is enforced at the API level, not just the UI level. See the architecture's "Role-Based Review Queue Filtering" section.

---

### AUTH-06: Server-Side Role Resolution from API Key

**As a** system, **I want** to resolve the authoritative role from the API key alone (not the client-supplied role prefix in the Bearer token), **so that** privilege escalation attacks are prevented.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Server uses the key's database role, not the client-supplied prefix**
- **Given** an API key created with role `loan_officer` and key value `abc123`
- **When** a request is sent with header `Authorization: Bearer reviewer:abc123`
- **Then** the system authenticates the request using the key's actual role (`loan_officer`), NOT the client-supplied role (`reviewer`). The caller has `loan_officer` permissions only.

**AC-2: Role mismatch is logged as a warning**
- **Given** a request where the client-supplied role prefix does not match the key's actual role
- **When** the request is authenticated
- **Then** the system logs a `warn`-level structured log entry with the correlation ID, the client-supplied role, and the actual role. The log entry does NOT include the API key value.

**AC-3: Matching role prefix proceeds silently**
- **Given** a request where the client-supplied role prefix matches the key's actual role
- **When** the request is authenticated
- **Then** no warning is logged for the role match

**AC-4: Missing role prefix is handled gracefully**
- **Given** a request with header `Authorization: Bearer abc123` (no role prefix, no colon)
- **When** the request is processed
- **Then** the system extracts the entire token as the key, computes the HMAC-SHA256 hash, and looks it up. If the key is valid, authentication succeeds with the key's database role. If invalid, HTTP 401 is returned.

**AC-5: HMAC-SHA256 hashing uses server-side secret**
- **Given** an API key value `abc123` and server-side `HMAC_SECRET_KEY`
- **When** the key is hashed for lookup
- **Then** the hash is computed as `HMAC-SHA256(HMAC_SECRET_KEY, abc123)` and compared against the `key_hash` column in constant time

#### Notes
- This is the core security mechanism that prevents privilege escalation (ADR-002 in the architecture).
- The `AuthContext` dataclass populated after successful auth contains `key_id`, `role` (from database), and `correlation_id`. The client-supplied role prefix is discarded after the mismatch check.

---

### AUTH-07: Production Credential Hard-Fail

**As a** system, **I want** to refuse to start in production mode if default or seed credentials are detected, **so that** insecure deployments are blocked.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Production mode rejects seed API keys**
- **Given** `ENVIRONMENT=production` and the database contains API keys marked as seed keys (e.g., via a `is_seed` flag or known seed key hashes)
- **When** the application starts
- **Then** the application exits with a non-zero exit code and logs an `error`-level message identifying that seed credentials were detected

**AC-2: Production mode rejects default MinIO credentials**
- **Given** `ENVIRONMENT=production` and `MINIO_ACCESS_KEY=minioadmin` or `MINIO_SECRET_KEY=minioadmin`
- **When** the application starts
- **Then** the application exits with a non-zero exit code and logs an error message identifying the default MinIO credentials

**AC-3: Production mode rejects default database password**
- **Given** `ENVIRONMENT=production` and the `DATABASE_URL` contains a known default password (e.g., `postgres` as password)
- **When** the application starts
- **Then** the application exits with a non-zero exit code and logs an error message identifying the default database credentials

**AC-4: Development mode allows default credentials**
- **Given** `ENVIRONMENT=development` (or not set, defaulting to `development`) and default/seed credentials are present
- **When** the application starts
- **Then** the application starts normally. A `warn`-level log entry notes that default credentials are in use.

**AC-5: Missing required secrets block startup**
- **Given** `ENVIRONMENT=production` and `ENCRYPTION_KEY` or `HMAC_SECRET_KEY` is not set
- **When** the application starts
- **Then** the application exits with a non-zero exit code identifying the missing secret

**AC-6: Hard fail, not a warning**
- **Given** any production credential check fails
- **When** the application attempts to start
- **Then** the process exits before accepting any HTTP requests. No partial startup occurs.

#### Notes
- This is a firm requirement from the product plan: "hard fail, not just a warning."
- The check runs at application startup, before the HTTP server begins listening.
- In development mode, seed credentials are expected and necessary for DX-01 and DX-02.

---

### AUTH-08: API Key Expiration

**As a** system, **I want** to expire API keys after their configured TTL (90 days for protected tier, 24 hours for development seeds), **so that** old keys cannot be reused indefinitely.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Expired key returns 401**
- **Given** an API key whose `expires_at` timestamp is in the past
- **When** a request is sent with that key
- **Then** the system returns HTTP 401 and records an audit event with `metadata.reason: "expired_key"`

**AC-2: Key near expiration still works**
- **Given** an API key whose `expires_at` is 1 second in the future
- **When** a request is sent with that key
- **Then** the request is authenticated successfully

**AC-3: Default TTL for protected tier is 90 days**
- **Given** a new API key is created via `POST /v1/auth/keys` without specifying `expiresInDays`
- **When** the key is stored
- **Then** `expires_at` is set to exactly 90 days from the creation timestamp

**AC-4: Seed keys have 24-hour TTL**
- **Given** seed data is loaded during development setup
- **When** seed API keys are created
- **Then** each seed key has `expires_at` set to 24 hours from creation time

**AC-5: Custom TTL is respected**
- **Given** a reviewer creates a key with `expiresInDays: 30`
- **When** the key is stored
- **Then** `expires_at` is set to 30 days from the creation timestamp

**AC-6: Expiration check uses server time**
- **Given** the server's clock and the key's `expires_at` timestamp
- **When** the key is validated
- **Then** the comparison uses the server's current UTC timestamp, not any client-supplied time

#### Notes
- Expiration is checked on every authentication attempt, alongside the `is_active` check.
- Seed keys' short TTL ensures they cannot be accidentally used in long-running environments.
- The 90-day default and 24-hour seed TTL values come from the product plan and architecture.

---

## Audit Trail (AUDIT)

### AUDIT-01: Record Audit Events for Workflow State Transitions

**As a** system, **I want** to record an audit event for every workflow state transition with before state, after state, actor, timestamp, and correlation ID, **so that** all changes are traceable.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: State transition creates an audit event**
- **Given** a loan application exists with status `draft`
- **When** the application status is changed to `submitted`
- **Then** an audit event is inserted into `audit_events` with:
  - `event_type`: `"state_transition"`
  - `application_id`: the application's UUID
  - `actor_id`: the API key ID of the user or agent name that triggered the transition
  - `actor_type`: `"user"` or `"agent"`
  - `actor_role`: the role of the acting user (if user)
  - `previous_state`: `"draft"`
  - `new_state`: `"submitted"`
  - `created_at`: server UTC timestamp
  - `metadata.correlation_id` or top-level `correlation_id` field matching the request correlation ID

**AC-2: All valid state transitions are audited**
- **Given** the defined status transitions: `null->draft`, `draft->submitted`, `submitted->processing`, `processing->awaiting_review`, `processing->approved`, `processing->processing_error`, `awaiting_review->approved`, `awaiting_review->denied`, `awaiting_review->awaiting_documents`, `awaiting_documents->processing`, `processing_error->processing`, and `*->withdrawn` (from non-terminal states)
- **When** any valid transition occurs
- **Then** an audit event with `event_type: "state_transition"` is recorded for each transition

**AC-3: Auth events are audited**
- **Given** an authentication attempt (success or failure)
- **When** the auth middleware processes the request
- **Then** an audit event with `event_type: "auth_event"` is recorded, including the outcome (`success`, `failed_unknown_key`, `failed_expired_key`, `failed_revoked_key`), the correlation ID, and the actor identity (key ID for successes, "anonymous" for failures)

**AC-4: Key management events are audited**
- **Given** a reviewer creates or revokes an API key
- **When** the key management action completes
- **Then** an audit event with `event_type: "auth_event"` is recorded with `metadata.action` set to `"key_created"` or `"key_revoked"` and the target key ID

**AC-5: Audit event includes correlation ID**
- **Given** a request with correlation ID `abc-123`
- **When** the request triggers a state transition
- **Then** the audit event's correlation ID field matches `abc-123`

**AC-6: Agent decision events are audited**
- **Given** an agent (document processor, credit analyst, etc.) completes its analysis
- **When** the agent returns its result
- **Then** an audit event with `event_type: "agent_decision"` is recorded with: `agent_name`, `confidence_score`, `reasoning`, `input_data_hash` (SHA-256 of the agent's input data), and `application_id`

**AC-7: Audit event timestamp is server-generated**
- **Given** any action that generates an audit event
- **When** the event is inserted
- **Then** `created_at` is set by the database (via `DEFAULT now()`), not by the application code

#### Notes
- Audit events are append-only. See AUDIT-03 for immutability enforcement.
- The `input_data_hash` in agent decision events allows verification that the agent processed the expected data without storing the raw input.
- Event types include: `state_transition`, `agent_decision`, `human_review`, `auth_event`, `threshold_change`, `document_upload`, `routing_decision`.
- Cross-references: OBS-02 (correlation ID propagation), AUTH-01 (auth failure auditing).

---

### AUDIT-02: Record Audit Events for Human Review Actions

**As a** system, **I want** to record an audit event for every human review action with reviewer identity, role, decision, rationale, and timestamp, **so that** human decisions are traceable.

**Priority:** P0 | **Phase:** 1 (schema and recording service) / Phase 2 (actual review events)

#### Acceptance Criteria

**AC-1: Approve action creates an audit event**
- **Given** a reviewer approves an escalated application
- **When** the approve action completes
- **Then** an audit event is inserted with:
  - `event_type`: `"human_review"`
  - `application_id`: the application's UUID
  - `actor_id`: the reviewer's API key ID
  - `actor_type`: `"user"`
  - `actor_role`: the reviewer's role (e.g., `"senior_underwriter"`)
  - `metadata.decision`: `"approved"`
  - `metadata.rationale`: the reviewer's rationale text
  - `created_at`: server UTC timestamp

**AC-2: Deny action creates an audit event**
- **Given** a reviewer denies an escalated application
- **When** the deny action completes
- **Then** an audit event is inserted with `event_type: "human_review"`, `metadata.decision: "denied"`, and `metadata.rationale` containing the denial rationale

**AC-3: Request-additional-documents action creates an audit event**
- **Given** a reviewer requests additional documents for an application
- **When** the request-documents action completes
- **Then** an audit event is inserted with `event_type: "human_review"`, `metadata.decision: "request_documents"`, and `metadata.instructions` containing the document request instructions

**AC-4: Rationale is required for approve and deny**
- **Given** a reviewer submits an approve or deny action
- **When** the rationale field is empty or missing
- **Then** the system returns HTTP 422 with a validation error indicating that rationale is required

**AC-5: Audit event includes the reviewer's actual role**
- **Given** a reviewer with `senior_underwriter` role approves an application
- **When** the audit event is recorded
- **Then** `actor_role` is `"senior_underwriter"` (the server-resolved role, not any client-supplied value)

#### Notes
- The audit event recording service and schema are built in Phase 1. Actual human review events are generated starting in Phase 2 when the minimal review queue is delivered.
- Cross-references: AUTH-06 (server-side role resolution), REV-03 and REV-04 (review actions).

---

### AUDIT-03: Enforce Audit Event Immutability

**As a** system, **I want** to enforce audit event immutability via database permissions (INSERT-only role), trigger guard, and hash chaining, **so that** audit records cannot be tampered with.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: INSERT-only database role**
- **Given** the `audit_writer` PostgreSQL role is configured
- **When** any database user attempts to execute `UPDATE` on `audit_events` using the `audit_writer` role
- **Then** the database rejects the operation with a permission error

**AC-2: DELETE is denied by database permissions**
- **Given** the `audit_writer` PostgreSQL role is configured
- **When** any database user attempts to execute `DELETE` on `audit_events` using the `audit_writer` role
- **Then** the database rejects the operation with a permission error

**AC-3: Trigger guard blocks UPDATE**
- **Given** a `BEFORE UPDATE OR DELETE` trigger exists on `audit_events`
- **When** an UPDATE is attempted on `audit_events` (even from a superuser or a different role that bypasses the `audit_writer` restriction)
- **Then** the trigger raises an exception with message indicating audit events are immutable

**AC-4: Trigger guard blocks DELETE**
- **Given** a `BEFORE UPDATE OR DELETE` trigger exists on `audit_events`
- **When** a DELETE is attempted on `audit_events`
- **Then** the trigger raises an exception with message indicating audit events are immutable

**AC-5: Hash chaining links events**
- **Given** an application with existing audit events where the most recent event has hash `H_n`
- **When** a new audit event is inserted for that application
- **Then** the new event's `prev_event_hash` is set to `SHA-256(id || application_id || event_type || created_at || prev_event_hash)` of the previous event. The `||` denotes concatenation of the string representations.

**AC-6: First event per application uses null sentinel hash**
- **Given** an application with no existing audit events
- **When** the first audit event is inserted for that application
- **Then** `prev_event_hash` is set to a defined null sentinel value (e.g., `"0" * 64`, a string of 64 zeros)

**AC-7: Advisory lock serializes concurrent audit writes per application**
- **Given** multiple agents running in parallel for the same application (e.g., credit analyst, risk assessor, compliance checker)
- **When** each agent completes and inserts an audit event
- **Then** audit event inserts acquire a PostgreSQL advisory lock keyed on the `application_id`, serializing writes and ensuring the hash chain is linear (no forks)

**AC-8: System-level events (no application) have independent hash chain**
- **Given** an audit event with `application_id = NULL` (e.g., auth events not tied to a specific application)
- **When** the event is inserted
- **Then** the event uses a separate hash chain for system-level events (or `prev_event_hash` is set to the null sentinel, as system events are independently traceable)

**AC-9: Audit writer connection uses SET ROLE**
- **Given** the application's transactional connection pool
- **When** an audit event needs to be inserted
- **Then** the connection executes `SET ROLE audit_writer` before the INSERT and restores the original role afterward. No separate connection pool is created for audit writes.

#### Notes
- Three layers of defense: (1) database permissions, (2) trigger guard, (3) hash chaining. This is defense-in-depth as specified in the architecture.
- The advisory lock approach adds negligible latency (a few milliseconds) relative to LLM call latency.
- Hash chain validation is performed during audit export (Phase 5, AUDIT-06). The daily background validation job detects chain breaks proactively.
- Cross-references: AUDIT-01 (event recording), AUDIT-02 (human review events).

---

### AUDIT-04: Query Audit Events for an Application

**As a** loan officer or reviewer, **I want** to query the audit trail for a specific application, **so that** I can see the complete history of events.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful audit event listing**
- **Given** an authenticated user authorized to view the application
- **When** they send a GET request to `/v1/applications/:id/audit-events`
- **Then** the system returns 200 with `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true/false } }`, each event includes event type, actor, timestamp, metadata, and correlation ID, events are ordered chronologically (oldest first), and the default page size is 50 with a maximum of 200

**AC-2: Filtering by event type**
- **Given** an authenticated user querying audit events
- **When** they send a GET request with `?eventType=state_transition` (or `agent_decision`, `human_review`, `document_upload`, `auth_event`, `config_change`)
- **Then** only events matching the specified type are returned

**AC-3: Filtering by date range**
- **Given** an authenticated user querying audit events
- **When** they send a GET request with `?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-02-01T00:00:00Z`
- **Then** only events within the specified date range (inclusive) are returned

**AC-4: Cursor-based pagination**
- **Given** an application with more audit events than the page limit
- **When** the user sends a GET request with `?cursor=<value>&limit=<number>`
- **Then** the system returns the next page of results starting after the cursor position, and `hasMore` is `false` on the last page

**AC-5: Role-based access**
- **Given** a `loan_officer` who did not create the application
- **When** they request audit events for that application
- **Then** the system returns 404 (consistent with APP-03 AC-4)

- **Given** a `senior_underwriter` or `reviewer`
- **When** they request audit events for any application
- **Then** the system returns the full audit event history

**AC-6: Empty audit trail**
- **Given** an application with no audit events (edge case -- should not occur since creation generates an event)
- **When** the user queries audit events
- **Then** the system returns 200 with `{ "data": [], "pagination": { "hasMore": false } }`

**AC-7: Application not found**
- **Given** an authenticated user
- **When** they request audit events for a non-existent application UUID
- **Then** the system returns 404 with an RFC 7807 error response

#### Notes
- This endpoint is a sub-resource of the application. Authorization follows the same rules as APP-03 (loan officers see only their own applications; senior_underwriter and reviewer see all).
- No audit event is generated for read-only audit queries.
- Cross-references: AUDIT-01 (state transition events), AUDIT-02 (agent decision events), AUDIT-03 (immutability guarantees), APP-03 (authorization model).

---

## PII Protection (PII)

### PII-01: Encrypt PII Fields at Rest

**As a** system, **I want** to encrypt SSNs, account numbers, and government IDs with application-level encryption before storing them in the database, **so that** PII is protected at rest.

**Priority:** P0 | **Phase:** 1 (schema with encrypted columns) / Phase 2 (encryption service operational)

#### Acceptance Criteria

**AC-1: SSN is encrypted before storage**
- **Given** a loan application is created with a borrower SSN
- **When** the application record is inserted into `loan_applications`
- **Then** the `ssn_encrypted` column contains Fernet-encrypted ciphertext (not the plaintext SSN). The `ssn_last4` column contains the last 4 digits in plaintext for display purposes.

**AC-2: Account numbers are encrypted before storage**
- **Given** a loan application includes account numbers
- **When** the application record is stored
- **Then** the `account_numbers_encrypted` column contains Fernet-encrypted ciphertext

**AC-3: Government IDs are encrypted before storage**
- **Given** a loan application includes a government ID
- **When** the application record is stored
- **Then** the `government_id_encrypted` column contains Fernet-encrypted ciphertext

**AC-4: Encryption key is sourced from environment**
- **Given** the `ENCRYPTION_KEY` environment variable is set
- **When** PII fields are encrypted
- **Then** the Fernet key used for encryption is derived from the `ENCRYPTION_KEY` environment variable. The key is never hardcoded in source code.

**AC-5: Missing encryption key prevents PII storage**
- **Given** the `ENCRYPTION_KEY` environment variable is not set
- **When** the application attempts to encrypt a PII field
- **Then** the operation fails with a clear error rather than storing plaintext PII

**AC-6: Ciphertext includes a key version prefix**
- **Given** an encrypted PII field
- **When** the ciphertext is stored
- **Then** a key version prefix byte is prepended to the ciphertext to route decryption to the correct key during key rotation

**AC-7: Decryption returns the original plaintext**
- **Given** an encrypted SSN stored in `ssn_encrypted`
- **When** the field is decrypted using the correct Fernet key
- **Then** the original SSN value is returned

**AC-8: API responses mask PII**
- **Given** a loan application with encrypted PII
- **When** the application is returned via any API endpoint
- **Then** PII fields are masked in the response: SSN appears as `"***-**-1234"` (last 4 only), account numbers and government IDs are fully masked (e.g., `"[REDACTED]"`). Cleartext PII is never included in API responses.

#### Notes
- The `cryptography` library's Fernet implementation provides authenticated encryption (AES-128-CBC with HMAC-SHA256).
- The PII field registry for this system: SSN, account numbers, government IDs. Full names are PII when associated with financial data but are not encrypted at the database level (they are needed for display). Full names ARE redacted before LLM calls (see PII-03).
- Cross-references: PII-04 (key rotation), PII-03 (LLM redaction).

---

### PII-02: Mask PII in Log Output

**As a** system, **I want** to mask PII fields in all log output (e.g., SSN: "***-**-1234"), **so that** PII never appears in logs.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: SSN is masked in logs**
- **Given** a log entry that references a borrower's SSN
- **When** the log entry is emitted
- **Then** the SSN appears as `"***-**-1234"` (only last 4 digits visible) or `"[SSN_REDACTED]"` if the last 4 are not available

**AC-2: Account numbers are masked in logs**
- **Given** a log entry that references a financial account number
- **When** the log entry is emitted
- **Then** the account number appears as `"[ACCOUNT_REDACTED]"` or with only the last 4 digits visible

**AC-3: Government IDs are masked in logs**
- **Given** a log entry that references a government ID
- **When** the log entry is emitted
- **Then** the government ID appears as `"[GOV_ID_REDACTED]"`

**AC-4: Authorization headers are masked in logs**
- **Given** a log entry that includes request headers
- **When** the log entry is emitted
- **Then** the `Authorization` header appears as `"Authorization: Bearer [REDACTED]"`. The API key value is never logged.

**AC-5: Document filenames are sanitized in logs**
- **Given** a log entry that references an uploaded document's original filename (which may contain PII, e.g., "John_Smith_W2_123-45-6789.pdf")
- **When** the log entry is emitted
- **Then** the filename is logged only as the UUID storage key, not the original filename

**AC-6: PII masking applies to all log levels**
- **Given** log entries at any level (error, warn, info, debug)
- **When** the entry contains PII
- **Then** PII is masked regardless of log level

**AC-7: Structured log fields are masked**
- **Given** structured JSON log output with dedicated fields (e.g., `"ssn"`, `"accountNumber"`)
- **When** the log entry is serialized
- **Then** the field values are masked before serialization

#### Notes
- PII masking is applied at the logging infrastructure level, not at each individual log call site. This prevents accidental PII leaks from new log statements.
- Cross-references: OBS-03 (structured JSON logging), PII-01 (field-level encryption).

---

### PII-03: Redact PII Before External LLM Calls

**As a** system, **I want** to redact PII from all data sent to external LLM APIs before transmission, **so that** sensitive data is not exposed to third parties.

**Priority:** P0 | **Phase:** 2 (operational from first real LLM call)

#### Acceptance Criteria

**AC-1: SSN redacted before LLM call**
- **Given** document extraction data contains a borrower's SSN
- **When** the data is prepared for an LLM API call
- **Then** the SSN value is replaced with the redaction token `[SSN_REDACTED]`

**AC-2: Account numbers redacted before LLM call**
- **Given** data sent to an LLM contains financial account numbers
- **When** the data is prepared for the LLM API call
- **Then** account numbers are replaced with `[ACCOUNT_REDACTED]`

**AC-3: Government IDs redacted before LLM call**
- **Given** data sent to an LLM contains government IDs
- **When** the data is prepared for the LLM API call
- **Then** government IDs are replaced with `[GOV_ID_REDACTED]`

**AC-4: Full names redacted when associated with financial data**
- **Given** data sent to an LLM contains a full name alongside financial data (loan amount, income, debts)
- **When** the data is prepared for the LLM API call
- **Then** the full name is replaced with `[NAME_REDACTED]`

**AC-5: Redaction service uses a field registry**
- **Given** the PII redaction service (`services/pii.py`)
- **When** it processes structured data
- **Then** it identifies PII fields by name pattern matching and an explicit field registry (not just regex over values). Fields matching patterns like `ssn`, `social_security`, `account_number`, `government_id`, `borrower_name` (when in financial context) are redacted.

**AC-6: Redaction tokens are distinguishable**
- **Given** multiple PII field types in the same data payload
- **When** redaction is applied
- **Then** each field type has a unique redaction token (`[SSN_REDACTED]`, `[ACCOUNT_REDACTED]`, `[GOV_ID_REDACTED]`, `[NAME_REDACTED]`) so that the LLM can reason about the presence of field types without seeing values

**AC-7: Non-PII data is preserved**
- **Given** data sent to an LLM contains non-PII fields (loan amount, property address, interest rate)
- **When** redaction is applied
- **Then** non-PII fields are passed through unchanged

**AC-8: Redaction is mandatory for all agent nodes**
- **Given** any agent node in the loan processing graph that calls an external LLM
- **When** the agent prepares its LLM prompt
- **Then** the PII redaction service is invoked before the LLM call. An agent that skips redaction is a code review finding (not enforced at runtime, but a required dependency in the agent pattern).

**AC-9: Redaction token mapping is maintained**
- **Given** data is redacted before an LLM call
- **When** the redaction service processes the data
- **Then** it returns both the redacted data and a mapping of redaction tokens to field paths (not values). This mapping allows the result processing layer to understand which fields were redacted without storing the original PII values.

#### Notes
- The PII redaction pipeline is described in the architecture's "PII Redaction Pipeline" section.
- Redaction is applied to all loan processing graph agents (document processor, credit analyst, risk assessor, compliance checker, fraud detector, denial coach).
- The intake agent does not process PII data (it has no access to application data), so redaction is not required for intake graph LLM calls.
- Cross-references: PII-01 (encryption at rest), PIPE-08 (pipeline-level redaction requirement).

---

### PII-04: Encryption Key Rotation with Dual-Key Decryption

**As a** system, **I want** to support encryption key rotation with dual-key decryption (current key + previous key), **so that** old records remain readable during rotation.

**Priority:** P0 | **Phase:** 1 (mechanism) / Phase 2+ (operational with encrypted data)

#### Acceptance Criteria

**AC-1: Current key is used for new encryption**
- **Given** `ENCRYPTION_KEY` is set to key K2
- **When** a new PII field is encrypted
- **Then** the encryption uses key K2 and the ciphertext is prefixed with K2's key version identifier

**AC-2: Previous key is used for decryption of old records**
- **Given** `ENCRYPTION_KEY` is set to K2 and `ENCRYPTION_KEY_PREVIOUS` is set to K1, and a record was encrypted with K1
- **When** the record's PII field is decrypted
- **Then** the system reads the key version prefix, determines the record was encrypted with K1, uses `ENCRYPTION_KEY_PREVIOUS` for decryption, and returns the plaintext

**AC-3: Current key is tried first for decryption**
- **Given** a record encrypted with the current key K2
- **When** the record's PII field is decrypted
- **Then** the system reads the key version prefix, determines the record was encrypted with K2, and decrypts with the current key without falling back to the previous key

**AC-4: Missing previous key causes decryption failure for old records**
- **Given** `ENCRYPTION_KEY` is set to K2 and `ENCRYPTION_KEY_PREVIOUS` is not set, and a record was encrypted with K1
- **When** the record's PII field is decrypted
- **Then** the decryption fails with a clear error indicating that the previous encryption key is required but not configured

**AC-5: Key version prefix routes to correct key**
- **Given** ciphertext with a key version prefix byte
- **When** decryption is attempted
- **Then** the prefix byte determines which key (current or previous) to use, without trial-and-error decryption

**AC-6: Batch re-encryption is deferred**
- **Given** a key rotation from K1 to K2
- **When** the rotation is performed (updating environment variables)
- **Then** existing records remain encrypted with K1 and are decrypted on-read using `ENCRYPTION_KEY_PREVIOUS`. Batch re-encryption of all records to K2 is NOT required at MVP.

#### Notes
- The architecture specifies: "A key version prefix byte is prepended to each ciphertext to route decryption to the correct key."
- Only two keys are supported at a time (current + previous). Rotation beyond two keys requires re-encrypting records from the oldest key before removing it.
- Cross-references: PII-01 (encryption at rest), AUTH-07 (production credential checks include encryption key).

---

## Workflow Persistence (CHECKPOINT)

### CHECKPOINT-01: Checkpoint Workflow State After Every Agent Node

**As a** system, **I want** to checkpoint the loan processing workflow state after every agent node execution, **so that** in-progress workflows survive service restarts.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: State is checkpointed after each node**
- **Given** a loan processing workflow is in progress
- **When** an agent node (document processor, credit analyst, risk assessor, compliance checker, aggregator, etc.) completes execution
- **Then** the full graph state is persisted to the `langgraph` schema via PostgresSaver before the next node begins

**AC-2: Workflow resumes from last checkpoint after restart**
- **Given** a workflow is in progress and the service restarts after the document processor completes but before the credit analyst starts
- **When** the service comes back up and the workflow is resumed
- **Then** the workflow resumes from the document processing checkpoint. The document processor does not re-execute. The credit analyst begins with the state that includes document processing results.

**AC-3: Parallel agents that completed before restart do not re-execute**
- **Given** credit analyst and risk assessor run in parallel, credit analyst completes and is checkpointed, then the service crashes before risk assessor completes
- **When** the service restarts and the workflow resumes
- **Then** the credit analyst's results are preserved from the checkpoint. Only the risk assessor re-executes.

**AC-4: Checkpoint includes all accumulated agent results**
- **Given** a workflow where document processing and credit analysis have completed
- **When** the checkpoint is saved after credit analysis
- **Then** the checkpointed state includes both the document processing results and the credit analysis results

**AC-5: Checkpoint failure does not silently corrupt state**
- **Given** a checkpoint write fails (e.g., database connection error)
- **When** the failure occurs
- **Then** the workflow node's completion is not acknowledged. On restart, the node re-executes rather than proceeding with uncheckpointed state.

#### Notes
- Checkpointing is foundational from Phase 1 (ADR-001). In Phase 1, a stub agent is used to prove the pattern.
- PostgresSaver manages checkpoint storage in the `langgraph` schema.
- Cross-references: CHECKPOINT-02 (application ID as thread ID), CHECKPOINT-03 (cleanup).

---

### CHECKPOINT-02: Application ID as LangGraph Thread ID

**As a** system, **I want** to use the application ID as the LangGraph thread ID, **so that** workflows are naturally resumable.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Application ID maps to thread ID**
- **Given** a loan application with ID `app-uuid-123`
- **When** the loan processing graph is invoked for this application
- **Then** the LangGraph `thread_id` is set to `app-uuid-123`

**AC-2: Retry uses the same thread ID**
- **Given** an application in `processing_error` status with ID `app-uuid-123`
- **When** the user retries the application via `POST /v1/applications/:id/retry`
- **Then** the graph is re-invoked with the same `thread_id = app-uuid-123`, and PostgresSaver resumes from the last successful checkpoint

**AC-3: Corrupted checkpoint falls back to fresh invocation**
- **Given** an application with ID `app-uuid-123` whose checkpoint data is corrupted or unreadable
- **When** a retry is attempted
- **Then** the system falls back to a fresh graph invocation with thread_id `app-uuid-123:{analysis_pass}` (e.g., `app-uuid-123:2`), re-running the full pipeline

**AC-4: Resubmission increments analysis pass**
- **Given** an application with `analysis_pass = 1` that receives additional documents and re-enters processing
- **When** the pipeline is re-invoked
- **Then** `analysis_pass` is incremented to 2, and the new invocation uses thread_id `app-uuid-123:2`

**AC-5: Only one in-flight workflow per application**
- **Given** an application in `processing` status with an active workflow
- **When** a retry or resubmission is attempted while the workflow is still running
- **Then** the system returns HTTP 409 indicating that a workflow is already in progress for this application

#### Notes
- The `application_id` as `thread_id` mapping is specified in the architecture's "Graph invocation" section.
- Cross-references: CHECKPOINT-01 (checkpointing), APP-07 (retry).

---

### CHECKPOINT-03: Clean Up Old Checkpoints

**As a** system, **I want** to clean up checkpoints for terminal workflows (approved, denied, withdrawn) older than 30 days, **so that** checkpoint storage does not grow unbounded.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Terminal workflow checkpoints are cleaned up after 30 days**
- **Given** a loan application in terminal status (`approved`, `denied`, or `withdrawn`) with its most recent status change more than 30 days ago
- **When** the checkpoint cleanup job runs
- **Then** all checkpoint data in the `langgraph` schema associated with that application's thread ID(s) is deleted

**AC-2: Non-terminal workflow checkpoints are preserved**
- **Given** a loan application in non-terminal status (`draft`, `submitted`, `processing`, `awaiting_review`, `awaiting_documents`, `processing_error`)
- **When** the checkpoint cleanup job runs
- **Then** all checkpoint data for that application is preserved, regardless of age

**AC-3: Cleanup job runs on a schedule**
- **Given** the checkpoint cleanup configuration
- **When** the scheduled time arrives (daily)
- **Then** the cleanup job executes and removes eligible checkpoints

**AC-4: Cleanup does not affect active workflows**
- **Given** a workflow that has been in `processing` status for more than 30 days (e.g., stalled)
- **When** the cleanup job runs
- **Then** the checkpoint is NOT deleted because the application is not in a terminal state

**AC-5: Cleanup removes all passes for a given application**
- **Given** an application that went through 2 analysis passes (thread IDs `app-uuid-123` and `app-uuid-123:2`) and is now in terminal status older than 30 days
- **When** the cleanup job runs
- **Then** checkpoints for both thread IDs are deleted

#### Notes
- The 30-day retention period comes from the architecture specification.
- Cleanup is a background job, not triggered by user action.
- Audit events for the application are NOT cleaned up (they are immutable and retained indefinitely).
- Cross-references: CHECKPOINT-01 (checkpointing), CHECKPOINT-02 (thread ID mapping).

---

## Developer Experience (DX)

### DX-01: Single-Command Setup and Development Start

**As a** developer, **I want** to run `make setup` and `make dev` to go from clone to running system with all services started and seed data loaded, **so that** I can get started quickly.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: `make setup` installs all dependencies**
- **Given** a developer has cloned the repository and has prerequisite tools installed (Node.js, Python, pnpm, uv, Podman/Docker)
- **When** the developer runs `make setup`
- **Then** all Node.js dependencies are installed (via pnpm), all Python dependencies are installed (via uv), and a `.env` file is created from `.env.example` if one does not already exist

**AC-2: `make dev` starts all services**
- **Given** `make setup` has been run successfully
- **When** the developer runs `make dev`
- **Then** all infrastructure services start (PostgreSQL with pgvector, Redis, MinIO, optionally LangFuse) via container compose, the API server starts (uvicorn with hot-reload), and the UI dev server starts (Vite)

**AC-3: Database migrations run automatically**
- **Given** `make dev` is starting the API server
- **When** the API server starts
- **Then** Alembic migrations are applied automatically, bringing the database schema up to date

**AC-4: Seed data loads on first run**
- **Given** the database has been freshly created (no existing data)
- **When** `make dev` starts the API server
- **Then** seed data is loaded automatically, including test API keys, test loan applications, and test documents

**AC-5: Seed data is idempotent**
- **Given** seed data has already been loaded
- **When** `make dev` is run again
- **Then** seed data loading does not duplicate existing records or fail

**AC-6: Clone to running system in under 30 minutes**
- **Given** a developer unfamiliar with the project, with prerequisite tools already installed
- **When** the developer follows the README instructions (clone, `make setup`, `make dev`)
- **Then** the system is fully running with seed data within 30 minutes

**AC-7: Clear error messages for missing prerequisites**
- **Given** a developer is missing a prerequisite tool (e.g., pnpm not installed)
- **When** `make setup` runs
- **Then** a clear error message identifies the missing prerequisite and how to install it

**AC-8: Seed data includes knowledge base documents**
- **Given** a freshly seeded development environment
- **When** the seed data is loaded
- **Then** the knowledge base contains sample regulatory excerpts (ECOA, Fair Housing Act, TILA, RESPA) with pre-computed embeddings, sufficient for the compliance checker (PIPE-05) and intake agent (CHAT-03) to perform RAG queries in Phase 3a without requiring the KB management API (KB-01)

**AC-9: Seed data includes default threshold configuration**
- **Given** a freshly seeded development environment
- **When** the seed data is loaded
- **Then** the `threshold_configurations` table contains a default active configuration with `auto_approve_threshold: 0.85`, `escalation_threshold: 0.60`, and the routing rules from PIPE-06, sufficient for the aggregator/router to operate in Phase 2 without requiring the threshold management API (THRESHOLD-01/02)

#### Notes
- Prerequisite tools: Node.js (LTS), Python 3.11+, pnpm, uv, Podman or Docker, Docker Compose (or Podman Compose).
- The `.env.example` file contains all required environment variables with sensible development defaults.
- Cross-references: DX-02 (seed data composition), DX-03 (API docs), AUTH-07 (development mode allows default credentials).

---

### DX-02: Diverse Seed Data for All Workflow States

**As a** developer, **I want** seed data to include diverse test applications in various workflow states (draft, processing, awaiting_review, approved, denied, processing_error, fraud-flagged), **so that** I can explore all system capabilities.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Seed data includes 12 test applications**
- **Given** the seed data script runs
- **When** seed data is loaded
- **Then** exactly 12 test loan applications are created with the following distribution:
  - 3 applications in `approved` status
  - 2 applications in `denied` status
  - 3 applications in `awaiting_review` status:
    - 1 with fraud flag escalation
    - 1 with agent conflict escalation
    - 1 with low-confidence escalation
  - 1 application in `processing` status
  - 1 application in `processing_error` status
  - 1 application in `draft` status
  - 1 application in `withdrawn` status

**AC-2: Seed data includes API keys for all three roles**
- **Given** the seed data script runs
- **When** seed data is loaded
- **Then** at least one API key per role is created: `loan_officer`, `senior_underwriter`, `reviewer`. Each seed key has a 24-hour TTL. The plaintext keys are printed to the console or documented in the README.

**AC-3: Approved applications have complete audit trails**
- **Given** seed applications in `approved` status
- **When** the seed data is loaded
- **Then** each approved application has a complete set of audit events: creation, document upload(s), submission, processing state transitions, agent decisions with confidence scores and reasoning, and the approval event

**AC-4: Denied applications have denial reasons**
- **Given** seed applications in `denied` status
- **When** the seed data is loaded
- **Then** each denied application includes agent decisions with specific denial reasoning (e.g., "DTI ratio of 52% exceeds maximum threshold of 43%")

**AC-5: Seed applications have associated documents**
- **Given** seed applications (except draft)
- **When** seed data is loaded
- **Then** each non-draft application has at least 2 associated document records with varied document types (W-2, pay stub, tax return, bank statement, appraisal)

**AC-6: Seed data uses realistic but synthetic values**
- **Given** the seed data
- **When** inspected
- **Then** all borrower names, SSNs, account numbers, and addresses are synthetic (not real people). SSNs are in the 900-999 range (reserved for testing by the SSA). Monetary values are realistic for US mortgage scenarios.

**AC-7: Seed data is clearly labeled**
- **Given** seed API keys and seed applications
- **When** inspected in the database
- **Then** seed records are identifiable (e.g., descriptions include "SEED" prefix, or a `is_seed` flag is set)

#### Notes
- The seed data composition (12 applications) is based on the open question defaults provided.
- Seed data must exercise the full state machine so developers can explore all UI views and API responses.
- Cross-references: DX-01 (automatic seed loading), AUTH-08 (24-hour seed key TTL).

---

### DX-03: Interactive API Documentation

**As a** developer, **I want** interactive API documentation at `/docs`, **so that** I can explore and test endpoints without writing code.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Swagger UI available at `/docs`**
- **Given** the API server is running
- **When** a developer navigates to `http://localhost:8000/docs`
- **Then** an interactive Swagger UI is displayed with all available endpoints organized by resource group

**AC-2: All endpoints are documented**
- **Given** the Swagger UI
- **When** the developer browses the endpoint list
- **Then** every registered API endpoint appears with its HTTP method, path, description, request parameters, request body schema, and response schemas

**AC-3: Try-it-out functionality works**
- **Given** the Swagger UI
- **When** the developer clicks "Try it out" on an endpoint, fills in parameters, and clicks "Execute"
- **Then** the request is sent to the running API server and the response is displayed with status code, headers, and body

**AC-4: Authentication is testable via Swagger UI**
- **Given** the Swagger UI
- **When** the developer clicks "Authorize" and enters a Bearer token (e.g., `loan_officer:<seed_key>`)
- **Then** subsequent requests from the Swagger UI include the `Authorization` header

**AC-5: Request and response schemas include examples**
- **Given** the Swagger UI
- **When** the developer expands an endpoint's request or response schema
- **Then** example values are provided for key fields (e.g., example loan amounts, example status values)

**AC-6: Error responses are documented**
- **Given** the Swagger UI
- **When** the developer views an endpoint's response documentation
- **Then** common error responses (401, 403, 404, 422) are listed with their RFC 7807 error body schemas

#### Notes
- FastAPI generates OpenAPI documentation automatically. This story ensures the documentation is complete and usable.
- The `/docs` endpoint is unauthenticated for developer convenience.
- Cross-references: DX-01 (running system), AUTH-01 (authentication for protected endpoints).

---

### DX-04: Architecture Documentation with System Diagram

**As a** developer, **I want** architecture documentation with a system diagram, **so that** I can understand the component relationships.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: README includes architecture overview**
- **Given** the project repository
- **When** a developer reads the README
- **Then** the README includes an architecture overview section with a visual system diagram showing the major components (React UI, FastAPI API, PostgreSQL, Redis, MinIO, LangGraph loan processing graph, LangGraph intake graph, external LLM APIs)

**AC-2: Component relationships are documented**
- **Given** the architecture documentation
- **When** a developer reads it
- **Then** the documentation describes how components communicate: UI to API (HTTP), API to database (SQLAlchemy), API to MinIO (S3 protocol), API to Redis (cache), API to LLM APIs (HTTP), LangGraph graphs to PostgresSaver (checkpoint persistence)

**AC-3: Quickstart guide is included**
- **Given** the README
- **When** a developer reads it
- **Then** a quickstart section provides step-by-step instructions: prerequisites, clone, `make setup`, `make dev`, accessing the UI, accessing the API docs

**AC-4: Troubleshooting section is included**
- **Given** the README
- **When** a developer encounters an issue
- **Then** a troubleshooting section addresses common problems: port conflicts, missing prerequisites, database connection failures, container startup issues, seed data not loading

**AC-5: Inline code comments explain multi-agent patterns**
- **Given** the codebase
- **When** a developer reads the agent and graph source files
- **Then** inline comments explain the key patterns: supervisor-worker orchestration, confidence-based routing, checkpoint persistence, PII redaction, and audit event recording

#### Notes
- This story covers documentation artifacts, not code functionality.
- The architecture diagram should be a text-based diagram (ASCII art or Mermaid) so it renders in Markdown without external tools.
- Cross-references: DX-01 (setup flow), the architecture document (`plans/architecture.md`) as source material.

---

## Observability (OBS)

### OBS-01: Generate Correlation ID for Every Request

**As a** system, **I want** to generate a unique correlation ID for every incoming request (or use X-Request-ID if provided), **so that** requests are traceable across services.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: New request gets a generated correlation ID**
- **Given** an incoming HTTP request without an `X-Request-ID` header
- **When** the request is processed by the correlation ID middleware
- **Then** a new UUID v4 is generated and attached to the request as its correlation ID

**AC-2: Provided X-Request-ID is used**
- **Given** an incoming HTTP request with header `X-Request-ID: abc-123-def`
- **When** the request is processed by the correlation ID middleware
- **Then** the value `abc-123-def` is used as the correlation ID (no new ID is generated)

**AC-3: Correlation ID is returned in the response**
- **Given** any HTTP request (with or without `X-Request-ID`)
- **When** the response is sent
- **Then** the response includes the `X-Request-ID` header with the correlation ID used for that request

**AC-4: Malicious X-Request-ID is sanitized**
- **Given** an incoming request with an `X-Request-ID` header containing characters outside `[a-zA-Z0-9_-]` or exceeding 128 characters
- **When** the request is processed
- **Then** the provided value is ignored and a new UUID is generated instead

**AC-5: Correlation ID is available to downstream handlers**
- **Given** the correlation ID middleware has processed a request
- **When** downstream route handlers, service layers, and audit recording access the request
- **Then** the correlation ID is accessible via `request.state` or the `AuthContext` dataclass

#### Notes
- The correlation ID middleware runs before authentication middleware so that even failed auth attempts have a traceable ID.
- Cross-references: OBS-02 (propagation), OBS-03 (inclusion in log entries), AUDIT-01 (inclusion in audit events).

---

### OBS-02: Propagate Correlation ID to All Log Entries and Downstream Calls

**As a** system, **I want** to include the correlation ID in all log entries, audit events, and downstream service calls, **so that** distributed traces are possible.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: All log entries include correlation ID**
- **Given** a request with correlation ID `req-abc-123`
- **When** any log entry is emitted during the processing of that request
- **Then** the structured log entry includes `"correlationId": "req-abc-123"`

**AC-2: All audit events include correlation ID**
- **Given** a request with correlation ID `req-abc-123` that triggers an audit event
- **When** the audit event is recorded
- **Then** the audit event record includes the correlation ID in its metadata or a dedicated field

**AC-3: LangGraph invocations receive correlation ID**
- **Given** a request that triggers a LangGraph workflow invocation
- **When** the graph is invoked
- **Then** the correlation ID is passed as part of the LangGraph config/metadata, making it accessible to all agent nodes within the graph execution

**AC-4: Agent node log entries include correlation ID**
- **Given** an agent node executing within a LangGraph graph
- **When** the agent emits log entries
- **Then** those log entries include the correlation ID from the graph metadata

**AC-5: LLM API calls include correlation ID in metadata**
- **Given** an agent node calling an external LLM API
- **When** the LLM client sends the request
- **Then** if the LLM API supports request metadata or headers, the correlation ID is included. If not, the correlation ID is logged alongside the LLM call for correlation.

**AC-6: Background tasks inherit correlation ID**
- **Given** a request that enqueues a background task (e.g., workflow invocation after application submission)
- **When** the background task executes
- **Then** the background task uses the correlation ID from the originating request

#### Notes
- Correlation ID propagation is the foundation for distributed tracing across the API, LangGraph graphs, and external service calls.
- Cross-references: OBS-01 (ID generation), OBS-03 (structured logging format), AUDIT-01 (audit events).

---

### OBS-03: Emit Structured JSON Logs

**As a** system, **I want** to emit structured JSON logs with timestamp, level, message, correlationId, and service fields, **so that** logs are machine-parseable.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: All log entries are structured JSON**
- **Given** the application is running (in any environment)
- **When** a log entry is emitted
- **Then** the entry is a valid JSON object on a single line (JSON Lines format)

**AC-2: Required base fields are present**
- **Given** any log entry
- **When** the entry is serialized
- **Then** it contains at minimum:
  - `"timestamp"`: ISO 8601 format with timezone (e.g., `"2026-01-15T14:30:00.000Z"`)
  - `"level"`: one of `"error"`, `"warn"`, `"info"`, `"debug"`
  - `"message"`: human-readable description
  - `"correlationId"`: the request's correlation ID (or `null` for startup/shutdown logs)
  - `"service"`: service identifier (e.g., `"api"`, `"loan-graph"`, `"intake-graph"`)

**AC-3: Contextual fields are included when available**
- **Given** a log entry emitted during request processing
- **When** the entry is serialized
- **Then** it may include additional fields: `"userId"` (API key ID), `"operation"` (route name or agent name), `"durationMs"` (for timing), `"statusCode"` (for responses), `"applicationId"`, `"agentName"`

**AC-4: Log levels are used correctly**
- **Given** the log level definitions:
  - `error`: something failed and requires attention
  - `warn`: something unexpected but recovered
  - `info`: significant business events
  - `debug`: diagnostic detail
- **When** log entries are emitted throughout the application
- **Then** each entry uses the appropriate level per these definitions

**AC-5: PII is never present in logs**
- **Given** any log entry
- **When** the entry is serialized
- **Then** no PII (SSN, account numbers, government IDs, full authorization headers) appears in any field. All PII is masked per PII-02.

**AC-6: Default log level is `info` in production, `debug` in development**
- **Given** the `ENVIRONMENT` setting
- **When** the logging configuration is initialized
- **Then** production environments default to `info` level (no debug output) and development environments default to `debug` level

**AC-7: Request start and completion are logged**
- **Given** any HTTP request
- **When** the request is received and when the response is sent
- **Then** at minimum, a log entry is emitted at `info` level with the HTTP method, path, response status code, and duration in milliseconds

#### Notes
- Structured logging is configured at the middleware level using Python's logging infrastructure with a JSON formatter.
- Cross-references: OBS-01 (correlation ID generation), OBS-02 (correlation ID propagation), PII-02 (PII masking in logs).

---

## Non-Functional Requirements (Cross-Cutting for Chunk 1)

### NFR-1: Authentication Latency
- API key validation (HMAC-SHA256 hash computation + database lookup) must add minimal overhead to request processing. Target: under 10ms per request for the auth middleware.

### NFR-2: Audit Event Write Performance
- Audit event inserts (including advisory lock acquisition, hash computation, and INSERT) must not noticeably delay API responses. The advisory lock is held only for the INSERT duration.

### NFR-3: Structured Log Throughput
- The structured JSON logging middleware must not become a bottleneck under normal load. Log serialization must complete within microseconds per entry.

### NFR-4: Checkpoint Storage
- Checkpoint data per workflow execution must be bounded. The 30-day cleanup (CHECKPOINT-03) ensures storage does not grow unbounded.

### NFR-5: Encryption Performance
- Fernet encryption/decryption of PII fields must not noticeably delay API responses. Target: under 1ms per field operation.

---

## Open Questions

1. **Audit event hash chain for system-level events:** The architecture specifies hash chaining per application. System-level audit events (e.g., auth failures not tied to an application) need a defined hash chain strategy. The current specification in AUDIT-03 AC-8 proposes using a null sentinel for these events, but this means system events are not chain-linked to each other. Is a separate system-level hash chain needed, or are system events independently verifiable?

2. **Self-revocation prevention:** AUTH-03 AC-5 adds a safeguard preventing a reviewer from revoking their own key. This is not explicitly stated in the product plan or architecture but prevents accidental lockout. Confirm this is desired behavior.

---

## Assumptions

1. **HMAC-SHA256 for API key hashing** is confirmed by the architecture (ADR-002). No bcrypt or argon2 for API keys.
2. **Fernet encryption** for PII fields is confirmed by the architecture.
3. **PostgresSaver** for LangGraph checkpointing is confirmed by the architecture (ADR-001).
4. **Advisory lock** for audit hash chain concurrency is confirmed by the architecture.
5. **`SET ROLE audit_writer`** connection strategy is confirmed by the architecture.
6. **24-hour seed key TTL** is confirmed by both the product plan and architecture.
7. **12 test applications** in seed data is the agreed default from the open question resolution.
8. **Rate limits** (60/20/120 req/min) apply to public and protected tiers respectively but are primarily relevant to Chunks 2+ where those endpoints are built. The middleware infrastructure is established in Chunk 1.
