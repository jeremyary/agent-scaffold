# Technical Design Phase 1 Review: Orchestrator

**Artifact:** Technical Design Phase 1 (hub + 4 chunks)
**Reviewer:** Orchestrator (main session)
**Date:** 2026-02-16
**Verdict:** REQUEST_CHANGES

## Summary

The Phase 1 TD is a thorough, well-structured greenfield design covering 32 stories across 10 work units. The hub/chunk split is effective, binding contracts are concrete, and the dependency graph is accurate. However, I found several cross-cutting coherence issues that neither the code reviewer nor the security reviewer is scoped to catch individually: a broken handoff between auth dependencies and PII masking middleware, a missing `ProductInfo` TypeScript type, a LangFuse database that will not exist at startup, and the `admin` role absent from the `UserRole` Python enum despite being used by routes and Keycloak. These are not individually catastrophic but compound into integration failures that would emerge only when assembling the full stack -- exactly the orchestrator's concern.

## Findings

### Critical

- **[chunk-auth, line 463 / chunk-auth, line 162-192]** -- **PII masking middleware reads `request.state.user_context` but nothing writes it.** The `PIIMaskingMiddleware` (Starlette `BaseHTTPMiddleware`) reads `user_context` from `request.state` to determine if the current user is a CEO. But the `get_current_user` function is implemented as a FastAPI dependency injected via `Depends()`, not as a middleware that writes to `request.state`. FastAPI dependencies run *inside* the route handler scope; Starlette `BaseHTTPMiddleware` runs *outside* it. The `user_context` will never be on `request.state` when the middleware checks it, so PII masking for the CEO role will silently never activate.
  **Impact:** CEO users receive unmasked PII (SSN, DOB, account numbers) in all API responses. This is a compliance failure that violates REQ-CC-02 and the architecture's "never send unmasked response" guarantee.
  **Suggested Resolution:** Either (a) add a separate Starlette middleware that runs before `PIIMaskingMiddleware` and writes `user_context` to `request.state`, or (b) rewrite `PIIMaskingMiddleware` as a FastAPI response hook/dependency that has access to the resolved `UserContext`, or (c) add an explicit line in the `get_current_user` dependency that sets `request.state.user_context = user`. Option (c) is simplest but requires `get_current_user` to receive and use the `Request` object (which it already does on line 163). Add `request.state.user_context = <resolved context>` before returning from `get_current_user`. The TD already has the `request: Request` parameter -- it just doesn't use it to set state.

- **[hub, line 272-277 / hub, line 253 / hub, line 553-554 / hub, line 1156]** -- **`admin` role missing from `UserRole` enum but used by routes and Keycloak realm.** The API route map specifies `POST /api/admin/seed` requires the `admin` role (line 253). The Keycloak realm defines an `admin` role (line 553). TD-OQ-03 resolves in favor of using a Keycloak `admin` role. But the `UserRole` enum (line 272-277) only defines `prospect`, `borrower`, `loan_officer`, `underwriter`, and `ceo`. The `get_primary_role()` method in `TokenPayload` (line 425-432) matches token roles against `UserRole` values -- an admin user's token will have `realm_access.roles: ["admin"]`, but since `"admin"` is not in the enum, `get_primary_role()` will raise `ValueError("No application role found in token")`, and the user will get a 403.
  **Impact:** The seed endpoint (`POST /api/admin/seed`) becomes unreachable -- the admin user cannot authenticate through the RBAC pipeline. WU-6 (Demo Data Seeding) and WU-9 (Docker Compose full stack) exit conditions will fail.
  **Suggested Resolution:** Add `ADMIN = "admin"` to the `UserRole` enum. Update `require_roles()` usage for the seed endpoint to use `UserRole.ADMIN`. Alternatively, if `admin` should not be a first-class application role, implement a separate authentication path for dev-only endpoints (e.g., API key check).

### Warning

- **[hub, line 497 / chunk-ui file manifest]** -- **`ProductInfo[]` TypeScript type is used but never defined.** The hub's `api-client.ts` (line 497) declares `fetchProducts(): Promise<ProductInfo[]>`, but `ProductInfo` is not defined in `services/types.ts` (lines 438-484). The chunk-ui file manifest does not mention it either. The backend's `public.py` returns `list[dict]` without a Pydantic model. Implementers will hit a TypeScript compilation error.
  **Impact:** WU-8 exit condition (`pnpm exec tsc --noEmit`) will fail until this type is defined. Low severity because it is easily fixable, but it is a contract gap between hub and chunk.
  **Suggested Resolution:** Add a `ProductInfo` interface to `services/types.ts` matching the shape returned by the backend's `PRODUCTS` list (id, name, description, min_down_payment_pct, typical_rate). Optionally add a corresponding `ProductInfo` Pydantic model in the backend for response consistency.

