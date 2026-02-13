# PRD: AI Mortgage Quickstart

## Executive Summary

The AI Mortgage Quickstart is a developer reference implementation that demonstrates how to build multi-agent AI systems for regulated industries -- specifically US mortgage lending. It is packaged as a quickstart for the Red Hat AI template, designed so that AI developers and solutions architects can clone, deploy, and customize it within two hours.

The system showcases production-quality patterns: supervisor-worker agent orchestration, confidence-based escalation with human-in-the-loop review, compliance-first design with immutable audit trails, and explainable AI reasoning. It uses mocked versions of services that would require expensive contracts or PCI compliance (credit bureaus, employment verification) while integrating real LLM APIs, real database persistence, and real external data sources for mortgage rates and property information.

This is an MVP-maturity project. It is not a production loan origination system. It is a teaching tool that needs to be compelling enough to demonstrate real value while being transparent about what is mocked and what is real.

---

## Problem Statement

### The Industry Problem (Context for the Demo)

Mortgage loan origination is a manual, inconsistent, and slow process:

- **Manual document review** consumes 3-5 hours per application. Loan officers manually extract data from pay stubs, tax returns, bank statements, and property appraisals.
- **Inconsistent underwriting.** Different loan officers apply varying standards, miss risk factors, and produce approval inconsistencies that increase default rates.
- **Regulatory complexity.** Compliance officers struggle to maintain complete audit trails across fragmented systems, risking fair lending violations and regulatory penalties.
- **Extended processing time.** Applications take 30-45 days due to manual handoffs, missing document requests, and repeated checks.
- **Poor explainability.** When loans are denied, officers cannot easily articulate the decision rationale, leading to customer dissatisfaction and potential discrimination claims.

### The Developer Problem (Primary Problem We Solve)

AI developers and solutions architects in regulated industries lack quality reference implementations that show how to:

- Orchestrate multiple AI agents in a supervised workflow with persistent state
- Implement confidence-based escalation that pauses automated processing for human judgment
- Maintain complete, immutable audit trails for every AI decision
- Handle the unique challenges of regulated domains (fair lending, adverse action notices, PII handling)
- Build systems that explain their reasoning transparently

Existing quickstarts and tutorials focus on chatbots or simple RAG pipelines. Developers building AI for financial services, healthcare, or government need patterns for multi-agent coordination, compliance, and human oversight -- and those patterns are hard to learn from documentation alone.

### How People Cope Today

- **AI developers** piece together patterns from blog posts, framework docs, and toy examples. They often miss critical concerns (audit trails, confidence thresholds, human escalation) until late in development.
- **Loan officers** spend most of their time on data extraction rather than judgment. They use spreadsheets and manual checklists to track application status.
- **Compliance officers** manually reconstruct audit trails from fragmented logs across multiple systems, often spending more time on audit preparation than on actual compliance analysis.

---

## Target Users

### Persona: Alex (AI Developer / Solutions Architect) -- Primary

- **Role:** Building AI-powered workflows for regulated industries at an enterprise or consultancy
- **Goals:** Learn multi-agent patterns, understand supervisor-worker orchestration, get production-quality code examples for compliance-sensitive domains, and deploy a working demo to show stakeholders
- **Pain Points:** Existing quickstarts are toy chatbots; real multi-agent patterns are undocumented; regulated industry concerns (audit, compliance, PII) are afterthoughts in most examples; hard to get a working multi-agent system running locally
- **Context:** Evaluating the Red Hat AI platform. Needs to clone, deploy, and have a working demonstration within 2 hours. Will customize the quickstart for their specific domain (healthcare claims, insurance underwriting, government benefits processing).

### Persona: Maria (Loan Officer)

- **Role:** Reviews loan applications, makes approval recommendations, and communicates with borrowers
- **Goals:** Process more applications with less manual data entry while maintaining decision quality. Review AI-processed applications efficiently.
- **Pain Points:** Spends 3+ hours per application on manual data extraction. Inconsistent review processes across the team. Difficulty explaining denial decisions clearly to borrowers.
- **Context:** Works through a web-based dashboard. Expects to review an AI-processed application in about 30 minutes versus the current 3 hours. Needs clear confidence indicators and the ability to override AI decisions with documented rationale.

### Persona: James (Compliance Officer)

- **Role:** Ensures fair lending compliance, maintains audit trails, and prepares for regulatory examinations
- **Goals:** Complete, searchable audit trails for every application. Evidence of non-discriminatory decision-making. Fast audit response times.
- **Pain Points:** Reconstructing decision history from fragmented systems. Proving that lending decisions are based on objective criteria. Preparing for regulatory examinations is labor-intensive.
- **Context:** Needs to generate a complete audit trail for any application in under 5 minutes. Reviews decision patterns across the portfolio. Configures risk thresholds and compliance rules.

### Persona: Sam (Borrower / Applicant)

