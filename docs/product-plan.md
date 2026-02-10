<!-- This project was developed with assistance from AI tools. -->

# Product Plan: Multi-Agent Mortgage Loan Processing System

---

## 1. Executive Summary

We are building an AI-powered mortgage loan processing system as a **developer quickstart** for the Red Hat AI Quickstart template. The system is a reference implementation that demonstrates how to build multi-agent AI systems for regulated industries -- specifically mortgage lending. It showcases supervisor-worker orchestration via LangGraph, human-in-the-loop workflows with confidence-based escalation, compliance-first design with immutable audit trails, and fraud detection with denial coaching.

The primary audience is AI developers and solutions architects who want to learn multi-agent patterns through a compelling, production-quality code example they can clone, deploy, and customize within 2 hours. The secondary audience is the mortgage domain personas (loan officers, compliance officers, borrowers) whose workflows the system models. The system is honest about its boundaries: mocked services stand in for credit bureaus and employment verification, and it is not production-certified for actual lending.

This is an **MVP-maturity** project. That means happy-path testing plus critical edges, real API key authentication from day one, structured error handling, README plus OpenAPI documentation, and light code review. It does not mean minimal -- the stakeholder explicitly prefers feature richness and impressive demos. The system includes 8 AI agents across two independent graphs, a public-facing intake assistant with mortgage calculator, and a protected loan processing pipeline with full audit trail.

---

## 2. Problem Statement

Mortgage loan origination today suffers from five compounding problems:

| Problem | Impact |
|---------|--------|
| **Manual document review** | 3-5 hours per application. Loan officers manually extract data from pay stubs, tax returns, bank statements, and property appraisals. |
| **Inconsistent underwriting** | Different officers apply varying standards and miss risk factors, leading to approval inconsistencies and higher default rates. |
| **Regulatory complexity** | Compliance officers struggle to maintain complete audit trails across fragmented systems, risking fair lending violations and regulatory penalties. |
| **Extended processing time** | Applications take 30-45 days due to manual handoffs, missing document requests, and repeated checks. |
| **Poor explainability** | When loans are denied, officers cannot easily articulate the decision rationale, leading to customer dissatisfaction and potential discrimination claims. |

### What This System Demonstrates

An AI-powered workflow that addresses these problems through:

- Automatic extraction and validation of data from loan documents with 95%+ accuracy targets
- Routing through specialized analysis agents with transparent decision logic and confidence scores
- Escalation of low-confidence decisions to human review with full context
- Complete, immutable audit trails with explainable AI reasoning for every decision
- Adverse action notice generation with specific regulatory citations for denials
- Conceptual reduction of processing time from 30-45 days to 7-10 days for standard applications

---

## 3. Personas

### P1: AI Developer / Solutions Architect (Primary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Developer building AI-powered workflows for regulated industries |
| **Goals** | Learn multi-agent patterns (supervisor-worker, human-in-the-loop, confidence-based escalation). Clone, deploy, and customize the quickstart for their own domain. |
| **Pain Points** | Lack of production-quality reference implementations for regulated AI. Most tutorials show toy examples without audit trails, compliance, or real orchestration patterns. |
| **Context** | Evaluating the Red Hat AI Quickstart. Wants to be running locally within 2 hours. Will study code patterns, then adapt them. |
| **Success Metric** | Full local setup completable in under 30 minutes. Can trace a loan application through all agents and understand every decision. |

### P2: Loan Officer (Primary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Reviews loan applications and makes approval recommendations |
| **Goals** | Process more applications with less manual data entry while maintaining decision quality. Review AI-processed applications efficiently. |
| **Pain Points** | Manual document review is tedious (3-5 hours). Inconsistent underwriting standards. Missing documents cause delays. |
| **Context** | Works through the protected UI. Receives AI-analyzed applications with confidence scores. Makes final decisions on medium-confidence escalations. |
| **Success Metric** | Review AI-processed applications in 30 minutes vs. 3 hours previously. Clear confidence scores and agent reasoning for every decision. |

### P3: Compliance Officer (Primary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Ensures fair lending compliance and maintains audit trails |
| **Goals** | Complete decision history for any application. Non-discrimination evidence. Fast audit response. |
| **Pain Points** | Fragmented audit trails across manual systems. Difficulty proving fair lending compliance. Time-consuming regulatory responses. |
| **Context** | Needs to pull a complete audit trail for any application on demand. Reviews compliance agent output for regulatory adherence. |
| **Success Metric** | Generate a complete audit trail for any application in under 5 minutes. Every denial includes adverse action notice with regulatory citations. |

### P4: Platform Engineer (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Deploys and operates AI systems on OpenShift/Kubernetes |
| **Goals** | Reliable deployment, observability, and cost optimization |
| **Pain Points** | AI systems are often difficult to deploy, monitor, and troubleshoot. Lack of standard deployment patterns. |
| **Context** | Uses provided Helm charts to deploy on OpenShift. Monitors system health and LLM costs via observability dashboard. |
| **Success Metric** | Deploy with provided Helm charts. Monitor all agent activity and LLM costs via LangFuse dashboard. Health checks work out of the box. |

### P5: Risk Management Lead (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Defines underwriting policies and risk thresholds |
| **Goals** | Configurable risk models, transparent decision logic, and performance monitoring |
| **Pain Points** | Opaque AI decisions. Inability to tune risk parameters without code changes. |
| **Context** | Adjusts confidence thresholds and reviews decision patterns via admin interface. Monitors approval/denial rates and agent agreement patterns. |
| **Success Metric** | Adjust confidence thresholds at runtime with full audit trail. View decision patterns and agent agreement rates. |

