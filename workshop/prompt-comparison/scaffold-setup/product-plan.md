# PRD: Report Scheduling

## Problem Statement

Teams that rely on recurring reports (sales summaries, operational dashboards, compliance snapshots) currently have to generate and distribute them manually. This means someone remembers to run the report, exports it, and emails it to the right people -- or it simply does not happen. Reports arrive late, go to stale distribution lists, or get skipped entirely during busy periods.

Users need a way to define a report once, set a recurring cadence, and have the system generate and deliver it automatically so that the right people get the right data on a predictable schedule without manual effort.

## Target Users

### Persona: Report Owner (Maya)

- **Role:** Team lead, operations manager, or analyst who is responsible for keeping their team informed with regular data.
- **Goals:** Set up a report schedule once and trust that it runs reliably. Adjust recipients or cadence as the team changes. Know at a glance whether recent deliveries succeeded.
- **Pain Points:** Manually running and distributing reports is tedious and error-prone. Forgetting a weekly report erodes team trust. No visibility into whether a report was actually delivered.
- **Context:** Uses the platform during business hours. Manages 1-10 recurring reports. Distributes to a team of 3-20 people.

### Persona: Report Recipient (Sam)

- **Role:** Team member, executive, or stakeholder who consumes reports but does not create them.
- **Goals:** Receive the right reports on a predictable schedule without having to ask for them. Access past reports when needed.
- **Pain Points:** Reports arrive inconsistently. Has to chase the report owner when one is missing. Cannot easily find a report from two weeks ago.
- **Context:** Receives reports via email or in-app. Reads them on desktop or mobile. Does not interact with the scheduling UI directly.

### Persona: Account Admin (Jordan)

- **Role:** Account administrator or workspace owner who oversees report scheduling across the organization.
- **Goals:** Understand what schedules exist across the account. Disable or reassign orphaned schedules when someone leaves the team.
- **Pain Points:** No centralized view of all active schedules. Cannot intervene when a schedule is misconfigured or its owner is unavailable.
- **Context:** Interacts with the scheduling feature occasionally, primarily for oversight and cleanup.

## Proposed Solution

A self-service report scheduling feature that lets users pick a report type, define a delivery cadence, specify recipients, and have the system automatically generate and deliver those reports on schedule. The feature includes a management interface for viewing, editing, pausing, and deleting schedules, along with a delivery history so owners can confirm reports were sent.

## Success Metrics

| Metric | Current Baseline | Target | Measurement Method |
|--------|-----------------|--------|-------------------|
| Percentage of recurring reports delivered automatically (vs. manually) | 0% (feature does not exist) | 60% of all recurring reports use scheduling within 3 months of launch | Ratio of scheduled deliveries to total report generations |
| On-time delivery rate | N/A | 95% of scheduled reports arrive within the expected delivery window | Delivery timestamp vs. scheduled time |
| Schedule creation completion rate | N/A | 80% of users who start creating a schedule complete it | Funnel tracking: start -> complete |
| Report owner time saved per week | Estimated 30-60 min/week on manual distribution | Reduce to < 5 min/week of schedule management | User survey at 30 and 90 days post-launch |
| Delivery failure acknowledgment time | N/A | Owners are aware of a failed delivery within 1 business day | Time between failure event and owner viewing the failure notification |

## Feature Scope

### Must Have (P0)

- [ ] **Report type selection** -- Users can choose from available report types when creating a schedule
- [ ] **Cadence configuration** -- Users can set daily, weekly, or monthly delivery frequency with a specific time and day
- [ ] **Recipient management** -- Users can add and remove email recipients for a schedule
- [ ] **Email delivery** -- Scheduled reports are generated and delivered to recipients via email at the configured cadence
- [ ] **Schedule management** -- Users can view, edit, pause, resume, and delete their schedules from a central list
- [ ] **Delivery status visibility** -- Users can see whether each scheduled run succeeded or failed
- [ ] **Timezone support** -- Schedules run according to the owner's configured timezone
- [ ] **Authentication and authorization** -- Only the schedule owner (and account admins) can modify a schedule