- **Role:** Prospective homebuyer or refinancer exploring mortgage options
- **Goals:** Understand whether they qualify for a mortgage, what documents to prepare, and what current rates look like
- **Pain Points:** Limited mortgage knowledge, overwhelmed by financial terminology, uncertain about qualification criteria
- **Context:** Interacts through a public chat interface and mortgage calculator without needing to log in. Does NOT directly create applications -- works with a loan officer. Needs plain-language guidance and actionable information.

### Persona: Pat (Platform Engineer) -- Secondary

- **Role:** Deploys and operates AI systems on container platforms
- **Goals:** Reliable deployment with observability, cost tracking, and operational visibility
- **Pain Points:** AI systems are black boxes. Hard to understand cost per inference. Deployment instructions are incomplete or assume a specific environment.
- **Context:** Deploys the quickstart to a container platform. Needs working deployment manifests, health checks, and an observability dashboard.

### Persona: Dana (Risk Management Lead) -- Secondary

- **Role:** Defines underwriting policies, risk thresholds, and approval criteria
- **Goals:** Configurable risk models, transparent decision logic, portfolio-level performance monitoring
- **Pain Points:** Cannot easily adjust approval criteria without code changes. Decision logic is opaque.
- **Context:** Adjusts confidence thresholds, reviews decision patterns, and monitors portfolio risk through an admin interface.

---

## Goals

1. **Demonstrate multi-agent AI patterns for regulated industries** -- supervisor-worker orchestration, confidence-based escalation, human-in-the-loop workflows, and persistent checkpointed state, all in the context of US mortgage lending.
2. **Provide a self-contained developer quickstart** -- deployable locally in under 30 minutes with a single setup command sequence, extending the existing Red Hat AI template.
3. **Show compliance-first design** -- complete, immutable audit trails with explainable AI reasoning for every agent decision, fair lending compliance patterns, and adverse action notice generation.
4. **Serve as a teaching tool with production-quality code patterns** -- well-structured code with inline documentation explaining multi-agent patterns. Not a production loan origination system, but code quality that demonstrates how to build one.

---

## Non-Goals

- **Production regulatory certification** -- demonstrates compliance patterns, not certified for real lending decisions
- **End-user authentication** -- no user registration, password management, or OAuth; API key authentication only
- **Real credit bureau integration** -- mocked with synthetic data
- **Payment processing** -- application lifecycle ends at approval/denial
- **Mobile application** -- web only, desktop and tablet
- **Multi-tenancy** -- single-tenant deployment only
- **Custom ML model training or fine-tuning** -- uses off-the-shelf LLMs via API
- **Real-time collaboration** -- UI polls for updates; no persistent bidirectional connections for application status
- **Internationalization** -- English only, US mortgage regulations only
- **High-availability deployment** -- basic deployment for demo and development use

---

## Success Metrics

| Metric | Current Baseline | Target | Measurement Method |
|--------|-----------------|--------|-------------------|
| Time to working local deployment | No quickstart exists | Under 30 minutes from clone to working demo | Timed walkthrough with a developer unfamiliar with the project |
| Application processing time (happy path, no human review) | 3-5 hours manual | Under 5 minutes end-to-end automated | Timing from application submission to auto-approval on standard test case |
| Human review preparation time | 3+ hours manual data extraction | Under 30 minutes to review AI-processed application | Timed task: loan officer reviews pre-processed application and makes decision |
| Audit trail generation time | Hours of manual reconstruction | Under 5 minutes per application | Time from audit request to complete exportable trail |
| Document data extraction accuracy | N/A (manual) | 95%+ on standard document types (W-2, pay stub, tax return) | Comparison of extracted fields against ground truth in test documents |
| Agent decision explainability | No AI reasoning available | Every agent decision includes human-readable reasoning with confidence score | Audit trail inspection: verify reasoning text and score present for each decision |
| Developer comprehension | No reference exists | Developer can explain supervisor-worker pattern after reading the codebase | Qualitative: code review and inline documentation assessment |

---

## Feature Scope

### Must Have (P0)

- [ ] **Supervisor-worker agent orchestration** -- A supervisor agent that coordinates specialized worker agents through a defined workflow: initialize, process documents, fan out to parallel analysis agents, aggregate results, and route to a final decision (auto-approve, escalate, or deny). Workflow state persists across service restarts.

- [ ] **Document processing agent** -- Classifies uploaded documents (W-2, pay stub, tax return, bank statement, appraisal) and extracts structured data using a vision-capable model. Produces a confidence score for each extraction. PII in document images is redacted before sending to external AI services.

- [ ] **Credit analysis agent** -- Evaluates creditworthiness from credit report data (mocked). Analyzes credit score, payment history, derogatory marks, and trends. Produces a confidence-scored assessment with plain-language summary.