- **[chunk-infra, line 649]** -- **compose.yml uses deprecated `version: "3.8"` key.** The Compose Specification (used by both `docker compose` v2 and `podman-compose`) deprecated the top-level `version` key. While it is silently ignored by modern tooling, it signals outdated Compose knowledge and may confuse developers about which Compose features are available.
  **Impact:** Negligible runtime impact. Minor developer confusion.
  **Suggested Resolution:** Remove the `version: "3.8"` line. The Compose Specification does not require it.

- **[chunk-infra, line 721/746]** -- **LangFuse services reference a `langfuse` database that PostgreSQL will not create.** The compose `postgres` service sets `POSTGRES_DB: summit_cap`, which causes PostgreSQL to create only the `summit_cap` database on first start. LangFuse's `DATABASE_URL` points to `postgres:5432/langfuse` -- a database that will not exist. LangFuse will fail to connect at startup.
  **Impact:** LangFuse will crash-loop on `--profile full` and `--profile observability` stack starts. Since LangFuse is optional (graceful degradation), this does not block the core application, but it breaks observability (F18) integration tests and the WU-5 exit conditions that verify LangFuse connectivity.
  **Suggested Resolution:** Either (a) add a second database creation command to the PostgreSQL init script (`CREATE DATABASE langfuse;`), or (b) add a separate LangFuse-specific PostgreSQL service, or (c) change LangFuse's `DATABASE_URL` to use the `summit_cap` database (but this pollutes the application database with LangFuse tables). Option (a) is simplest -- add `CREATE DATABASE IF NOT EXISTS langfuse;` (PostgreSQL syntax: execute as a psql command in the init script, since `CREATE DATABASE` cannot be inside a transaction).

- **[chunk-infra, line 309-313]** -- **Health endpoint considers only PostgreSQL as "required" for healthy status; Keycloak is omitted.** The `health_check()` function marks the status as "degraded" only if `postgres` is down (line 310-311: `required_down = [svc for svc in ("postgres",) if ...]`). But the architecture (Section 7.2) states Keycloak is "Required" -- if Keycloak is down, authentication fails and the system is non-functional. The health endpoint should reflect this.
  **Impact:** `curl /health` will report "healthy" even when Keycloak is unreachable, misleading health monitoring and the WU-9 exit condition. Downstream services (like a load balancer) would route traffic to a system that cannot authenticate users.
  **Suggested Resolution:** Add `"keycloak"` to the required services tuple: `required_down = [svc for svc in ("postgres", "keycloak") if services.get(svc) == "down"]`.

- **[chunk-ui, line 181]** -- **`silent-check-sso.html` referenced but not in any file manifest.** The Keycloak `initAuth()` function specifies `silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html"`. This file must exist in `packages/ui/public/` (or wherever Vite serves static assets) for silent SSO checks to work. It is not listed in the WU-0 or WU-8 file manifests.
  **Impact:** Keycloak's silent SSO check will fail with a 404, causing unnecessary login redirects on page refresh. Users will be forced to re-authenticate more often than the 8-hour refresh token lifetime allows.
  **Suggested Resolution:** Add `packages/ui/public/silent-check-sso.html` to the WU-8 file manifest. This is a standard Keycloak file containing a minimal HTML page that posts back the auth result.

- **[chunk-auth, line 195-208]** -- **`get_optional_user` passes `request=None` with `# type: ignore`.** The `get_optional_user` function calls `get_current_user(request=None, ...)`, but `get_current_user` may rely on `request` for setting `request.state` or other purposes. The `# type: ignore` suppresses the type checker rather than fixing the interface. If the Critical finding above (setting `request.state.user_context`) is fixed by adding a write to `request.state` inside `get_current_user`, this `None` will cause a runtime `AttributeError`.
  **Impact:** `get_optional_user` will crash at runtime when `get_current_user` tries to access `request.state`, breaking all public routes that use optional authentication.
  **Suggested Resolution:** Pass the actual `Request` object into `get_optional_user` and forward it properly. Add `request: Request` as a parameter to `get_optional_user`.

