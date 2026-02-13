<!-- This project was developed with assistance from AI tools. -->

# Security Review: Technical Design - Phase 1

**Reviewer:** Security Engineer
**Date:** 2026-02-12
**Document Version:** 1.0
**Verdict:** CONDITIONAL APPROVE

## Summary

Phase 1 establishes a strong security foundation with several exemplary patterns for a regulated-industry application handling PII. The three-level audit trail immutability, server-side role mapping, and fail-closed PII handling demonstrate appropriate security rigor for the domain. However, the design contains six findings that must be addressed before implementation begins, primarily around key management operational security, input validation gaps, and PII leakage vectors in validation errors and LangGraph state.

**Overall Security Posture:** Strong authentication and authorization foundation, exemplary audit trail design, appropriate encryption selection. Key weaknesses are operational security guidance for secrets and several subtle PII leakage paths.

**Blocking Issues:** 2 Critical findings (SSN encryption key management, PII in validation errors)
**Recommended Fixes:** 4 Warning findings (LangGraph state PII, file path validation, API key entropy, LangFuse PII leakage)
**Positive Patterns:** 3 strengths highlighted

---

## Findings by Security Domain

### 1. Secrets Management

#### Finding SEC-01: Missing SSN Encryption Key Operational Security Guidance
**Severity:** CRITICAL
**Affected WUs:** P1-WU01 (.env.example), P1-WU09 (Settings), P1-WU14 (SSN encryption), P1-WU24 (README)
**Location:**
- `plans/technical-design-phase-1.md` Section 2.7 (Settings)
- `plans/technical-design-phase-1.md` Section 3.1 (Work Unit descriptions)

**Description:**
The TD specifies `SSN_ENCRYPTION_KEY` as a required environment variable with base64 encoding and validates it is at least 32 bytes after decoding. However, it provides no guidance on:

1. **Key generation:** How should developers generate the key? What entropy source? What format? The `.env.example` creation (WU01) is specified to include a "placeholder" for the key, but no generation command.
2. **Key rotation:** How should the key be rotated? The encrypted SSNs in the database cannot be decrypted if the key changes without a migration path.
3. **Production key management:** The design does not address whether production keys should be in environment variables (acceptable for MVP but not for mature production) or migrated to a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.).
4. **Operational security:** No guidance on who has access to the key, how it is transmitted to deployment environments, or how to handle key compromise.

**Impact:**
Developers will generate weak keys (e.g., manually typed base64 strings with low entropy) or reuse keys across environments. If the key is compromised and there is no rotation process, all historical SSNs are exposed with no remediation path.

**Recommended Action:**
1. Add a subsection to Section 2.7 (Settings) titled "SSN Encryption Key Management" with:
   - Key generation command: `openssl rand -base64 32` or equivalent with explanation of why this provides 256 bits of entropy.
   - Environment-specific key requirement: Different keys for dev, staging, production. Never reuse keys across environments.
   - Rotation strategy: Note that key rotation requires a data migration (dual-key decryption period or one-time bulk re-encryption). Defer implementation to post-MVP but document the constraint.
   - Production hardening note: Recommend migrating to a secrets manager post-MVP; document environment variable as acceptable for MVP only.
2. Update WU01 `.env.example` to include the generation command in a comment.
3. Update WU24 README to include key generation as part of the quickstart setup.

---

#### Finding SEC-02: Default API Keys Lack Sufficient Entropy Guidance
**Severity:** WARNING
**Affected WUs:** P1-WU05 (seed data migration)
**Location:** Section 2.9 (Seed Data), WU05 description

**Description:**
The seed data migration (WU05) creates three default API keys with the format `mq_{role}_dev_key_do_not_use_in_production_{n}`. These keys are well-marked as development-only and the startup warning (US-060) correctly flags them. However, the TD does not specify:

1. **Key generation for non-default keys:** How should production API keys be generated? What entropy source? What length?
2. **Format specification:** The default keys appear to be human-readable strings (based on the examples in exit conditions). Production keys should be cryptographically random, not patterned strings.

**Impact:**
When developers generate production keys (Phase 2+), they may follow the patterned format from the seed keys instead of using cryptographic random generation. This results in predictable keys.

**Recommended Action:**
1. Add a note to Section 2.9 (Seed Data) that production API keys must be generated via `openssl rand -hex 32` or equivalent (64-character hex string = 256 bits entropy).
2. Add a comment in WU05 migration that the default keys use a readable format for developer convenience but production keys must be randomly generated.
3. Consider adding a key generation endpoint in Phase 2 (`POST /v1/admin/keys`) that internally uses a CSPRNG, eliminating developer key generation entirely.

