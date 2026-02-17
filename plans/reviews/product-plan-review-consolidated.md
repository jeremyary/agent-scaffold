# Consolidated Review: Product Plan

**Reviews consolidated:** product-plan-review-architect.md, product-plan-review-security-engineer.md, product-plan-review-orchestrator.md
**Date:** 2026-02-16
**Verdicts:** Architect: APPROVE, Security Engineer: REQUEST_CHANGES, Orchestrator: APPROVE

## Summary

- Total findings across all reviews: 35
- De-duplicated findings: 22
- Reviewer disagreements: 1
- Breakdown: 4 Critical, 7 Warning, 7 Suggestion, 4 Positive

## Triage Required

### Critical (must fix before proceeding)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| C-1 | Agent prompt injection — no defense against adversarial prompts bypassing RBAC, leaking data, or exfiltrating HMDA data via agent tool access | Security Engineer (SEC-PP-01) | F1, F3, F7, F9, F12/F13, F14, F16 | Add agent security requirements to F14/F16: input validation on agent queries, tool access verification at execution time, output filtering, adversarial testing. Add prompt injection risk to Risks table. | **Fix** |
| C-2 | HMDA data leakage via document analysis — document extraction pipeline (F5) could extract and expose demographic data that should be isolated from lending decisions | Security Engineer (SEC-PP-02) | F5, F33, F14 | Extend F5: document analysis must never extract demographic data; detected demographic data is flagged, excluded, and logged. Extend F14: HMDA isolation applies at every stage including document extraction. Add risk to Risks table. | **Fix** |
| C-3 | Uploaded documents contain unmasked PII — CEO partial PII masking applies to structured fields but raw uploaded documents bypass this control | Security Engineer (SEC-PP-03) | F5, F14 | Extend F14 with document access controls per role: CEO sees document metadata only, not raw content. If document redaction is out of scope, explicitly restrict CEO from raw document access. Add risk to Risks table. | **Fix** |
| C-4 | Audit trail immutability not specified — F15 describes comprehensive audit capabilities but does not require append-only, tamper-evident storage | Security Engineer (SEC-PP-04), Architect (A-02 related) | F15, Downstream Notes | Promote from downstream note to F15 Must Have requirement: append-only storage, sequential IDs or integrity guarantees, attempted tampering is logged. | **Fix** |

### Warning (should fix)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| W-1 | Phase 1 scope overload — 16 P0 features including several individually large ones (F4, F5, F14, F15, F20); high schedule risk with no descoping strategy for Phase 1 | Architect (A-01), Orchestrator (O-01) | Phasing — Phase 1 | Rebalance phases — more phases are acceptable. Keep phases balanced. Last phase holds all additive (P1/P2) features as an easily identifiable group; that phase is OK to be overloaded. | **Fix** |
| W-2 | HMDA dual-data-path requirement understated — data isolation requires two fundamentally different data access paths, not just access control rules; likelihood rated Low but should be Medium | Architect (A-02), Security Engineer (SEC-PP-02 related) | F33, F14, Flow 8 | Architect to design HMDA isolation as first-class architectural boundary (ADR). Update HMDA risk likelihood from Low to Medium. | **Fix** |
| W-3 | Phase 3 bundles P0 and P1 features with no explicit cut line — 13 features (9 P0 + 4 P1) in the final phase before Summit | Architect (A-03), Orchestrator (O-02) | Phasing — Phase 3 | Move all P1/P2 additive features to a dedicated final phase, clearly labeled as additive. This phase is OK to be overloaded — the goal is easy identification of what can be cut. | **Fix** |
| W-4 | Feature numbering gaps — non-contiguous IDs (F24 in P1, F25 moved to P0, F33-F37 added late) create downstream confusion | Orchestrator (O-03) | Feature Scope | Renumber features to be contiguous within each priority tier. No lookup table needed. | **Fix** |
| W-5 | F4 (dual-path application) embeds implementation-level detail — form-aware chat and correction handling prescribe integration patterns that belong in TD | Orchestrator (O-04) | F4 | Soften to user-outcome language: "borrower can get help while filling out the form" without prescribing real-time form awareness mechanism. | **Fix** |
| W-6 | No document access controls or retention policy — F5 does not specify who can access which documents or document lifecycle management | Security Engineer (SEC-PP-05) | F5, F14 | Add document access controls to F14 RBAC specification per role. Retention and deletion policy can be deferred to Won't Have if out of scope. | **Fix** |
| W-7 | Memory isolation threat model unclear — F19 mentions per-user scoping but no defense against session hijacking, memory poisoning, or cross-user extraction via agent queries | Security Engineer (SEC-PP-06) | F19, F14 | Add to F19/F14: memory storage includes user ID as mandatory filter key; retrieval verifies requesting user matches memory owner; memory never retrieved across user boundaries. | **Fix** |

