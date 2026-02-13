# Requirements Review -- Architect

**Reviewer:** Architect
**Document reviewed:** `plans/requirements.md`
**Cross-referenced:** `plans/product-plan.md`, `CLAUDE.md`, `.claude/rules/domain.md`
**Date:** 2026-02-12

---

## Review Methodology

This review cross-references every product plan feature (22 P0, 2 P1, 7 P2) against the requirements document's 73 user stories. For each feature, I verified that corresponding stories exist, that acceptance criteria are testable and architecturally feasible, and that phase mappings align with the product plan.

---

## 1. Completeness -- Feature-to-Story Mapping

### P0 Features (22 Must Have)

| # | Product Plan Feature | Covered By | Status |
|---|---------------------|-----------|--------|
| 1 | Supervisor-worker agent orchestration | US-001 through US-007 | Covered |
| 2 | Document processing agent | US-008 through US-012 | Covered |
| 3 | Credit analysis agent | US-013 | Covered |
| 4 | Risk assessment agent | US-014 through US-017 | Covered |
| 5 | Compliance checking agent | US-018 through US-020 | Covered |
| 6 | Confidence-based routing | US-005, US-023 | Covered |
| 7 | Immutable audit trail | US-021 | Covered |
| 8 | Human-in-the-loop review workflow | US-028 through US-032 | Covered |
| 9 | Role-based access control | US-059 | Covered |
| 10 | API key authentication | US-058, US-060 | Covered |
| 11 | Loan application management | US-053, US-054, US-056 | Covered |
| 12 | Loan officer dashboard | US-055, US-057 | Covered |
| 13 | Database schema and migrations | US-073 | Partial -- see F1 |
| 14 | Health checks | US-067 | Covered |
| 15 | Developer setup experience | US-068, US-069 | Covered |
| 16 | Fraud detection agent | US-024 through US-027 | Covered |
| 17 | Denial coaching agent | US-033 through US-036 | Covered |
| 18 | Intake agent (public chat) | US-037, US-038, US-041 | Covered |
| 19 | Mortgage calculator | US-045 through US-052 | Covered |
| 20 | Public access tier with rate limiting | US-042 through US-044 | Covered |
| 21 | External data integration | US-061 through US-063 | Covered |
| 22 | Audit trail export | US-022 | Covered |

### P1 Features (2 Should Have)

| # | Product Plan Feature | Covered By | Status |
|---|---------------------|-----------|--------|
| 1 | Streaming chat responses | Not found | MISSING -- see F2 |
| 2 | LLM observability dashboard | US-066 | Covered |

### P2 Features (7 Could Have)

| # | Product Plan Feature | Covered By | Status |
|---|---------------------|-----------|--------|
| 1 | Cross-session chat context | Not found | MISSING -- see F2 |
| 2 | Admin configuration interface | Not found | MISSING -- see F2 |
| 3 | Portfolio analytics dashboard | Not found | MISSING -- see F2 |
| 4 | Seed data with diverse test cases | US-070 | Covered |
| 5 | Container deployment manifests | Not found | MISSING -- see F2 |
| 6 | CI pipeline | Not found | MISSING -- see F2 |
| 7 | API key lifecycle management | Not found | MISSING -- see F2 |

---

## 2. Findings

### F1: Database schema feature has no dedicated story for schema design

- **Severity:** Warning
- **Section:** Feature mapping -- P0 "Database schema and migrations"
- **Finding:** The product plan lists "Database schema and migrations" as a distinct P0 feature: "Schema supporting applications, documents, agent decisions, audit events, workflow state, and user roles. Idempotent migrations with rollback support." The requirements document has US-073 (migration idempotency and rollback), which covers the operational aspect, but there is no user story that specifies the schema itself -- what tables exist, what relationships are required, what data types the schema must support. US-021 covers the audit trail table's immutability, and individual stories reference database records (e.g., US-053 says "Creates application record in database"), but there is no story that ensures the schema as a whole supports all required entities. This matters architecturally because the schema is a foundational Phase 1 artifact that every subsequent story depends on. Without a dedicated story, there is no acceptance criterion to verify that the schema is complete before building on top of it.
- **Recommendation:** Add a user story (or expand US-073) that explicitly requires the database schema to include tables for: applications, documents, agent decisions, audit events, workflow checkpoints, user/role mappings, and configuration (thresholds). Acceptance criteria should include a migration that creates the schema and a verification that all required tables exist.

