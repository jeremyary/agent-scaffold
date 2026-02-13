<!-- This project was developed with assistance from AI tools. -->

# Requirements Chunk 4: Extensions, Administration & Polish

## Overview

This chunk expands the Pass 1 skeletons for agent pipeline extensions (fraud detection, denial coaching, incremental resubmission), advanced human review (document request/resubmission cycle), administration features (thresholds, knowledge base, compliance reporting), audit trail export, observability, deployment, and public tier P2 extensions. These stories build on the foundation (Chunk 1), core workflow (Chunk 2), and public tier (Chunk 3).

---

## Agent Pipeline Extensions

### PIPE-11: Fraud Detection

**As a** system, **I want** to detect fraud indicators (income discrepancies, property flip patterns, identity inconsistencies, suspicious document metadata), **so that** applications with fraud flags are escalated to human review.

**Priority:** P1 | **Phase:** 4

#### Acceptance Criteria

**AC-1: Income discrepancy detection**
- **Given** an application with extracted income data from multiple document sources (pay stubs, W-2, tax return)
- **When** the fraud detector agent analyzes the extracted data
- **Then** the agent flags an income discrepancy if the reported income varies by more than a configurable percentage across sources, and the fraud flag includes the specific values and sources compared

**AC-2: Property flip pattern detection**
- **Given** an application with property data (address, purchase history)
- **When** the fraud detector agent analyzes the property information
- **Then** the agent flags a property flip pattern if the property has changed ownership within a short time frame at significantly different prices, and the flag includes the transaction history and price variance

**AC-3: Identity inconsistency detection**
- **Given** an application with borrower identity information extracted from multiple documents
- **When** the fraud detector agent cross-references identity fields (name, address, employer) across documents
- **Then** the agent flags inconsistencies where identity fields do not match across documents, and the flag includes which fields diverged and on which documents

**AC-4: Suspicious document metadata detection**
- **Given** uploaded documents with accessible metadata (creation dates, producer fields, modification history)
- **When** the fraud detector agent examines document metadata
- **Then** the agent flags suspicious metadata patterns (e.g., creation date after the purported document date, unexpected PDF producer software, evidence of modification), and the flag includes the specific metadata anomalies found

**AC-5: Fraud flag forces human review**
- **Given** an application where the fraud detector agent has produced one or more fraud flags
- **When** the aggregator/router processes the routing decision
- **Then** the application is routed to human review regardless of other agents' confidence scores, the routing decision records `fraud_flag` as the routing reason, and the application is visible only to `senior_underwriter` and `reviewer` roles in the review queue

**AC-6: Configurable sensitivity**
- **Given** a fraud detection sensitivity configuration stored in the database
- **When** the fraud detector agent executes
- **Then** the agent loads the current sensitivity settings at invocation time, applies them to its analysis thresholds, and changes to sensitivity settings take effect on the next workflow invocation without service restart

**AC-7: Fraud detection audit trail**
- **Given** the fraud detector agent has completed its analysis
- **When** the agent records its results
- **Then** an audit event is recorded with event_type `agent_decision`, agent_name `fraud_detector`, confidence score, reasoning (including which indicators were checked and which triggered), and input data hash
- **And** if fraud flags are present, each flag is persisted to the `fraud_flags` table with the application ID, flag type, description, and supporting evidence

**AC-8: No fraud indicators found**
- **Given** an application with no detectable fraud indicators
- **When** the fraud detector agent completes its analysis
- **Then** the agent returns a clean result with a confidence score, an empty fraud flags list, and the application continues through normal routing logic without forced escalation

**AC-9: Fraud detector failure (optional agent)**
- **Given** the fraud detector agent encounters an error (e.g., LLM API failure after retries)
- **When** the workflow cannot obtain a fraud detection result
- **Then** the workflow continues with remaining agents, the error is noted in the audit trail, and the aggregator treats the missing fraud result as "inconclusive" (does not block the workflow, but is noted in the review context if the application is escalated)

#### Notes
- Fraud detection runs in parallel with credit analysis, risk assessment, and compliance checking (see PIPE-10).
- Cross-references: AUTH-05 for role-based visibility of fraud-flagged applications in the review queue (senior_underwriter and above only). AUDIT-01/AUDIT-02 for audit event recording. PIPE-06 for routing rules (fraud flag overrides all other routing).
- The specific fraud indicator thresholds (e.g., what percentage of income discrepancy triggers a flag) are Technical Design details, not requirements. The requirement is that they are configurable.

---

### PIPE-12: Denial Coaching

**As a** system, **I want** to provide denial coaching with actionable improvement recommendations when an application is denied, **so that** borrowers receive helpful guidance on how to improve their qualification.

**Priority:** P1 | **Phase:** 4

#### Acceptance Criteria

**AC-1: DTI improvement recommendations**
- **Given** an application that has been denied with DTI ratio as a contributing factor
- **When** the denial coach agent generates recommendations
- **Then** the recommendations include specific DTI improvement strategies (e.g., "Reducing monthly debts by $X would bring DTI from Y% to Z%"), with concrete dollar amounts derived from the application's actual financial data

**AC-2: Down payment and LTV scenarios**
- **Given** an application that has been denied with LTV ratio as a contributing factor
- **When** the denial coach agent generates recommendations
- **Then** the recommendations include what-if scenarios showing how different down payment amounts would affect LTV ratio and qualification likelihood (e.g., "Increasing down payment from $X to $Y would reduce LTV from A% to B%")

**AC-3: Credit score guidance**
- **Given** an application that has been denied with credit score as a contributing factor
- **When** the denial coach agent generates recommendations
- **Then** the recommendations include actionable credit improvement guidance (e.g., reducing utilization, addressing derogatory marks, timeline estimates for score improvement), framed in plain language suitable for sharing with the borrower

**AC-4: What-if calculations**
- **Given** a denied application with financial data available
- **When** the denial coach agent generates recommendations
- **Then** the recommendations include at least one what-if scenario showing how changing a specific variable (income, debts, down payment, credit score) would affect the application outcome, with the specific threshold values that would change the result

**AC-5: Denial coaching triggered only on denial**
- **Given** an application that has been approved (auto-approved or approved after human review)
- **When** the workflow reaches a terminal approved state
- **Then** the denial coach agent is NOT invoked