- [ ] **Risk assessment agent** -- Calculates financial risk metrics: DTI ratio, LTV ratio, employment stability. Cross-validates income across multiple document sources. Produces an overall risk score with confidence rating.

- [ ] **Compliance checking agent** -- Verifies fair lending compliance by checking application decisions against regulatory requirements using a knowledge retrieval system. Generates adverse action notices with specific regulatory citations when applications are denied. Verifies audit trail completeness.

- [ ] **Confidence-based routing** -- Configurable confidence thresholds that determine whether an application is auto-approved, escalated to human review, or denied. Threshold changes are recorded in the audit trail. Agent disagreements (conflicting recommendations) always escalate to human review.

- [ ] **Immutable audit trail** -- Every agent decision, human review action, and workflow state transition recorded with timestamp, actor identity, confidence score, reasoning text, and document references. Append-only storage. No updates or deletes on audit records.

- [ ] **Human-in-the-loop review workflow** -- When confidence is below threshold or agents disagree, the workflow pauses and places the application in a review queue. Human reviewers see full agent analysis with confidence scores and reasoning. Reviewers can approve, deny, or request additional documents (cycling back to the beginning of the workflow).

- [ ] **Role-based access control** -- Three roles with hierarchical permissions: loan_officer (standard processing, medium-confidence reviews), senior_underwriter (all loan officer capabilities plus low-confidence escalations), reviewer (all capabilities plus audit export, compliance reports, threshold configuration, knowledge base management).

- [ ] **API key authentication** -- Real authentication from day one using bearer token format. Startup warning if running with default keys. All protected endpoints require a valid API key.

- [ ] **Loan application management** -- Create, view, and track loan applications through their lifecycle. Upload documents. View processing status and agent analysis results. Application detail views with all associated data.

- [ ] **Loan officer dashboard** -- Web interface showing application list, processing status, review queue (filtered by role permissions), and application detail views with agent analysis summaries.

- [ ] **Database schema and migrations** -- Schema supporting applications, documents, agent decisions, audit events, workflow state, and user roles. Idempotent migrations with rollback support.

- [ ] **Health checks** -- Liveness and readiness endpoints. Readiness check verifies that critical dependencies (database, LLM APIs) are reachable.

- [ ] **Developer setup experience** -- Single command sequence to install dependencies, start infrastructure, run migrations, and launch the application. README with architecture overview, quickstart guide, and troubleshooting.

- [ ] **Fraud detection agent** -- Identifies suspicious patterns: income discrepancies across documents, property flip patterns, identity inconsistencies, and document metadata anomalies (creation dates, producer fields). Any fraud flag forces human review regardless of other confidence scores. Configurable sensitivity levels.

- [ ] **Denial coaching agent** -- When an application is denied or has low confidence, provides actionable improvement recommendations: DTI improvement strategies, down payment and LTV scenarios, credit score guidance, and what-if calculations. Plain-language recommendations suitable for sharing with borrowers.

- [ ] **Intake agent (public chat)** -- Conversational assistant accessible without authentication. Answers mortgage questions using a knowledge retrieval system with source citations. Provides current mortgage rate information and basic property data. Performs mortgage calculations on request. Adjusts tone based on user sentiment analysis. Operates as an independent agent graph from the loan processing workflow, sharing only infrastructure services (database, cache, external APIs). The two graphs have different lifecycle, security, and scaling characteristics.

- [ ] **Mortgage calculator** -- Standalone UI component and agent-callable tool. Calculates monthly payment (principal, interest, taxes, insurance), total interest over loan life, DTI preview, affordability estimate, and amortization schedule. Comparison mode for side-by-side scenarios. Auto-populated with current rate data. All outputs include legal disclaimers.

- [ ] **Public access tier with rate limiting** -- Unauthenticated access to the intake agent, mortgage calculator, current rates, and limited property lookups. Session-based rate limiting, cost caps, and prompt injection defenses. Separate from the authenticated application processing tier.

- [ ] **External data integration for rates and property** -- Live mortgage rate and economic indicator data from a public federal data source. Property data and valuations from an external data provider (mocked by default, real API key optional).

- [ ] **Audit trail export** -- Export complete audit trail for an application as a document, including all agent decisions, human reviews, workflow transitions, and source document references.

### Should Have (P1)

- [ ] **Streaming chat responses** -- Chat responses from the intake agent delivered incrementally so users see text appearing in real time rather than waiting for the complete response.

- [ ] **LLM observability dashboard** -- Tracing, cost tracking, and performance monitoring for all LLM calls across the agent system. Accessible as a dashboard for platform engineers and developers.

### Could Have (P2)

- [ ] **Cross-session chat context** -- Authenticated users can reference prior chat conversations through the intake agent. The agent maintains context across sessions for a more personalized experience.

