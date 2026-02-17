# Product Plan Review -- Architect (Re-Review)

**Artifact:** `plans/product-plan.md`
**Reviewer:** Architect
**Date:** 2026-02-16
**Review Type:** SDD Phase 2 -- Product Plan Review Gate (Re-Review After Triage)

## Executive Summary

This re-review assesses the product plan after triage changes were applied from the first round of reviews. The original review raised 3 Warnings, 4 Suggestions, and 4 Positives. All three Warnings have been substantively addressed:

- **A-01 (Phase 1 scope):** Resolved by rebalancing from 4 phases to 6. Phase 1 is now 8 features (foundation + public experience), Phase 2 is 8 features (borrower experience + document processing). The old 16-feature Phase 1 monolith is gone.
- **A-02 (HMDA dual-data-path understated):** Strengthened by adding HMDA document extraction filtering to F5, memory isolation requirements to F19/F14, and explicit "every stage" language for HMDA isolation (collection, document extraction, storage, retrieval).
- **A-03 (Phase 3 P0/P1 bundling):** Resolved by moving all P1 and P2 features to a dedicated Phase 6. Phases 1-4 are now purely P0.

The four Suggestions were either resolved or acknowledged as architecture-scope decisions. Additionally, several proactive improvements strengthen the plan: audit trail immutability is now a P0 requirement, agent security is explicit in F14, document access controls are role-specific, F4 is simplified to conversational-only (removing the dual-path complexity), and the downstream notes are now tiered into Architecture-Critical and Informational categories.

The plan is now in strong shape for architecture work. My remaining findings are minor and do not block proceeding.

## Checklist Assessment

| Check | Pass? | Notes |
|-------|-------|-------|
| No technology names in feature descriptions | PASS | Feature descriptions remain capability-focused. Technology mandates (LangGraph, LlamaStack, FastAPI, etc.) are isolated in the Stakeholder-Mandated Constraints section. No technology names in F1-F37. The only technology name in a feature is "identity provider" in F14, which is appropriate -- it describes a capability category, not a specific product. |
| MoSCoW prioritization used | PASS | Clear Must Have (P0), Should Have (P1), Could Have (P2), Won't Have classification. RICE scoring reference supports the MoSCoW assignments. Feature renumbering (F1-F37) is clean and contiguous. |
| No epic or story breakout | PASS | Features describe capabilities without decomposition into tasks, stories, or sprints. No dependency graphs or agent assignments. |
| NFRs are user-facing | PASS | All NFRs are framed as user expectations ("feels conversational", "within 10 minutes", "never sees another user's data"). No implementation-level targets. The new "Audit entries are append-only and tamper-evident" NFR walks the line but is acceptable -- it describes a user-observable property of the system (immutability), not an implementation mechanism. |
| User flows present | PASS | Eight detailed user flows covering all five personas, including happy paths and key variant flows (approval vs. denial, conditions clearing loop, HMDA tension). Flow 2 now reflects the conversational-only path (no form-based variant). |
| Phasing describes capability milestones | PASS | Each of the 6 phases opens with a "Capability milestone" paragraph describing what the system can do. Feature lists supplement milestone descriptions. Phase 5 is explicitly a polish/hardening phase with no new features. Phase 6 is the additive cut line. |

## Findings

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| A-01R | Positive | Previous Finding Resolution | Phase rebalancing resolves the foundation scope overload |
| A-02R | Positive | Previous Finding Resolution | HMDA isolation strengthened at every stage including document extraction |
| A-03R | Positive | Previous Finding Resolution | P1/P2 features cleanly isolated in Phase 6 with explicit cut line |
| A-04R | Positive | Previous Finding Resolution | Conversational-only F4 removes dual-path complexity |
| A-05 | Suggestion | Phasing / Risk | Phase 4 is now the largest phase and carries schedule risk |
| A-06 | Suggestion | OpenShift AI | Natural OpenShift AI integration points to consider during architecture |
| A-07 | Suggestion | Feature Clarity | Agent security measures in F14 would benefit from adversarial testing scope clarification |
| A-08 | Positive | Plan Quality | Audit trail immutability as P0 is the correct call |
| A-09 | Positive | Plan Quality | Downstream notes tiering improves architecture actionability |
| A-10 | Positive | Plan Quality | Success metrics tagged by audience resolve ambiguity |