### F2: Six product plan features have no corresponding user stories

- **Severity:** Critical
- **Section:** P1 and P2 feature mapping
- **Finding:** The following product plan features have no user stories in the requirements document:
  1. **Streaming chat responses (P1)** -- The product plan describes incremental delivery of chat responses so users see text appearing in real time. No story covers this. The requirements document's summary claims "2 P1 stories" but US-066 (LLM observability) is the only P1 story. The second P1 story is unaccounted for.
  2. **Cross-session chat context (P2)** -- Authenticated users referencing prior conversations. No story.
  3. **Admin configuration interface (P2)** -- Web interface for threshold/knowledge base management. No story. (US-023 covers the API for threshold configuration but not the web interface.)
  4. **Portfolio analytics dashboard (P2)** -- Aggregate views of processing metrics. No story.
  5. **Container deployment manifests (P2)** -- Deployment configuration for container platforms. No story.
  6. **CI pipeline (P2)** -- Continuous integration with tests, linting, vulnerability scanning. No story.
  7. **API key lifecycle management (P2)** -- Key generation, revocation, expiration. No story.

  The summary statistics claim "P1 Stories: 2" but only 1 P1 story (US-066) is present. For P2, the summary claims "5 stories" but only US-070 is present (plus the 4 cross-cutting stories US-071 through US-073, but those are labeled "All Phases" not P2).

  While P2 features are "Could Have" and lower priority, the requirements document should still have stories for them to maintain traceability. Otherwise, when Phase 4 work begins, there are no acceptance criteria to build against, and the features will either be skipped or implemented ad hoc.
- **Recommendation:** Add user stories for all seven missing features. They can be lighter-weight (fewer edge cases) given their P1/P2 priority, but each needs at least a happy-path acceptance criterion and phase mapping. Correct the summary statistics to match actual counts.

### F3: Summary statistics are inaccurate

- **Severity:** Warning
- **Section:** Summary Statistics
- **Finding:** The summary claims "Total User Stories: 73" but the document contains stories US-001 through US-073, which is 73 stories. However, the breakdown does not add up:
  - P0: 66 claimed. Counting P0 stories: US-001 through US-065, US-067, US-068, US-069 = 69 stories. But US-071, US-072, US-073 are labeled "All Phases" with no priority, and US-070 is P2. The actual P0 count appears to be around 65-66 if the cross-cutting stories (US-071 through US-073) are counted as P0.
  - P1: 2 claimed, but only US-066 is P1. Where is the second?
  - P2: 5 claimed, but only US-070 is explicitly P2. The cross-cutting stories (US-071, US-072, US-073) have no priority label.
  - Phase totals: 13 + 22 + 14 + 16 + 3 + 5 = 73. The cross-cutting stories (5) are counted separately from phase assignments. But the actual phase assignments of individual stories would need to be verified.

  Inaccurate summary statistics undermine confidence in the document's completeness.
- **Recommendation:** Recount all stories. Assign explicit priority labels (P0/P1/P2) to the cross-cutting stories US-071, US-072, US-073. Verify the phase breakdown adds up to the total. Fix any discrepancies.

### F4: US-058 API key format prescribes architecture

- **Severity:** Warning
- **Section:** US-058 -- API Key Authentication
- **Finding:** Acceptance criterion 1 states: "All protected endpoints require Authorization header with format: `Bearer <role>:<key>`." This prescribes a specific token format that embeds the role in the client-presented token. This is an architectural decision, not a testable requirement. It constrains the architecture to either: (a) parsing the role from the token (client-asserted role, which is insecure), or (b) using the format as a convention while independently mapping the key to a role server-side (in which case the `<role>:` prefix is misleading). My product plan review (F6) flagged this as needing architectural resolution.

  The requirement should specify the behavior (endpoints require valid API keys, keys map to roles server-side) without prescribing the token format. The format is an implementation detail that belongs in the technical design.
- **Recommendation:** Rewrite AC-1 to: "All protected endpoints require an Authorization header with a Bearer token." Add AC: "The server maps each API key to a role; the role is not client-asserted." Remove the specific `<role>:<key>` format from the requirement; let the tech lead define the token format.

### F5: US-011 PII redaction acceptance criteria are not testable as written