- **Given** an application that has been denied (auto-denied or denied after human review)
- **When** the workflow reaches a terminal denied state
- **Then** the denial coach agent IS invoked and its recommendations are attached to the application record

**AC-6: Plain-language output**
- **Given** the denial coach agent has generated recommendations
- **When** the recommendations are persisted
- **Then** the recommendations are written in plain language suitable for a borrower with limited financial literacy, avoiding jargon or explaining it when used, and the text can be shared directly with the borrower by the loan officer

**AC-7: Denial coaching audit trail**
- **Given** the denial coach agent has completed its analysis
- **When** the agent records its results
- **Then** an audit event is recorded with event_type `agent_decision`, agent_name `denial_coach`, confidence score, reasoning, and input data hash
- **And** the denial coaching result is persisted to `agent_decisions` with the application ID and analysis pass

**AC-8: Denial coaching failure**
- **Given** the denial coach agent encounters an error (e.g., LLM API failure after retries)
- **When** the workflow cannot produce denial coaching
- **Then** the denial itself is not blocked (the application remains denied), the error is noted in the audit trail, and the application record indicates that denial coaching is unavailable

#### Notes
- Cross-references: REV-04 for deny action triggering denial coaching. PIPE-04 for risk metrics (DTI, LTV) used in recommendations. PIPE-03 for credit data used in guidance.
- Denial coaching runs after the deny decision, not in the main analysis pipeline. It does not affect the approval/denial outcome.
- The denial coach receives denial reasons from other agents (credit analyst, risk assessor, compliance checker) to generate targeted recommendations.

---

### PIPE-13: Incremental Document Resubmission Optimization

**As a** system, **I should** resume a workflow mid-pipeline when additional documents are submitted after a reviewer request, **so that** previously completed analyses are not re-executed unnecessarily.

**Priority:** P2 | **Phase:** 4

#### Acceptance Criteria

**AC-1: Resume from last completed agent**
- **Given** an application in `awaiting_documents` status where credit analysis, risk assessment, and compliance checking completed successfully on the previous pass
- **When** new documents are uploaded and the workflow is re-invoked
- **Then** only the document processing agent runs on the new/changed documents, and previously completed agent analyses (credit, risk, compliance) are preserved from the prior pass unless the new document data materially changes inputs to those agents

**AC-2: Selective re-execution when inputs change**
- **Given** an application where new document extraction produces income or debt values that differ from the previous pass
- **When** the incremental resubmission logic evaluates which agents need re-execution
- **Then** agents whose input data has changed (e.g., risk assessor if income changed) are re-executed, while agents whose inputs are unchanged are skipped, and the decision about which agents to re-run is recorded in the audit trail

**AC-3: Analysis pass still incremented**
- **Given** an application undergoing incremental resubmission
- **When** the workflow is re-invoked
- **Then** the `analysis_pass` counter is still incremented, and new agent decisions are recorded under the new pass number, preserving the full history of all passes

**AC-4: Fallback to full re-run**
- **Given** an application where the incremental resubmission logic cannot determine which agents need re-execution (e.g., corrupted checkpoint, ambiguous input changes)
- **When** the workflow attempts incremental processing
- **Then** the system falls back to a full pipeline re-run (P0 behavior) and records the fallback reason in the audit trail

**AC-5: Audit trail for skipped agents**
- **Given** an application where some agents are skipped during incremental resubmission
- **When** the workflow completes
- **Then** the audit trail includes an event for each skipped agent noting that it was skipped due to unchanged inputs, referencing the prior pass's result

#### Notes
- This is an optimization over the P0 behavior defined in REV-06 (full pipeline re-run). The P0 behavior must be fully functional before this optimization is implemented.
- Cross-references: REV-05/REV-06 for the document request/resubmission workflow. PIPE-07/CHECKPOINT-01 for checkpoint state management.
- The mechanism for manipulating LangGraph state to skip completed agents is a Technical Design detail.

---

## Human Review Advanced

### REV-05: Request Additional Documents

**As a** reviewer, **I want** to request additional documents from the borrower with specific instructions, **so that** I can get missing information before making a decision.

**Priority:** P0 | **Phase:** 4

#### Acceptance Criteria

**AC-1: Request documents action**
- **Given** a reviewer viewing an escalated application in `awaiting_review` status
- **When** the reviewer submits a "request documents" action with a rationale and a list of specific documents requested (e.g., "most recent bank statement", "letter of explanation for employment gap")
- **Then** the application transitions to `awaiting_documents` status, a review action record is created with decision `request_documents` and the rationale, and an audit event is recorded with event_type `human_review` including the reviewer identity, role, and requested document list

**AC-2: Role authorization for document request**
- **Given** a user with `loan_officer` role attempting to request documents on a medium-confidence escalation
- **When** the request is submitted
- **Then** the request succeeds because `loan_officer` can act on medium-confidence escalations

- **Given** a user with `loan_officer` role attempting to request documents on a low-confidence or fraud-flagged escalation
- **When** the request is submitted
- **Then** the request is rejected with 403 because only `senior_underwriter` and above can act on those escalations

**AC-3: Rationale required**
- **Given** a reviewer attempting to request additional documents
- **When** the request is submitted without a rationale or with an empty rationale
- **Then** the request is rejected with 422 validation error indicating that rationale is required

**AC-4: Application already in terminal state**
- **Given** an application that has already been approved, denied, or withdrawn
- **When** a reviewer attempts to request additional documents
- **Then** the request is rejected with 409 conflict indicating the application is in a terminal state

**AC-5: Requested document list persisted**
- **Given** a successful document request action
- **When** the application detail is subsequently viewed
- **Then** the requested document list and reviewer instructions are visible in the application context, so the loan officer (or borrower via the loan officer) knows exactly what to provide

#### Notes
- Cross-references: AUTH-05 for role-based access control. AUDIT-02 for human review audit events. APP-05 for status transitions. REV-06 for the subsequent resubmission and re-processing.
- The document request instructions are free-text, not a structured enum of document types.

---

### REV-06: Document Resubmission and Re-Processing

**As a** loan officer, **I want** applications for which I requested additional documents to return to `awaiting_documents` status and re-run the full analysis pipeline when new documents are uploaded, **so that** I get fresh analyses with the updated information.

**Priority:** P0 | **Phase:** 4

#### Acceptance Criteria

