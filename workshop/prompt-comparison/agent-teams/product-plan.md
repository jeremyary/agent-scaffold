<!-- This project was developed with assistance from AI tools. -->

# Product Plan: Multi-Agent Mortgage Loan Processing System

## Executive Summary

This product is an AI-powered mortgage loan processing system built as a **developer quickstart** for the Red Hat AI Quickstart template. It is a reference implementation that demonstrates how to build multi-agent AI systems for regulated industries -- specifically US mortgage lending.

The system is **not** a production loan origination system. It is a teaching tool that shows patterns: supervisor-worker orchestration, human-in-the-loop workflows, compliance-first design with complete audit trails, and confidence-based escalation. It uses mocked services where real integrations would require expensive contracts or certifications, but those mocks implement the same interfaces as their real counterparts so developers can swap them.

The system serves three distinct audiences: **AI developers** who want to learn multi-agent patterns, **domain users** (loan officers, compliance officers) who interact with the loan processing workflow, and **borrowers** who use the public-facing intake interface. Maturity level is **MVP**: happy-path testing plus critical edges, real authentication from day one, and documentation sufficient to get a developer from clone to running system in under 30 minutes.

---

## Problem Statement

Mortgage loan origination today suffers from five compounding inefficiencies:

1. **Manual document review** consumes 3-5 hours per application. Loan officers manually extract data from pay stubs, tax returns, bank statements, and property appraisals -- tedious work that is error-prone and does not scale.

2. **Inconsistent underwriting.** Different loan officers apply varying standards and miss different risk factors, leading to approval inconsistencies and higher default rates. There is no systematic way to ensure every application receives the same rigor.

3. **Regulatory complexity.** Compliance officers struggle to maintain complete audit trails across fragmented systems, risking fair lending violations (ECOA, Fair Housing Act) and regulatory penalties. When auditors arrive, producing a complete decision history for a single application can take hours.

4. **Extended processing time.** Applications take 30-45 days due to manual handoffs, missing document requests, and repeated checks. Borrowers wait weeks with no visibility into progress.

5. **Poor explainability.** When loans are denied, officers cannot easily articulate the decision rationale. This leads to customer dissatisfaction, potential discrimination claims, and regulatory risk.

Beyond the domain problem, **AI developers building for regulated industries** lack reference implementations that demonstrate production-quality patterns. Most multi-agent demos are toy examples that ignore compliance, audit trails, human oversight, and the operational realities of regulated domains.

---

## Target Users

### Persona: Alex -- AI Developer / Solutions Architect (P1)

- **Role:** Software engineer or architect evaluating multi-agent AI patterns for regulated industry applications
- **Goals:** Learn supervisor-worker orchestration, human-in-the-loop workflows, confidence-based escalation, and compliance-first design. Clone, deploy, and customize the quickstart for their own domain within 2 hours.
- **Pain Points:** Existing multi-agent demos are trivial toys that ignore real-world concerns (audit, compliance, auth, error handling). Production-quality reference implementations for regulated domains are rare.
- **Context:** Evaluating the Red Hat AI Quickstart template. Needs to understand the patterns quickly, run the system locally, and adapt it. Values clear documentation, clean code, and realistic (not contrived) demonstrations of each pattern.
- **Success Criteria:** Full local setup in under 30 minutes. Can trace a loan application through the entire multi-agent workflow and understand every decision point. Can identify which patterns to reuse for their domain.

### Persona: Maria -- Loan Officer (P2)

- **Role:** Reviews loan applications and makes approval recommendations
- **Goals:** Process more applications with less manual data entry while maintaining decision quality. Review AI-processed applications in approximately 30 minutes versus 3 hours previously.
- **Pain Points:** Spends most of her day on data extraction and cross-referencing, not on judgment calls. Inconsistency across peers creates audit risk. No systematic way to catch everything.
- **Context:** Receives AI-processed applications with extracted data, risk scores, and compliance checks already completed. Reviews flagged items, makes final recommendations, and handles escalations.
- **Success Criteria:** Can review an AI-processed application and either approve, deny, or request additional documents in a single sitting. Trusts the AI analysis because she can see the reasoning and confidence scores.

### Persona: David -- Compliance Officer (P3)

- **Role:** Ensures fair lending compliance and maintains audit trails for regulatory examinations
- **Goals:** Generate a complete audit trail for any application quickly. Demonstrate that decisions were based solely on permitted factors. Respond to regulatory inquiries with confidence.
- **Pain Points:** Current audit trail assembly is manual and fragmented. Cannot easily prove non-discrimination. Regulatory examinations are stressful because evidence is scattered.
- **Context:** Reviews audit trails, generates compliance reports, manages the knowledge base of regulations and policies. Configures confidence thresholds and risk parameters.
- **Success Criteria:** Can produce a complete audit trail for any application in under 5 minutes. Every denial cites specific, quantifiable financial reasons with no reference to protected characteristics.

### Persona: Sam -- Platform Engineer (P4)

