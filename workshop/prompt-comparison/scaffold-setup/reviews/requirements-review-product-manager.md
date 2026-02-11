# Requirements Review: Product Manager

**Reviewer:** Product Manager
**Document:** `plans/requirements.md`
**Reference:** `plans/product-plan.md`
**Date:** 2026-02-10

---

## Verdict: APPROVE WITH SUGGESTIONS

The requirements document is thorough and well-structured. All 8 P0 features have user stories with testable acceptance criteria. The scope stays cleanly within Phase 1. A few gaps in persona coverage and success metric measurability are noted below, but none rise to the level of blocking downstream work.

---

## P0 Feature Coverage Matrix

| P0 Feature (Product Plan) | User Story | Status |
|---|---|---|
| Report type selection | US-001 | PASS |
| Cadence configuration | US-002 | PASS |
| Recipient management | US-003 | PASS |
| Email delivery | US-004 | PASS |
| Schedule management (view, edit) | US-005 | PASS |
| Schedule management (pause, resume) | US-006 | PASS |
| Schedule management (delete) | US-007 | PASS |
| Delivery status visibility | US-008 | PASS |
| Timezone support | US-009 | PASS |
| Authentication and authorization | US-010 | PASS |

**Result: 10/10 user stories map to P0 features. No P0 features are missing.**

---

## Findings

### Warning-01: Sam (Report Recipient) persona has no user story

**Severity:** Warning

The product plan defines three personas. Maya is the primary actor in all 10 user stories. Jordan (Account Admin) appears in US-010 authorization criteria and is correctly deferred to Phase 2 for admin-specific views. However, Sam (Report Recipient) has zero representation in the requirements, even though Phase 1 delivers email to recipients.

Sam's product plan pain points include: "Reports arrive inconsistently. Has to chase the report owner when one is missing." The requirements address Maya's visibility into failures (US-008) but nothing addresses Sam's experience. Specifically:

- US-004 AC (line 170-174) defines the email content the recipient sees, but this is written from Maya's perspective ("As a report owner, I want the system to deliver...").
- There is no acceptance criterion covering what Sam sees when a delivery fails from Sam's perspective (Sam simply does not receive the email and has no recourse within the system).

**Recommendation:** This is acceptable for Phase 1 since Sam does not interact with the scheduling UI. However, the email footer content in US-004 (line 174) is the only touchpoint Sam has -- it should be validated as sufficient for Sam's needs. Consider adding a brief note in the out-of-scope section that recipient self-service (e.g., unsubscribe, view past reports) is deferred.

---

### Warning-02: Success metric "schedule creation completion rate" is not measurable from these requirements

**Severity:** Warning

The product plan defines 5 success metrics. Four of them can be measured from the requirements as specified:

| Success Metric | Measurable? | How |
|---|---|---|
| % reports delivered automatically | Yes | Ratio of scheduled deliveries to total (ScheduleRun records) |
| On-time delivery rate | Yes | NFR Section 5: compare `next_run_at` to `started_at` |
| Schedule creation completion rate | **No** | No funnel tracking or multi-step creation state is specified |
| Report owner time saved | Partially | Requires survey; not measurable from system data |
| Delivery failure acknowledgment time | Yes | Time between run failure and owner viewing run detail |

The "80% completion rate" metric requires tracking when a user *starts* creating a schedule versus when they *complete* it. The requirements define creation as a single POST (submit or fail). There is no concept of a draft state, multi-step form persistence, or analytics event for "started creation." Without frontend instrumentation or a draft model, this metric cannot be measured.

**Recommendation:** Either (a) add a requirement for a frontend analytics event when the user opens the create-schedule form, so the funnel can be tracked, or (b) note this metric as deferred to a post-MVP analytics pass. The former is lighter weight and does not affect the API.

---

### Suggestion-01: User Flow 4 (Admin Oversight) is listed in the product plan but is Phase 3 scope

**Severity:** Suggestion

The product plan includes four user flows. Flow 4 (Admin Oversight) describes account-wide schedule management, which is a P2/Phase 3 feature. The requirements correctly defer admin dashboard features to Phase 3 (Section 7, line 673-675) and note in US-010 (line 421-422) that account-wide admin views are not in Phase 1.

