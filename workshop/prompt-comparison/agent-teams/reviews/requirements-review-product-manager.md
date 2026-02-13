<!-- This project was developed with assistance from AI tools. -->

# Requirements Review: Product Manager

**Artifact reviewed:** plans/requirements.md + requirements-chunk-1-foundation.md + requirements-chunk-2-core-workflow.md + requirements-chunk-3-public-tier.md + requirements-chunk-4-extensions-admin.md
**Reviewed against:** plans/product-plan.md
**Reviewer:** Product Manager
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

## Summary

The requirements documents are thorough and well-structured, with 95 stories and 454 acceptance criteria that demonstrate strong translation of the product vision into testable specifications. The Given/When/Then format is consistently applied, the data flow trace is an excellent artifact, and the state machine documentation is precise. However, there are several story map vs. chunk inconsistencies in phase and priority assignments, one missing product plan feature (Loan Processing Dashboard UI), and a story ID numbering mismatch in the public tier chunk that must be resolved before downstream agents can work reliably.

## Findings

### Critical

**C-1: Story ID mismatch between story map and Chunk 3 (CHAT-06 / CHAT-07)**

The story map (requirements.md) defines:
- CHAT-06 = "Chat Response Streaming (SSE)"
- CHAT-07 = "Intake Agent Isolation and Safety"

But Chunk 3 (requirements-chunk-3-public-tier.md) implements:
- CHAT-06 = "Mortgage Calculator Tool Use in Chat" (line 179)
- CHAT-07 = "Streaming Chat Responses (SSE)" (line 219)

"Intake Agent Isolation and Safety" (CHAT-07 in story map) has no dedicated story with acceptance criteria in any chunk -- it exists only as a cross-cutting section in Chunk 3 (line 659). Meanwhile, "Mortgage Calculator Tool Use in Chat" has no story ID in the story map at all. This means downstream agents referencing CHAT-06 or CHAT-07 will see different content depending on whether they consult the story map or the chunk document.

**Resolution:** Renumber the Chunk 3 stories to match the story map, or update the story map to match the chunk. Either way, "Intake Agent Isolation and Safety" needs either a proper story with acceptance criteria or an explicit decision to fold it into the cross-cutting section (with the story map updated accordingly). "Mortgage Calculator Tool Use in Chat" needs a story ID in the map.

---

**C-2: Story map phase/priority contradicts chunk body for multiple stories**

Several stories have phase or priority values in the story map (requirements.md) that conflict with the actual story body in the chunk documents. Downstream agents (Project Manager, Architect) will encounter contradictory guidance depending on which document they consult.

| Story | Story Map (requirements.md) | Chunk Body | Product Plan Says | Correct Value |
|-------|---------------------------|------------|-------------------|---------------|
| PIPE-04 | P0, Phase 2 | P0, Phase 3a | Phase 3a (Financial risk assessment) | Phase 3a |
| AUTH-08 | P1, Phase 1 | P0, Phase 1 | P0 (TTL is part of RBAC feature) | P0 |
| CHECKPOINT-01 | P0, Phase 2 | P0, Phase 1 | Phase 1 ("persistent checkpointing") | Phase 1 |
| CHECKPOINT-02 | P0, Phase 2 | P0, Phase 1 | Phase 1 | Phase 1 |
| CHECKPOINT-03 | P1, Phase 2 | P0, Phase 1 | Phase 1 (implied) | Phase 1, priority debatable |
| DOC-01 | P0, Phase 1 | P0, Phase 2 | Phase 1 (upload required before submit) | Phase 1 |
| DOC-02 | P0, Phase 1 (implied) | P0, Phase 2 | Phase 1 (validation needed with upload) | Phase 1 |
| DOC-03 | P0, Phase 1 (implied) | P0, Phase 2 | Debatable | Phase 1 for basic status, Phase 2 for extraction data |
| DOC-04 | P0, Phase 1 (implied) | P0, Phase 2 | Debatable | Phase 1 |
| DEPLOY-01 | P0, Phase 1 | P2, Phase 5 | P2, Phase 5 ("Container-based deployment artifacts") | P2, Phase 5 |
| DEPLOY-03 | P0, Phase 1 | P2, Phase 5 | NFR (not explicitly phased) | Needs resolution |