### P6: Borrower / Applicant (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Role** | Prospective homebuyer or refinancer exploring mortgage options |
| **Goals** | Understand qualification likelihood, required documents, and current rates. Get plain-language mortgage guidance. |
| **Pain Points** | Limited mortgage knowledge. Confusing terminology. Uncertainty about qualification. |
| **Context** | Interacts through public (unauthenticated) chat interface and mortgage calculator. Does NOT directly create applications -- works with a loan officer. |
| **Success Metric** | Gets clear, jargon-free answers to mortgage questions. Can run payment scenarios with current rates. Understands what documents to prepare. |

---

## 4. Goals and Non-Goals

### Goals

1. **Demonstrate multi-agent AI patterns for regulated industries** -- supervisor-worker orchestration, human-in-the-loop workflows, compliance-first design with complete audit trails, and confidence-based escalation.
2. **Provide a compelling reference implementation** for mortgage loan processing that shows real value while being honest about mocked services standing in for production integrations.
3. **Be a self-contained developer quickstart** deployable locally with `make setup && make dev` -- full setup completable in under 30 minutes.
4. **Teach production-quality code patterns** for AI systems in regulated domains that developers can clone and customize for their own use cases.

### Non-Goals

1. **No production regulatory certification** -- demonstrates compliance patterns, not certified for real lending.
2. **No end-user authentication** -- no user registration, password management, or OAuth. API key auth only.
3. **No real credit bureau integration** -- mocked with synthetic data.
4. **No payment processing** -- application lifecycle ends at approval/denial.
5. **No mobile application** -- web only, desktop/tablet.
6. **No multi-tenancy.**
7. **No custom ML model training or fine-tuning** -- uses off-the-shelf LLMs via API.
8. **No real-time collaboration** -- UI polls for updates, no WebSockets for application status.
9. **No internationalization** -- English only, US mortgage regulations only.
10. **No high-availability deployment** -- basic deployment for demo/dev.

---

## 5. Epics

### E1: Core Infrastructure

**Description:** Database schema, LangGraph orchestration skeleton with persistent checkpointing, API scaffold with health checks, and basic UI shell. This epic establishes the foundational patterns that all other epics build on.

**Key User Stories:**
- As a developer (P1), I want to run `make setup && make dev` and see a working application with health checks passing.
- As a developer (P1), I want a database schema that supports loan applications, audit events, and workflow state.
- As a developer (P1), I want a LangGraph workflow skeleton with a single stub agent and persistent checkpointing so I can verify the orchestration pattern works.
- As a platform engineer (P4), I want health and readiness endpoints that report dependency status.

**Dependencies:** None (foundation epic).

**Phase:** Phase 1 -- Foundation.

---

### E2: Document Processing

**Description:** Vision-model-powered document classification and data extraction. Classifies uploaded documents (W-2, pay stub, tax return, bank statement, appraisal, photo ID), extracts structured data with confidence scores, and examines PDF metadata for fraud indicators.

**Key User Stories:**
- As a loan officer (P2), I want uploaded documents automatically classified and data extracted so I do not have to manually enter borrower information.
- As a loan officer (P2), I want to see confidence scores on extracted data so I know which fields need manual verification.
- As a developer (P1), I want to see how a vision model is integrated for OCR with confidence-scored extraction.

**Dependencies:** E1 (Core Infrastructure) for database schema, object storage, and API scaffold.

**Phase:** Phase 2 -- First Real Agents.

---

### E3: Credit Analysis

**Description:** Evaluates creditworthiness from credit report data using a mocked credit bureau. Produces credit score analysis, payment history review, derogatory mark detection, trend analysis, and a plain-language summary.

**Key User Stories:**
- As a loan officer (P2), I want automated credit analysis with a plain-language summary so I can quickly assess creditworthiness.
- As a developer (P1), I want to see how a mocked external service (credit bureau) is integrated with a swappable interface.

**Dependencies:** E1 (Core Infrastructure) for database and orchestration. Runs in parallel with E2 in development, but the workflow dispatches credit analysis after document processing completes.

**Phase:** Phase 2 -- First Real Agents.

---

### E4: Risk Assessment

**Description:** Calculates financial risk metrics: DTI ratio, LTV ratio, employment stability scoring, cross-source income validation, and overall risk score.

**Key User Stories:**
- As a loan officer (P2), I want automated DTI, LTV, and employment stability calculations with transparent logic.
- As a risk management lead (P5), I want to see how risk metrics are calculated and how they feed into the overall decision.
- As a compliance officer (P3), I want risk calculations that use objective financial criteria only, never subjective assessments.

**Dependencies:** E1 (Core Infrastructure), E2 (Document Processing) for extracted income/asset data.

**Phase:** Phase 3 -- Full Agent Suite + Public Access.

---

### E5: Compliance Checking

**Description:** Verifies regulatory compliance via RAG against a knowledge base of lending regulations. Performs fair lending policy verification, generates adverse action notices with specific regulatory citations, and verifies audit trail completeness.

**Key User Stories:**
- As a compliance officer (P3), I want every application checked against current fair lending regulations with specific citations.
- As a compliance officer (P3), I want adverse action notices auto-generated with regulatory references when loans are denied.
- As a developer (P1), I want to see how RAG is used for compliance checking in a regulated domain.

**Dependencies:** E1 (Core Infrastructure) for database with pgvector embeddings.

**Phase:** Phase 3 -- Full Agent Suite + Public Access.

---

### E6: Fraud Detection

**Description:** Identifies suspicious patterns and anomalies: income discrepancy detection across documents, property flip pattern detection, identity inconsistency detection, PDF metadata examination (creation dates, producer fields), and configurable sensitivity.

**Key User Stories:**
- As a loan officer (P2), I want automated fraud screening that flags suspicious patterns before I review an application.
- As a risk management lead (P5), I want configurable fraud detection sensitivity so I can tune the balance between false positives and missed fraud.
- As a developer (P1), I want to see how PDF metadata examination works as a fraud signal.