- **Role:** Deploys and operates AI systems on container platforms
- **Goals:** Reliable deployment, observability, and cost optimization
- **Pain Points:** AI systems are often difficult to containerize, monitor, and operate. Quickstarts rarely include production-grade deployment artifacts.
- **Context:** Deploys via provided container orchestration charts. Monitors via observability dashboards. Manages infrastructure.
- **Success Criteria:** Can deploy the complete system using provided deployment artifacts. Has access to observability dashboards showing workflow traces and system health.

### Persona: Rachel -- Risk Management Lead (P5)

- **Role:** Defines underwriting policies and risk thresholds
- **Goals:** Configurable risk models, transparent decision logic, and performance monitoring
- **Pain Points:** Cannot easily adjust risk parameters or see their impact. Decision logic is opaque.
- **Context:** Adjusts confidence thresholds, reviews decision patterns, monitors approval/denial rates.
- **Success Criteria:** Can adjust confidence thresholds with full audit trail of changes. Can review decision patterns and their distribution.

### Persona: Jordan -- Borrower / Applicant (P6)

- **Role:** Prospective homebuyer or refinancer exploring mortgage options
- **Goals:** Understand qualification likelihood, what documents to prepare, and current market rates. Get plain-language guidance on mortgage concepts.
- **Pain Points:** Mortgage process is opaque and intimidating. Limited financial literacy. No easy way to explore "what-if" scenarios.
- **Context:** Interacts through a public chat interface and mortgage calculator without authentication. Does NOT directly create applications -- works with a loan officer. May have limited mortgage knowledge.
- **Success Criteria:** Can get answers to mortgage questions in plain language. Can use the calculator to explore payment scenarios. Feels informed, not overwhelmed.

---

## Goals and Success Metrics

### Primary Goals

1. **Demonstrate multi-agent AI patterns** (supervisor-worker orchestration, confidence-based escalation, human-in-the-loop) in a regulated industry context
2. **Provide a compelling, runnable developer quickstart** for the Red Hat AI Quickstart template that showcases real value with mocked external services
3. **Maintain complete, immutable audit trails** with explainable AI reasoning for every agent decision
4. **Show compliance-first design patterns** (fair lending, adverse action notices, fraud detection) that translate to production regulated systems

### Success Metrics

| Metric | Current Baseline | Target | Measurement Method |
|--------|-----------------|--------|-------------------|
| Developer setup time (clone to running system) | N/A (new project) | Under 30 minutes | Timed walkthrough by a developer unfamiliar with the project |
| Document data extraction accuracy | Manual (3-5 hours) | 95%+ field extraction accuracy with confidence scoring | Comparison of extracted data against known-correct test documents |
| Application review time (loan officer) | 3 hours manual | ~30 minutes for AI-processed application | Timed review of AI-processed application in demo scenario |
| Audit trail generation time | Hours (manual assembly) | Under 5 minutes for complete audit trail | Timed export of complete audit trail including all agent decisions |
| Agent decision explainability | None (no AI) | Every decision includes confidence score and plain-language reasoning | Inspection of audit records for completeness |
| Denial reason specificity | Vague ("insufficient credit") | Every denial cites specific quantifiable metrics (DTI, LTV, credit score) | Review of adverse action notice content |
| Test coverage (backend) | N/A (new project) | 70%+ line coverage | CI pipeline coverage report |
| Concurrent workflow support | N/A (new project) | Multiple simultaneous applications without degradation | Load test with concurrent workflow executions |

---

## Feature Scope

### Must Have (P0)

These features are required for the system to function as a meaningful quickstart demonstration.

- [ ] **Loan application lifecycle management** -- Create, submit, track, and close loan applications through defined states (draft, submitted, processing, awaiting review, approved, denied, withdrawn). Each state transition is recorded immutably.

- [ ] **Automated document data extraction with confidence scoring** -- Upload loan documents (pay stubs, W-2s, tax returns, bank statements, appraisals), automatically classify document type, extract structured data fields, and produce a confidence score for each extraction. Support for common document image formats and PDFs.

- [ ] **Multi-agent loan analysis workflow** -- A supervisor agent coordinates specialized worker agents through a defined workflow: document processing, then parallel analysis (credit, risk, compliance), then aggregation and routing decision. Each agent produces a confidence score and plain-language reasoning. Workflow state is persistently checkpointed so in-progress applications survive service restarts with no data loss.

- [ ] **Credit analysis with mocked credit bureau** -- Evaluate creditworthiness from credit report data (mocked). Analyze credit score, payment history, derogatory marks, and trends. Produce a plain-language summary with confidence score.

- [ ] **Financial risk assessment** -- Calculate DTI ratio, LTV ratio, and employment stability score. Cross-validate income across multiple document sources. Produce an overall risk score with component breakdown.

- [ ] **Regulatory compliance verification** -- Verify fair lending compliance by checking that decisions reference only permitted factors. Generate adverse action notices with specific, quantifiable denial reasons and regulatory citations. Verify audit trail completeness.

- [ ] **Confidence-based routing and escalation** -- High-confidence results proceed automatically. Low or medium confidence pauses for human review. Any fraud flag forces human review regardless of other scores. All agent disagreements escalate to human review. Thresholds are configurable with audit trail for changes.

