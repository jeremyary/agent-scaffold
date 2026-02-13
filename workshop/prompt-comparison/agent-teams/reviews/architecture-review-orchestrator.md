<!-- This project was developed with assistance from AI tools. -->

# Architecture Review -- Orchestrator

**Reviewer:** Orchestrator (Main Session)
**Artifact:** plans/architecture.md
**Date:** 2026-02-12

## Verdict: APPROVE

The architecture document is comprehensive, well-structured, and stays within its scope boundaries. All three specialist reviewers issued APPROVE verdicts. The one critical finding (bcrypt per-request latency) is independently confirmed by both the Backend Developer and Security Engineer and has a straightforward resolution. No architecture-level blockers exist. The findings below focus on cross-cutting concerns that fall between specialist scopes.

## Focus Areas

This review asks: "What would I miss if I only read the specialist reviews?" It covers cross-cutting coherence, scope discipline, assumption gaps, downstream feasibility, and review coverage gaps.

## Findings

### Critical

None. The only critical finding across all reviews (B-C1 / S-W1: bcrypt per-request) is well-covered by both the Backend Developer and Security Engineer. Both reviewers agree on the diagnosis (bcrypt is correct for security but suboptimal for high-entropy API keys) and converge on similar solutions (fast hash for lookup, or cached AuthContext). This is the highest-priority item to resolve before Technical Design but does not require an architecture revision -- it can be resolved as a binding constraint in the TD.

### Warning

**O-W1: Two-way convergence on audit hash chain concurrency is an architecture-level gap.**