- **[chunk-data, line 97-101 / chunk-data, line 441]** -- **UUID primary key mixin declares `Mapped[str]` but uses `UUID(as_uuid=True)`.** The `UUIDPrimaryKeyMixin` declares `id: Mapped[str]` with `UUID(as_uuid=True)`. When `as_uuid=True`, SQLAlchemy returns Python `uuid.UUID` objects, not strings. The type annotation `Mapped[str]` is incorrect and will cause type checker confusion. All FK references (e.g., `application_id: Mapped[str]` with `UUID(as_uuid=True)`) have the same issue.
  **Impact:** No runtime error (SQLAlchemy ignores the annotation at runtime), but type checkers will flag mismatches throughout the codebase when comparing UUID columns to `uuid.UUID` values. This will cause persistent type-checking noise across all WUs that touch models.
  **Suggested Resolution:** Change `Mapped[str]` to `Mapped[uuid.UUID]` (import UUID from `uuid`) for all columns using `UUID(as_uuid=True)`. Apply consistently across all model files.

### Suggestion

- **[hub, line 1012-1027]** -- **WU summary table exit conditions are single-line compressed and hard to parse.** The exit conditions in the WU summary table use `and` to chain multiple commands into a single table cell. Some cells (e.g., WU-1) contain 4+ chained commands. This makes it difficult for the Project Manager to verify exit conditions during the work breakdown phase.
  **Suggested Resolution:** Consider reformatting exit conditions as numbered sub-lists within each cell, or reference the chunk file section where the full exit conditions are listed.

- **[hub, line 1018]** -- **WU-0 has no stories listed.** The WU summary table shows WU-0 covers "(infra)" with no story IDs. While bootstrap work is inherently infrastructure, it would aid traceability if a note clarified that WU-0 is a prerequisite for all stories rather than covering specific stories.

- **[chunk-infra, line 519-523]** -- **`openai_api_key="not-needed"` is fragile.** The `create_chat_model` function passes `openai_api_key="not-needed"` as a placeholder. While LlamaStack does not require an API key, some versions of `langchain-openai` may validate this field. A more robust approach would be to use a sentinel value that is clearly intentional (e.g., `"LLAMASTACK_NO_KEY_REQUIRED"`) or suppress the validation.

- **[hub, line 1136-1147]** -- **Inconsistencies TD-I-03 and TD-I-04 deserve explicit WU-level scope notes.** These two inconsistencies (demographic filter without extraction pipeline; agent tool auth without agents) are correctly flagged but the resolutions ("standalone utility module with unit tests" and "authorization framework with unit tests") would benefit from being explicitly called out in the WU descriptions in the chunk files. The chunk-data and chunk-auth files do mention this, but the hub's WU summary table does not flag these as partial implementations.

### Positive

- **[hub, lines 1135-1147]** -- **Proactive requirements inconsistency flagging (TD-I-01 through TD-I-06).** The Tech Lead identified six concrete inconsistencies between the task description and the requirements, documented each with a severity level and a specific recommendation. This is exactly the kind of cross-referencing that prevents scope confusion during implementation. TD-I-03 and TD-I-04 are particularly valuable -- they identify stories that reference Phase 2+ infrastructure and provide clear interim strategies.

- **[hub, lines 960-1008]** -- **Dependency graph is well-structured with both feature-level and WU-level views.** Providing two levels of granularity (feature dependencies as a tree diagram, then WU dependencies as a DAG) makes the graph useful for both the architect (feature-level reasoning) and the project manager (task-level scheduling). The WU-level graph correctly shows WU-4 requiring both WU-1 and WU-2, which is a dependency that would be easy to miss.

- **[hub, lines 1037-1116]** -- **Context packages are a strong pattern for downstream implementers.** Each WU group gets a "Context Package" that lists exactly which files to read, which binding contracts to reference, key decisions, and explicit scope boundaries (what is NOT in scope). This is precisely what implementing agents need to avoid over-loading context. The scope boundaries are particularly useful -- they tell agents where to stop.

- **[chunk-data, lines 777-895]** -- **Demographic filter design with clear Phase 1/Phase 2 boundary.** The keyword-only approach for Phase 1 with an explicit note about semantic similarity in Phase 2 is a good example of PoC-appropriate scoping. The `DemographicFilterResult` class provides a clean interface for the filter, and the `filter_extraction_results` function is designed to be composable with the Phase 2 extraction pipeline.

- **[chunk-auth, lines 279-318]** -- **RBAC pipeline data flow diagram.** The ASCII diagram showing the full request lifecycle (Auth -> RBAC Route Guard -> Data Scope Injection -> Route Handler -> PII Masking Middleware -> Response) is clear and immediately reveals the execution order. This is the kind of concrete, operational documentation that prevents misunderstanding during implementation.

## Cross-Cutting Check Results

### 1. Contract Consistency

