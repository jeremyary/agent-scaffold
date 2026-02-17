# Requirements Review: Architect

**Artifact:** Requirements (hub + 5 chunks)
**Reviewer:** Architect
**Date:** 2026-02-16
**Architecture Reference:** `plans/architecture.md` v1.3

## Summary

The requirements document is comprehensive, well-structured, and demonstrates strong traceability to both the product plan and the architecture. The hub/chunk organization is effective for managing 125 stories across 5 phases. Cross-cutting concerns (REQ-CC-01 through REQ-CC-22) correctly encode the architecture's key invariants (HMDA isolation, three-layer RBAC, four-layer agent security, append-only audit trail).

I found **no critical architecture contradictions**. The issues below are primarily internal consistency problems (count mismatches, cross-reference errors, event_type enumeration gaps) and a small number of architecture alignment issues that, if left unresolved, would cause ambiguity during technical design.

**Verdict: APPROVE** with the expectation that the Warning and Suggestion items below are addressed or dispositioned before technical design begins.

## Findings

### Warning

**W-1: Story count mismatch between chunk headers and actual content**

Chunk 1 header states "Story count: 26 stories" but the file contains 32 story headings (matching the hub's story map table). Chunk 2 header states "24 stories" but the file contains 31 story headings (again matching the hub). Chunk 2's own feature breakdown in the header (5+4+4+3+5+4+3+3) sums to 31, contradicting the "24 stories" claim in the same paragraph.

The hub story map is correct (32+31+11+31+20 = 125). The chunk header counts are stale from an earlier draft.

**Location:** `plans/requirements-chunk-1-foundation.md` line 20 ("Story count: 26"), `plans/requirements-chunk-2-borrower.md` line 5 ("24 stories")
**Suggested Resolution:** Update chunk 1 header to "32 stories" and chunk 2 header to "31 stories" to match the actual content and the hub story map.

---

**W-2: CEO document access restriction layer count inconsistency (four vs. five)**

The architecture (Section 4.2) defines **four** enforcement layers for CEO document access restriction: API endpoint, Service method, Query layer, and Audit trail. REQ-CC-03 in the hub also lists exactly four layers, matching the architecture.

However, S-1-F14-04 in chunk 1 describes **five** layers, adding "agent tool authorization" as a fifth layer (referred to as "REQ-CC-03 Layer 5" in acceptance criteria and "five layers" in the Notes section). This fifth layer is not present in either the architecture or the hub's REQ-CC-03.

The agent tool authorization concept is real (it exists in the architecture at Section 4.3 and in REQ-CC-12), but it is part of the general agent security model, not a specific CEO document access enforcement layer. Treating it as a fifth layer conflates two separate architectural concerns.

**Location:** `plans/requirements-chunk-1-foundation.md` lines 445, 457, 465 (S-1-F14-04)
**Suggested Resolution:** Either (a) remove the fifth layer from S-1-F14-04 and align to the architecture's four-layer model, or (b) if agent tool authorization should indeed be a CEO-specific enforcement layer, update REQ-CC-03 in the hub and Section 4.2 in the architecture to include five layers. Option (a) is recommended -- agent tool authorization already prevents the CEO from accessing document content tools through the general mechanism in REQ-CC-12, so it does not need to be a special "Layer 5" of document access restriction.

---

**W-3: Incorrect cross-reference in S-4-F9-03 (REQ-CC-03 used for application state verification)**

S-4-F9-03 states: "the tool authorization check (REQ-CC-03) verifies the application state." REQ-CC-03 is about CEO document access restriction and has nothing to do with application state verification.

The acceptance criterion is testing whether an underwriter can invoke risk assessment on an application that has not been submitted to underwriting. This is a business rule (state guard), not a RBAC rule. It is closest to the application state machine in the hub (Section: Application State Machine), but no cross-cutting concern explicitly covers state-guard validation on tool invocations.

**Location:** `plans/requirements-chunk-4-underwriting.md` line 145
**Suggested Resolution:** Remove the "(REQ-CC-03)" reference. If application state guards on tool invocations should be a cross-cutting concern (reasonable, since multiple features use state-based tool restrictions), add a new REQ-CC (e.g., REQ-CC-23) defining the pattern. Otherwise, describe the state guard as a feature-specific business rule without cross-referencing a CC.

---

**W-4: event_type enumeration in REQ-CC-10 is incomplete**

REQ-CC-10 defines the audit event schema with `event_type` values: `query, tool_call, data_access, decision, override, system`. However, stories throughout the chunks use additional event_type values that are not in this enumeration:

- `state_transition` -- used in multiple stories for application state changes (e.g., S-3-F8-04)
- `security_event` -- used in S-2-F15-01 for rejected prompt injections and output filter redactions
- `hmda_collection` -- implied by S-1-F25-01 (HMDA collection events logged)
- `hmda_exclusion` -- used in S-2-F5-04 (demographic exclusion events)
- `compliance_check` -- used in F11 stories for compliance verification events
- `communication_sent` -- used in S-3-F24-03 for LO communication drafting events

REQ-CC-08 also lists "every state transition" and "every security event" as mandatory audit events, reinforcing that these event types exist but are not reflected in the REQ-CC-10 schema.

**Location:** `plans/requirements.md` line 290 (REQ-CC-10 event_type list)
**Suggested Resolution:** Expand the REQ-CC-10 event_type enumeration to include all event types actually used by stories: `query, tool_call, data_access, decision, override, system, state_transition, security_event, hmda_collection, hmda_exclusion, compliance_check, communication_sent`. This also updates the architecture's conceptual schema (Section 3.4) which uses the same six-value list.

---

**W-5: Technology leakage in cross-cutting concerns**

Several cross-cutting concerns specify implementation details that belong in the technical design, not in requirements:

- **REQ-CC-05** specifies PostgreSQL role names (`lending_app`, `compliance_app`), schema names (`hmda`), and grant details (`INSERT+SELECT on audit_events`). These are architecture details that the requirements should reference by principle ("separate database roles with least-privilege access"), not by specific implementation.
- **REQ-CC-06** specifies the enforcement mechanism (`grep -r`). Requirements should state "CI check prevents HMDA schema access outside Compliance Service" without prescribing the tool.
- **REQ-CC-09** specifies `prev_hash`, `SHA-256`, and `pg_advisory_lock`. Requirements should state "tamper evidence via cryptographic hash chain with serialized computation" without naming the algorithm or PostgreSQL feature.

This is a pattern, not isolated incidents. The cross-cutting concerns read more like a technical specification than requirements.

**Location:** `plans/requirements.md` lines 239-255 (REQ-CC-05), line 255 (REQ-CC-06), lines 276-280 (REQ-CC-09)
**Suggested Resolution:** This is a judgment call. For a PoC where the requirements analyst and implementers are AI agents that benefit from precision, the technology specificity may be intentional and helpful. If the stakeholder considers this acceptable for the project's maturity level, disposition as "Dismiss" with that rationale. If requirements purity is preferred, replace implementation specifics with behavioral descriptions and move the details to the technical design.

---

### Suggestion

**S-1: Chunk 4 self-reports "28 stories" but contains 31**

Similar to W-1 but in chunk 4. The chunk header claims 28 stories but actual heading count is 31. The hub correctly lists 31 stories for chunk 4.

**Location:** `plans/requirements-chunk-4-underwriting.md` (header area -- verify exact line)
**Suggested Resolution:** Update to "31 stories" to match the hub and actual content.

---

**S-2: S-2-F15-05 includes PostgreSQL advisory lock implementation details**

S-2-F15-05 (advisory lock ensures serial hash chain computation) specifies `pg_advisory_lock(audit_chain_lock_id)` as a specific function call. This is technology leakage into a user story. The architecture already defines the mechanism; the requirement should state the behavioral expectation ("hash chain computation is serialized to prevent race conditions") and reference the architecture.

**Location:** `plans/requirements-chunk-2-borrower.md` (S-2-F15-05 acceptance criteria)
**Suggested Resolution:** Replace `pg_advisory_lock` references with "serialization mechanism per architecture Section 3.4" and keep the behavioral criteria (only one hash computation at a time, no concurrent writes corrupt the chain).

---

**S-3: S-5-F39-05 mentions "ClickHouse directly" as a data access path**

S-5-F39-05 states the backend "queries the LangFuse API (or ClickHouse directly if LangFuse exposes SQL access)." This introduces an either/or implementation decision into a requirement. Requirements should state the data need ("model monitoring metrics sourced from observability infrastructure") and leave the access mechanism to technical design.

**Location:** `plans/requirements-chunk-5-executive.md` S-5-F39-05 acceptance criteria (line ~1215)
**Suggested Resolution:** Replace "queries the LangFuse API (or ClickHouse directly if LangFuse exposes SQL access)" with "queries model monitoring metrics from the LangFuse observability backend." The specific access mechanism (API vs. direct DB) is a technical design decision.

---

**S-4: Assumption REQ-C5-A-02 flags a dependency that should be verified earlier**

REQ-C5-A-02 states "LangFuse exposes an API or SQL access to ClickHouse for querying trace metrics" with risk level "High." This assumption directly affects F39 (model monitoring overlay) feasibility. It should be validated during Phase 1 when LangFuse is deployed (F18), not left as an assumption until Phase 4a.

**Location:** `plans/requirements-chunk-5-executive.md` assumptions table (line ~1277)
**Suggested Resolution:** Add a verification task to Phase 1's F18 (LangFuse integration) stories: "verify LangFuse API supports querying aggregated trace metrics (latency percentiles, token counts, error rates) needed by F39." This shifts verification from "hope" to "planned."

---

**S-5: Hub open question REQ-OQ-02 (LangGraph PostgreSQL checkpointer) may be stale**

REQ-OQ-02 asks whether LangGraph's PostgreSQL checkpointer is adequate for F19 (conversation memory). The chunk 2 stories (S-2-F19-01 through S-2-F19-04) already assume LangGraph checkpointer is the implementation mechanism and write detailed acceptance criteria around it. Either the open question has been resolved (in which case it should be marked resolved) or the stories are premature in assuming the answer.

**Location:** `plans/requirements.md` REQ-OQ-02
**Suggested Resolution:** If the LangGraph PostgreSQL checkpointer decision is firm (it is -- per architecture Section 3.5), mark REQ-OQ-02 as resolved with a reference to architecture Section 3.5.

---

### Positive

**P-1: Excellent HMDA isolation coverage across chunks**

The four-stage HMDA isolation architecture is faithfully translated into requirements across all relevant chunks: collection endpoint isolation (chunk 1, F25), demographic data filter during extraction (chunk 2, F5), compliance service sole accessor (chunk 4, F38), and pre-aggregated exposure for CEO (chunk 5, F12). The cross-chunk consistency on this critical compliance concern is strong.

---

**P-2: Cross-cutting concerns effectively codify architecture invariants**

REQ-CC-01 through REQ-CC-22 successfully translate architecture decisions into enforceable requirements that apply across all stories. This is particularly valuable for three-layer RBAC (REQ-CC-01), agent security (REQ-CC-12), and audit completeness (REQ-CC-08). Downstream implementers can check any story against these CCs without re-reading the architecture.

---

**P-3: Architecture consistency notes in each chunk are valuable**

Each chunk includes an "Architecture Consistency Notes" section that explicitly maps its stories to architecture sections. This is good practice that aids both review (this review) and downstream technical design. The self-assessment is accurate in all cases except the five-layer issue noted in W-2.

---

**P-4: Application state machine and role-permission matrix in the hub provide a single source of truth**

The hub's application state machine (9 states, role-permission matrix for transitions) is well-defined and consistently referenced by stories across all chunks. Stories that involve state transitions correctly reference the hub's state machine rather than redefining it.

---

## Architecture Consistency Assessment

| Architecture Concern | Alignment Status | Notes |
|---------------------|-----------------|-------|
| HMDA four-stage isolation | Aligned | All four stages covered across chunks 1, 2, 4, 5. Pre-aggregation enforcement explicit. |
| Three-layer RBAC | Aligned | REQ-CC-01 matches architecture. Stories correctly reference all three layers. |
| Four-layer agent security | Aligned | REQ-CC-12 matches architecture Section 4.3. F26 stories cover all four layers. |
| Append-only audit trail | Aligned (minor) | REQ-CC-09 matches architecture. Technology leakage noted (W-5) but correctness is fine. |
| Dual PostgreSQL roles | Aligned | REQ-CC-05 correctly describes lending_app / compliance_app separation. |
| CEO document access | Misaligned (minor) | Hub/architecture say 4 layers; chunk 1 says 5 layers (W-2). |
| Event type enumeration | Misaligned | Hub/architecture list 6 types; stories use 12+ types (W-4). |
| Template-aligned project structure | Aligned | File paths in stories use `packages/api/`, `packages/ui/`, `packages/db/` consistently. |
| Compose profiles | Aligned | F22 stories correctly reference compose profiles from architecture Section 7. |
| Helm deployment | Aligned | F23 stories correctly reference Helm charts per ADR-0007 amendment. |
| Conversation persistence | Aligned | F19 stories match architecture Section 3.5 (LangGraph checkpointer, user-scoped isolation). |
| TrustyAI integration | Aligned | F38 stories correctly describe library-level integration within Compliance Service per architecture Section 3.3. |

## Verdict

**APPROVE**

The requirements are architecturally sound. The five warnings are internal consistency issues (count mismatches, cross-reference errors, enumeration gaps) and technology leakage -- none represent fundamental architecture contradictions. The suggestions are improvements that would strengthen the document but are not blocking. All findings can be resolved with targeted edits that do not change the scope or structure of the requirements.
