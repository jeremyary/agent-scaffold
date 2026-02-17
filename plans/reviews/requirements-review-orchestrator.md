# Requirements Review: Orchestrator

**Artifact:** Requirements (hub + 5 chunks)
**Reviewer:** Orchestrator (main session)
**Date:** 2026-02-16
**Verdict:** REQUEST_CHANGES

## Summary

The requirements document is structurally excellent — the hub/chunk pattern works well, cross-cutting concerns are precisely defined, and acceptance criteria quality is high across all chunks. However, there are two coverage gaps where product plan capabilities were lost during the Requirements Analyst's feature reorganization, and the feature ID remapping creates a confusing mapping between product plan and requirements.

## Findings

### Critical

**C-1: F13 CEO Conversational Analytics stories cover only audit trail, missing business analytics drill-down**

- **Location:** `requirements-chunk-5-executive.md`, stories S-5-F13-01 through S-5-F13-05
- **Description:** The product plan's F13 describes conversational drill-down on business data: "How many loans does James have in underwriting?", "What is our pull-through rate this quarter vs. last?", "Show me turn times for the conditions clearing stage", "What percentage of applications are denied?", "Are there any disparate impact concerns in our denial rates?" All five F13 stories in chunk 5 are exclusively about audit trail queries (application-centric, decision-centric, pattern-centric). Business analytics drill-down — the primary purpose of F13 — has no dedicated stories with acceptance criteria.
- **Impact:** The CEO conversational analytics experience is the product plan's key differentiator for the executive persona. Without it, the CEO has a visual dashboard (F12) but no conversational AI capability for business questions — only audit trail access.
- **Suggested Resolution:** Add 3-4 stories for business analytics drill-down: (1) CEO asks pipeline/performance questions answered by Analytics Service, (2) CEO asks comparative questions ("this quarter vs. last"), (3) CEO asks about specific LO or application by name, (4) CEO asks fair lending questions answered by Compliance Service aggregates. Rename existing F13 audit trail stories to distinguish them from the business analytics stories, or assign them to the audit trail feature (F15).

**C-2: F17 Loan Estimate and Closing Disclosure document generation missing**

- **Location:** `requirements-chunk-4-underwriting.md`, F17 stories; also absent from chunk 2
- **Description:** The product plan's F17 states: "The system generates Loan Estimate documents at appropriate points in the application process. The Closing Disclosure is generated as a document even though the closing workflow itself is not interactive." The requirements have no story for generating these documents. S-4-F11-03 verifies TRID timing compliance (checking that LE was delivered within 3 business days) but assumes the documents already exist. There is no requirement specifying when LE/CD documents are created, what they contain, or how they are delivered to the borrower.
- **Impact:** TRID disclosure generation is a core regulatory demonstration capability. Without it, the compliance check verifies timing of documents that were never generated.
- **Suggested Resolution:** Add 2 stories: (1) Loan Estimate generation triggered at application submission (or appropriate point), containing required fields per TRID, delivered to borrower with timestamp logged. (2) Closing Disclosure generation at appropriate point, generated as document (even though closing workflow is not interactive). Both carry "simulated for demonstration" disclaimer per REQ-CC-17.

### Warning

**W-1: Feature ID remapping creates confusion between product plan and requirements**

- **Location:** Hub document `requirements.md`, Coverage Validation Table
- **Description:** The Requirements Analyst reorganized product plan features into different groupings:
  - Product plan F2 (Prospect Affordability/Pre-Qualification) absorbed into F1 stories
  - F2 story IDs repurposed for authentication (originally part of F14)
  - Product plan F4 (Mortgage Application Workflow) split across F3 (intake) and F4 (document upload)
  - Product plan F5 (Document Upload and Analysis) became F5 (extraction only, upload moved to F4)
  - Product plan F6 (Application Status + Timeline) became F6 (document completeness)
  - Product plan F13 (CEO Conversational Analytics) became F13 (audit trail access)
  - Product plan F17 (Regulatory Awareness + TRID) became F17 (underwriting decisions)
