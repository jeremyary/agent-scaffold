# Product Brief: Multi-Agent Mortgage Loan Processing System

> Use this document as a comprehensive prompt for an agent network tasked with producing a complete planning document suite (product plan, requirements, architecture, and reviews) for the system described below. The agent network should have access to the project scaffolding (everything outside the `docs/` directory) to understand the existing template they're building on.

---

## 1. What We're Building

An AI-powered mortgage loan processing system built as a **developer quickstart** for the Red Hat AI Quickstart template. This is a reference implementation demonstrating how to build multi-agent AI systems for regulated industries — specifically mortgage lending.

The system is **not** a production loan origination system. It's a teaching tool that shows patterns: supervisor-worker orchestration, human-in-the-loop workflows, compliance-first design with complete audit trails, and confidence-based escalation. It needs to be compelling enough to demonstrate real value while being honest that mocked services stand in for things like credit bureau APIs.

**Maturity level: MVP.** That means happy-path testing plus critical edges, basic error handling, auth plus input validation, README plus API docs, and light code review. It does not mean sloppy — it means appropriately scoped.

---

## 2. The Domain: Mortgage Lending

### The Problem

Mortgage loan origination today is broken:

- **Manual document review** consumes 3-5 hours per application. Loan officers manually extract data from pay stubs, tax returns, bank statements, and property appraisals.
- **Inconsistent underwriting.** Different loan officers apply varying standards and miss risk factors, leading to approval inconsistencies and higher default rates.
- **Regulatory complexity.** Compliance officers struggle to maintain complete audit trails across fragmented systems, risking fair lending violations and regulatory penalties.
- **Extended processing time.** Applications take 30-45 days due to manual handoffs, missing document requests, and repeated checks.
- **Poor explainability.** When loans are denied, officers cannot easily articulate the decision rationale, leading to customer dissatisfaction and potential discrimination claims.

### What the System Demonstrates

An AI-powered workflow that:
- Automatically extracts and validates data from loan documents with 95%+ accuracy
- Routes applications through specialized analysis agents with transparent decision logic
- Escalates low-confidence decisions to human review with full context
- Maintains complete, immutable audit trails with explainable AI reasoning for every decision
- Reduces conceptual processing time from 30-45 days to 7-10 days for standard applications

### Key Domain Concepts

| Concept | Description |
|---------|-------------|
| Loan Application | A borrower's request for a mortgage, containing personal info, income docs, property details, and loan terms |
| Underwriting | The process of evaluating a loan application's risk — can the borrower repay? Is the property worth it? |
| DTI (Debt-to-Income) | Monthly debt payments divided by gross monthly income. Key risk metric. |
| LTV (Loan-to-Value) | Loan amount divided by property appraised value. Key risk metric. |
| Adverse Action Notice | Legal requirement: when a loan is denied, the lender must explain why with specific reasons |
| Fair Lending | Federal regulations (ECOA, Fair Housing Act) prohibiting discrimination in lending |
| Confidence Score | Each AI agent produces a 0.0-1.0 score indicating how certain it is about its analysis |
| Human-in-the-Loop | When AI confidence is below a threshold, the application pauses for human review |

---

## 3. Who Uses This System

### Primary Personas

**P1: AI Developer / Solutions Architect**
- Building AI-powered workflows for regulated industries
- Wants to learn multi-agent patterns, supervisor-worker orchestration, and production-quality code examples
- Needs to clone, deploy, and customize the quickstart for their domain within 2 hours

**P2: Loan Officer**
- Reviews loan applications and makes approval recommendations
- Needs to process more applications with less manual data entry while maintaining decision quality
- Expects to review AI-processed applications in 30 minutes vs. 3 hours previously

**P3: Compliance Officer**
- Ensures fair lending compliance and maintains audit trails
- Needs complete decision history, non-discrimination evidence, and fast audit response
- Expects to generate a complete audit trail for any application in under 5 minutes

### Secondary Personas