### Reviewer Disagreements

| # | Issue | Location | Reviewer A | Reviewer B | Disposition |
|---|-------|----------|-----------|-----------|-------------|
| D-1 | Severity of audit trail immutability | F15 | Security Engineer: Critical (SEC-PP-04 — audit log integrity is a critical control for regulated financial services; without immutability the traceability claims are meaningless) | Architect: not flagged as a standalone finding (referenced in downstream notes as something to address in architecture) | **Resolved — Security Engineer severity (Critical) accepted; C-4 disposition is Fix** |

### Suggestions (improve if approved)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| S-1 | F21 (Model Routing) routing criteria underspecified — static config vs. dynamic classifier not decided | Architect (A-04) | F21 | Stakeholder to indicate preference; static configuration-driven approach is dramatically simpler and may suffice for PoC. Architect can decide during architecture if no preference. | **Defer** — let architect decide downstream |
| S-2 | F19 (Cross-Session Memory) scope and persistence model need bounds — duration, volume, literal recall vs. summarization | Architect (A-05) | F19 | Architect to design simple per-user conversation persistence at PoC maturity with upgrade path noted. Stakeholder input on whether CEO cross-session memory is a key demo moment. | **Improvement** |
| S-3 | F10 (Compliance Knowledge Base) content curation has Phase 1 dependency — RAG pipeline architecture needed in Phase 1, content curation is a parallel workstream | Architect (A-07) | F10, Phasing | Architect to include compliance KB storage/retrieval architecture in Phase 1 foundation even though F10 is Phase 3. No product plan change needed. | **Improvement** |
| S-4 | Phase 2 is light (4 features) and could absorb some Phase 1 scope to reduce risk | Orchestrator (O-05) | Phasing | Absorbed into W-1/W-3 resolution: rebalance all phases, more phases acceptable. | **Fix** (covered by W-1/W-3) |
| S-5 | F5, F35, F36 have overlapping document/data tracking concerns — downstream agents may make conflicting data model assumptions | Orchestrator (O-06) | F5, F35, F36 | Flag as explicit integration point for Architect. Architecture should define single data model for document lifecycle satisfying all three features. | **Improvement** |
| S-6 | Downstream Notes lack priority signals — 12 notes presented as flat list with no grouping by urgency | Orchestrator (O-07) | Downstream Notes | Group or tag notes: architecture-critical (RBAC at API layer, audit immutability, HMDA separation, LlamaStack isolation) vs. informational (Build Your Own Persona, Day Two story). | **Improvement** |
| S-7 | Success Metrics mix demo-audience and Quickstart-audience concerns without distinguishing | Orchestrator (O-08) | Success Metrics | Add an "Audience" column (Demo, Quickstart, Both) so downstream agents know which test scenarios to design for each metric. | **Improvement** |

### Not Included (addressable downstream, no product plan change needed)

The following findings were noted by reviewers but are explicitly downstream concerns requiring no product plan modification:

- **Architect A-06:** Frontend framework decision — Architect will handle via ADR
- **Security Engineer SEC-PP-07:** Simulated auth implications — add prominent security warning in README during documentation phase
- **Security Engineer SEC-PP-08:** BSA/AML/KYC scope ambiguity — minor clarification, already handled by Won't Have section
- **Security Engineer SEC-PP-09:** Audit data retention policy — PoC concern, document in NFRs that retention is undefined for PoC
- **Database selection gap** (Architect): No downstream note about database choice — Architect to address via ADR

### Positive (no action needed)

- Stakeholder constraint separation is exemplary — technology mandates correctly quarantined in dedicated section with explicit attribution -- Architect (A-08), Orchestrator (O-09)
- HMDA collection-versus-refusal tension is a strong architectural differentiator, threaded consistently through features, flows, risks, and phasing -- Architect (A-09), Orchestrator (O-11)
- Persona descriptions include operational context (read-only visibility, partial PII, processor duty absorption) that directly drives architecture -- Architect (A-10)
- User flows demonstrate realistic domain complexity and serve as near-complete acceptance test narratives -- Architect (A-11), Orchestrator (O-12)
- Won't Have section is exceptionally thorough with 14 specific exclusions and rationale -- Orchestrator (O-10)
- Proxy discrimination awareness (F16) goes beyond basic bias refusal -- Security Engineer (SEC-PP-11)
- Decision traceability, override tracking, and data provenance are first-class audit concerns -- Security Engineer (SEC-PP-12)
- HMDA data separation architecture correctly identified as Phase 1 hard requirement -- Security Engineer (SEC-PP-10)
