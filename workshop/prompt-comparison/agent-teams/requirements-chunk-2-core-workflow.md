<!-- This project was developed with assistance from AI tools. -->

# Requirements Chunk 2: Core Workflow

This document provides detailed acceptance criteria for the core workflow stories: Application Lifecycle (APP-01 through APP-07), Document Management (DOC-01 through DOC-04), Agent Analysis Pipeline core (PIPE-01 through PIPE-10), and Human Review minimal (REV-01 through REV-04).

**Prerequisites:** All protected endpoints in this chunk require valid authentication (AUTH-01 through AUTH-08). All state transitions and significant actions generate audit events (AUDIT-01 through AUDIT-03). These cross-cutting concerns are specified in Chunk 1 and apply to every story below.

**Financial precision convention:** All monetary values are stored as integer cents in the database and serialized as string decimals in API JSON responses (e.g., `"loanAmount": "250000.00"`). Interest rates and ratios are also serialized as strings (e.g., `"interestRate": "6.875"`). No floating-point arithmetic is used for financial calculations.

---

## Application Lifecycle (APP)

### APP-01: Create a New Loan Application

**As a** loan officer, **I want** to create a new loan application with borrower information and loan terms, **so that** I can begin the processing workflow.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful application creation with valid data**
- **Given** an authenticated user with role `loan_officer` or higher
- **When** they send a POST request to `/v1/applications` with valid borrower data (borrower name, SSN, annual income, monthly debts, loan amount, property value, loan term in months, interest rate, property address)
- **Then** the system creates a new application in `draft` status, returns 201 with a `Location` header pointing to the new resource, the response body contains `{ "data": { ... } }` with the application ID, all monetary values are serialized as string decimals, SSN is returned masked as `"***-**-1234"`, and an audit event of type `state_transition` is recorded with `previous_state: null`, `new_state: "draft"`, the actor identity, and the correlation ID

**AC-2: Validation failure for missing required fields**
- **Given** an authenticated user with role `loan_officer` or higher
- **When** they send a POST request to `/v1/applications` with missing required fields (e.g., no borrower name, no loan amount)
- **Then** the system returns 422 with an RFC 7807 error response containing a `detail` field describing the missing fields and an `errors` array listing each validation failure, and no application record is created

**AC-3: Validation failure for invalid monetary values**
- **Given** an authenticated user with role `loan_officer` or higher
- **When** they send a POST request with monetary values that are negative, zero (for loan amount, property value, annual income), or non-numeric
- **Then** the system returns 422 with an RFC 7807 error response describing the invalid values

**AC-4: PII encryption at rest**
- **Given** a valid application creation request containing SSN, account numbers, or government ID
- **When** the application is persisted to the database
- **Then** the SSN is stored as Fernet-encrypted bytes in `ssn_encrypted`, only the last 4 digits are stored in plaintext in `ssn_last4`, account numbers are stored encrypted in `account_numbers_encrypted`, government IDs are stored encrypted in `government_id_encrypted`, and no PII appears in plaintext in the database row

**AC-5: Unauthorized access**
- **Given** a request with no `Authorization` header, an invalid API key, or an expired API key
- **When** they send a POST request to `/v1/applications`
- **Then** the system returns 401 with an RFC 7807 error response

**AC-6: Created_by association**
- **Given** an authenticated loan officer creating an application
- **When** the application is created
- **Then** the `created_by` field references the API key ID of the authenticated user

#### Notes
- The `analysis_pass` field defaults to 1 on creation.
- Property address is stored as JSONB. Validation of address structure is at the API boundary.
- Cross-reference: AUTH-01 (authentication required), AUDIT-01 (state transition audit event), PII-01 (encryption at rest).

---

### APP-02: List All Applications with Current Status

**As a** loan officer, **I want** to view all my applications with their current status, **so that** I can track progress across multiple applications.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful paginated listing**
- **Given** an authenticated user with role `loan_officer` or higher who has created one or more applications
- **When** they send a GET request to `/v1/applications`
- **Then** the system returns 200 with `{ "data": [...], "pagination": { "nextCursor": "...", "hasMore": true/false } }`, each application includes its ID, status, borrower name, loan amount (string decimal), created date, and updated date, SSN fields are masked (last 4 only), results are ordered by `created_at` descending, and the default page size is 20 with a maximum of 100

**AC-2: Cursor-based pagination**
- **Given** an authenticated user with more applications than the page limit
- **When** they send a GET request with `?cursor=<value>&limit=<number>`
- **Then** the system returns the next page of results starting after the cursor position, and `hasMore` is `false` on the last page

**AC-3: Role-based visibility**
- **Given** a `loan_officer` who has created applications
- **When** they request the application list
- **Then** they see only applications where `created_by` matches their API key ID

- **Given** a `senior_underwriter` or `reviewer`
- **When** they request the application list
- **Then** they see all applications regardless of `created_by`

**AC-4: Empty list**
- **Given** an authenticated loan officer with no applications
- **When** they request the application list
- **Then** the system returns 200 with `{ "data": [], "pagination": { "hasMore": false } }`

**AC-5: Filtering by status**
- **Given** an authenticated user with applications in various statuses
- **When** they send a GET request with `?status=processing`
- **Then** only applications matching the specified status are returned

#### Notes
- No audit event is generated for read-only list operations.
- Cross-reference: AUTH-01 (authentication), AUTH-05 (RBAC).

---

### APP-03: View Single Application Details

**As a** loan officer, **I want** to view a single application's complete details including all agent analyses and workflow history, **so that** I can understand its current state.

**Priority:** P0 | **Phase:** 1 (basic detail), Phase 2+ (agent analyses populated)

#### Acceptance Criteria

**AC-1: Successful detail retrieval**
- **Given** an authenticated user authorized to view the application
- **When** they send a GET request to `/v1/applications/:id`
- **Then** the system returns 200 with `{ "data": { ... } }` containing the full application record (all fields from APP-01), all monetary values as string decimals, SSN masked as `"***-**-1234"`, a list of associated documents with their processing statuses, and current workflow status

**AC-2: Agent analyses included when available**
- **Given** an application that has been processed through the agent pipeline
- **When** the detail is retrieved
- **Then** the response includes an `analyses` field containing all agent decisions for the current `analysis_pass`: each with agent name, recommendation, confidence score, reasoning, and result data

**AC-3: Application not found**
- **Given** an authenticated user
- **When** they request an application with a non-existent UUID
- **Then** the system returns 404 with an RFC 7807 error response

**AC-4: Authorization check**
- **Given** a `loan_officer` who did not create the application
- **When** they request the application detail
- **Then** the system returns 404 (not 403, to prevent information leakage about application existence)

- **Given** a `senior_underwriter` or `reviewer`
- **When** they request any application detail
- **Then** the system returns the full detail regardless of `created_by`

**AC-5: Invalid application ID format**
- **Given** an authenticated user
- **When** they request an application with a non-UUID string as the ID
- **Then** the system returns 400 with an RFC 7807 error response

#### Notes
- Workflow history (audit events) is available via the sub-resource `/v1/applications/:id/audit-events` (specified in AUDIT-04, Chunk 1).
- Cross-reference: AUTH-01, AUTH-05, PIPE-01 through PIPE-06 (agent analyses).

---

### APP-04: Submit a Draft Application for Processing

**As a** loan officer, **I want** to submit a draft application for processing, **so that** the multi-agent workflow can analyze it.

**Priority:** P0 | **Phase:** 1 (status transition), Phase 2 (actual pipeline invocation)

#### Acceptance Criteria

**AC-1: Successful submission**
- **Given** an authenticated user who created the application, and the application is in `draft` status, and at least one document has been uploaded to the application
- **When** they send a PATCH request to `/v1/applications/:id` with `{ "status": "submitted" }`
- **Then** the system transitions the application from `draft` to `submitted`, then immediately to `processing`, returns 200 with the updated application, an audit event of type `state_transition` is recorded for `draft -> submitted`, a second audit event is recorded for `submitted -> processing`, and a background workflow invocation is enqueued (the API returns before the workflow starts, using asynchronous invocation)

**AC-2: Submission without documents**
- **Given** an application in `draft` status with no uploaded documents
- **When** the user attempts to submit it
- **Then** the system returns 422 with an RFC 7807 error response stating that at least one document is required for submission