- [ ] **Admin configuration interface** -- Web interface for reviewers to adjust confidence thresholds, manage the compliance knowledge base, and view system-wide decision patterns. All configuration changes recorded in the audit trail.

- [ ] **Portfolio analytics dashboard** -- Aggregate views of application processing: approval rates, average processing times, escalation frequency, common denial reasons. Useful for risk management leads.

- [ ] **Seed data with diverse test cases** -- Development seed data including applications with high and low credit scores, various income levels, different property types, and edge cases that trigger escalation, fraud flags, and denial coaching.

- [ ] **Container deployment manifests** -- Deployment configuration for container orchestration platforms, including resource definitions, environment configuration, and operational documentation.

- [ ] **CI pipeline** -- Continuous integration pipeline running tests, linting, type checking, and dependency vulnerability scanning on every push.

- [ ] **API key lifecycle management** -- Reviewers can generate new API keys, revoke existing keys, and set expiration dates. All key lifecycle events recorded in the audit trail. (MVP uses static keys; this addresses the key rotation gap.)

### Won't Have (This Project)

- Production regulatory certification or compliance audit
- User registration, password management, or federated identity
- Real credit bureau API integration
- Payment or loan disbursement processing
- Mobile application or native app
- Multi-tenant data isolation
- Custom model training or fine-tuning
- Bidirectional real-time connections for application status updates
- Internationalization or non-US regulatory support
- High-availability or multi-region deployment
- Automated load testing or performance benchmarking suite

---

## User Flows

### Flow 1: Alex Deploys and Explores the Quickstart

**Persona:** Alex (AI Developer)

1. Alex clones the repository and reads the README.
2. Alex runs the setup command sequence. Dependencies install, infrastructure services start, database migrations run, and seed data loads.
3. Alex opens the application in a browser and sees the public landing page with the mortgage calculator and chat interface.
4. Alex opens the chat and asks "What credit score do I need for a mortgage?" The intake agent responds with sourced information.
5. Alex logs in with the provided demo API key (loan_officer role) and sees the loan officer dashboard with pre-seeded applications in various states.
6. Alex opens a completed application and examines the agent analysis: document extraction results, credit analysis, risk assessment, compliance check -- each with confidence scores and reasoning.
7. Alex opens an application in the review queue, reads the agent analysis, and makes an approval decision with a rationale note. The audit trail updates.
8. Alex examines the codebase: reads the supervisor agent code, traces the workflow from initialization through parallel fan-out to final decision, and understands the pattern well enough to adapt it.
9. Total time from clone to understanding: under 2 hours.

### Flow 2: Maria Processes a Loan Application

**Persona:** Maria (Loan Officer)

1. Maria logs in and sees her dashboard: a list of applications and a review queue showing items that need her attention.
2. Maria creates a new application by entering borrower information and loan terms.
3. Maria uploads documents: W-2, recent pay stubs, bank statements, and a property appraisal.
4. The system begins processing. Maria can see the status update as each agent completes its analysis.
5. Processing completes. The application shows a summary: document extraction results (with any data the system was uncertain about highlighted), credit analysis summary, risk metrics (DTI, LTV), and compliance status.
6. The overall confidence is high. The system recommends auto-approval. Maria reviews the summary, agrees, and confirms the approval.
7. The audit trail records Maria's confirmation with timestamp and her identity.

**Alternate path -- Low confidence / Escalation:**

5a. Processing completes but with medium confidence. The system flags that income figures from the pay stub and tax return don't match precisely.
6a. The application appears in the review queue. Maria opens it and sees the specific discrepancy highlighted by the agents, along with each agent's individual confidence score and reasoning.
7a. Maria determines the discrepancy is within acceptable range (seasonal overtime income), writes a rationale note, and approves.
8a. The audit trail records the escalation reason, Maria's review, her rationale, and the approval.

**Alternate path -- Request more documents:**

6b. Maria reviews the flagged application and determines she needs a more recent bank statement to verify the income discrepancy.
7b. Maria selects "request more documents" and specifies what is needed. The workflow cycles back to document processing when new documents are uploaded.

### Flow 3: James Conducts a Compliance Audit

**Persona:** James (Compliance Officer)

1. James logs in with reviewer credentials and navigates to the compliance section.
2. James searches for a specific application by ID or borrower name.
3. James opens the application's audit trail, which shows the complete decision history: every agent analysis with confidence scores and reasoning, every human review with identity and rationale, every workflow state transition.
4. James verifies that the denial of a specific application cites objective financial criteria (DTI ratio exceeded threshold, LTV above guideline) and includes proper regulatory references.
5. James exports the audit trail as a document for the regulatory examination file.
6. Total time from search to exported audit: under 5 minutes.

### Flow 4: Sam Explores Mortgage Options

**Persona:** Sam (Borrower)