- **Python contracts (hub) vs. SQLAlchemy models (chunk-data):** Pydantic models match SQLAlchemy models for the most part. The `HmdaCollectionRequest`/`HmdaCollectionResponse` align with `HmdaDemographics`. `AffordabilityRequest`/`AffordabilityResponse` have no database counterpart (computed on the fly), which is correct. The `AuditEvent` schema matches between the hub's `write_audit_event` SQL and the SQLAlchemy model.
- **TypeScript interfaces (hub) vs. API response types:** `HealthResponse`, `ErrorResponse`, `AffordabilityRequest`/`AffordabilityResponse` TypeScript interfaces match their Pydantic counterparts. **Gap found: `ProductInfo` type is missing** (see Warning finding above).
- **Keycloak realm vs. UserRole enum:** Keycloak defines 6 roles (prospect, borrower, loan_officer, underwriter, ceo, admin). Python `UserRole` defines only 5 (no admin). **Gap found** (see Critical finding above).

### 2. WU Boundaries

WU boundaries are generally well-scoped (3-7 files each). WU-8 (Frontend Scaffolding + Landing Page) is the largest with ~25 files, which exceeds chunking heuristics. However, most of those files are boilerplate scaffolding (shadcn/ui components, route stubs), so the cognitive load is manageable. WU-7 (Integration Tests) correctly depends on both WU-3 and WU-4, reflecting the cross-cutting nature of RBAC integration testing. Each WU can be assigned to a single implementer.

### 3. Exit Condition Feasibility

Exit conditions are machine-verifiable. One concern: WU-9's exit condition (`make run && curl -sf http://localhost:8000/health | jq -e '.status == "healthy"'`) requires all prior WUs to be complete and the full Docker stack running -- this is realistic but slow. The LangFuse database issue (Warning finding) means the "full" profile will report LangFuse as "down", but the health endpoint considers this acceptable (not in the required list). The PostgreSQL exit condition for WU-1 (`psql -U lending_app`) assumes `psql` is available outside the container -- the command should specify running inside the container context.

### 4. Requirements Coverage

All 32 Phase 1 stories are mapped to WUs. Verified mapping:
- F1 (3 stories): WU-8
- F2 (3 stories): WU-2 (backend) + WU-8 (frontend route guards)
- F14 (5 stories): WU-4 + WU-7
- F18 (3 stories): WU-5
- F20 (5 stories): WU-1 (partial for F20-04) + WU-6 (F20-01 to F20-03) + WU-8 (F20-05)
- F21 (4 stories): WU-5
- F22 (4 stories): WU-9
- F25 (5 stories): WU-1 (F25-02) + WU-3 (F25-01, F25-03, F25-04, F25-05) + WU-7 (F25-03)

No stories are missing from the TD.

### 5. Architecture Alignment

The TD respects all 7 ADRs. Dual-data-path HMDA isolation is faithfully implemented with separate schema, roles, connection pools, and CI lint. LlamaStack is wrapped behind `create_chat_model()` per ADR-0004. The audit trail uses advisory locks per ADR-0006. Compose profiles match ADR-0007. No architecture decisions are overridden.

### 6. Inconsistency Flag Validation

The six flagged inconsistencies (TD-I-01 through TD-I-06) are all valid:
- **TD-I-01/TD-I-06** (story count mismatch): Correctly identified. The task description had inflated counts.
- **TD-I-02** (feature naming offset): Valid observation, low impact.
- **TD-I-03** (demographic filter without extraction pipeline): Valid. The Phase 1 approach (standalone utility with unit tests) is appropriate.
- **TD-I-04** (agent tool auth without agents): Valid. The Phase 1 approach (framework + unit tests) is appropriate.
- **TD-I-05** (empty states in non-existent UIs): Valid. Phase 1 covers only landing page empty states.

**No additional inconsistencies were found** beyond the contract gaps identified in the findings above.

## Scope Discipline

The TD stays within Phase 1 scope. No Phase 2+ decisions are made prematurely. The agent tool authorization registry (chunk-auth, lines 528-541) does include Phase 2+ tools (e.g., `submit_to_underwriting`, `risk_assessment`, `analytics_query`), but this is reasonable -- it defines the authorization framework that will be extended, not the tools themselves. The TD explicitly flags Phase 2+ scope through the inconsistency notes (TD-I-03, TD-I-04, TD-I-05).

## Downstream Feasibility

The Project Manager should be able to create a work breakdown directly from the WU summary table and the chunk-file details. Context Packages provide clear guidance for implementing agents. The one concern is that WU-8 (25+ files) may need splitting during the work breakdown phase -- the Project Manager should evaluate whether the frontend scaffolding (boilerplate) can be separated from the landing page feature work.