### Should Have (P1)

- [ ] **Custom cadence expressions** -- Users can define more granular schedules beyond daily/weekly/monthly (e.g., "every other Monday", "first business day of the quarter")
- [ ] **In-app notifications** -- Recipients receive notifications within the application when a report is delivered
- [ ] **Delivery history and audit log** -- A log of all past deliveries for each schedule, including timestamps, recipient lists, and outcomes
- [ ] **Retry on failure** -- The system automatically retries a failed report generation or delivery before marking it as failed
- [ ] **Schedule validation** -- The system warns users about potentially problematic configurations (e.g., monthly report on the 31st)

### Could Have (P2)

- [ ] **Report preview** -- Users can preview a report before activating a schedule, so they know what recipients will receive
- [ ] **Team/group recipients** -- Users can add a team or group as a recipient rather than listing individuals
- [ ] **Admin dashboard** -- Account admins can view and manage all schedules across the account
- [ ] **Bulk operations** -- Admins can pause, resume, or delete multiple schedules at once
- [ ] **Schedule templates** -- Pre-configured schedule templates for common cadences (e.g., "Weekly Monday morning summary")

### Won't Have (this phase)

- Real-time or streaming report delivery
- Report builder or designer (assumes report types already exist in the system)
- External delivery integrations (Slack, Teams, webhook)
- Report format customization (PDF layout, branding)
- Cross-account or multi-tenant schedule sharing
- Mobile-native scheduling interface (web responsive is sufficient)

## User Flows

### Flow 1: Creating a New Schedule

1. User navigates to the report scheduling section from the main navigation.
2. User selects "Create Schedule."
3. User picks a report type from the list of available reports.
4. User configures the cadence: frequency (daily, weekly, monthly), day of week/month, and time of day.
5. User sets their timezone (defaulting to their profile timezone if available).
6. User adds recipients by email address.
7. User reviews the schedule summary (report type, next delivery time, recipients).
8. User confirms and activates the schedule.
9. System displays a confirmation with the next scheduled delivery date/time.

### Flow 2: Managing Existing Schedules

1. User navigates to "My Schedules" and sees a list of all their active and paused schedules.
2. Each row shows: report name, cadence summary, next delivery, last delivery status, and active/paused state.
3. User can click a schedule to view its details and delivery history.
4. User can edit the cadence, recipients, or timezone from the detail view.
5. User can pause a schedule (stops future deliveries without deleting configuration).
6. User can resume a paused schedule.
7. User can delete a schedule with a confirmation prompt.

### Flow 3: Investigating a Failed Delivery

1. User sees a failure indicator on their schedule list (or receives a notification about the failure).
2. User clicks into the schedule detail view.
3. User views the delivery history, which shows the failed run with a human-readable failure reason (e.g., "Report generation timed out", "Recipient email bounced").
4. User takes corrective action (fixes recipient, waits for next run, or triggers an immediate retry if available).

### Flow 4: Admin Oversight

1. Admin navigates to the account-wide schedule management view.
2. Admin sees all schedules across the account with filters for owner, report type, and status.
3. Admin can disable a schedule whose owner has left the organization.
4. Admin can reassign a schedule to a new owner.

## Non-Functional Requirements

| Requirement | User Expectation |
|-------------|-----------------|
| **Delivery timeliness** | Scheduled reports arrive within a reasonable window of the configured time -- users should not notice a delay |
| **Schedule creation responsiveness** | Creating, editing, and managing schedules feels immediate -- no perceptible lag in the UI |
| **Delivery reliability** | Reports are delivered consistently; missed deliveries are rare and clearly communicated when they occur |
| **Failure transparency** | When a delivery fails, the owner knows about it promptly and can understand why without contacting support |
| **Scale with team growth** | The feature continues to work smoothly as a team grows from a handful of schedules to dozens, and recipient lists grow to tens of people |
| **Data integrity** | Schedule configurations are never silently lost or corrupted; changes are persisted reliably |