1. Sam visits the public landing page without logging in.
2. Sam opens the mortgage calculator, enters a home price, down payment, and sees estimated monthly payments with current rates automatically populated.
3. Sam adjusts the down payment slider and watches the monthly payment and DTI estimate update. Compares two scenarios side by side.
4. Sam opens the chat and asks "I make $75,000 a year. Can I afford a $350,000 house?" The intake agent responds with a clear, plain-language analysis including DTI calculation, estimated monthly payment, and what documents Sam would need to bring to a loan officer.
5. Sam asks a follow-up: "What if I put 20% down instead of 10%?" The agent runs the calculation and explains the difference, including how it affects the LTV ratio and whether private mortgage insurance would be needed.
6. All calculator outputs and chat responses include a disclaimer that estimates are not binding offers.

### Flow 5: Dana Adjusts Risk Thresholds

**Persona:** Dana (Risk Management Lead)

1. Dana logs in with reviewer credentials and opens the admin configuration interface.
2. Dana views the current confidence thresholds: the auto-approval threshold, the escalation threshold, and the denial threshold.
3. Dana adjusts the auto-approval threshold to be more conservative (requiring higher confidence for auto-approval).
4. The system records the threshold change in the audit trail with Dana's identity, the old value, the new value, and a timestamp.
5. New applications processed after the change use the updated threshold.

---

## Non-Functional Requirements

### Performance (User-Facing)

| Requirement | User Experience Target |
|------------|----------------------|
| Document processing | Processing a single uploaded document feels responsive -- completes within a short wait, not a long delay |
| Full application processing (no human review) | A complete application processes end-to-end within a few minutes -- fast enough that the user can wait or briefly step away |
| Application detail page load | Application data and agent analysis load without noticeable delay when navigating |
| UI initial page load | The application opens quickly on a standard connection -- no multi-second blank screen |
| Concurrent users | Multiple loan officers can process applications simultaneously without degradation |
| Chat responses (intake agent) | Chat responses begin appearing within a conversational pause -- the user should not wonder if the system is broken |
| Knowledge retrieval responses | Previously-asked questions resolve noticeably faster than novel queries |

### Reliability

- Workflow state survives service restarts. An in-progress application resumes from its last checkpoint with no data loss.
- Database migrations are idempotent and support rollback.
- The system degrades gracefully when optional services (caching, observability) are unavailable -- core processing continues.
- Health checks fail when critical dependencies are unreachable, enabling orchestration platforms to route traffic correctly.
- Transient failures in external AI services are retried automatically rather than immediately failing the workflow.

### Auditability

- Every agent decision is recorded with timestamp, confidence score, and human-readable reasoning.
- Every human review is recorded with user identity, role, timestamp, decision, and rationale.
- Every workflow state transition is logged.
- Audit records are immutable once written -- append-only.
- Immutability enforced at the database level: application database roles have no UPDATE or DELETE grants on audit tables. Application code exposes only append and query operations on audit records.
- Audit trails are exportable as a document with all source document references.
- Regulatory citations in compliance checks are traceable to specific document versions in the knowledge base.

### Security

- All API endpoints except health checks and the public access tier require authentication.
- Secrets are never stored in code; managed via environment configuration.
- PII (SSN, financial data) is protected at rest and never included in log output.
- All HTTP traffic uses TLS in production.
- Input validation on all API endpoints.
- Dependency vulnerability scanning in the CI pipeline.
- Document images are redacted of PII before being sent to external AI services.
- Rate limiting on the public access tier prevents abuse and controls costs.
- Prompt injection defenses on all user-facing AI interfaces.

### Developer Experience

- Full local setup completable in under 30 minutes.
- README includes architecture overview, quickstart walkthrough, and troubleshooting.
- API documented via interactive documentation UI.
- Code includes inline comments explaining multi-agent patterns.
- Development seed data covers diverse test cases.

### Observability

- All logs are structured with a consistent schema.
- Every log entry includes a correlation ID for tracing requests across services.
- LLM interactions are traceable with cost and performance visibility through an observability dashboard.
- Critical errors are logged at appropriate severity levels.

### Maintainability

- Code follows project style guides.
- Test coverage reaches at least 70% for backend services.
- All agents are implemented as modular units with consistent interfaces.
- Configuration is externalized -- no hardcoded URLs, API keys, or thresholds.

---

## Security Considerations

### Two-Tier Access Model

The system has two distinct access tiers with different security profiles:

**Public Tier (Unauthenticated)**
- Access: Intake chat agent, mortgage calculator, current rates, limited property lookups
- Protections: Session-based rate limiting, IP-based cost caps, prompt injection defenses, session expiration (24-hour TTL)
- Risk: Uncontrolled public access could generate excessive AI inference costs or be used for prompt injection attacks
- Mitigation: Rate limiting at session and IP level, input sanitization, response content filtering, cost monitoring with alerts

**Public Tier Threat Mitigation Patterns**

This quickstart demonstrates exemplary defenses for public-facing AI interfaces:

*Prompt Injection Defenses:*
- Input sanitization: removal of system-prompt-style markers and instruction delimiters
- Output filtering: preventing reflection of potential injection payloads
- Semantic detection: flagging inputs that request system behavior changes, role-playing, or context escapes
- Structured prompting with clear user/system boundaries

*Cost Abuse Controls:*
- Per-session token budget (capped total inference cost per 24-hour session)
- Per-IP daily request caps for chat and calculator endpoints
- Per-session concurrency limits (max 1 active inference per session)
- Cost monitoring with automatic disable thresholds

*Rate Limiting Strategy:*
- Tiered limits (per-second, per-minute, per-hour, per-day) at session and IP levels
- Differentiated limits for calculator (higher throughput, lower cost) vs. chat (lower throughput, higher cost)

**Protected Tier (Authenticated)**
- Access: All application management, review queue, admin settings, audit export
- Protections: API key authentication (bearer token format), role-based access control, 90-day session TTL
- Authentication format: `Authorization: Bearer <role>:<key>`
- Startup warning if running with default keys

### Role Hierarchy

| Role | Permissions |
|------|------------|
| `loan_officer` | Standard application processing, review of MEDIUM-confidence escalations |
| `senior_underwriter` | All loan officer permissions plus review of LOW-confidence escalations |
| `reviewer` | All permissions plus audit trail export, compliance reports, threshold configuration, knowledge base management |

**Known Limitation:** Confidence threshold changes by reviewers are immediately effective and do not require a second approval. Production systems in regulated industries typically implement a maker/checker pattern for risk parameter changes. For the MVP, single-reviewer authority with full audit trail is sufficient -- the audit trail records all changes, enabling post-hoc review.

### PII Handling

- SSN, date of birth, bank account numbers, and income figures are PII
- PII is never logged, never included in error responses, never cached in plaintext
- Document images are redacted of PII before transmission to external AI services
- Monetary values stored as integer cents to avoid floating-point precision issues
- All denial reasons trace to objective financial criteria -- never subjective assessments (fair lending requirement)

### MVP Authentication Scope

This project uses API key authentication as an MVP auth scheme. Production systems would use federated identity with token-based authentication. The API key approach is chosen for simplicity while still providing real authentication (not mocked) and role-based authorization from day one.

---

## Mocked vs. Real Services

### Mocked Services (with Real Interface for Swapping)

| Service | What the Mock Provides | Why Mocked |
|---------|----------------------|-----------|
| Credit Bureau API | Realistic credit report data with randomized scores, payment history, and derogatory marks | Real APIs require expensive contracts and PCI compliance |
| Email Notifications | Logs notification events to console and database | Avoids SMTP configuration complexity for a quickstart |
| Property Data API (default) | Static fixture property data with valuations and comparable sales | Pay-per-lookup pricing; mock has realistic response structure |
| Employment Verification | Treats uploaded pay stubs as authoritative | Real verification requires third-party integrations |

All mocked services implement the same interface as the real service, enabling swap-in without code changes. Mock data includes diverse test cases: high/low credit scores, various income levels, different property types, and edge cases that trigger escalation.

**Security Implications of Mocked Services**

Developers using this quickstart as a reference should understand what security signals are absent in the mocked services:

- **Mocked Credit Bureau:** Does not include credit freeze detection, SSN validation against bureau records, velocity checks (multiple inquiries in short time), or synthetic identity detection. The fraud detection agent cannot catch these patterns with mocked data. Real implementations must integrate actual credit bureau fraud signals.
- **Mocked Employment Verification:** Treats uploaded pay stubs as authoritative without employer confirmation. Does not detect forged pay stubs, employer name mismatches, or income inflation. Real implementations require third-party verification services.

### Real Services

| Service | Purpose |
|---------|---------|
| LLM APIs (reasoning + vision) | Document analysis, credit reasoning, compliance checking, intake conversations |
| Database with vector extension | All application data and knowledge retrieval embeddings |
| Cache | Knowledge retrieval query caching, session data, external API response caching, rate limiting |
| Object storage | Document uploads (W-2, pay stubs, tax returns, bank statements, appraisals) |
| Federal economic data API | Live mortgage rates and economic indicators (free tier) |
| LLM observability platform | Tracing, cost tracking, performance monitoring |

---

## Phasing

### Phase 1: Foundation

**Capability milestone:** The system has a working application lifecycle (create, view, track) with a stub agent that runs through the complete supervisor-worker workflow pattern without real AI. A developer can start the system, create an application, see it flow through the orchestrated workflow, and verify that audit events are recorded at each step. Authentication and role-based access are functional. The pattern is proven before real AI is added.

**Features included:** Supervisor-worker agent orchestration (with stub agents), database schema and migrations, loan application management, role-based access control, API key authentication, immutable audit trail, health checks, developer setup experience.