---

### 2. PII Handling

#### Finding SEC-03: SSN May Leak in Validation Error Responses
**Severity:** CRITICAL
**Affected WUs:** P1-WU16 (application CRUD routes), P1-WU08 (schemas)
**Location:**
- Section 2.2 (Pydantic schemas, `ValidationErrorItem`)
- Section 2.8 (Error classes)
- WU16 description (POST /v1/applications)

**Description:**
The `ValidationErrorItem` schema includes a `value` field with the note "Set to '[REDACTED]' for PII fields". However:

1. **No implementation guidance:** The TD does not specify HOW to implement this redaction. Pydantic's default `RequestValidationError` serialization includes the invalid value. A custom exception handler is needed but not specified.
2. **Field identification:** How does the error handler know which fields contain PII? The schema does not define a list of PII field names.
3. **Partial SSN exposure:** If the SSN validation fails (e.g., user submits "123-45-678" - only 8 digits), the error response would include the partial SSN in the `value` field unless explicitly redacted.

**Example vulnerable response:**
```json
{
  "type": "validation-error",
  "title": "Validation Error",
  "status": 422,
  "errors": [
    {
      "field": "ssn",
      "message": "SSN must be 9 digits",
      "value": "123-45-678"   // <-- PII LEAK
    }
  ]
}
```

**Impact:**
Malformed SSNs (partial, typos) are logged in application logs and returned to clients in error responses. This violates PII handling requirements.

**Recommended Action:**
1. Add a work unit (insert between WU09 and WU10) for a custom Pydantic exception handler:
   - Define a set of PII field names: `PII_FIELDS = {"ssn", "taxpayer_id", "account_number"}` (extend as needed).
   - Override FastAPI's `RequestValidationError` handler to replace `value` with `"[REDACTED]"` for any error where `field` matches a PII field.
2. Update WU19 (app factory) to register this exception handler.
3. Add a test case in WU23 (integration test) that submits an invalid SSN and verifies the error response does not include the SSN value.

---

#### Finding SEC-04: LangGraph State May Contain Unredacted PII
**Severity:** WARNING
**Affected WUs:** P1-WU20 (LangGraph state), P1-WU21 (checkpointer)
**Location:**
- Section 2.6 (LangGraph State Types)
- Architecture Section 5.5 (Checkpoint Strategy)

**Description:**
The `LoanProcessingState` TypedDict includes:

```python
application_id: str
borrower_name: str
loan_amount_cents: int
property_address: str
# ... other fields
```

These fields are serialized into the `checkpoint_blobs` table by LangGraph's PostgresSaver. The state does not include the SSN (positive), but it does include the borrower's name and property address, both of which are PII.

**Analysis:**
- **Is this acceptable?** Yes, for MVP - the checkpoint data is stored in the same database as the application data, so the access control perimeter is the same. However, two concerns:
  1. **Checkpoint retention:** The TD does not specify a retention policy for checkpoints. Old checkpoints may accumulate indefinitely, creating a PII retention compliance risk.
  2. **Checkpoint export/debugging:** If checkpoints are ever exported for debugging (not specified in Phase 1 but likely in later phases), PII in checkpoint blobs becomes an exposure vector.

**Impact:**
PII in checkpoints may violate data retention policies if checkpoints are not pruned. If checkpoint debugging tools are added without PII redaction, developers may inadvertently export PII.

**Recommended Action:**
1. Add a note to Section 2.6 (LangGraph State) that the checkpoint state includes PII (borrower_name, property_address) and must be treated with the same access control as the application table.
2. Add a future work item (post-Phase 1) to implement checkpoint pruning: retain checkpoints for 90 days after application reaches a terminal state (AUTO_APPROVED, HUMAN_APPROVED, HUMAN_DENIED, DENIED).
3. If checkpoint export tooling is added in future phases, require PII redaction in export output.

---

#### Positive SEC-05: SSN Never Returned in API Responses
**Severity:** POSITIVE
**Location:**
- Section 2.2 (`ApplicationResponse` schema comment)
- Architecture Section 4.2 (request/response shapes)
- WU16 description, WU23 integration test

