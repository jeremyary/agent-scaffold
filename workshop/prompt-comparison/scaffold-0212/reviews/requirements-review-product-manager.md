# Requirements Review: Product Manager Perspective

**Reviewer:** Product Manager
**Document reviewed:** `plans/requirements.md`
**Reference document:** `plans/product-plan.md`
**Date:** 2026-02-12

---

## 1. Feature Coverage

Systematic walkthrough of every product plan feature against requirements coverage.

### P0 Features (Must Have)

| Product Plan Feature | Requirements Coverage | Status |
|---|---|---|
| Supervisor-worker agent orchestration | US-001 through US-007 | Covered |
| Document processing agent | US-008 through US-012 | Covered |
| Credit analysis agent | US-013 | Covered |
| Risk assessment agent | US-014 through US-017 | Covered |
| Compliance checking agent | US-018 through US-020 | Covered |
| Confidence-based routing | US-005, US-023 | Covered |
| Immutable audit trail | US-021 | Covered |
| Human-in-the-loop review workflow | US-028 through US-032 | Covered |
| Role-based access control | US-059 | Covered |
| API key authentication | US-058, US-060 | Covered |
| Loan application management | US-053, US-054, US-055, US-056 | Covered |
| Loan officer dashboard | US-057 | Covered |
| Database schema and migrations | US-073 (cross-cutting) | Partially covered (see finding) |
| Health checks | US-067 | Covered |
| Developer setup experience | US-068, US-069 | Covered |
| Fraud detection agent | US-024 through US-027 | Covered |
| Denial coaching agent | US-033 through US-036 | Covered |
| Intake agent (public chat) | US-037, US-038, US-041 | Covered |
| Mortgage calculator | US-045 through US-052 | Covered |
| Public access tier with rate limiting | US-042, US-043, US-044 | Covered |
| External data integration (rates and property) | US-039, US-040, US-061, US-062, US-063 | Covered |
| Audit trail export | US-022 | Covered |

### P1 Features (Should Have)

| Product Plan Feature | Requirements Coverage | Status |
|---|---|---|
| Streaming chat responses | No user story | **MISSING** |
| LLM observability dashboard | US-066 | Covered |

### P2 Features (Could Have)

| Product Plan Feature | Requirements Coverage | Status |
|---|---|---|
| Cross-session chat context | No user story | **MISSING** |
| Admin configuration interface | Partially in US-023, US-027 (threshold/sensitivity config) but no dedicated story for the full admin UI | **MISSING** |
| Portfolio analytics dashboard | No user story | **MISSING** |
| Seed data with diverse test cases | US-070 | Covered |
| Container deployment manifests | No user story | **MISSING** |
| CI pipeline | No user story | **MISSING** |
| API key lifecycle management | No user story | **MISSING** |

---

## 2. Findings

### Finding 1

- **Severity**: Critical
- **Section**: P1 Feature: Streaming chat responses
- **Finding**: The product plan lists "Streaming chat responses" as a P1 (Should Have) feature for Phase 3b. The requirements document has no corresponding user story. This is the only P1 feature besides LLM observability, and it directly affects the chat user experience described in User Flow 4 (Sam explores mortgage options). The product plan specifically calls out that "streaming responses make the chat experience feel conversational" in the Phase 3b capability milestone.
- **Recommendation**: Add a user story (e.g., US-074) for streaming chat responses, assigned to P1 / Phase 3b. Acceptance criteria should cover: responses begin appearing within a conversational pause, partial responses render progressively in the UI, streaming works for both knowledge retrieval and calculator-based responses, and graceful fallback if streaming is not supported by the client.

### Finding 2

- **Severity**: Critical
- **Section**: P2 Features: Cross-session chat context, Admin configuration interface, Portfolio analytics dashboard, Container deployment manifests, CI pipeline, API key lifecycle management
- **Finding**: Six of seven P2 (Could Have) features from the product plan have no corresponding user stories in the requirements document. Only "Seed data with diverse test cases" (US-070) is covered. The missing features are all assigned to Phase 4 in the product plan. While P2 features are lower priority, the requirements document should still capture them as user stories (even if lighter on acceptance criteria) so downstream agents know the full scope and can plan accordingly. Without these stories, the Project Manager cannot include them in the work breakdown, and Phase 4 appears dramatically underscoped (only 3 stories vs. the 8 features the product plan assigns to it).
- **Recommendation**: Add user stories for each missing P2 feature: cross-session chat context, admin configuration interface (distinct from threshold config -- covers knowledge base management, system-wide decision patterns), portfolio analytics dashboard, container deployment manifests, CI pipeline, and API key lifecycle management. These can have lighter acceptance criteria appropriate for P2/Phase 4 scope.