**Dependencies:** E1 (Core Infrastructure), E2 (Document Processing) for extracted data and PDF metadata.

**Phase:** Phase 4 -- Human Review + Fraud + Coaching.

---

### E7: Denial Coaching

**Description:** When a loan is denied or unlikely to be approved, provides actionable improvement recommendations: DTI improvement strategies, down payment / LTV scenarios, credit score guidance, what-if calculations using the mortgage calculator, and plain-language recommendations.

**Key User Stories:**
- As a loan officer (P2), I want denial coaching recommendations I can share with applicants so they understand how to improve their application.
- As a borrower (P6), I want to understand specifically what I can do to qualify in the future, not just a rejection letter.

**Dependencies:** E1 (Core Infrastructure), E4 (Risk Assessment) for risk metrics, E10 (Mortgage Calculator) for what-if calculations.

**Phase:** Phase 4 -- Human Review + Fraud + Coaching.

---

### E8: Supervisor Agent

**Description:** The central orchestration agent that initializes workflows, dispatches to worker agents, aggregates results, applies confidence thresholds, and makes routing decisions (auto-approve / escalate to human / deny). Generates the consolidated underwriting narrative.

**Key User Stories:**
- As a developer (P1), I want to see a supervisor-worker pattern with parallel fan-out and confidence-based routing.
- As a loan officer (P2), I want a consolidated underwriting narrative that summarizes all agent findings.
- As a risk management lead (P5), I want configurable confidence thresholds that determine auto-approve vs. escalation.

**Dependencies:** E1 (Core Infrastructure) for LangGraph orchestration. Integrates with all worker agents (E2-E7) as they become available. The stub supervisor in E1 evolves into the full supervisor as workers are added.

**Phase:** Starts in Phase 1 (stub), evolves through Phases 2-4 as agents are added.

---

### E9: Intake Agent

**Description:** A standalone conversational assistant operating on an independent graph. Answers mortgage questions via RAG, provides property data (BatchData API), economic data (FRED API -- mortgage rates, Treasury yields, housing price indices), mortgage calculations, sentiment analysis with tone adjustment, and source citations for regulatory answers. Supports both public and authenticated users; authenticated users get cross-session context.

**Key User Stories:**
- As a borrower (P6), I want to ask mortgage questions in plain language and get clear, cited answers.
- As a borrower (P6), I want to see current mortgage rates pulled from real Federal Reserve data.
- As a loan officer (P2), I want to look up property data and run quick calculations through the chat interface.
- As a developer (P1), I want to see how a conversational agent integrates external APIs (FRED, BatchData) with RAG and sentiment analysis.

**Dependencies:** E1 (Core Infrastructure) for API scaffold and database. E10 (Mortgage Calculator) as an invocable tool. E12 (Authentication) for cross-session context (authenticated mode).

**Phase:** Phase 3 -- Full Agent Suite + Public Access.

---

### E10: Mortgage Calculator

**Description:** A hybrid calculator component (pure computation + LLM natural-language wrap) available both as a standalone UI widget and as a tool the intake agent can invoke. Computes PITI (principal, interest, taxes, insurance), total interest over loan life, DTI preview, affordability estimate, amortization schedule, and side-by-side scenario comparison. Auto-populates current rates from FRED API. All outputs include legal disclaimers.

**Key User Stories:**
- As a borrower (P6), I want to calculate my estimated monthly payment with current rates and see how different scenarios compare.
- As a loan officer (P2), I want quick what-if calculations I can show applicants during consultations.
- As a developer (P1), I want to see the hybrid pattern: deterministic computation wrapped with LLM natural-language explanation.

**Dependencies:** E1 (Core Infrastructure) for API scaffold. FRED API integration for current rates.

**Phase:** Phase 3 -- Full Agent Suite + Public Access.

---

### E11: Human-in-the-Loop

**Description:** Implements the human review workflow: review queue with filtering and assignment, interrupt/resume for paused workflows, reviewer actions (approve, deny, request more documents), cyclic document resubmission (loop back to document processing), and free-text rationale capture.

**Key User Stories:**
- As a loan officer (P2), I want a review queue showing applications awaiting my decision, filterable by confidence level and status.
- As a loan officer (P2), I want to approve, deny, or request more documents and have the workflow resume automatically.
- As a compliance officer (P3), I want every human review decision recorded with identity, timestamp, decision, and rationale.
- As a developer (P1), I want to see how LangGraph handles interrupt/resume and cyclic workflows.

**Dependencies:** E1 (Core Infrastructure) for LangGraph orchestration with checkpointing. E8 (Supervisor Agent) for escalation routing.

**Phase:** Phase 4 -- Human Review + Fraud + Coaching.

---

### E12: Authentication and Authorization

**Description:** API key authentication with three roles (`loan_officer`, `senior_underwriter`, `reviewer`), role-based access control, rate limiting (both session-based for public tier and role-based for protected tier), and startup warning if running with default keys.

**Key User Stories:**
- As a platform engineer (P4), I want API key auth working from day one with clear role-based permissions.
- As a risk management lead (P5), I want only `reviewer` role users to change confidence thresholds and export audit trails.
- As a developer (P1), I want to see a practical MVP auth scheme with `Authorization: Bearer <role>:<key>` format.

**Dependencies:** E1 (Core Infrastructure) for API scaffold.

**Phase:** Phase 1 -- Foundation (basic API key validation). Extended in Phase 3 (rate limiting for public access).

---

### E13: Audit Trail

**Description:** Immutable, append-only audit event system. Every agent decision, human action, and workflow state transition is recorded with timestamp, actor, action, entity, confidence score, and reasoning. Supports export as PDF with all source documents. Compliance reporting capabilities.