**AC-1: New document upload on awaiting_documents application**
- **Given** an application in `awaiting_documents` status
- **When** the loan officer uploads one or more new documents to the application
- **Then** the documents are validated (file type, size), stored in MinIO, and recorded in the documents table with `processing_status: pending`
- **And** the document upload is recorded as an audit event

**AC-2: Trigger full pipeline re-run**
- **Given** an application in `awaiting_documents` status with newly uploaded documents
- **When** the loan officer submits the application for re-processing (explicit action, not automatic on upload)
- **Then** the application transitions from `awaiting_documents` to `processing` status, the `analysis_pass` counter is incremented, and the full agent pipeline is re-invoked starting from document processing
- **And** audit events are recorded for the status transition and pipeline re-invocation

**AC-3: Analysis pass tracking**
- **Given** a re-processing workflow invocation
- **When** each agent produces new results
- **Then** the new agent decisions are recorded under the incremented `analysis_pass` number, previous pass results are preserved (not overwritten), and the application detail view shows results from all passes with the latest pass highlighted

**AC-4: Re-processing follows normal routing**
- **Given** a re-processing workflow completes
- **When** the aggregator/router evaluates the new results
- **Then** normal routing rules apply (auto-approve if high confidence, escalate if medium/low/fraud/conflict), and the application may return to `awaiting_review` if the new results still trigger escalation

**AC-5: Multiple resubmission cycles**
- **Given** an application that has already been through one request-resubmit-reprocess cycle
- **When** the reviewer requests additional documents again after reviewing the second pass
- **Then** the cycle repeats: status transitions to `awaiting_documents`, new documents can be uploaded, re-processing increments `analysis_pass` again, and the full history of all passes is preserved

**AC-6: Cannot resubmit on application in wrong status**
- **Given** an application that is NOT in `awaiting_documents` status (e.g., draft, processing, approved)
- **When** a user attempts to trigger re-processing
- **Then** the request is rejected with 409 conflict indicating the application is not in the correct status for resubmission

#### Notes
- Cross-references: REV-05 for the document request that precedes resubmission. DOC-05 for the document upload during resubmission. PIPE-07/CHECKPOINT-01 for checkpoint behavior on re-runs. PIPE-13 (P2) for the optimization that skips unchanged analyses.
- At P0, resubmission triggers a full pipeline re-run. PIPE-13 (P2) optimizes this to resume mid-pipeline.

---

### REV-07: Review Priority Score

**As a** system, **I should** provide a review priority score for applications in the review queue based on urgency factors, **so that** reviewers can prioritize their work.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Priority score calculation**
- **Given** an application in `awaiting_review` status
- **When** the review queue is queried
- **Then** each application includes a computed priority score based on urgency factors including: time in queue, presence of fraud flags, severity of agent conflicts, and confidence level of the escalation

**AC-2: Priority score ordering**
- **Given** a review queue with multiple applications
- **When** a reviewer views the queue
- **Then** applications can be sorted by priority score (highest priority first), and the default sort order is by priority score descending

**AC-3: Fraud flags increase priority**
- **Given** two applications in `awaiting_review` status, one with fraud flags and one without
- **When** the priority scores are compared
- **Then** the fraud-flagged application has a higher priority score than the non-fraud-flagged application, all else being equal

**AC-4: Time in queue increases priority**
- **Given** two applications in `awaiting_review` status with similar escalation reasons
- **When** the priority scores are compared
- **Then** the application that has been in the queue longer has a higher priority score

#### Notes
- Cross-references: REV-01 for review queue display. PIPE-11 for fraud flags as a priority factor.
- The specific priority score formula (weights for each factor) is a Technical Design detail.

---

### DOC-05: Document Resubmission Upload

**As a** loan officer, **I want** to resubmit additional documents after a reviewer requests them, **so that** the application can resume processing.

**Priority:** P0 | **Phase:** 4

#### Acceptance Criteria

**AC-1: Upload documents to awaiting_documents application**
- **Given** an application in `awaiting_documents` status
- **When** the loan officer uploads new documents via the same document upload endpoint
- **Then** the documents are validated (file type allowlist, size limit <20MB, filename sanitization), stored in MinIO with SSE encryption and UUID key, and recorded in the documents table linked to the application with `processing_status: pending`

**AC-2: Upload rejected on wrong application status**
- **Given** an application that is NOT in `draft` or `awaiting_documents` status
- **When** the loan officer attempts to upload documents
- **Then** the upload is rejected with 409 conflict indicating that documents can only be uploaded to applications in `draft` or `awaiting_documents` status

**AC-3: Upload recorded in audit trail**
- **Given** a successful document upload to an application in `awaiting_documents` status
- **When** the upload completes
- **Then** an audit event is recorded with event_type `document_upload`, the application ID, the document ID, and the uploader identity

**AC-4: Multiple documents in single resubmission**
- **Given** an application in `awaiting_documents` status where the reviewer requested multiple documents
- **When** the loan officer uploads multiple documents
- **Then** all documents are individually validated, stored, and recorded, and all are available for processing when the pipeline is re-invoked

#### Notes
- Cross-references: DOC-01/DOC-02 for the original document upload and validation behavior (same validation rules apply). REV-05 for the document request that precedes this upload. REV-06 for the re-processing trigger after upload.
- Document upload to an `awaiting_documents` application uses the same endpoint and validation as initial document upload. The key difference is the application status gate.

---

## Administration -- Threshold Configuration

### THRESHOLD-01: Adjust Confidence Thresholds

**As a** reviewer, **I want** to adjust confidence thresholds for auto-approval and escalation, **so that** I can tune the system's routing behavior.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: View current thresholds**
- **Given** an authenticated user with `reviewer` role
- **When** the user requests the current threshold configuration
- **Then** the system returns all active thresholds including: auto-approve minimum (default >= 0.85), escalation threshold (default < 0.60 for low-confidence), and any other configurable routing thresholds, with their current values, last updated timestamp, and who last updated them

**AC-2: Update a threshold value**
- **Given** an authenticated user with `reviewer` role
- **When** the user submits a threshold update with a new value
- **Then** the threshold is updated in the database, the change takes effect on the next workflow invocation (not retroactively on in-progress workflows), and the old value is preserved in the audit trail

