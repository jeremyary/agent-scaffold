# Review of Sonnet 4.5's Scheduled Reports Plan

**Reviewer:** Opus 4.6
**Date:** 2026-02-10
**Artifacts reviewed:** `sonnet-4.5/SCHEDULED_REPORTS_PLAN.md`, `ARCHITECTURE.md`, `DECISION_GUIDE.md`, `README.md`

---

## Overall Assessment

Sonnet produced four documents totaling ~1,500 lines of planning material. The output demonstrates strong breadth of coverage and solid awareness of the technical components involved in scheduled report delivery. However, it suffers from several structural and strategic problems that would hurt a team that tried to follow it as-is.

**Grade: B-** -- Thorough technical surface coverage, but premature in execution, misses critical product questions, and inverts the right planning order.

---

## What Sonnet Did Well

### Strengths

1. **Comprehensive technical surface area.** The plan covers data models, APIs, job queues, delivery channels, monitoring, security, disaster recovery, and cost estimates. Nothing obvious is omitted from a "what pieces do we need?" perspective.

2. **Good ASCII architecture diagrams.** The system-level and data-flow diagrams in `ARCHITECTURE.md` are clear and would genuinely help a new engineer understand the intended system shape.

3. **Practical decision matrices.** The technology comparison tables in `DECISION_GUIDE.md` (job queues, email providers, storage) are well-structured and give defensible recommendations.

4. **Useful code examples.** The FAQ section in `DECISION_GUIDE.md` includes concrete code for next-run-time calculation, overlap handling, retry strategies, and caching patterns. These would save implementation time.

5. **Checklists.** The performance, security, and launch checklists are genuinely useful operational artifacts.

6. **Clear phased approach.** The six-phase breakdown provides a reasonable skeleton for incremental delivery.

---

## Critical Problems

### 1. The Plan Was Written Without Asking Any Questions

The prompt explicitly said *"You can ask questions, but only when you must."* Sonnet asked zero questions and produced 1,500 lines of planning.

This is the most serious mistake. A senior engineer given this task would *need* to know:

- **What is the existing tech stack?** The plan writes all examples in Node.js but acknowledges it doesn't know the stack. If the platform is Python/Django or Ruby/Rails, the entire technology selection section is misdirected.
- **Do reports already exist in the product?** If users can already generate reports on-demand, the feature is "add scheduling to existing reports," which is a fundamentally different (and smaller) architecture than "build a report system from scratch." The plan implicitly assumes the latter.
- **What report types are needed?** The data model, generator architecture, and phase 1 scope all depend on this. Without it, we're designing in a vacuum.
- **What's the current scale?** Number of users, organizations, and expected report volume determine whether we need worker pools and queue-based architecture at all, or whether a simple cron job suffices for v1.
- **What delivery channels does Product actually want?** The plan builds for email + Slack + webhooks, but maybe email-only is fine for launch and Slack is a "maybe later."

These aren't nice-to-have questions. They gate architectural decisions. By not asking them, Sonnet produced a plan that *looks* comprehensive but may be completely wrong for the actual product.

### 2. Massive Over-Engineering for the Planning Stage

Four documents before the team has answered basic requirements questions is premature. The plan includes:

- Specific Redis commands (`LPUSH report_generation_queue`)
- S3 lifecycle policy JSON
- Worker pool sizing formulas
- Concrete retry delay arrays (`[1m, 5m, 15m]`)
- Email size threshold logic
- Slack message payload structures

These implementation details masquerade as planning. They'll change the moment the team makes real technology choices or discovers real constraints. A plan should establish *what decisions need to be made and why*, not pre-make all of them.

### 3. Phase Ordering Is Wrong

The phases are sequenced for an engineer's comfort, not for product validation:

| Sonnet's Order | Problem |
|---|---|
| Phase 1: Backend CRUD + scheduler + one report | No user-facing surface to validate the UX |
| Phase 2: Report engine expansion | Still no UI -- who tests this? |
| Phase 3: Advanced scheduling | Timezone handling is here, but it should be foundational |
| Phase 4: Delivery improvements | Still no UI |
| **Phase 5: UI/UX** | **This is too late.** The creation wizard and dashboard should be co-developed with Phase 1. |
| Phase 6: Optimization | Reasonable as last phase |