## Detailed Findings

### A-01R: Phase rebalancing resolves the foundation scope overload [Positive]

My original A-01 noted that the old Phase 1 had 16 features compressed into a single phase, effectively combining the infrastructure foundation with the entire borrower experience. I recommended that architecture would need to split Phase 1 into sub-phases.

The rebalancing to 6 phases resolves this cleanly:
- **Phase 1** (8 features: F1, F2, F14, F18, F20, F21, F22, F25): Foundation + public experience. This is the right grouping -- RBAC, observability, demo data, setup, model routing, and HMDA architecture are all foundation concerns. The public assistant (F1, F2) is the simplest persona experience and a natural first delivery.
- **Phase 2** (8 features: F3, F4, F5, F6, F15, F19, F27, F28): Borrower experience + document processing + audit trail. This is coherent -- all features center on the borrower persona and its supporting infrastructure.
- **Phases 3-4** split the employee experiences (LO in Phase 3, underwriter/CEO/deployment in Phase 4).
- **Phase 5** is dedicated polish -- no new features.
- **Phase 6** collects all P1/P2 features as an explicit cut line.

The simplification of F4 to conversational-only further reduces Phase 2 complexity. The dual-path workflow was one of my specific concerns in the original A-01 ("The dual-path application workflow alone -- conversational AI plus structured form, both collecting the same data, with the AI aware of form progress -- is a substantial feature"). That complexity is now gone.

Phase 1 key risks now explicitly call out that "Compliance knowledge base storage and retrieval architecture should be included in the foundation even though F10 is delivered in Phase 3." This addresses my original A-07 (compliance KB Phase 1 dependency).

### A-02R: HMDA isolation strengthened at every stage including document extraction [Positive]

My original A-02 flagged that the HMDA dual-data-path requirement was architecturally significant but understated in the plan. Three changes strengthen it:

1. **F5 now includes explicit demographic data filtering in document extraction:** "Document analysis must never extract demographic data (race, ethnicity, sex); if demographic data is detected in an uploaded document, it is flagged, excluded from extraction, and the exclusion is logged in the audit trail." This closes a gap I had mentally noted -- the original plan specified HMDA isolation at the storage and access layers but did not address the extraction pipeline where demographic data could enter the lending data path from document content.

2. **F14 now specifies "every stage" isolation:** "HMDA demographic data isolation applies at every stage: collection, document extraction (see F5), storage, and retrieval." This makes the four-boundary isolation explicit.

3. **F19 memory isolation:** "Memory storage includes a user identifier as a mandatory isolation key, memory retrieval verifies the requesting user matches the memory owner before returning any data, and memory is never retrieved across user boundaries, even for admin or executive roles." This closes another path where HMDA data could theoretically leak -- through cross-user conversation history that might reference demographic collection.

4. **New risk entry:** "HMDA data leaks into lending decision path via document extraction" is now a separate risk with its own mitigation. Good.

This is a comprehensive strengthening. The HMDA isolation is now specified at all four stages and will drive a strong architectural boundary. My ADR for this will be well-supported by the product plan.

### A-03R: P1/P2 features cleanly isolated in Phase 6 with explicit cut line [Positive]

My original A-03 flagged that the old Phase 3 bundled P0 and P1 features with no explicit delineation of which features were minimum viable versus stretch. The new Phase 6 resolves this:

- Phases 1-4 contain only P0 features.
- Phase 5 is hardening/polish with no new features.
- Phase 6 contains all 9 P1/P2 features (F29-F37) and is explicitly described as "designed to be the cut line."
- Within Phase 6, P1 features (F29-F33) are prioritized over P2 features (F34-F37) if partial delivery is possible.

This gives me a clear architecture target: design the core system for Phases 1-4 P0 features, and ensure the data model and agent infrastructure can support Phase 6 features as additive extensions without architectural rework.

