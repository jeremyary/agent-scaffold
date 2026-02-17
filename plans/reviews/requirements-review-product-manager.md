# Requirements Review: Product Manager

**Artifact:** Requirements (hub + 5 chunks)
**Reviewer:** Product Manager
**Date:** 2026-02-16
**Verdict:** REQUEST_CHANGES

## Summary

The requirements document is structurally strong -- the hub/chunk architecture scales well for 125 stories, cross-cutting concerns are well-factored, and Given/When/Then acceptance criteria are present for every story. Edge case coverage is notably thorough, with adversarial inputs, service unavailability, and concurrent operation scenarios consistently addressed.

However, there are significant issues that must be resolved before this artifact is ready for downstream consumption:

1. **Feature ID remapping** creates a persistent confusion layer between the product plan and requirements. Multiple product plan features were absorbed, split, or renumbered without an explicit mapping table, meaning downstream agents will misinterpret feature references.

2. **Two product plan capabilities are missing stories entirely**: consent/disclosure logging (product plan F15) and audit data export (product plan F15). These are not minor gaps -- Flow 2 step 8 explicitly describes individual disclosure acknowledgment, and the product plan describes export as a key audit trail capability.

3. **Story count discrepancies** between chunk headers and actual content undermine trust in the document's self-consistency.

4. **Scope narrowing** on F6 (Application Status and Timeline Tracking) and F13 (CEO Conversational Analytics) reduces two prominent product plan features to subsets of their intended scope.

The acceptance criteria quality, when coverage exists, is excellent. The cross-cutting concerns (REQ-CC-01 through REQ-CC-22) are precisely defined and well-factored. The HMDA isolation and agent security models are particularly well specified.

## Findings

### Critical

**C-1: Consent/disclosure logging and audit export have no stories**

- **Location:** Product plan F15 (Comprehensive Audit Trail); absent from all chunks
- **Description:** The product plan's F15 explicitly lists five audit trail capabilities: decision traceability, override tracking, data provenance, consent/disclosure logging, and export capability. The requirements cover the first three but have zero stories or acceptance criteria for the last two. Specifically:
  - **Consent/disclosure logging:** Product plan states "When a borrower acknowledges disclosures (Loan Estimate, privacy notice, HMDA notice, equal opportunity notice), the audit trail records the timestamp and the specific disclosures presented." Flow 2 step 8 describes this interaction in detail. No story in any chunk covers this.
  - **Export capability:** Product plan states "Audit data can be exported for external analysis. Regulators and auditors need to analyze data in their own tools." No story covers audit export in any format (CSV, JSON, or other).
- **Impact:** Consent/disclosure logging is directly demonstrated in user Flow 2 and is a regulatory compliance requirement. Audit export is called out as a key stakeholder need (regulators need external analysis tools). Both gaps represent missing product plan scope, not optional enhancements.
- **Suggested Resolution:** Add at minimum 2 stories: (1) Borrower acknowledges disclosures during application process, with timestamps and disclosure identifiers logged to audit trail. (2) Authorized user (CEO, Underwriter) exports audit trail data for a given application or time range. These naturally belong in chunk 2 (consent during application) and chunk 5 (export from audit trail UI).

**C-2: F13 CEO Conversational Analytics covers only audit trail access, not business analytics drill-down**

- **Location:** `requirements-chunk-5-executive.md`, stories S-5-F13-01 through S-5-F13-05
- **Description:** The product plan's F13 describes conversational drill-down on business data: "How many loans does James have in underwriting?", "What is our pull-through rate this quarter vs. last?", "Show me turn times for the conditions clearing stage", "What percentage of applications are denied and what are the top reasons?", "Are there any disparate impact concerns in our denial rates?" All five F13 stories in the requirements are exclusively about audit trail queries (application-centric, decision-centric, pattern-centric search + backward tracing + PII masking). The business analytics drill-down -- the primary purpose of the product plan's F13 -- has no dedicated stories with acceptance criteria.
- **Impact:** The CEO conversational analytics is the product plan's key differentiator for the executive persona. Without business analytics stories, the CEO has a visual dashboard (F12) and audit trail access but no conversational AI capability for the questions demonstrated in Flow 6 (steps 3-8). Flow 6 is the most prominent CEO demonstration flow.
- **Suggested Resolution:** Add 3-4 stories: (1) CEO asks pipeline/performance questions answered by aggregate data (Flow 6 steps 3-6). (2) CEO asks comparative questions ("this quarter vs. last"). (3) CEO asks about a specific LO or application by name (Flow 6 step 10). (4) CEO asks fair lending questions answered by HMDA aggregate data (Flow 6 steps 7-8). Consider splitting F13 into two feature groups: business analytics and audit trail access.