Timezone handling buried in Phase 3 is particularly dangerous. If you build Phases 1 and 2 storing naive local times or making timezone assumptions, retrofitting UTC-everywhere plus timezone-aware scheduling is painful. Timezone support must be designed into the data model from day one.

### 4. Data Model Problems

**Recipients as JSONB array on the scheduled_report row:**
```
recipients: JSONB[]
  - type: String (email, user_id, slack_channel)
  - value: String
```

This causes real problems:
- Cannot query "which reports is user X subscribed to?" without scanning every row
- Cannot enforce referential integrity (user deleted but still in recipients JSON)
- Cannot implement per-recipient unsubscribe without parsing/rewriting JSON
- Makes audit logging of recipient changes harder
- No way for a recipient to manage their own subscriptions across reports

Recipients should be a separate table with proper foreign keys.

**No separation between report template and schedule:**

The plan conflates "what report to generate" (type, parameters, format) with "when and to whom" (schedule, recipients). These should be decoupled. A user might want the same report delivered on different cadences to different teams, or might want to change the schedule without recreating the report configuration.

**Missing fields:**
- No `version` or `updated_by` tracking on schedule changes
- No `last_successful_run_at` (distinct from `last_run_at` which may have failed)
- No concept of team/shared ownership (only `created_by`)

### 5. Missing Product-Level Thinking

The plan treats the feature as a pure technical problem. Missing considerations:

- **SaaS tier gating:** Is scheduled reports a premium feature? Does the number of allowed schedules vary by plan? This affects the data model and API (need plan-level limits).
- **Recipient consent model:** The plan validates email addresses but never considers whether recipients want these reports. In a SaaS product, you need preference management, not just delivery.
- **Integration with existing reports:** If the product already has a "Reports" section, the scheduling feature should plug into it, not be a parallel system.
- **Discoverability:** How do users find out they can schedule reports? This affects where the feature entry points live in the UI.
- **Multi-tenancy resource isolation:** In a SaaS platform, one organization running expensive reports shouldn't degrade performance for others. The plan mentions worker pools but doesn't address tenant-level fairness or throttling.

### 6. Security Model Is Under-Specified

"Users can only create reports they have permission to view" is stated as a requirement but never designed. If report generation runs queries against application data, the generator must enforce the same access controls as the application itself. This is a hard problem that affects the entire generator architecture. Is it:

- Re-using the application's existing query layer with the user's permissions?
- Running with elevated permissions and pre-filtering data?
- Using database-level row security?

The plan doesn't engage with this at all.

### 7. Testing Strategy Is Generic

The testing section lists obvious categories (unit, integration, load, UAT) without engaging with the *hard* testing problems specific to this feature:

- How do you test that a report scheduled for "9 AM Eastern" runs correctly across DST transitions?
- How do you test the scheduler's catch-up logic after a simulated outage?
- How do you test that report data matches what the user would see in the UI at the same moment?
- How do you load-test the interaction between the scheduler, queue, and workers under contention?

---

## Minor Issues

- The `DECISION_GUIDE.md` code example for `calculateNextRun` uses `moment.js`, which is deprecated. It should use `date-fns`, `luxon`, or `Temporal` (if available in the target runtime).
- The retry strategy uses manual re-enqueue rather than leveraging the queue library's built-in retry. Most queue libraries (Bull, Celery, Sidekiq) handle this natively with less code and better observability.
- Cost estimates ($0.05-0.10 per report) are presented without load assumptions, making them meaningless. You need to know report complexity and volume to estimate costs.
- The "Next Steps" section in the main plan and the README partially overlap, creating ambiguity about which is authoritative.

---

## Summary of Recommendations

| Area | Sonnet's Approach | Recommended Approach |
|---|---|---|
| Questions | Asked none | Ask 3-5 critical questions first, gate the plan on answers |
| Scope | 4 documents, ~1500 lines | 1 plan document; split into detailed docs only after requirements are validated |
| Phasing | Backend-first, UI last | UI + API co-developed in Phase 1; validate with users early |
| Timezones | Phase 3 | Day-one foundational requirement |
| Data model | Recipients as JSONB on parent row | Separate recipients table with proper FK relationships |
| Report templates | Coupled with schedule | Decouple report config from schedule config |
| Security | Stated as goal, not designed | Design the authorization model explicitly before building the generator |
| Product concerns | Not addressed | Address SaaS tiers, consent, integration with existing reports |
| Technology | Pre-selected with examples | Identify decisions and criteria; defer choices until stack is confirmed |
