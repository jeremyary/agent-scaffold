# ADR-0006: Audit Trail Architecture

## Status
Proposed

## Context

The product plan (F15) requires a comprehensive, append-only, tamper-evident audit trail that captures every AI action with decision traceability, override tracking, and data provenance. The audit trail serves two audiences:

1. **Compliance users** (CEO, Underwriter) access it through an in-app UI with three query patterns: application-centric, decision-centric, and pattern-centric.
2. **Developers/operators** access agent-level observability through LangFuse.

These are complementary -- LangFuse shows agent execution traces (developer-facing), while the audit trail shows compliance-relevant events (business-facing). They share a session ID for correlation.

The key architectural requirements are:
- Append-only: no UPDATE or DELETE of audit events.
- Tamper-evident: modifications should be detectable.
- Decision traceability: from a decision, trace backward to all contributing factors.
- Override tracking: when a human diverges from AI recommendation, record both.
- Data provenance: when AI cites a data point, record its source document.
- Export capability: audit data can be exported for external analysis.

## Options Considered

### Option 1: Application-Level Append-Only (Soft Enforcement)
Write audit events as INSERT-only in application code. No database-level enforcement. Application code simply never issues UPDATE or DELETE on audit tables.

- **Pros:** Simplest implementation. No special database configuration.
- **Cons:** Not actually tamper-evident -- any code bug, admin query, or SQL injection could modify audit records. Does not satisfy the "append-only with integrity guarantees" requirement. "Trust the code" is not sufficient for a compliance-focused demo.

### Option 2: Database-Level Enforcement (Role Grants + Triggers)
The application database role has INSERT and SELECT grants only on audit tables (no UPDATE, DELETE). A database trigger rejects any UPDATE or DELETE attempt. A hash chain provides tamper evidence.

- **Pros:** Enforcement at the database level -- application bugs cannot modify audit records. Triggers catch even direct SQL attempts. Hash chain detects out-of-band modifications. Demonstrable: "The database role literally cannot update or delete audit records."
- **Cons:** Database-level enforcement adds migration complexity. Hash chain adds a sequential dependency on insert. Trigger overhead on every operation (negligible for INSERT-only workload).

### Option 3: Dedicated Audit Database or Ledger
Use a separate database, event store, or blockchain-like ledger for audit events.

- **Pros:** Strongest isolation. Purpose-built for immutability.
- **Cons:** Adds a database to the stack (violates the single-database decision in ADR-0002). Overkill for PoC. Increases operational complexity and setup time.

### Option 4: Event Sourcing Pattern
Use event sourcing for the entire application domain, where the audit trail is a natural byproduct.

- **Pros:** Audit trail is inherent in the architecture. Full history of state changes.
- **Cons:** Requires rearchitecting all domain services. Event sourcing is a significant architectural commitment -- inappropriate for a PoC that needs to be built quickly. The audit trail is the only domain that benefits from append-only semantics.

## Decision

**Option 2: Database-Level Enforcement** with the following specific mechanisms:

### Append-Only Enforcement

1. **Database role separation:** The application connects to PostgreSQL with a role (`summit_cap_app`) that has `INSERT` and `SELECT` grants on audit tables. `UPDATE` and `DELETE` are not granted. Even if application code attempts to issue UPDATE or DELETE, the database rejects it.

2. **Trigger-based rejection:** A `BEFORE UPDATE OR DELETE` trigger on `audit_events` raises an exception and logs the attempt to a separate `audit_violations` table. This catches attempts through any connection, not just the application role.

3. **Sequential IDs:** `audit_events.id` is `bigserial` -- automatically incrementing, gap-free within a transaction. Provides ordering guarantees.

4. **Concurrency strategy:** A PostgreSQL advisory lock is acquired around each audit insert to ensure serial hash chain computation. This prevents concurrent inserts from forking the hash chain (which would cause false tamper detections). At PoC scale, advisory lock contention is negligible.

### Tamper Evidence

A lightweight hash chain: each audit event includes a `prev_hash` field that is the SHA-256 hash of the previous event's `id` concatenated with its `event_data`. A verification query can walk the chain and detect broken links.

This is not cryptographically rigorous (a sophisticated attacker could recompute the chain after modification). At PoC maturity, this detects naive tampering. The hash chain is a PoC-specific mechanism that would be **replaced** for production -- a production system would use a fundamentally different tamper-evidence approach (e.g., database-level cryptographic verification or an external ledger), not an incremental upgrade of the hash chain.

### Decision Traceability

Audit events carry `application_id` and `decision_id` as nullable foreign keys. Decision traceability works by:

1. When a decision event is written (approval, denial, conditional approval, suspension), it receives a `decision_id`.
2. All events related to the same application (data access, tool calls, AI recommendations, compliance checks) carry the same `application_id`.
3. "Trace backward from a decision" = query all events with the same `application_id`, ordered by timestamp, filtered to events before the decision.

### Override Tracking

When a human makes a decision that differs from the AI recommendation:
1. The AI recommendation is logged as an event (`event_type: 'ai_recommendation'`) with the recommended outcome and rationale.
2. The human decision is logged as a separate event (`event_type: 'decision'`) with the actual outcome and the human's stated reason.
3. A third event (`event_type: 'override'`) explicitly links the recommendation and decision events, flagging the divergence.

### Export Capability

Audit data export is a read-only operation that queries audit events by time range, application, or decision, and outputs JSON or CSV. The export endpoint is available only to the CEO and Underwriter roles.

## Consequences

### Positive
- Database-level enforcement provides a stronger guarantee than application-level -- demonstrable and verifiable.
- Hash chain provides tamper evidence that is visible and explainable during a demo.
- Decision traceability through `application_id` and `decision_id` supports all three query patterns.
- Override tracking makes AI-human divergence a first-class concern.

### Negative
- Database role separation requires multiple PostgreSQL roles, adding to migration and setup complexity.
- Hash chain creates a sequential insert dependency enforced by PostgreSQL advisory locks. At PoC scale (small number of concurrent users), this is not a bottleneck.
- Hash chain verification is not real-time -- it is a batch validation that runs on demand. Tampering between validations is possible but detectable.

### Neutral
- LangFuse captures the developer-facing observability (agent traces, token counts, latency). The audit trail captures the compliance-facing events (decisions, data access, overrides). They share a `session_id` for correlation but are separate systems with different retention and access policies.
- PII masking in audit responses (for CEO role) is handled by the API layer, not the audit service -- the audit trail stores full data, and masking is applied at read time.
