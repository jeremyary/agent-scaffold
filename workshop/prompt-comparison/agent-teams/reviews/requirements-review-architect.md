<!-- This project was developed with assistance from AI tools. -->

# Requirements Review: Architect

**Artifact reviewed:** plans/requirements.md + chunk files 1-4
**Reviewed against:** plans/architecture.md
**Reviewer:** Architect
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

## Summary

The requirements document is comprehensive (95 stories, 454 acceptance criteria) and demonstrates strong alignment with the architecture across component boundaries, data flow, security mechanisms, and phasing. The four Architecture Consistency Notes at the bottom of the master document are all correctly identified and well-reasoned. However, there are two critical misalignments -- a phase conflict on PIPE-04 (Risk Assessment) and a phase conflict on several admin/deployment stories -- plus several warnings on data model and API details that should be resolved before Technical Design begins.

## Findings

### Critical

**C-1: PIPE-04 Risk Assessment is assigned to Phase 3a, contradicting architecture Phase 2 parallel fan-out design.**

PIPE-04 (Risk Assessment) is listed as Phase 3a in the Story Map (requirements.md line 76) and in the story itself (chunk-2 line 635: "Priority: P0 | Phase: 3a"). However, the architecture document (architecture.md line 1026-1036) places risk assessment in Phase 2 alongside the credit analyst, with both running in the parallel fan-out. The architecture explicitly states in Phase 2: "Confidence-based routing logic in the aggregator node" and "Minimal human review: review queue API (role-filtered), review action endpoint."

If risk assessment is deferred to Phase 3a, then the Phase 2 parallel fan-out (PIPE-10) has only the document processor and credit analyst, which means the aggregator (PIPE-06) must route based on a single analysis agent's confidence. This is technically feasible (PIPE-06 AC-6 handles partial results), but it significantly degrades the routing quality. More importantly, PIPE-10 AC-1 specifies "fans out to run the following agents concurrently: credit analyst, risk assessor, and compliance checker" -- this contradicts the Phase 3a assignment.

The architecture's Phase 2 description on line 1027 lists "Credit analyst agent (Claude + mocked credit bureau)" but not the risk assessor. So there is actually an inconsistency within the architecture itself about whether risk assessment is Phase 2 or Phase 3a. The requirements chose Phase 3a, but the graph structure diagram (architecture.md lines 199-203) shows credit, risk, and compliance as parallel, without phase annotation.

**Resolution needed:** Confirm whether PIPE-04 is Phase 2 (matching the parallel fan-out intent) or Phase 3a (matching the literal Phase 2 components list in the architecture). If Phase 3a, PIPE-10 AC-1 needs amendment to state that the fan-out is progressively expanded (Phase 2: credit only; Phase 3a: credit + risk + compliance). If Phase 2, update the story map and PIPE-04's phase.

**C-2: Phase assignments for THRESHOLD, KB, DEPLOY, and COMPLIANCE stories conflict between requirements master and chunk details.**

The Story Map in requirements.md assigns THRESHOLD-01/02/03 to Phase 3a, KB-01/02/03 to Phase 3a, and COMPLIANCE-01 to Phase 3a. But in chunk-4 (the actual story details), THRESHOLD-01 is listed as "P2 | Phase: 5" (line 339), THRESHOLD-02 as "P2 | Phase: 5" (line 379), KB-01 as "P2 | Phase: 5" (line 444), and KB-02 as "P2 | Phase: 5" (line 482). The master story map says Phase 3a for all of these.

This creates a direct contradiction: the story map index promises Phase 3a delivery, but the detailed stories in chunk-4 specify Phase 5 delivery and P2 priority. Since the architecture places the RAG schema, knowledge base seeding, and configurable thresholds in Phase 3a (architecture.md lines 1039-1049), the master story map's Phase 3a assignment appears correct for the core versions of these features. The chunk-4 assignments to Phase 5 would leave Phase 3a without the infrastructure that PIPE-05 (Compliance Checker) and PIPE-06 (threshold-based routing) depend on.

Similarly, DEPLOY-01 and DEPLOY-03 are listed as Phase 1 / P0 in the master story map (lines 220, 222), but DEPLOY-01 in chunk-4 says "P2 | Phase: 5" (line 799) and DEPLOY-03 says "P2 | Phase: 5" (line 870). The architecture places health endpoints in Phase 1 (line 1018: "Health endpoints (`/health`, `/ready`)").

**Resolution needed:** Reconcile the priority and phase assignments between the master story map and the chunk-4 detailed stories. The master story map should be the source of truth; the chunk-4 stories should be updated to match.

### Warning

**W-1: DOC-01 phase assignment conflicts with architecture.**

DOC-01 (Upload Documents) is listed as "P0 | Phase: 2" in the chunk-2 story (line 322). However, the architecture's Phase 1 data flow (architecture.md lines 1006-1017) and the master story map both place DOC-01 in Phase 1 (requirements.md line 63). Documents must be uploadable in Phase 1 for the application lifecycle to be testable (APP-04 AC-1 requires at least one uploaded document for submission). The chunk-2 story header should say Phase 1 to match the master story map.

