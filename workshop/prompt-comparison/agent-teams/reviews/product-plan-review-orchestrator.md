<!-- This project was developed with assistance from AI tools. -->

# Product Plan Review -- Orchestrator

**Reviewer:** Orchestrator (Main Session)
**Artifact:** plans/product-plan.md
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

Two critical phasing dependency issues and one coherence gap must be resolved before the Architecture phase can proceed. These issues were independently identified by the Architect reviewer (C-1, C-2) and confirmed by this cross-cutting review.

## Focus Areas

This review asks: "What would I miss if I only read the specialist reviews?" It covers cross-cutting coherence, scope discipline, assumption gaps, downstream feasibility, and review coverage gaps.

## Findings

### Critical

**O-C1: P0 feature vs. P1 feature vs. NFR contradiction on workflow persistence.**

Three parts of the plan make conflicting statements about workflow persistence:

- **Feature Scope:** "Workflow persistence across service restarts" is classified as **P1 (Should Have)**, placed in Phase 4.
- **NFR (Reliability):** "In-progress workflows resume from their last checkpoint after a service restart with no data loss" -- stated as a baseline requirement with no priority qualifier.
- **Stakeholder-Mandated Constraints:** LangGraph with PostgresSaver checkpointing is a technology mandate.

This creates a contradiction: the NFR requires behavior that the feature scope says is P1, while the technology constraint provides the mechanism to deliver it from day one. Either:
1. Workflow persistence should be P0 and foundational in Phase 1 (since the mandated technology provides it and the NFR requires it), or
2. The NFR should be weakened to acknowledge that persistence is not available until Phase 4.

The Architect reviewer flagged this as W-4. Elevating to Critical here because the inconsistency spans three sections and will cause downstream confusion -- the Requirements Analyst won't know whether to write acceptance criteria for persistence in Phase 1 or Phase 4.

**Cross-reference:** Architect C-1 (human review gap) and C-2 (audit trail gap) are related phasing dependency issues. Together, these three findings suggest the phasing was designed around feature groupings rather than technical dependencies. The phasing should be revalidated against the dependency graph: audit trail and workflow persistence are infrastructure that everything else depends on.

---

**O-C2: P0 human review and P2 document resubmission overlap creates scope ambiguity.**

Two features describe the same capability at different priority levels:

- **P0 "Human-in-the-loop review workflow":** "Human reviewers can approve, deny, or request additional documents. Requesting documents creates a cyclic workflow back to document processing."
- **P2 "Application document resubmission workflow":** "When a human reviewer requests additional documents, the borrower can upload new documents, and the workflow resumes from the document processing stage without restarting the entire analysis."

These describe the same user action (reviewer requests more documents, borrower uploads them, workflow resumes). The P0 version says "creates a cyclic workflow back to document processing." The P2 version adds "without restarting the entire analysis." The difference appears to be implementation sophistication (full restart vs. incremental re-processing), but the product plan doesn't make this distinction explicit.

This will confuse the Requirements Analyst -- should they write P0 acceptance criteria for document resubmission that include the cyclic workflow, or only for the review decision itself?

**Recommendation:** Clarify the boundary. P0 should cover the review decision (approve/deny/request-docs) and basic document resubmission (upload triggers re-processing from scratch). P2 should cover the optimization of resuming mid-workflow without re-running completed analyses. State this distinction explicitly.

### Warning

**O-W1: Phase 3 overload is a compounding scope risk.**

Phase 3 includes nine features across three unrelated capability areas:
1. Remaining analysis agents (risk assessment, compliance, audit trail)
2. Entire public-facing tier (intake agent, calculator, external data, streaming, sentiment analysis)
3. Core workflow infrastructure (the complete audit trail)

The Architect reviewer flagged this as W-3. The cross-cutting concern is that Phase 3 is where scope creep would compound: if any Phase 2 work slips, it cascades into an already-overloaded Phase 3. The plan should either pre-authorize the Architect/PM to split Phase 3, or do the split now (e.g., Phase 3a: remaining analysis agents + audit trail; Phase 3b: public-facing tier).

**O-W2: The "Conversational intake agent" feature is a product plan disguised as a feature.**

