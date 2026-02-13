<!-- This project was developed with assistance from AI tools. -->

# Product Plan Review -- Architect

**Reviewer:** Architect
**Artifact:** plans/product-plan.md
**Date:** 2026-02-12

## Verdict: REQUEST_CHANGES

## Scope Compliance Check

Evaluation against the six-point Product Plan Review Checklist from `review-governance.md`:

### 1. No technology names in feature descriptions

**FAIL.** The feature descriptions are largely clean, but there are violations:

- "Credit analysis with mocked credit bureau" (P0) -- acceptable since "credit bureau" is a domain concept, not a technology choice.
- "Conversational intake agent" (P1) -- mentions "knowledge base of regulations and guidance documents" which implies RAG but does not name a technology. Acceptable.
- The **Stakeholder-Mandated Constraints** section correctly isolates technology mandates (LangGraph, PostgresSaver, Claude, GPT-4 Vision, pgvector, LangFuse, FRED API, BatchData, Redis, MinIO, React 19, FastAPI, SQLAlchemy, etc.) into a dedicated table rather than weaving them into features. This is well done.
- However, the **Real Services** table in "Mocked vs. Real Services" (line 384-388) embeds technology names: "Database with vector search", "Cache", "Object Storage" are generic enough, but "LLM Observability Service" and "Federal Economic Data API" are borderline -- they describe service categories rather than naming products, so I consider this acceptable.

**Result: PASS** -- technology names are properly isolated in the Constraints section.

### 2. MoSCoW prioritization used

**PASS.** Features are organized as Must Have (P0), Should Have (P1), Could Have (P2), and Won't Have. Each feature is individually listed with a priority label. There are no numbered epics or dependency maps in the feature scope section itself.

### 3. No epic or story breakout

**PASS.** Features are described as capabilities with priority levels. There are no dependency graphs, entry/exit criteria, or agent assignments in the Feature Scope section.

However, the **Phased Roadmap** section comes close to violating this. Each phase lists specific features with their priority labels (e.g., "Automated document data extraction with confidence scoring (P0)"). This is acceptable because the phases describe capability milestones, not sprint plans. But the level of specificity in assigning features to phases creates an implicit dependency map. See Warning W-1 below.

### 4. NFRs are user-facing

**PASS.** The Non-Functional Requirements section explicitly notes: "All non-functional requirements are framed as user-facing outcomes. Implementation-level targets belong in the Architecture document." The NFRs use phrasing like "feels prompt", "within a brief wait", "feel instantaneous" rather than specific latency targets. Well done.

### 5. User flows present

**PASS.** Four detailed user flows are documented covering all primary personas: Loan Officer (Flow 1), Compliance Officer (Flow 2), Borrower (Flow 3), and Developer (Flow 4). Each flow walks through a complete journey with numbered steps.

### 6. Phasing describes capability milestones

**PASS.** Each phase opens with a "Capability milestone" paragraph describing what the system can do at the end of that phase. Phase 1: "working loan application lifecycle, functional multi-agent orchestration pattern...". Phase 2: "performs real AI-powered document analysis and credit evaluation." Etc.

**Overall Scope Compliance: 6/6 PASS** (with one Warning noted below about implicit dependency mapping in phasing).

---

## Findings

### Critical

**C-1: Human-in-the-loop review deferred to Phase 4 while auto-approval exists from Phase 2.**

The plan introduces confidence-based routing in Phase 2, which means high-confidence applications would be auto-approved starting in Phase 2. But the human-in-the-loop review workflow is deferred to Phase 4. This creates a gap in Phases 2-3 where:

- Medium and low-confidence applications have nowhere to go -- the routing logic sends them to a review queue that does not exist yet.
- The system must either block these applications indefinitely or implement a temporary workaround (which the plan does not describe).

This is an architecture dependency the phasing does not account for. Either the human review workflow must move to Phase 2 (at least a minimal version), or the plan must explicitly state how medium/low-confidence applications are handled before Phase 4.

**Cited text:** Phase 2 features include "Confidence-based routing and escalation (P0)" while Phase 4 includes "Human-in-the-loop review workflow (P0)".

**C-2: Complete immutable audit trail deferred to Phase 3 while auditable actions begin in Phase 1.**

The audit trail is listed as a Phase 3 feature, but audit-worthy events (application state transitions, authentication, role-based access) begin in Phase 1, and agent decisions with confidence scores begin in Phase 2. If the audit trail infrastructure is not in place from Phase 1, these early events will not be captured, and retrofitting audit trail recording onto existing code is architecturally expensive.