**AC-3: Invalid status transition**
- **Given** an application that is not in `draft` status (e.g., `processing`, `approved`, `denied`)
- **When** the user attempts to submit it
- **Then** the system returns 409 (Conflict) with an RFC 7807 error response describing the invalid transition

**AC-4: Authorization -- only creator can submit**
- **Given** a `loan_officer` who did not create the application
- **When** they attempt to submit it
- **Then** the system returns 404 (consistent with APP-03 AC-4 to prevent information leakage)

**AC-5: Concurrent submission prevention**
- **Given** an application in `draft` status
- **When** two concurrent PATCH requests attempt to submit it simultaneously
- **Then** exactly one succeeds and transitions the application to `processing`, and the other receives 409 (Conflict)

#### Notes
- The `submitted` status is transient -- the system immediately transitions to `processing` and enqueues the workflow. The two-step transition exists to capture the user intent (`submitted`) separately from the system action (`processing`) in the audit trail.
- Phase 1 implementation enqueues a stub workflow; Phase 2 replaces with real agent pipeline.
- Cross-reference: AUDIT-01 (state transition events), PIPE-01 through PIPE-10 (pipeline execution).

---

### APP-05: Application Status Transitions

**As a** loan officer, **I want** to see clear status transitions (draft, submitted, processing, awaiting_review, approved, denied, withdrawn, processing_error), **so that** I know what stage the application is in.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Valid status transition map**
- **Given** the application status model
- **When** any status transition is attempted
- **Then** only the following transitions are permitted:
  - `draft` -> `submitted` (user action: submit)
  - `submitted` -> `processing` (system action: workflow enqueued)
  - `processing` -> `approved` (system action: auto-approve on high confidence)
  - `processing` -> `awaiting_review` (system action: escalation)
  - `processing` -> `processing_error` (system action: agent failure)
  - `awaiting_review` -> `approved` (user action: reviewer approves)
  - `awaiting_review` -> `denied` (user action: reviewer denies)
  - `processing_error` -> `processing` (user action: retry)
  - `draft` -> `withdrawn` (user action: withdraw)
  - `submitted` -> `withdrawn` (user action: withdraw)
  - `awaiting_review` -> `withdrawn` (user action: withdraw)
  Any other transition is rejected with 409 (Conflict).

**AC-2: Audit event for every transition**
- **Given** any valid status transition
- **When** the transition occurs
- **Then** an audit event of type `state_transition` is recorded with `previous_state`, `new_state`, the actor (user or agent/system), timestamp, and correlation ID

**AC-3: Terminal states are immutable**
- **Given** an application in a terminal status (`approved`, `denied`, `withdrawn`)
- **When** any status transition is attempted
- **Then** the system returns 409 (Conflict) with an RFC 7807 error stating that the application is in a terminal state

#### Notes
- Phase 4 adds the transitions: `awaiting_review` -> `awaiting_documents` (request docs) and `awaiting_documents` -> `processing` (resubmission). These are not included in Phase 2.
- The `processing_error` -> `processing` transition is the retry path (APP-07).
- Cross-reference: AUDIT-01 (every transition recorded).

---

### APP-06: Withdraw an Application

**As a** loan officer, **I want** to withdraw an application before final decision, **so that** I can handle borrower requests to cancel.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful withdrawal from draft**
- **Given** an authenticated user who created the application, and the application is in `draft` status
- **When** they send a PATCH request to `/v1/applications/:id` with `{ "status": "withdrawn" }`
- **Then** the application transitions to `withdrawn` status, the system returns 200 with the updated application, and an audit event of type `state_transition` is recorded with `previous_state: "draft"`, `new_state: "withdrawn"`

**AC-2: Successful withdrawal from submitted**
- **Given** an application in `submitted` status
- **When** the creator withdraws it
- **Then** the same behavior as AC-1, with `previous_state: "submitted"`

**AC-3: Successful withdrawal from awaiting_review**
- **Given** an application in `awaiting_review` status
- **When** the creator withdraws it
- **Then** the same behavior as AC-1, with `previous_state: "awaiting_review"`

**AC-4: Cannot withdraw from processing**
- **Given** an application in `processing` status (workflow actively running)
- **When** the user attempts to withdraw it
- **Then** the system returns 409 (Conflict) with an RFC 7807 error response stating that applications in `processing` status cannot be withdrawn (the workflow must complete or fail first)

**AC-5: Cannot withdraw from terminal states**
- **Given** an application in `approved`, `denied`, or `withdrawn` status
- **When** the user attempts to withdraw it
- **Then** the system returns 409 (Conflict) with an RFC 7807 error response

**AC-6: Authorization -- only creator or higher roles can withdraw**
- **Given** a `loan_officer` who did not create the application
- **When** they attempt to withdraw it
- **Then** the system returns 404

- **Given** a `senior_underwriter` or `reviewer`
- **When** they attempt to withdraw any application in a withdrawable state
- **Then** the withdrawal succeeds

#### Notes
- Withdrawing an application that is `processing` is blocked because the LangGraph workflow is in-flight. The user should wait for processing to complete or fail, then withdraw from `awaiting_review` or `processing_error`.
- Cross-reference: APP-05 (valid transitions), AUDIT-01 (state transition event).

---

### APP-07: Retry a Failed Application

**As a** loan officer, **I want** to retry a failed application (processing_error status), **so that** transient failures don't block progress.

**Priority:** P0 | **Phase:** 1 (status transition), Phase 2 (actual pipeline retry)

#### Acceptance Criteria

**AC-1: Successful retry**
- **Given** an authenticated user authorized to manage the application, and the application is in `processing_error` status
- **When** they send a POST request to `/v1/applications/:id/retry`
- **Then** the system transitions the application from `processing_error` to `processing`, returns 202 Accepted, an audit event of type `state_transition` is recorded with `previous_state: "processing_error"`, `new_state: "processing"`, and a background workflow invocation is enqueued using the same `application_id` as the LangGraph `thread_id` so PostgresSaver resumes from the last successful checkpoint

**AC-2: Retry from non-error status**
- **Given** an application that is not in `processing_error` status
- **When** the user attempts to retry it
- **Then** the system returns 409 (Conflict) with an RFC 7807 error response

**AC-3: Idempotent retry -- only one in-flight workflow**
- **Given** an application in `processing` status (retry already in progress)
- **When** the user sends another retry request
- **Then** the system returns 409 (Conflict) stating that a workflow is already in progress

**AC-4: Retry resumes from last checkpoint**
- **Given** an application that failed midway through the pipeline (e.g., document processing succeeded, credit analysis failed)
- **When** the retry is invoked
- **Then** the workflow resumes from the last successful checkpoint, previously completed agent results are not re-executed, and only the failed and subsequent agents run

**AC-5: Retry with corrupted checkpoint fallback**
- **Given** an application whose checkpoint state is corrupted or unrecoverable
- **When** the retry is invoked
- **Then** the workflow falls back to a fresh graph invocation with thread ID `{application_id}:{analysis_pass}`, re-running the full pipeline, and an audit event captures the fallback

#### Notes
- The retry endpoint returns 202 (not 200) because the workflow is asynchronous. The client polls application status for completion.
- Cross-reference: APP-05 (valid transitions), CHECKPOINT-01/02 (checkpoint resume), PIPE-07 (checkpoint strategy).

---

## Document Management (DOC)

### DOC-01: Upload Documents to an Application

**As a** loan officer, **I want** to upload multiple documents (pay stubs, W-2s, tax returns, bank statements, appraisals) to an application, **so that** they can be analyzed.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful single document upload**
- **Given** an authenticated user who created the application, and the application is in `draft` status
- **When** they send a POST request to `/v1/applications/:id/documents` with a multipart file upload containing a valid document (PDF, JPEG, PNG, or TIFF, under 20MB)
- **Then** the system stores the file in MinIO with a UUID-based storage key and server-side encryption (SSE), creates a `documents` record with `processing_status: "pending"`, sanitizes the original filename (strips path components, replaces non-alphanumeric characters, truncates to 255 characters), returns 201 with a `Location` header and the document metadata (ID, original filename, MIME type, file size, processing status), and records an audit event of type `document_upload` with the application ID, document ID, and correlation ID

**AC-2: Multiple document uploads**
- **Given** an application in `draft` status
- **When** the user uploads multiple documents in separate requests
- **Then** each document is stored and tracked independently, and all documents appear when listing the application's documents