**Resolution:** Align every story map entry with the corresponding chunk body. For DOC-01 through DOC-04: the product plan's Phase 1 description says "upload documents" as part of the application lifecycle, and APP-04 AC-2 requires at least one document for submission. Therefore DOC-01/02/03/04 must be Phase 1 for at least their basic upload/download/validation capabilities. The chunk bodies should be corrected to Phase 1 (or split into Phase 1 basic + Phase 2 extraction-related status). For DEPLOY-01/03: the story map says P0 Phase 1 but the product plan says containers are Phase 5. The story map should be corrected to match the chunk and product plan unless the intent is that local compose.yml containers are Phase 1 (which DX-02 already covers).

---

**C-3: Knowledge base and threshold story phase/priority inconsistency**

The story map lists:
- KB-01/02/03 as P1, Phase 3a
- THRESHOLD-01/02/03 as P1, Phase 3a

But the actual stories in chunk 4 list them all as P2, Phase 5.

The product plan says:
- "Knowledge base management" is P2, Phase 5
- "Configurable risk thresholds with admin interface" is P2, Phase 5

The story map appears to have been updated based on the reasoning that Phase 3a's compliance checker needs knowledge base content and PIPE-06 needs configurable thresholds. This is a valid dependency analysis, but it conflicts with the product plan's explicit phasing. The product plan resolves this tension by: (a) seeding the knowledge base with demo content via DX-01/02 rather than requiring the management UI in Phase 3a, and (b) having PIPE-06 load thresholds from the database with hardcoded defaults, not requiring an admin UI.

**Resolution:** Align story map with chunk bodies (P2, Phase 5). If the Requirements Analyst believes the knowledge base upload API (not just seed data) is a hard dependency for Phase 3a, this should be escalated as an open question rather than silently changed. The product plan's intent is that seed data provides the initial knowledge base and threshold values.

---

**C-4: Missing product plan feature -- Loan Processing Dashboard (P0) has no UI stories**

The product plan P0 feature "Loan processing dashboard" specifies: "UI for authenticated users showing application list, application detail with all agent analyses, review queue with filtering by priority and status, and workflow progress visualization."

The requirements cover the API endpoints that serve this data (APP-02, APP-03, REV-01, REV-02) but contain zero UI stories for the dashboard itself. There are no stories defining:
- Dashboard layout or page structure for the loan officer view
- Workflow progress visualization UI
- Review queue filtering and sorting UI
- Agent analyses side-by-side display in the UI
- How application status updates are polled and reflected in the UI

The product plan's Phase 1 explicitly includes "Loan processing dashboard (P0) -- scaffolding with application list and detail views." The developer experience flow (Flow 4) describes Alex "clicking through each agent's analysis" in the UI.

**Resolution:** Add UI stories for the loan processing dashboard, at minimum covering: (1) application list page, (2) application detail page with agent analyses display, (3) review queue page with role-based filtering, and (4) workflow progress visualization. These can be thin stories that reference the corresponding API stories for data contracts, but they need to exist so the frontend developer has clear scope.

---

### Warning

**W-1: AUDIT-04 referenced in story map but has no acceptance criteria anywhere**

The story map includes `AUDIT-04 | Query Audit Events for an Application | P0 | 1` with the note "(index entry -- sub-resource of APP-03)." This story is referenced in Chunk 2 (line 141: "Workflow history (audit events) is available via the sub-resource `/v1/applications/:id/audit-events` (specified in AUDIT-04, Chunk 1)") but AUDIT-04 has no acceptance criteria in any chunk document. It is not covered in Chunk 1 (which only has AUDIT-01 through AUDIT-03) and not in Chunk 4 (which has AUDIT-05 and AUDIT-06).

The product plan says "A complete audit trail for any application is producible in under 5 minutes" and the compliance officer flow (Flow 2) describes searching for and viewing audit trails. The API endpoint `/v1/applications/:id/audit-events` is a key piece of this. Without acceptance criteria, the implementer has no specification for filtering, pagination, response format, or authorization of this endpoint.

**Resolution:** Write full acceptance criteria for AUDIT-04 in Chunk 1, covering: endpoint definition, response format (chronological listing of all event types for the application), pagination, role-based access, and filtering by event type and date range.

---

**W-2: Public tier rate limiting story (AUTH-08) priority conflict**

AUTH-08 in the story map is titled "Rate Limiting" with priority P1. The actual story in Chunk 1 is titled "API Key Expiration" with priority P0, which is about key TTL, not rate limiting.

