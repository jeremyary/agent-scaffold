# Architecture Review -- Orchestrator Assessment

**Artifact:** `plans/architecture.md` + `plans/adr/0001` through `plans/adr/0007`
**Reviewer:** Orchestrator (main session)
**Date:** 2026-02-16
**Review type:** Cross-cutting coherence, scope discipline, downstream feasibility

## Executive Summary

The architecture document is thorough, well-structured, and demonstrates strong alignment with the approved product plan. It covers all 28 P0 features, introduces no unauthorized scope, and provides sufficient guidance for downstream agents (Requirements Analyst, Tech Lead, implementers) to act without ambiguity on most concerns. The seven ADRs cover all significant technology decisions with honest trade-off analysis.

The most notable strengths are the HMDA four-stage isolation design (ADR-0001), which is the most architecturally distinctive element and is consistently enforced across every section that touches data access, and the defense-in-depth agent security model (ADR-0005). The architecture successfully balances PoC-appropriate implementation quality with production-viable structure.

The findings below focus on cross-cutting coherence issues, assumption gaps, and areas where downstream agents could interpret the architecture differently -- things the Code Reviewer and Security Engineer are less likely to catch from their specialist vantage points.

## Findings Summary

| ID | Severity | Finding | Section |
|----|----------|---------|---------|
| O-01 | Warning | WebSocket/SSE fallback strategy is underspecified -- frontend and backend sections describe it differently | 2.1, 8.2 |
| O-02 | Warning | Compliance Service bridging role creates an implicit assumption gap about database role separation | 3.3, ADR-0001, ADR-0006 |
| O-03 | Warning | Async document processing mechanism is described but the notification path back to the user is ambiguous | 2.5, 8.3 |
| O-04 | Suggestion | Hash chain sequential insert dependency conflicts with future concurrent-user scaling | 3.4, ADR-0006 |
| O-05 | Suggestion | Analytics domain materialized view refresh strategy is unaddressed | 3.2, 9.3 |
| O-06 | Suggestion | Open question OQ-A5 (compliance KB content review timeline) is more of a project management concern than an architecture open question | 12 |
| O-07 | Positive | HMDA isolation is consistently enforced across all sections -- no gaps found | 3.3, 2.3, 2.5, 4.2, 4.3 |
| O-08 | Positive | Configuration-driven agent definitions make extensibility claims credible | 2.3, 9.3, 10 |
| O-09 | Positive | ADR consistency is excellent -- all seven ADRs cross-reference each other correctly and tell a coherent story | 11, ADR-0001 through 0007 |
| O-10 | Suggestion | The Keycloak database dependency creates an ambiguity in the startup sequence | 7.2, ADR-0007 |

## Detailed Findings

### O-01: WebSocket/SSE Fallback Strategy Is Underspecified (Warning)

**Section:** 2.1 (Frontend Application), 8.2 (Streaming Communication)

**Finding:** Section 2.1 states: "Server-Sent Events (SSE) as a fallback if WebSocket is problematic in certain deployment environments." Section 8.2 describes the WebSocket message protocol in detail but does not mention SSE at all. The architecture does not specify:

1. Under what conditions SSE would be used instead of WebSocket.
2. Whether the API gateway must implement both a WebSocket and an SSE endpoint.
3. Whether the frontend detects the failure and falls back automatically, or whether this is a deployment-time configuration choice.
4. Whether the message protocol defined in 8.2 also applies to SSE (which is server-to-client only, so the client-to-server path would need to be HTTP POST).

**Why this matters for downstream agents:** The Tech Lead designing the chat interface will need to decide whether to implement both protocols or defer SSE. If both are required, the API surface doubles for the chat endpoint. If SSE is deferred, it should be explicitly stated. The Requirements Analyst may write acceptance criteria expecting SSE support, leading to unnecessary implementation work.

**Recommendation:** Either commit to WebSocket-only for PoC (noting SSE as a production upgrade path) or specify the fallback mechanism concretely. Given PoC maturity, WebSocket-only is the simpler choice.

---

### O-02: Compliance Service Bridging Role Creates a Database Role Assumption Gap (Warning)

**Section:** 3.3 (HMDA Data Isolation), ADR-0001, ADR-0006

**Finding:** ADR-0001 specifies that the HMDA schema is accessible only by the Compliance Service's database role, and the lending service database role has no grants on the `hmda` schema. ADR-0006 specifies that the application connects with a role (`summit_cap_app`) that has INSERT+SELECT-only on audit tables.

