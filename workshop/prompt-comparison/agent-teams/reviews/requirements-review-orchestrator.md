<!-- This project was developed with assistance from AI tools. -->

# Requirements Review: Orchestrator (Cross-Cutting)

**Artifact reviewed:** plans/requirements.md + chunk files 1-4
**Reviewed against:** plans/product-plan.md, plans/architecture.md, chunk files 1-4 (internal consistency)
**Reviewer:** Orchestrator
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

## Summary

The requirements chunk files (1-4) are thorough, internally consistent, and provide excellent Given/When/Then acceptance criteria across 95 stories and 454 ACs. However, the master document (`requirements.md`) has **multiple incorrect phase and priority assignments in its story map** that diverge from the actual chunk files. These discrepancies would mislead downstream agents (Tech Lead, Project Manager) who use the master document for planning. The chunk files themselves are the authoritative source and are largely correct relative to the product plan.

## Findings

### Critical

**C-1: Master document story map has incorrect phase/priority assignments for 14+ stories**

The master document's story map tables contain phase and priority values that contradict the actual chunk files. This is the highest-impact finding because the Tech Lead and Project Manager will use the master document for planning and implementation sequencing.

Specific discrepancies (master vs. chunk):

| Story | Master Says | Chunk Says | Product Plan |
|-------|------------|------------|-------------|
| PIPE-04 (Risk Assessment) | P0, Phase 2 | P0, Phase 3a | Phase 3a |
| KB-01 (Upload KB Docs) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| KB-02 (KB Versioning) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| KB-03 (KB Search/Query) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| THRESHOLD-01 (View Thresholds) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| THRESHOLD-02 (Update Thresholds) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| THRESHOLD-03 (Threshold Safety) | P1, Phase 3a | P2, Phase 5 | P2, Phase 5 |
| DEPLOY-01 (Containerized App) | P0, Phase 1 | P2, Phase 5 | Phase 1 (implied by "self-contained local dev") |
| DEPLOY-03 (Health Checks) | P0, Phase 1 | P2, Phase 5 | Phase 1 (implied by "self-contained local dev") |
| DEPLOY-02 (Helm Chart) | P1, Phase 5 | P2, Phase 5 | P2, Phase 5 |
| DEPLOY-04 (CI Pipeline) | P1, Phase 5 | P2, Phase 5 | P2, Phase 5 |
| REV-05 (Request Additional Docs) | P1, Phase 4 | P0, Phase 4 | P0, Phase 4 |
| REV-06 (Resubmission Cycle) | P1, Phase 4 | P0, Phase 4 | P0, Phase 4 |
| DOC-05 (Additional Doc Request) | P1, Phase 4 | P2, Phase 4 | Not explicitly listed |
| DX-04 (title mismatch) | "Quickstart Tutorial Guide", P1, Phase 5 | "Architecture Documentation with System Diagram", P0, Phase 1 | Phase 1 docs implied |

**Action required:** Reconcile the master document story map with the actual chunk files. For stories where the chunk file and product plan disagree (DEPLOY-01, DEPLOY-03), make a stakeholder decision on which is correct.

**C-2: DEPLOY-01 (Containers) and DEPLOY-03 (Health Checks) phase conflict between chunk and product plan**

The product plan's Phase 1 description says "Developers can run the system locally with a single setup command" and the self-contained local dev setup (P0) implies containerized deployment and health checks are Phase 1 infrastructure. However, chunk 4 assigns both DEPLOY-01 and DEPLOY-03 as P2 Phase 5.

This is a genuine conflict, not just a typo. The product plan requires `make setup && make dev` to work from Phase 1, which requires Containerfiles and health checks. But the chunk 4 author classified them as P2 polish items.

**Action required:** Stakeholder decision. The product plan's Phase 1 capability milestone requires containers and health checks. Recommend: DEPLOY-01 and DEPLOY-03 should be P0 Phase 1 per the product plan.

### Warning

**W-1: AUDIT-04 (Query Audit Events) has no detailed acceptance criteria in any chunk file**

The master document lists AUDIT-04 as "P0, Phase 1, (index entry -- sub-resource of APP-03)" but no chunk file contains its detailed Given/When/Then acceptance criteria. Chunk 2 references it ("specified in AUDIT-04, Chunk 1") and Chunk 4 cross-references it, but Chunk 1 only covers AUDIT-01 through AUDIT-03.

This means a P0 Phase 1 story has no acceptance criteria, which would block its implementation and testing.

**W-2: No UI-specific acceptance criteria for the "Loan processing dashboard" (P0 product plan feature)**