**AC-3: Safety floor enforcement**
- **Given** a reviewer attempting to set the auto-approve minimum threshold below a safety floor (e.g., below 0.70)
- **When** the update is submitted
- **Then** the update is rejected with 422 validation error indicating the minimum allowed value, preventing overly permissive auto-approval

**AC-4: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to view or modify thresholds
- **Then** the request is rejected with 403 forbidden

**AC-5: Immediate effect on next workflow**
- **Given** a threshold has been updated
- **When** the next loan application workflow reaches the aggregation/routing step
- **Then** the updated threshold values are loaded from the database and applied to the routing decision

#### Notes
- Cross-references: AUTH-05 for role enforcement (reviewer only). THRESHOLD-03 for audit trail of changes. PIPE-06 for routing logic that consumes thresholds.
- Default thresholds: >= 0.85 auto-approve, 0.60-0.85 medium-confidence escalation, < 0.60 low-confidence escalation. These defaults are configurable starting values, not hardcoded.

---

### THRESHOLD-02: Configure Risk Scoring Weights

**As a** reviewer, **I want** to configure risk scoring weights (DTI, LTV, credit score), **so that** I can align the risk model with policy.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: View current risk weights**
- **Given** an authenticated user with `reviewer` role
- **When** the user requests the current risk scoring configuration
- **Then** the system returns the current weights for each risk factor (DTI weight, LTV weight, credit score weight), their current values, and the last modification details

**AC-2: Update risk weights**
- **Given** an authenticated user with `reviewer` role
- **When** the user submits updated risk scoring weights
- **Then** the weights are validated (must sum to 1.0 or 100%, each weight must be positive), stored in the database, and take effect on the next workflow invocation

**AC-3: Invalid weight configuration rejected**
- **Given** a reviewer submitting risk weights that do not sum to 1.0 (or 100%) or include negative values
- **When** the update is submitted
- **Then** the update is rejected with 422 validation error indicating the constraint violation

**AC-4: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to view or modify risk weights
- **Then** the request is rejected with 403 forbidden

#### Notes
- Cross-references: AUTH-05 for role enforcement. THRESHOLD-03 for audit trail. PIPE-04 for risk assessment that consumes these weights.
- The specific risk factors and their weight boundaries are Technical Design details.

---

### THRESHOLD-03: Audit Trail for Threshold Changes

**As a** system, **I must** record all threshold changes as audit events with the reviewer identity, old value, new value, and timestamp, **so that** configuration changes are traceable.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Threshold change audit event**
- **Given** a reviewer has successfully updated a confidence threshold or risk scoring weight
- **When** the update is persisted
- **Then** an audit event is recorded with event_type `threshold_change`, actor_id set to the reviewer's API key ID, actor_role `reviewer`, and metadata containing: threshold_type, old_value, new_value, and timestamp

**AC-2: Audit event includes full context**
- **Given** a threshold change audit event
- **When** the audit trail is queried
- **Then** the event includes enough information to reconstruct what changed: the specific threshold or weight that was modified, its previous value, its new value, and the reviewer who made the change

**AC-3: Multiple changes in single request**
- **Given** a reviewer updates multiple risk scoring weights in a single request
- **When** the changes are persisted
- **Then** each individual weight change is recorded as a separate audit event (or a single event with all changes in the metadata), providing full traceability for each modification

#### Notes
- Cross-references: AUDIT-01 for general audit event recording infrastructure. THRESHOLD-01/THRESHOLD-02 for the configuration changes being audited.
- Threshold change audit events follow the same immutability guarantees as all audit events (INSERT-only, trigger guard, hash chain).

---

## Administration -- Knowledge Base Management

### KB-01: Upload Regulatory Documents

**As a** reviewer, **I want** to upload regulatory documents and guidance to the knowledge base, **so that** the compliance checking and intake agents can reference them.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Upload a document to the knowledge base**
- **Given** an authenticated user with `reviewer` role
- **When** the user uploads a regulatory document (e.g., PDF, text) with a title and document type (regulation, guidance, policy)
- **Then** the document is stored, a knowledge document record is created in the `rag.knowledge_documents` table with version 1 and `is_active: true`, and the document content is chunked and embedded into the `rag.knowledge_embeddings` table

**AC-2: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to upload a knowledge base document
- **Then** the request is rejected with 403 forbidden

**AC-3: Duplicate detection**
- **Given** a document with the same content hash as an existing active document
- **When** the user attempts to upload it
- **Then** the system warns the user about the duplicate (409 conflict with the existing document reference), rather than silently creating a duplicate entry

**AC-4: Upload audit trail**
- **Given** a successful knowledge base document upload
- **When** the upload completes
- **Then** an audit event is recorded with event_type `knowledge_base_change`, action `upload`, the document ID, document title, and uploader identity

**AC-5: Initial knowledge base content**
- **Given** a freshly seeded development environment
- **When** the system starts
- **Then** the knowledge base includes sample regulatory excerpts for ECOA (Equal Credit Opportunity Act), Fair Housing Act, TILA (Truth in Lending Act), and RESPA (Real Estate Settlement Procedures Act) -- demonstrative content, not legally validated

#### Notes
- Cross-references: AUTH-05 for role enforcement. KB-03 for re-indexing triggered by uploads. PIPE-05 for compliance checker that consumes the knowledge base. CHAT-01/CHAT-03 for intake agent that references the knowledge base.
- The sample regulatory content is for demonstration purposes. It shows the RAG pattern with realistic document structure but is not legally authoritative.

---

### KB-02: Version Knowledge Base Documents

**As a** reviewer, **I want** to version knowledge base documents and see which version is currently active, **so that** I can track changes.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Upload new version of existing document**
- **Given** a knowledge base document that already exists
- **When** the reviewer uploads a new version of the document (referencing the existing document by ID)
- **Then** the previous version is marked as inactive (`is_active: false`), the new version is created with an incremented version number and `is_active: true`, and the new version's content is chunked and embedded

**AC-2: View version history**
- **Given** a knowledge base document with multiple versions
- **When** the reviewer queries the document's version history
- **Then** the system returns all versions with their version numbers, upload dates, uploaders, and active status, ordered by version number descending

**AC-3: Only one active version at a time**
- **Given** a knowledge base document with version history
- **When** any version operation is performed
- **Then** at most one version of each document is marked as `is_active: true`

**AC-4: Version change audit trail**
- **Given** a new document version is uploaded
- **When** the upload completes
- **Then** an audit event is recorded with event_type `knowledge_base_change`, action `version_update`, the document ID, old version number, new version number, and uploader identity