The audit trail should be foundational infrastructure in Phase 1, not a Phase 3 feature. At minimum, the event recording mechanism and append-only storage pattern must exist from Phase 1, even if the full audit trail query/export UI comes later.

**Cited text:** Phase 3 includes "Complete immutable audit trail (P0)" while Phase 1 already has application lifecycle management and RBAC.

---

### Warning

**W-1: Phased feature assignment creates implicit dependency constraints for the Architect.**

While the phasing correctly describes capability milestones (passing checklist item 6), the explicit assignment of individual features to phases (e.g., "PII protection in LLM interactions (P1)" in Phase 2) creates a binding constraint that the Architecture may need to violate for technical reasons. For example, PII protection may need to be foundational rather than Phase 2 if the audit trail captures LLM inputs from Phase 1.

The plan should clarify whether the Architect has latitude to shift features between phases for technical dependency reasons, or whether the phase assignments are fixed.

**W-2: "Database with vector search" as a single data store creates a scaling coupling.**

The Stakeholder-Mandated Constraints specify "PostgreSQL with pgvector for both application data and RAG embeddings (single database, no separate vector DB)." While this is a stakeholder mandate (not a product plan decision), the product plan does not flag this as a risk. Combining transactional loan data with vector similarity search in a single database creates a scaling coupling: RAG query load affects loan processing latency and vice versa. This should be noted in the Key Risks section so the Architecture can address it with connection pooling or schema isolation strategies.

**W-3: Phase 3 is overloaded relative to other phases.**

Phase 3 includes nine features spanning three distinct capability areas: remaining analysis agents (risk, compliance), the complete audit trail, the entire public-facing tier (intake agent, calculator, external data integrations, streaming), and sentiment analysis. This is significantly more work than any other phase. The risk of Phase 3 becoming a bottleneck is high. The plan should acknowledge this and give the Architect or Project Manager latitude to split Phase 3 if needed.

**W-4: Workflow persistence deferred to Phase 4 creates a reliability gap.**

"Workflow persistence across service restarts" is a Phase 4 feature, but multi-agent workflows begin executing in Phase 2. If a service restarts during Phases 2-3, in-progress applications will be lost. The NFR section states: "In-progress workflows resume from their last checkpoint after a service restart with no data loss." This NFR will not be met until Phase 4, which should be explicitly acknowledged.

The stakeholder-mandated constraint of LangGraph with PostgresSaver already implies persistent checkpointing as a core capability of the orchestration framework. This should be foundational, not deferred.

**W-5: Auth token format embeds role in bearer token (cross-ref: API Designer C-1).**

The stakeholder-mandated `Authorization: Bearer <role>:<key>` format (line 558) embeds the authorization role in the authentication token. This is architecturally unusual -- standard Bearer token semantics treat the token as an opaque credential, with the server resolving permissions from the token's identity, not from a role claim embedded in the token itself. The architecture must decide whether the role in the token is authoritative (the token IS the role) or advisory (the server validates the role against a user-role mapping). The former is simpler but means role changes require new tokens; the latter is more correct but adds a lookup. This needs to be resolved before the auth middleware is designed.

**W-6: Streaming transport and notification patterns unspecified (cross-ref: API Designer C-2, W-1).**