### Finding 3

- **Severity**: Warning
- **Section**: Summary Statistics (bottom of requirements.md)
- **Finding**: The summary statistics are inaccurate on multiple dimensions. The document claims: P0: 66, P1: 2, P2: 5, Phase 1: 13, Phase 2: 22, Phase 3a: 14, Phase 3b: 16, Phase 4: 3, Cross-Cutting: 5. Actual counts from the story headers are: P0: 68, P1: 1, P2: 1, 3 unlabeled (cross-cutting); Phase 1: 15, Phase 2: 20, Phase 3a: 13, Phase 3b: 19, Phase 4: 3, Cross-Cutting: 3. Every number except Phase 4 is wrong. This is likely because the statistics were written based on a planned outline and not updated after the stories were finalized.
- **Recommendation**: Recalculate and correct the summary statistics to match the actual story content. Also assign a priority label (P0 or similar) to the three cross-cutting stories (US-071, US-072, US-073) -- they derive from NFRs which are product-plan-level requirements and should have explicit priority designations.

### Finding 4

- **Severity**: Warning
- **Section**: US-003: Parallel Analysis Agent Fan-Out (P0, Phase 2)
- **Finding**: US-003 specifies that the supervisor dispatches to "credit, risk, compliance, and fraud agents in parallel." However, the compliance checking agent and fraud detection agent are Phase 3a features in the product plan (not Phase 2). Phase 2 in the product plan includes: document processing agent, credit analysis agent, risk assessment agent, confidence-based routing, human-in-the-loop review, and loan officer dashboard. The Phase 2 capability milestone says "see the credit analysis agent evaluate credit data and observe confidence-based routing in action" -- it does not mention compliance or fraud. US-003 should fan out to only credit and risk agents in Phase 2, with compliance and fraud added in Phase 3a.
- **Recommendation**: Revise US-003 to fan out to credit and risk agents only (Phase 2). Add a separate story or expand US-003 with a Phase 3a extension that adds compliance and fraud to the parallel fan-out. This aligns the requirements with the product plan's phased delivery: Phase 2 demonstrates the basic pattern with two parallel agents, Phase 3a completes the full suite.

### Finding 5

- **Severity**: Warning
- **Section**: US-008: Document Upload and Storage (P0, Phase 1)
- **Finding**: US-008 acceptance criterion 4 states "Stores document in MinIO object storage." The product plan places "MinIO" in the Stakeholder-Mandated Constraints section, not in feature descriptions. While the requirements document is downstream of the product plan and is permitted to reference technology decisions made by the Architect, at this stage no architecture document has been produced yet. The reference to MinIO is premature -- it should reference object storage generically or note that the specific technology will be determined by the architecture phase. Similarly, US-006 references "LangGraph PostgresSaver" and US-001 references "LangGraph PostgresSaver," and multiple stories reference "Redis," "FRED API," "BatchData API," "Alembic," and "LangFuse" by name. These are stakeholder constraints that should flow through the Architect's decisions, not be embedded directly in acceptance criteria.
- **Recommendation**: This is less severe than it would be in the product plan itself, since requirements documents do eventually need to reference specific technologies after the architecture is finalized. However, since the architecture has not been finalized yet, consider either: (a) marking these technology references as "per architecture decisions" with a note that they derive from stakeholder constraints, or (b) accepting this as-is with the understanding that the Architect's design will validate or adjust these references. The current approach is acceptable if the architecture phase confirms these choices, but it creates a risk of rework if the Architect makes different decisions.

### Finding 6

- **Severity**: Warning
- **Section**: US-071: Non-Functional Performance Targets
- **Finding**: The product plan explicitly frames NFRs as user-facing outcomes. For example, the product plan says "Document processing feels responsive -- completes within a short wait" and "Chat responses begin appearing within a conversational pause." US-071 translates these into specific implementation targets: "single document completes within 10 seconds (p90)", "RAG query latency (cached): under 200ms (p95)", "10 simultaneous workflows without degradation." While requirements need to be more specific than the product plan, several of these numbers (particularly "200ms cached RAG" and "10 concurrent workflows") are implementation-level targets that typically require architecture knowledge to set correctly. The product plan deliberately avoided specifying these numbers.
- **Recommendation**: For the targets that derive directly from product plan success metrics (e.g., "under 5 minutes end-to-end", "under 30 minutes setup"), keep them as-is. For targets that are implementation-specific and have no product-plan basis (200ms cached RAG, 500ms API response, 10 concurrent workflows), either: (a) mark them as "TBD -- pending architecture" or (b) frame them as aspirational targets subject to architecture review. This prevents the requirements from constraining the Architect before they have made design decisions.

