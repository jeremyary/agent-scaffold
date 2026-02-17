# Consolidated Review: Requirements

**Reviews consolidated:** requirements-review-product-manager.md, requirements-review-architect.md, requirements-review-orchestrator.md
**Date:** 2026-02-16
**Verdicts:** Product Manager: REQUEST_CHANGES, Architect: APPROVE, Orchestrator: REQUEST_CHANGES

## Summary

- Total findings across all reviews: 28
- De-duplicated findings: 18
- Reviewer disagreements: 0
- Breakdown: 3 Critical, 6 Warning, 5 Suggestion, 4 Positive

## Triage Required

### Critical (must fix before proceeding)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| C-1 | F13 CEO Conversational Analytics covers only audit trail access -- business analytics drill-down (the primary F13 purpose per product plan Flow 6 steps 3-8) has no stories | PM (C-2), Orchestrator (C-1) | chunk-5, S-5-F13-01 to S-5-F13-05 | Add 3-4 stories: pipeline/performance questions, comparative queries ("this quarter vs. last"), specific LO/application by name, fair lending drill-down | **Fix** |
| C-2 | Consent/disclosure logging and audit data export have zero stories -- two explicit F15 capabilities from product plan (Flow 2 step 8, export for regulators) | PM (C-1) | Absent from all chunks | Add 2 stories: (1) disclosure acknowledgment with timestamps logged (chunk 2), (2) audit export in CSV/JSON format (chunk 5) | **Fix** |
| C-3 | F17 Loan Estimate and Closing Disclosure document generation missing -- TRID compliance checks verify timing of documents that were never generated | Orchestrator (C-2) | chunk-4 F17, also absent from chunk 2 | Add 2 stories: LE generation at application submission, CD generation at closing stage. Both carry "simulated" disclaimer per REQ-CC-17 | **Fix** |

### Warning (should fix)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| W-1 | Feature ID remapping between product plan and requirements is undocumented -- 9 features were absorbed, split, or renumbered creating downstream confusion | PM (W-1), Orchestrator (W-1) | Hub requirements.md, Coverage Validation Table | Add "Product Plan Feature Mapping" table to hub showing bidirectional ID translation | **Fix** |
| W-2 | Story count discrepancies -- chunks 1, 2, 4 headers claim 26/24/28 but contain 32/31/31 stories | PM (W-2), Architect (W-1, S-1) | Chunk 1 line 20, chunk 2 line 5, chunk 4 header | Update header text to match actual counts (32, 31, 31) | **Fix** |
| W-3 | F6 (Application Status + Timeline) narrowed to document completeness only -- returning-borrower status scenario (Flow 3) has no dedicated acceptance criteria | PM (W-3), Orchestrator (W-2) | chunk-2, S-2-F6-01 to S-2-F6-03 | Add 1-2 stories: borrower asks status and gets stage/timeline/next-steps; agent notes regulatory deadlines | **Fix** |
| W-4 | event_type enumeration in REQ-CC-10 lists 6 values but stories use 12+ types (state_transition, security_event, hmda_collection, hmda_exclusion, compliance_check, communication_sent missing) | Architect (W-4) | Hub requirements.md line 290 (REQ-CC-10) | Expand enumeration to include all event types used by stories | **Fix** |
| W-5 | CEO document access layer count inconsistency -- architecture/hub say 4 layers, chunk 1 S-1-F14-04 says 5 layers (adds agent tool auth as Layer 5) | Architect (W-2) | chunk-1 S-1-F14-04 lines 445, 457, 465 | Remove fifth layer from S-1-F14-04; agent tool auth is already covered by REQ-CC-12 | **Fix** |
| W-6 | Technology leakage -- 160+ technology name references embedded in acceptance criteria (Keycloak, PostgreSQL roles, pg_advisory_lock, LangFuse callbacks, table/column names) | PM (W-4), Architect (W-5) | All chunks, concentrated in chunk 1 and hub cross-cutting concerns | Add hub-level note that tech references reflect architecture v1.3 choices, not requirements-level mandates. Soften most egregious cases (table names, function names). Full rewrite disproportionate. | **Dismiss** -- tech precision is helpful for AI agent implementers at PoC maturity; architecture choices are stable |

### Suggestions (improve if approved)

| # | Finding | Flagged By | Location | Suggested Resolution | Disposition |
|---|---------|-----------|----------|---------------------|-------------|
| S-1 | Add "Product Plan Feature Mapping" table to hub for bidirectional ID translation | PM (S-1), Orchestrator (S-2) | Hub requirements.md | Table with columns: PP Feature ID, PP Name, Req Feature IDs, Story IDs | **Improvement** (covered by W-1 Fix) |
| S-2 | Incorrect cross-reference in S-4-F9-03 -- cites REQ-CC-03 (CEO doc access) for application state verification | Architect (W-3) | chunk-4 line 145 | Remove REQ-CC-03 ref; optionally add REQ-CC-23 for state-guard validation | **Improvement** |
| S-3 | S-5-F39-05 introduces either/or implementation decision (LangFuse API vs. ClickHouse direct) | Architect (S-3) | chunk-5 S-5-F39-05 | Replace with "queries metrics from LangFuse observability backend" | **Improvement** |
| S-4 | LangFuse API capability assumption (REQ-C5-A-02) should be verified in Phase 1 (F18), not left to Phase 4a | Architect (S-4) | chunk-5 assumptions table | Add verification task to Phase 1 F18 stories | **Improvement** |
| S-5 | Distinguish data vs. behavioral dependencies in hub dependency map | PM (S-3) | Hub requirements.md, Inter-Feature Dependency Map | Add "Type" column: data, behavioral, or infrastructure | **Improvement** |

### Positive (no action needed)

- Cross-cutting concerns (REQ-CC-01 through REQ-CC-22) are precisely defined and testable -- all three reviewers
- Edge case and adversarial scenario coverage is consistently strong across all chunks -- PM, Orchestrator
- Hub/chunk architecture is effective; application state machine is well-defined and consistently referenced -- all three reviewers
- Co-borrower support is properly specified in chunk 2 -- PM, Orchestrator