### A-04R: Conversational-only F4 removes dual-path complexity [Positive]

F4 previously required both a conversational AI path and a structured form-based path, with the AI aware of form progress. This was architecturally novel but complex -- it required the application data model to be path-agnostic while the UI layer supported both modalities, and the agent needed to track form state.

The simplification to conversational-only is the right call for PoC maturity. It reduces the frontend complexity (no form component library needed for the application workflow), eliminates the AI-form synchronization problem, and focuses the demo on the core differentiator: conversational AI for mortgage applications. My architecture can design a single data collection path through the agent, which is simpler to audit, test, and demonstrate.

My memory file noted this as "Architectural Challenge #4: Dual-path application workflow." I will update this.

### A-05: Phase 4 is now the largest phase and carries schedule risk [Suggestion]

Phase 4 includes 9 features: F9, F10, F11, F12, F13, F16, F17, F23, F26. This is the largest phase and combines three major persona experiences (underwriter workspace, CEO dashboard, compliance/fair lending) plus container deployment. The phase risk section acknowledges "This is the largest phase" and notes schedule pressure.

From an architecture perspective, this is manageable because:
- F9 (Underwriter Workspace) and F12 (CEO Dashboard) are largely frontend + agent configuration work that builds on the data model and RBAC foundation from Phases 1-2.
- F10 (Compliance KB) is a RAG infrastructure feature that is partially addressed by Phase 1 foundation work (storage/retrieval architecture).
- F16 (Fair Lending Guardrails) and F17 (Regulatory Awareness) are primarily agent prompt engineering and guardrail configuration.
- F23 (Container Deployment) is DevOps work that can proceed in parallel with feature work.
- F26 (Adverse Action Notices) is a document generation feature that builds on the underwriter decision workflow (F11).

However, I note that Phase 4 combines the three most architecturally distinct persona experiences: the underwriter's compliance-heavy workspace, the CEO's analytics-driven dashboard, and the fair lending guardrails that tie them together. If schedule pressure forces cuts within Phase 4, the architecture needs to support partial delivery. I will design Phase 4 features with internal dependency awareness so that F9/F11 (underwriter core) can ship independently of F12/F13 (CEO analytics) if needed.

**Impact:** Low. This is a schedule observation that I will address through internal dependency management in the architecture.

### A-06: Natural OpenShift AI integration points to consider during architecture [Suggestion]

The stakeholder has indicated that the architecture should use OpenShift AI where it makes sense without forcing unnatural patterns. The downstream notes include "Consider OpenShift AI platform differentiation: model serving integration, namespace isolation mirroring application RBAC, data science pipeline for knowledge base building." I see several natural integration points:

1. **Model Serving (F21):** OpenShift AI provides model serving infrastructure (KServe, vLLM, and Caikit-TGIS serving runtimes). Model routing (F21) should be designed so that the model endpoint configuration can point to OpenShift AI model serving endpoints. In production, different model sizes (fast/small for simple queries, capable/large for complex reasoning) could be served from separate OpenShift AI model serving instances. This is a natural fit that requires no architectural contortion.

2. **Namespace Isolation mirroring RBAC (F14):** OpenShift namespaces could mirror the application's data isolation boundaries. For example, the HMDA data path could run in a separate namespace from the lending decision path, providing infrastructure-level isolation that reinforces application-level isolation. This is an operational enhancement that adds defense-in-depth to the HMDA separation architecture. Worth noting in the ADR as a production deployment pattern.

3. **Data Science Pipeline for Knowledge Base (F10):** OpenShift AI includes pipeline capabilities (based on Kubeflow Pipelines / Tekton) that could be used for the compliance knowledge base build pipeline: document ingestion, chunking, embedding generation, and index building. This is a natural fit for the content curation parallel workstream noted in Phase 1.

4. **Observability (F18):** OpenShift AI provides model monitoring capabilities. While LangFuse is mandated for agent-level observability, OpenShift AI model monitoring could complement it for infrastructure-level metrics (GPU utilization, inference latency, model serving health). This is additive, not conflicting.