### Warning

**W-1: Feature ID remapping between product plan and requirements is undocumented**

- **Location:** Hub document `requirements.md`, Coverage Validation Table (lines 477-508)
- **Description:** The Requirements Analyst reorganized product plan features into different groupings without providing a mapping table. Key remappings:

  | Product Plan Feature | Requirements Feature | What Happened |
  |---------------------|---------------------|---------------|
  | F2 (Prospect Affordability/Pre-Qualification) | Absorbed into F1 | F2 content merged into F1 stories S-1-F1-02, S-1-F1-03 |
  | F3 (Borrower Auth + Personal Assistant) | Split to F2 (auth) + F3 (intake) | Auth extracted from F14, borrower assistant merged with F4 |
  | F4 (Mortgage Application Workflow) | Became F3 (conversational intake) | Renumbered; document upload split to new F4 |
  | F5 (Document Upload and Analysis) | Split to F4 (upload) + F5 (extraction) | Upload and extraction separated |
  | F6 (Application Status + Timeline) | Narrowed to F6 (Document Completeness) | Status/timeline capability significantly reduced |
  | F11 (Decision + Conditions Workflow) | Split to F11 (Compliance Checks) + F16 (Conditions) + F17 (Decisions) | Good decomposition, but F11 ID now means something entirely different |
  | F13 (CEO Conversational Analytics) | Narrowed to F13 (Audit Trail Access) | Business analytics drill-down lost (see C-2) |
  | F17 (Regulatory Awareness/TRID) | Became F17 (Underwriting Decisions) | TRID disclosure generation lost (orchestrator flagged this as C-2) |
  | F26 (Adverse Action Notices) | Absorbed into F17 stories | F26 ID repurposed for Agent Adversarial Defenses |

  The Coverage Validation Table (line 477+) claims all 30 P0 features are covered, but the feature names in that table are the *requirements* feature names, not the product plan feature names. When a downstream agent looks up "F2" expecting affordability/pre-qualification content, they will find authentication stories.

- **Impact:** Every downstream agent (Tech Lead, Project Manager, implementers) will reference features by the product plan IDs they have already read. The silent remapping will cause persistent confusion, misassigned work, and scope drift throughout the SDD lifecycle.
- **Suggested Resolution:** Add a "Product Plan Feature Mapping" table to the hub document that explicitly maps each product plan feature ID to the corresponding requirements feature IDs and story ranges. Example: "Product Plan F4 (Mortgage Application Workflow) -> Requirements F3 (S-2-F3-01 to S-2-F3-05) + F4 (S-2-F4-01 to S-2-F4-04)". This does not require renumbering -- just documenting the translation.

**W-2: Story count discrepancies between chunk headers and actual content**

- **Location:** Chunk 1 header (line 20), Chunk 2 header (line 5), Chunk 4 header (line 8)
- **Description:** Three chunk files have incorrect story counts in their header metadata:

  | Chunk | Header Claims | Actual Story Count (via `### S-` headers) | Hub Claims |
  |-------|--------------|------------------------------------------|------------|
  | Chunk 1 (Foundation) | 26 stories | 32 stories | 32 stories |
  | Chunk 2 (Borrower) | 24 stories | 31 stories | 31 stories |
  | Chunk 4 (Underwriting) | 28 user stories | 31 stories | 31 stories |

  The hub's counts and the actual `### S-` header counts agree (32+31+11+31+20 = 125). Only the chunk header text is wrong. For Chunk 2, the per-feature breakdown in the header (5+4+4+3+5+4+3+3) sums to 31, contradicting its own "24 stories" claim on the same page.