**Key User Stories:**
- As a compliance officer (P3), I want to export a complete audit trail for any application in under 5 minutes.
- As a compliance officer (P3), I want audit events that are immutable -- append-only, never updated or deleted.
- As a risk management lead (P5), I want to see audit entries when confidence thresholds are changed, including old value, new value, who, and why.
- As a developer (P1), I want to see how an immutable audit trail is implemented in a regulated AI system.

**Dependencies:** E1 (Core Infrastructure) for database schema.

**Phase:** Starts Phase 1 (core schema and event recording), extended through all subsequent phases as agents produce audit events. Export capability in Phase 5.

---

### E14: User Interface

**Description:** React 19 frontend with five major views: (1) Application Dashboard -- list, detail, and status tracking for loan applications; (2) Review Queue -- filterable queue for human-in-the-loop review; (3) Intake Chat -- conversational interface for the intake agent with SSE streaming; (4) Mortgage Calculator Widget -- standalone calculator with scenario comparison; (5) Admin -- confidence threshold configuration, knowledge base management, and audit trail export.

**Key User Stories:**
- As a loan officer (P2), I want a dashboard showing all my applications with their current status and confidence scores.
- As a loan officer (P2), I want a review queue showing escalated applications with agent reasoning summaries.
- As a borrower (P6), I want a chat interface where I can ask mortgage questions and use the calculator.
- As a risk management lead (P5), I want an admin interface to configure confidence thresholds and view decision patterns.
- As a compliance officer (P3), I want to export audit trails from the UI.

**Dependencies:** All backend epics that produce the APIs this UI consumes. Built incrementally across phases.

**Phase:** Starts Phase 1 (shell), built out through Phases 2-5 as backend features land.

---

### E15: Observability

**Description:** LangFuse integration for LLM observability (tracing, cost tracking, latency), structured JSON logging with correlation IDs across all services, health and readiness endpoints, and metrics for monitoring.

**Key User Stories:**
- As a platform engineer (P4), I want to monitor all LLM calls with latency, cost, and token usage in a dashboard.
- As a platform engineer (P4), I want structured logs with correlation IDs so I can trace a request across all services.
- As a developer (P1), I want to see how LangFuse integrates with LangGraph for agent observability.

**Dependencies:** E1 (Core Infrastructure) for API scaffold and logging setup.

**Phase:** Phase 5 -- Observability + Polish.

---

### E16: Deployment

**Description:** Helm charts for OpenShift/Kubernetes deployment, compose.yml for local development, CI pipeline (lint, test, build, security scan), and comprehensive documentation.

**Key User Stories:**
- As a platform engineer (P4), I want to deploy with `helm install` and have all services come up with correct configuration.
- As a developer (P1), I want `make dev` to start all services locally via compose.
- As a developer (P1), I want a CI pipeline that catches issues before merge.

**Dependencies:** All other epics (deployment packages the entire system).

**Phase:** Phase 5 -- Observability + Polish.

---

### Epic Dependency Map

```
E1 (Core Infrastructure)
 |
 +-- E12 (Auth) -------- Phase 1
 +-- E13 (Audit Trail) -- Phase 1 (core), evolves through all phases
 +-- E8 (Supervisor) ---- Phase 1 (stub), evolves through Phases 2-4
 |
 +-- E2 (Document Processing) --- Phase 2
 +-- E3 (Credit Analysis) ------- Phase 2
 |
 +-- E4 (Risk Assessment) ------> depends on E2 --- Phase 3
 +-- E5 (Compliance/RAG) -------- Phase 3
 +-- E9 (Intake Agent) ---------> depends on E10, E12 --- Phase 3
 +-- E10 (Mortgage Calculator) --- Phase 3
 |
 +-- E6 (Fraud Detection) ------> depends on E2 --- Phase 4
 +-- E7 (Denial Coaching) ------> depends on E4, E10 --- Phase 4
 +-- E11 (Human-in-the-Loop) ---> depends on E8 --- Phase 4
 |
 +-- E14 (UI) --- incremental across all phases
 +-- E15 (Observability) --- Phase 5
 +-- E16 (Deployment) ------ Phase 5
```

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Document processing latency (single doc) | < 10 seconds (p90) | Timed from upload to extraction complete |
| Full application processing (happy path, no human review) | < 3 minutes (p90) | Timed from submission to final decision |
| API response time for application detail | < 500ms (p95) | Standard API latency measurement |
| UI initial page load | < 2 seconds (p95) | Lighthouse or equivalent |
| Concurrent workflow executions | At least 10 simultaneous | Load test with 10 parallel applications |
| RAG query latency (cached) | < 200ms (p95) | Redis cache hit path |
| RAG query latency (uncached) | < 2 seconds (p95) | Full embedding + vector search path |

### Security

- API authentication required for all endpoints except health checks and public tier
- Secrets never stored in code; managed via environment or secrets manager
- PII (SSN, financial data) protected at rest and never logged
- PII redacted from images before sending to external LLM APIs
- All HTTP traffic over TLS in production
- Input validation on all API endpoints
- Dependency vulnerability scanning in CI
- Prompt injection defenses on all LLM-facing inputs

### Auditability

- Every agent decision recorded with timestamp, confidence score, and reasoning
- Every human review recorded with user identity, timestamp, decision, and rationale
- Every workflow state transition logged
- Audit trail immutable once written (append-only)
- Audit trail exportable as PDF with all source documents
- Regulatory citations traceable to specific document versions in the RAG knowledge base
- Confidence threshold changes recorded with old value, new value, actor, and rationale

### Reliability

- Workflow resumes from checkpoint after service restart with no data loss
- Database migrations are idempotent and support rollback
- Graceful degradation when optional services (cache, observability) are unavailable
- Health checks fail if critical dependencies (database, object storage) are unreachable
- Transient LLM API failures retried with exponential backoff