**AC-3: Upload to non-draft application**
- **Given** an application not in `draft` status (e.g., `processing`, `approved`)
- **When** the user attempts to upload a document
- **Then** the system returns 409 (Conflict) with an RFC 7807 error response stating that documents can only be uploaded to applications in `draft` status

**AC-4: Upload to non-existent application**
- **Given** an application ID that does not exist
- **When** the user attempts to upload a document
- **Then** the system returns 404

**AC-5: Authorization check**
- **Given** a `loan_officer` who did not create the application
- **When** they attempt to upload a document
- **Then** the system returns 404 (consistent with APP-03 AC-4)

- **Given** a `senior_underwriter` or `reviewer`
- **When** they attempt to upload a document to any application in `draft` status
- **Then** the upload succeeds

**AC-6: Storage key is UUID, not filename**
- **Given** any document upload
- **When** the document is stored in MinIO
- **Then** the MinIO object key is a generated UUID, not derived from the original filename, preventing path traversal and filename collision

#### Notes
- File type and size validation are covered in DOC-02 (separate from the upload mechanics).
- Phase 4 adds the ability to upload documents to applications in `awaiting_documents` status (REV-05/REV-06). This chunk covers `draft` status only.
- Cross-reference: AUDIT-01 (document_upload audit event), PII-01 (documents stored with SSE encryption).

---

### DOC-02: Validate Document File Type and Size at Upload