This is handled correctly in the requirements. The note here is purely for traceability: the product plan's Flow 4 is intentionally not covered by Phase 1 requirements, and that is the right call. No action needed.

---

### Suggestion-02: Per-user schedule limit (25) does not appear in the product plan

**Severity:** Suggestion

The requirements introduce a per-user limit of 25 active schedules (Section 3, line 476-482). This limit does not originate from the product plan -- it was introduced by the architecture, informed by the persona context ("1-10 schedules" for Maya). The requirements correctly source this from the architecture.

This is acceptable. The product plan's persona data ("1-10 schedules") provides directional guidance, and the architecture set a concrete limit. The requirements faithfully reflect the architecture. However, the 25-schedule limit is a product-visible constraint that users will encounter, so it should be surfaced in the UI (e.g., a message when approaching the limit). The current acceptance criteria only cover the hard rejection at 26. Consider whether a warning at, say, 20 schedules would improve the user experience. This is a Phase 2 concern, not blocking.

---

### Info-01: Scope fidelity is clean

**Severity:** Info

The out-of-scope section (Section 7) correctly lists all P1 and P2 features as deferred. No P1/P2 features have crept into the acceptance criteria. The "retry on failure" (P1) is explicitly absent from US-004. "Custom cadence expressions" (P1) are absent from US-002. "Admin dashboard" (P2) is absent from US-010. This is good discipline.

One minor observation: US-010 (line 421-422) includes an acceptance criterion that explicitly says "Phase 2 feature, not implemented in Phase 1." This is a helpful pattern for preventing accidental implementation -- the Tech Lead and developers see the boundary clearly.

---

### Info-02: NFR alignment is faithful

**Severity:** Info

All 6 NFRs from the product plan are represented in Section 5 of the requirements with testable criteria:

| Product Plan NFR | Requirements NFR | Testable Criterion |
|---|---|---|
| Delivery timeliness | Delivery Timeliness | 95% within 5 minutes of scheduled time |
| Schedule creation responsiveness | UI Responsiveness | CRUD operations < 2 seconds p95 |
| Delivery reliability | Delivery Reliability | 98% success rate over 30 days |
| Failure transparency | Failure Transparency | Human-readable error messages, viewable within 1 business day |
| Scale with team growth | Scale with Team Growth | 25 schedules x 50 recipients without degradation |
| Data integrity | Data Integrity | Transactions with rollback on failure |

The product plan framed these as user-facing outcomes ("feels immediate", "arrive within a reasonable window"). The requirements translated them into testable thresholds (< 2 seconds, 5 minutes, 98%). This is appropriate for requirements -- the thresholds are still user-facing (not cache hit times or connection pool sizes). The translation is reasonable and preserves the intent.

---

### Info-03: Risk coverage

**Severity:** Info

| Product Plan Risk | Addressed By |
|---|---|
| Silent generation failure | US-008 (delivery status), US-004 (generation_failed status) |
| Stale schedule spam | US-006 (pause), US-007 (delete), admin dashboard deferred to P2 |
| Monday 9 AM delivery spike | Not directly addressed; noted as "monitor in subsequent phases" in product plan |
| Spam marking by recipients | US-004 email footer includes sender identity and contact info; no unsubscribe mechanism in Phase 1 |
| Timezone handling errors | US-009 with DST edge cases |
| Orphaned schedules | US-010 (schedules continue running); admin intervention deferred to Phase 2 |

The Monday 9 AM spike risk remains unaddressed in the requirements, which matches the product plan's mitigation ("monitor and address in subsequent phases"). The spam/deliverability risk has partial mitigation via the email footer but no unsubscribe mechanism -- this was flagged during product plan validation as a borderline deferred item and remains appropriately deferred.

---

## Summary

The requirements document is complete and well-aligned with the product plan. All P0 features are covered with testable acceptance criteria. The two warnings (Sam persona gap and creation funnel metric) are worth noting but do not block downstream work. The scope is clean -- no Phase 2/3 features have crept in, and the deferred items are explicitly documented.

**Next step:** Architect review of requirements, then hand off to Tech Lead for Technical Design Document.