The Compliance Service must: (a) read from the `hmda` schema, (b) read from the lending data schema to correlate HMDA demographics with lending outcomes for aggregate statistics, and (c) write audit events.

This implies the Compliance Service either uses the same `summit_cap_app` role (which should not have `hmda` schema access) or uses a different database role. If it uses a different role, the architecture does not specify this. If it uses the same role with additional grants, the "lending service database role has no grants on the `hmda` schema" statement is technically violated (since the Compliance Service shares a process with the lending services per Section 8.1).

**Why this matters for downstream agents:** The Database Engineer and Tech Lead will need to decide between multiple PostgreSQL roles (one for lending services, one for the Compliance Service) or a single role with carefully scoped grants. Since all services run in the same FastAPI process (Section 8.1), role separation requires either multiple database connections with different roles or a different isolation approach.

**Recommendation:** Explicitly address how the Compliance Service achieves database role separation when it runs in the same process as lending services. Options: (a) separate connection pool with a different role, (b) accept that at PoC maturity, application-level enforcement (the Compliance Service is the only code that queries `hmda`) is sufficient, with database role separation as a production upgrade. Either is acceptable, but the current text implies database-level role separation that the monolithic process architecture makes non-trivial.

---

### O-03: Async Document Processing Notification Path Is Ambiguous (Warning)

**Section:** 2.5 (Document Processing), 8.3 (Document Upload)

**Finding:** Section 8.3 states that after a document upload, "processing results are delivered via the chat WebSocket or polling." This is ambiguous:

1. If delivered via WebSocket, does the document processing pipeline need to know about the user's active WebSocket session? What if the user closes the chat and comes back?
2. If delivered via polling, what endpoint does the frontend poll? Is there a document status endpoint?
3. The "or" suggests both mechanisms exist, but neither is specified concretely.

Section 2.5 describes the document processing pipeline but does not address how results reach the user at all.

**Why this matters for downstream agents:** The Backend Developer implementing document upload and the Frontend Developer implementing the upload UI will interpret this differently. One may implement polling; the other may expect WebSocket push. The contract between these two components is not defined.

**Recommendation:** Pick one mechanism for PoC. The simplest: polling a document status endpoint (`GET /api/documents/{id}/status`). The chat WebSocket can also mention processing results when the user next interacts, since the borrower agent has access to document status. Specify concretely rather than leaving "or."

---

### O-04: Hash Chain Sequential Insert Dependency (Suggestion)

**Section:** 3.4 (Audit Trail Architecture), ADR-0006

**Finding:** The hash chain design requires each audit event to include `prev_hash`, which is "the SHA-256 hash of the previous event's ID concatenated with its event_data." This creates a sequential dependency: each INSERT must read the previous event before inserting. ADR-0006 acknowledges this is not a bottleneck "at PoC scale (small number of concurrent users)."

While accepted at PoC maturity, this is worth flagging because the architecture claims "PoC maturity, production structure" as a principle (Section 1.1). The hash chain design would need to be replaced entirely for production-scale concurrent inserts, not just tuned. This is a structural choice that contradicts the "supports production hardening without rearchitecture" principle.

**Recommendation:** No change needed for PoC. Note in ADR-0006 that the hash chain approach is a PoC-specific mechanism that would be replaced (not upgraded) for production, so the "upgrade path" framing is honest. The current text says "the architecture supports upgrading to Merkle trees," but replacing a hash chain with a Merkle tree is closer to a redesign than an upgrade. Being explicit about this prevents the Tech Lead from over-investing in the hash chain implementation.

---

### O-05: Analytics Materialized View Refresh Strategy (Suggestion)

**Section:** 3.2 (Schema Overview), 9.3 (Configuration Management)

**Finding:** Section 3.2 states the Analytics domain uses "views and materialized views over the application and decision data for CEO dashboard queries." Materialized views need a refresh strategy. The architecture does not specify:

1. Whether views are standard (always fresh) or materialized (stale until refreshed).
2. If materialized, how and when they are refreshed (on demand, periodic, event-triggered).
3. Whether the CEO dashboard tolerates stale data.

For PoC with 25-30 active borrowers, standard views would likely perform well. Materialized views may be unnecessary complexity.

**Recommendation:** Clarify that standard views are preferred at PoC scale, with materialized views noted as a production optimization. This prevents the Database Engineer from building refresh infrastructure that is not needed.

---

### O-06: OQ-A5 Scope (Suggestion)

**Section:** 12 (Open Questions)