**Description:**
The `ApplicationResponse` schema explicitly excludes the SSN field with the comment "SSN is NEVER included." The architecture reinforces this: "SSN is never returned in any response body. It is accepted on creation, encrypted, and stored. Subsequent reads never include it." The integration test (WU23) includes a check "SSN is not in response body."

**Why This Matters:**
This is the gold standard for handling highly sensitive PII. Many applications return encrypted or hashed PII in responses "for reference," which still creates an attack vector (e.g., enumeration attacks, correlation with other data sources). Complete exclusion from all response paths eliminates this risk.

**Recommendation:**
No action required. Maintain this pattern in all future phases.

---

### 3. Input Validation

#### Finding SEC-06: File Path Traversal Risk in MinIO Storage Key Construction
**Severity:** WARNING
**Affected WUs:** P1-WU15 (MinIO client service), P1-WU17 (document upload route)
**Location:**
- WU15 description: `upload_document()` signature with key format `{application_id}/{document_id}/{filename}`

**Description:**
The MinIO storage key is constructed as `{application_id}/{document_id}/{filename}`. The `filename` comes from user input (multipart upload). If the filename contains path traversal sequences (e.g., `../../etc/passwd` or `..%2F..%2Fetc%2Fpasswd`), the storage key becomes malformed.

**Example attack:**
```
POST /v1/applications/{id}/documents
Content-Disposition: form-data; name="file"; filename="../../../etc/passwd"

Storage key becomes: {application_id}/{document_id}/../../../etc/passwd
```

MinIO's object storage is generally resilient to this (the key is treated as an opaque string, not a file path), but:
1. If MinIO is misconfigured or replaced with a file-system-backed storage, this becomes a path traversal vulnerability.
2. The malformed keys create operational issues (debugging, cleanup).
3. The uploaded filename is stored in the database and may be displayed to users, creating a stored XSS risk if not sanitized in the UI.