## Open Questions

1. **What report types exist today?** The scheduling feature depends on existing report types in the system. How many are there, and do they all support automated generation?
2. **Email sending constraints?** Are there organizational limits on outbound email volume or sender domain requirements that could affect delivery?
3. **What happens to a schedule when its owner leaves?** Should schedules auto-disable, transfer to an admin, or continue running?
4. **Report generation duration?** Some reports may take longer to generate than others. Do any existing report types have generation times that would affect user expectations for delivery timeliness?
5. **Recipient limits?** Should there be a maximum number of recipients per schedule? Per account?
6. **Time window for "monthly on the 31st"?** When a monthly schedule targets a day that does not exist in a given month (e.g., the 31st of February), should the system deliver on the last day of the month or skip that month?

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Report generation fails silently, and users lose trust in the feature | Medium | High | Delivery status visibility is P0; failure notifications ensure owners know promptly |
| Users create schedules and forget about them, leading to stale report spam | Medium | Medium | Schedule management UI makes active schedules visible; admins can audit and clean up (P2) |
| High volume of scheduled reports at popular times (e.g., Monday 9 AM) causes delivery delays | Medium | Medium | Surface delivery timeliness in success metrics; monitor and address in subsequent phases |
| Recipients mark automated emails as spam, degrading deliverability | Low | High | Use clear sender identity; include unsubscribe/opt-out mechanism in emails |
| Timezone handling errors cause reports to arrive at unexpected times | Medium | Medium | Timezone support is P0; validate timezone handling thoroughly during testing |
| Schedule owner leaves the organization, and schedules become orphaned | Medium | Low | Open question for stakeholder; admin oversight in P2 provides a fallback |

## Stakeholder-Mandated Constraints

The following technology and platform constraints were stated by the stakeholder or recorded in the project context. These are inputs for the Architect, not product decisions.

- All dependencies must be open-source with Fedora-allowed licenses (from project constraints)
- Modern browsers only -- last 2 versions (from project constraints)
- Technology stack decisions (languages, frameworks, task queue, database) are recorded in the project's Key Decisions section and are managed by the Architect

## Phasing

### Phase 1: Core Scheduling

**Capability milestone:** Users can create a report schedule by selecting a report type, choosing a daily, weekly, or monthly cadence, adding email recipients, and having reports generated and delivered automatically on schedule. Users can view, edit, pause, and delete their schedules and see whether each delivery succeeded or failed.

**Features included:** Report type selection, Cadence configuration, Recipient management, Email delivery, Schedule management, Delivery status visibility, Timezone support, Authentication and authorization.

**Key risks:** Report generation reliability is unproven at scale. Timezone edge cases may cause unexpected delivery times. Email deliverability depends on infrastructure not yet validated.

### Phase 2: Reliability and Flexibility

**Capability milestone:** The system handles delivery failures gracefully with automatic retries and detailed delivery history. Users have more flexibility in defining schedules with custom cadence expressions and receive in-app notifications in addition to email.

**Features included:** Custom cadence expressions, In-app notifications, Delivery history and audit log, Retry on failure, Schedule validation.

**Key risks:** Custom cadence expressions increase the surface area for configuration errors. In-app notification infrastructure may not exist yet.

### Phase 3: Administration and Convenience

**Capability milestone:** Account admins have visibility and control over all schedules in the organization. Users benefit from quality-of-life improvements like report preview, team-based recipients, and schedule templates.

**Features included:** Report preview, Team/group recipients, Admin dashboard, Bulk operations, Schedule templates.

**Key risks:** Admin features require elevated authorization model. Team/group recipients depend on a group management capability that may not exist.