**Finding:** OQ-A5 (Compliance Knowledge Base Content Review Timeline) is a detailed, multi-paragraph discussion of a project management and scheduling concern. While extremely well-written and important, it is a process question ("when does the expert review happen?") rather than an architecture question ("how is the system structured?"). It occupies significantly more space than the four actual architecture open questions (OQ-A1 through OQ-A4) combined.

**Recommendation:** Extract OQ-A5 to a separate project management artifact or note in the product plan. The architecture document should note the dependency ("Compliance KB content must be reviewed before Phase 4") and reference the detailed scheduling analysis, but the analysis itself is out of scope for the architecture document. This keeps the architecture focused on architectural concerns.

---

### O-07: HMDA Isolation Consistency (Positive)

**Finding:** The HMDA data isolation design is the strongest cross-cutting concern in this architecture, and it is handled with exceptional consistency. Every section that touches data access correctly addresses HMDA isolation:

- Section 2.3 (Agent Layer): Lending agents have no HMDA-querying tools. CEO agent has aggregates only.
- Section 2.4 (Domain Services): Compliance Service is the sole HMDA accessor.
- Section 2.5 (Document Processing): Demographic data filter in extraction pipeline.
- Section 3.3 (HMDA Data Isolation): Dedicated section with four-stage isolation.
- Section 4.2 (RBAC): Data access matrix correctly shows HMDA access for CEO (aggregates only) and no one else.
- Section 4.3 (Agent Security): Output filtering checks for HMDA data references.
- ADR-0001: Comprehensive trade-off analysis.

I found no section where HMDA isolation is assumed rather than explicitly addressed. This is exactly the kind of cross-cutting consistency that makes an architecture trustworthy for downstream agents.

---

### O-08: Configuration-Driven Agent Definitions (Positive)

**Finding:** The architecture consistently describes agent definitions as configuration-driven (YAML files with system prompts, tool registries, model routing, data access scopes). The project structure (Section 10) shows `config/agents/*.yaml` files per agent. This makes the "add a persona by adding configuration, not code" extensibility claim (Section 1.1) credible and testable.

The Code Reviewer will validate implementability; I am noting that the cross-cutting claim (extensibility for Quickstart users) is supported by the architecture, not just stated as an aspiration.

---

### O-09: ADR Consistency (Positive)

**Finding:** All seven ADRs tell a consistent, mutually reinforcing story:

- ADR-0001 (HMDA isolation) references ADR-0002 (PostgreSQL with pgvector for the `hmda` schema).
- ADR-0002 (database selection) references ADR-0001 (multi-schema support) and ADR-0006 (audit trail in same database).
- ADR-0004 (LlamaStack) correctly defines the boundary between LangGraph (agent orchestration) and LlamaStack (inference), with the dual integration path (ChatOpenAI for agents, thin wrapper for non-agent inference).
- ADR-0005 (agent security) complements ADR-0001 (HMDA isolation at the agent layer) without duplicating it.
- ADR-0006 (audit trail) correctly notes it shares a database with application data per ADR-0002 and documents the consequence.
- ADR-0007 (deployment) correctly accounts for all containers from the other ADRs.

No contradictions between ADRs were found. Trade-off analyses are honest about downsides.

---

### O-10: Keycloak Database Dependency Ambiguity (Suggestion)

**Section:** 7.2 (Container Inventory), ADR-0007

**Finding:** ADR-0007 states in the startup sequence: "Keycloak (depends on PostgreSQL for its own storage, or uses embedded H2)." The "or" creates an ambiguity: does Keycloak use the same PostgreSQL instance as the application, or its own embedded H2 database?

If Keycloak shares the application PostgreSQL, it adds tables to the same database, which could complicate migrations and the HMDA schema isolation narrative. If it uses embedded H2, it is simpler but data does not persist across container restarts without a volume.

The pre-configured realm import (`summit-cap-realm.json`) suggests Keycloak's state can be recreated from the import file, making H2 viable for PoC. But this is not stated explicitly.

**Recommendation:** State the decision explicitly. For PoC simplicity, embedded H2 with realm import on startup is likely the right choice. This avoids sharing the application PostgreSQL and keeps the Keycloak container self-contained.

## Architecture Review Checklist Assessment