### Developer Experience

- Full local setup completable in under 30 minutes
- README includes architecture diagram, quickstart, and troubleshooting
- API documented via interactive OpenAPI UI (Swagger)
- Code includes inline comments explaining multi-agent patterns
- Development seed data includes diverse test cases (approvals, denials, edge cases)

### Observability

- All logs structured (JSON) with consistent schema
- Every log entry includes a correlation ID for distributed tracing
- LLM observability dashboard (LangFuse) accessible with all workflow traces
- Critical errors logged at appropriate severity

### Maintainability

- Code follows project style guides (see `.claude/rules/`)
- Test coverage >= 70% for backend services
- All agents implemented as modular units with consistent interfaces
- Configuration externalized (no hardcoded URLs, API keys, or thresholds)
- All monetary values stored as integer cents; DTI/LTV as decimal types

---

## 7. Security Considerations

### Two-Tier Access Model

| Tier | Auth Required | Features | Security Controls |
|------|--------------|----------|-------------------|
| **Public** | No | Chat with intake agent, mortgage calculator, current rates, limited property lookups | Session-based rate limiting, IP-based cost caps, prompt injection defenses, 24-hour session TTL |
| **Protected** | Yes (Bearer token) | All application management, review queue, admin settings, audit export | Role-based access control (3 roles), 90-day session TTL |

### Three Roles (Protected Tier)

| Role | Permissions |
|------|------------|
| `loan_officer` | Standard processing, MEDIUM-confidence reviews |
| `senior_underwriter` | All loan officer capabilities plus LOW-confidence escalations |
| `reviewer` | All senior underwriter capabilities plus audit trail export, compliance reports, threshold configuration, knowledge base management |

### Authentication Approach

API key authentication from day one -- not mocked, not deferred. Format: `Authorization: Bearer <role>:<key>`. Startup warning if running with default key. This is an MVP auth scheme; production systems would use OpenID Connect with JWT tokens.

### PII Handling

Per `.claude/rules/domain.md`:
- Never log, store in plaintext, or expose in API responses: SSN, full account numbers, date of birth, raw credit report data
- Mask SSN in all display contexts: show only last 4 digits
- Financial data may be stored but must never appear in application logs
- Document uploads containing PII stored in MinIO (object storage), never in the database directly
- Redact PII from images before sending to external LLM APIs

### Rate Limiting

- Public tier: session-based rate limiting and IP-based cost caps to prevent abuse
- Protected tier: role-based rate limits
- Global rate limits must be in place before public access launches (Phase 3)

### Prompt Injection Defenses

- All user-provided text that reaches an LLM must be sanitized
- System prompts must be clearly separated from user input
- Agent outputs must be validated before being used in downstream decisions

### Stakeholder Directive

> "Security posture: upgrade, don't defer." When in doubt about whether a security measure is needed for MVP, include it. This applies to: real API key auth (not mocked), image redaction before LLM calls, separate database roles, and global rate limits before public access.

---

## 8. Phased Roadmap

### Phase 1: Foundation

**Description:** Core infrastructure, database schema, orchestration pattern with a single stub agent, API infrastructure, basic endpoints, authentication, audit trail schema, and UI scaffolding. Prove the pattern works before adding real AI.

**Epics Included:**
- E1: Core Infrastructure (complete)
- E8: Supervisor Agent (stub only -- single echo agent)
- E12: Authentication and Authorization (basic API key validation, 3 roles)
- E13: Audit Trail (core schema and event recording)
- E14: User Interface (shell with routing, layout, auth-gated pages)

**Entry Criteria:** Project scaffolding exists (Turborepo monorepo with template structure).

**Deliverables:**
- Database schema for applications, audit events, workflow state
- LangGraph workflow with stub supervisor and single echo worker, persistent checkpointing via PostgresSaver
- FastAPI application with health/readiness endpoints, CORS, error handling
- API key authentication middleware with 3 roles
- Audit event recording for workflow state transitions
- React UI shell with TanStack Router, authenticated and public routes
- `make setup && make dev` works end-to-end
- Seed data with sample applications

**Exit Criteria (machine-verifiable):**
- `make dev` starts all services without errors
- `curl localhost:8000/healthz` returns 200
- `curl localhost:8000/readyz` returns 200 with dependency status
- API key auth rejects unauthenticated requests to protected endpoints (returns 401)
- API key auth enforces role-based access (returns 403 for unauthorized roles)
- A stub workflow can be triggered via API and produces audit events
- `pytest` passes with >= 70% coverage on new backend code
- `pnpm test` passes for UI package

**Key Risks:**
- LangGraph + PostgresSaver integration complexity may exceed estimates
- Database schema may need revision as agent requirements become clearer (mitigate with migration-first approach)

---

### Phase 2: First Real Agents

**Description:** Document processing with vision model, credit analysis with mocked credit bureau. First real LLM calls. Confidence-based routing through the supervisor.

**Epics Included:**
- E2: Document Processing (complete)
- E3: Credit Analysis (complete)
- E8: Supervisor Agent (extended -- routes to document and credit agents, confidence-based decisions)
- E13: Audit Trail (extended -- agent decision events)
- E14: User Interface (application detail view with document upload, agent results display)

**Entry Criteria:** Phase 1 exit criteria met. LLM API keys configured.

**Deliverables:**
- Document upload to MinIO with classification and extraction via vision model
- PDF metadata examination (creation dates, producer fields)
- Confidence-scored extraction results stored in database
- Mocked credit bureau service with realistic synthetic data and swappable interface
- Credit analysis agent producing plain-language summaries
- Supervisor routes: document processing -> credit analysis, with confidence aggregation
- UI shows application detail with uploaded documents and agent analysis results

