# Product Plan Review: Report Scheduling

**Reviewer:** Architect
**Date:** 2026-02-10
**Document reviewed:** `plans/product-plan.md`

## Verdict

**APPROVE WITH SUGGESTIONS**

The product plan is well-structured and stays cleanly within its scope. It defines capabilities without prescribing solutions, uses MoSCoW prioritization correctly, and frames NFRs as user-facing outcomes. The plan provides a solid foundation for architecture design. The suggestions below would strengthen it but are not blockers.

## Checklist Results

| Check | Result | Notes |
|-------|--------|-------|
| No technology names in feature descriptions | PASS | Feature descriptions use capability language throughout. Technology constraints are correctly isolated in the "Stakeholder-Mandated Constraints" section and explicitly labeled as Architect inputs. |
| MoSCoW prioritization used | PASS | Features are cleanly classified as Must Have (P0), Should Have (P1), Could Have (P2), and Won't Have. No dependency maps or epic numbering. |
| No epic or story breakout | PASS | Features are described at the capability level. No work items, agent assignments, entry/exit criteria, or dependency graphs. |
| NFRs are user-facing | PASS | All NFRs are framed as user outcomes: "feels immediate", "should not notice a delay", "clearly communicated". No implementation targets (no latency numbers, no cache hit rates). |
| User flows present | PASS | Four user flows cover the key persona journeys: schedule creation, schedule management, failure investigation, and admin oversight. |
| Phasing describes capability milestones | PASS | Each phase opens with a "Capability milestone" paragraph describing what the system can do, not which tasks are included. |

## Findings

### Warning

**W1: "Email delivery" feature conflates generation and delivery.** The P0 feature "Email delivery" is described as "Scheduled reports are generated and delivered to recipients via email at the configured cadence." This bundles two distinct capabilities -- report generation (triggering the report engine) and delivery (sending the output via email). These have different failure modes, different scaling characteristics, and different retry semantics. The architecture will need to treat them as separate concerns regardless, but the product plan would be clearer if it acknowledged the distinction. This affects how delivery status (also P0) is presented to users -- did the report fail to generate, or did it generate but fail to send?

**Recommendation:** Consider splitting this into two feature descriptions: one for automated report generation on schedule, and one for email delivery of the generated output. This makes the failure transparency NFR more concrete.

### Suggestion

**S1: Open question 3 (orphaned schedules) should be resolved before Phase 1.** The plan flags "What happens to a schedule when its owner leaves?" as an open question, and the risk table notes admin oversight is deferred to P2. However, Phase 1 includes authentication and authorization as P0. The authorization model needs to know whether schedules can outlive their owners. If the answer is "schedules auto-disable when the owner is deactivated," that is a Phase 1 concern with data model implications. If the answer is "schedules keep running and only admins can touch them in Phase 2," the authorization model is simpler but the operational risk is higher.

**Recommendation:** Resolve this before architecture design begins. The answer directly affects the schedule ownership model, the authorization rules, and whether we need an "orphaned" state in Phase 1.

**S2: Recipient limits (open question 5) have architectural implications.** Whether a schedule can have 5 recipients or 500 recipients changes the delivery model significantly. High recipient counts push toward batch delivery or fan-out patterns; low counts can use simple iteration. The product plan should set an upper-bound expectation -- even a rough one like "tens, not hundreds" -- so the architecture can be right-sized.

**Recommendation:** Add a brief constraint or expectation for recipient scale. This does not need to be a precise number, just an order of magnitude.

### Info

**I1: The "Retry on failure" feature (P1) will need a product-level decision on retry visibility.** When the system retries a failed delivery, should the user see the intermediate failures in delivery history, or only the final outcome? This is a UX question that affects how the delivery history data is modeled. Not blocking for Phase 1 (retries are P1), but worth noting for the Product Manager to consider before Phase 2 design.

**I2: Flow 4 (Admin Oversight) includes schedule reassignment, which is a P2 feature.** The user flow describes the admin reassigning a schedule to a new owner, but the admin dashboard is listed as Could Have (P2). This is fine -- user flows describe the complete vision, not just Phase 1 -- but the architecture should not plan for reassignment in Phase 1.

## Architecture-Relevant Observations

These are not product plan issues. They are notes for the architecture phase that this review surfaced.

1. **Generation vs. delivery separation.** As noted in W1, the architecture should model report generation and email delivery as distinct steps with independent status tracking. This enables retries at the right granularity and supports adding new delivery channels later (in-app notifications in P1, and hypothetically Slack/Teams if Won't Have changes in a future phase).

2. **Scheduling engine is the critical path.** The system must evaluate "which schedules are due now?" reliably and on time. This is the component where availability and correctness matter most. Missed or duplicate executions are the highest-impact failure mode for user trust.

3. **Timezone handling is a cross-cutting concern.** Timezone support is P0. The architecture needs to decide where timezone resolution happens (at schedule evaluation time vs. stored as UTC with display offset) and ensure consistency across the schedule creation UI, the scheduling engine, and the delivery history display.

4. **Authorization model scope.** Phase 1 authorization is straightforward (owner + admin), but Phase 2 introduces schedule reassignment and Phase 3 adds bulk admin operations. The authorization model should be designed with extensibility in mind even if Phase 1 only implements the simple case.

5. **Report generation as an external dependency.** The plan correctly states "assumes report types already exist in the system" (Won't Have). The architecture needs to define a clean boundary between the scheduling feature and the existing report generation system. This is the primary integration point and the one most likely to cause Phase 1 delivery issues.