#### Notes
- Cross-references: KB-01 for initial upload. KB-03 for re-indexing triggered by version changes.
- Rollback to a previous version is not required at P2. If needed, the reviewer can re-upload the old version's content as a new version.

---

### KB-03: Re-Index Knowledge Base Embeddings

**As a** system, **I must** re-index the knowledge base embeddings when new documents are uploaded or versions change, **so that** RAG searches return current information.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Re-indexing triggered on upload**
- **Given** a new document is uploaded to the knowledge base (KB-01)
- **When** the upload is processed
- **Then** the document content is chunked and embedded into `rag.knowledge_embeddings`, and the new embeddings are available for RAG similarity search immediately after indexing completes

**AC-2: Re-indexing triggered on version change**
- **Given** a new version of an existing document is uploaded (KB-02)
- **When** the version change is processed
- **Then** the old version's embeddings are removed from `rag.knowledge_embeddings`, the new version's content is chunked and embedded, and RAG searches reflect the updated content

**AC-3: Re-indexing does not disrupt active searches**
- **Given** a RAG similarity search is in progress
- **When** a re-indexing operation starts concurrently
- **Then** the in-progress search completes against the old embeddings (or the new ones if indexing finishes first), and there is no error or inconsistent state visible to the caller

**AC-4: Re-indexing failure handling**
- **Given** a re-indexing operation fails (e.g., embedding API error)
- **When** the failure occurs
- **Then** the old embeddings remain intact (the re-indexing is transactional or the old data is not removed until new data is confirmed), the failure is logged, and the system retries the re-indexing or flags it for manual intervention

**AC-5: Re-indexing audit trail**
- **Given** a re-indexing operation completes
- **When** the operation finishes
- **Then** an audit event is recorded with event_type `knowledge_base_change`, action `reindex`, the document ID, embedding count, and success/failure status

#### Notes
- Cross-references: KB-01/KB-02 for upload and version changes that trigger re-indexing. PIPE-05 for compliance checking RAG queries. CHAT-03 for intake agent knowledge base search.
- The chunking strategy (chunk size, overlap) and embedding model are Technical Design details.

---

## Administration -- Compliance Reporting

### COMPLIANCE-01: Adverse Action Notices

**As a** system, **I must** generate adverse action notices for denied applications with specific quantifiable reasons and regulatory citations, **so that** fair lending requirements are met.

**Priority:** P0 | **Phase:** 3a

#### Acceptance Criteria

**AC-1: Specific quantifiable denial reasons**
- **Given** an application that has been denied
- **When** the adverse action notice is generated
- **Then** each denial reason includes specific quantifiable metrics (e.g., "DTI ratio of 52% exceeds maximum threshold of 43%", "Credit score of 580 is below minimum threshold of 620"), not vague descriptions like "insufficient credit" or "high debt"

**AC-2: Regulatory citations included**
- **Given** an adverse action notice
- **When** the notice is generated
- **Then** each denial reason includes a regulatory citation referencing the applicable regulation or guidance (e.g., "Per ECOA Section 1002.9, the following factors adversely affected the decision..."), traceable to specific knowledge base document versions

**AC-3: No protected characteristics referenced**
- **Given** an adverse action notice
- **When** the notice content is evaluated
- **Then** the notice contains no reference to protected characteristics (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) as denial factors

**AC-4: Notice attached to denied application**
- **Given** a denied application
- **When** the application detail is viewed by a loan officer or reviewer
- **Then** the adverse action notice is accessible as part of the application record, with all denial reasons, quantifiable metrics, and regulatory citations visible

**AC-5: Notice generated for all denial paths**
- **Given** an application denied through any path (auto-denial by routing logic, or denial by human reviewer)
- **When** the denial is recorded
- **Then** an adverse action notice is generated with reasons and citations, regardless of the denial path

**AC-6: Audit trail for notice generation**
- **Given** an adverse action notice is generated
- **When** the generation completes
- **Then** an audit event is recorded with the notice content, the denial reasons, and the regulatory citations

#### Notes
- Cross-references: PIPE-05 for compliance checking that produces the regulatory citations. PIPE-04 for risk metrics used in quantifiable reasons. PIPE-03 for credit data used in reasons. REV-04 for human deny action.
- The adverse action notice pattern demonstrates compliance-first design. The content is demonstrative, not legally validated.

---

### COMPLIANCE-02: Compliance Reports

**As a** compliance officer, **I want** to generate compliance reports showing decision distribution, approval/denial rates, and fair lending metrics across applications, **so that** I can identify patterns.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Decision distribution report**
- **Given** an authenticated user with `reviewer` role
- **When** the user requests a compliance report for a date range
- **Then** the report includes: total applications processed, count and percentage by outcome (approved, denied, withdrawn), count and percentage by routing path (auto-approved, escalated, fraud-flagged), and average processing time

**AC-2: Fair lending metrics**
- **Given** a compliance report request
- **When** the report is generated
- **Then** the report includes fair lending metrics: distribution of denial reasons across applications, frequency of each denial factor (DTI, LTV, credit score, etc.), and confirmation that all denial reasons reference only permitted factors

**AC-3: Date range filtering**
- **Given** a compliance report request with start and end dates
- **When** the report is generated
- **Then** only applications within the specified date range are included

**AC-4: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to generate a compliance report
- **Then** the request is rejected with 403 forbidden

**AC-5: Report audit trail**
- **Given** a compliance report is generated
- **When** the generation completes
- **Then** an audit event is recorded with event_type `compliance_report_generated`, the date range, the requester identity, and a summary of the report scope

#### Notes
- Cross-references: AUTH-05 for role enforcement. AUDIT-01/AUDIT-02 for the underlying audit data that feeds reports. COMPLIANCE-01 for adverse action notices that contribute to fair lending metrics.

---

### COMPLIANCE-03: Verify Permitted Denial Factors

**As a** compliance officer, **I want** to verify that every denial reason references only permitted factors (no protected characteristics), **so that** I can prove non-discrimination.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Scan denial reasons for protected characteristics**
- **Given** an authenticated user with `reviewer` role requesting a compliance verification
- **When** the verification is run against a set of denied applications (by date range or all)
- **Then** the system scans all adverse action notices and denial reasons for references to protected characteristics (race, color, religion, national origin, sex, marital status, age, receipt of public assistance) and reports any findings