**As a** loan officer, **I want** uploaded documents to be validated for file type and size at upload time, **so that** I get immediate feedback on invalid files.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Valid file type accepted**
- **Given** a document upload with a file whose content matches one of the allowed types: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`
- **When** the file is uploaded
- **Then** the upload proceeds successfully

**AC-2: Invalid file type rejected (wrong MIME type)**
- **Given** a document upload with a file type not in the allowlist (e.g., `application/zip`, `text/html`, `application/msword`)
- **When** the file is uploaded
- **Then** the system returns 422 with an RFC 7807 error response listing the allowed file types, and no file is stored in MinIO

**AC-3: File type validation uses magic bytes, not Content-Type header**
- **Given** a document upload where the `Content-Type` header claims `application/pdf` but the file content is actually a ZIP file (mismatched magic bytes)
- **When** the file is uploaded
- **Then** the system rejects the upload with 422, because validation inspects the file content (magic bytes / file signature), not the client-supplied Content-Type header

**AC-4: File size within limit**
- **Given** a document upload with a file size at or below 20MB
- **When** the file is uploaded
- **Then** the upload proceeds successfully

**AC-5: File size exceeds limit**
- **Given** a document upload with a file size exceeding 20MB
- **When** the file is uploaded
- **Then** the system returns 422 with an RFC 7807 error response stating the maximum file size (20MB), and no file is stored

**AC-6: PDF structure validation**
- **Given** a file with a PDF magic byte signature
- **When** the file is uploaded
- **Then** the system validates that the file has a valid PDF structure (not a polyglot file), and rejects corrupted or malformed PDFs with 422

**AC-7: Image header validation**
- **Given** a file with JPEG, PNG, or TIFF magic byte signature
- **When** the file is uploaded
- **Then** the system validates the image header is well-formed and rejects corrupted images with 422

#### Notes
- The 20MB limit is configurable via environment/settings but defaults to 20MB.
- Magic bytes validation prevents attackers from disguising malicious files with incorrect Content-Type headers.
- Cross-reference: Security rules (input validation at system boundaries).

---

### DOC-03: View Document Processing Status

**As a** loan officer, **I want** to see the processing status of each uploaded document (pending, processing, completed, failed), **so that** I know when analysis is complete.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Document status in application detail**
- **Given** an authenticated user viewing an application with uploaded documents
- **When** they retrieve the application detail (GET `/v1/applications/:id`)
- **Then** the response includes a `documents` array where each document has: `id`, `originalFilename`, `mimeType`, `fileSizeBytes`, `documentType` (null if not yet classified), `processingStatus` (one of: `pending`, `processing`, `completed`, `failed`), and `createdAt`

**AC-2: Individual document detail**
- **Given** an authenticated user authorized to view the parent application
- **When** they send a GET request to `/v1/documents/:id`
- **Then** the system returns 200 with the full document record including `processingStatus`, `extractedData` (if completed), `fieldConfidence` (if completed), and `processingError` (RFC 7807 format if failed)

**AC-3: Status progression**
- **Given** a document with `processing_status: "pending"`
- **When** the agent pipeline picks it up for analysis
- **Then** the status transitions to `processing`, and upon completion transitions to `completed` (with `extracted_data` and `field_confidence` populated) or `failed` (with `processing_error` populated)

**AC-4: Failed document includes error details**
- **Given** a document whose processing failed
- **When** the user views the document detail
- **Then** the `processingError` field contains an RFC 7807 error object describing the failure (e.g., "Document extraction failed: unable to parse image content"), and internal error details (stack traces, LLM raw responses) are not exposed

**AC-5: Document not found**
- **Given** a document ID that does not exist
- **When** the user requests the document detail
- **Then** the system returns 404

#### Notes
- The client polls document status for completion. There is no push notification mechanism.
- Cross-reference: PIPE-01 (classification), PIPE-02 (extraction).

---

### DOC-04: Download Uploaded Documents

**As a** loan officer, **I want** to download uploaded documents, **so that** I can reference the source material during review.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Successful document download**
- **Given** an authenticated user authorized to view the parent application
- **When** they send a GET request to `/v1/documents/:id/download`
- **Then** the system retrieves the file from MinIO using the UUID storage key, returns 200 with the file content, sets `Content-Type` to the document's MIME type, sets `Content-Disposition` to `attachment; filename="<sanitized_original_filename>"`, and the file content matches what was originally uploaded

**AC-2: Document not found**
- **Given** a document ID that does not exist
- **When** the user requests the download
- **Then** the system returns 404

**AC-3: Authorization check**
- **Given** a `loan_officer` who did not create the parent application
- **When** they attempt to download a document
- **Then** the system returns 404 (consistent with information leakage prevention)

- **Given** a `senior_underwriter` or `reviewer`
- **When** they attempt to download any document
- **Then** the download succeeds

**AC-4: Storage key isolation**
- **Given** a request to download a document
- **When** the system retrieves the file from MinIO
- **Then** the system uses only the database-stored UUID storage key to locate the file, never a user-supplied path, preventing path traversal attacks

#### Notes
- Cross-reference: AUTH-05 (RBAC), DOC-01 (storage key is UUID-based).

---

## Agent Analysis Pipeline (PIPE)

### PIPE-01: Automatic Document Type Classification

**As a** system, **I must** automatically classify each uploaded document by type (W-2, pay stub, tax return, bank statement, appraisal), **so that** the correct extraction logic is applied.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Successful classification of supported document types**
- **Given** an uploaded document with `processing_status: "pending"` that is one of the supported types (W-2, pay stub, tax return/1040, bank statement, property appraisal)
- **When** the document processor agent receives the document as part of the pipeline
- **Then** the agent follows the 7-step pattern: (1) receives the document reference from graph state, (2) fetches the document from MinIO, (3) redacts any PII from metadata before sending to LLM, (4) sends the document image/PDF to GPT-4 Vision with a classification prompt, (5) parses the LLM response into a typed result with `document_type` and `classification_confidence`, (6) validates the classification against the known type enum, (7) records an audit event of type `agent_decision` with agent name `document_processor`, confidence score, reasoning, and input data hash (SHA-256 of the raw document bytes)
- **Then** the `documents` record is updated with `document_type` set to the classified type

**AC-2: Classification confidence score**
- **Given** a document that has been classified
- **When** the classification result is stored
- **Then** the result includes a confidence score between 0.0 and 1.0 for the classification, and the reasoning explains why the document was classified as that type

**AC-3: Unrecognized document type**
- **Given** an uploaded document that does not match any of the supported types (e.g., a utility bill, a personal letter)
- **When** the document processor attempts classification
- **Then** the agent sets `document_type` to `"unknown"` with a low confidence score and reasoning explaining why no type matched, and document processing continues (the extraction step will produce limited or empty results for unknown types)

**AC-4: Corrupted or unreadable document**
- **Given** a document that passed upload validation but cannot be interpreted by the vision model (e.g., blank page, heavily redacted, extremely low resolution)
- **When** the document processor attempts classification
- **Then** the agent records a `processing_error` result with descriptive error, the document's `processing_status` is set to `"failed"`, and an audit event captures the failure

**AC-5: PII redaction before LLM call**
- **Given** any document being sent to GPT-4 Vision for classification
- **When** the agent prepares the LLM request
- **Then** the PII redaction service processes any metadata or contextual data (e.g., associated borrower info) before it is included in the prompt. Note: the document image itself is sent to the vision model for classification; PII redaction applies to structured text data in the prompt context, not to the image pixels.

**AC-6: Checkpoint after classification**
- **Given** a document that has been classified
- **When** the document processor node completes
- **Then** the LangGraph state is checkpointed, so if the service restarts before extraction begins, classification results are preserved

#### Notes
- Each document in the application is processed sequentially within the document processing node (one LLM call per document).
- Supported types: `w2`, `pay_stub`, `tax_return`, `bank_statement`, `appraisal`.
- Cross-reference: PIPE-08 (PII redaction), PIPE-09 (audit event), PIPE-07 (checkpoint), DOC-03 (status update).

---

### PIPE-02: Extract Structured Data from Documents

**As a** system, **I must** extract structured data fields from each document with per-field confidence scores, **so that** loan officers can see what data was identified.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Successful extraction with per-field confidence**
- **Given** a document that has been classified as a known type (W-2, pay stub, tax return, bank statement, appraisal)
- **When** the document processor agent performs extraction
- **Then** the agent sends the document to GPT-4 Vision with a type-specific extraction prompt, parses the LLM response into structured fields matching the document type schema (see AC-2), computes a confidence score (0.0-1.0) for each extracted field, stores the results in `documents.extracted_data` (JSONB) and `documents.field_confidence` (JSONB), and records an audit event with the extraction confidence, reasoning, and input data hash

**AC-2: Type-specific extraction fields**
- **Given** a classified document
- **When** extraction is performed
- **Then** the following fields are extracted based on document type:
  - **W-2:** employer name, employer EIN, employee name, wages/tips/compensation, federal tax withheld, state, state wages, state tax withheld, tax year
  - **Pay stub:** employer name, employee name, pay period start/end, gross pay, net pay, YTD gross, YTD net, deductions breakdown
  - **Tax return (1040):** filer name, filing status, adjusted gross income, taxable income, total tax, tax year
  - **Bank statement:** bank name, account holder, account number (last 4 only in extracted data), statement period, beginning balance, ending balance, total deposits, total withdrawals
  - **Appraisal:** property address, appraised value, appraisal date, appraiser name, property type, square footage, comparable sales summary
  All monetary values in extracted data are stored as integer cents.

**AC-3: Partial extraction**
- **Given** a document where some fields are legible but others are not (e.g., blurry areas, handwritten annotations)
- **When** extraction is performed
- **Then** the agent extracts what it can, assigns low confidence scores to unclear fields, and includes reasoning for each low-confidence extraction

**AC-4: Extraction failure**
- **Given** a document where extraction fails entirely (e.g., LLM returns malformed response, or document is completely unreadable after classification)
- **When** the extraction step fails
- **Then** the document's `processing_status` is set to `"failed"`, a `processing_error` (RFC 7807) is stored, and an audit event captures the failure with error details

**AC-5: Document status transitions**
- **Given** a document with `processing_status: "pending"`
- **When** the document processor agent begins working on it
- **Then** the status transitions to `"processing"`, and upon completion transitions to `"completed"` (success) or `"failed"` (error)

**AC-6: PII handling in extracted data**
- **Given** extracted data that contains PII (e.g., full SSN from a W-2, full account number from a bank statement)
- **When** the extraction results are stored
- **Then** full SSNs are not stored in `extracted_data` (only last 4 digits), full account numbers are not stored in `extracted_data` (only last 4 digits), and any PII that was part of the prompt context is redacted via the PII redaction service before the LLM call

#### Notes
- Extraction and classification happen sequentially within the same document processor node -- classify first, then extract based on classified type.
- Cross-reference: DOC-03 (status polling), PIPE-08 (PII redaction), PIPE-09 (audit).

---

### PIPE-03: Credit Analysis

**As a** system, **I must** analyze the borrower's creditworthiness from credit report data (mocked), **so that** I can produce a credit recommendation with confidence score and reasoning.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Successful credit analysis**
- **Given** an application in the pipeline where document processing has completed
- **When** the credit analyst agent executes (in parallel with risk assessment and compliance checking)
- **Then** the agent follows the 7-step pattern: (1) receives application data from graph state, (2) calls the credit bureau service (mock implementation via Protocol interface) to retrieve a credit report, (3) redacts PII from the credit report data before sending to LLM, (4) sends the redacted credit data to Claude with an analysis prompt, (5) parses the response into a typed result containing: credit score assessment, payment history analysis, derogatory marks analysis, trend analysis, overall recommendation (`approve`, `deny`, or `review`), confidence score (0.0-1.0), and plain-language reasoning, (6) validates the result (recommendation is valid enum, confidence is in range), (7) records an audit event of type `agent_decision` with agent name `credit_analyst`, confidence, reasoning, and input data hash
- **Then** the result is stored in `agent_decisions` and in the graph state under `agent_results["credit_analyst"]`

**AC-2: Credit analysis result structure**
- **Given** a completed credit analysis
- **When** the result is stored
- **Then** `result_data` JSONB includes: `creditScore` (integer), `paymentHistorySummary` (string), `derogatoryMarks` (array of objects), `trendDirection` (improving/stable/declining), `recommendation` (approve/deny/review), `confidenceScore` (numeric), and `reasoning` (string)

**AC-3: Low credit score handling**
- **Given** a credit report with a very low credit score or significant derogatory marks
- **When** the credit analyst evaluates it
- **Then** the agent produces a `deny` or `review` recommendation with reasoning citing the specific credit factors

**AC-4: Credit bureau service failure**
- **Given** the credit bureau service (mock or real) is unavailable or returns an error
- **When** the credit analyst agent attempts to retrieve the credit report
- **Then** the agent retries with exponential backoff (3 attempts, 1s/2s/4s delays), and if all retries fail, the agent records a `processing_error` result, and the workflow transitions the application to `processing_error` status (credit analysis is a required agent)

**AC-5: Mocked credit bureau returns consistent data**
- **Given** the system is configured with `credit_bureau_provider: "mock"`
- **When** the mock credit bureau is called with the same application data
- **Then** it returns deterministic, realistic credit report data (randomized based on seed data, but consistent for the same application ID) conforming to the `CreditBureauService` Protocol interface

#### Notes
- The credit analyst runs in parallel with risk assessor and compliance checker (PIPE-10).
- The mocked credit bureau implements the same `CreditBureauService` Protocol that a real bureau integration would use.
- Cross-reference: PIPE-08 (PII redaction), PIPE-09 (audit), PIPE-10 (parallel execution).

---

### PIPE-04: Financial Risk Assessment

**As a** system, **I must** calculate financial risk metrics (DTI ratio, LTV ratio, employment stability score), **so that** I can produce an overall risk score with component breakdown.

**Priority:** P0 | **Phase:** 3a

#### Acceptance Criteria

**AC-1: Successful risk assessment**
- **Given** an application in the pipeline with completed document extraction (income, debt, property value, employment data available)
- **When** the risk assessor agent executes (in parallel with credit analysis and compliance checking)
- **Then** the agent follows the 7-step pattern: (1) receives extracted financial data from graph state, (2) redacts PII, (3) sends redacted data to Claude with a risk assessment prompt including the financial figures, (4) parses the response into a typed result, (5) validates computed metrics (DTI and LTV are non-negative ratios, employment stability is 0.0-1.0), (6) records an audit event, (7) returns the result
- **Then** the result is stored in `agent_decisions` with agent name `risk_assessor`

**AC-2: Risk assessment result structure**
- **Given** a completed risk assessment
- **When** the result is stored
- **Then** `result_data` JSONB includes: `dtiRatio` (string decimal, e.g., "43.50"), `ltvRatio` (string decimal), `employmentStabilityScore` (string decimal 0.0-1.0), `overallRiskScore` (string decimal 0.0-1.0), `componentBreakdown` (object with individual metric details), `recommendation` (approve/deny/review), `confidenceScore` (numeric), and `reasoning` (string citing specific metric values)

**AC-3: Cross-validation of income across documents**
- **Given** extracted data from multiple income-related documents (e.g., W-2 wages and pay stub gross pay)
- **When** the risk assessor evaluates income
- **Then** the agent cross-validates income figures across document sources, flags discrepancies (e.g., W-2 annual wages differ significantly from annualized pay stub income), and adjusts confidence score based on consistency

**AC-4: High DTI or LTV triggers review recommendation**
- **Given** a DTI ratio exceeding 43% or an LTV ratio exceeding 97%
- **When** the risk assessor evaluates the application
- **Then** the agent produces a `deny` or `review` recommendation with reasoning citing the specific ratio and the threshold it exceeds

**AC-5: Missing financial data**
- **Given** extracted data where key fields are missing or have low confidence (e.g., income could not be extracted from a blurry document)
- **When** the risk assessor evaluates the application
- **Then** the agent produces a `review` recommendation with low confidence, reasoning cites the missing/unreliable data, and the confidence score reflects the data quality

#### Notes
- DTI = (monthly debts + estimated monthly mortgage payment) / monthly gross income.
- LTV = loan amount / property value.
- Financial calculations use precise numeric types, not floating-point.
- Cross-reference: PIPE-02 (extracted data), PIPE-08 (PII redaction), PIPE-10 (parallel execution).

---

### PIPE-05: Regulatory Compliance Verification

**As a** system, **I must** verify fair lending compliance by checking that all decision factors are permitted and regulatory citations are included, **so that** I can generate compliant adverse action notices.

**Priority:** P0 | **Phase:** 3a

#### Acceptance Criteria

**AC-1: Successful compliance check**
- **Given** an application in the pipeline where document processing has completed
- **When** the compliance checker agent executes (in parallel with credit analysis and risk assessment in Phase 3a)
- **Then** the agent follows the 7-step pattern: (1) receives document extraction results and application record data from graph state, (2) redacts PII, (3) performs a RAG search against the knowledge base for relevant regulatory guidance, (4) sends the document extraction results, application data, and regulatory context to Claude with a compliance verification prompt, (5) parses the response into a typed result, (6) validates the result, (7) records an audit event
- **Then** the result is stored in `agent_decisions` with agent name `compliance_checker`

**AC-2: Compliance result structure**
- **Given** a completed compliance check
- **When** the result is stored
- **Then** `result_data` JSONB includes: `isCompliant` (boolean), `permittedFactorsUsed` (array of strings -- e.g., "DTI ratio", "credit score", "LTV ratio"), `prohibitedFactorsDetected` (array of strings -- empty if compliant), `regulatoryCitations` (array of objects with `regulation`, `section`, `summary`), `adverseActionReasons` (array of objects with `reason`, `metric`, `threshold`, `actualValue` -- populated if any agent recommends denial), `recommendation` (approve/deny/review), `confidenceScore` (numeric), and `reasoning` (string)

**AC-3: Detection of prohibited factors**
- **Given** agent results where a decision factor references a protected characteristic (race, gender, national origin, religion, marital status, age as standalone factor)
- **When** the compliance checker evaluates the results
- **Then** the checker flags the prohibited factor, sets `isCompliant: false`, sets recommendation to `review`, and includes reasoning citing the specific prohibited factor and the applicable regulation

**AC-4: Adverse action notice generation**
- **Given** one or more agents recommend denial
- **When** the compliance checker generates adverse action reasons
- **Then** each reason includes a specific quantifiable metric (e.g., "DTI ratio of 52% exceeds maximum threshold of 43%"), a regulatory citation, and does not reference any protected characteristic

**AC-5: Knowledge base unavailable (RAG failure)**
- **Given** the RAG knowledge base search fails (e.g., embedding service down, no relevant documents found)
- **When** the compliance checker attempts to retrieve regulatory context
- **Then** the agent proceeds with built-in compliance rules (basic permitted/prohibited factor checks), sets confidence score lower to reflect the missing regulatory context, and includes reasoning noting the unavailable knowledge base

**AC-6: Compliance check with incomplete agent results**
- **Given** some upstream agents have failed (e.g., document extraction failed for one document)
- **When** the compliance checker evaluates available results
- **Then** the agent evaluates what is available, notes the incomplete data in its reasoning, and adjusts confidence accordingly

#### Notes
- The compliance checker requires the knowledge base (RAG schema) to be seeded with regulatory documents. Initial seeding is a Phase 3a prerequisite.
- Adverse action notice content (COMPLIANCE-01) uses the compliance checker's `adverseActionReasons` output.
- Cross-reference: PIPE-08 (PII redaction), PIPE-09 (audit), PIPE-10 (parallel execution), KB-01 (knowledge base).

---

### PIPE-06: Confidence Aggregation and Routing

**As a** system, **I must** aggregate confidence scores from all agents and apply routing rules (fraud -> escalate, conflict -> escalate, low confidence -> escalate, high confidence -> auto-approve), **so that** applications are routed correctly.

**Priority:** P0 | **Phase:** 2 (basic routing with credit + document agents), Phase 3a (full routing with all agents)

#### Acceptance Criteria

**AC-1: Routing rules applied in priority order**
- **Given** all analysis agents have completed and their results are in the graph state
- **When** the aggregator node executes
- **Then** the following routing rules are applied in strict priority order:
  1. **Fraud flag:** If any agent has flagged fraud indicators, routing is `fraud_flag` regardless of confidence scores. Application transitions to `awaiting_review`. (Phase 4 for fraud detector agent; in Phase 2-3, fraud flags can only come from manual flag or future agent.)
  2. **Agent conflict:** If any two agents produce different `recommendation` values (e.g., credit says `approve`, risk says `deny`), routing is `escalate` (conflict). Application transitions to `awaiting_review`.
  3. **Low confidence:** If the minimum confidence score across all agents is below the configurable low-confidence threshold (default: <0.60), routing is `escalate` (low confidence). Application transitions to `awaiting_review`.
  4. **Medium confidence:** If the minimum confidence score is between the low and high thresholds (default: 0.60-0.85), routing is `escalate` (medium confidence). Application transitions to `awaiting_review`.
  5. **High confidence, no conflicts:** If all agents have confidence >= the auto-approve threshold (default: >=0.85) and all recommendations agree, routing is `auto_approve`. Application transitions to `approved`.

**AC-2: Thresholds loaded from database**
- **Given** the confidence thresholds are stored in the `confidence_thresholds` table
- **When** the aggregator node initializes
- **Then** it loads the current active thresholds from the database (not hardcoded values), and uses them for routing decisions

**AC-3: Audit event for routing decision**
- **Given** any routing decision
- **When** the aggregator completes
- **Then** an audit event of type `routing_decision` is recorded with: the aggregated confidence score, the routing outcome (`auto_approve`, `escalate_medium`, `escalate_low`, `escalate_conflict`, `fraud_flag`), the per-agent confidence scores and recommendations, and the thresholds used

**AC-4: Auto-approve state transition**
- **Given** routing result is `auto_approve`
- **When** the routing is applied
- **Then** the application status transitions from `processing` to `approved`, an audit event of type `state_transition` is recorded, and the workflow terminates

**AC-5: Escalation state transition**
- **Given** routing result is `escalate` (any subtype) or `fraud_flag`
- **When** the routing is applied
- **Then** the application status transitions from `processing` to `awaiting_review`, an audit event of type `state_transition` is recorded with the escalation reason, and the application appears in the review queue (REV-01)

**AC-6: Routing with partial agent results**
- **Given** an optional agent (e.g., fraud detector) failed but required agents completed
- **When** the aggregator evaluates
- **Then** routing proceeds using available agent results, the missing agent is noted in the audit event, and confidence is adjusted downward to reflect incomplete analysis

**AC-7: Checkpoint after routing**
- **Given** the routing decision has been made
- **When** the aggregator node completes
- **Then** the graph state is checkpointed with the routing decision

#### Notes
- Default thresholds: >=0.85 auto-approve, 0.60-0.85 medium (escalate), <0.60 low (escalate). These are configurable via THRESHOLD-01/02 (Chunk 8).
- The aggregator node is deterministic logic, not an LLM call.
- Cross-reference: APP-05 (status transitions), REV-01 (review queue), PIPE-09 (audit), PIPE-07 (checkpoint).

---

### PIPE-07: Workflow State Checkpointing

**As a** system, **I must** checkpoint workflow state after every agent execution, **so that** in-progress workflows survive service restarts without data loss.

**Priority:** P0 | **Phase:** 1

#### Acceptance Criteria

**AC-1: Checkpoint after every node**
- **Given** a LangGraph node (any agent or aggregator) completes execution
- **When** the node returns its result
- **Then** LangGraph's PostgresSaver automatically checkpoints the full graph state (all accumulated agent results, current step, errors, routing decision) to the `langgraph` schema

**AC-2: Resume from last checkpoint after restart**
- **Given** the service is restarted while a workflow is in progress (e.g., document processing completed, credit analysis in progress)
- **When** the service recovers and the workflow is re-invoked with the same `application_id` (= LangGraph `thread_id`)
- **Then** the workflow resumes from the last completed node, previously completed agent results are not re-executed, and the application continues processing from where it left off

**AC-3: Parallel agent checkpoint integrity**
- **Given** multiple agents are running in parallel (credit, risk, compliance)
- **When** one agent completes and the service crashes before the others complete
- **Then** on restart, the completed agent's result is preserved in the checkpoint, and only the incomplete agents re-execute

**AC-4: Checkpoint cleanup for terminal workflows**
- **Given** a workflow has reached a terminal state (`approved`, `denied`, `withdrawn`)
- **When** the checkpoint is older than 30 days
- **Then** a daily cleanup process removes the checkpoint from the `langgraph` schema to prevent unbounded storage growth

**AC-5: Checkpoint does not contain plaintext PII**
- **Given** the graph state includes references to application data
- **When** the state is checkpointed
- **Then** the checkpoint does not contain plaintext PII fields (SSN, account numbers, government IDs). Application data in the graph state uses references (application_id, document_id) rather than embedding full PII values.

#### Notes
- Checkpointing is provided by LangGraph's PostgresSaver -- this is infrastructure configuration, not custom code.
- The `application_id` is used as the LangGraph `thread_id` (CHECKPOINT-02).
- Cross-reference: CHECKPOINT-01/02/03 (Chunk 1 infrastructure), APP-07 (retry from checkpoint).

---

### PIPE-08: PII Redaction Before LLM Calls

**As a** system, **I must** redact PII (SSN, account numbers, government IDs) from all data sent to external LLM APIs, **so that** sensitive data is protected.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: PII redacted from text prompts**
- **Given** any agent preparing a prompt for an external LLM (Claude or GPT-4 Vision)
- **When** the prompt includes structured data fields that may contain PII
- **Then** the PII redaction service replaces SSN values with `[SSN_REDACTED]`, account numbers with `[ACCOUNT_REDACTED]`, government IDs with `[GOVT_ID_REDACTED]`, and full names associated with financial data with `[NAME_REDACTED]` before the LLM call is made

**AC-2: Redaction token mapping maintained**
- **Given** PII has been redacted from the prompt
- **When** the LLM returns a response referencing redaction tokens
- **Then** the agent can re-associate the tokens with the original field paths (not values) for result interpretation

**AC-3: Redaction is mandatory for all agents**
- **Given** any LLM-calling agent in the loan processing graph
- **When** the agent prepares data for the LLM
- **Then** the PII redaction service is invoked as a required step (step 2 of the 7-step pattern). An agent that skips redaction fails validation.

**AC-4: PII field registry**
- **Given** the PII redaction service
- **When** it processes structured data
- **Then** it identifies PII fields by both field name patterns (e.g., `ssn`, `social_security`, `account_number`, `government_id`) and a configurable field registry, so that new PII fields can be added without code changes

**AC-5: Redaction does not corrupt non-PII data**
- **Given** structured data containing both PII and non-PII fields (income amounts, property addresses, loan terms)
- **When** the redaction service processes the data
- **Then** non-PII fields pass through unchanged, and the redacted output is a valid structure that the LLM can interpret

**AC-6: PII not present in logs**
- **Given** any agent processing that involves PII
- **When** log entries are generated during the process
- **Then** PII values are masked in all log output (e.g., SSN: `"***-**-1234"`, account numbers: `"****1234"`)

#### Notes
- Document images sent to GPT-4 Vision for classification/extraction are the raw document; PII redaction applies to the structured text context in the prompt, not to document image pixels.
- Cross-reference: PII-01 through PII-04 (Chunk 1 infrastructure), PIPE-01 through PIPE-05 (all agents use redaction).

---

### PIPE-09: Audit Event for Every Agent Decision

**As a** system, **I must** record an audit event for every agent decision with confidence score, reasoning, input data hash, and timestamp, **so that** the audit trail is complete.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Audit event recorded for each agent execution**
- **Given** any agent in the pipeline completes execution (success or failure)
- **When** the agent returns its result
- **Then** an audit event of type `agent_decision` is recorded in the `audit_events` table with:
  - `application_id`: the application being processed
  - `agent_name`: the name of the agent (e.g., `document_processor`, `credit_analyst`, `risk_assessor`, `compliance_checker`)
  - `confidence_score`: the agent's confidence (numeric, 0.0-1.0)
  - `reasoning`: the agent's plain-language reasoning
  - `input_data_hash`: SHA-256 hash of the input data sent to the agent (after PII redaction)
  - `actor_type`: `"agent"`
  - `actor_id`: the agent name
  - `metadata`: JSONB containing the agent's recommendation, analysis pass number, and any additional context
  - `correlation_id`: the request correlation ID propagated through the workflow
  - `prev_event_hash`: hash chain linking to the previous audit event for this application

**AC-2: Audit event on agent failure**
- **Given** an agent fails (LLM error, parsing error, validation error)
- **When** the failure is recorded
- **Then** an audit event is recorded with `confidence_score: null`, reasoning describing the failure, and `metadata` containing error details (not including raw LLM responses or stack traces)

**AC-3: Audit events are immutable**
- **Given** any recorded agent decision audit event
- **When** any attempt is made to update or delete it
- **Then** the database rejects the operation (enforced by INSERT-only permissions and trigger guard as specified in AUDIT-03)

**AC-4: Hash chain continuity during parallel execution**
- **Given** multiple agents completing in parallel (credit, risk, compliance)
- **When** their audit events are recorded
- **Then** the advisory lock mechanism serializes the audit inserts per application, maintaining a linear hash chain even during concurrent execution

**AC-5: Audit event for routing decision**
- **Given** the aggregator/router completes
- **When** the routing decision is made
- **Then** an audit event of type `routing_decision` is recorded with the aggregated confidence, routing outcome, per-agent scores, and thresholds used (this is separate from individual agent audit events)

#### Notes
- The input data hash ensures that the exact data the agent received is cryptographically referenced, enabling verification that the agent's reasoning matches its inputs.
- Cross-reference: AUDIT-01/02/03 (Chunk 1 audit infrastructure), PIPE-07 (checkpoint).

---

### PIPE-10: Parallel Agent Execution

**As a** system, **I must** run credit analysis, risk assessment, and compliance checking in parallel after document processing completes, **so that** workflows are efficient.

**Priority:** P0 | **Phase:** 2 (credit + document processing), Phase 3a (all three in parallel)

#### Acceptance Criteria

**AC-1: Progressive fan-out after document processing**
- **Given** all documents in the application have been processed (classified and extracted) by the document processor agent
- **When** the document processing node completes
- **Then** the LangGraph graph fans out according to the current phase implementation:
  - **Phase 2:** Only the credit analyst agent is executed after document processing
  - **Phase 3a:** The fan-out expands to run credit analyst, risk assessor, and compliance checker concurrently
- All agents receive the same graph state snapshot containing the document extraction results and application record data
- The aggregator node (PIPE-06) handles partial agent result sets via AC-6 in Phase 2, then receives all three agent results in Phase 3a

**AC-2: Fan-in after all parallel agents complete**
- **Given** all parallel agents (credit, risk, compliance) have completed
- **When** the last parallel agent returns its result
- **Then** the graph fans in to the aggregator/router node, which receives the combined results of all parallel agents in the graph state

**AC-3: Partial failure in parallel agents**
- **Given** one parallel agent fails while others succeed
- **When** the fan-in occurs
- **Then** the aggregator receives the successful results and the failure indication, and applies routing rules accordingly:
  - If the failed agent is a required agent (credit analyst, risk assessor): the workflow transitions to `processing_error`
  - If the failed agent is an optional agent (fraud detector in Phase 4): the workflow continues with available results, noting the missing analysis

**AC-4: Independent agent execution**
- **Given** the parallel agents are executing
- **When** each agent calls its LLM
- **Then** each agent's LLM call is independent -- one agent's slow response does not block or affect other agents' execution

**AC-5: Checkpoint preservation during parallel execution**
- **Given** agents are running in parallel
- **When** the service crashes after some agents have completed but before all finish
- **Then** on restart, agents that completed before the crash have their results preserved in the checkpoint, and only incomplete agents re-execute

**AC-6: Audit events are recorded for each parallel agent independently**
- **Given** three agents completing in parallel
- **When** each agent records its audit event
- **Then** each agent's audit event is recorded independently (serialized by the advisory lock), and the hash chain is maintained correctly

#### Notes
- In Phase 2, only credit analyst and document processor are available; risk assessor and compliance checker are added in Phase 3a. The parallel fan-out structure is built in Phase 2 and extended in Phase 3a.
- The LangGraph `StateGraph` handles parallel execution natively when multiple edges leave a single node.
- Cross-reference: PIPE-03 (credit), PIPE-04 (risk), PIPE-05 (compliance), PIPE-07 (checkpoint), PIPE-09 (audit).

---

## Human Review (REV)

### REV-01: Role-Filtered Review Queue

**As a** loan officer or senior underwriter, **I want** to see a review queue filtered by my role (loan officers see medium-confidence only, senior underwriters see all escalations), **so that** I review only applications I'm authorized to decide.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Loan officer sees medium-confidence escalations only**
- **Given** an authenticated user with role `loan_officer`
- **When** they send a GET request to `/v1/review-queue`
- **Then** the system returns 200 with a paginated list of applications where:
  - Status is `awaiting_review`
  - Escalation reason is `escalate_medium` (confidence between 0.60 and 0.85)
  - Fraud-flagged applications are NOT included
  - Conflict-escalated applications are NOT included
  - Low-confidence escalations are NOT included
  - Results are sorted by escalation time ascending (oldest first, so longest-waiting applications are reviewed first)
  - Each item includes: application ID, borrower name, loan amount (string decimal), escalation reason, aggregated confidence score, escalation timestamp, and time in queue

**AC-2: Senior underwriter sees all escalations including fraud and conflict**
- **Given** an authenticated user with role `senior_underwriter`
- **When** they send a GET request to `/v1/review-queue`
- **Then** the system returns all applications with status `awaiting_review` regardless of escalation reason (medium confidence, low confidence, fraud-flagged, conflict-escalated), sorted by escalation time ascending (oldest first)

**AC-3: Reviewer sees all escalations plus audit views**
- **Given** an authenticated user with role `reviewer`
- **When** they send a GET request to `/v1/review-queue`
- **Then** the system returns all applications with status `awaiting_review` (same as senior underwriter), sorted by escalation time ascending

**AC-4: Empty review queue**
- **Given** no applications in `awaiting_review` status (or none matching the role's visibility)
- **When** the user requests the review queue
- **Then** the system returns 200 with `{ "data": [], "pagination": { "hasMore": false } }`

**AC-5: Pagination**
- **Given** more applications in the review queue than the page limit
- **When** the user paginates through results using cursor-based pagination
- **Then** results are consistent and ordered by escalation time ascending

**AC-6: Filtering by escalation reason**
- **Given** a senior underwriter or reviewer viewing the review queue
- **When** they send a GET request with `?escalationReason=fraud_flag`
- **Then** only fraud-flagged applications are returned (within their role's visibility scope)

**AC-7: Unauthorized access**
- **Given** a request without valid authentication
- **When** they attempt to access the review queue
- **Then** the system returns 401

#### Notes
- The review queue is a read-only projection over applications. It does not duplicate data.
- Role-based filtering is enforced at the API level (server-side), not the UI level.
- Cross-reference: AUTH-05 (RBAC), PIPE-06 (routing populates the queue), APP-05 (status model).

---

### REV-02: View Escalated Application with Agent Analyses

**As a** reviewer, **I want** to open an escalated application and see all agent analyses side by side (extracted data, credit summary, risk metrics, compliance results) with confidence scores and reasoning, **so that** I can make an informed decision.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Complete agent analysis display**
- **Given** an authenticated reviewer (any role authorized to see the application in the review queue)
- **When** they send a GET request to `/v1/applications/:id/analyses`
- **Then** the system returns 200 with `{ "data": { ... } }` containing:
  - `analysisPass`: the current analysis pass number
  - `documentExtractions`: array of document extraction results (one per document), each with document type, extracted fields, per-field confidence scores
  - `creditAnalysis`: the credit analyst's result (credit score assessment, payment history, derogatory marks, trend, recommendation, confidence, reasoning)
  - `riskAssessment`: the risk assessor's result (DTI, LTV, employment stability, overall risk score, component breakdown, recommendation, confidence, reasoning)
  - `complianceCheck`: the compliance checker's result (compliance status, permitted factors, prohibited factors detected, regulatory citations, adverse action reasons, recommendation, confidence, reasoning)
  - `aggregatedConfidence`: the overall confidence score
  - `routingDecision`: the routing outcome and reason
  - `escalationReason`: why this application was escalated (medium confidence, low confidence, conflict, fraud flag)
  All monetary values are string decimals. PII fields are masked.

**AC-2: Confidence scores and reasoning visible for each agent**
- **Given** the analysis display
- **When** the reviewer examines any agent's result
- **Then** each agent's section includes a numeric confidence score (0.0-1.0), a plain-language reasoning summary, and the recommendation (approve/deny/review)

**AC-3: Application not in review queue**
- **Given** an application that is not in `awaiting_review` status
- **When** the user requests the analyses endpoint
- **Then** the system returns the analyses if they exist (for historical review), but the application is not actionable (approve/deny endpoints will reject non-awaiting_review applications)

**AC-4: Missing analyses (Phase 2 with partial agents)**
- **Given** an application processed in Phase 2 where only document processing and credit analysis are available
- **When** the reviewer views the analyses
- **Then** the response includes the available analyses (document extraction, credit analysis) and `null` for unavailable analyses (risk assessment, compliance check), with a clear indication that those analyses are not yet available

**AC-5: Authorization -- role-appropriate access**
- **Given** a `loan_officer` attempting to view an application they are not authorized to see (e.g., fraud-flagged)
- **When** they request the analyses
- **Then** the system returns 404 (consistent with role-based visibility from REV-01)

#### Notes
- This endpoint provides the data that the review UI displays side-by-side. The UI layout is a frontend concern; this story defines the API response structure.
- Cross-reference: PIPE-01 through PIPE-06 (agent results), APP-03 (application detail).

---

### REV-03: Approve an Escalated Application

**As a** reviewer, **I want** to approve an escalated application with rationale, **so that** it moves to approved status.

**Priority:** P0 | **Phase:** 2

#### Acceptance Criteria

**AC-1: Successful approval**
- **Given** an authenticated reviewer authorized to review the application (role-based: loan_officer for medium-confidence, senior_underwriter+ for all), and the application is in `awaiting_review` status
- **When** they send a PATCH request to `/v1/applications/:id/review` with `{ "decision": "approved", "rationale": "Income verified across multiple documents. DTI within acceptable range at 38%. Credit score strong at 740." }`
- **Then** the system transitions the application from `awaiting_review` to `approved`, creates a `review_actions` record with the reviewer's API key ID, decision, rationale, and timestamp, records an audit event of type `human_review` with reviewer identity, role, decision, rationale, correlation ID, and timestamp, and returns 200 with the updated application

**AC-2: Rationale is required**
- **Given** a reviewer attempting to approve an application
- **When** they submit the request without a `rationale` field or with an empty rationale
- **Then** the system returns 422 with an RFC 7807 error response stating that rationale is required for all review decisions

**AC-3: Application not in awaiting_review status**
- **Given** an application that is not in `awaiting_review` status
- **When** the reviewer attempts to approve it
- **Then** the system returns 409 (Conflict)

**AC-4: Role authorization for approval**
- **Given** a `loan_officer` attempting to approve an application that was escalated due to fraud flag or conflict (not medium-confidence)
- **When** they submit the approval
- **Then** the system returns 403 with an RFC 7807 error stating that they are not authorized to review this escalation type

**AC-5: Concurrent review prevention**
- **Given** an application in `awaiting_review` status
- **When** two reviewers simultaneously submit different decisions
- **Then** exactly one decision is applied, and the other receives 409 (Conflict)

#### Notes
- The rationale requirement ensures that human decisions are explainable and auditable, matching the same standard applied to agent decisions.
- Cross-reference: APP-05 (status transition), AUDIT-02 (human review audit event), REV-01 (role-based access).

---

### REV-04: Deny an Escalated Application

**As a** reviewer, **I want** to deny an escalated application with rationale, **so that** it moves to denied status and denial coaching is triggered.

**Priority:** P0 | **Phase:** 2 (denial), Phase 4 (denial coaching trigger)

#### Acceptance Criteria

**AC-1: Successful denial**
- **Given** an authenticated reviewer authorized to review the application, and the application is in `awaiting_review` status
- **When** they send a PATCH request to `/v1/applications/:id/review` with `{ "decision": "denied", "rationale": "DTI ratio of 52% exceeds maximum threshold of 43%. Significant derogatory marks on credit report including recent collections." }`
- **Then** the system transitions the application from `awaiting_review` to `denied`, creates a `review_actions` record with the reviewer's API key ID, decision, rationale, and timestamp, records an audit event of type `human_review` with reviewer identity, role, decision, rationale, correlation ID, and timestamp, and returns 200 with the updated application

**AC-2: Rationale is required**
- **Given** a reviewer attempting to deny an application
- **When** they submit the request without a `rationale` field or with an empty rationale
- **Then** the system returns 422 with an RFC 7807 error response stating that rationale is required

**AC-3: Denial rationale must cite specific factors**
- **Given** a reviewer denying an application
- **When** they submit the rationale
- **Then** the system accepts any non-empty rationale (enforcement of specific factor citation is a UX concern, not an API validation -- the compliance checker's adverse action reasons serve as guidance for the reviewer)

**AC-4: Denial triggers denial coaching (Phase 4)**
- **Given** an application has been denied by a reviewer
- **When** the denial is recorded (Phase 4 and later)
- **Then** the denial coach agent is triggered asynchronously to generate improvement recommendations, which are stored and associated with the application for retrieval

**AC-5: Application not in awaiting_review status**
- **Given** an application not in `awaiting_review` status
- **When** the reviewer attempts to deny it
- **Then** the system returns 409 (Conflict)

**AC-6: Role authorization for denial**
- **Given** a `loan_officer` attempting to deny an application that was escalated due to fraud flag or conflict
- **When** they submit the denial
- **Then** the system returns 403 (same role restriction as approval in REV-03 AC-4)

**AC-7: Denied is a terminal state**
- **Given** an application that has been denied
- **When** any further status transition is attempted
- **Then** the system returns 409 (Conflict) -- denied applications cannot be re-opened

#### Notes
- In Phase 2, denial is a terminal action. In Phase 4, denial coaching (PIPE-12) adds actionable improvement recommendations.
- The adverse action notice (COMPLIANCE-01) draws from both the compliance checker's output and the reviewer's denial rationale.
- Cross-reference: APP-05 (terminal state), AUDIT-02 (human review audit), COMPLIANCE-01 (adverse action notice), PIPE-12 (denial coaching, Phase 4).

---

## Complete Data Flow: Happy Path (Flow 1 from Product Plan)

This section traces the complete data flow for a successful loan application processed through the multi-agent pipeline, cross-referencing each step to the stories above.

1. **Maria authenticates** with her `loan_officer` API key (AUTH-01, AUTH-05)
2. **Create application** -- POST `/v1/applications` with borrower info and loan terms. Application created in `draft` status. SSN encrypted at rest. Audit event: `state_transition (null -> draft)`. (APP-01)
3. **Upload documents** -- POST `/v1/applications/:id/documents` (multipart) for each document. File validated for type (magic bytes) and size (<20MB). Stored in MinIO with UUID key + SSE. Document record created with `processing_status: pending`. Audit event: `document_upload`. (DOC-01, DOC-02)
4. **Submit application** -- PATCH `/v1/applications/:id` with `status: submitted`. Transitions to `submitted` then `processing`. Audit events for both transitions. Background workflow invocation enqueued. (APP-04, APP-05)
5. **Document Processing** -- For each document: fetch from MinIO, classify type via GPT-4 Vision (PII redacted from prompt context), extract structured data with per-field confidence, update document record. Checkpoint after completion. Audit event per document. (PIPE-01, PIPE-02, PIPE-08, PIPE-09, PIPE-07)
6. **Parallel Fan-Out** -- Credit analyst, risk assessor, and compliance checker run concurrently. Each follows the 7-step pattern. Each records agent_decision audit event. Each checkpointed. (PIPE-03, PIPE-04, PIPE-05, PIPE-10, PIPE-07, PIPE-08, PIPE-09)
7. **Aggregation + Routing** -- Aggregator loads thresholds from DB, evaluates routing rules in priority order. Records routing_decision audit event. Checkpoint. (PIPE-06, PIPE-07, PIPE-09)
8. **Route A: Auto-Approve** -- All confidence >=0.85, no conflicts. Application status -> `approved`. Audit event: `state_transition (processing -> approved)`. (PIPE-06 AC-4, APP-05)
9. **Route B: Escalate** -- Confidence below threshold or conflict detected. Application status -> `awaiting_review`. Appears in review queue filtered by role. (PIPE-06 AC-5, REV-01)
10. **Human Review** -- Reviewer opens application, sees all agent analyses side by side. Makes decision with rationale. (REV-02, REV-03 or REV-04)
11. **Approve** -- Status -> `approved`. Review action recorded. Audit event: `human_review`. (REV-03, APP-05)
12. **Deny** -- Status -> `denied`. Review action recorded. Audit event: `human_review`. Denial coaching triggered (Phase 4). (REV-04, APP-05, PIPE-12)

---

## Architecture Consistency Notes

During the writing of these requirements, the following observations were made about the upstream documents:

1. **Review queue sorting confirmed:** The assignment specified "sort by escalation time (oldest first)." This is consistent with the architecture's index on `loan_applications (status, created_at)` but requires an additional column or derived value for "escalation time" (the timestamp when the application entered `awaiting_review`). The `updated_at` column on `loan_applications` serves this purpose since the transition to `awaiting_review` updates it. This should be confirmed in the Technical Design.

2. **Document upload status constraint:** The requirements specify that documents can only be uploaded to `draft` applications (DOC-01 AC-3). Phase 4 extends this to `awaiting_documents` status (REV-05/REV-06). The architecture's data flow (step 2) shows uploads happening after creation but before submission, which is consistent.

3. **Fraud flag routing in Phase 2:** PIPE-06 AC-1 rule 1 references fraud flags, but the fraud detector agent (PIPE-11) is Phase 4. In Phases 2-3, fraud flags can only arise if manually injected into seed data or if a future mechanism is added. The routing rule should be present from Phase 2 (it is simple conditional logic) even though no agent produces fraud flags until Phase 4.

4. **Compliance checker parallel timing:** The architecture shows compliance checker running in parallel with credit and risk, but PIPE-05 AC-1 states it uses "all agent results." If it runs truly in parallel, it would not have credit/risk results. The architecture's graph structure confirms parallel execution, so the compliance checker should use document extraction results and any data available from the application record -- not the credit/risk agent outputs. Its check is primarily about fair lending factors and regulatory compliance of the decision factors themselves. The full aggregation of all results happens in the aggregator node (PIPE-06). This interpretation is consistent with the architecture diagram. The Technical Design should clarify the exact inputs available to the compliance checker at execution time.

---

## Open Questions

1. **Escalation timestamp tracking:** Should the system track a dedicated `escalated_at` timestamp for review queue sorting, or is `updated_at` on the application record sufficient? Using `updated_at` is simpler but could be overwritten by other updates if they occur while in `awaiting_review` status.

2. **Document upload limit per application:** Is there a maximum number of documents that can be uploaded to a single application? The requirements do not specify a cap. For an MVP, a reasonable default (e.g., 25 documents) would prevent abuse.

3. **Reviewer self-review prevention:** Can the loan officer who created and submitted an application also review it if it is escalated to the review queue? In production lending, this would typically be prohibited (separation of duties). For MVP/quickstart purposes, this constraint may be relaxed.

---

## Assumptions

1. The application ID used as the LangGraph thread ID is a UUID, ensuring uniqueness and compatibility with both systems.
2. The `processing_error` -> `processing` retry transition (APP-07) uses the same analysis pass number; the `analysis_pass` is only incremented on document resubmission (Phase 4).
3. The credit bureau mock is deterministic per application ID, enabling reproducible test scenarios.
4. Phase 2 delivers the minimal review queue (approve/deny only). Request-additional-documents is Phase 4 (REV-05/REV-06).
5. The compliance checker in Phase 3a evaluates fair lending compliance based on document extraction data and the application record, not on the credit/risk agent outputs (which may not be available at the time of parallel execution).