- [ ] **Human-in-the-loop review workflow** -- When applications are escalated, a review queue presents them with full context (all agent analyses, confidence scores, reasoning). Human reviewers can approve, deny, or request additional documents. When a reviewer requests additional documents, the application returns to awaiting-documents status; new uploads trigger a fresh analysis pass (full pipeline re-run).

- [ ] **Complete immutable audit trail** -- Every agent decision, human review action, and workflow state transition recorded with timestamp, actor identity, confidence score (for agents), reasoning, and input data reference. Append-only -- no updates or deletes. The audit event recording mechanism and append-only storage are foundational infrastructure from Phase 1; query UI, export, and compliance reporting are delivered in later phases.

- [ ] **Role-based access control with three roles** -- `loan_officer` (standard processing, medium-confidence reviews), `senior_underwriter` (all loan officer capabilities plus low-confidence escalations), `reviewer` (all capabilities plus audit export, compliance reports, threshold configuration, knowledge base management). Real authentication from day one. The system refuses to start in production mode with default/seed credentials (hard fail, not just a warning). Keys have a configurable TTL (default 90 days for protected tier).

- [ ] **PII redaction in LLM interactions** -- Redact personally identifiable information (SSN, account numbers, government IDs) from data sent to external LLM APIs. Sensitive fields masked in all log output. Required from the first phase that introduces real LLM calls (Phase 2).

- [ ] **Loan processing dashboard** -- UI for authenticated users showing application list, application detail with all agent analyses, review queue with filtering by priority and status, and workflow progress visualization.

- [ ] **API-first design with interactive documentation** -- All functionality accessible via API. Interactive API documentation available for developers.

- [ ] **Self-contained local development setup** -- Single command to install dependencies, single command to start all services. Seed data with diverse test cases included. Development documentation with architecture overview and troubleshooting guide.

### Should Have (P1)

Important features that enhance the quickstart's value but are not required for the core workflow to function.

- [ ] **Fraud detection with document metadata analysis** -- Identify suspicious patterns: income discrepancies across documents, property flip patterns, identity inconsistencies. Examine document metadata (creation dates, producer fields) for fraud indicators. Configurable sensitivity. Any fraud flag forces human review.

- [ ] **Denial coaching and improvement recommendations** -- When an application is denied or has low confidence, provide actionable improvement recommendations: DTI improvement strategies, down payment / LTV scenarios, credit score guidance. Include what-if calculations. Plain-language recommendations suitable for sharing with the borrower.

- [ ] **Conversational mortgage Q&A with knowledge base** -- A chat interface (both public and authenticated) that answers mortgage questions using a knowledge base of regulations and guidance documents. Provides source citations for regulatory answers. Plain-language guidance suitable for borrowers with limited mortgage knowledge.

- [ ] **Intake agent data integration and calculator tool use** -- The intake chat agent can retrieve live market data (current rates, housing indices) from external data sources and property information from the property data service. Can invoke the mortgage calculator to show payment scenarios, affordability estimates, and comparison calculations within the conversation.

- [ ] **Mortgage calculator** -- Standalone UI widget and tool available to the intake agent. Calculates monthly payment (principal, interest, taxes, insurance), total interest over loan life, DTI preview, affordability estimate, and amortization schedule. Supports comparison mode (side-by-side scenarios). Displays current market rates. All outputs include appropriate legal disclaimers.

- [ ] **External data integration -- economic data** -- Live mortgage rate data and economic indicators (Treasury yields, housing price indices) from a public federal data source. Displayed in the UI and available to the intake agent.

- [ ] **External data integration -- property data** -- Property valuation data, comparable sales, and AVM (Automated Valuation Model) estimates. Mocked by default with realistic fixture data; supports swapping to a real provider with an API key.

- [ ] **Streaming chat responses** -- Chat responses from the intake agent delivered incrementally so users see text appearing in real time rather than waiting for a complete response. Workflow status updates use polling (not streaming).

### Could Have (P2)

Nice-to-have features that increase polish and demonstration value if time allows.

- [ ] **Audit trail export** -- Export a complete audit trail for any application as a downloadable document including all agent decisions, human review actions, workflow transitions, and source document references.

- [ ] **LLM observability dashboard** -- Integration with an observability tool to provide workflow trace visualization, token usage tracking, cost monitoring, and latency analysis for all LLM calls.

- [ ] **Compliance reporting** -- Generate compliance reports showing decision distribution, approval/denial rates, and fair lending metrics across applications.

- [ ] **Knowledge base management** -- Upload, version, and manage the regulatory documents and guidance used by the compliance checking and intake agents. Updates trigger re-indexing for the knowledge base search.

- [ ] **Configurable risk thresholds with admin interface** -- UI for reviewers to adjust confidence thresholds, risk scoring weights, and escalation rules. All changes audited.

- [ ] **Incremental document resubmission workflow** -- When new documents are uploaded after a reviewer request, the workflow resumes mid-pipeline without re-running completed analyses. Only new or changed documents are processed, and previously completed agent analyses are preserved. This is an optimization over the P0 behavior (which re-runs the full pipeline).

- [ ] **Intake agent cross-session context and sentiment analysis** -- Authenticated intake agent users get cross-session context so the agent can reference prior conversations. Sentiment analysis detects user frustration or confusion and adjusts conversational tone accordingly. Sentiment transitions are logged.