The plan specifies streaming chat responses (P1) and polling for workflow status updates (Won't Have: "Real-time collaborative editing -- UI uses polling for status updates"), but does not address: (a) the transport mechanism for streaming chat (SSE vs WebSocket), and (b) how clients learn that async document processing is complete (polling interval, webhook, or event stream). These are architecture-level decisions because they determine which protocols the backend must support, whether the API gateway needs WebSocket upgrade capability, and whether there is a unified event delivery mechanism or two separate patterns (streaming for chat, polling for workflow). The plan should at minimum acknowledge that the Architecture will resolve these transport decisions.

---

### Suggestion

**S-1: Clarify the LLM failure mode strategy in the product plan.**

The plan mentions "Transient failures from external AI services are retried automatically" in NFRs but does not address sustained LLM outages. For a system that depends on LLM APIs for its core workflow (document analysis, credit reasoning, compliance checking), the product plan should state what happens when the LLM is unavailable for an extended period. Options include: queue applications for later processing, degrade to manual-only mode, or fail explicitly. This affects architecture significantly.

**S-2: Define the boundary between "mocked" and "stub" more precisely.**

Phase 1 mentions a "single stub agent" for the multi-agent workflow, while the Mocked vs. Real Services section describes mocked external services. The difference between a stub agent (returns hardcoded data to prove orchestration) and a mocked service (implements a real interface with synthetic data) is architecturally important. The plan should clarify that Phase 1 agents are stubs (proving orchestration flow) while mocked services (credit bureau, property data) implement full interface contracts from their introduction.

**S-3: Consider explicitly stating the data migration strategy between phases.**

As the schema evolves across five phases (Phase 1 introduces applications, Phase 2 adds document metadata, Phase 3 adds audit events, etc.), the plan should state whether seed data is regenerated each phase or whether migrations preserve existing seed data. This affects both developer experience (existing test data survives upgrades) and architecture (migration strategy).

---

### Positive

**P-1: Excellent separation of stakeholder-mandated constraints from product decisions.**

The "Stakeholder-Mandated Constraints" section with source attribution is exactly the right pattern. It gives the Architect clear technology mandates with provenance while keeping the feature descriptions technology-agnostic. This is a model for how product plans should handle externally-imposed technology decisions.

**P-2: NFRs are genuinely user-facing.**

The NFR section successfully avoids implementation-level targets. Phrases like "feels prompt", "within a brief wait", "feel instantaneous" give the Architecture room to define concrete targets while keeping the product plan focused on outcomes. The explicit note that "Implementation-level targets belong in the Architecture document" is a good practice.

**P-3: Mocked services designed with real interface contracts.**

The explicit principle that "The mock is a different implementation, not a different interface" is architecturally sound. It enables the swap-in-real-service upgrade path without code changes, which is essential for a quickstart that teams will customize.

**P-4: User flows are detailed and persona-specific.**

All four user flows walk through complete journeys with enough specificity to derive acceptance criteria. The Developer flow (Flow 4) is particularly valuable because it validates the quickstart's primary purpose -- teaching multi-agent patterns.

**P-5: Clear Won't Have list prevents scope creep.**

The explicit Won't Have section with ten specific exclusions (multi-tenancy, mobile, i18n, HA, custom ML training, etc.) gives downstream agents clear boundaries. This is valuable for preventing scope creep during architecture and implementation.

---

## Cross-References from Teammate Reviews

**Auth token format -- three-way convergence (Architect W-5 / API Designer C-1 / Security Engineer C-1).** All three reviewers independently flagged the `Authorization: Bearer <role>:<key>` format. The Security Engineer correctly escalated this to Critical severity: embedding a client-asserted role in the bearer token creates a privilege escalation vector where a client can claim `reviewer` role with a `loan_officer` key. From an architecture perspective, I defer to the Security Engineer's Critical severity -- the privilege escalation risk is more severe than the architectural awkwardness I originally flagged at Warning level.

**Data-at-rest encryption (Security Engineer C-2).** The Security Engineer identified that the product plan specifies no encryption-at-rest requirements despite storing SSNs, tax returns, and credit data. This is architecturally relevant: the Architecture must specify whether encryption is handled at the database level (PostgreSQL TDE), filesystem level, or application level. The product plan's Security NFRs should include a data-at-rest protection requirement so the Architecture has a clear mandate.

**PII redaction timing (Security Engineer W-1).** The Security Engineer flagged that PII protection in LLM interactions is a Phase 2 feature but LLM calls begin in Phase 2 as well. This reinforces my W-1 (Architect latitude to shift features between phases) -- PII redaction must be present from the first LLM call, not added as a separate feature after LLM usage is already established.

---

## Summary

The product plan is well-structured with strong scope discipline -- it passes all six checks on the Product Plan Review Checklist. The stakeholder constraint isolation and user-facing NFRs are particularly well done. However, the phasing has two critical dependency issues: human-in-the-loop review is needed before Phase 4 (since confidence-based routing begins in Phase 2), and the audit trail must be foundational from Phase 1 (since auditable events begin immediately). Phase 3 is overloaded and should be acknowledged as a splitting risk. The three-way convergence on the auth token format (all reviewers flagged it independently) and the Security Engineer's data-at-rest encryption finding add further items requiring resolution. These findings must be resolved before the Architecture phase can proceed, because the component dependency order and security posture directly determine the architecture's layering strategy.