The product plan lists "Loan processing dashboard (P0)" with specific capabilities: "application list, application detail with all agent analyses, review queue with filtering by priority and status, and workflow progress visualization." The requirements cover all of these via API stories (APP-02, APP-03, REV-01, REV-02), but there are no UI-specific acceptance criteria.

For an API-first system this may be acceptable, but the product plan explicitly calls out UI capabilities. At minimum, the Technical Design should note that dashboard stories are covered by the API ACs and the UI implements those APIs.

**W-3: KB and THRESHOLD stories have a dependency conflict if left at Phase 5**

The product plan Phase 3a says "Regulatory compliance verification (P0)" which includes "RAG-based regulatory verification." For the compliance checker (PIPE-05, Phase 3a) to perform RAG-based verification, it needs the knowledge base (KB-01/02/03). But the chunks assign KB stories to Phase 5.

Similarly, the aggregator/router (PIPE-06) references configurable thresholds from Phase 2 onward, but THRESHOLD stories are Phase 5 in the chunks.

This creates a chicken-and-egg problem: Phase 3a features depend on Phase 5 features. The master document's assignment of KB and THRESHOLD to Phase 3a was likely an attempt to fix this, but it contradicts the chunks and the product plan.

**Action required:** Stakeholder decision on one of:
- (a) Move KB-01/02/03 to Phase 3a as prerequisites for PIPE-05 (elevate to P1)
- (b) Have PIPE-05 work without RAG in Phase 3a (hardcoded regulatory rules) and add RAG in Phase 5
- (c) Keep Phase 5 assignment and have PIPE-06 use hardcoded thresholds until Phase 5

**W-4: Phase breakdown counts in master document are likely incorrect**

Given the 14+ phase/priority errors in the story map, the phase breakdown table at the bottom of the master document (Phase 1: 28 P0, Phase 2: 14 P0, etc.) does not reflect the actual chunk file assignments. This table needs to be recalculated after C-1 corrections.

**W-5: "Email Notifications" mock listed in product plan has no requirement stories**

The product plan lists "Email Notifications" as a mocked service that "Logs 'email sent' events to console and database." No requirement story specifies when email notifications are triggered or what they contain. If this is intentionally deferred, it should be noted. If it's a gap, it needs a story.

### Suggestion

**S-1: Add a "How to Use This Document" section for downstream agents**

The multi-file structure (master + 4 chunks) is practical for a 4,700+ line requirements document, but downstream agents (Tech Lead, Project Manager, implementers) need explicit guidance:
- Master document: use for story map, cross-cutting concerns, dependencies, and phase planning
- Chunk files: use for detailed acceptance criteria when implementing a specific story
- When a story spans chunks (e.g., DOC stories in chunks 2 and 4), both files must be consulted

**S-2: Reconcile DX-04 title and scope**

The master document calls DX-04 "Quickstart Tutorial Guide" (P1, Phase 5) while chunk 1 calls it "Architecture Documentation with System Diagram" (P0, Phase 1). These appear to be two different stories collapsed into one ID. Consider whether DX-04 should remain the chunk 1 version (architecture docs, Phase 1) and a new DX-05 should be created for the quickstart tutorial (Phase 5), or vice versa.

**S-3: Verify story count total**

The master document claims 95 stories and 454 ACs. The chunk totals (25+25+17+28=95) match for stories. The AC counts should be independently verified since the chunk introductions may have been written before final ACs were added. A quick recount during correction of C-1 would confirm accuracy.

### Positive

**P-1: Chunk files are exceptionally thorough and consistent**

All four chunk files maintain consistent formatting (Given/When/Then, Notes with cross-references, trailing sections for NFRs/open questions/assumptions). The 454 acceptance criteria cover happy paths, error paths, edge cases, authorization checks, and concurrent operation scenarios. The chunk authors clearly coordinated on conventions.

**P-2: Architecture consistency notes are a valuable downstream signal**

The four architecture consistency notes in chunk 2 (review queue sorting, document upload status constraint, fraud flag routing in Phase 2, compliance checker parallel timing) are precisely the kind of observations that prevent Technical Design errors. These should be carried forward into the TD as explicit resolution items.

**P-3: Cross-cutting sections in the master document are well-organized**

The merged NFRs (categorized by concern area), merged open questions (numbered and attributed to source chunks), merged assumptions (grouped by chunk), and coverage validation table provide an excellent single-source-of-truth for cross-cutting concerns. The data flow trace with story cross-references is particularly valuable for understanding the end-to-end system.

**P-4: Open questions are appropriately scoped**

All 12 open questions are correctly deferred to Technical Design rather than being resolved speculatively in the requirements. They cover the right boundary -- questions about implementation strategy (cache policy, endpoint structure, CI platform) rather than about product scope.