- **Severity:** Warning
- **Section:** US-011 -- PII Redaction Before External LLM Calls
- **Finding:** AC-1 says "Detects PII fields in documents: SSN, date of birth, bank account numbers, addresses." AC-2 says "Redacts PII from document images using local pre-processing pipeline before sending to external LLM." AC-6 says "Pending: [Open Question #9 -- PII redaction approach]."

  The problem: AC-2 prescribes "local pre-processing pipeline" as the mechanism, but AC-6 says the approach is pending. These are contradictory. Furthermore, "Detects PII fields in documents" is not testable without specifying the detection mechanism -- it could mean OCR + regex, NER model, vision model, or manual annotation.

  Additionally, AC-5 ("Redaction process does not alter non-PII content") is extremely difficult to verify for image redaction -- how do you prove that blacking out a region on an image did not affect adjacent text? This criterion sets an impossibly high bar for MVP testing.
- **Recommendation:** Remove the mechanism ("local pre-processing pipeline") from AC-2 since the approach is pending per OQ-9. Rewrite AC-2 as: "PII is not present in the data sent to external LLM services." This makes it testable (inspect the outbound payload) without constraining the approach. Soften AC-5 to: "Redaction preserves the ability to extract non-PII fields from the document" -- this is testable by comparing extraction results before and after redaction.

### F6: US-041 sentiment analysis testability

- **Severity:** Suggestion
- **Section:** US-041 -- Sentiment Analysis and Tone Adjustment
- **Finding:** AC-5 states "Tone adjustment is subtle and natural, not jarring." This is subjective and not testable by machine. For MVP, the sentiment analysis feature should have acceptance criteria that can be verified programmatically.
- **Recommendation:** Replace AC-5 with: "Response metadata includes the detected sentiment classification, enabling downstream verification." This is testable (check the response metadata) and allows human review of tone quality during manual testing without making it a blocking acceptance criterion.

### F7: US-009 and US-010 phase mismatch with product plan

- **Severity:** Warning
- **Section:** US-009, US-010 -- Document Classification and Data Extraction (Phase 2)
- **Finding:** US-009 and US-010 are mapped to Phase 2, which aligns with the product plan's Phase 2 ("Core AI Agents" -- document processing agent). However, US-011 (PII redaction) is also mapped to Phase 2. The product plan's Phase 2 risk section says "PII redaction from document images is architecturally complex and may require a dedicated design spike." If PII redaction blocks document processing (because the requirement says documents must be redacted BEFORE being sent to external LLMs), then a PII redaction delay blocks all of Phase 2's document processing stories. This is a dependency that is not visible in the requirements document.
- **Recommendation:** Add a note to US-009 and US-010 that they have a dependency on US-011 (or on a decision from OQ-9). Alternatively, add an acceptance criterion to US-009/US-010 that specifies behavior when the PII redaction mechanism is not yet available (e.g., "If redaction is unavailable, document processing logs a warning and proceeds with text-only extraction to local models only").

### F8: Missing transient failure retry requirements

- **Severity:** Warning
- **Section:** Product plan NFR -- Reliability
- **Finding:** The product plan's Reliability NFRs state: "Transient failures in external AI services are retried automatically rather than immediately failing the workflow." No user story covers retry behavior for LLM API calls. This is a cross-cutting concern that affects every agent story (US-009, US-010, US-013, etc.) but is not specified anywhere in the requirements. Without an explicit requirement, implementers will either: (a) implement ad-hoc retry in each agent, leading to inconsistency, or (b) not implement retry at all.
- **Recommendation:** Add a cross-cutting user story or add retry behavior to US-072 (Graceful Degradation): "When an external LLM API call fails with a transient error (429, 502, 503, 504), the system retries with exponential backoff (max 3 retries). Permanent failures (400, 401, 403) are not retried. Retry events are logged with attempt number and error code."

### F9: US-053 accepts SSN in request body without specifying encryption

- **Severity:** Warning
- **Section:** US-053 -- Create Loan Application
- **Finding:** AC-1 states the endpoint accepts "SSN (encrypted at rest)" but does not specify how the SSN is handled in transit or in the application layer. The parenthetical "(encrypted at rest)" describes a database concern, but the acceptance criterion is about the API endpoint. There is no criterion that says the SSN must not be logged, must not appear in error responses, and must be validated for format. The domain rules (`.claude/rules/domain.md`) say "SSN... are PII. Never log, cache in plaintext, or include in error responses," but this is not reflected in the story's acceptance criteria.
- **Recommendation:** Add acceptance criteria: "SSN is validated for format (9 digits or XXX-XX-XXXX)." "SSN is never included in log output, error responses, or API response bodies." "SSN is stored encrypted at rest in the database." These make the PII handling testable at the API boundary, not just at the database layer.