**Impact:**
Low likelihood (MinIO's object storage is not vulnerable by default), but high impact if storage backend changes or if filename is rendered unsafely in the UI.

**Recommended Action:**
1. Add filename sanitization to WU15 (`MinioService.upload_document()`):
   - Strip all directory separators: `filename = filename.replace("/", "").replace("\\", "")`
   - Or better: use only the base filename: `filename = os.path.basename(filename)` (import `os`)
   - Limit filename length: max 255 characters.
2. Add a test case in WU17 exit condition that uploads a file with `filename="../test.pdf"` and verifies the stored filename does not contain path separators.

---

#### Finding SEC-07: Missing Request Body Size Limit Enforcement Verification
**Severity:** SUGGESTION
**Affected WUs:** P1-WU19 (app factory), P1-WU17 (document upload)
**Location:**
- Architecture Section 2.1 (middleware stack, position [6])
- WU19 description (create_app factory)

**Description:**
The architecture specifies request size limits:
- JSON request bodies: 1 MB maximum
- File uploads: 10 MB per file
- Multipart requests: 50 MB total

However:
1. **Implementation not specified:** The WU19 description does not mention configuring these limits in FastAPI.
2. **FastAPI default:** FastAPI's default request size limit is 2 MB for non-multipart requests. The 10 MB file upload limit must be explicitly configured.
3. **Enforcement verification:** No test verifies that oversized requests are rejected with 413.

**Impact:**
Without explicit configuration, the limits may not be enforced, allowing potential DoS via large request bodies.

**Recommended Action:**
1. Add to WU19 description: Configure FastAPI's `max_body_size` for the application instance. For multipart file uploads, use Starlette's `max_upload_size` middleware parameter.
2. Add a test case in WU23 (integration test) that attempts to upload an 11 MB file and verifies 413 response.

---

### 4. Authentication and Authorization

#### Positive SEC-08: Server-Side Role Resolution Prevents Privilege Escalation
**Severity:** POSITIVE
**Location:**
- Architecture Section 1.2 (key decisions), Section 6.1 (authentication flow)
- Section 2.5 (middleware contracts)

**Description:**
The authentication middleware extracts the API key, hashes it, and looks up the associated user and role server-side. The role is NOT embedded in the token or asserted by the client. This prevents privilege escalation attacks where a client modifies a token claim to elevate their role.

The TD notes this was a correction from the product plan, which originally specified `Bearer <role>:<key>` format (client-asserted role). The architecture correctly rejected this pattern.

**Why This Matters:**
Client-asserted privilege is a common vulnerability in custom authentication schemes. Many designs trust the client to send their role and only validate token authenticity, allowing an attacker to modify their role claim. Server-side resolution eliminates this vector entirely.

**Recommendation:**
No action required. This is the correct pattern. Maintain it in future phases.

---

### 5. Audit Trail and Logging

#### Positive SEC-09: Three-Level Audit Trail Immutability
**Severity:** POSITIVE
**Location:**
- Architecture Section 3.1 (audit_events table schema with grants)
- Section 2.3 (ORM model with explicit comment about immutability)
- Section 2.4 (AuditRepository with no update/delete methods)
- WU22 (audit immutability test)

**Description:**
The audit trail design enforces immutability at three layers:

1. **Database grants:** `REVOKE UPDATE, DELETE ON audit_events FROM app_role` (enforced in migration WU04)
2. **Application layer:** `AuditRepository` provides only `create()` and `list_by_application()` methods - no `update()` or `delete()` methods exist in the interface contract
3. **API layer:** (implied in architecture, not yet implemented in Phase 1) No PATCH or DELETE endpoints for audit events

Additionally, WU22 creates an integration test that verifies UPDATE and DELETE attempts fail with a permission error.

**Why This Matters:**
This is the gold standard for regulated-industry audit trails. Many applications claim to have "immutable" audit logs but only enforce it at the application layer, allowing a database compromise or misconfigured migration to bypass immutability. Multi-layer enforcement means even a compromised application process or SQL injection cannot modify audit records.

**Recommendation:**
No action required. Maintain this pattern. When adding any new audit-like tables in future phases, apply the same three-layer pattern.

---

### 6. External Service Integration

#### Finding SEC-10: LangFuse May Log PII from LLM Prompts
**Severity:** WARNING
**Affected WUs:** P1-WU01 (.env.example creation), P1-WU24 (README)
**Location:**
- Section 2.7 (Settings, LangFuse configuration)
- WU01 description

**Description:**
LangFuse is an LLM observability platform that traces prompt inputs, completions, and metadata. Section 2.7 includes `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` as optional settings. WU01 specifies that `.env.example` should include a "LangFuse PII warning comment."

However:
1. **Warning content not specified:** What should the warning say? The TD does not provide the warning text.
2. **Severity understated:** LangFuse traces include the full prompt text. If prompts contain PII (e.g., "Analyze this credit application for borrower John Smith, SSN 123-45-6789..."), that PII is sent to LangFuse's servers (external to the application). This is a potential regulatory compliance violation.
3. **No architectural guidance on PII-safe tracing:** The TD does not specify whether prompts should be sanitized before sending to LangFuse, or whether LangFuse should only be enabled for non-PII use cases (e.g., the public intake chatbot, not the loan processing graph).

**Impact:**
If LangFuse is enabled for the loan processing graph, SSNs and borrower names may be transmitted to an external third-party service, violating PII handling policies.

**Recommended Action:**
1. Add a security note to Section 2.7 (Settings):
   - "LangFuse tracing logs full LLM prompts and completions. Do NOT enable LangFuse for workflows that process PII (loan processing graph) unless prompts are sanitized to remove PII before LLM calls. LangFuse is safe for the public intake chatbot (no PII in prompts)."
2. Update WU01 `.env.example` to include this warning as a comment above the LangFuse keys.
3. Add to WU24 README troubleshooting: "LangFuse integration is disabled by default. Enable only for non-PII workflows."

---

### 7. File Upload Security

#### Finding SEC-11: No Explicit PDF Content Validation Beyond Content-Type Header
**Severity:** SUGGESTION
**Affected WUs:** P1-WU17 (document upload route)
**Location:** WU17 description

**Description:**
WU17 specifies validation: "file must be PDF (`application/pdf`), max 10 MB." The content-type validation is based on the `Content-Type` header from the multipart upload.

**Issue:**
The `Content-Type` header is client-asserted and can be forged. An attacker can upload a non-PDF file (e.g., executable, zip bomb, polyglot file) with `Content-Type: application/pdf` and bypass validation.

**Impact:**
- **Phase 1 (stubs):** Low risk - documents are uploaded but not processed by real LLMs or OCR. The malicious file is stored but never opened.
- **Phase 2+ (real document processing):** Medium risk - if the document processing agent attempts to parse a malformed or malicious file, it could trigger vulnerabilities in PDF parsing libraries (e.g., buffer overflows, XXE, zip bombs in embedded attachments).

**Recommended Action:**
1. Add "magic byte" validation to WU17: After reading the uploaded file bytes, check that the first 4 bytes match the PDF header: `%PDF` (hex: `25 50 44 46`). Reject files that do not start with this signature.
2. For production hardening (post-MVP): Add a PDF sanitization step using a library like `pikepdf` to rewrite the PDF and strip potentially malicious embedded objects.

---

## Summary Table

| ID | Severity | Title | Affected WUs | Blocks Phase 1? |
|----|----------|-------|-------------|-----------------|
| SEC-01 | CRITICAL | Missing SSN encryption key operational security guidance | WU01, WU09, WU14, WU24 | YES |
| SEC-02 | WARNING | Default API keys lack sufficient entropy guidance | WU05 | NO |
| SEC-03 | CRITICAL | SSN may leak in validation error responses | WU08, WU16 | YES |
| SEC-04 | WARNING | LangGraph state may contain unredacted PII | WU20, WU21 | NO |
| SEC-05 | POSITIVE | SSN never returned in API responses | WU16, WU23 | N/A |
| SEC-06 | WARNING | File path traversal risk in MinIO storage key construction | WU15, WU17 | NO |
| SEC-07 | SUGGESTION | Missing request body size limit enforcement verification | WU17, WU19, WU23 | NO |
| SEC-08 | POSITIVE | Server-side role resolution prevents privilege escalation | Architecture | N/A |
| SEC-09 | POSITIVE | Three-level audit trail immutability | WU04, WU07, WU22 | N/A |
| SEC-10 | WARNING | LangFuse may log PII from LLM prompts | WU01, WU24 | NO |
| SEC-11 | SUGGESTION | No explicit PDF content validation beyond content-type header | WU17 | NO |

---

## Verdict

**CONDITIONAL APPROVE**

The Phase 1 Technical Design demonstrates strong security fundamentals with several exemplary patterns (three-level audit immutability, server-side role resolution, SSN exclusion from responses). However, two critical findings must be resolved before implementation begins:

1. **SEC-01 (SSN encryption key management):** Add operational security guidance for key generation, rotation, and production handling. This is a foundational security decision that affects all future phases.
2. **SEC-03 (PII in validation errors):** Implement PII redaction in error responses to prevent SSN leakage via malformed input.

The four WARNING findings (SEC-02, SEC-04, SEC-06, SEC-10) should be addressed during Phase 1 implementation but do not block the start of work. The two SUGGESTION findings (SEC-07, SEC-11) are production hardening items that can be deferred to Phase 2.

**Recommended Next Steps:**
1. Tech Lead to revise Section 2.7 (Settings) to add SSN encryption key management subsection per SEC-01.
2. Tech Lead to add a work unit (between WU09 and WU10) for custom Pydantic exception handler per SEC-03.
3. Security Engineer to review the revised sections before WU14 (encryption service) begins implementation.

---

## Security Checklist Status

| Check | Status | Notes |
|-------|--------|-------|
| SSN/sensitive data encryption key management | INCOMPLETE | SEC-01: No operational security guidance |
| PII redaction in ALL output paths | INCOMPLETE | SEC-03: Validation errors not addressed |
| Input validation for external API responses | NOT APPLICABLE | Phase 1 uses stubs; defer to Phase 2 |
| Access control granularity | PASS | Server-side role resolution, RBAC dependency |
| Authentication and authorization reviewed | PASS | SEC-08 positive finding |
| Secrets management | INCOMPLETE | SEC-01: Key management; SEC-02: API key entropy |
| Audit trail immutability | EXEMPLARY | SEC-09: Three-level enforcement |
| Logging excludes PII | PASS | Architecture Section 8.1 compliant |
| File upload validation | INCOMPLETE | SEC-06: Path traversal; SEC-11: Content validation |
| Third-party service PII leakage | INCOMPLETE | SEC-10: LangFuse warning needed |

---

## Appendix: Security Context from Prior Review

This review builds on the architecture security review completed previously. The following decisions from that review remain in effect and are correctly implemented in the Phase 1 TD:

1. **API key authentication with server-side role mapping** (vs. client-asserted roles) - correctly implemented
2. **Audit trail three-level immutability** - correctly specified with integration test
3. **SSN encryption with AES-256-GCM** - algorithm selection correct, operational security guidance missing (SEC-01)
4. **Separate connection pools for LangGraph checkpointer** - correctly specified in WU21

No contradictions or regressions detected from the architecture review.