**W-2: APP-06 withdrawal from `processing` status -- requirements and architecture diverge.**

APP-06 AC-4 blocks withdrawal from `processing` status (returns 409). This is architecturally sound -- you cannot withdraw while a LangGraph workflow is in-flight. However, the state machine in the master document (requirements.md lines 292-293) does not list `processing -> withdrawn` as a valid transition, and neither does APP-05 AC-1. The divergence is consistent (both block it), but the architecture's data flow section is silent on this edge case. The rationale in APP-06 AC-4 notes ("the user should wait for processing to complete or fail") is well-reasoned.

No change needed, but the Technical Design should confirm whether an in-flight LangGraph workflow can be cancelled or whether the only path out of `processing` is completion, escalation, or error.

**W-3: `review_actions` table phasing inconsistency.**

The architecture's migration strategy (line 1099) places `review_actions` in Phase 4. However, the requirements specify REV-03/REV-04 (approve/deny actions) in Phase 2, which insert into `review_actions`. The architecture document itself, in Phase 2 description (line 1030), mentions "Minimal human review: review queue API (role-filtered), review action endpoint," which implies `review_actions` must exist in Phase 2.

**Resolution needed:** Update the migration strategy table (architecture.md line 1099) to move `review_actions` from Phase 4 to Phase 2, or confirm that the review action data is stored differently in Phase 2.

**W-4: `fraud_flags` table referenced in PIPE-11 but not in the core entity schema.**

The `fraud_flags` table is referenced in PIPE-11 AC-7 (chunk-4 line 55: "each flag is persisted to the `fraud_flags` table") and in the architecture's Phase 4 migration (line 1072: "`fraud_flags` table"). However, the architecture's core entity schema section (lines 384-517) does not define the `fraud_flags` table structure. The Technical Design will need to define this table. This is a gap in the architecture, not in the requirements, but it affects whether the requirements can be implemented as specified.

**W-5: `awaiting_documents` status present in requirements but absent from Phase 2 status transition list.**

APP-05 AC-1 lists the valid transitions for Phase 2 and explicitly notes that `awaiting_review -> awaiting_documents` is a Phase 4 addition (line 209). The requirements master document's state machine (line 302-303) also correctly defers this. However, DX-02 AC-1 (seed data) does not include any applications in `awaiting_documents` status. Since this status is Phase 4, that is correct -- but the seed data should be extended in Phase 4 to include this status for developer exploration. This is a suggestion, not a hard requirement.

**W-6: AUDIT-04 (Query Audit Events) referenced in story map but not fully specified.**

The master story map (requirements.md line 153-154) lists AUDIT-04 as "Query Audit Events for an Application" with a note "(index entry -- sub-resource of APP-03)." This story is not expanded into a chunk document with its own acceptance criteria. While audit event querying via the application detail sub-resource `/v1/applications/:id/audit-events` is architecturally defined (architecture.md line 603), there is no detailed specification for this endpoint's pagination, filtering, or response shape. The Technical Design will need to fill this gap.

**W-7: Rate limit values inconsistent between master document and chunk-3.**

The master document's Assumptions section (line 441) states "Rate limits (60/20/120 req/min) apply to public and protected tiers." Chunk-3 specifies 20 req/min for CHAT and 60 req/min for CALC/MARKET (chunk-3, lines 10-11). The 120 req/min for the protected tier does not appear in any chunk's acceptance criteria. AUTH-08 (Rate Limiting) in chunk-1 also lacks detailed rate limit acceptance criteria -- it is listed in the story map but no AUTH-08 story exists in chunk-1 with that title.

Wait -- AUTH-08 in the story map says "Rate Limiting" at P1/Phase 1, but in chunk-1 it is "API Key Expiration" (line 314). This is a story ID collision: AUTH-08 covers expiration, not rate limiting. The rate limiting story appears to be missing from chunk-1.

**Resolution needed:** Either add a dedicated AUTH-08 "Rate Limiting" story with acceptance criteria covering the protected tier rate limits, or rename the story map entry to match the chunk-1 content ("API Key Expiration") and add a separate rate limiting story.

### Suggestion

**S-1: Clarify the `correlation_id` storage strategy in `audit_events`.**

AUDIT-01 AC-1 (chunk-1, line 381) references "metadata.correlation_id or top-level correlation_id field." The architecture's `audit_events` schema (architecture.md lines 434-450) does not include a dedicated `correlation_id` column -- it only has a `metadata: JSONB` field where correlation_id could be stored. The requirements should settle on one approach (top-level column vs. JSONB field) rather than leaving it ambiguous with "or." A dedicated column is more queryable; JSONB is more flexible. The Technical Design can decide, but the requirements should not suggest both.

**S-2: Define the `escalation_reason` storage mechanism.**