### Finding 7

- **Severity**: Warning
- **Section**: Product plan NFR: Reliability -- "Transient failures in external AI services are retried automatically"
- **Finding**: The product plan's Reliability NFR states: "Transient failures in external AI services are retried automatically rather than immediately failing the workflow." No user story covers this requirement. US-072 covers graceful degradation when optional services are unavailable (Redis, LangFuse, FRED, BatchData), but does not address retry behavior for LLM API transient failures (rate limits, timeouts, 5xx errors). LLM APIs are the critical service for all agent processing, and transient failures are common. This is a meaningful gap.
- **Recommendation**: Add acceptance criteria to an existing story (perhaps US-072 or a new cross-cutting story) covering: transient LLM API failures (rate limits, timeouts, server errors) are retried with backoff, the retry policy is configurable, and permanent failures are escalated gracefully rather than crashing the workflow.

### Finding 8

- **Severity**: Warning
- **Section**: Product plan feature: "Database schema and migrations" (P0, Phase 1)
- **Finding**: The product plan lists "Database schema and migrations" as a distinct P0 feature for Phase 1, described as: "Schema supporting applications, documents, agent decisions, audit events, workflow state, and user roles. Idempotent migrations with rollback support." While US-073 covers migration idempotency and rollback as a cross-cutting concern, and US-021 covers the audit trail schema, there is no dedicated user story that defines the full database schema scope -- i.e., that the schema must support applications, documents, agent decisions, audit events, workflow state, and user roles as named entities. Individual stories implicitly require these tables, but no story ensures the schema is designed as a coherent whole in Phase 1.
- **Recommendation**: Consider adding a Phase 1 story (or expanding US-073) that explicitly scopes the initial database schema to include tables for: applications, documents, agent decisions, audit events, workflow state, and user/role definitions. This gives the Database Engineer a clear mandate to design the schema holistically in Phase 1 rather than having it emerge piecemeal from individual stories.

### Finding 9

- **Severity**: Warning
- **Section**: Product plan NFR: Developer Experience -- "Code includes inline comments explaining multi-agent patterns"
- **Finding**: The product plan states under Developer Experience: "Code includes inline comments explaining multi-agent patterns." Completion Criterion 7 says: "Code is teachable -- inline documentation explains multi-agent patterns clearly enough that a developer can understand and adapt them." No user story captures this requirement. US-069 covers the README with architecture overview, but inline code documentation is a separate concern that affects how every agent is implemented. This is central to the product's identity as a teaching tool.
- **Recommendation**: Add a cross-cutting story or non-functional requirement capturing: agent implementations include inline comments explaining the multi-agent pattern being demonstrated (supervisor-worker, fan-out, checkpoint, escalation), comments are written for the developer persona (Alex), and comments explain "why" not just "what." This requirement should apply across all phases as agents are implemented.

### Finding 10

- **Severity**: Warning
- **Section**: US-041: Sentiment Analysis and Tone Adjustment (P0, Phase 3b)
- **Finding**: US-041 acceptance criterion 3 states: "Sentiment analysis does not add significant latency (< 200ms)." This is an implementation-level performance target that the product plan did not specify. The product plan says the intake agent "adjusts tone based on user sentiment analysis" but does not specify a latency budget for the sentiment analysis component. Setting a 200ms budget for a sub-component is an architecture/implementation concern, not a product requirement.
- **Recommendation**: Remove the "< 200ms" target from US-041. The overall chat response latency is already covered by the product plan's NFR ("chat responses begin appearing within a conversational pause"). The sentiment analysis latency budget should be determined during technical design as part of the overall chat response time budget.

### Finding 11

- **Severity**: Warning
- **Section**: US-009: Document Classification, US-010: Structured Data Extraction
- **Finding**: US-009 acceptance criterion 6 states "Classification completes within 10 seconds (p90)" and US-010 criterion 6 states "Extraction completes within 10 seconds per document (p90)." These are specific implementation-level performance targets. The product plan says "Processing a single uploaded document feels responsive -- completes within a short wait, not a long delay." While 10 seconds is a reasonable interpretation, the "p90" designation is an implementation-level metric. The product plan deliberately left these as user-facing outcomes.
- **Recommendation**: Reframe as user-facing: "Document classification and extraction complete within a timeframe that feels responsive to the user" and let the architecture/technical design set the specific p90 target. Alternatively, keep the 10-second target but remove the "p90" qualifier, as the product plan's user-facing framing does not specify percentile targets.

### Finding 12