### F10: US-028 review queue role mapping may constrain architecture

- **Severity:** Suggestion
- **Section:** US-028 -- Review Queue Assignment
- **Finding:** AC-2 states: "Queue is filtered by required role: MEDIUM confidence -> loan_officer, LOW confidence -> senior_underwriter." This hardcodes the mapping between confidence level and required reviewer role in the requirement. If this mapping needs to be configurable (as US-023 allows for thresholds), the queue assignment logic should reference the configured thresholds, not fixed mappings. The product plan says thresholds are configurable but does not explicitly say the role-to-confidence mapping is configurable.

  This is not necessarily a problem -- the three-role hierarchy is a stakeholder mandate -- but hardcoding "MEDIUM -> loan_officer" in the requirement means the architecture must either implement it exactly as stated or request a requirements change if the design calls for a more flexible approach.
- **Recommendation:** Clarify whether the confidence-to-role mapping is fixed (acceptable for MVP) or should be part of the configurable threshold system. If fixed, document it as a design constraint. If configurable, add it to US-023.

### F11: Phase 3b stories are all P0 -- no room for descoping

- **Severity:** Suggestion
- **Section:** Phase 3b stories (US-037 through US-052, US-061 through US-063)
- **Finding:** Every story in Phase 3b is marked P0 (Must Have). This includes 16 stories covering the intake agent, mortgage calculator (8 stories), rate limiting, prompt injection, and external data integration. Given that Phase 3b is the third-to-last phase and introduces an entirely new subsystem (public access), marking everything P0 leaves no room for descoping if the project falls behind schedule. The mortgage calculator alone has 8 P0 stories (US-045 through US-052). If any of these are dropped, the project fails its completion criteria because all P0 features are required.

  The product plan classifies "streaming chat responses" as P1, but the requirements document is missing that story entirely (see F2). Some Phase 3b features (e.g., scenario comparison mode US-050, amortization schedule US-049) could reasonably be P1 without undermining the quickstart's core value.
- **Recommendation:** Consider reclassifying some Phase 3b calculator stories as P1: US-049 (Amortization Schedule) and US-050 (Scenario Comparison Mode) are impressive features but not essential for demonstrating the core multi-agent patterns. This provides schedule buffer. Alternatively, if the stakeholder insists on all calculator features as P0, acknowledge this as a scheduling risk.

### F12: Cross-cutting stories lack phase assignments

- **Severity:** Suggestion
- **Section:** US-071, US-072, US-073
- **Finding:** The cross-cutting stories (US-071 Performance Targets, US-072 Graceful Degradation, US-073 Migration Idempotency) are labeled "All Phases" but have no specific phase assignment. This means there is no clear point where these requirements are verified. Performance targets (US-071) cannot be meaningfully tested until Phase 2 (when real agents exist) but the requirement says "All Phases." Migration idempotency (US-073) should be verified from Phase 1 onward.
- **Recommendation:** Assign a "first verifiable phase" to each cross-cutting story. For example: US-071 first verifiable in Phase 2 (when real agents process documents), US-072 first verifiable in Phase 3b (when optional services like FRED/BatchData are integrated), US-073 first verifiable in Phase 1 (first migration). This tells implementers when to write the verification tests.

### F13: Consistent and well-structured Gherkin acceptance criteria

- **Severity:** Positive
- **Section:** All stories
- **Finding:** The requirements document consistently uses Given/When/Then format for primary acceptance criteria and includes both happy-path and edge-case scenarios. The edge cases are well-chosen: US-003 covers document processing failure, US-005 covers medium confidence, fraud flags, US-008 covers invalid file types and oversized files, US-028 covers role-based queue filtering. The Gherkin format makes these directly translatable to test cases, which will accelerate the test engineering phase.

### F14: Open questions are well-tracked and cross-referenced