- [ ] **Container-based deployment artifacts** -- Container definitions, orchestration charts, and deployment documentation for deploying to container platforms. Includes health checks, readiness probes, and resource configurations.

- [ ] **CI pipeline configuration** -- Automated testing, linting, type checking, and security scanning in a continuous integration pipeline.

### Won't Have (This Release)

Explicitly excluded from all phases:

- Production regulatory certification -- the system demonstrates patterns, it is not a certified loan origination system
- End-user authentication with registration, password management, or federated identity -- uses API key authentication
- Real credit bureau integration -- mocked with synthetic data throughout
- Payment processing -- application lifecycle ends at approval or denial
- Mobile application -- web only, optimized for desktop and tablet
- Multi-tenancy
- Custom ML model training or fine-tuning -- uses off-the-shelf LLMs via API
- Real-time collaborative editing (UI uses polling for status updates)
- Internationalization -- English only, US mortgage regulations only
- High-availability deployment -- single-instance deployment suitable for demo and development
- Local or on-premise LLM hosting (optional extension, not part of core delivery)

---

## User Flows

### Flow 1: Loan Officer Processes a New Application

**Persona:** Maria (Loan Officer)

1. Maria logs in with her `loan_officer` credentials and sees the loan processing dashboard with her application list.
2. She creates a new loan application, entering the borrower's basic information and loan terms.
3. She uploads the borrower's documents: two recent pay stubs, a W-2, the most recent tax return, bank statements, and a property appraisal.
4. She submits the application, which transitions to "processing" status.
5. The system's multi-agent workflow begins: the supervisor dispatches to document processing, which extracts data from each uploaded document with confidence scores.
6. After document processing, the system fans out to credit analysis, risk assessment, and compliance checking in parallel.
7. The supervisor aggregates results. If all confidence scores are high, the application is auto-approved and Maria is notified.
8. If any confidence score is medium, the application appears in the review queue. Maria opens it and sees all agent analyses side by side -- extracted data, credit summary, risk metrics (DTI, LTV), compliance check results -- each with confidence scores and plain-language reasoning.
9. Maria reviews the flagged items, makes her judgment call, and either approves, denies, or requests additional documents.
10. If she denies, the denial coaching agent provides improvement recommendations she can share with the borrower.
11. If she requests additional documents, the application returns to "awaiting documents" status and the workflow will resume when new documents are uploaded.
12. Every action Maria takes is recorded in the immutable audit trail.

### Flow 2: Compliance Officer Runs an Audit

**Persona:** David (Compliance Officer)

1. David logs in with his `reviewer` credentials and navigates to the compliance section.
2. He searches for a specific application by ID or filters by date range and decision type.
3. He opens the application's audit trail, which displays a chronological sequence of every event: document uploads, each agent's analysis (with confidence score, reasoning, and the specific data points evaluated), human review actions (with reviewer identity and rationale), and all state transitions.
4. He verifies that every denial reason cites specific quantifiable metrics (e.g., "DTI ratio of 52% exceeds maximum threshold of 43%") and that no protected characteristics were referenced.
5. He exports the audit trail as a downloadable document for the regulatory examination file.
6. He reviews aggregate compliance reports showing decision distribution across applications.
7. If he identifies a threshold that needs adjustment, he modifies it through the admin interface, and the change is itself recorded in the audit trail.

### Flow 3: Borrower Explores Mortgage Options via Intake Agent

**Persona:** Jordan (Borrower)

1. Jordan visits the public-facing website without logging in.
2. She opens the chat interface and types: "I'm looking to buy my first home. How much can I afford on a $75,000 salary?"
3. The intake agent responds in plain language, explaining key concepts (DTI, down payment requirements) and asks follow-up questions about her existing debts and savings.
4. The agent uses the mortgage calculator to show her estimated monthly payments at current market rates for different home prices and down payment amounts.
5. Jordan asks about current mortgage rates. The agent provides live rate data with context about recent trends.
6. She asks what documents she would need to prepare. The agent provides a clear checklist.
7. Jordan asks about a specific property. The agent retrieves property data (from the mocked or real property data service) including estimated value and comparable sales.
8. All responses include source citations where applicable (e.g., regulatory guidance references). Financial outputs include legal disclaimers.
9. Jordan feels informed and ready to contact a loan officer to start the process.

### Flow 4: Developer Sets Up the Quickstart

**Persona:** Alex (AI Developer)

1. Alex clones the repository and reads the README, which includes an architecture overview diagram, prerequisites, and quickstart instructions.
2. He runs the setup command and the development startup command. All services start, including the database, cache, object storage, and application servers.
3. Seed data loads automatically, populating the system with diverse test applications in various workflow states.
4. Alex opens the interactive API documentation and explores the available endpoints.
5. He opens the UI and walks through a seeded application's complete workflow, clicking through each agent's analysis to understand the supervisor-worker pattern.
6. He triggers a new application through the API, uploads test documents, and watches the multi-agent workflow execute in the LLM observability dashboard.
7. He reads the inline code comments explaining each agent's implementation pattern, the confidence-based routing logic, and the audit trail recording.
8. He identifies which patterns to adapt for his own domain (e.g., swapping mortgage underwriting agents for insurance claims agents) and begins customizing.

