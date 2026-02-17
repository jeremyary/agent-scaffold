# Architecture Review: AI Banking Quickstart -- Summit Cap Financial

**Reviewer:** Code Reviewer
**Artifact:** `plans/architecture.md` + ADRs 0001-0007
**Date:** 2026-02-16
**Review Phase:** SDD Phase 5 -- Architecture Review

## Executive Summary

This is a well-structured architecture document that demonstrates clear thinking about component boundaries, data isolation, and defense-in-depth security. The dual-data-path HMDA isolation, three-layer RBAC enforcement, and configuration-driven agent definitions are thoughtfully designed for both the PoC demo and future extensibility. The document stays appropriately at the boundary level without descending into API contracts or handler logic.

The primary concerns are (1) an ambiguity in how the monolith's internal service boundaries will be enforced at the code level, which risks becoming a shared-state soup during implementation, (2) the hash chain audit trail design introduces a serial insertion bottleneck whose failure mode is underdocumented, and (3) a missing discussion of how the nine-container local stack degrades gracefully when optional services (LangFuse, LlamaStack) are unavailable. None of these are blocking -- all are addressable with targeted clarifications.

## Checklist Assessment

| # | Check | Verdict | Notes |
|---|-------|---------|-------|
| 1 | Component boundaries are clear | Pass | Each component has a defined responsibility, technology, and interface surface. Domain services, agent layer, and gateway have distinct roles. |
| 2 | Technology decisions include trade-off analysis | Pass | All seven ADRs include Options Considered with pros/cons. Decisions are justified. |
| 3 | Integration patterns are explicit | Pass | Section 8 documents sync (HTTP/REST + direct Python calls), async (WebSocket), document upload (multipart POST + background task), and observability (LangFuse callbacks). WebSocket message protocol is specified. |
| 4 | Deployment model addresses operational concerns | Pass | Section 7 covers Docker Compose, Kustomize, startup ordering, resource requirements, and remote vs. local inference modes. |
| 5 | ADRs present for significant decisions | Pass | Seven ADRs cover all major decisions: HMDA isolation, database, frontend, LlamaStack, agent security, audit trail, deployment. |
| 6 | No product scope changes | Pass | Section 13 verifies product plan consistency. No new features introduced. Architecture stays within the product plan feature set. |
| 7 | No detailed API contracts or implementation details | Partial | Mostly boundary-level, but Section 3.4 includes a conceptual audit event schema and Section 8.2 includes a WebSocket message protocol that are close to contract-level detail. These are borderline -- useful for clarity but technically downstream scope. |

## Findings

| ID | Severity | Category | Summary |
|----|----------|----------|---------|
| CR-A01 | Warning | Component Boundaries | Monolith internal module boundaries lack enforcement mechanism |
| CR-A02 | Warning | Data Architecture | Hash chain serial insertion creates a failure mode that is not addressed |
| CR-A03 | Warning | Deployment | No graceful degradation strategy for optional infrastructure services |
| CR-A04 | Suggestion | Integration Patterns | WebSocket reconnection and error recovery not addressed |
| CR-A05 | Suggestion | Data Architecture | HMDA schema isolation verification is described but not defined as a CI check |
| CR-A06 | Suggestion | Project Structure | Test directory structure not specified for integration/e2e tests |
| CR-A07 | Suggestion | Component Boundaries | Compliance Service dual-schema bridging responsibility deserves explicit interface documentation |
| CR-A08 | Positive | Architecture | Configuration-driven agent definitions are excellently designed for extensibility |
| CR-A09 | Positive | Architecture | HMDA four-stage isolation is comprehensive and verifiable |
| CR-A10 | Positive | Architecture | Defense-in-depth RBAC at three layers prevents single-point authorization failures |
| CR-A11 | Positive | Data Architecture | Dual-data-path diagram makes the HMDA isolation immediately comprehensible |

## Detailed Findings

### CR-A01 (Warning): Monolith internal module boundaries lack enforcement mechanism

**Location:** Architecture Section 8.1, lines 591-593

The architecture states: "The service boundaries are enforced by module structure and interface contracts, not by network boundaries." However, the document does not specify what mechanism prevents one domain service from directly importing and calling another's internal functions, or from directly accessing database tables that belong to a different domain. In a Python monolith, "module structure" alone does not enforce boundaries -- any service can `import` any other module.

