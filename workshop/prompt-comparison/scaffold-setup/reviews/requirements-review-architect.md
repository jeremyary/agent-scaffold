# Requirements Review: Architect

**Reviewer:** Architect
**Document:** `plans/requirements.md`
**Date:** 2026-02-10
**Architecture reference:** `plans/architecture.md`, ADR-0001 through ADR-0004

---

## Verdict: APPROVE WITH SUGGESTIONS

The requirements document is well-aligned with the architecture. State machines match, limits match, timezone strategy matches, and the component boundaries are respected. No architecture decisions are embedded in acceptance criteria (the document references `next_run_at`, tick task behavior, and protocol names, but only to verify behavior at architectural seams -- not to prescribe internal implementation). Two warnings and several suggestions follow.

---

## Findings

### W1 -- Warning: DST spring-forward resolution disagrees with ADR-0004

**Requirements (US-009, AC 4):**
> "the system advances the schedule to the next valid occurrence (e.g., 2:30 AM the following day or 3:30 AM if the implementation adjusts forward)"

**ADR-0004 resolution rule:**
> "Nonexistent times (spring-forward): Advance to the next valid minute. If 2:30 AM does not exist, deliver at 3:00 AM."

The requirements present two options ("next day" or "3:30 AM"); the architecture specifies advancing to the next valid minute (3:00 AM, not 3:30 AM and not the next day). These must be aligned. The architecture's rule is more precise and correct -- `zoneinfo` will fold 2:30 AM to 3:00 AM, not 3:30 AM.

**Recommendation:** Update the US-009 AC to match ADR-0004 exactly: "the system delivers at 3:00 AM (the next valid minute after the clock springs forward)." Remove the "next day" alternative.

### W2 -- Warning: Rate limit scope is narrower in requirements than in architecture

**Requirements (Section 4, Rate Limiting):**
> "Schedule creation and update operations are rate-limited to 10 requests per minute per user. Applies to: US-001, US-002, US-003, US-005."

**Architecture (Section 6.6):**
> "Schedule creation rate: API rate limit (per user), 10 creates per minute"

The architecture labels the rate limit as "10 creates per minute" scoped to creation. The requirements extend it to updates as well. This is actually a reasonable expansion, but the mismatch should be acknowledged. The requirements' broader scope is preferable from a security standpoint, so I suggest the architecture adopt the requirements' framing (or at minimum, the Tech Lead should note the broader scope during technical design).

**Recommendation:** No change needed in the requirements. Flag this for the Tech Lead: the rate limit applies to both creation and mutation endpoints, per the requirements. Architecture section 6.6 should be updated at next revision to say "schedule creation and update operations."

### S1 -- Suggestion: Per-account soft limit (500 recipients) missing from requirements

The architecture (Section 6.2) defines a per-account monitoring threshold of 500 recipients. The requirements document does not mention this limit. While the architecture describes it as a "soft" operational alert rather than a hard block, the Requirements Analyst should decide whether it surfaces as a user-facing behavior (e.g., does the user see a warning?) or remains purely an ops concern.

**Recommendation:** If it remains an ops-only metric, no requirements change needed -- the SRE Engineer handles it. If it should produce a user-visible warning, add a brief note to Section 4 (Cross-Cutting Requirements). For MVP, I lean toward ops-only.

### S2 -- Suggestion: Concurrent modification strategy underspecified

Requirements Edge Case "Concurrent Schedule Modifications" says:
> "the database uses optimistic locking or last-write-wins semantics, and the second write overwrites the first."

The architecture does not prescribe optimistic locking or last-write-wins for user-facing edits -- it prescribes `SELECT FOR UPDATE SKIP LOCKED` only for the tick task. For user edits, the architecture is silent, which means the Tech Lead decides. The requirements should not prescribe the mechanism (that is an implementation decision), but should specify the user-visible behavior: does the second editor get an error (optimistic locking) or does their write silently win?