- **Severity**: Suggestion
- **Section**: User Flow Coverage
- **Finding**: The product plan's User Flow 1 (Alex deploys and explores) includes Step 8: "Alex examines the codebase: reads the supervisor agent code, traces the workflow from initialization through parallel fan-out to final decision, and understands the pattern well enough to adapt it." No user story captures this as a testable requirement. While code readability is subjective, this step is central to the product's purpose as a teaching tool. Combined with the missing inline documentation requirement (Finding 9), the "teachability" dimension of the product is underrepresented in the requirements.
- **Recommendation**: The inline documentation story recommended in Finding 9 would partially address this. Additionally, consider adding an acceptance criterion to US-069 (README) or a new story that covers: the README includes a "code walkthrough" section that guides developers through the supervisor agent, parallel fan-out, and checkpoint patterns with file references.

### Finding 13

- **Severity**: Suggestion
- **Section**: US-022: Audit Trail Export (P0, Phase 4)
- **Finding**: The product plan lists "Audit trail export" as a P0 (Must Have) feature. The requirements assign it to Phase 4. However, Completion Criterion 5 states: "Audit trail complete -- every agent decision, human action, and workflow transition is recorded immutably and exportable." User Flow 3 (James conducts a compliance audit) also culminates in exporting the audit trail (Step 5). If the export capability is deferred to Phase 4, completion criteria 5 and user flow 3 cannot be fully satisfied until Phase 4. This may be intentional, but it is worth flagging because the product plan presents audit export as a core P0 capability.
- **Recommendation**: Consider whether audit trail export should move to Phase 3a (when the compliance checking agent goes live and James's workflow becomes relevant) or remain in Phase 4. If it stays in Phase 4, note that completion criterion 5 and user flow 3 are Phase 4-gated. Either approach is acceptable, but the phasing decision should be explicit.

### Finding 14

- **Severity**: Suggestion
- **Section**: Public tier security -- per-session concurrency limits
- **Finding**: The product plan's security section describes "per-session concurrency limits (max 1 active inference per session)" as part of the cost abuse controls. No user story captures this concurrency limit. US-042 covers session-based rate limits (messages per hour) and US-043 covers IP-based cost caps, but neither addresses concurrent inference limits. This is a defense against a specific attack pattern where a malicious actor opens many parallel requests within a single session to amplify costs.
- **Recommendation**: Add an acceptance criterion to US-042 or US-043 (or a new story) requiring: "Each session supports at most 1 active inference request at a time. Additional requests while an inference is in progress receive a 429 response."

### Finding 15

- **Severity**: Suggestion
- **Section**: Public tier security -- session expiration
- **Finding**: The product plan specifies "session expiration (24-hour TTL)" in the public tier protections. US-037 mentions "Session persists for 24 hours (TTL)" which covers creation, but no story covers what happens when a session expires -- whether in-progress messages are rejected, whether the user is notified, and whether a new session is automatically created.
- **Recommendation**: Add acceptance criteria to US-037 or US-042 covering session expiration behavior: expired sessions receive a specific response indicating the session has ended, and the user can start a new session. This is minor but helps ensure consistent UX at session boundaries.

### Finding 16

- **Severity**: Suggestion
- **Section**: Persona Coverage
- **Finding**: The product plan defines 6 personas: Alex (AI Developer), Maria (Loan Officer), James (Compliance Officer), Sam (Borrower), Pat (Platform Engineer), Dana (Risk Management Lead). In the requirements, the "As a..." clauses use: loan officer, compliance officer, borrower, platform engineer, risk management lead, developer, fraud analyst, security engineer, and "AI agent." The persona names (Alex, Maria, James, Sam, Pat, Dana) are never used in the requirements -- only their roles. Additionally, "fraud analyst" appears in US-012, US-024, US-025, US-026 but is not a defined persona in the product plan. The fraud analyst role is a function of either the loan officer or compliance officer persona.
- **Recommendation**: This is a minor consistency issue. The role-based approach in the requirements is acceptable and arguably clearer than using persona names. However, the "fraud analyst" role should be mapped to an existing persona (likely James/Compliance Officer or Maria/Loan Officer) or noted as a sub-role. This affects nothing functionally but improves traceability.

### Finding 17

- **Severity**: Positive
- **Section**: Open Questions handling
- **Finding**: All 10 open questions from the product plan are faithfully captured in the requirements document's "Open Questions Requiring Stakeholder Input" section, with correct cross-references to affected user stories. Affected stories (e.g., US-011 for PII redaction, US-018 for knowledge base content) include "Pending" markers referencing the relevant open question. This is exactly how open questions should be handled -- acknowledged, cross-referenced, and not resolved by assumption.

### Finding 18

- **Severity**: Positive
- **Section**: Edge case coverage throughout
- **Finding**: The requirements document consistently includes edge cases and alternate paths alongside happy-path acceptance criteria. Examples include: invalid file types (US-008), low-confidence classification (US-009), DTI above threshold (US-014), SSN mismatch (US-026), fraud sensitivity levels (US-027), LOW-confidence review queue filtering (US-028), invalid threshold values (US-023), FRED API unavailability (US-061), session lookup limits exceeded (US-040), and database unreachable (US-067). This level of edge-case specificity is appropriate for MVP maturity and gives implementers clear guidance on error behavior.

### Finding 19

- **Severity**: Positive
- **Section**: Gherkin-format acceptance criteria
- **Finding**: Acceptance criteria consistently use both numbered behavioral statements and Given/When/Then format. The dual approach is well-suited for this project: numbered criteria provide a clear checklist for implementation, while Gherkin scenarios provide testable specifications. The format is consistent across all 73 stories.

---

## 3. Completion Criteria Mapping

Can each of the product plan's 9 completion criteria be satisfied by the requirements as written?

| # | Completion Criterion | Satisfied By | Status |
|---|---|---|---|
| 1 | Developer quickstart works end-to-end (under 30 min) | US-068, US-069 | Satisfied |
| 2 | Full agent workflow demonstrated (all agents to final decision with audit trail) | US-001-007, US-009-020, US-024-027 | Satisfied (but requires Phase 3a completion) |
| 3 | Human-in-the-loop works (escalation, review, approve/deny/request docs) | US-028-032, US-007 | Satisfied |
| 4 | Public tier functional (chat, calculator, live rates, cited responses) | US-037-052, US-061-063 | Satisfied (but missing streaming -- see Finding 1) |
| 5 | Audit trail complete and exportable | US-021, US-022, US-020 | Satisfied (but export is Phase 4 -- see Finding 13) |
| 6 | Three roles enforce access control | US-058, US-059, US-060 | Satisfied |
| 7 | Code is teachable (inline docs explain multi-agent patterns) | No dedicated story | **NOT Satisfied** (see Finding 9) |
| 8 | Tests pass (70% backend coverage) | US-071 mentions testing approach; no dedicated test coverage story | Partially satisfied |
| 9 | Deployable (container deployment with manifests) | No user story for container deployment manifests | **NOT Satisfied** (see Finding 2) |

---

## 4. Priority Alignment Summary

The requirements largely align with the product plan's MoSCoW classification:
- P0 features are comprehensively covered with P0 stories
- The only P1 feature without coverage (streaming chat responses) is a gap
- 6 of 7 P2 features lack stories entirely
- The summary statistics at the end of the document are inaccurate and should be corrected

---

## 5. Scope Drift Assessment

No significant scope drift detected. The requirements do not introduce features beyond what the product plan specifies. The requirements stay within the product plan's boundaries and do not add new capabilities. The technology references noted in Finding 5 could be considered scope drift from the product plan into architecture territory, but this is a natural consequence of writing implementation-ready acceptance criteria and is acceptable if validated by the architecture phase.

---

## Verdict: **APPROVE WITH CONDITIONS**

The requirements document is a thorough, well-structured translation of the product plan into testable user stories. Coverage of P0 features is comprehensive, edge cases are well-specified, open questions are properly handled, and the Gherkin acceptance criteria format is consistently applied. The document demonstrates genuine effort to capture the product plan's intent.

However, the following conditions must be addressed before the requirements are considered complete:

**Must fix (blocks downstream work):**
1. **Add streaming chat responses story** (Finding 1) -- This is a P1 feature explicitly called out in the product plan's Phase 3b milestone. It is the only P1 feature missing.
2. **Add stories for missing P2 features** (Finding 2) -- Six P2 features have no stories. Without them, Phase 4 scope is undefined and the Project Manager cannot create a complete work breakdown.
3. **Correct summary statistics** (Finding 3) -- The numbers are wrong and will confuse downstream agents.
4. **Fix US-003 phase alignment** (Finding 4) -- The parallel fan-out to compliance and fraud agents contradicts the product plan's phasing. Phase 2 fan-out should be credit + risk only.

**Should fix (improves quality):**
5. **Add teachability/inline documentation story** (Finding 9) -- Completion criterion 7 cannot be satisfied without this.
6. **Add LLM retry/transient failure story** (Finding 7) -- The product plan explicitly requires this and no story covers it.
7. **Add database schema scope story** (Finding 8) -- Ensures coherent schema design in Phase 1.
8. **Remove sub-component latency targets** (Findings 10, 11) -- Let the architecture define these.