- **Severity:** Positive
- **Section:** Open Questions
- **Finding:** The requirements document includes 10 open questions, each cross-referenced to the specific user stories they affect (e.g., "Affects US-018, US-019"). Acceptance criteria that depend on unresolved questions are marked "Pending" with the question number. This is excellent practice -- it prevents implementers from making assumptions about unresolved design decisions and provides a clear backlog of decisions to make before implementation begins. The open questions also align well with the architectural questions I flagged in the product plan review (PII redaction approach, checkpoint schema, API key mapping).

### F15: US-006 checkpoint test scenario may be fragile

- **Severity:** Suggestion
- **Section:** US-006 -- Workflow Checkpoint Persistence
- **Finding:** The Gherkin scenario tests checkpoint persistence by restarting the service mid-workflow: "Given a workflow is in PARALLEL_ANALYSIS state / When the service restarts / And the workflow is resumed." This requires a test that starts a workflow, kills the service, restarts it, and verifies state recovery. While this is the correct behavior to test, it is a complex integration test that may be flaky in CI environments. For MVP, a simpler verification may be more practical: create a checkpoint, read it back from the database, verify the state.
- **Recommendation:** Keep the full restart-and-resume scenario as the definitive acceptance criterion, but add a simpler verification as well: "Given a workflow checkpoint exists in the database / When the checkpoint is loaded by workflow ID / Then the serialized state matches the expected values." This provides a reliable unit-level test alongside the integration test.

### F16: No story for Swagger/API documentation

- **Severity:** Suggestion
- **Section:** Product plan NFR -- Developer Experience
- **Finding:** The product plan's Developer Experience NFR says "API documented via interactive documentation UI." The CLAUDE.md architecture section lists "API Docs: http://localhost:8000/docs (Swagger UI)" as a development URL. However, no user story requires that API documentation be generated or accessible. FastAPI generates OpenAPI docs automatically, so this may be considered implicit, but other "automatic" features (like health checks) have explicit stories. For consistency and as a verification point, this should be mentioned.
- **Recommendation:** Add an acceptance criterion to US-068 (Developer Setup) or US-069 (README): "API documentation is accessible at /docs after running `make dev`."

---

## 3. Traceability Verification

Every user story includes a "Derives from" field that maps back to a product plan feature. I verified the following:

- **No orphan stories** -- Every story traces to either a product plan feature or a cross-cutting NFR. No stories exist that do not map to the product plan.
- **Derivation accuracy** -- Spot-checked 15 stories; all derivations are accurate. For example, US-024 (Income Discrepancy Detection) correctly derives from "Fraud detection agent (P0)," US-045 (Monthly Payment Calculation) correctly derives from "Mortgage calculator (P0)."
- **Missing features** -- Seven product plan features have no stories (detailed in F2).

---

## 4. Consistency Check

### Internal consistency

- **Workflow states are consistent** across stories. The state machine implied by the stories is: DRAFT -> PROCESSING -> DOCUMENT_PROCESSING -> PARALLEL_ANALYSIS -> AGGREGATED -> {AUTO_APPROVED, ESCALATED, DENIED, AWAITING_DOCUMENTS}. Additionally, HUMAN_APPROVED and HUMAN_DENIED are used for post-review decisions (US-030, US-031). This is consistent across US-001, US-002, US-003, US-005, US-006, US-007, US-056.
- **Role definitions are consistent** -- loan_officer, senior_underwriter, reviewer appear with consistent permission sets across US-028, US-059, US-022, US-023, US-027.
- **Confidence thresholds are consistent** -- Default values (0.85 auto-approve, 0.60 escalation, 0.40 denial) appear in US-005 and US-023 without contradiction.

### Minor inconsistency

- **Severity:** Suggestion
- **Section:** US-016 vs. US-024
- **Finding:** US-016 (Cross-Source Income Validation, risk agent) flags discrepancies exceeding "10% variance." US-024 (Income Discrepancy Detection, fraud agent) flags discrepancies exceeding "15% variance." Both stories compare income across document sources, but with different thresholds and for different purposes (risk assessment vs. fraud detection). This is likely intentional -- risk assessment is more conservative than fraud detection -- but should be explicitly documented to prevent confusion during implementation. Without clarification, implementers may wonder if these are duplicative or complementary.
- **Recommendation:** Add a note to both stories clarifying the relationship: "US-016 and US-024 both analyze income consistency. US-016 (risk) uses a tighter tolerance (10%) to flag risk factors. US-024 (fraud) uses a wider tolerance (15%) to flag potential fraud. Both run as part of parallel analysis; their findings are independent."

---