**Exit Criteria (machine-verifiable):**
- Upload a PDF document via API; classification and extraction complete within 10 seconds
- Extracted data has confidence scores between 0.0 and 1.0
- Credit analysis produces a summary with confidence score for a mocked credit report
- Supervisor correctly routes high-confidence applications to auto-approve
- Supervisor correctly escalates low-confidence applications (audit event recorded)
- Audit trail contains events for each agent decision with reasoning
- `pytest` passes with >= 70% coverage on new backend code

**Key Risks:**
- Vision model latency may exceed 10-second target for complex documents (mitigate with async processing)
- Mocked credit bureau data may not cover enough edge cases (mitigate with diverse fixture data)

---

### Phase 3: Full Agent Suite + Public Access

**Description:** Risk assessment, compliance with RAG, intake agent with external APIs (FRED, BatchData), mortgage calculator, public chat interface with SSE streaming, rate limiting, sentiment analysis.

**Epics Included:**
- E4: Risk Assessment (complete)
- E5: Compliance Checking (complete)
- E9: Intake Agent (complete)
- E10: Mortgage Calculator (complete)
- E8: Supervisor Agent (extended -- parallel fan-out to credit, risk, compliance, fraud)
- E12: Authentication (extended -- rate limiting for public access)
- E13: Audit Trail (extended -- compliance events)
- E14: User Interface (intake chat with SSE, mortgage calculator widget, expanded dashboard)

**Entry Criteria:** Phase 2 exit criteria met. FRED API key obtained (free tier). RAG knowledge base seeded with initial regulation documents.

**Deliverables:**
- Risk assessment agent (DTI, LTV, employment stability, cross-source income validation)
- Compliance checking agent with RAG against regulation knowledge base
- Adverse action notice generation with regulatory citations
- Intake agent with FRED API integration (DGS10, CSUSHPISA series), BatchData integration (mocked by default), sentiment analysis, and source citations
- Mortgage calculator (PITI, amortization, comparison, affordability, legal disclaimers)
- Public chat interface with SSE streaming
- Rate limiting on public endpoints (session-based, IP-based cost caps)
- Supervisor parallel fan-out: document -> [credit, risk, compliance] concurrently

**Exit Criteria (machine-verifiable):**
- Risk assessment produces DTI and LTV ratios for a test application
- Compliance agent produces fair lending verification with regulatory citations
- Denied application produces adverse action notice
- Intake agent responds to mortgage questions with source citations
- FRED API returns current mortgage rate data (or graceful fallback if unavailable)
- Mortgage calculator produces correct PITI for known test inputs
- Public endpoints enforce rate limits (429 returned after threshold)
- `pytest` passes with >= 70% coverage on new backend code
- `pnpm test` passes for UI package

**Key Risks:**
- RAG quality depends heavily on knowledge base content (mitigate with curated seed documents)
- FRED API rate limits (120 req/min free tier) may require caching strategy
- SSE streaming adds frontend complexity (mitigate with established patterns)

---

### Phase 4: Human Review + Fraud + Coaching

**Description:** Human-in-the-loop interrupt/resume, review queue, fraud detection (including PDF metadata), denial coaching, cyclic document resubmission workflow.

**Epics Included:**
- E6: Fraud Detection (complete)
- E7: Denial Coaching (complete)
- E11: Human-in-the-Loop (complete)
- E8: Supervisor Agent (complete -- all routing paths, agent conflict detection, fraud flag forced escalation)
- E13: Audit Trail (extended -- human review events, fraud detection events)
- E14: User Interface (review queue, reviewer actions, denial coaching display)

**Entry Criteria:** Phase 3 exit criteria met.

**Deliverables:**
- Fraud detection agent (income discrepancy, property flip patterns, identity inconsistency, PDF metadata examination, configurable sensitivity)
- Denial coaching agent (DTI improvement, LTV scenarios, credit guidance, what-if calculations)
- Human review queue with filtering by confidence level, status, and assignment
- Reviewer actions: approve, deny, request more documents
- Cyclic workflow: request more documents loops back to document processing
- Any fraud flag forces human review regardless of other confidence scores
- Agent disagreements force human review
- All human decisions recorded with identity, timestamp, decision, and rationale

**Exit Criteria (machine-verifiable):**
- Fraud detection flags a test application with income discrepancies
- Fraud flag forces human review (workflow pauses, audit event recorded)
- Denial coaching produces improvement recommendations for a denied application
- Human reviewer can approve an escalated application via API and workflow resumes
- Human reviewer can request more documents and workflow loops back to document processing
- Agent disagreement (simulated) forces human review
- Review queue API returns filtered results
- `pytest` passes with >= 70% coverage on new backend code

**Key Risks:**
- Cyclic workflow (request more documents -> reprocess) adds state management complexity
- Fraud detection false positive rate may need tuning (mitigate with configurable sensitivity)
- Human-in-the-loop interrupt/resume is the most complex LangGraph pattern (mitigate with focused testing)

---

### Phase 5: Observability + Polish

**Description:** LLM observability integration, metrics dashboard, audit trail export (PDF), Helm deployment charts, CI pipeline, comprehensive documentation, cross-session context for authenticated intake users.

**Epics Included:**
- E15: Observability (complete)
- E16: Deployment (complete)
- E9: Intake Agent (extended -- cross-session context for authenticated users)
- E13: Audit Trail (extended -- PDF export with source documents)
- E14: User Interface (admin panel for threshold config, knowledge base management, observability links)

**Entry Criteria:** Phase 4 exit criteria met.