| Check | Assessment |
|-------|-----------|
| **Component boundaries are clear** | PASS. Each component (Frontend, API Gateway, Agent Layer, Domain Services, Document Processing, Knowledge Base, Database, Identity Provider, LlamaStack, LangFuse) has a defined responsibility, and the document explicitly states what each component does NOT do. Section 8.1 clarifies that internal service calls are in-process function calls, not HTTP, which prevents microservice assumptions. |
| **Technology decisions include trade-off analysis** | PASS. All seven ADRs include multi-option analysis with explicit pros and cons. Decisions cite rationale. The only technology choice without a dedicated ADR is Tailwind CSS (mentioned in ADR-0003 as a sub-decision), which is low-impact enough not to warrant one. |
| **Integration patterns are explicit** | PASS with caveat. Section 8 covers synchronous (HTTP/REST), streaming (WebSocket), document upload (multipart POST), and observability (LangFuse callbacks). The caveat is the WebSocket/SSE ambiguity noted in O-01. |
| **Deployment model addresses operational concerns** | PASS. Section 7 covers both deployment modes, resource requirements, startup ordering, and the OpenShift AI integration points. ADR-0007 is thorough. |
| **ADRs present for significant decisions** | PASS. Seven ADRs cover: HMDA isolation, database selection, frontend framework, LlamaStack abstraction, agent security, audit trail, and deployment. No significant decision is missing an ADR. |
| **No product scope changes** | PASS. Section 13 explicitly verifies consistency with the product plan. I independently verified: every feature referenced in the architecture maps to a P0 feature in the product plan. No new features or capabilities are introduced. The OpenShift AI integration points (Section 7.4) are within the F23 (Container Platform Deployment) scope. |
| **No detailed API contracts or implementation details** | PASS with minor caveat. The architecture correctly avoids detailed API contracts (those belong in Technical Design). The WebSocket message protocol in Section 8.2 is borderline -- it defines a JSON message format that is close to an API contract. However, this is a reasonable level of detail for an architecture document since it clarifies the integration pattern between frontend and backend, and the Tech Lead will refine it. The HMDA collection endpoint path (`/api/hmda/collect` in ADR-0001) is similarly borderline but acceptable for the same reason. |

## Additional Assessments

### Cross-Cutting Coherence

The architecture tells a consistent story across its 13 sections and 7 ADRs. The five design principles (Section 1.1) are reflected throughout:

- **Dual-data-path isolation** is enforced in every data-touching section (confirmed in O-07).
- **Role-scoped agents** is consistent across Sections 2.3, 4.2, 4.3, and ADR-0005.
- **Append-only auditability** is consistent across Sections 3.4, 8.4, and ADR-0006.
- **Configuration-driven extensibility** is consistent across Sections 2.3, 9.3, 10, and ADR-0004.
- **PoC maturity, production structure** is maintained -- the document consistently notes where PoC shortcuts are taken and what the upgrade path is.

The only coherence issue found is the WebSocket/SSE ambiguity (O-01), which is a minor inconsistency between two sections rather than a fundamental coherence problem.

### Scope Discipline

The architecture stays strictly within the product plan's 28 P0 features. I checked for scope creep in several areas:

- **OpenShift AI integration** (Section 7.4): All five integration points are deployment-pattern enhancements within F23 scope, not new features.
- **Knowledge Base ingestion pipeline** (Section 5.2): The OpenShift AI data science pipeline is noted as a "production deployment pattern," not a PoC requirement. Appropriate scoping.
- **Model routing** (Section 6.2): Stays within F21 scope. Does not prescribe a specific routing algorithm -- notes it "could be rule-based at PoC."
- **Demo data strategy** (Section 9.4): Stays within F20 scope. Does not introduce new data requirements beyond what the product plan specifies.

No scope creep detected.

### Downstream Feasibility

The architecture provides sufficient guidance for downstream agents with three exceptions:

1. **The SSE/WebSocket ambiguity** (O-01) will force the Tech Lead to make a decision that should have been made here.
2. **The Compliance Service database role separation** (O-02) will force the Database Engineer to interpret the architecture's intent.
3. **The document processing notification path** (O-03) leaves the contract between Backend and Frontend Developers undefined.

All three are resolvable at Technical Design phase, but they would be cleaner resolved at the architecture level.

### ADR Consistency

Assessed in O-09. All seven ADRs are mutually consistent with no contradictions. The cross-referencing between ADRs is thorough and accurate.

## Verdict

**APPROVE**

The architecture is comprehensive, consistent, and well-aligned with the product plan. The three Warning findings (O-01, O-02, O-03) identify genuine ambiguities that could cause downstream confusion, but they are resolvable at the Technical Design phase and do not represent architectural flaws. The four Suggestion findings are improvements that would strengthen the document. The HMDA isolation design and ADR consistency are particularly strong.

This architecture provides a solid foundation for Requirements and Technical Design to proceed.