## 5. Phase Alignment Summary

| Phase | Product Plan Features | Requirements Stories | Alignment |
|-------|----------------------|---------------------|-----------|
| Phase 1 | Orchestration (stubs), schema, app management, RBAC, auth, audit, health, dev setup | US-001, US-002, US-006, US-008, US-021, US-053, US-054, US-058-060, US-064, US-065, US-067-069 | Aligned |
| Phase 2 | Doc processing, credit, risk, confidence routing, HITL review, dashboard | US-003-005, US-009-011, US-013-017, US-023, US-028-032, US-055-057 | Aligned |
| Phase 3a | Compliance, fraud, denial coaching | US-007, US-012, US-018-020, US-024-027, US-033-036 | Aligned |
| Phase 3b | Intake agent, calculator, rate limiting, external data | US-037-052, US-061-063 | Aligned |
| Phase 4 | LLM observability, audit export, P2 features | US-022, US-066, US-070 | Aligned (but incomplete per F2) |

Phase alignment is generally sound. The split of Phase 3 into 3a and 3b (which was my recommendation in the product plan review) is reflected in the requirements document. The product plan was updated to incorporate this split.

---

## 6. Summary of Findings

| # | Severity | Section | Summary |
|---|----------|---------|---------|
| F1 | Warning | Schema feature | No dedicated story for database schema design as a whole |
| F2 | Critical | P1/P2 coverage | 7 product plan features have no user stories |
| F3 | Warning | Summary stats | Summary statistics do not match actual story counts |
| F4 | Warning | US-058 | API key format prescribes architecture; should specify behavior not format |
| F5 | Warning | US-011 | PII redaction criteria contradict pending open question; not testable as written |
| F6 | Suggestion | US-041 | "Subtle and natural" tone is subjective; not machine-testable |
| F7 | Warning | US-009/US-010 | Dependency on US-011 (PII redaction) not visible; could block Phase 2 |
| F8 | Warning | Cross-cutting | No story for LLM retry on transient failures (product plan NFR gap) |
| F9 | Warning | US-053 | SSN accepted via API but PII handling criteria incomplete |
| F10 | Suggestion | US-028 | Confidence-to-role mapping hardcoded; clarify if configurable |
| F11 | Suggestion | Phase 3b | All 16 stories are P0; no descoping room if schedule slips |
| F12 | Suggestion | Cross-cutting | Cross-cutting stories need "first verifiable phase" assignments |
| F13 | Positive | All stories | Consistent Gherkin format with good edge case selection |
| F14 | Positive | Open Questions | Well-tracked open questions with cross-references to affected stories |
| F15 | Suggestion | US-006 | Add simpler checkpoint verification alongside restart-and-resume test |
| F16 | Suggestion | No story | API documentation (Swagger) not covered by any acceptance criterion |
| -- | Suggestion | US-016/US-024 | Income variance thresholds differ between risk (10%) and fraud (15%); clarify relationship |

---

## Verdict

**APPROVE WITH CONDITIONS**

The requirements document is thorough, well-structured, and demonstrates strong practices: consistent Gherkin acceptance criteria, explicit traceability to the product plan, thoughtful edge case coverage, and well-managed open questions. The phase alignment matches the product plan, and the workflow state machine implied by the stories is internally consistent.

The conditions for approval are:

1. **F2 (Missing stories -- Critical)** -- Add user stories for the 7 product plan features that currently have no requirements coverage: streaming chat responses (P1), cross-session chat context (P2), admin configuration interface (P2), portfolio analytics dashboard (P2), container deployment manifests (P2), CI pipeline (P2), and API key lifecycle management (P2). These can be lighter-weight given their priority but must exist for traceability.

2. **F3 (Summary statistics)** -- Correct the summary statistics to match actual story counts and priority distributions.

3. **F5 (PII redaction criteria)** -- Resolve the contradiction between AC-2 (which prescribes "local pre-processing pipeline") and AC-6 (which says the approach is pending). Rewrite acceptance criteria to be mechanism-agnostic and testable.

4. **F8 (Retry requirements)** -- Add a cross-cutting requirement for transient failure retry on external LLM API calls, as specified in the product plan's Reliability NFRs.

The remaining findings (F1, F4, F6, F7, F9, F10, F11, F12, F15, F16) are warnings and suggestions that should be addressed but do not block approval. They can be resolved during requirements revision without re-review.