**AC-2: Clean verification result**
- **Given** a compliance verification scan finds no references to protected characteristics
- **When** the results are returned
- **Then** the report confirms that all denial reasons reference only permitted financial and creditworthiness factors, with a count of applications verified

**AC-3: Violation detected**
- **Given** a compliance verification scan finds a reference to a protected characteristic in a denial reason
- **When** the results are returned
- **Then** the report flags the specific application(s), the specific denial reason(s), and the protected characteristic found, with severity flagging

**AC-4: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to run a compliance verification
- **Then** the request is rejected with 403 forbidden

#### Notes
- Cross-references: COMPLIANCE-01 for adverse action notices being verified. AUTH-05 for role enforcement.
- This verification is a demonstrative compliance pattern. In production, it would be supplemented with more sophisticated NLP analysis and human review.

---

## Audit Trail Export

### AUDIT-05: Audit Trail Export

**As a** compliance officer, **I want** to export a complete audit trail for any application as a downloadable document with all agent decisions, human actions, and workflow transitions, **so that** I can provide it for regulatory examination.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Export complete audit trail**
- **Given** an authenticated user with `reviewer` role specifying an application ID
- **When** the user requests an audit trail export
- **Then** the system generates a downloadable document containing all audit events for that application in chronological order, including: every agent decision (with confidence score, reasoning, input data hash), every human review action (with reviewer identity, role, decision, rationale), every workflow state transition (with before/after states), and every document upload event

**AC-2: Export format**
- **Given** an audit trail export request
- **When** the export is generated
- **Then** the export is available in a structured format (JSON) suitable for regulatory examination, with clear event categorization and chronological ordering

**AC-3: Reviewer-only access**
- **Given** a user with `loan_officer` or `senior_underwriter` role
- **When** the user attempts to export an audit trail
- **Then** the request is rejected with 403 forbidden

**AC-4: Non-existent application**
- **Given** an audit trail export request for an application ID that does not exist
- **When** the export is requested
- **Then** the system returns 404 with a clear error message

**AC-5: Export includes hash chain status**
- **Given** an audit trail export request
- **When** the export is generated
- **Then** the export includes a hash chain validation status field indicating whether the chain is intact (see AUDIT-06)

**AC-6: Export audit trail**
- **Given** a successful audit trail export
- **When** the export is generated
- **Then** an audit event is recorded with event_type `audit_export`, the application ID, the requester identity, and the export timestamp

#### Notes
- Cross-references: AUDIT-01 through AUDIT-04 for the underlying audit infrastructure. AUDIT-06 for hash chain validation. AUTH-05 for role enforcement.

---

### AUDIT-06: Hash Chain Validation on Export

**As a** system, **I should** validate the audit event hash chain before export and include a tamper warning flag if a break is detected, **so that** audit integrity is verifiable.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Hash chain validation before export**
- **Given** an audit trail export is requested for an application
- **When** the system prepares the export
- **Then** the system validates the hash chain by recomputing each event's expected `prev_event_hash` from the preceding event and comparing it to the stored value

**AC-2: Intact chain**
- **Given** the hash chain for an application's audit trail is intact (all hashes match)
- **When** the validation completes
- **Then** the export includes a `chain_integrity: "valid"` field indicating no tampering was detected

**AC-3: Broken chain detected**
- **Given** the hash chain for an application's audit trail has a break (one or more hashes do not match)
- **When** the validation completes
- **Then** the export includes a `chain_integrity: "tamper_warning"` field, identifies the specific event(s) where the chain break was detected, and the export is still generated (not blocked) so that investigators can examine the data

**AC-4: First event validation**
- **Given** the first audit event for an application
- **When** the hash chain is validated
- **Then** the first event's `prev_event_hash` is validated against the null sentinel hash value, confirming the chain starts correctly

#### Notes
- Cross-references: AUDIT-03 for hash chain implementation. AUDIT-05 for the export that triggers validation.
- A daily background validation job (mentioned in architecture) is a Technical Design detail, not a separate requirement.

---

## Observability & Deployment

### OBS-04: LangFuse Integration

**As a** developer, **I want** LangFuse integration to provide workflow trace visualization, token usage tracking, cost monitoring, and latency analysis for all LLM calls, **so that** I can understand system behavior and cost.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Workflow trace visualization**
- **Given** a loan processing workflow has completed (or is in progress)
- **When** a developer accesses the LangFuse dashboard
- **Then** the developer can see a trace for the workflow showing each LangGraph node execution as a span, with the correlation ID linking the trace to the application

**AC-2: Token usage tracking**
- **Given** LLM calls are made during agent execution
- **When** the developer views a trace in LangFuse
- **Then** each LLM call span includes: model name, input token count, output token count, and total token count

**AC-3: Cost monitoring**
- **Given** LLM calls with token counts
- **When** the developer views traces in LangFuse
- **Then** each span includes an estimated cost based on the model's pricing, and aggregate cost per workflow is visible

**AC-4: Latency analysis**
- **Given** completed LLM calls
- **When** the developer views traces in LangFuse
- **Then** each span includes duration (start time, end time, elapsed milliseconds), enabling identification of slow agents or LLM calls

**AC-5: Optional dependency -- graceful degradation**
- **Given** the `LANGFUSE_PUBLIC_KEY` environment variable is not set
- **When** the system starts and agents execute
- **Then** the system operates normally without tracing -- LangFuse callback handlers are no-ops, no errors are logged about missing LangFuse configuration, and no traces are lost (they simply are not recorded)

**AC-6: Intake agent traces**
- **Given** the intake chat agent processes a conversation
- **When** the developer views the trace in LangFuse
- **Then** the trace includes the agent's LLM call, any tool calls (calculator, FRED API, property data, knowledge base search) as sub-spans, and the streaming response duration

#### Notes
- Cross-references: OBS-01/OBS-02 for correlation ID propagation (correlation ID is used as the LangFuse trace ID). PIPE-01 through PIPE-12 for agent LLM calls that produce traces.
- LangFuse integration is optional. The system must function identically with or without it.

---

### DEPLOY-01: Container Definitions