**P4: Platform Engineer**
- Deploys and operates AI systems on OpenShift/Kubernetes
- Needs reliable deployment, observability, and cost optimization
- Expects to deploy with provided Helm charts and monitor via observability dashboard

**P5: Risk Management Lead**
- Defines underwriting policies and risk thresholds
- Needs configurable risk models, transparent decision logic, and performance monitoring
- Expects to adjust confidence thresholds and review decision patterns via admin interface

**P6: Borrower / Applicant**
- Prospective homebuyer or refinancer exploring mortgage options
- Wants to understand if they qualify, what documents to prepare, and what current rates look like
- May have limited mortgage knowledge; needs plain-language guidance
- Interacts primarily through a public chat interface and mortgage calculator without authentication
- Does NOT directly create applications — works with a loan officer

---

## 4. The Agent System

The core of this system is a **multi-agent architecture** with 8 AI agents organized into two independent graphs:

### Loan Processing Graph (Authenticated)

A **supervisor agent** coordinates **6 specialized worker agents** through a persistent, checkpointed workflow:

| Agent | Role | Key Capabilities |
|-------|------|-----------------|
| **Supervisor** | Orchestrates the workflow, routes decisions, aggregates results | Initializes workflow, dispatches to workers, makes final routing decision (auto-approve / escalate to human / deny), generates consolidated underwriting narrative |
| **Document Processing** | Classifies and extracts data from uploaded documents | PDF classification (W-2, pay stub, tax return, bank statement, appraisal, photo), OCR via vision model, confidence-scored extraction, PDF metadata examination for fraud indicators |
| **Credit Analysis** | Evaluates creditworthiness from credit report data | Credit score analysis, payment history review, derogatory mark detection, trend analysis, plain-language summary |
| **Risk Assessment** | Calculates financial risk metrics | DTI ratio, LTV ratio, employment stability scoring, cross-source income validation, overall risk score |
| **Compliance Checking** | Verifies regulatory compliance via RAG | Fair lending policy verification against current regulations, adverse action notice generation with specific citations, audit trail completeness verification |
| **Fraud Detection** | Identifies suspicious patterns and anomalies | Income discrepancy detection across documents, property flip pattern detection, identity inconsistency detection, PDF metadata examination (creation dates, producer fields), sensitivity configuration |
| **Denial Coaching** | Provides actionable improvement recommendations when denied | DTI improvement strategies, down payment / LTV scenarios, credit score guidance, what-if calculations using mortgage calculator, plain-language recommendations |

**Workflow pattern:**
1. Supervisor initializes, routes to document agent
2. After document processing: parallel fan-out to credit, risk, compliance, and fraud agents (4 agents running concurrently)
3. Supervisor aggregates results, applies confidence thresholds
4. High confidence → auto-approve. Low/medium confidence → pause for human review. Any fraud flag → forced human review regardless of other scores.
5. If denied or low confidence → denial coaching agent runs as final stage
6. Human reviewer can approve, deny, or request more documents (cyclic workflow back to step 1)

**Critical requirements:**
- Persistent checkpointing: workflow state survives service restarts
- Every agent decision recorded as an immutable audit event with confidence score and reasoning
- All agent conflicts (disagreements between agents) escalate to human review
- Configurable confidence thresholds with audit trail when changed

### Intake Graph (Public, Unauthenticated)

A standalone **intake agent** operates independently from the loan processing graph:

| Agent | Role | Key Capabilities |
|-------|------|-----------------|
| **Intake Agent** | Conversational assistant for borrowers and loan officers | Answers mortgage questions via RAG, provides property data (BatchData API), economic data (FRED API — mortgage rates, Treasury yields, housing price indices), mortgage calculations, sentiment analysis with tone adjustment, source citations for regulatory answers |

The intake agent serves both public (unauthenticated) users and authenticated users. For authenticated users, it supports cross-session context — it can reference prior conversations.

### Mortgage Calculator

A **hybrid calculator** component (pure computation + LLM natural-language wrap) available both as a standalone UI widget and as a tool the intake agent can invoke:

- Monthly payment calculation (PITI — principal, interest, taxes, insurance)
- Total interest over loan life
- DTI preview
- Affordability estimate
- Amortization schedule
- Comparison mode (side-by-side scenarios)
- Auto-populated current rates from FRED API
- All outputs include appropriate legal disclaimers

---

## 5. Technical Constraints

### Hard Constraints

| Constraint | Detail |
|-----------|--------|
| **Red Hat ecosystem** | OpenShift for deployment, Podman for containers, Helm for orchestration |
| **Existing template** | Must build on the Red Hat AI Quickstart template (Turborepo monorepo with React 19, FastAPI, PostgreSQL, Helm charts — explore the scaffolding for full details) |
| **LangGraph** | Agent orchestration must use LangGraph with persistent checkpointing (PostgresSaver) |
| **Hybrid LLM** | Best-fit model per task: Claude for reasoning, GPT-4 Vision for document analysis, optional LlamaStack for local/data-residency scenarios |
| **PostgreSQL + pgvector** | Single database for application data and RAG embeddings (not a separate vector DB) |
| **Self-contained quickstart** | Must be runnable locally with minimal setup — `make setup && make dev` should get you to a working system |
| **Complete audit trails** | Every agent decision, every human action, every workflow transition must be recorded immutably |

### Technology Stack (Inherited from Template)

Explore the project scaffolding to understand the full template, but the key technologies are:

| Layer | Technology |
|-------|-----------|
| Build System | Turborepo |
| Frontend | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (async) |
| Database | PostgreSQL + SQLAlchemy 2.0 async + Alembic migrations |
| Caching | Redis |
| Object Storage | MinIO (S3-compatible) |
| Testing | Vitest (UI) + Pytest (API/DB) |
| Package Managers | pnpm (Node) + uv (Python) |
| Containers | Podman |
| Deployment | Helm charts on OpenShift |

### Additional Technology Requirements

| Technology | Purpose |
|-----------|---------|
| LangGraph + LangChain | Agent orchestration, state management, checkpointing |
| LangFuse | LLM observability (tracing, cost tracking) |
| FRED API | Federal Reserve Economic Data — mortgage rates (DGS10, CSUSHPISA), free tier (120 req/min) |
| BatchData API | Property data, AVM valuations — pay-per-lookup (mocked by default, real API key optional) |

---

## 6. Mocked vs. Real Services

### Mocked (with interface for swapping to real)

| Service | What the Mock Provides | Why Mocked |
|---------|----------------------|-----------|
| Credit Bureau API | Realistic credit report data with randomized scores, payment history, negative marks | Real APIs require expensive contracts and PCI compliance |
| Email Notifications | Logs "email sent" to console/database | Avoids SMTP configuration complexity |
| BatchData API (default) | Static fixture property data with AVM valuations and comparable sales | Pay-per-lookup pricing; mock has realistic response structure |
| Employment Verification | Assumes uploaded pay stubs are authoritative | Real verification requires third-party integrations |

### Real Services

| Service | Purpose |
|---------|---------|
| LLM APIs (reasoning + vision) | Document analysis, credit reasoning, compliance checking, intake conversations |
| PostgreSQL + pgvector | All application data and RAG embeddings |
| Redis | Cache for RAG queries, session data, external API responses, rate limiting |
| MinIO | Object storage for document uploads |
| FRED API | Live mortgage rates and economic data |
| LangFuse | LLM observability |

---

## 7. Access Model

The system has two access tiers:

| Tier | Auth Required | Features | Security |
|------|--------------|----------|----------|
| **Public** | No | Chat with intake agent, mortgage calculator, current rates, limited property lookups | Session-based rate limiting, IP-based cost caps, prompt injection defenses, 24-hour session TTL |
| **Protected** | Yes (Bearer token) | All application management, review queue, admin settings, audit export | Role-based access control (3 roles), 90-day session TTL |

### Three Roles (Protected Tier)