The Backend Developer (B-W3) flagged that hash chaining has concurrency issues during parallel agent fan-out. The Security Engineer (S-W4) flagged that hash chain validation is write-time only with no runtime verification specified. Together, these findings expose a design gap: the hash chain is specified at the write mechanism level but not at the operational level (how it handles concurrency, when it's verified).

This matters more than either individual finding suggests because the parallel fan-out is a core architectural pattern (three agents writing audit events near-simultaneously for the same application), not an edge case. The hash chain concurrency strategy directly affects whether the tamper detection guarantee holds during normal operation.

**Recommendation:** The architecture should specify the concurrency strategy (advisory lock, async chain linking, or relaxed same-parent linking) rather than deferring to Technical Design, because the choice affects the audit trail's integrity guarantees -- which is an architecture-level concern. The validation trigger (export-time, periodic background job, or both) can be deferred to TD.

---

**O-W2: Graph invocation pattern should be committed at the architecture level.**

The Backend Developer (B-W1) correctly flags that Open Question #2 (sync vs async graph invocation) should not be deferred. The architecture already implies async in the data flow ("Enqueue LangGraph workflow invocation", line 522) and describes polling infrastructure for status updates. However, the Open Questions section contradicts this by listing it as unresolved.

This is a cross-cutting concern because it affects: (a) the API response model for application submission (202 Accepted vs blocking), (b) the error handling pattern (polling for errors vs synchronous error response), (c) the retry endpoint semantics (re-invoke background task vs re-call blocking function), and (d) Phase 1 implementation (the orchestration skeleton must know which pattern to use).

**Recommendation:** Remove Open Question #2 and commit to async background task invocation. The architecture already describes this pattern everywhere except the Open Questions section. This is a consistency fix, not a new decision.

### Suggestion

**O-S1: The `confidence_thresholds` and `threshold_change_log` tables are referenced but not defined.**

The Backend Developer (B-S4) flagged that `confidence_thresholds` lacks a column definition. Additionally, `threshold_change_log` appears in the Phase 5 migration list (line 1072) but is not described anywhere in the schema section. Since threshold configuration drives the critical routing logic (auto-approve vs escalate vs fraud-flag), and threshold changes are security-sensitive operations (restricted to the `reviewer` role), the schema should at least be sketched at the architecture level.

This is a cross-cutting gap because it touches: the aggregator node (reads thresholds), the admin API (writes thresholds), the audit trail (threshold changes should be audited), and the security model (only `reviewer` can modify).

**Recommendation:** Add a brief column definition for `confidence_thresholds` (id, threshold_type, min_value, max_value, updated_by, updated_at) and confirm that threshold changes are captured in `audit_events` (event_type: `threshold_change`). The `threshold_change_log` table may be unnecessary if `audit_events` already captures threshold changes -- clarify whether it's a separate table or a filtered view of audit events.

---

**O-S2: Specify the intake chat session lifecycle more explicitly.**

The architecture mentions chat session tokens in Redis with 24-hour TTL (line 780) and that sessions are "short-lived by default" (line 330). However, the session lifecycle is only partially described:
- How is a session created? (POST /v1/chat/sessions -- implied but not in the data flow)
- What happens when the TTL expires mid-conversation? (Silent failure? Error message? Auto-renew?)
- Does the 24-hour TTL reset on activity or is it absolute from creation?

This is relevant for the API Designer (session management endpoints), the Backend Developer (Redis key management), and the Security Engineer (session fixation risk). No single reviewer flagged it because it sits at the intersection of their scopes.

**Recommendation:** Add a brief note in the Intake Graph section: sessions are created on first message (or explicitly via POST), TTL is absolute from creation (not activity-based), expired sessions return a clear error prompting the client to start a new session. This is enough for Technical Design to work with.

### Positive

**O-P1: All Phase 2 product plan review findings are resolved -- confirmed by all reviewers.**

The Security Engineer traces all 13 of their Phase 2 findings to specific architecture sections and confirms resolution. The API Designer traces all 9 of their Phase 2 findings and confirms resolution. The Backend Developer confirms alignment with both advisory memos. The three-way convergence on auth token resolution (ADR-002) from Phase 2 is now unanimously confirmed as addressed. This is a clean handoff from product plan review to architecture.

---

**O-P2: Scope discipline is excellent -- the architecture stays in its lane.**

The Security Engineer's scope check (lines 279-284) explicitly confirms: no product scope changes, no detailed API contracts, no implementation details. The architecture defines boundaries and patterns (its job) and defers endpoint-level contracts to the API Designer/Tech Lead (their job). The Open Questions section (lines 1150-1167) appropriately identifies seven items for Technical Design resolution rather than making premature decisions. The only scope concern is the code examples (lines 600-611, 869-885) which show Python snippets -- these are illustrative rather than prescriptive, which is acceptable.

---

**O-P3: The phased implementation mapping resolves all Phase 2 review phasing concerns.**

The Phase 2 reviews identified three critical phasing issues: audit trail too late (Architect C-2), human review too late (Architect C-1), and workflow persistence too late (Orchestrator O-C1). The architecture resolves all three with ADRs 001, 003, and 005, and the phased implementation section (lines 971-1073) maps components to phases consistently with these decisions. The Phase 3a/3b split (resolving Phase 3 overload) is also reflected in the migration strategy. The "Issues Found in Upstream Artifacts" section (lines 1130-1147) provides explicit traceability for each resolution.

---

**O-P4: The architecture document is self-consistent -- no internal contradictions detected (with one exception).**

Cross-checking across sections: the data flow (lines 504-565) is consistent with the schema design (lines 369-500), the API endpoint groups (lines 584-594) are consistent with the auth model (lines 648-696), and the phased implementation (lines 971-1073) is consistent with the migration strategy (lines 1061-1073). The one exception is Open Question #2 contradicting the data flow's implied async pattern (flagged in O-W2 above).

## Review Coverage Gaps

The following concerns are not fully covered by any specialist reviewer:

1. **Frontend feasibility** -- No frontend reviewer assessed whether the architecture's UI expectations (dashboard, review queue, chat with SSE, calculator widget, admin panel) are feasible with the specified React 19 + TanStack + shadcn/ui stack. This is acceptable for architecture review (frontend feasibility is primarily a Technical Design concern), but the SSE client-side implementation complexity flagged by the API Designer (A-W1) is the closest any reviewer came to frontend concerns.

2. **LangFuse integration depth** -- The architecture describes LangFuse as optional with callback handlers, but no reviewer evaluated whether the described integration (trace per node, span per LLM call, tool call sub-spans) is achievable with LangFuse's current Python SDK. This is a Technical Design concern, not an architecture gap, but it's worth noting.

3. **Seed data strategy** -- Open Question #3 (seed data composition) is flagged but not evaluated. The architecture mentions "diverse test applications" and "development API keys with 24-hour TTL" but the distribution of outcomes and document variety will significantly affect the demo experience (a key success metric for the quickstart). This should be addressed in Technical Design.

These gaps are acceptable -- they will be addressed during Technical Design (gaps 1-2) and Requirements (gap 3).

## Cross-Reviewer Convergence Summary

| Topic | Reviewers | Agreement |
|-------|-----------|-----------|
| bcrypt per-request latency | Backend (B-C1), Security (S-W1) | Full convergence. Both diagnose the same problem, recommend similar solutions. |
| Hash chain concurrency | Backend (B-W3), Security (S-W4) | Complementary. Backend flags write concurrency; Security flags read validation. Together they expose a design gap. |
| SSE POST pattern documentation | API Designer (A-W1) | Sole reviewer. Valid finding, no conflicting views. |
| Review queue role filtering edges | API Designer (A-W2) | Sole reviewer. Valid finding, no conflicting views. |
| Graph invocation pattern | Backend (B-W1) | Sole reviewer. Valid finding, strongly recommend resolution. |
| Connection pool count | Backend (B-W2) | Sole reviewer. Valid finding re: audit_writer creating a third pool. |
| Retry endpoint semantics | Backend (B-W4) | Sole reviewer. Valid finding, clarification needed. |
| Fernet key rotation | Security (S-W2) | Sole reviewer. Valid finding for TD. |
| Redis rate limit fallback | Security (S-W3) | Sole reviewer. Valid finding for TD. |

No conflicting findings across reviewers. All findings are additive -- each reviewer identified concerns the others did not, which is the expected outcome of multi-perspective review.

## Summary

The architecture document is ready for Technical Design. All three specialist reviewers approve, and this orchestrator review concurs. The document resolves all Phase 2 product plan review findings, maintains excellent scope discipline, and provides a coherent foundation for downstream work.

**Items to resolve before or at the start of Technical Design (priority order):**

1. **bcrypt per-request** (B-C1 / S-W1) -- Switch to fast hash or cached AuthContext. Two-reviewer convergence, highest confidence.
2. **Graph invocation pattern** (B-W1 / O-W2) -- Commit to async. Architecture already implies it; remove the contradiction.
3. **Hash chain concurrency strategy** (B-W3 / S-W4 / O-W1) -- Specify the concurrency approach for parallel fan-out audit events.
4. **Review queue fraud/conflict visibility** (A-W2) -- Clarify which roles see fraud-flagged and conflict-escalated applications.
5. **Retry endpoint = same LangGraph thread** (B-W4) -- Confirm and specify thread_id storage.
6. **Confidence thresholds schema** (B-S4 / O-S1) -- Add column definition or explicitly defer.

Items 1-3 are the strongest findings (multi-reviewer convergence). Items 4-6 are single-reviewer findings that are valid but lower priority.