---

## Non-Functional Requirements

All non-functional requirements are framed as user-facing outcomes. Implementation-level targets (cache latency, connection pool sizes, specific throughput numbers) belong in the Architecture document.

### Responsiveness

- Document processing feels prompt -- a single document completes analysis within a brief wait, not a prolonged delay.
- Full application processing (happy path, no human review) completes within a few minutes, not tens of minutes.
- Standard API interactions (viewing application detail, listing applications) feel instantaneous.
- The UI loads quickly on first visit.
- Chat responses from the intake agent begin appearing within a conversational pause, not after a long silence.

### Reliability

- In-progress workflows resume from their last checkpoint after a service restart with no data loss.
- Database changes are reversible and idempotent.
- The system degrades gracefully when optional services (cache, observability) are unavailable -- core workflow continues.
- Health checks accurately reflect whether the system can handle requests.
- Transient failures from external AI services are retried automatically before reporting failure.

### Auditability

- Every agent decision includes a timestamp, confidence score, and plain-language reasoning.
- Every human action includes the reviewer's identity, role, timestamp, decision, and rationale.
- Every workflow state transition is logged with before and after states.
- Once written, audit records cannot be modified or deleted.
- A complete audit trail for any application is producible in under 5 minutes.
- Regulatory citations in compliance checks are traceable to specific document versions.

### Security

- All protected endpoints require authentication -- no access without valid credentials.
- Secrets are never stored in source code.
- PII (SSN, financial account numbers) is protected at rest and never appears in logs.
- Data sent to external AI services has PII redacted.
- All input is validated at system boundaries.
- Dependencies are scanned for known vulnerabilities.
- Public access features have rate limiting to prevent abuse and control costs.

### Developer Experience

- A developer unfamiliar with the project can go from clone to running system in under 30 minutes.
- Documentation includes an architecture diagram, quickstart guide, and troubleshooting section.
- The API has interactive documentation with try-it-out capability.
- Code includes inline comments explaining multi-agent patterns and domain concepts.
- Development seed data includes diverse test cases covering various workflow paths.

### Observability

- All logs are structured with a consistent schema.
- Every log entry includes a correlation ID for tracing requests across services.
- LLM interactions are traceable with workflow visualization, token usage, and cost information.
- Critical errors are logged at appropriate severity levels.

### Scalability

- The system handles multiple simultaneous loan processing workflows without degradation.
- Public-facing features (chat, calculator) handle concurrent users without affecting loan processing performance.

---

## Security Considerations

### Access Tiers

The system operates with two distinct access tiers:

**Public Tier (Unauthenticated)**
- Chat with intake agent, mortgage calculator, current market rates, property lookups
- Protected by session-based rate limiting and cost caps to prevent abuse
- Prompt injection defenses for the conversational interface
- Short-lived sessions

**Protected Tier (Authenticated)**
- All application management, review queue, admin settings, audit export
- Requires bearer token authentication from day one -- not mocked, not deferred
- Token format `Authorization: Bearer <role>:<key>` is retained for developer ergonomics (easy role-switching during development). The role prefix is a routing hint only -- the server maintains the authoritative key-to-role mapping and resolves permissions from the key alone, ignoring the client-supplied role. If the client-supplied role does not match the key's actual role, the server uses the key's role and logs the mismatch.
- Keys have a configurable TTL (default 90 days for protected tier, 24 hours for development seed keys)
- The system refuses to start in production mode with default/seed credentials (hard fail, not just a warning)

### Role Model

Three roles with hierarchical permissions:

| Role | Scope |
|------|-------|
| `loan_officer` | Standard application processing, review of medium-confidence escalations |
| `senior_underwriter` | All loan officer capabilities plus review of low-confidence escalations |
| `reviewer` | All senior underwriter capabilities plus audit trail export, compliance reports, threshold configuration, knowledge base management |

### PII Handling

- SSNs, financial account numbers, and government IDs never appear in logs, error messages, or API responses beyond their intended use
- Sensitive fields are masked in all log output
- Document upload filenames are sanitized before logging (may contain PII)
- Data sent to external LLM APIs has PII redacted before transmission
- All monetary values use precise numeric representations in backend logic (not floating-point)
- Interest rates and financial ratios use precise numeric types

### Data-at-Rest Encryption

- PII fields (SSN, account numbers, government IDs) use application-level encryption before database storage. The encryption key is managed via environment/secrets manager, not hardcoded.
- Object storage configured with server-side encryption (SSE) for all uploaded documents (tax returns, pay stubs, bank statements contain highly sensitive data).
- Redis: if PII transits through cache (e.g., cached intake conversations), TLS in-transit and encrypted persistence are required. If cache is limited to non-PII data (rate limits, session tokens), encryption is optional at MVP.
- Full database-level transparent data encryption (TDE) deferred to production maturity. MVP demonstrates the pattern with field-level encryption for the highest-sensitivity fields.
- Backup encryption requirements deferred to production maturity.

### Agent Conflict Resolution

All agent conflicts (disagreements between agents on an application) escalate to human review. There is no automated tie-breaking. This is a firm stakeholder requirement reflecting the regulated nature of the domain.