| Role | Permissions |
|------|------------|
| `loan_officer` | Standard processing, MEDIUM-confidence reviews |
| `senior_underwriter` | All loan officer capabilities plus LOW-confidence escalations |
| `reviewer` | All senior underwriter capabilities plus audit trail export, compliance reports, threshold configuration, knowledge base management |

### Authentication Approach

API key authentication from day one — not mocked, not deferred. `Authorization: Bearer <role>:<key>` format. Startup warning if running with default key. This is an MVP auth scheme; production systems would use OpenID Connect with JWT tokens.

---

## 8. What's Out of Scope

Explicitly excluded:

1. Production regulatory certification (demonstrates patterns, not certified)
2. End-user authentication (no user registration, password management, OAuth)
3. Real credit bureau integration (mocked with synthetic data)
4. Payment processing (application ends at approval/denial)
5. Mobile application (web only, desktop/tablet)
6. Multi-tenancy
7. Custom ML model training or fine-tuning (uses off-the-shelf LLMs via API)
8. Real-time collaboration (UI polls for updates, no WebSockets for app status)
9. Internationalization (English only, US mortgage regulations only)
10. High-availability deployment (basic deployment for demo/dev)

---

## 9. Stakeholder Preferences

Through iterative review cycles, the following preference patterns have been established. These should guide decision-making when trade-offs arise:

1. **Security posture: upgrade, don't defer.** When in doubt about whether a security measure is needed for MVP, include it. Real API key auth from day one (not mocked). Image redaction before sending to LLMs. Separate database roles from Phase 1. Global rate limits before public access launches.

2. **Feature richness over minimal scope.** This is a teaching quickstart — it should be impressive. Include fraud detection and denial coaching agents (not just the core 4). Add PDF metadata examination for fraud. Add sentiment analysis for the intake agent. More agents and richer demos are preferred.

3. **Cross-session context for authenticated users.** Convenience over simplicity — authenticated users should be able to reference prior chat sessions through the intake agent.

4. **Broader data integration.** Include expanded FRED series (DGS10 + CSUSHPISA, not just basic rates). Include property data integration (BatchData).

5. **Industry-standard approaches.** When there's a well-known pattern for something (e.g., confidence threshold locking with audit trail), use it rather than inventing a simpler alternative.

6. **Three roles, not two.** The `senior_underwriter` role was explicitly added to create a meaningful permission hierarchy between loan officers and full reviewers.

7. **All agent conflicts escalate to human review.** Any disagreement between agents forces human review — no automated tie-breaking.

---

## 10. Non-Functional Requirements

### Performance

| Requirement | Target |
|------------|--------|
| Document processing latency (single doc) | < 10 seconds (p90) |
| Full application processing (happy path, no human review) | < 3 minutes (p90) |
| API response time for application detail | < 500ms (p95) |
| UI initial page load | < 2 seconds (p95) |
| Concurrent workflow executions | At least 10 simultaneous |
| RAG query latency (cached) | < 200ms (p95) |
| RAG query latency (uncached) | < 2 seconds (p95) |

### Security

- API authentication required for all endpoints except health checks and public tier
- Secrets never stored in code; managed via environment or secrets manager
- PII (SSN, financial data) protected at rest and never logged
- All HTTP traffic over TLS in production
- Input validation on all API endpoints
- Dependency vulnerability scanning in CI

### Auditability

- Every agent decision recorded with timestamp, confidence score, and reasoning
- Every human review recorded with user identity, timestamp, decision, and rationale
- Every workflow state transition logged
- Audit trail immutable once written (append-only)
- Audit trail exportable as PDF with all source documents
- Regulatory citations traceable to specific document versions

### Reliability

- Workflow resumes from checkpoint after service restart with no data loss
- Database migrations are idempotent and support rollback
- Graceful degradation when optional services (cache, observability) are unavailable
- Health checks fail if critical dependencies are unreachable
- Transient LLM API failures retried with exponential backoff

### Developer Experience