**Deliverables:**
- LangFuse integration: all LLM calls traced with latency, cost, token usage
- Structured JSON logging with correlation IDs across all services
- Helm charts for OpenShift deployment
- `compose.yml` for full local development stack
- CI pipeline: lint, test, build, security scan (dependency audit)
- Audit trail PDF export with all source documents
- Cross-session context for authenticated intake agent users
- Admin UI for confidence threshold configuration with audit trail
- Knowledge base management (upload regulation documents)
- Comprehensive README with architecture diagram, quickstart, troubleshooting
- API documentation via OpenAPI/Swagger

**Exit Criteria (machine-verifiable):**
- LangFuse dashboard shows traces for a processed application
- `helm template` produces valid Kubernetes manifests
- `docker compose up` (or `podman compose up`) starts all services
- CI pipeline runs lint, test, build without failures
- Audit trail PDF export produces a valid PDF for a test application
- Authenticated intake user's second session can reference first session context
- `ruff check` passes on all Python code
- `pnpm lint` passes on UI code
- README includes architecture diagram and quickstart instructions

**Key Risks:**
- LangFuse integration may require version-specific compatibility work
- PDF export with embedded documents adds complexity (mitigate with incremental approach)
- Cross-session context requires careful memory management to avoid context bloat

---

### Phase 6: Extensions

**Description:** Performance optimization, accessibility, post-MVP security hardening, optional real API integrations, local model support (LlamaStack).

**Epics Included:**
- Performance optimization (profiling, caching, query optimization)
- Accessibility audit and remediation (WCAG 2.1 AA)
- Security hardening (penetration testing patterns, CSP headers, additional rate limiting)
- Optional real BatchData API integration
- Optional LlamaStack support for local/data-residency LLM inference
- Additional FRED data series integration

**Entry Criteria:** Phase 5 exit criteria met. System is functional and documented.

**Deliverables:**
- Performance profiling results and optimizations
- Accessibility compliance report
- Security hardening checklist completed
- Documentation for swapping mocked services to real APIs
- LlamaStack integration guide (optional)

**Exit Criteria:**
- Performance targets from NFR table met under load
- Lighthouse accessibility score >= 90
- No Critical or High findings in security scan

**Key Risks:**
- Performance optimization may reveal architectural bottlenecks
- LlamaStack model quality may not match commercial LLM APIs for all agent tasks

---

## 9. Mocked vs. Real Services

### Mocked Services (with interface for swapping to real)

| Service | What the Mock Provides | Why Mocked | Swap Requirement |
|---------|----------------------|-----------|------------------|
| Credit Bureau API | Realistic credit report data with randomized scores, payment history, negative marks | Real APIs require expensive contracts and PCI compliance | Configuration change only (endpoint URL + credentials) |
| Email Notifications | Logs "email sent" to console/database | Avoids SMTP configuration complexity | Configuration change only |
| BatchData API (default) | Static fixture property data with AVM valuations and comparable sales | Pay-per-lookup pricing; mock has realistic response structure | Set `BATCHDATA_API_KEY` environment variable |
| Employment Verification | Assumes uploaded pay stubs are authoritative | Real verification requires third-party integrations | Configuration change only |

### Real Services

| Service | Purpose | Notes |
|---------|---------|-------|
| LLM APIs (Claude + GPT-4 Vision) | Document analysis, credit reasoning, compliance checking, intake conversations | Requires API keys; primary cost driver |
| PostgreSQL + pgvector | All application data and RAG embeddings | Single database for everything |
| Redis | Cache for RAG queries, session data, external API responses, rate limiting | Optional -- system degrades gracefully without it |
| MinIO | Object storage for document uploads | S3-compatible; required for document processing |
| FRED API | Live mortgage rates and economic data (DGS10, CSUSHPISA) | Free tier (120 req/min); cached aggressively |
| LangFuse | LLM observability (tracing, cost tracking) | Optional -- system works without it |

---

## 10. Out of Scope

The following items are explicitly excluded from this project:

1. **Production regulatory certification** -- the system demonstrates compliance patterns but is not certified for actual mortgage lending.
2. **End-user authentication** -- no user registration, password management, or OAuth flows. API key authentication only.
3. **Real credit bureau integration** -- credit data is mocked with synthetic responses. The interface supports swapping to a real provider via configuration.
4. **Payment processing** -- the application lifecycle ends at approval or denial. No loan funding, disbursement, or servicing.
5. **Mobile application** -- web only, optimized for desktop and tablet. Modern browsers only (last 2 versions).
6. **Multi-tenancy** -- single-tenant deployment. No organizational isolation or per-tenant configuration.
7. **Custom ML model training or fine-tuning** -- uses off-the-shelf LLMs via API. No model training pipelines.
8. **Real-time collaboration** -- UI polls for status updates. No WebSocket connections for live application status.
9. **Internationalization** -- English only. US mortgage regulations only. No multi-language support.
10. **High-availability deployment** -- basic single-instance deployment suitable for demo and development. No clustering, failover, or multi-region.

---

## 11. Open Questions and Assumptions

### Open Questions