**Recommendation:** Rewrite the AC to focus on the user-facing outcome rather than the mechanism. For example: "the last submitted change is persisted; the first editor is not notified of the overwrite." This describes last-write-wins without prescribing how. The Tech Lead can then choose the mechanism.

### S3 -- Suggestion: Clarify "generating" status in US-004

US-004 AC 2 says:
> "the system attempts to generate the report and updates the run status to `generating`."

But the architecture's state machine (Section 6.5) shows `pending -> generating` as the first transition when the execute task starts. This is consistent, but the wording "attempts to generate... and updates the run status to generating" is slightly ambiguous -- it could be read as "update to generating only after an attempt starts" or "update to generating as the task begins." For clarity:

**Recommendation:** Rephrase to: "the execute task transitions the run status from `pending` to `generating` and begins calling `ReportGenerator.generate()`." This matches the architecture's state machine ordering (transition first, then work).

### I1 -- Info: RunRecipient entity implied but not explicit in requirements

US-008 acceptance criteria describe per-recipient delivery results (AC 3-6), and US-004 AC 7-8 describe per-recipient error messages. These require the `RunRecipient` entity from the architecture (Section 8). The requirements correctly describe the user-visible behavior without naming the entity, which is appropriate. No change needed -- noting this for the Tech Lead to ensure `RunRecipient` is part of the technical design.

### I2 -- Info: Schedule limit counts only active schedules -- confirmed aligned

Requirements Edge Case "Maximum Limits Reached" AC 2 states: "only active schedules count toward the limit." The architecture (Section 6.2) says "Active schedules per user: 25." These are aligned. The implication is that paused and deleted schedules do not count. This is the correct interpretation and should be carried into the technical design's validation logic.

---

## Observations for Downstream Technical Design

1. **State machine enforcement location.** The architecture says "enforced in the task code, not in the database." The requirements define the valid transitions and expected error codes (409 for invalid schedule transitions, rejection for invalid run transitions). The Tech Lead should implement a transition function that both the API (for schedule status) and the Celery tasks (for run status) call -- a shared utility, not duplicated logic.

2. **Tick task atomicity.** US-004 AC 1 and the database failure edge case (AC 10) correctly describe the tick task's transactional behavior, matching the architecture's `SELECT FOR UPDATE SKIP LOCKED` pattern. The Tech Lead should note that the "create run + update next_run_at + commit" sequence for each schedule must be in a single transaction, per the architecture.

3. **Recipient soft delete and delivery history integrity.** US-003 AC 5 says removed recipients are `is_active=false` and excluded from future deliveries but "past delivery history for that recipient is retained." This aligns with the architecture's `RunRecipient` entity, which stores `recipient_email` (the email at delivery time), not a foreign key to the `recipients` table. The Tech Lead should ensure `RunRecipient.recipient_email` is a snapshot, not a join.

4. **NFR feasibility check.** The three testable NFR criteria are achievable with the architecture:
   - **95% within 5 minutes:** The tick polls every 60 seconds. Worst-case scheduling latency is ~60 seconds. Report generation (stub in MVP) is near-instant. Email delivery via SMTP is typically under 30 seconds. Total worst-case is well under 5 minutes. Feasible.
   - **2s p95 API latency:** All schedule CRUD is simple database reads/writes with no fan-out. Feasible for MVP load.
   - **98% delivery success:** Depends on email infrastructure reliability, not the application architecture. The architecture's per-recipient tracking makes this measurable. The application can achieve this if the SMTP provider is reliable. Feasible as a measurement target.

5. **Authorization model.** US-010 defines owner + admin. The architecture confirms this. Note that admin access for Phase 1 is limited to per-schedule operations (same endpoints, role check in the dependency). Account-wide views are Phase 2. The Tech Lead should implement the admin check as a FastAPI dependency that can be reused across route handlers.

---

**End of Review**