- Full local setup completable in under 30 minutes
- README includes architecture diagram, quickstart, and troubleshooting
- API documented via interactive OpenAPI UI
- Code includes inline comments explaining multi-agent patterns
- Development seed data includes diverse test cases

### Observability

- All logs structured (JSON) with consistent schema
- Every log entry includes a correlation ID for distributed tracing
- LLM observability dashboard accessible with all workflow traces
- Critical errors logged at appropriate severity

### Maintainability

- Code follows project style guides (see `.claude/rules/`)
- Test coverage >= 70% for backend services
- All agents implemented as modular units with consistent interfaces
- Configuration externalized (no hardcoded URLs, API keys, or thresholds)

---

## 11. Phased Delivery

The system should be delivered in phases, roughly:

1. **Foundation** — Core infrastructure, database schema, orchestration pattern with a single stub agent, API infrastructure, basic endpoints, UI scaffolding. Prove the pattern works before adding real AI.

2. **First Real Agents** — Document processing with vision model, credit analysis with mocked credit bureau. First real LLM calls. Confidence-based routing.

3. **Full Agent Suite + Public Access** — Risk assessment, compliance with RAG, intake agent with external APIs (FRED, BatchData), mortgage calculator, public chat interface with SSE streaming, rate limiting, sentiment analysis.

4. **Human Review + Fraud + Coaching** — Human-in-the-loop interrupt/resume, review queue, fraud detection (including PDF metadata), denial coaching, cyclic document resubmission workflow.

5. **Observability + Polish** — LLM observability integration, metrics dashboard, audit trail export, Helm deployment, CI pipeline, comprehensive documentation, cross-session context.

6. **Extensions** — Performance optimization, accessibility, post-MVP security hardening, optional real API integrations, local model support.

Each phase should have clear entry criteria, deliverables, exit criteria, and identified risks.

---

## 12. Expected Deliverables

Produce the following planning documents:

### Product Plan
A comprehensive product plan covering: executive summary, problem statement, personas, goals/non-goals, epics with descriptions, non-functional requirements, security considerations (including public access expansion), phased roadmap with deliverables and exit criteria per phase, mocked vs. real services, out of scope, open questions and assumptions, and completion criteria.

### Requirements Document
Detailed user stories organized by epic with acceptance criteria. Every story should follow the format: "As a [persona], I want to [action] so that [benefit]" with numbered acceptance criteria that are testable. Cover all epics identified in the product plan.

### Architecture Document
A comprehensive system architecture covering: package structure, technology stack decisions, database schema design, agent architecture (both graphs), workflow lifecycle, API design conventions, authentication and authorization model, security architecture, caching strategy, observability approach, deployment architecture, and phased implementation mapping.

### Review Process
After producing initial drafts, conduct review cycles:
- **Architecture review** — surface architectural decisions and open questions for stakeholder input
- **Security review** — identify security findings and triage by severity and implementation phase
- **API design review** — review API conventions, endpoint design, and consistency

Present findings to the stakeholder for triage decisions. Record all decisions inline in the review documents. Cross-update the product plan, requirements, and architecture to reflect decisions.

---

## 13. How to Start

1. **Explore the scaffolding.** Read the project's `CLAUDE.md`, `.claude/rules/*.md`, and examine the existing packages (`packages/ui`, `packages/api`, `packages/db`). Understand what the template already provides — you're extending it, not replacing it.

2. **Start with the product plan.** Use this brief as input. The product plan is the source of truth that the requirements and architecture derive from.

3. **Derive requirements from the product plan.** Each epic becomes a set of user stories with acceptance criteria.

4. **Design the architecture.** Make it comprehensive — this is the reference that implementation engineers will follow. Ground it in the existing template's patterns.

5. **Run reviews.** Architecture review, security review, API design review. Surface findings for stakeholder decision. Record decisions. Cross-update all documents.

6. **Iterate.** The stakeholder will have opinions. Expect multiple rounds of refinement. The goal is a document suite that is internally consistent, comprehensive, and ready for implementation planning.