5. **S3-Compatible Object Storage:** OpenShift AI deployments typically include S3-compatible object storage (via OpenShift Data Foundation or MinIO). Document storage (F5) is a natural fit for object storage, and the same infrastructure could store compliance knowledge base source documents.

I will evaluate each of these during architecture work and include them as deployment-mode options (local dev vs. OpenShift AI production) rather than hard requirements. The architecture should work without OpenShift AI for local development but take advantage of it when deployed on the platform.

**Impact:** None on the product plan. These are architecture-scope decisions that I will address in deployment architecture and relevant ADRs.

### A-07: Agent security measures in F14 would benefit from adversarial testing scope clarification [Suggestion]

F14 now includes agent security: "input validation on agent queries to detect and reject adversarial prompts, tool access re-verification at execution time before any tool invocation (not just at session start), and output filtering to prevent out-of-scope data from appearing in agent responses." F16 also mentions adversarial testing: "Adversarial testing applies to both fair lending guardrails and RBAC boundaries."

This is a good addition. One minor gap: the plan specifies the defense mechanisms (input validation, tool re-verification, output filtering) and mentions adversarial testing, but does not clarify whether adversarial testing is a development-time activity (test suite with adversarial prompts) or a runtime capability (real-time detection and logging of adversarial attempts). For architecture purposes, I will design for both: a test suite of adversarial prompts that runs as part of CI, and runtime logging of detected adversarial attempts as audit trail entries.

The risk table entry "Agent prompt injection bypasses RBAC or leaks HMDA data" rates likelihood as "High" with "High" impact and includes multi-layer defense. This is the correct risk posture.

**Impact:** Low. I have enough information to design the agent security architecture. The testing scope question is a detail I can resolve during architecture/technical design.

### A-08: Audit trail immutability as P0 is the correct call [Positive]

F15 now includes: "The audit trail is append-only -- no modification or deletion of entries is permitted. Audit entries include sequential IDs or timestamps with integrity guarantees. Attempted tampering (if detected) is itself logged."

This promotion from a nice-to-have to a P0 Must Have is architecturally significant and correct. An audit trail that can be modified is not meaningfully an audit trail for regulated industries. The append-only requirement will drive specific database design choices (append-only tables, possibly using database triggers or application-level enforcement) and will be part of the audit trail ADR.

The "tamper-evident" language is appropriately scoped for PoC maturity -- it does not require cryptographic chaining (which would be a production hardening concern) but does require that the system detects and logs obvious modification attempts.

### A-09: Downstream notes tiering improves architecture actionability [Positive]

The downstream notes are now split into "Architecture-Critical" and "Informational" tiers. The Architecture-Critical tier includes 12 notes that "must influence the architecture design and should be addressed in ADRs or the architecture document." The Informational tier includes 6 notes that "inform documentation, demo preparation, or later phases but do not constrain the architecture."

This tiering directly addresses my workflow: I can focus my architecture work on the 12 Architecture-Critical notes and defer the Informational notes to the Technical Writer and DevOps agents. The new notes include:

- Real authentication via identity provider (Keycloak suggested but not mandated -- my decision).
- OpenShift AI platform differentiation (addressed in A-06 above).
- Document lifecycle data model unification (F5/F27/F28 overlap).
- CEO analytics decoupled from mortgage schema for extensibility.

All of these were concerns I would have raised regardless. Having them pre-identified saves architecture discovery time.

### A-10: Success metrics tagged by audience resolve ambiguity [Positive]

Success metrics now include an "Audience" column tagging each metric as "Demo", "Quickstart", or "Both." This resolves a subtle ambiguity from the original plan: some metrics (like "Summit demo readiness") clearly target the demo audience, while others (like "Local setup time") target Quickstart users. The tagging makes it clear which metrics I need to architect for from day one (Both) versus which can be addressed in specific deployment configurations.

## Architecture Feasibility Assessment

All features in the updated plan are technically feasible given the constraints. The major architectural challenges from my original review remain valid but are now better supported by the plan:

1. **HMDA data isolation** -- Strengthened. Four-stage isolation (collection, extraction, storage, retrieval) with explicit document extraction filtering. Ready for ADR.