---

## Mocked vs. Real Services

### Mocked Services (with Real Interface Contracts)

Each mocked service implements the same interface that its real counterpart would use. The mock is a different implementation, not a different interface, enabling swap-in of real services without code changes beyond configuration.

| Service | What the Mock Provides | Why Mocked |
|---------|----------------------|-----------|
| Credit Bureau API | Realistic credit report data with randomized scores, payment history, derogatory marks, and trend data | Real APIs require expensive contracts and PCI compliance |
| Email Notifications | Logs "email sent" events to console and database with full message content | Avoids SMTP configuration complexity in a quickstart |
| Property Data API (default) | Static fixture data with property valuations, AVM estimates, and comparable sales | Pay-per-lookup pricing; mock has realistic response structure. Real API key can be configured optionally. |
| Employment Verification | Uploaded pay stubs treated as authoritative source of employment and income data | Real verification requires third-party integrations with employer databases |

### Real Services

| Service | Purpose |
|---------|---------|
| LLM APIs (reasoning + vision models) | Document analysis, credit reasoning, compliance checking, intake conversations, denial coaching |
| Database with vector search | All application data, audit trails, and knowledge base embeddings in a single data store |
| Cache | Cached knowledge base queries, session data, external API response caching, rate limiting |
| Object Storage | Secure storage for uploaded loan documents |
| Federal Economic Data API | Live mortgage rates, Treasury yields, and housing price indices |
| LLM Observability Service | Workflow tracing, token usage tracking, cost monitoring |

---

## Phased Roadmap

Phase assignments are based on capability progression and have been validated against technical dependencies. The Architecture phase may propose minor feature-to-phase adjustments to resolve implementation dependencies discovered during system design, subject to stakeholder approval.

### Phase 1: Foundation

**Capability milestone:** The system has a working loan application lifecycle, a functional multi-agent orchestration pattern (with a stub agent that returns mock data) with persistent checkpointing, authentication with role-based access, a basic dashboard UI, foundational audit trail infrastructure recording all events, and seed data for development. Developers can run the system locally with a single setup command and see an application move through workflow states with every action captured in the audit trail.

**Features included:**
- Loan application lifecycle management (P0)
- Role-based access control with three roles (P0)
- Self-contained local development setup (P0)
- API-first design with interactive documentation (P0)
- Loan processing dashboard (P0) -- scaffolding with application list and detail views
- Multi-agent loan analysis workflow (P0) -- orchestration skeleton with a single stub agent, with persistent checkpointing (workflow survives service restarts)
- Complete immutable audit trail (P0) -- foundational event recording mechanism and append-only storage from day one. All state transitions, auth events, and agent decisions are captured. Query UI and export delivered in later phases.

**Key risks:**
- Orchestration pattern complexity may be underestimated -- mitigate by proving the supervisor-worker pattern with stub agents before adding real AI
- Authentication scheme may need iteration -- mitigate by implementing the simplest viable scheme (API key) that can be upgraded later
- Audit trail schema design affects all subsequent phases -- mitigate by designing a flexible event schema that can accommodate future event types without migration

### Phase 2: First Real Agents

**Capability milestone:** The system performs real AI-powered document analysis and credit evaluation. Uploaded documents are automatically classified, data is extracted with confidence scores, and credit analysis produces a meaningful assessment. Confidence-based routing sends applications to human review or auto-processes them based on thresholds. A minimal review queue allows human reviewers to see escalated applications and make approve/deny decisions. PII is redacted before any data is sent to external LLM APIs.

**Features included:**
- Automated document data extraction with confidence scoring (P0)
- Credit analysis with mocked credit bureau (P0)
- Confidence-based routing and escalation (P0)
- Human-in-the-loop review workflow (P0) -- minimal review queue: view escalated applications with agent analyses, approve or deny. Request-additional-documents and cyclic resubmission deferred to Phase 4.
- PII redaction in LLM interactions (P0) -- required from first real LLM calls

**Key risks:**
- Document extraction accuracy may vary significantly by document type -- mitigate by focusing on the most structured document types first (W-2, pay stubs) and measuring accuracy against test documents
- LLM costs may be higher than expected for document vision analysis -- mitigate by implementing cost tracking from this phase
- PII redaction must be comprehensive from day one of LLM usage -- mitigate by defining the PII field list and redaction patterns before implementing agents

### Phase 3a: Full Analysis Pipeline

**Capability milestone:** The complete analysis pipeline is operational: risk assessment, compliance checking with RAG-based regulatory verification, and full workflow aggregation with all core agents. The audit trail now has a query UI for viewing event history. The system demonstrates the full breadth of multi-agent coordination for the loan processing workflow.

**Features included:**
- Financial risk assessment (P0)
- Regulatory compliance verification (P0)
- Complete immutable audit trail (P0) -- audit trail query UI for viewing event history per application (recording infrastructure already in place from Phase 1)

**Key risks:**
- Knowledge base quality directly affects compliance checking accuracy -- mitigate by curating a focused set of regulatory documents with known-correct answers for validation
- Multiple agents running in parallel may produce conflicting results -- mitigate by implementing the conflict escalation rule (all disagreements go to human review)