| ID | Question | Impact | Suggested Default |
|----|----------|--------|-------------------|
| OQ-1 | **What specific confidence threshold values define "high", "medium", and "low"?** The brief mentions confidence-based routing but does not specify numeric thresholds. | Determines auto-approve vs. escalation behavior. | High >= 0.85, Medium 0.60-0.84, Low < 0.60. These should be configurable at runtime. |
| OQ-2 | **What regulations and documents should seed the RAG knowledge base?** The compliance agent needs a knowledge base but the brief does not enumerate specific documents. | Directly impacts compliance agent quality. | Seed with: ECOA summary, Fair Housing Act summary, TILA (Truth in Lending Act) summary, Regulation B, HMDA reporting requirements, standard adverse action reason codes. |
| OQ-3 | **Which specific BatchData API endpoints should be integrated?** The brief mentions property data and AVM valuations but does not specify exact endpoints. | Determines mock response structure and integration scope. | Property detail endpoint (address lookup), AVM valuation endpoint, comparable sales endpoint. |
| OQ-4 | **Which agents should support LlamaStack local model inference?** The brief mentions optional LlamaStack but does not specify scope. | Determines which agents need a model abstraction layer. | Phase 6 extension. Start with the intake agent (lower stakes, conversational). Defer reasoning-heavy agents (compliance, risk) until local model quality is validated. |
| OQ-5 | **What is the maximum document upload size?** The brief does not specify limits. | Impacts MinIO configuration, upload timeout, and processing latency. | 25 MB per document, 100 MB per application (all documents combined). |
| OQ-6 | **How many concurrent public chat sessions should the system support?** The brief specifies 10 concurrent workflow executions but does not address chat sessions separately. | Impacts rate limiting configuration and resource sizing. | 50 concurrent chat sessions (intake agent is lighter weight than the full workflow). |
| OQ-7 | **Should the intake agent's cross-session context have a retention limit?** Without limits, context will grow unboundedly for active users. | Impacts memory management and token costs. | Retain last 10 sessions or 30 days, whichever is shorter. Summarize older sessions rather than storing full transcripts. |
| OQ-8 | **What format should the audit trail PDF export use?** The brief says "exportable as PDF with all source documents" but does not specify layout. | Impacts export implementation complexity. | Chronological event log with embedded document thumbnails and links to full documents. Cover page with application summary. |

### Assumptions

| ID | Assumption | Rationale |
|----|-----------|-----------|
| A-1 | LLM API keys (Claude, OpenAI) will be provided by the developer running the quickstart. The system will not include shared API keys. | Standard practice for quickstarts. API keys are a per-developer cost. |
| A-2 | The FRED API free tier (120 requests/minute) is sufficient with aggressive caching (cache TTL of 1 hour for rate data). | FRED data changes at most daily. 120 req/min is generous for a quickstart. |
| A-3 | PostgreSQL with pgvector is sufficient for RAG embedding storage and similarity search at the scale of a quickstart (hundreds of applications, not millions). | Eliminates the need for a separate vector database. Appropriate for MVP scale. |
| A-4 | The existing Red Hat AI Quickstart template (Turborepo, React 19, FastAPI, PostgreSQL, Helm) does not need structural modifications -- we are extending it. | Per the brief: "Must build on the Red Hat AI Quickstart template." |
| A-5 | Modern browsers only (last 2 versions of Chrome, Firefox, Safari, Edge). No IE11, no legacy browser support. | Per CLAUDE.md constraints. |
| A-6 | Development and demo environments do not require TLS termination. TLS is a production deployment concern handled at the ingress/load balancer level. | Standard for quickstart templates. Helm charts should include TLS configuration for production. |
| A-7 | All monetary values are in USD. No multi-currency support is needed. | US mortgage regulations only (per non-goal #9). |
| A-8 | The mocked credit bureau will generate deterministic responses for seeded test SSNs, enabling reproducible testing. | Required for reliable integration tests and demos. |

---

## 12. Completion Criteria

The MVP is considered complete when all of the following are true:

### Functional Completeness

- [ ] All 8 AI agents (supervisor, document processing, credit analysis, risk assessment, compliance checking, fraud detection, denial coaching, intake agent) are operational and producing auditable results
- [ ] Mortgage calculator produces correct PITI, amortization, and comparison outputs with legal disclaimers
- [ ] Supervisor correctly routes applications through the workflow: document processing -> parallel fan-out -> confidence-based routing -> human review or auto-decision -> denial coaching if applicable
- [ ] Human-in-the-loop workflow works: pause, review, approve/deny/request-more-documents, resume, cyclic resubmission
- [ ] Public chat interface works without authentication (intake agent + calculator)
- [ ] Protected endpoints enforce API key auth with 3 roles
- [ ] Audit trail records every agent decision, human action, and workflow transition immutably
- [ ] Audit trail is exportable as PDF

### Quality Gates

- [ ] Backend test coverage >= 70%
- [ ] All linters pass (`ruff check`, `pnpm lint`)
- [ ] No Critical or High severity findings in dependency vulnerability scan
- [ ] All performance targets from NFR section met for happy-path scenarios

### Developer Experience

- [ ] `make setup && make dev` brings up the full system from a clean clone in under 30 minutes
- [ ] README includes architecture diagram, quickstart guide, and troubleshooting section
- [ ] API documented via OpenAPI/Swagger with examples
- [ ] Seed data includes at least 5 diverse test cases (auto-approve, escalation, denial, fraud flag, edge case)

### Deployment

- [ ] `docker compose up` (or `podman compose up`) starts all services
- [ ] Helm charts produce valid Kubernetes manifests (`helm template`)
- [ ] CI pipeline runs lint, test, build, and security scan

### Observability

- [ ] LangFuse integration traces all LLM calls with cost and latency
- [ ] Structured JSON logging with correlation IDs across all services
- [ ] Health and readiness endpoints functional for all services

---

## Next Steps

1. **Requirements Analyst** -- Take this product plan and produce detailed user stories with acceptance criteria for each epic, organized by phase. Every user story should follow "As a [persona], I want to [action] so that [benefit]" with numbered, testable acceptance criteria.

2. **Architect** -- Take this product plan and design the comprehensive system architecture: package structure, database schema, agent architecture (both graphs), workflow lifecycle, API design conventions, authentication model, caching strategy, observability approach, and deployment architecture. Ground all decisions in the existing template structure.

3. **Project Manager** -- After requirements and architecture are complete, produce the work breakdown: epics decomposed into stories, stories sized, dependencies mapped, and sprint/iteration plan aligned with the 6-phase roadmap.