**Key risks:**
- Orchestration framework learning curve may slow initial velocity
- Schema design decisions made early constrain later phases; getting audit trail schema wrong is expensive to fix
- The stub-agent approach must be realistic enough that swapping in real agents later is straightforward
- The agent orchestration checkpoint schema must accommodate the full graph structure (parallel fan-out, cyclic document resubmission) from day one, even though those workflow paths use stubs in Phase 1. Retrofitting checkpoint compatibility across phases is harder than designing forward-compatible state from the start.
- The project template scaffolding (application skeleton, build configuration, container composition) does not yet exist in the repository. Creating it is a prerequisite for all other Phase 1 work and represents significant effort.

### Phase 2: Core AI Agents

**Capability milestone:** The system processes real documents with AI. A developer can upload a W-2 or pay stub, watch the document processing agent extract structured data using a vision model, see the credit analysis agent evaluate (mocked) credit data, and observe confidence-based routing in action. Applications with high confidence auto-approve; applications with lower confidence land in the review queue. This is the first phase where the demo is genuinely impressive.

**Features included:** Document processing agent, credit analysis agent, risk assessment agent, confidence-based routing, human-in-the-loop review workflow, loan officer dashboard.

**Key risks:**
- Vision model accuracy on diverse document formats may be lower than expected
- Mocked credit data must be realistic enough to produce meaningful analysis
- Confidence calibration across multiple agents requires tuning
- PII redaction from document images is architecturally complex. The approach (local pre-processing pipeline vs. multi-pass LLM vs. text-only extraction with PII stripping) must be decided during technical design. A design spike may be needed to validate the chosen approach before committing to implementation.

### Phase 3a: Full Agent Suite

**Capability milestone:** All analysis agents are operational for the authenticated loan processing workflow. Compliance checking verifies decisions against regulatory requirements using knowledge retrieval with specific citations. Fraud detection examines document metadata and cross-source inconsistencies. Denied applications receive actionable improvement coaching. The system demonstrates the complete multi-agent pattern for loan processing at scale.

**Features included:** Compliance checking agent, fraud detection agent, denial coaching agent.

**Key risks:**
- Knowledge retrieval for compliance requires a curated regulatory document set; quality of the knowledge base directly determines compliance checking quality
- Fraud detection sensitivity calibration requires balancing false positive rate (too many unnecessary escalations) against false negative rate (missed fraud)

### Phase 3b: Public Access and External Data

**Capability milestone:** The public-facing tier is live. Unauthenticated users can chat with the intake agent about mortgage questions, use the mortgage calculator with live rate data, and get property information. The intake agent operates as an independent system from the loan processing workflow, with its own security posture and rate limiting. Streaming responses make the chat experience feel conversational.

**Features included:** Intake agent (public chat), mortgage calculator, streaming chat responses, public access tier with rate limiting, external data integration for rates and property.

**Key risks:**
- Public access tier expands the attack surface significantly (prompt injection, cost abuse, session management)
- The intake agent is an independent graph requiring its own design, testing, and security review
- Integrating multiple external data sources (federal rates API, property data API) increases fragility
- Rate limiting must be correctly calibrated before public access goes live

### Phase 4: Polish and Operability

**Capability milestone:** The system is production-quality as a reference implementation. Platform engineers can deploy it with provided manifests and monitor it through an observability dashboard. Compliance officers can export complete audit trails. Risk management leads can configure thresholds through an admin interface. Authenticated chat users benefit from cross-session context. CI pipeline catches regressions. Documentation is comprehensive enough for a developer to understand and extend the system independently.

**Features included:** LLM observability dashboard, audit trail export, cross-session chat context, admin configuration interface, portfolio analytics dashboard, seed data with diverse test cases, container deployment manifests, CI pipeline.

**Key risks:**
- Observability integration may require significant instrumentation across all agents
- Cross-session context adds complexity to the chat system (conversation storage, context window management)
- Documentation must be written for the developer persona, not just as API reference

---

## Open Questions

1. **Knowledge base content for compliance agent** -- What specific regulatory documents should be included in the compliance knowledge base for the MVP? ECOA, Fair Housing Act, TILA, RESPA? How current must they be? Who curates them?

2. **Vision model selection for document processing** -- The product brief specifies a hybrid LLM strategy with different models for different tasks. How should the system handle model availability? What is the fallback if a specific model API is unreachable?

3. **Confidence threshold defaults** -- What should the default confidence thresholds be for auto-approval, escalation, and denial? These are configurable, but the defaults set expectations for the quickstart experience.

4. **Seed data scope** -- How many pre-seeded applications should the quickstart include? What states should they cover (in-progress, auto-approved, escalated, denied, awaiting documents)?

5. **Property data API key** -- The property data service is mocked by default but supports a real API key. Should the setup flow prompt for an optional API key, or should this be a post-setup configuration?