- **Impact:** Low functional impact (the stories themselves are present and complete), but undermines document credibility and creates confusion for anyone checking consistency. A reviewer or downstream agent seeing "26 stories" in the header but counting 32 will waste time investigating.
- **Suggested Resolution:** Update the header text in chunks 1, 2, and 4 to match the actual story counts (32, 31, 31 respectively).

**W-3: F6 (Application Status and Timeline Tracking) narrowed to document completeness only**

- **Location:** `requirements-chunk-2-borrower.md`, F6 stories S-2-F6-01 through S-2-F6-03
- **Description:** The product plan's F6 describes a broad capability: "Borrowers can see the current status of their application at any time, including pending conditions from underwriting and rate lock status. The AI assistant can explain what stage the application is in, what is happening at that stage, what the borrower should expect next, estimated timelines, and any outstanding conditions that require their action. The assistant demonstrates awareness of regulatory timing requirements (Reg B 30-day notification, TRID LE delivery timing)."

  The requirements reframed F6 as "Document Completeness and Proactive Requests." The three stories cover: (1) agent identifies missing documents, (2) agent proactively requests missing documents, (3) agent flags outdated documents. Application status explanation, stage timeline, what-to-expect-next, and regulatory timing awareness are absent as dedicated stories.

  A search across chunk 2 finds incidental mentions of application status (e.g., S-2-F19-03 includes a "What is my application status?" test case for conversation memory, and S-2-F28-03 mentions condition satisfaction status), but none of these constitute dedicated acceptance criteria for the status tracking capability itself.

- **Impact:** Application status tracking is demonstrated in product plan Flow 3 as a primary returning-borrower scenario. Sarah asks "What is the status of my application?" and receives a detailed response about conditional approval, outstanding conditions, and next steps. Without dedicated acceptance criteria, this user flow has no testable specification.
- **Suggested Resolution:** Add 1-2 stories to chunk 2: (1) Borrower asks application status and receives current stage, pending actions, estimated timeline, and next steps. (2) Agent proactively notes approaching regulatory deadlines when relevant (Reg B, TRID timing). These can be added to the existing F6 section or as a new status-tracking group.

**W-4: Architecture leakage -- technology names embedded in acceptance criteria**

- **Location:** All chunks, but most concentrated in chunk 1 (78 technology references) and chunk 5 (45 references)
- **Description:** Requirements should describe WHAT the system does, not HOW. However, the acceptance criteria frequently reference specific implementation technologies:
  - **Chunk 1:** Keycloak (OIDC, JWKS, realm import), LangFuse (callbacks, dashboard), PostgreSQL (advisory locks, schemas, roles like `lending_app`/`compliance_app`), FastAPI, Alembic (migrations), TanStack Router, ClickHouse
  - **Chunk 2:** PostgreSQL (advisory locks, `audit_events` table, `document_extractions` table, `bigserial`), `source_document_id` column names
  - **Chunk 4:** LangGraph (pre-tool node), pgvector
  - **Chunk 5:** Keycloak, LangFuse (API proxy), Helm charts, LlamaStack, MinIO/ODF

  Examples of architecture leakage in acceptance criteria:
  - "the gateway verifies the token signature against Keycloak's JWKS" (S-1-F2-01)
  - "computed under PostgreSQL advisory lock" (REQ-CC-09 in hub)
  - "stored in the document_extractions table with source_document_id" (S-2-F5-01)
  - "LangFuse callback handler" (S-1-F18-01)

  Some of this is understandable given that the architecture document already made these technology choices and the requirements analyst was writing against it. However, per the review-governance checklist: "Requirements describe WHAT the system does, not HOW. No technology choices, component assignments, or data model decisions."

- **Impact:** Technology-coupled acceptance criteria become brittle if the Architect or Tech Lead needs to change an implementation approach. Requirements should be testable against the user-visible behavior, not against specific technology internals. A requirement like "the system verifies token signatures using the identity provider's public keys" is equivalent but technology-neutral.
- **Suggested Resolution:** This is a pervasive pattern (160+ references across all files) and a full rewrite would be disproportionate effort. Recommended approach: (1) Add a note to the hub document acknowledging that acceptance criteria reference architecture-specific technologies for precision, and that these should be interpreted as "the chosen implementation for the architecture decisions in `architecture.md`" rather than as requirements-level mandates. (2) For the most egregious cases (table names, column names, connection pool names in acceptance criteria), soften the language to describe the behavior rather than the implementation.