This is a real risk during implementation. When eight domain services (Application, Document, Underwriting, Compliance, Audit, Analytics, Conversation, Knowledge Base) all share the same process, a developer taking a shortcut to meet a deadline will reach across module boundaries. The Compliance Service's exclusive access to the `hmda` schema (ADR-0001) is the most critical boundary -- if an underwriting service developer adds a direct query to the `hmda` schema, the four-stage isolation is broken.

**Suggestion:** Add a brief statement about the enforcement strategy. Options include: (a) a lint rule or import checker that flags cross-boundary imports, (b) a convention that each service exposes a public interface module and all internal modules are prefixed with underscore, (c) a CI check that greps for `hmda` schema references outside the Compliance Service (the architecture already mentions this as a verification approach in Section 3.3 but does not formalize it as a CI step). The architecture does not need to prescribe the implementation, but it should acknowledge that Python module boundaries are conventions, not enforcement, and state the intended mitigation.

### CR-A02 (Warning): Hash chain serial insertion creates a failure mode that is not addressed

**Location:** Architecture Section 3.4, lines 320-324; ADR-0006 lines 59-63, 96

The audit trail uses a hash chain where each event includes a SHA-256 hash of the previous event's ID + content. ADR-0006 acknowledges "events must be inserted in order" and that "at PoC scale, this is not a bottleneck." However, neither the architecture nor the ADR addresses what happens when a hash chain computation fails mid-insert -- for example, if two concurrent requests attempt to insert audit events simultaneously. At PoC scale with a single FastAPI worker, this may rarely occur, but with multiple async coroutines handling concurrent WebSocket connections and HTTP requests, concurrent audit inserts are plausible.

The failure mode matters: if two events get the same `prev_hash` (because they both read the previous event before either committed), the chain forks and subsequent verification detects a false positive "tamper." If serialization is enforced via database locking, it becomes a latency bottleneck on every auditable operation.

**Suggestion:** Add a brief note on the concurrency strategy for hash chain inserts. Options include: (a) a PostgreSQL advisory lock around audit inserts (simple, low contention at PoC scale), (b) accepting that the hash chain may have gaps/forks and the verification procedure accounts for this, (c) deferring the hash chain to a background process that chains events after they are inserted (append-only guarantee remains via grants/triggers, tamper evidence is slightly delayed). The architecture should state which approach will be used so the Technical Design is not ambiguous.

### CR-A03 (Warning): No graceful degradation strategy for optional infrastructure services

**Location:** Architecture Section 7.2, lines 545-562

The Docker Compose stack includes nine containers. Some of these are arguably optional for core functionality: LangFuse (observability), Redis and ClickHouse (LangFuse dependencies), and potentially LlamaStack (if using remote inference directly). The architecture documents the startup sequence and health checks but does not address what happens if an optional service fails to start or goes down during operation.

For a PoC whose primary success metric is "runs reliably through a complete demo walkthrough without crashes," understanding which services are truly required and which are additive is important. A developer whose Docker host has limited RAM (the 8GB remote-inference config) may need to skip LangFuse to stay within resource limits.

**Suggestion:** Add a brief degradation table or note identifying which services are required (PostgreSQL, Keycloak, API, Frontend) versus optional (LangFuse stack, LlamaStack if using remote inference). For optional services, note the behavior when they are absent -- for example, "If LangFuse is unavailable, agent execution continues without observability tracing; the callback handler logs a warning and degrades to no-op." This helps both the Technical Design and the DevOps setup documentation.

### CR-A04 (Suggestion): WebSocket reconnection and error recovery not addressed

**Location:** Architecture Section 8.2, lines 595-611

The WebSocket message protocol is well-defined, but the architecture does not mention what happens when the WebSocket connection drops mid-conversation (network interruption, browser sleep, mobile network switch). Since chat is the primary interaction mode for four of five personas, and cross-session memory (F19) implies conversations that may span hours or days, reconnection behavior affects user experience.

**Suggestion:** Add a brief note on the reconnection strategy at the boundary level. For example: "The frontend reconnects automatically on WebSocket disconnection. Conversation state is recoverable from the checkpoint (F19), so a dropped connection does not lose conversation context. The reconnection sends the last known event ID to avoid duplicate messages." This is boundary-level guidance, not implementation detail.

### CR-A05 (Suggestion): HMDA schema isolation verification should be formalized

**Location:** Architecture Section 3.3, line 286

