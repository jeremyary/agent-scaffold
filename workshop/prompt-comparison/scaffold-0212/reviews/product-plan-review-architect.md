# Product Plan Review -- Architect

**Reviewer:** Architect
**Document reviewed:** `plans/product-plan.md`
**Date:** 2026-02-12

---

## Product Plan Review Checklist

### 1. No technology names in feature descriptions

- **Severity:** Positive
- **Section:** Feature Scope (Must Have / Should Have / Could Have)
- **Finding:** The feature descriptions are written as capabilities, not solutions. Features say "classifies uploaded documents" and "evaluates creditworthiness," not "uses GPT-4 Vision" or "queries with pgvector." Technology mandates are correctly isolated in the "Stakeholder-Mandated Constraints" section at the bottom of the document, separate from feature descriptions. This is well done.

### 2. MoSCoW prioritization used

- **Severity:** Positive
- **Section:** Feature Scope
- **Finding:** Features are organized using MoSCoW classification (Must Have / Should Have / Could Have / Won't Have) with clear P0/P1/P2 labels. No numbered epics, no dependency maps, no agent assignments. This is correct.

### 3. No epic or story breakout

- **Severity:** Positive
- **Section:** Feature Scope, Phasing
- **Finding:** Features are described at the capability level without being decomposed into user stories or implementation tasks. The phasing section describes capability milestones and lists which features are included per phase, which is appropriate. There are no entry/exit criteria per phase, no agent assignments, and no dependency graphs. This is well-scoped for a product plan.

### 4. NFRs are user-facing

- **Severity:** Positive
- **Section:** Non-Functional Requirements
- **Finding:** The NFRs are framed as user outcomes rather than implementation targets. Examples: "Processing a single uploaded document feels responsive -- completes within a short wait, not a long delay" and "Chat responses begin appearing within a conversational pause -- the user should not wonder if the system is broken." This is a significant improvement over the original product brief, which used specific implementation targets (e.g., "< 10 seconds p90", "< 200ms p95 cached RAG"). The plan correctly translates those into user-perceivable quality expectations. Well done.

### 5. User flows present

- **Severity:** Positive
- **Section:** User Flows
- **Finding:** Five user flows are documented, covering all primary and key secondary personas: Alex (developer deploy + explore), Maria (loan processing with alternate paths for escalation and document resubmission), James (compliance audit), Sam (borrower exploration), and Dana (risk threshold adjustment). The flows include alternate paths, which is valuable for architectural understanding.

### 6. Phasing describes capability milestones

- **Severity:** Positive
- **Section:** Phasing
- **Finding:** Each phase leads with a "Capability milestone" paragraph that describes what the system can do at the end of the phase, not which work items are included. Phase 1 ends with "A developer can start the system, create an application, see it flow through the orchestrated workflow, and verify that audit events are recorded." Phase 2 ends with "the demo is genuinely impressive." This is the right level of abstraction for a product plan.

---

## Architectural Feasibility Findings

### F1: Phasing reorder -- Human-in-the-loop is in Phase 2 features but not the milestone description

- **Severity:** Warning
- **Section:** Phasing -- Phase 2
- **Finding:** Phase 2 includes "human-in-the-loop review workflow" as a feature, and the capability milestone says "Applications with high confidence auto-approve; applications with lower confidence land in the review queue." However, the product brief (Section 11) places human review in Phase 4, after the full agent suite and public access. The product plan's ordering is actually better architecturally -- you cannot meaningfully demonstrate confidence-based routing without a review queue to land in -- but this is a deliberate divergence from the brief that should be acknowledged. More importantly, the human-in-the-loop workflow is deeply intertwined with the confidence-based routing feature. If Phase 2 includes routing, it must include the review workflow; the plan is internally consistent on this point.
- **Recommendation:** No change needed to the phasing itself -- the plan's ordering is sound. But the divergence from the product brief should be noted in the open questions or assumptions, since the stakeholder's phasing was different and they may have had reasons for it.

### F2: Phase consolidation risk -- Phase 3 is overloaded

- **Severity:** Warning
- **Section:** Phasing -- Phase 3
- **Finding:** Phase 3 packs eight features into a single phase: compliance checking agent, fraud detection agent, denial coaching agent, intake agent (public chat), mortgage calculator, streaming chat responses, public access tier with rate limiting, and external data integration. From an architectural perspective, these decompose into at least three distinct subsystems:
  1. **Internal agents** (compliance, fraud, denial coaching) -- extend the existing loan processing graph
  2. **Public-facing system** (intake agent, chat, calculator, rate limiting) -- an entirely separate graph with different auth, different security posture, different infrastructure (SSE streaming, session management)
  3. **External integrations** (FRED API, BatchData API) -- new service boundaries with caching, fallback, and error handling

  Delivering all three in a single phase creates a wide blast radius where a delay in one (e.g., RAG setup for compliance) blocks the entire phase milestone. The public-facing system in particular introduces new architectural concerns (SSE, session management, prompt injection defense, rate limiting) that are orthogonal to extending the loan processing graph.
- **Recommendation:** Consider splitting Phase 3 into two sub-phases: Phase 3a (compliance, fraud, denial coaching -- extending the existing authenticated workflow) and Phase 3b (public access tier, intake agent, calculator, streaming, external data). This preserves the capability milestone model: 3a = "full agent suite for authenticated processing"; 3b = "public access with conversational AI." This is an observation for the stakeholder; the product plan may intentionally keep them together for simplicity.

### F3: PII redaction before LLM calls -- hidden complexity

- **Severity:** Warning
- **Section:** Feature Scope -- Document processing agent (P0)
- **Finding:** The feature description states "PII in document images is redacted before sending to external AI services." This is architecturally significant and deceptively complex. Redacting PII from document images (as opposed to text) requires either: (a) a multi-pass approach where a local model or rule-based system identifies PII regions in the image and masks them before the primary vision model processes the document, or (b) sending the document to a vision model for PII detection first, then redacting, then sending again for data extraction -- doubling LLM costs. Option (a) requires a local OCR/NER pipeline. Option (b) means the "redaction" model still sees the PII, which defeats the purpose if the concern is about external API exposure.

  This is not a product plan problem per se -- the feature is correctly described as a capability ("PII is redacted"). But architecturally, this is one of the hardest features in the entire system, and the plan does not flag it as a risk. It could easily consume as much effort as any other single P0 feature.
- **Recommendation:** Add a risk note in Phase 2 (where document processing becomes real) acknowledging that PII redaction from document images is architecturally complex and may require a dedicated design spike. Alternatively, scope it more precisely: does "redacted" mean the entire document image is processed locally and only extracted text (with PII stripped) is sent to external APIs? That is a very different (and simpler) architecture than pixel-level image redaction.

### F4: Workflow state persistence -- checkpoint schema is a Phase 1 risk

- **Severity:** Warning
- **Section:** Phasing -- Phase 1, Feature Scope -- Supervisor-worker agent orchestration
- **Finding:** Phase 1 includes "supervisor-worker agent orchestration (with stub agents)" and the feature description says "Workflow state persists across service restarts." LangGraph's PostgresSaver provides checkpointing, but the checkpoint schema is tied to the graph structure. If the graph structure changes between phases (adding agents, adding parallel fan-out, adding the cyclic resubmission path), the checkpoint schema may need migration. Getting the initial graph structure wrong in Phase 1 means either: (a) complex checkpoint migrations in later phases, or (b) wiping workflow state when the graph changes. The plan's Phase 1 risk section mentions "Schema design decisions made early constrain later phases" but focuses on the audit trail schema, not the checkpoint schema.
- **Recommendation:** Add an explicit risk item to Phase 1: "LangGraph checkpoint schema must accommodate the full graph structure (parallel fan-out, cyclic resubmission) from day one, even though those nodes are stubs. Retrofitting checkpoint compatibility is harder than designing it upfront."

### F5: Two independent graphs require architectural clarity

- **Severity:** Suggestion
- **Section:** Feature Scope -- Intake agent vs. Loan Processing
- **Finding:** The product brief (Section 4) clearly defines two independent graphs -- the Loan Processing Graph (authenticated) and the Intake Graph (public). The product plan references the intake agent as a separate feature but does not explicitly call out that these are architecturally independent agent systems that happen to share infrastructure (database, Redis, FRED/BatchData integrations). This matters because the intake graph and the loan processing graph have entirely different lifecycle, scaling, error, and security characteristics. The architecture document will need to design them separately, but the product plan should make this separation visible so that downstream agents understand there are two systems, not one.
- **Recommendation:** Add a brief note in the feature description for the intake agent (or in an assumptions section) stating that the intake agent operates as an independent graph from the loan processing workflow, sharing only infrastructure services. This helps the architect and tech lead design appropriately.

### F6: "Real authentication from day one" vs. API key scheme -- consistent but worth flagging

- **Severity:** Suggestion
- **Section:** Security Considerations -- MVP Authentication Scope
- **Finding:** The plan correctly describes the API key scheme as "real authentication" in the sense that it is not mocked -- endpoints actually enforce bearer tokens. However, the `Authorization: Bearer <role>:<key>` format embeds the role in the token, which means the role is client-asserted unless the server maps key -> role independently. The plan does say "startup warning if running with default keys," implying the keys are pre-configured server-side. The architecture will need to define whether roles are derived from the key (server-side mapping) or asserted by the client (in the token format). The plan does not need to resolve this -- it is an architecture concern -- but the format `<role>:<key>` is suggestive enough that it could mislead implementation.
- **Recommendation:** No product plan change needed. Flag as an open architectural question: "How does the API key scheme map keys to roles? Is `<role>:<key>` a display convention, or does the server parse the role from the token?" This will be resolved in the architecture document.

---

## Completeness Findings

### F7: Missing open question -- LangGraph version and async compatibility

- **Severity:** Suggestion
- **Section:** Open Questions
- **Finding:** The stakeholder-mandated constraints specify LangGraph with PostgresSaver, but the open questions do not address LangGraph version compatibility with async FastAPI. LangGraph's async support, PostgresSaver's connection pooling behavior, and the interaction between LangGraph's execution model and FastAPI's async event loop are non-trivial integration points. This is particularly relevant because the plan calls for "at least 10 simultaneous" concurrent workflow executions (from the product brief NFRs), which puts pressure on how LangGraph manages its database connections alongside the application's own connection pool.
- **Recommendation:** Add an open question: "LangGraph async integration -- How does LangGraph's PostgresSaver interact with the application's async database connection pool? Do they share a pool, use separate pools, or require synchronous execution? This affects concurrency limits and deployment sizing."

### F8: Missing assumption -- Red Hat AI Quickstart template readiness

- **Severity:** Warning
- **Section:** Assumptions
- **Finding:** Assumption 3 states "The existing Red Hat AI Quickstart template provides a working foundation (build system, frontend framework, backend framework, database setup) that this project extends rather than replaces." However, the project scaffolding (`packages/` directory) is currently empty -- no `ui`, `api`, or `db` packages exist yet. The `CLAUDE.md` references these packages and describes commands like `make setup` and `make dev`, but they do not correspond to any existing code. Either the template has not been applied yet, or it will be generated as part of Phase 1. This is a significant dependency for Phase 1 timeline estimates. If Phase 1 must also create the entire project skeleton (FastAPI app, React app, database setup, Makefile, compose.yml), the "under 30 minutes to deploy" success metric depends on all of that working.
- **Recommendation:** Clarify assumption 3: does the template already exist and will be applied before Phase 1 begins, or is creating the template scaffolding part of Phase 1? If the latter, the Phase 1 risk section should note that the scaffolding effort is significant and is a prerequisite for all other Phase 1 work.

---

## Consistency Findings

### F9: Product brief has 6 phases; product plan has 4

- **Severity:** Suggestion
- **Section:** Phasing
- **Finding:** The product brief (Section 11) outlines 6 phases: Foundation, First Real Agents, Full Agent Suite + Public Access, Human Review + Fraud + Coaching, Observability + Polish, Extensions. The product plan consolidates these into 4 phases, merging human review into Phase 2 (with the first real agents), merging fraud/coaching into Phase 3, and dropping the Extensions phase. The consolidation is reasonable and the plan's phasing is internally consistent. However, the divergence is worth noting because if the stakeholder had specific reasons for the 6-phase breakdown (e.g., controlling blast radius per phase), the consolidation may not be welcome.
- **Recommendation:** No change required unless the stakeholder objects. The 4-phase structure is more practical. The Extensions phase (Phase 6 in the brief) was vague enough that omitting it is defensible -- it was labeled "Extensions" with items like "optional real API integrations" and "local model support" which are post-MVP by nature.

### F10: Success metric "under 5 minutes end-to-end" vs. NFR "a few minutes"

- **Severity:** Suggestion
- **Section:** Success Metrics vs. Non-Functional Requirements
- **Finding:** The success metrics table states "Under 5 minutes end-to-end automated" for application processing. The NFR section says "A complete application processes end-to-end within a few minutes -- fast enough that the user can wait or briefly step away." These are consistent in intent but "under 5 minutes" is more specific than "a few minutes." Since the NFRs are intentionally user-facing and qualitative (per the checklist requirement), the success metrics table serves as the more precise target. This is fine -- just noting that the architecture should use the success metric target for design decisions, not the softer NFR language.
- **Recommendation:** No change needed. The architecture will use the 5-minute target from the success metrics.

---

## Summary of Findings

| # | Severity | Section | Summary |
|---|----------|---------|---------|
| Checklist 1-6 | Positive | Multiple | All 6 Product Plan Review Checklist items pass cleanly |
| F1 | Warning | Phasing -- Phase 2 | Human-in-the-loop phasing diverges from product brief (but is better) |
| F2 | Warning | Phasing -- Phase 3 | Phase 3 packs three orthogonal subsystems; consider splitting |
| F3 | Warning | Feature Scope -- Document processing | PII redaction from document images is deceptively complex |
| F4 | Warning | Phasing -- Phase 1 | Checkpoint schema must accommodate full graph from day one |
| F5 | Suggestion | Feature Scope -- Intake agent | Two-graph architecture should be explicitly called out |
| F6 | Suggestion | Security -- Auth | API key format `<role>:<key>` needs architectural clarification |
| F7 | Suggestion | Open Questions | Missing: LangGraph async + connection pool interaction |
| F8 | Warning | Assumptions | Template scaffolding does not exist yet; Phase 1 dependency |
| F9 | Suggestion | Phasing | 6-phase brief condensed to 4 phases (reasonable but notable) |
| F10 | Suggestion | Success Metrics / NFRs | "Under 5 minutes" vs. "a few minutes" -- architecture uses the former |

---

## Verdict

**APPROVE WITH CONDITIONS**

The product plan is well-structured, passes all 6 items on the Product Plan Review Checklist, and tells a consistent story. The MoSCoW prioritization is clean, the NFRs are appropriately user-facing, the user flows are thorough, and the phasing describes capability milestones rather than work breakdowns.

The conditions for approval are:

1. **F3 (PII redaction complexity)** -- Add a risk note to Phase 2 acknowledging that PII redaction from document images is architecturally complex and may require a design spike to scope the approach (local pre-processing vs. multi-pass LLM vs. text-only redaction).

2. **F4 (Checkpoint schema)** -- Add a risk note to Phase 1 that the LangGraph checkpoint schema should be designed for the full graph structure from day one, even when most nodes are stubs.

3. **F8 (Template scaffolding)** -- Clarify whether the Red Hat AI Quickstart template scaffolding already exists or must be created as part of Phase 1. If the latter, add it as a Phase 1 risk.

These three conditions address risks that could cascade into significant rework if not acknowledged during planning. The remaining findings (F1, F2, F5, F6, F7, F9, F10) are suggestions or observations that can be addressed in the architecture document without changes to the product plan.