6. **Local model support** -- The brief mentions optional local model support for data residency scenarios. Is this in scope for the MVP phases, or is it an extension?

7. **Document resubmission UX** -- When a reviewer requests additional documents and the workflow cycles back, how should the borrower be notified? The notification service is mocked -- should the UI show a status change that Maria (loan officer) communicates manually?

8. **Chat session limits** -- For the public tier, what are appropriate limits? Maximum messages per session? Maximum sessions per IP per day? These affect both cost and user experience.

9. **PII redaction approach** -- What mechanism should be used for PII redaction from document images before external LLM calls? Options include: (a) local OCR/NER pipeline that extracts text and strips PII before sending to vision model, (b) multi-pass LLM approach where a first call detects PII regions and a second processes the redacted image, (c) processing documents locally and only sending extracted structured data (not images) to external APIs. What is the fallback if the redaction service is unavailable?

10. **Checkpoint schema forward-compatibility** -- How should the LangGraph checkpoint schema be designed in Phase 1 to accommodate the full graph structure (parallel fan-out to 4+ agents, cyclic document resubmission path, fraud-forced escalation) without requiring checkpoint migration in later phases?

---

## Assumptions

1. LLM API access (reasoning and vision models) will be available and funded for the duration of development and demonstration.
2. A curated set of mortgage regulatory documents can be prepared for the compliance knowledge base.
3. The Red Hat AI Quickstart template defines the technology stack and project structure, but the application scaffolding (packages, build configuration, container composition, Makefile) must be created as part of Phase 1. This project extends the template's conventions rather than replacing them.
4. Developers using the quickstart have basic familiarity with containers, Python, and TypeScript -- the quickstart teaches multi-agent patterns, not programming fundamentals.
5. The federal economic data API free tier (120 requests/minute) is sufficient for development and demonstration use.
6. Mocked services (credit bureau, employment verification) produce data realistic enough to demonstrate the agent patterns meaningfully.

---

## Stakeholder-Mandated Constraints

The following technology and platform requirements were explicitly stated by the stakeholder. They are recorded here as inputs for the Architect -- they are not product decisions.

| Constraint | Detail |
|-----------|--------|
| Container platform | OpenShift for deployment, Podman for containers, Helm for orchestration |
| Application template | Must extend the existing Red Hat AI Quickstart template (Turborepo monorepo with React 19, FastAPI, PostgreSQL, Helm charts) |
| Agent orchestration | LangGraph with persistent checkpointing (PostgresSaver) |
| LLM strategy | Hybrid: Claude for reasoning, GPT-4 Vision for document analysis, optional LlamaStack for local/data-residency |
| Database | PostgreSQL with pgvector extension for both application data and RAG embeddings (no separate vector DB) |
| Frontend stack | React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui |
| Backend framework | FastAPI (async) |
| ORM and migrations | SQLAlchemy 2.0 (async) + Alembic |
| Caching | Redis for RAG queries, sessions, external API responses, rate limiting |
| Object storage | MinIO (S3-compatible) for document uploads |
| LLM observability | LangFuse for tracing and cost tracking |
| External data: rates | FRED API for mortgage rates and economic indicators (DGS10, CSUSHPISA) |
| External data: property | BatchData API for property data and AVM valuations (mocked by default) |
| Testing | Vitest + Playwright (frontend), Pytest (backend) |
| Package managers | pnpm (frontend), uv (backend) |
| Build system | Turborepo |
| Financial calculations | Decimal (Python) or integer cents (TypeScript) -- never floating-point for money |

---

## Completion Criteria

The AI Mortgage Quickstart is considered complete when:

1. **Developer quickstart works end-to-end** -- A developer unfamiliar with the project can clone, set up, and have a working demo in under 30 minutes.
2. **Full agent workflow demonstrated** -- An application can be submitted, processed through all agents (document processing, credit analysis, risk assessment, compliance check, fraud detection), and reach a final decision (auto-approve, escalate, or deny) with complete audit trail.
3. **Human-in-the-loop works** -- An escalated application appears in the review queue, a reviewer can examine agent analysis, and can approve, deny, or request more documents (cycling the workflow).
4. **Public tier functional** -- An unauthenticated user can chat with the intake agent, use the mortgage calculator with live rate data, and receive helpful, cited responses.
5. **Audit trail complete** -- Every agent decision, human action, and workflow transition is recorded immutably and exportable.
6. **Three roles enforce access control** -- Loan officer, senior underwriter, and reviewer roles have distinct, enforced permissions.
7. **Code is teachable** -- Inline documentation explains multi-agent patterns clearly enough that a developer can understand and adapt them.
8. **Tests pass** -- Backend test coverage reaches at least 70%. All happy-path and critical edge-case tests pass.
9. **Deployable** -- The system can be deployed to a container platform using the provided deployment manifests.