### Suggestion

**S-1: Add a "Product Plan Feature Mapping" section to the hub**

- **Location:** `requirements.md`, after the Coverage Validation Table
- **Description:** Even after resolving W-1, a cross-reference table showing the bidirectional mapping between product plan feature IDs and requirements feature IDs would significantly help downstream agents navigate between documents. This is especially important because the product plan has been the reference document for all prior SDD phases and the feature IDs are well-established.
- **Suggested Resolution:** Add a table with columns: Product Plan Feature ID, Product Plan Feature Name, Requirements Feature IDs, Requirements Story IDs. This would make the remapping explicit and traceable rather than implicit and confusing.

**S-2: Consider explicit "simulated for demonstration" markers on regulatory acceptance criteria**

- **Location:** Chunk 4 (F10, F11), Chunk 2 (HMDA collection in F3)
- **Description:** The product plan and cross-cutting concern REQ-CC-17 require a regulatory disclaimer on all compliance content. However, the acceptance criteria themselves sometimes read as if they describe legally accurate regulatory requirements (e.g., "Loan Estimate must be delivered within 3 business days of application" in S-4-F11-03). Adding a note to each compliance feature section stating "All regulatory references in these acceptance criteria describe simulated behavior for demonstration purposes" would reinforce this boundary.
- **Suggested Resolution:** Add a brief note at the top of F10 and F11 sections clarifying that regulatory references are demonstration-grade, consistent with REQ-CC-17.

**S-3: Hub dependency map should note which dependencies are data-only vs. behavioral**

- **Location:** `requirements.md`, Inter-Feature Dependency Map (lines 391-418)
- **Description:** The dependency map lists 25+ feature dependencies but does not distinguish between data dependencies (F12 needs data from F17 decisions) and behavioral dependencies (F5 extraction pipeline must invoke the F25 demographic filter). This distinction matters for the Tech Lead and Project Manager when determining implementation ordering and parallelism.
- **Suggested Resolution:** Add a "Type" column to the dependency table with values like "data" (feature produces data consumed by dependent), "behavioral" (feature invokes dependent's logic), or "infrastructure" (feature requires dependent's service to be running).

### Positive

**P-1: Cross-cutting concerns are precisely defined and testable**

The 22 REQ-CC requirements in the hub are the strongest part of this document. The four-stage HMDA isolation (REQ-CC-05 through REQ-CC-07), three-layer RBAC enforcement (REQ-CC-01 through REQ-CC-04), and four-layer agent security (REQ-CC-12 through REQ-CC-14) are each specified with enough precision to write tests against without ambiguity. The CI lint check for HMDA isolation (REQ-CC-06) and database-level verification test (REQ-CC-07) are particularly good -- they are machine-verifiable exit conditions built into the requirements.

**P-2: Edge case and adversarial scenario coverage is consistently strong**

Every feature section includes adversarial inputs (prompt injection attempts), service unavailability scenarios (LlamaStack down, Keycloak unreachable), concurrent operation edge cases (two underwriters reviewing the same application), and boundary conditions (empty pipeline, expired tokens, zero applications). This depth is unusual and valuable -- it significantly reduces the risk of missed edge cases during implementation.

**P-3: Application state machine is well-defined and consistently referenced**

The state machine in the hub (9 states, 10 transitions, role permissions per transition) is referenced accurately throughout all chunks. Stories correctly enforce which roles can trigger which transitions, and the state transition audit requirement is consistently applied.

**P-4: Co-borrower support is properly specified**

Chunk 2 includes co-borrower scenarios in the application intake stories (S-2-F3-02), which addresses a product plan requirement that could easily have been overlooked in the conversational intake flow.

**P-5: The hub/chunk architecture is effective for this document size**

125 stories across 5 chunks with a central hub providing the index, state machine, cross-cutting concerns, and coverage validation is a well-designed information architecture. Each chunk is self-contained with clear cross-references. The hub's dependency map and phase breakdown provide sufficient context for any agent to understand how their chunk relates to the whole.