### Phase 3b: Public Access and Intake

**Capability milestone:** The public-facing intake agent is live with chat interface, mortgage calculator, and external data integrations. Borrowers can explore mortgage options without authentication. Rate limiting and cost caps protect against abuse.

**Features included:**
- Conversational mortgage Q&A with knowledge base (P1)
- Intake agent data integration and calculator tool use (P1)
- Mortgage calculator (P1)
- External data integration -- economic data (P1)
- External data integration -- property data (P1)
- Streaming chat responses (P1)

**Key risks:**
- Public access introduces cost exposure from LLM usage -- mitigate by implementing rate limiting and cost caps before launching public features
- Intake agent prompt injection is a risk for a public-facing LLM in a financial context -- mitigate by sandboxing the intake agent with no access to the application database or authenticated API endpoints

### Phase 4: Advanced Review, Fraud Detection, and Coaching

**Capability milestone:** The human review workflow is fully featured: reviewers can request additional documents, and the workflow resumes with a fresh analysis pass. Fraud detection adds a safety layer with document metadata analysis. Denied applicants receive actionable improvement guidance.

**Features included:**
- Human-in-the-loop review workflow (P0) -- advanced features: request additional documents with cyclic resubmission (full pipeline re-run on new documents)
- Fraud detection with document metadata analysis (P1)
- Denial coaching and improvement recommendations (P1)
- Incremental document resubmission workflow (P2) -- optimization to resume mid-pipeline without re-running completed analyses

**Key risks:**
- Cyclic workflow (request documents, resubmit, re-analyze) adds significant orchestration complexity -- mitigate by testing the cycle thoroughly with seed data before considering it complete
- Fraud detection sensitivity tuning requires domain expertise -- mitigate by defaulting to conservative settings and making sensitivity configurable

### Phase 5: Observability, Deployment, and Polish

**Capability milestone:** The system is fully observable, deployable to container platforms, and documented for developer consumption. Compliance officers can export audit trails and generate reports. The quickstart is ready for external developers to evaluate and customize.

**Features included:**
- Audit trail export (P2)
- LLM observability dashboard (P2)
- Compliance reporting (P2)
- Knowledge base management (P2)
- Configurable risk thresholds with admin interface (P2)
- Container-based deployment artifacts (P2)
- CI pipeline configuration (P2)
- Intake agent cross-session context and sentiment analysis (P2)

**Key risks:**
- Observability integration may require significant instrumentation across all agents -- mitigate by instrumenting one agent as a reference pattern, then applying consistently
- Documentation quality determines quickstart adoption -- mitigate by having a developer unfamiliar with the project validate the setup guide

### Phase 6: Extensions (Post-MVP)

**Capability milestone:** Performance optimization, accessibility improvements, security hardening beyond MVP baseline, and optional integrations with real external services for teams ready to move beyond mocked data.

**Features included:** This phase addresses post-MVP improvements based on feedback from Phases 1-5. Specific features will be prioritized based on developer and stakeholder feedback. Potential areas include: performance optimization for large document sets, accessibility compliance, advanced security hardening, optional real API integrations (property data, credit bureau), and local/on-premise model support.

**Key risks:**
- Scope creep from accumulated "nice to have" items -- mitigate by strict prioritization against quickstart learning objectives

---

## Out of Scope

The following are explicitly excluded from this product:

1. **Production regulatory certification** -- The system demonstrates compliance patterns but is not certified for production mortgage lending.
2. **End-user authentication** -- No user registration, password management, OAuth, or federated identity. Uses API key authentication suitable for a quickstart.
3. **Real credit bureau integration** -- All credit data is synthetic. The mock implements the same interface for future swap-in.
4. **Payment processing** -- Application lifecycle ends at approval or denial. No loan funding, disbursement, or servicing.
5. **Mobile application** -- Web only, optimized for desktop and tablet viewports.
6. **Multi-tenancy** -- Single-tenant deployment. No tenant isolation, per-tenant configuration, or tenant management.
7. **Custom ML model training** -- Uses off-the-shelf LLMs via API. No fine-tuning, no custom model training pipelines.
8. **Real-time collaborative editing** -- UI polls for updates. No live cursor sharing or simultaneous editing.
9. **Internationalization** -- English only. US mortgage regulations only. No localization infrastructure.
10. **High-availability deployment** -- Single-instance deployment suitable for demo and development. No clustering, failover, or multi-region.

---

## Open Questions and Assumptions

### Open Questions

1. **LLM model availability and cost** -- The hybrid LLM strategy (reasoning model for analysis, vision model for documents) assumes both model types are accessible via API. What is the expected monthly LLM cost for development and demo usage? Is there a budget ceiling that would affect feature scope?

2. **Seed data breadth** -- How many distinct test applications should seed data include, and what distribution of outcomes (approved, denied, escalated, fraud-flagged) is desired? This affects testing coverage and demo quality.

3. **Knowledge base content** -- What specific regulatory documents and guidance should be included in the compliance knowledge base for the MVP? Is there a curated set, or should the team compile one?