Rate limiting for the public tier is specified in the Chunk 3 cross-cutting section (20/60/60 req/min) and for the protected tier in Chunk 1 notes, but there is no dedicated story with acceptance criteria for the rate limiting middleware itself. The product plan's security section says "Public access features have rate limiting to prevent abuse and control costs." The story map entry at AUTH-08 appears to have been repurposed for key expiration while the rate limiting story was lost.

**Resolution:** Either rename the story map's AUTH-08 to match the chunk's actual content ("API Key Expiration") and create a separate story for rate limiting, or clarify that rate limiting acceptance criteria are covered by the Chunk 3 cross-cutting section and CHAT-01 AC-5 / CALC-01 AC-6 / MARKET-01 AC-7. Either way, the story map entry title must match the chunk content.

---

**W-3: Compliance officer persona (David) audit query flow only partially covered**

Product plan Flow 2 (Compliance Officer Runs an Audit) describes David:
1. Searching for a specific application by ID or filtering by date range and decision type
2. Viewing the complete audit trail
3. Verifying denial reasons cite quantifiable metrics
4. Exporting the audit trail
5. Reviewing aggregate compliance reports
6. Modifying thresholds

Steps 4-6 are covered (AUDIT-05, COMPLIANCE-02, THRESHOLD-01/02). But step 1 (search/filter applications by date range and decision type) is not covered by any story. APP-02 supports filtering by status but not by date range or decision type. There is no search endpoint for applications.

**Resolution:** Either add filtering by date range and decision type to APP-02's acceptance criteria, or add a dedicated search story for the compliance officer use case.

---

**W-4: Product plan NFR "Workflow progress visualization" has no requirements mapping**

The product plan P0 feature list includes "workflow progress visualization" as part of the loan processing dashboard. The developer flow (Flow 4) says Alex "watches the multi-agent workflow execute." No story in any chunk specifies how workflow progress is communicated to the UI. Polling is the stated mechanism (product plan: "Workflow status updates use polling"), but there is no story defining what endpoint to poll, what progress data it returns (current step, percentage, estimated time), or how the UI displays it.

**Resolution:** Add acceptance criteria (either as a new story or as additional ACs on APP-03) defining a workflow progress response: current pipeline step, completed steps, estimated completion, and error state if applicable.

---

**W-5: REV-05 and REV-06 priority conflict between story map and product plan**

The story map lists:
- REV-05 (Request Additional Documents) as P1, Phase 4
- REV-06 (Document Resubmission Cycle) as P1, Phase 4

But the chunk 4 story bodies list them as P0, Phase 4. The product plan says "Human-in-the-loop review workflow (P0) -- advanced features: request additional documents with cyclic resubmission (full pipeline re-run on new documents)" in Phase 4. This is explicitly called out as the P0 portion of the review workflow deferred to Phase 4.

**Resolution:** The chunk bodies (P0) are correct per product plan. Update the story map to P0.

---

**W-6: DOC-05 priority conflict**

The story map lists DOC-05 (Additional Document Request and Resubmission) as P1, Phase 4. The chunk 4 body says P2, Phase 4. The product plan does not have DOC-05 as a separate feature -- document upload to `awaiting_documents` applications is part of the P0 "Human-in-the-loop review workflow" Phase 4 feature. Since REV-06 (P0) depends on DOC-05 (the ability to upload to `awaiting_documents` applications), DOC-05 must match REV-06's priority.

**Resolution:** DOC-05 should be P0, Phase 4 to match REV-06's dependency.

---

**W-7: Phase breakdown story counts in requirements.md appear inaccurate**

The Phase Breakdown table (requirements.md, line 498-506) lists:
- Phase 1: 28 P0 stories
- Phase 2: 14 P0 stories

Given the inconsistencies identified above (DOC-01-04 phase, DEPLOY-01/03 phase, CHECKPOINT phase, etc.), these counts may be inaccurate. After resolving the phase assignments, the counts should be recomputed.

**Resolution:** After resolving all phase/priority inconsistencies, recount and update the Phase Breakdown table.

---

### Suggestion

**S-1: Add a consistency validation between story map and chunk bodies**

The most common issue class in this review is story map entries that conflict with chunk body assignments. Consider adding a validation step (or a script) that mechanically checks that every story ID's priority, phase, and title in the story map matches the corresponding entry in the chunk file. This would catch discrepancies early.

---