- **Impact:** Downstream agents (Tech Lead, Project Manager) will reference features by product plan ID. When they look up "F2 stories" expecting affordability/pre-qualification, they'll find authentication stories. This creates a persistent source of confusion across the entire SDD lifecycle.
- **Suggested Resolution:** Realign the Coverage Validation Table so each row uses the product plan's feature definitions. If the analyst found a better functional grouping, document the mapping explicitly (e.g., "Product Plan F4 maps to Requirements F3 stories S-2-F3-01 through S-2-F3-05 and F4 stories S-2-F4-01 through S-2-F4-04"). Alternatively, add a "Product Plan Feature Mapping" table to the hub that translates between the two numbering systems.

**W-2: F6 (Application Status + Timeline Tracking) underserved**

- **Location:** `requirements-chunk-2-borrower.md`, F6 stories S-2-F6-01 through S-2-F6-03
- **Description:** The product plan's F6 describes: borrowers see current status at any time, AI explains what stage the application is in, what is happening at that stage, what the borrower should expect next, estimated timelines, outstanding conditions, and regulatory timing awareness (Reg B 30-day notification, TRID LE delivery timing). The requirements reframed F6 as "Document Completeness Checking" — the three stories cover missing documents, proactive document requests, and document freshness. Application status explanation, stage timeline, and what-to-expect-next are scattered across other stories as incidental mentions but lack dedicated acceptance criteria.
- **Impact:** Application status tracking is a core borrower experience. The product plan's Flow 3 demonstrates Sarah returning and asking "What is the status of my application?" — this scenario needs its own acceptance criteria, not just passing references.
- **Suggested Resolution:** Add 1-2 stories for application status: (1) Borrower asks application status and receives stage explanation, pending actions, and timeline estimate. (2) Agent proactively notes regulatory deadlines (Reg B 30-day notification, TRID timing) when relevant. These can go in the existing F6 section or as a new F6-status group.

### Suggestion

**S-1: Consider splitting F13 into business analytics and audit trail access**

- **Location:** Hub document and chunk 5
- **Description:** Business analytics drill-down (powered by Analytics Service) and audit trail access (powered by Audit Service) serve different purposes, use different data sources, and target different user needs. Grouping them under one feature ID obscures both capabilities.
- **Suggested Resolution:** If realigning feature IDs per W-1, this is a natural split point.

**S-2: Add a "Product Plan Feature Mapping" section to the hub**

- **Location:** `requirements.md`
- **Description:** Even after resolving W-1, a cross-reference table between product plan feature IDs and requirements story groups would help downstream agents navigate between documents.
- **Suggested Resolution:** Add a table like: "Product Plan F4 (Mortgage Application Workflow) -> Stories S-2-F3-01 to S-2-F3-05 (conversational intake) + S-2-F4-01 to S-2-F4-04 (document upload)"

### Positive

**P-1: Cross-cutting concerns are exceptionally well-defined**

The 22 REQ-CC requirements (HMDA four-stage isolation, three-layer RBAC, four-layer agent security, audit trail immutability with hash chain) are precise, testable, and correctly factored out of the chunks. This avoids repetition while ensuring these critical constraints are applied universally.

**P-2: Edge case coverage is strong**

Stories consistently include adversarial inputs, service unavailability, role edge cases, concurrent operations, and boundary conditions. The demographic data filter false-negative mitigation (REQ-CC-05 + output filter as secondary defense) is particularly well thought through.

**P-3: Hub/chunk structure is effective**

The hub provides a clear index with dependency map, state machine, and coverage validation. Each chunk is self-contained with clear cross-references. The pattern scales well for 125 stories.

**P-4: Co-borrower support is properly covered**

Chunk 2 includes co-borrower scenarios in the application intake stories, addressing a product plan requirement that could easily have been missed.
