# This project was developed with assistance from AI tools.

# Work Breakdown Phase 1 -- Chunk: Authentication and RBAC

**Covers:** WU-2 (Keycloak Auth Integration), WU-4 (RBAC Middleware Pipeline), WU-7 (RBAC Integration Tests)
**Features:** F2 (Borrower Authentication via Keycloak), F14 (Role-Based Access Control)
**Stories:** 14 story-tasks (11 unique stories)

---

## Context for All Stories in This Chunk

### Binding Contracts (from TD hub)

All stories in this chunk use these exact models and interfaces:

```python
# packages/api/src/summit_cap/schemas/common.py

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserRole(StrEnum):
    ADMIN = "admin"
    PROSPECT = "prospect"
    BORROWER = "borrower"
    LOAN_OFFICER = "loan_officer"
    UNDERWRITER = "underwriter"
    CEO = "ceo"


class DataScope(BaseModel):
    """Typed data scope filters injected by RBAC middleware.
    Replaces bare dict to enforce known filter keys."""

    assigned_to: str | None = None
    pii_mask: bool = False
    own_data_only: bool = False
    user_id: str | None = None
    full_pipeline: bool = False


class UserContext(BaseModel):
    """Injected into every authenticated request by RBAC middleware.
    Passed to domain services as the identity/authorization context.
    Frozen to prevent mutation -- RBAC middleware should return a new instance
    with updated data_scope via model_copy(update={"data_scope": ...})."""

    model_config = ConfigDict(frozen=True)

    user_id: UUID
    role: UserRole
    email: str
    name: str
    # Data scope filters injected by RBAC middleware:
    # For LO: assigned_to filter. For CEO: pii_mask flag.
    data_scope: DataScope = Field(default_factory=DataScope)
```

```python
# packages/api/src/summit_cap/schemas/auth.py

from pydantic import BaseModel

from summit_cap.schemas.common import UserRole


class TokenPayload(BaseModel):
    """Decoded JWT token claims from Keycloak."""

    sub: str  # Keycloak user ID
    email: str
    preferred_username: str
    name: str
    realm_access: dict  # {"roles": ["borrower", ...]}

    def get_primary_role(self) -> UserRole:
        """Extract the primary application role from Keycloak realm roles.
        Uses first matching role. Logs warning if multiple roles present."""
        app_roles = {r.value for r in UserRole}
        roles = [r for r in self.realm_access.get("roles", []) if r in app_roles]
        if not roles:
            raise ValueError("No application role found in token")
        return UserRole(roles[0])
```

### Keycloak Realm Configuration

The Keycloak realm JSON (`config/keycloak/summit-cap-realm.json`) pre-configures 5 demo users:

| Username | Role | Email | Password (env var) |
|----------|------|-------|-------------------|
| sarah.mitchell | borrower | sarah@example.com | `${DEMO_USER_PASSWORD}` |
| james.torres | loan_officer | james@summitcap.example | `${DEMO_USER_PASSWORD}` |
| maria.chen | underwriter | maria@summitcap.example | `${DEMO_USER_PASSWORD}` |
| david.park | ceo | david@summitcap.example | `${DEMO_USER_PASSWORD}` |
| admin | admin | admin@summitcap.example | `${ADMIN_PASSWORD}` |

OIDC config:
- Access token lifetime: 900s (15 min)
- Refresh token lifetime: 28800s (8 hours)
- PKCE required (S256)
- Client IDs: `summit-cap-ui` (public, SPA), `summit-cap-api` (bearer-only)

### Key Architecture Decisions

1. **JWKS caching:** 5-minute cache, cache-busted on signature verification failure
2. **Fail-closed:** Keycloak unreachable -> 503 for all authenticated requests
3. **Multi-role handling:** Use first matching role, log WARNING
4. **Data scope injection:** RBAC middleware injects filters; services re-verify
5. **PII masking:** Fail-closed on masking error -> 500, never send unmasked response
6. **UserContext immutability:** Frozen model. Use `model_copy(update={"data_scope": ...})` to update.

---

## WU-2: Keycloak Auth Integration

### Story: S-1-F2-01 -- Authentication via Keycloak OIDC

**WU:** WU-2
**Feature:** F2 -- Borrower Authentication via Keycloak
**Complexity:** M

#### Acceptance Criteria

**Given** an unauthenticated user visits a protected route (e.g., `/borrower/dashboard`)
**When** the route loads
**Then** the frontend redirects the user to the Keycloak login page

**Given** a user on the Keycloak login page
**When** they enter valid credentials and submit
**Then** Keycloak authenticates the user and redirects back to the frontend with an OIDC authorization code

**Given** the frontend receives an authorization code
**When** it exchanges the code for tokens
**Then** the frontend receives an access token, refresh token, and ID token with role claims

**Given** the frontend receives tokens
**When** it makes an API request
**Then** the access token is included in the `Authorization: Bearer <token>` header

**Given** the API gateway receives a request with an access token
**When** the token is validated
**Then** the gateway verifies the token signature against Keycloak's JWKS (cached for 5 minutes, re-fetched on verification failure)