**S-2: Explicitly document the relationship between seed data and Phase 3a knowledge base needs**

The requirements correctly note that "knowledge base (RAG infrastructure) from Phase 3a is available before CHAT-03 (source citations) can be fully tested" (Chunk 3, Assumption 1). However, the mechanism by which the knowledge base gets its initial content in Phase 3a is unclear. The product plan intends seed data (DX-01/02) to include demo regulatory excerpts, and KB-01 (user-managed uploads) is Phase 5. This should be explicit: add an acceptance criterion to DX-02 (or a note) stating that seed data includes knowledge base content (ECOA, Fair Housing Act, TILA, RESPA excerpts) for Phase 3a's compliance checker and intake agent.

KB-01 AC-5 in chunk 4 already says "the knowledge base includes sample regulatory excerpts" in a freshly seeded environment, but since KB-01 is assigned Phase 5, there is a question of whether this seed content is available in Phase 3a. The seed data story (DX-02) does not mention knowledge base content.

---

**S-3: Consider adding explicit polling stories for the UI**

The product plan mandates "polling for workflow status" (not streaming). The requirements mention polling in notes but never define:
- What endpoint the UI polls for workflow progress
- Recommended polling interval
- How the UI knows when to stop polling (terminal state detection)
- Backoff strategy for long-running workflows

These could be acceptance criteria on APP-03 or APP-05, or a dedicated lightweight story.

---

**S-4: Clarify the "DX-04: Architecture Documentation" priority discrepancy**

The story map lists DX-04 as P1, Phase 5. But the actual story in Chunk 1 is marked P0, Phase 1 (line 1020-1022). The product plan says "Development documentation with architecture overview and troubleshooting guide" is part of the P0 "Self-contained local development setup" feature. The README, quickstart guide, and architecture diagram are essential for developer setup (Flow 4) and should be Phase 1.

**Resolution:** Story map should be P0 Phase 1 to match the chunk and product plan intent.

---

**S-5: Add acceptance criteria for the mocked services contract**

The product plan has a detailed "Mocked vs. Real Services" section specifying that each mock implements the same interface as the real counterpart. The requirements cover the mocked credit bureau in PIPE-03 AC-5 but do not have explicit acceptance criteria for:
- Mock property data service conforming to a Protocol interface
- Mock email notification service
- Mock employment verification
- The general principle that mocks are swappable via configuration without code changes

A cross-cutting story or acceptance criteria on the relevant service stories would ensure the mock-contract pattern is testable.

---

### Positive

**P-1: Excellent data flow trace**

The "Complete Data Flow: Happy Path" section in both requirements.md and Chunk 2 is an outstanding artifact. It traces every step of the loan processing workflow with cross-references to specific stories and acceptance criteria. This makes it immediately clear how the stories compose into the end-to-end user journey, and it will be invaluable for the Project Manager's dependency analysis and the Test Engineer's integration test planning.

---

**P-2: Strong state machine specification**

The Application Status State Machine (requirements.md, line 248-303) is precise, complete, and clearly distinguishes Phase 2 transitions from Phase 4 additions. The explicit listing of valid transitions with actors (user vs. system) is exactly what the backend developer needs. The terminal state definition is unambiguous.

---

**P-3: Thorough cross-cutting concern documentation**

The Chunk 3 cross-cutting sections (Rate Limiting, Intake Agent Isolation, Financial Precision, Response Envelope) are well-structured and provide clear, testable constraints that apply across all public tier stories. The Intake Agent Isolation section in particular provides a crisp security boundary specification with explicit CAN/CANNOT lists.

---

**P-4: Consistent Given/When/Then format with defensible depth**

All 454 acceptance criteria follow a consistent Given/When/Then format with appropriate granularity. Error paths and edge cases are systematically covered (not just happy paths). The financial precision convention (integer cents, string decimal serialization) is stated once and referenced consistently throughout.

---

**P-5: Architecture Consistency Notes are valuable**

The "Architecture Consistency Notes" sections in requirements.md and Chunk 2 proactively identify potential discrepancies between requirements and architecture (e.g., compliance checker parallel timing, review queue sorting). These are exactly the kind of cross-boundary observations that prevent integration surprises during implementation.

---

**P-6: Open questions are well-scoped and actionable**

The 12 merged open questions are specific, cite the relevant stories, and distinguish between questions that need stakeholder input vs. Technical Design decisions. This is a clean handoff to downstream phases.