**As a** platform engineer, **I want** container definitions (Containerfiles) for API and UI packages, **so that** I can build container images.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: API Containerfile**
- **Given** the `packages/api` package source code
- **When** a container image is built from the Containerfile
- **Then** the resulting image includes all Python dependencies installed via uv, the application source, and runs uvicorn as the entrypoint, with a non-root user for security

**AC-2: UI Containerfile**
- **Given** the `packages/ui` package source code
- **When** a container image is built from the Containerfile
- **Then** the resulting image is a multi-stage build that installs Node dependencies with pnpm, builds the Vite production bundle, and serves the static assets via nginx (or equivalent), with a non-root user

**AC-3: Podman compatibility**
- **Given** the Containerfiles
- **When** images are built using Podman (not Docker)
- **Then** the builds succeed without modification (no Docker-specific features used)

**AC-4: Image size optimization**
- **Given** the built container images
- **When** the image sizes are inspected
- **Then** the images use multi-stage builds to minimize final image size (build dependencies are not included in the runtime stage)

#### Notes
- Cross-references: DEPLOY-02 for Helm charts that reference these images. DEPLOY-03 for health check endpoints that the container runtime probes.

---

### DEPLOY-02: Helm Charts

**As a** platform engineer, **I want** Helm charts for deploying the complete system to OpenShift, **so that** I can deploy to a container orchestration platform.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Complete system deployment**
- **Given** the Helm charts in `deploy/helm/`
- **When** the charts are installed on an OpenShift cluster
- **Then** all required components are deployed: API, UI, PostgreSQL (with pgvector), Redis, MinIO, and optionally LangFuse

**AC-2: Configuration via values**
- **Given** the Helm chart values file
- **When** a platform engineer customizes deployment configuration
- **Then** all environment-specific settings (database credentials, API keys, resource limits, replica counts) are configurable via Helm values without modifying chart templates

**AC-3: Secrets management**
- **Given** sensitive configuration (database credentials, encryption keys, LLM API keys)
- **When** the charts are deployed
- **Then** secrets are managed via Kubernetes/OpenShift Secrets resources, not ConfigMaps or environment variables in plain text in the chart

**AC-4: Routes/Ingress**
- **Given** the deployed system
- **When** the deployment is accessed
- **Then** OpenShift Routes (or equivalent Ingress) expose the UI and API with appropriate TLS configuration

**AC-5: Liveness and readiness probes**
- **Given** the deployed API pods
- **When** the orchestration platform checks pod health
- **Then** liveness probes point to `/health` and readiness probes point to `/ready` (see DEPLOY-03)

#### Notes
- Cross-references: DEPLOY-01 for container images referenced by the charts. DEPLOY-03 for health endpoints used by probes.

---

### DEPLOY-03: Health Check Endpoints

**As a** platform engineer, **I want** health check endpoints (`/health` for liveness, `/ready` for readiness) that verify database, Redis, and MinIO connectivity, **so that** orchestration platforms can monitor service health.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Liveness endpoint**
- **Given** the API service is running
- **When** `GET /health` is called
- **Then** the endpoint returns 200 if the process is running and can respond to HTTP requests, regardless of dependency health

**AC-2: Readiness endpoint -- all dependencies healthy**
- **Given** the API service is running and PostgreSQL, Redis, and MinIO are all reachable
- **When** `GET /ready` is called
- **Then** the endpoint returns 200 with a JSON body indicating each dependency's status

**AC-3: Readiness endpoint -- dependency unhealthy**
- **Given** one or more dependencies (PostgreSQL, Redis, MinIO) are unreachable
- **When** `GET /ready` is called
- **Then** the endpoint returns 503 with a JSON body indicating which dependency is unhealthy

**AC-4: No authentication required**
- **Given** the health endpoints
- **When** they are called without an Authorization header
- **Then** they respond normally (health endpoints do not require authentication)

**AC-5: Fast response**
- **Given** the health endpoints
- **When** they are called
- **Then** they respond quickly with lightweight connectivity tests (e.g., `SELECT 1` for PostgreSQL, `PING` for Redis), not heavy computation or full data queries

#### Notes
- Cross-references: DEPLOY-02 for Helm chart probe configuration. OBS-01/OBS-03 for structured logging of health check failures.
- Health endpoints are not under the `/v1/` prefix (they are infrastructure endpoints).

---

### DEPLOY-04: CI Pipeline Configuration

**As a** developer, **I want** a CI pipeline configuration that runs tests, linters, type checkers, and security scanners on every commit, **so that** code quality is enforced automatically.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Test execution**
- **Given** a commit is pushed to the repository
- **When** the CI pipeline runs
- **Then** all tests are executed: Pytest for API and DB packages, Vitest for UI package, and the pipeline fails if any test fails

**AC-2: Linting**
- **Given** a CI pipeline run
- **When** linters execute
- **Then** Ruff (Python) and ESLint (TypeScript) run against their respective packages, and the pipeline fails if lint errors are found

**AC-3: Type checking**
- **Given** a CI pipeline run
- **When** type checkers execute
- **Then** mypy or pyright (Python) and `tsc --noEmit` (TypeScript) run, and the pipeline fails on type errors

**AC-4: Security scanning**
- **Given** a CI pipeline run
- **When** security scanners execute
- **Then** dependency vulnerability scanning runs (e.g., `pip audit`, `npm audit` or equivalent), and the pipeline reports findings (fail on critical/high severity vulnerabilities)

**AC-5: Pipeline configuration in repository**
- **Given** the CI pipeline definition
- **When** a developer inspects the repository
- **Then** the pipeline configuration file is committed to the repository (e.g., `.github/workflows/*.yml` or equivalent)

#### Notes
- Cross-references: Testing standards in `.claude/rules/testing.md`. Security scanning in `.claude/rules/security.md`.
- The specific CI platform (GitHub Actions, GitLab CI, etc.) is a Technical Design detail.

---

## Public Tier Extensions (P2)

### CHAT-08: Cross-Session Context

**As a** borrower, **I want** the intake agent to remember prior conversations when I return, **so that** I don't have to repeat myself.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Conversation summary stored**
- **Given** a chat session ends (user closes the chat or session times out)
- **When** the session is finalized
- **Then** a conversation summary is generated from the session's messages and stored, capturing key topics discussed, questions asked, and any scenarios explored (e.g., loan amounts, property types, income ranges discussed)