2. **Five-persona RBAC** -- Unchanged and well-specified. The addition of document access controls per role (CEO: metadata only) adds specificity that helps architecture. The real identity provider requirement is a welcome addition -- simulated auth would have been a credibility problem for a security-focused demo.

3. **Audit trail with decision traceability** -- Strengthened by append-only immutability and tamper-evidence requirements. Ready for ADR.

4. **Conversational application workflow (F4)** -- Simplified from dual-path to conversational-only. This reduces complexity significantly and is more tractable for PoC maturity.

5. **Three-tier compliance knowledge base (F10)** -- Unchanged. Phase 1 foundation now explicitly includes the RAG pipeline infrastructure.

6. **Agent-per-persona with role-scoped tools** -- Strengthened by agent security requirements (input validation, tool re-verification, output filtering).

One new architectural consideration: the 6-phase delivery structure means I should design the architecture so that each phase is independently deployable and testable. Phase boundaries should align with clean integration boundaries in the architecture. This is a positive constraint -- it forces good separation of concerns.

## Downstream Notes Assessment

The Architecture-Critical downstream notes are comprehensive. My original review noted one gap: no downstream note about database selection. This gap persists -- the constraints specify Python + FastAPI + Pydantic but do not mandate a database. Given the data model complexity (application state, audit events with immutability, document metadata, conversation history, HMDA isolation, demo data seeding, aggregate analytics), database selection remains a significant ADR. I will address this during architecture work.

All 12 Architecture-Critical notes are actionable and will map to specific sections of the architecture document or individual ADRs. The Informational notes are appropriately deferred to downstream agents.

## Previous Findings Resolution Summary

| Original ID | Severity | Status | Resolution |
|-------------|----------|--------|------------|
| A-01 | Warning | Resolved | 6-phase rebalancing reduces Phase 1 from 16 to 8 features |
| A-02 | Warning | Resolved | HMDA isolation strengthened at all four stages including document extraction |
| A-03 | Warning | Resolved | All P1/P2 features moved to dedicated Phase 6 cut line |
| A-04 | Suggestion | Resolved | Model routing remains an architecture decision; sufficient latitude provided |
| A-05 | Suggestion | Partially Resolved | Memory isolation requirements added; PoC scope note present; architecture will define persistence model |
| A-06 | Suggestion | Acknowledged | Frontend framework decision remains on my radar; downstream note unchanged |
| A-07 | Suggestion | Resolved | Phase 1 key risks now explicitly include compliance KB storage/retrieval architecture |
| A-08 | Positive | N/A | Stakeholder constraint separation remains exemplary |
| A-09 | Positive | N/A | HMDA tension remains a strong differentiator, now strengthened |
| A-10 | Positive | N/A | Persona descriptions remain rich with operational context |
| A-11 | Positive | N/A | User flows remain thorough and domain-realistic |

## Verdict

**APPROVE**

The product plan has been substantively improved since the first review. All three original Warnings are resolved. The plan provides a clear, well-phased, architecturally sound foundation for the AI Banking Quickstart. The 6-phase structure with clean P0/P1/P2 separation, the strengthened HMDA isolation at all four stages, the conversational-only F4 simplification, the audit trail immutability requirement, the agent security specifications, the downstream notes tiering, and the real authentication requirement all move the plan in the right direction.

My remaining Suggestions (Phase 4 size, OpenShift AI integration, adversarial testing scope) are architecture-scope concerns that I will address during architecture work. None require changes to the product plan.

I am ready to begin architecture work. Key ADRs I expect to produce:
1. HMDA data isolation architecture (dual-data-path with four-stage separation)
2. Database selection (PostgreSQL is the likely candidate given the data model requirements)
3. Frontend framework selection (5 persona UIs, single-command setup constraint)
4. LlamaStack abstraction layer (interface isolation per downstream notes)
5. Agent security architecture (input validation, tool re-verification, output filtering)
6. Audit trail architecture (append-only, tamper-evident, decision-traceable)
7. Deployment architecture (local dev vs. OpenShift AI production modes)