4. **Property data API key availability** -- The product brief indicates property data is mocked by default with optional real API key. Should the MVP documentation include instructions for obtaining a real API key, or is mock-only sufficient for the quickstart?

5. **Demo deployment target** -- Beyond local development, is there a specific deployment target (e.g., a shared demo environment) for the quickstart? This affects Phase 5 scope.

### Assumptions

1. **LLM API access** -- Development and demo environments have access to LLM APIs (reasoning and vision models) with sufficient rate limits and budget for iterative development and testing.

2. **Document types are English-language US mortgage documents** -- Pay stubs, W-2s, tax returns (1040), bank statements, and property appraisals in standard US formats. Non-standard or international document formats are not supported.

3. **Mocked services are sufficient for the quickstart's purpose** -- Developers understand that mocked credit data, employment verification, and (optionally) property data are synthetic. The value is in the patterns, not the data.

4. **MVP auth is API-key-based** -- The API key scheme is adequate for the quickstart. Production users would replace it with federated identity. The auth layer is designed to be swappable.

5. **Single-developer local setup** -- The quickstart targets a single developer running all services on their local machine. It does not need to support team-based shared development environments.

6. **Fair lending compliance patterns are demonstrative** -- The compliance checking demonstrates the pattern (check against knowledge base, cite specific reasons, trace to regulations) but is not validated by legal counsel as legally sufficient.

---

## Stakeholder-Mandated Constraints

The following technology, platform, and integration requirements are explicitly stated by the stakeholder. They are recorded here for the Architect and are NOT product decisions made by this plan.

| Constraint | Detail | Source |
|-----------|--------|--------|
| Red Hat deployment platform | OpenShift for deployment, Podman for containers, Helm for orchestration | Product brief, Section 5 |
| Existing template | Must build on the Red Hat AI Quickstart template (Turborepo monorepo with React 19, FastAPI, PostgreSQL, Helm charts) | Product brief, Section 5 |
| Agent orchestration framework | LangGraph with persistent checkpointing (PostgresSaver) | Product brief, Section 5 |
| Hybrid LLM strategy | Claude for reasoning, GPT-4 Vision for document analysis, optional LlamaStack for local/data-residency | Product brief, Section 5 |
| Database + vector search | PostgreSQL with pgvector for both application data and RAG embeddings (single database, no separate vector DB) | Product brief, Section 5 |
| LLM observability | LangFuse for tracing, cost tracking | Product brief, Section 5 |
| Economic data source | FRED API (Federal Reserve Economic Data) -- DGS10, CSUSHPISA series | Product brief, Section 4 |
| Property data source | BatchData API -- mocked by default, real API key optional | Product brief, Section 4 |
| Caching layer | Redis for cached queries, session data, API response caching, rate limiting | Product brief, Section 5 |
| Object storage | MinIO (S3-compatible) for document uploads | Product brief, Section 5 |
| Frontend stack | React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS, shadcn/ui | Product brief, Section 5 |
| Backend framework | FastAPI (async) | Product brief, Section 5 |
| ORM and migrations | SQLAlchemy 2.0 async, Alembic | Product brief, Section 5 |
| Testing frameworks | Vitest (UI), Pytest (API/DB) | Product brief, Section 5 |
| Package managers | pnpm (Node), uv (Python) | Product brief, Section 5 |
| Build system | Turborepo | Product brief, Section 5 |
| Self-contained quickstart | `make setup && make dev` must produce a working system | Product brief, Section 5 |
| Streaming chat transport | Server-Sent Events (SSE) for incremental chat responses; polling for workflow status | Stakeholder triage of API Designer C-2 |
| Authentication format | `Authorization: Bearer <role>:<key>` format | Product brief, Section 7 |

---

## Completion Criteria

The MVP is complete when all of the following are true:

1. **Core workflow functional** -- A loan application can be created, documents uploaded, processed through the full multi-agent analysis pipeline (document processing, credit analysis, risk assessment, compliance checking), routed based on confidence scores, reviewed by a human, and approved or denied -- with complete audit trail at every step.

2. **Fraud detection and denial coaching operational** -- Fraud detection flags suspicious applications for human review. Denied applications receive actionable improvement recommendations.

3. **Public access functional** -- An unauthenticated user can chat with the intake agent, use the mortgage calculator, and view current market rates without logging in. Rate limiting prevents abuse.

4. **Three roles enforced** -- `loan_officer`, `senior_underwriter`, and `reviewer` have distinct permission scopes, and access control is enforced on all protected endpoints.

5. **Audit trail complete** -- Every agent decision, human action, and workflow transition is recorded immutably. A compliance officer can produce a complete audit trail for any application in under 5 minutes.

6. **Developer quickstart works** -- A developer unfamiliar with the project can clone the repo, run the setup command, and have a fully functional system with seed data in under 30 minutes.

7. **Test coverage meets target** -- Backend test coverage is 70%+ with happy-path and critical-edge tests.

8. **Documentation sufficient** -- README with architecture overview, quickstart guide, troubleshooting, and API documentation accessible via interactive docs UI.

9. **Deployment artifacts present** -- Container definitions and orchestration charts are provided and tested.

10. **All P0 features verified** -- Every Must Have (P0) feature has been implemented and verified with automated tests or documented manual verification.