**Given** the API gateway fails to reach Keycloak for token validation
**When** a request arrives
**Then** the gateway rejects the request with 503 (Service Unavailable) and does not allow unauthenticated access (fail-closed)

**Given** a user's access token expires (after 15 minutes)
**When** the frontend makes an API request
**Then** the API returns 401 (Unauthorized), the frontend attempts to refresh the token using the refresh token, and on success re-issues the request

**Given** a user's refresh token expires or is invalid
**When** the frontend attempts to refresh
**Then** the refresh fails, the user is logged out, and the frontend redirects to the login page

**Given** a user enters invalid credentials
**When** they submit the Keycloak login form
**Then** Keycloak returns an error, and the login page displays "Invalid username or password"

#### Files

- `packages/api/src/summit_cap/middleware/auth.py` (new)
- `packages/api/src/summit_cap/core/keycloak.py` (new)
- `packages/api/src/summit_cap/schemas/auth.py` (new)
- `packages/api/tests/test_auth.py` (new)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/schemas/common.py` -- UserContext, UserRole, DataScope models (binding contract)
- `packages/api/src/summit_cap/core/config.py` -- settings for Keycloak URL, client ID, realm

**Requirements:**

Implement JWT authentication using Keycloak OIDC:

1. `get_current_user` FastAPI dependency validates JWT and returns `UserContext`
2. JWKS cached 5 minutes, cache-busted on signature verification failure
3. Fail-closed: Keycloak unreachable -> 503
4. Multi-role tokens: use first matching role, log WARNING
5. 401 on expired token, 403 on valid token with no role

**Steps:**

1. Create `packages/api/src/summit_cap/core/keycloak.py` with:
   - `async def get_jwks() -> dict` -- fetch and cache JWKS (5-min TTL)
   - `async def bust_jwks_cache() -> dict` -- force-refresh JWKS
   - Global module-level cache: `_jwks_cache: dict`, `_jwks_cache_time: float`
   - Use `httpx.AsyncClient` for HTTP requests, handle errors gracefully

2. Create `packages/api/src/summit_cap/schemas/auth.py` with:
   - `TokenPayload` Pydantic model (exact definition from TD hub above)
   - `get_primary_role()` method raises `ValueError` if no application role found

3. Create `packages/api/src/summit_cap/middleware/auth.py` with:
   - `async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> UserContext`
   - Validate JWT using `jose.jwt.decode()` with JWKS from `get_jwks()`
   - On signature failure: call `bust_jwks_cache()`, retry once
   - On success: extract role via `TokenPayload.get_primary_role()`, construct `UserContext`
   - On failure: raise `HTTPException(401)` for invalid token, `HTTPException(403)` for no role, `HTTPException(503)` for Keycloak unreachable
   - Set `request.state.user_context = user` for downstream middleware
   - Also implement `async def get_optional_user()` for optional auth (returns `None` for unauthenticated)

4. Write unit tests in `packages/api/tests/test_auth.py`:
   - `test_jwks_caching` -- verify JWKS is cached for 5 min
   - `test_expired_token_returns_401` -- verify expired token -> 401
   - `test_no_role_returns_403` -- verify token with no application role -> 403
   - `test_keycloak_down_returns_503` -- mock JWKS failure -> 503
   - `test_cache_bust_on_signature_failure` -- verify retry with fresh JWKS
   - Use `pytest` with `httpx.AsyncClient` and mock JWKS

**Contracts:**

Use exact `UserContext`, `TokenPayload`, `UserRole`, `DataScope` models from TD hub (inlined above).

JWKS endpoint: `{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/certs`

JWT validation options:
```python
jwt.decode(
    token,
    jwks,
    algorithms=["RS256"],
    audience=settings.keycloak_client_id,
    issuer=f"{settings.keycloak_url}/realms/{settings.keycloak_realm}",
    options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
)
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_auth.py -v
```

---

### Story: S-1-F2-02 -- Role-based access to persona UIs

**WU:** WU-2
**Feature:** F2 -- Borrower Authentication via Keycloak
**Complexity:** S

#### Acceptance Criteria

**Given** a user with role `borrower` is authenticated
**When** they navigate to `/borrower/dashboard`
**Then** the route loads and displays the borrower-specific UI

**Given** a user with role `borrower` is authenticated
**When** they attempt to navigate to `/loan-officer/pipeline`
**Then** the route does not load, and they see a 403 error page: "You do not have access to this page"

**Given** a user with multiple roles assigned in Keycloak (edge case)
**When** they authenticate
**Then** the system uses the first role in the token's role claim array, logs a warning that multiple roles are present, and proceeds with that role

**Given** a user with no role assigned in Keycloak (edge case)
**When** they authenticate
**Then** the API rejects all requests with 403 and logs the authorization failure

#### Files

(Backend only -- frontend route guards are WU-8a. This story validates that the backend correctly extracts role from token.)

- `packages/api/src/summit_cap/middleware/auth.py` (modify)
- `packages/api/tests/test_auth.py` (add test cases)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/auth.py` -- get_current_user dependency
- `packages/api/src/summit_cap/schemas/auth.py` -- TokenPayload model
- `packages/api/tests/test_auth.py` -- existing auth tests

**Requirements:**

Ensure `get_current_user` correctly handles edge cases:

1. Multi-role tokens: use first matching role, log WARNING
2. No-role tokens: raise 403
3. Role extraction respects `UserRole` enum

**Steps:**

1. In `packages/api/src/summit_cap/middleware/auth.py`, ensure `get_current_user` calls `TokenPayload.get_primary_role()` which:
   - Filters `realm_access.roles` to match `UserRole` enum values
   - Returns first matching role
   - Logs `logger.warning()` if multiple roles found
   - Raises `ValueError` if no matching role (caught as 403)

2. Add test cases to `packages/api/tests/test_auth.py`:
   - `test_multi_role_uses_first` -- token with `["borrower", "loan_officer"]` -> returns `borrower`, logs warning
   - `test_no_role_returns_403` -- token with `["unknown_role"]` -> 403
   - `test_role_extracted_correctly` -- verify each role (borrower, loan_officer, underwriter, ceo, admin) is extracted

**Contracts:**

`UserRole` enum values: `admin`, `prospect`, `borrower`, `loan_officer`, `underwriter`, `ceo`

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_auth.py::test_multi_role_uses_first tests/test_auth.py::test_no_role_returns_403 tests/test_auth.py::test_role_extracted_correctly -v
```

---

### Story: S-1-F2-03 -- Token refresh and session management

**WU:** WU-2
**Feature:** F2 -- Borrower Authentication via Keycloak
**Complexity:** S

#### Acceptance Criteria

**Given** a user's access token expires (after 15 minutes)
**When** the frontend makes an API request
**Then** the API returns 401, the frontend attempts to refresh the token using the refresh token, and on success re-issues the request

**Given** the frontend attempts to refresh the access token
**When** the refresh request succeeds
**Then** the new access token is stored and used for subsequent API requests, and the user experiences no interruption

**Given** the frontend attempts to refresh the access token
**When** the refresh request fails (e.g., refresh token expired or revoked)
**Then** the user is logged out, the session is cleared, and the frontend redirects to the login page

#### Files

(Backend portion only -- frontend TanStack Query interceptor is WU-8a. This story ensures the backend returns 401 for expired tokens.)

- `packages/api/src/summit_cap/middleware/auth.py` (already implemented in S-1-F2-01)
- `packages/api/tests/test_auth.py` (add test case)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/auth.py` -- get_current_user dependency
- `packages/api/tests/test_auth.py` -- existing auth tests

**Requirements:**

Verify that expired tokens are correctly rejected with 401.

**Steps:**

1. Add test case to `packages/api/tests/test_auth.py`:
   - `test_expired_token_returns_401` -- create a JWT with `exp` in the past, send to `get_current_user`, assert 401

**Contracts:**

JWT `exp` claim is validated by `jose.jwt.decode()` with `options={"verify_exp": True}`.

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_auth.py::test_expired_token_returns_401 -v
```

---

## WU-4: RBAC Middleware Pipeline

### Story: S-1-F14-01 -- API-level RBAC enforcement

**WU:** WU-4
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** M

#### Acceptance Criteria

**Given** a request arrives at `/api/applications` with a valid token for role `borrower`
**When** the API gateway evaluates the route
**Then** the request is allowed if the route permits the `borrower` role, and the request proceeds to the handler

**Given** a request arrives at `/api/applications` with a valid token for role `borrower`
**When** the API gateway evaluates the route and the route restricts access to `loan_officer` only
**Then** the API gateway rejects the request with 403 (Forbidden) before invoking any handler logic

**Given** a request arrives with an expired token
**When** the API gateway validates the token
**Then** the request is rejected with 401 (Unauthorized), and no downstream logic executes

**Given** a RBAC authorization failure occurs
**When** the gateway logs the failure
**Then** the log entry includes user_id, role, requested route, timestamp, and rejection reason

#### Files

- `packages/api/src/summit_cap/middleware/rbac.py` (new)
- `packages/api/tests/test_rbac.py` (new)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/auth.py` -- get_current_user dependency
- `packages/api/src/summit_cap/schemas/common.py` -- UserContext, UserRole

**Requirements:**

Implement route-level RBAC using FastAPI dependencies:

1. `require_roles(*roles: UserRole)` returns a FastAPI dependency that checks `user.role in roles`
2. Rejects with 403 if role does not match
3. Logs all authorization failures

**Steps:**

1. Create `packages/api/src/summit_cap/middleware/rbac.py` with:
   - `def require_roles(*roles: UserRole) -> Callable` -- returns async dependency that checks role
   - Inside the returned dependency:
     - Call `get_current_user()` to get `UserContext`
     - If `user.role not in roles`: log warning, raise `HTTPException(403, detail="You do not have permission to access this resource")`
     - Return `user` if authorized

2. Write unit tests in `packages/api/tests/test_rbac.py`:
   - `test_require_roles_allows_matching_role` -- verify borrower passes `require_roles(UserRole.BORROWER)`
   - `test_require_roles_blocks_non_matching_role` -- verify borrower fails `require_roles(UserRole.LOAN_OFFICER)` -> 403
   - `test_rbac_logs_denial` -- verify log entry on 403
   - Use `pytest` with FastAPI `TestClient` and mock `get_current_user`

**Contracts:**

Use exact `UserContext` and `UserRole` from TD hub.

Example usage:
```python
@router.get("/admin/seed", dependencies=[Depends(require_roles(UserRole.ADMIN))])
async def seed_data(...): ...
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_rbac.py::test_require_roles_allows_matching_role tests/test_rbac.py::test_require_roles_blocks_non_matching_role tests/test_rbac.py::test_rbac_logs_denial -v
```

---

### Story: S-1-F14-02 -- Data scope injection for LO pipeline

**WU:** WU-4
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** M

#### Acceptance Criteria

**Given** a loan officer requests `/api/applications`
**When** the API gateway injects data scope
**Then** the query is automatically filtered to `WHERE assigned_to = <user_id>` before reaching the application service

**Given** a loan officer requests `/api/applications/{id}`
**When** the application ID is not in their assigned pipeline
**Then** the query returns 404 (Not Found), not 403, to avoid leaking the existence of the application

**Given** an admin or CEO requests `/api/applications` (roles with full pipeline access)
**When** the API gateway evaluates data scope
**Then** no filter is injected, and the full pipeline is returned

#### Files

- `packages/api/src/summit_cap/middleware/rbac.py` (modify)
- `packages/api/tests/test_rbac.py` (add tests)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/rbac.py` -- require_roles function
- `packages/api/src/summit_cap/schemas/common.py` -- UserContext, DataScope (frozen=True, use model_copy to update)

**Requirements:**

Implement data scope injection as a FastAPI dependency:

1. `inject_data_scope(user: UserContext)` returns updated UserContext with role-specific filters
2. LO: `assigned_to = user_id`
3. CEO: `pii_mask = True`
4. Borrower: `own_data_only = True`
5. Underwriter: `full_pipeline = True`

**Important:** `UserContext` is frozen. Use `user.model_copy(update={"data_scope": DataScope(...)})` to return a new instance.

**Steps:**

1. In `packages/api/src/summit_cap/middleware/rbac.py`, add:
   - `async def inject_data_scope(user: UserContext = Depends(get_current_user)) -> UserContext`
   - Construct new `DataScope` based on `user.role`
   - Return `user.model_copy(update={"data_scope": new_scope})`

2. Add unit tests to `packages/api/tests/test_rbac.py`:
   - `test_lo_data_scope_injection` -- verify LO gets `assigned_to = user_id`
   - `test_ceo_data_scope_pii_mask` -- verify CEO gets `pii_mask = True`
   - `test_underwriter_full_pipeline` -- verify underwriter gets `full_pipeline = True`
   - `test_borrower_own_data_only` -- verify borrower gets `own_data_only = True`

**Contracts:**

`DataScope` model (from TD hub):
```python
class DataScope(BaseModel):
    assigned_to: str | None = None
    pii_mask: bool = False
    own_data_only: bool = False
    user_id: str | None = None
    full_pipeline: bool = False
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_rbac.py::test_lo_data_scope_injection tests/test_rbac.py::test_ceo_data_scope_pii_mask -v
```

---

### Story: S-1-F14-03 -- CEO PII masking enforcement

**WU:** WU-4
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** M

#### Acceptance Criteria

**Given** a CEO requests `/api/applications/{id}`
**When** the response is generated
**Then** the response includes borrower names but masks SSN (showing last 4 digits: `***-**-1234`), DOB (showing `YYYY-**-**`), and account numbers (last 4 digits: `****5678`)

**Given** the CEO role is assigned to a token
**When** the API response middleware processes the response
**Then** PII masking is applied globally to all response payloads before they leave the API boundary

**Given** the PII masking middleware fails (e.g., due to an unexpected data structure)
**When** the failure is detected
**Then** the API returns 500 (Internal Server Error), logs the failure, and does not send the unmasked response

#### Files

- `packages/api/src/summit_cap/middleware/pii_masking.py` (new)
- `packages/api/src/summit_cap/middleware/rbac.py` (modify to add PIIMaskingMiddleware)
- `packages/api/src/summit_cap/main.py` (modify to register middleware)
- `packages/api/tests/test_pii_masking.py` (new)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/auth.py` -- request.state.user_context set by get_current_user
- `packages/api/src/summit_cap/schemas/common.py` -- UserContext, UserRole

**Requirements:**

Implement PII masking as Starlette middleware:

1. `mask_pii_for_ceo(data)` recursively masks PII fields in dict/list structures
2. `PIIMaskingMiddleware` applies masking to all JSON responses for CEO role
3. Masking failure -> 500, never send unmasked response

**Steps:**

1. Create `packages/api/src/summit_cap/middleware/pii_masking.py` with:
   - `PII_FIELDS = {"ssn", "ssn_encrypted", "date_of_birth", "dob", "account_number"}`
   - `def mask_pii_for_ceo(data: Any) -> Any` -- recursive function:
     - SSN: `***-**-{last4}` (if len >= 4)
     - DOB: `{year}-**-**` (if string or date)
     - Account number: `****{last4}` (if len >= 4)
     - Recurse into dicts and lists

2. In same file, implement `class PIIMaskingMiddleware(BaseHTTPMiddleware)`:
   - In `async def dispatch()`:
     - Call `response = await call_next(request)`
     - Check `request.state.user_context` (set by auth middleware)
     - If `user_context.role == UserRole.CEO` and response is JSON:
       - Read response body, parse JSON, apply `mask_pii_for_ceo()`, re-serialize
       - On exception: return `JSONResponse(status_code=500, content={"error": "Internal server error during response processing"})`
     - Return response

3. In `packages/api/src/summit_cap/main.py`, add:
   - `from summit_cap.middleware.rbac import PIIMaskingMiddleware`
   - `app.add_middleware(PIIMaskingMiddleware)` (before route includes)

4. Write unit tests in `packages/api/tests/test_pii_masking.py`:
   - `test_ssn_masked_for_ceo` -- verify SSN masking
   - `test_dob_masked_for_ceo` -- verify DOB masking
   - `test_account_number_masked` -- verify account masking
   - `test_masking_failure_returns_500` -- mock parsing failure -> 500
   - `test_non_ceo_not_masked` -- verify other roles not affected

**Contracts:**

PII fields: `ssn`, `ssn_encrypted`, `date_of_birth`, `dob`, `account_number`

Masking patterns:
- SSN: `***-**-XXXX` (last 4)
- DOB: `YYYY-**-**`
- Account: `****XXXX` (last 4)

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_pii_masking.py -v
```

---

### Story: S-1-F14-04 -- CEO document access restriction (metadata only)

**WU:** WU-4
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** S

#### Acceptance Criteria

**Given** a CEO requests `/api/documents/{id}/content`
**When** the API gateway evaluates the route
**Then** the request is rejected with 403 (Forbidden) before invoking the document service

#### Files

- `packages/api/src/summit_cap/middleware/rbac.py` (modify)
- `packages/api/tests/test_rbac.py` (add test)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/middleware/rbac.py` -- require_roles function
- `packages/api/src/summit_cap/schemas/common.py` -- UserRole

**Requirements:**

Add a specialized role guard for document content endpoints:

1. `require_non_ceo_for_content()` blocks CEO role from document content endpoints
2. Returns 403 for CEO, allows all other roles

**Steps:**

1. In `packages/api/src/summit_cap/middleware/rbac.py`, add:
   - `CEO_BLOCKED_PATHS = {"/api/documents/{id}/content"}`
   - `def require_non_ceo_for_content() -> Callable` -- returns async dependency
   - Inside dependency: if `user.role == UserRole.CEO`: log + raise 403

2. Add test to `packages/api/tests/test_rbac.py`:
   - `test_ceo_document_content_blocked` -- verify CEO token -> 403
   - `test_non_ceo_document_content_allowed` -- verify LO token -> allowed

**Contracts:**

Use exact `UserRole.CEO` enum value.

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_rbac.py::test_ceo_document_content_blocked -v
```

---

### Story: S-1-F14-05 -- Agent tool authorization at execution time

**WU:** WU-4
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** M

#### Acceptance Criteria

**Given** a loan officer uses the AI assistant and the assistant decides to invoke the `submit_to_underwriting` tool
**When** the pre-tool authorization node executes
**Then** the node reads the user's role from JWT claims in the session context and verifies that `loan_officer` is in `submit_to_underwriting.allowed_roles`

**Given** the pre-tool authorization node verifies the user's role
**When** the role is NOT authorized (e.g., a `borrower` attempts to invoke `submit_to_underwriting`)
**Then** the tool invocation is blocked, an authorization error is returned to the agent, and the attempt is logged to the audit trail

**Given** a tool authorization failure occurs
**When** the failure is logged
**Then** the audit event includes: user_id, role, tool_name, timestamp, and rejection reason

#### Files

- `packages/api/src/summit_cap/agents/tool_auth.py` (new)
- `packages/api/tests/test_tool_auth.py` (new)

#### Implementation Prompt

**Role:** @backend-developer

**Context files:**
- `packages/api/src/summit_cap/schemas/common.py` -- UserRole

**Requirements:**

Implement the tool authorization framework (Phase 1 framework only -- no LangGraph agents until Phase 2):

1. `TOOL_AUTHORIZATION` dict maps tool names to allowed roles
2. `check_tool_authorization(user_role, tool_name, user_id)` returns `True` or raises `ToolAuthorizationError`
3. `load_tool_auth_from_config(agent_config)` parses YAML tool config

**Phase 1 note:** This is a standalone framework with unit tests. Integration with actual LangGraph pre-tool nodes happens in Phase 2.

**Steps:**

1. Create `packages/api/src/summit_cap/agents/tool_auth.py` with:
   - `class ToolAuthorizationError(Exception)` with `user_role` and `tool_name` attributes
   - `TOOL_AUTHORIZATION: dict[str, set[str]]` -- hardcoded tool registry (fallback for testing):
     ```python
     TOOL_AUTHORIZATION = {
         "product_info": {r.value for r in UserRole},  # All roles
         "affordability_calc": {r.value for r in UserRole},
         "application_status": {"borrower", "loan_officer", "underwriter", "ceo"},
         "pipeline_view": {"loan_officer", "underwriter", "ceo"},
         "submit_to_underwriting": {"loan_officer"},
         "risk_assessment": {"underwriter"},
         "compliance_check": {"underwriter"},
         "kb_search": {"underwriter", "loan_officer"},
         "render_decision": {"underwriter"},
         "analytics_query": {"ceo"},
         "get_hmda_aggregates": {"ceo"},
         "audit_search": {"underwriter", "ceo"},
     }
     ```
   - `def check_tool_authorization(user_role: str, tool_name: str, user_id: UUID | None = None) -> bool`:
     - Look up `tool_name` in `TOOL_AUTHORIZATION`
     - If not found: log warning, raise `ToolAuthorizationError`
     - If `user_role not in allowed_roles`: log warning, raise `ToolAuthorizationError`
     - Return `True` if authorized
   - `def load_tool_auth_from_config(agent_config: dict) -> dict[str, set[str]]` -- parse `tools[].allowed_roles` from YAML

2. Write unit tests in `packages/api/tests/test_tool_auth.py`:
   - `test_borrower_cannot_submit_to_underwriting` -- verify ToolAuthorizationError
   - `test_ceo_can_query_analytics` -- verify returns True
   - `test_unknown_tool_denied` -- verify unknown tool raises error
   - `test_load_tool_auth_from_config` -- verify YAML parsing

**Contracts:**

Tool authorization registry format:
```python
{"tool_name": {"role1", "role2"}}
```

YAML config format (for load function):
```yaml
tools:
  - name: submit_to_underwriting
    allowed_roles: [loan_officer]
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_tool_auth.py -v
```

---

## WU-7: RBAC Integration Tests

### Test Infrastructure Requirements

WU-7 integration tests have two categories with different infrastructure needs:

**Category 1: In-memory tests (no external services needed)**
- RBAC pipeline tests (`test_rbac_integration.py`) -- use `httpx.AsyncClient` with `ASGITransport(app=app)` and mocked JWKS. No running database or Keycloak required.
- Demographic filter tests (`test_demographic_filter.py`) -- pure Python, no I/O.

**Category 2: Database-dependent tests (require running PostgreSQL with dual roles)**
- HMDA isolation tests (`test_hmda_isolation.py`) -- require a real PostgreSQL instance with `lending_app` and `compliance_app` roles configured, because they verify that role-level `GRANT`/`REVOKE` permissions work correctly. These cannot be meaningfully tested with SQLite or mocked sessions.

**How to set up the test database:**
- Option A: `podman-compose up postgres` (starts only PostgreSQL from compose.yml, runs `packages/db/init/01-roles.sql` via docker-entrypoint-initdb.d)
- Option B: Use a local PostgreSQL with `packages/db/init/01-roles.sql` applied manually

The conftest.py fixture should detect whether PostgreSQL is available and skip database-dependent tests with `pytest.mark.skipif` when it is not. This allows the in-memory tests to run in CI without infrastructure, while database-dependent tests run in the full-stack environment.

```python
# packages/api/tests/integration/conftest.py (infrastructure detection pattern)
import asyncio
import pytest
from sqlalchemy import text
from summit_cap_db.database import lending_engine

@pytest.fixture(scope="session")
def has_postgres():
    """Check if PostgreSQL is available for integration tests."""
    try:
        async def check():
            async with lending_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        asyncio.get_event_loop().run_until_complete(check())
        return True
    except Exception:
        return False

requires_postgres = pytest.mark.skipif(
    "not config.getoption('--postgres')",
    reason="Requires running PostgreSQL (use --postgres flag or start via compose)"
)
```

---

### Story: S-1-F14-01 to S-1-F14-05 (Integration) -- Full RBAC pipeline validation

**WU:** WU-7
**Feature:** F14 -- Role-Based Access Control (Multi-Layer)
**Complexity:** L

#### Acceptance Criteria

(Covers integration testing of all RBAC stories from WU-4)

**Given** a request arrives with a valid token for role `borrower`
**When** the request targets a borrower-accessible route
**Then** the request succeeds (200)

**Given** a request arrives with a valid token for role `borrower`
**When** the request targets a loan-officer-only route
**Then** the request is rejected with 403 before the handler executes

**Given** a request arrives with a valid token for role `ceo`
**When** the response includes PII fields
**Then** the PII is masked in the response

**Given** a request arrives with a valid token for role `ceo`
**When** the request targets `/api/documents/{id}/content`
**Then** the request is rejected with 403

**Given** a request arrives with an expired token
**When** the API validates the token
**Then** the request is rejected with 401

**Given** a request arrives with a valid token for role `loan_officer`
**When** the data scope injection runs
**Then** the query filters to `assigned_to = <user_id>`

#### Files

- `packages/api/tests/integration/__init__.py` (new)
- `packages/api/tests/integration/conftest.py` (new)
- `packages/api/tests/integration/test_rbac_integration.py` (new)

#### Implementation Prompt

**Role:** @test-engineer

**Context files:**
- `packages/api/src/summit_cap/main.py` -- FastAPI app entry point
- `packages/api/src/summit_cap/middleware/auth.py` -- get_current_user
- `packages/api/src/summit_cap/middleware/rbac.py` -- RBAC middleware
- `packages/api/src/summit_cap/middleware/pii_masking.py` -- PII masking

**Requirements:**

Implement end-to-end integration tests for RBAC:

1. Mock JWKS and token factory for role-specific tokens
2. Test client sends requests with role-specific tokens
3. Verify correct RBAC behavior at API boundary

**Steps:**

1. Create `packages/api/tests/integration/conftest.py` with:
   - `@pytest.fixture(scope="session") def rsa_key_pair()` -- generate RSA keypair for JWT signing
   - `@pytest.fixture def token_factory(rsa_key_pair)` -- factory for creating role-specific tokens:
     - `create_token(role: str, user_id: str | None = None, expired: bool = False) -> str`
     - Mint JWT with `sub`, `email`, `preferred_username`, `name`, `realm_access.roles = [role]`, `exp`, `iat`
   - `@pytest.fixture async def client()` -- AsyncClient for FastAPI app

2. Create `packages/api/tests/integration/test_rbac_integration.py` with tests:
   - `test_health_no_auth` -- GET /health -> 200 (no auth required)
   - `test_public_products_no_auth` -- GET /api/public/products -> 200
   - `test_protected_route_no_token` -- GET /api/applications -> 401
   - `test_protected_route_expired_token` -- GET /api/applications with expired token -> 401
   - `test_borrower_access_own_route` -- GET /borrower path with borrower token -> 200
   - `test_borrower_blocked_from_lo_route` -- GET /loan-officer path with borrower token -> 403
   - `test_ceo_blocked_from_document_content` -- GET /api/documents/{id}/content with CEO token -> 403
   - `test_ceo_pii_masking_ssn` -- GET /api/applications/{id} with CEO token -> SSN masked
   - `test_ceo_pii_masking_dob` -- GET /api/applications/{id} with CEO token -> DOB masked
   - `test_lo_data_scope_filters_pipeline` -- GET /api/applications with LO token -> only assigned apps returned

3. Use `httpx.AsyncClient` with `ASGITransport(app=app)` for in-memory testing (no network)

**Contracts:**

Token payload structure (from TD hub):
```python
{
    "sub": user_id,
    "email": f"{role}@example.com",
    "preferred_username": role,
    "name": f"Test {role.title()}",
    "realm_access": {"roles": [role]},
    "iss": "http://localhost:8080/realms/summit-cap",
    "aud": "summit-cap-api",
    "exp": exp_timestamp,
    "iat": now_timestamp,
}
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/integration/test_rbac_integration.py -v
```

---

### Story: S-1-F25-03 (Integration) -- Demographic filter utility tests

**WU:** WU-7
**Feature:** F25 -- HMDA Demographic Data Collection and Isolation
**Complexity:** M

#### Acceptance Criteria

**Given** a document extraction result contains demographic data (e.g., "race: Hispanic")
**When** the demographic data filter processes the result
**Then** the filter detects the data using keyword matching and returns `is_demographic=True` with matched keywords

**Given** a document extraction result contains no demographic data
**When** the demographic data filter processes the result
**Then** the filter returns `is_demographic=False` with an empty matched keywords list

**Given** the demographic data filter uses keyword matching
**When** the filter evaluates extracted text
**Then** keywords like "race", "ethnicity", "sex", "gender", "national origin" trigger detection

**Given** a list of extraction results is passed to the batch filter
**When** the filter processes the list
**Then** the filter returns two lists: clean extractions and excluded extractions (with `_exclusion_reason` and `_matched_keywords`)

#### Files

- `packages/api/tests/integration/test_demographic_filter.py` (new)

**Note:** The implementation lives in `packages/api/src/summit_cap/services/compliance/demographic_filter.py`, which is created in WU-3 (S-1-F25-03 in chunk-data). This WU-7 story writes integration tests against that existing implementation. Do NOT redefine the function.

#### Implementation Prompt

**Role:** @test-engineer

**Context files:**
- `packages/api/src/summit_cap/services/compliance/demographic_filter.py` -- existing implementation from WU-3 (contains `detect_demographic_data`, `filter_extraction_results`, `DemographicFilterResult`)

**Requirements:**

Write integration tests for the demographic filter utility implemented in WU-3. Do NOT create the filter module -- it already exists. Import and test the existing functions.

1. `detect_demographic_data(text: str) -> DemographicFilterResult` returns a result object with `.is_demographic`, `.matched_keywords`, `.original_text`
2. `filter_extraction_results(extractions: list[dict]) -> tuple[list[dict], list[dict]]` separates clean from excluded extractions
3. Phase 1 uses keyword matching only (semantic similarity is Phase 2, per TD-I-03)

**Steps:**

1. Write tests in `packages/api/tests/integration/test_demographic_filter.py`:
   - Import from `summit_cap.services.compliance.demographic_filter`:
     ```python
     from summit_cap.services.compliance.demographic_filter import (
         detect_demographic_data,
         filter_extraction_results,
         DemographicFilterResult,
     )
     ```
   - `test_demographic_filter_detects_race` -- `result = detect_demographic_data("race: Hispanic")` -> `assert result.is_demographic is True` and `assert len(result.matched_keywords) > 0`
   - `test_demographic_filter_detects_ethnicity` -- `result = detect_demographic_data("ethnicity: Latino")` -> `assert result.is_demographic is True`
   - `test_demographic_filter_passes_clean_text` -- `result = detect_demographic_data("income: $80,000")` -> `assert result.is_demographic is False` and `assert result.matched_keywords == []`
   - `test_demographic_filter_case_insensitive` -- `result = detect_demographic_data("Race: Asian")` -> `assert result.is_demographic is True`
   - `test_demographic_filter_preserves_original_text` -- `result = detect_demographic_data("some text")` -> `assert result.original_text == "some text"`
   - `test_filter_extraction_results_separates` -- pass a list with demographic and non-demographic extractions to `filter_extraction_results()`, verify clean and excluded lists are correct, and excluded entries have `_exclusion_reason` and `_matched_keywords` keys

**Contracts:**

Function signatures (from WU-3 implementation):
```python
class DemographicFilterResult:
    is_demographic: bool
    matched_keywords: list[str]
    original_text: str

def detect_demographic_data(text: str) -> DemographicFilterResult

def filter_extraction_results(
    extractions: list[dict],
) -> tuple[list[dict], list[dict]]
```

**Note:** This is a test-only story. The implementation is in WU-3. Integration with the extraction pipeline (WU-10, Phase 2) will call the WU-3 function.

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/integration/test_demographic_filter.py -v
```

---

### Story: S-1-F14-01 to S-1-F14-05, S-1-F25-01 (Integration) -- HMDA isolation tests

**WU:** WU-7
**Feature:** F14 + F25 -- RBAC + HMDA Isolation
**Complexity:** M

#### Acceptance Criteria

**Given** the HMDA collection endpoint is invoked
**When** the endpoint writes data
**Then** the data is written to `hmda.demographics` using the `compliance_app` pool

**Given** a query using the `lending_app` pool attempts to access `hmda` schema
**When** the query executes
**Then** the database returns a permission denied error

#### Files

- `packages/api/tests/integration/test_hmda_isolation.py` (new)

#### Implementation Prompt

**Role:** @test-engineer

**Context files:**
- `packages/api/src/summit_cap/routes/hmda.py` -- HMDA collection endpoint
- `packages/db/src/summit_cap_db/database.py` -- dual connection pools

**Requirements:**

Verify HMDA isolation at the database level:

1. HMDA endpoint uses `compliance_app` pool
2. `lending_app` pool cannot access `hmda` schema

**Steps:**

1. Create `packages/api/tests/integration/test_hmda_isolation.py` with:
   - `test_hmda_endpoint_uses_compliance_pool` -- POST /api/hmda/collect -> verify write succeeds
   - `test_lending_app_cannot_query_hmda` -- direct DB query via `lending_app` pool -> permission denied
   - Use `pytest` with test database and dual pools

**Contracts:**

HMDA collection request:
```python
{
    "application_id": "<uuid>",
    "race": "Hispanic",
    "ethnicity": "Latino",
    "sex": "Male",
}
```

Expected response:
```python
{
    "id": "<uuid>",
    "application_id": "<uuid>",
    "collected_at": "<timestamp>",
    "status": "collected",
}
```

**Exit condition:**

```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/integration/test_hmda_isolation.py -v
```

---

## Summary

**WU-2:** 3 stories (Keycloak auth, token validation, role extraction)
**WU-4:** 5 stories (RBAC route guards, data scope injection, PII masking, CEO doc restriction, tool auth framework)
**WU-7:** 3 integration story-groups (RBAC end-to-end, demographic filter, HMDA isolation)

**Total:** 11 unique stories, 14 story-tasks (some stories tested across multiple WUs)

**Dependencies:**
- WU-2 requires WU-0 (project bootstrap)
- WU-4 requires WU-1 (DB schema) and WU-2 (auth context)
- WU-7 requires WU-4 (RBAC middleware) and WU-3 (HMDA endpoint)

**Exit conditions:**
- All pytest commands must pass
- No test uses `@pytest.mark.skip`
- Lint check passes (ruff)

**Files created:**
- `packages/api/src/summit_cap/middleware/auth.py`
- `packages/api/src/summit_cap/middleware/rbac.py`
- `packages/api/src/summit_cap/middleware/pii_masking.py`
- `packages/api/src/summit_cap/core/keycloak.py`
- `packages/api/src/summit_cap/schemas/auth.py`
- `packages/api/src/summit_cap/agents/tool_auth.py`
- `packages/api/tests/test_auth.py`
- `packages/api/tests/test_rbac.py`
- `packages/api/tests/test_pii_masking.py`
- `packages/api/tests/test_tool_auth.py`
- `packages/api/tests/integration/conftest.py`
- `packages/api/tests/integration/test_rbac_integration.py`
- `packages/api/tests/integration/test_demographic_filter.py`
- `packages/api/tests/integration/test_hmda_isolation.py`

**Files modified:**
- `packages/api/src/summit_cap/main.py` (add PII masking middleware)

---

*Generated during SDD Phase 11 (Work Breakdown). This chunk is part of `plans/work-breakdown-phase-1.md`.*