The architecture mentions "Code-level verification: grep for `hmda` schema references outside the Compliance Service" as a verification approach. This is exactly the right idea, but it is listed as a one-time verification, not as a CI check that prevents regression.

**Suggestion:** Elevate this from a verification note to an architectural decision: "A CI lint check verifies that no code outside `services/compliance/` references the `hmda` schema. This prevents regression during multi-developer implementation." This is particularly important because the HMDA isolation is the system's most critical compliance boundary.

### CR-A06 (Suggestion): Test directory structure not specified

**Location:** Architecture Section 10, lines 686-732

The project structure shows `tests/` directories under both `packages/api/` and `packages/frontend/`, but does not indicate where integration tests and end-to-end tests live. The testing rules (`testing.md`) specify "Integration/e2e tests in dedicated `tests/` directory." Given that this system has significant cross-service interactions (agent -> domain service -> database, WebSocket -> agent -> tool -> service), the test structure affects how implementers organize their work.

**Suggestion:** Add `tests/integration/` and `tests/e2e/` to the project structure, or clarify whether they are nested under `packages/api/tests/`.

### CR-A07 (Suggestion): Compliance Service bridging responsibility deserves more definition

**Location:** Architecture Section 2.4, lines 175-176; ADR-0001 lines 63-65

The Compliance Service is the sole accessor of the `hmda` schema and also queries lending outcome data to compute aggregate statistics. ADR-0001 notes: "This bridging service must itself be carefully audited." However, the architecture does not specify how the Compliance Service combines HMDA data with lending outcomes for aggregate statistics. This bridging is the most sensitive code in the system -- it is the one place where demographic data and lending decisions coexist in the same service, and the interface must ensure that only aggregate results (not individual-level joins) are exposed.

**Suggestion:** Add a brief note to the Compliance Service description in Section 2.4 specifying the interface contract at the boundary level: "The Compliance Service exposes only aggregate statistics (e.g., approval rate by demographic segment). It does not expose any API that returns individual HMDA records joined with lending decisions. The aggregation happens inside the service; consumers receive pre-aggregated results." This gives downstream implementers a clear constraint.

### CR-A08 (Positive): Configuration-driven agent definitions

**Location:** Architecture Section 2.3, lines 137-143

The agent definition approach -- system prompt template, tool registry, data access scope, and model routing rule all declared in YAML configuration -- is excellently designed. It satisfies the product plan's extensibility requirement (a Quickstart user can add a persona by adding configuration) while keeping agent logic clean. The separation of agent configuration from agent infrastructure code will make implementation straightforward and make the "Build Your Own Persona" tutorial natural to write.

### CR-A09 (Positive): HMDA four-stage isolation is comprehensive

**Location:** Architecture Section 3.3, lines 274-314

The four-stage isolation (collection, extraction, storage, retrieval) is thorough and each stage has a documented verification approach. The data flow diagram in Section 3.3 makes the separation immediately clear to anyone reading the architecture. This is the system's most critical compliance boundary and the architecture treats it with appropriate rigor.

### CR-A10 (Positive): Three-layer RBAC enforcement

**Location:** Architecture Section 4.2, lines 384-398

Enforcing authorization at the API gateway, domain services, and agent layer independently is well-reasoned defense in depth. The key insight -- "even if a middleware bug skips scope injection, the service layer blocks unauthorized data access" -- shows the Architect is thinking about failure modes, not just happy paths. The data access matrix (lines 402-412) provides a clear reference for implementers.

### CR-A11 (Positive): HMDA dual-data-path diagram

**Location:** Architecture Section 3.3, lines 289-314

The ASCII data flow diagram showing the separation between the HMDA collection path and the document extraction path is immediately comprehensible. It communicates in seconds what paragraphs of text would struggle to convey. This is the kind of diagram that will be invaluable during implementation -- developers can reference it to verify they are working on the correct data path.

## Verdict

**APPROVE**

The architecture is well-structured, appropriately scoped for PoC maturity, and stays within the product plan's feature set. Component boundaries are clear, technology decisions are well-justified through ADRs, integration patterns are explicit, and the deployment model is practical. The three Warning findings (module boundary enforcement, hash chain concurrency, graceful degradation) are important clarifications that should be addressed before Technical Design begins, but they do not represent architectural flaws -- they are gaps in the specification of known concerns. The architecture provides a solid foundation for downstream work.