**AC-2: Summaries, not raw transcripts**
- **Given** a conversation summary is being generated
- **When** the summary is created
- **Then** the stored data is a concise summary of the conversation, NOT raw message transcripts, to minimize storage and reduce PII exposure

**AC-3: PII redaction before storage**
- **Given** a conversation summary is being generated
- **When** the summary content is prepared for storage
- **Then** any PII mentioned in the conversation (SSN, account numbers, exact addresses, full names with financial data) is redacted from the summary before storage

**AC-4: Cross-session context recall**
- **Given** a returning user with a prior conversation summary on file
- **When** the user starts a new chat session
- **Then** the intake agent has access to the prior conversation summary and can reference it (e.g., "Last time we discussed a $300,000 home with 10% down. Would you like to continue from there?")

**AC-5: Summary TTL**
- **Given** a conversation summary stored for a user
- **When** 24 hours have elapsed since the summary was created
- **Then** the summary is automatically expired/deleted, and the user starts fresh on their next visit

**AC-6: No cross-session context without prior session**
- **Given** a new user with no prior conversation history
- **When** the user starts a chat session
- **Then** the intake agent has no cross-session context and begins a fresh conversation

#### Notes
- Cross-references: CHAT-01 for the base chat functionality. PII-03/PIPE-08 for PII redaction patterns.
- Cross-session context is identified by session token, not by authentication (public tier users are not authenticated). The mechanism for linking sessions is a Technical Design detail.
- Storage is in the `intake_conversations` / `intake_messages` tables or a dedicated summary store -- Technical Design determines the specific approach.

---

### CHAT-09: Sentiment Analysis

**As a** system, **I should** detect user frustration or confusion in chat conversations via sentiment analysis and adjust the agent's tone accordingly, **so that** the experience improves when users struggle.

**Priority:** P2 | **Phase:** 5

#### Acceptance Criteria

**AC-1: Sentiment detection**
- **Given** a user message in a chat conversation
- **When** the message is processed by the intake agent
- **Then** the system evaluates the user's sentiment (e.g., neutral, confused, frustrated, satisfied) based on the message content and conversation context

**AC-2: Tone adjustment on frustration**
- **Given** the system detects user frustration (e.g., repeated questions, expressions of confusion, negative language)
- **When** the intake agent generates its next response
- **Then** the agent's tone becomes more empathetic, simplifies explanations, offers to clarify specific points, and avoids introducing additional complexity

**AC-3: Tone adjustment on confusion**
- **Given** the system detects user confusion (e.g., asking "what does that mean?", rephrasing the same question)
- **When** the intake agent generates its next response
- **Then** the agent breaks down concepts into simpler terms, uses analogies where helpful, and proactively defines technical terminology

**AC-4: Return to neutral tone**
- **Given** the system previously detected frustration or confusion, and subsequent messages indicate the user is back on track
- **When** the intake agent generates its next response
- **Then** the agent returns to its default conversational tone

**AC-5: Sentiment transition logging**
- **Given** a sentiment transition occurs (e.g., neutral -> frustrated, frustrated -> neutral)
- **When** the transition is detected
- **Then** the transition is logged as a structured log entry with the session ID, previous sentiment, new sentiment, and timestamp (for analysis of user experience patterns)

**AC-6: No PII in sentiment logs**
- **Given** sentiment transitions are logged
- **When** the log entry is created
- **Then** the log entry does not include the user's message content (which may contain PII), only the sentiment classification and session metadata

#### Notes
- Cross-references: CHAT-01/CHAT-02 for base chat and plain-language requirements. OBS-03 for structured logging.
- Sentiment analysis is performed as part of the intake agent's LLM processing, not as a separate service -- Technical Design determines whether it is part of the system prompt or a separate classification step.

---

## Non-Functional Requirements for This Chunk

### Auditability (Extensions)
- All threshold changes, knowledge base operations, compliance report generation, and audit exports are recorded as audit events following the same immutability guarantees (INSERT-only, trigger guard, hash chain) as all other audit events.

### Security (Administration)
- All administration endpoints (threshold configuration, knowledge base management, compliance reporting, audit export) require `reviewer` role authorization.
- Knowledge base uploads are validated for file type and size, consistent with document upload security controls.

### Reliability (Pipeline Extensions)
- Fraud detection and denial coaching failures do not block the main workflow. Fraud detection is treated as an optional agent (workflow continues on failure). Denial coaching failure does not reverse the denial decision.
- Incremental resubmission (PIPE-13) falls back to full re-run on any ambiguity.

### Responsiveness (Deployment)
- Health check endpoints respond quickly (sub-second) with lightweight connectivity tests.
- CI pipeline provides feedback within a reasonable time for developer iteration.

---

## Open Questions

1. **Fraud detection sensitivity defaults:** The specific default sensitivity values and the configurable parameters (e.g., income discrepancy threshold percentage, property flip time window) should be determined during Technical Design. The requirement is that they are configurable, not hardcoded.

2. **Knowledge base re-indexing strategy:** Whether re-indexing invalidates the Redis RAG query cache eagerly (flush on re-index) or lazily (TTL-based expiry) is a Technical Design decision (noted as architecture open question #4).

3. **Review priority score weights:** The specific formula and weights for computing review priority scores (REV-07) are Technical Design details.

4. **CI platform selection:** The specific CI platform (GitHub Actions, GitLab CI, etc.) is not specified in the product plan or architecture and should be determined during Technical Design.

---

## Assumptions

1. **Fraud detection is best-effort for MVP:** The fraud detection patterns demonstrate the capability but are not expected to catch real fraud with production-grade accuracy. The value is in showing the pattern (configurable detection -> forced escalation -> human review).

2. **Knowledge base content is demonstrative:** The sample regulatory excerpts (ECOA, Fair Housing Act, TILA, RESPA) are sufficient to demonstrate the RAG pattern. They are not legally validated or comprehensive.

3. **Audit export format is JSON:** The export format is structured JSON, suitable for programmatic consumption by regulatory examination tools. PDF or other human-readable formats are out of scope for P2.

4. **Cross-session chat uses session tokens:** Since public tier users are not authenticated, cross-session context relies on session tokens (e.g., cookies or local storage). The specific mechanism is a Technical Design detail.

5. **Sentiment analysis uses LLM capabilities:** Sentiment detection leverages the intake agent's LLM, not a separate ML model. The LLM evaluates sentiment as part of its conversation processing.