REV-01 AC-1 references `escalation_reason` as a field in the review queue response (chunk-2, line 974). The architecture does not define a dedicated column for escalation reason on `loan_applications`. The routing decision is stored in the LangGraph state and in the audit event (PIPE-06 AC-3 records the routing outcome). For the review queue to filter by escalation reason, the reason needs to be either: (a) stored as a column on `loan_applications`, (b) denormalized from the audit trail, or (c) derived from the LangGraph checkpoint. The Technical Design should resolve this, but the requirements should note the dependency.

**S-3: Consider documenting the minimum document count for submission.**

APP-04 AC-1 requires "at least one document has been uploaded." Open Question #4 in chunk-2 asks about maximum document count but not minimum. The architecture does not specify a minimum. Consider whether a single document (e.g., one pay stub) is truly sufficient for a meaningful pipeline run, or whether the minimum should be higher for different submission contexts. This is a product decision, not architecture, so flagging for awareness.

**S-4: PIPE-05 AC-1 wording should be updated to reflect parallel execution reality.**

PIPE-05 AC-1 (chunk-2, line 683) says the compliance checker "receives all agent results from graph state." Architecture Consistency Note #4 in the master document correctly identifies that if the compliance checker runs in parallel with credit and risk, it cannot have those results. The requirements Assumption #13 (line 448) and Consistency Note #4 (line 391) both correctly note this issue. The AC-1 wording should be updated to say "receives document extraction results and application record data from graph state" to match the architecture's parallel execution model and the requirements' own Assumption #13.

### Positive

**P-1: Exemplary alignment between architecture ADRs and requirements stories.**

The requirements systematically trace back to the six architecture ADRs:
- ADR-001 (Persistent Checkpointing) maps to CHECKPOINT-01/02/03 with detailed acceptance criteria covering resume, parallel agent preservation, and cleanup.
- ADR-002 (Server-Side Role Resolution) maps to AUTH-06 with five acceptance criteria covering privilege escalation prevention, HMAC-SHA256, and mismatch logging.
- ADR-003 (Audit Trail from Phase 1) maps to AUDIT-01/02/03 with comprehensive acceptance criteria including hash chaining, advisory locks, and the `SET ROLE` strategy.
- ADR-005 (Minimal Review Phase 2) maps to REV-01 through REV-04, correctly scoping Phase 2 to approve/deny only.
- ADR-006 (Intake Sandboxing) maps to CHAT-07 with explicit tool allowlist and isolation boundaries.
This traceability is exactly what downstream agents need for implementation.

**P-2: Architecture Consistency Notes are accurate and well-reasoned.**

All four Architecture Consistency Notes in the master document are valid observations:
1. **Review queue sorting** -- correctly identifies the `updated_at` column as the escalation timestamp proxy and flags the risk of overwrite. This is a real concern for Technical Design.
2. **Document upload status constraint** -- correctly notes the Phase 4 extension from `draft` to `awaiting_documents`. Consistent with architecture.
3. **Fraud flag routing in Phase 2** -- correctly identifies that routing rule #1 should exist before the fraud detector agent, since it is simple conditional logic. The seed data approach for testing is sound.
4. **Compliance checker parallel timing** -- this is the most architecturally significant observation. The resolution (compliance checker uses document extraction and application data, not credit/risk outputs) is consistent with the architecture's parallel graph structure. This matches the requirements' own Assumption #13.

**P-3: Financial precision convention is consistently applied.**

The financial precision convention (integer cents in DB, string decimals in API responses, `Decimal` types for computation) is stated once in the master document and consistently referenced across all four chunks. Every calculator story (CALC-01 through CALC-08) explicitly calls out `Decimal` types and string decimal serialization. The risk assessment story (PIPE-04 AC-2) correctly specifies `dtiRatio` and `ltvRatio` as string decimals. The architecture's financial value serialization convention (architecture.md lines 647-648) matches exactly.

**P-4: Security requirements faithfully implement the architecture's security model.**

The security-related requirements demonstrate point-by-point alignment with the architecture:
- HMAC-SHA256 for API key hashing (AUTH-06 AC-5) matches architecture's Authentication section.
- Fernet encryption with key version prefix (PII-01 AC-6, PII-04) matches architecture's encryption key ring design.
- PII redaction before LLM calls (PII-03, PIPE-08) is mandatory for all agent nodes, matching the architecture's "required dependency for all agent nodes."
- Intake agent sandboxing (CHAT-07) correctly mirrors the architecture's CAN/CANNOT access lists.
- Production credential hard-fail (AUTH-07) covers all the vectors the architecture specifies (seed keys, MinIO defaults, database defaults).
- Audit immutability triple layer (AUDIT-03) -- INSERT-only role, trigger guard, hash chain -- matches the architecture exactly.

**P-5: Open questions are appropriately scoped to Technical Design, not architecture.**

The merged open questions (12 items) are well-curated. None of them are actually architecture decisions in disguise -- they are all implementation-level details (fraud sensitivity defaults, CI platform, escalation timestamp column, cache invalidation strategy) that correctly belong in Technical Design. This demonstrates good scope discipline between requirements and architecture phases.