The intake agent (P1) bundles at least six distinct capabilities: RAG-based Q&A, external data integration (FRED + BatchData), mortgage calculations, sentiment analysis, streaming responses, and cross-session context. This single feature entry is broader than most P0 features.

While the phasing splits implementation across phases (core in Phase 3, cross-session in Phase 5, sentiment as P2), the feature description in the Feature Scope section reads like a mini product plan. The Requirements Analyst will need to decompose this into multiple user stories, which is fine, but the breadth increases the risk of underestimating effort.

**Recommendation:** Consider splitting the intake agent into 2-3 more focused feature entries: (1) conversational mortgage Q&A with knowledge base, (2) external data integration and mortgage calculator tool use, (3) cross-session context and sentiment analysis. This makes priority and phasing clearer without changing scope.

### Suggestion

**O-S1: Add an explicit "dependency graph" note to the phasing section.**

The phasing section should include a brief note acknowledging that feature-to-phase assignment is subject to technical dependency analysis during the Architecture phase. This gives the Architect explicit permission to propose phase adjustments (as the Architect reviewer requested in W-1) without requiring a product plan revision for each change.

Something like: "Phase assignments are based on capability progression. The Architecture phase may adjust feature-to-phase assignments to resolve technical dependencies, subject to stakeholder approval."

**O-S2: Specify error/edge-case user flows.**

The four user flows cover happy paths effectively. The plan would benefit from at least one error-path flow:
- What does Maria see when document extraction fails for one document but succeeds for others?
- What does David see when an audit trail is incomplete (e.g., an early Phase 1 application before audit trail infrastructure existed)?
- What does Jordan see when the LLM is unavailable during a chat?

These error flows inform both the Requirements Analyst (acceptance criteria for error cases) and the Architect (error handling strategy).

### Positive

**O-P1: Scope discipline is excellent -- the strongest aspect of this plan.**

All six scope compliance checks pass (confirmed by Architect review). The separation of technology mandates into a dedicated Constraints section with source attribution is a pattern worth preserving across all future plans. Features describe capabilities without leaking implementation details. NFRs use outcome language. This discipline will make the Architecture phase significantly more productive because the Architect can make genuine design decisions rather than rubber-stamping pre-made technology choices.

**O-P2: The completion criteria are concrete and verifiable.**

The ten completion criteria in the final section are specific enough to be testable: "clone the repo, run the setup command, and have a fully functional system with seed data in under 30 minutes" is a real test, not a vague aspiration. This will translate directly into acceptance tests.

**O-P3: Open questions are honest and well-scoped.**

The plan explicitly flags five things it doesn't know (LLM costs, seed data breadth, knowledge base content, property API key availability, demo deployment target). This is better than burying unknowns as assumptions. Each open question is specific enough to be resolvable.

## Review Coverage Gaps

The following concerns are not fully covered by any specialist reviewer:

1. **User experience coherence of flows** -- The flows are detailed but no UX reviewer validates whether they represent realistic domain workflows (e.g., would a real loan officer actually follow Flow 1's sequence?). Mitigated by the product brief being informed by domain knowledge.

2. **Phasing risk assessment quality** -- Each phase lists risks, but whether those are the *right* risks is not systematically evaluated. The Architect review addressed some dependency risks but not all phase-specific risks.

3. **Mock/real service boundary correctness** -- Whether the mock/real split is drawn at the right seam is a domain question. The API Designer noted the mock interface principle is sound, but nobody specifically validated that credit bureau, employment verification, etc. are the right things to mock.

These gaps are acceptable for the product plan phase -- they will be addressed during Architecture (gap 2-3) and Requirements (gap 1).

## Summary

The product plan has excellent scope discipline and provides a strong foundation for downstream work. The critical findings center on phasing dependency issues (workflow persistence contradiction, human review/resubmission overlap) that will cause downstream confusion if not resolved. The Architect reviewer's critical findings (C-1, C-2) about audit trail and human review phasing are confirmed and reinforced here. The phasing should be revalidated against technical dependencies before proceeding to Architecture. Phase 3 overload and the breadth of the intake agent feature are secondary risks that should be acknowledged.
