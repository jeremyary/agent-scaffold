# Technical Design Phase 1 -- Chunk: Authentication and RBAC

**Covers:** WU-2 (Keycloak Auth Integration), WU-4 (RBAC Middleware Pipeline), WU-7 (Integration Tests)
**Features:** F2 (Borrower Authentication via Keycloak), F14 (Role-Based Access Control)

---

## WU-2: Keycloak Auth Integration

### Description

Implement Keycloak OIDC authentication for the FastAPI backend: JWT token validation, JWKS key caching, token refresh coordination, and the `get_current_user` dependency that extracts `UserContext` from every authenticated request.

### Stories Covered

- S-1-F2-01: Authentication via Keycloak OIDC
- S-1-F2-02: Role-based access to persona UIs (backend portion -- token validation and role extraction)
- S-1-F2-03: Token refresh and session management (backend portion -- 401 on expired tokens)

### Data Flow: Authentication (Happy Path)

1. User visits a protected route (e.g., `/borrower/dashboard`)
2. Frontend detects no valid token, redirects to Keycloak login page
3. User enters credentials, Keycloak authenticates and issues authorization code
4. Frontend exchanges code for tokens (access, refresh, ID) using PKCE flow
5. Frontend stores tokens in memory (not localStorage for security)
6. Frontend includes access token in `Authorization: Bearer <token>` header on API requests
7. FastAPI middleware (`auth.py`) extracts token from header
8. Middleware validates token signature against Keycloak JWKS (cached 5 min)
9. Middleware decodes token claims, extracts primary role
10. Middleware creates `UserContext` and injects into request state
11. Handler executes with authenticated `UserContext`

### Data Flow: Authentication (Error Paths)

**Expired access token:**
1. API receives request with expired token
2. Middleware detects expiration, returns 401 (Unauthorized)
3. Frontend `onError` interceptor catches 401
4. Frontend sends refresh token to Keycloak token endpoint
5. If refresh succeeds: new access token, retry original request
6. If refresh fails (refresh token expired): clear tokens, redirect to login

**Keycloak unreachable:**
1. API receives request with token
2. Middleware attempts JWKS fetch/validation
3. Keycloak is down: cached JWKS used if available and not expired
4. If no cached JWKS or cache expired: return 503 (Service Unavailable)
5. System fails closed -- no unauthenticated fallback

**Invalid token signature:**
1. API receives request with tampered token
2. Middleware validates signature against cached JWKS -- fails
3. Middleware fetches fresh JWKS (cache-bust)
4. Re-validates against fresh JWKS -- fails again
5. Returns 401 (Unauthorized)

**No role in token:**
1. Middleware decodes token successfully
2. Token has `realm_access.roles` but none match `UserRole` enum
3. Raises 403 (Forbidden) -- user exists but has no application role

**Multiple roles in token:**
1. Middleware decodes token
2. Token has multiple application roles (e.g., `["loan_officer", "underwriter"]`)
3. Uses first matching role, logs WARNING about multi-role assignment
4. Proceeds with that single role

### File Manifest

```
packages/api/src/summit_cap/middleware/auth.py        # JWT validation, get_current_user
packages/api/src/summit_cap/schemas/auth.py           # TokenPayload model
packages/api/src/summit_cap/core/keycloak.py          # JWKS client with caching
packages/api/tests/test_auth.py                       # Unit tests for auth middleware
```

### Key File Contents

**packages/api/src/summit_cap/core/keycloak.py:**
```python
# This project was developed with assistance from AI tools.
"""Keycloak JWKS client with caching for JWT validation."""

import logging
import time

import httpx
from jose import jwk

from summit_cap.core.config import settings

logger = logging.getLogger("summit_cap.core.keycloak")

_jwks_cache: dict = {}
_jwks_cache_time: float = 0.0
JWKS_CACHE_DURATION = 300  # 5 minutes


async def get_jwks() -> dict:
    """Fetch Keycloak JWKS with 5-minute caching.
    Cache is busted on signature verification failure (caller retries)."""
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < JWKS_CACHE_DURATION:
        return _jwks_cache

    return await _fetch_jwks()


async def _fetch_jwks() -> dict:
    """Fetch JWKS from Keycloak and update cache."""
    global _jwks_cache, _jwks_cache_time

    jwks_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        f"/protocol/openid-connect/certs"
    )
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(jwks_url, timeout=10.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_cache_time = time.time()
            logger.debug("JWKS refreshed from Keycloak")
            return _jwks_cache
    except httpx.HTTPError as e:
        logger.error("Failed to fetch JWKS from Keycloak: %s", e)
        if _jwks_cache:
            logger.warning("Using stale JWKS cache")
            return _jwks_cache
        raise


async def bust_jwks_cache() -> dict:
    """Force-refresh JWKS cache (called on signature verification failure)."""
    return await _fetch_jwks()
```

**packages/api/src/summit_cap/middleware/auth.py:**
```python
# This project was developed with assistance from AI tools.
"""Authentication middleware -- JWT validation and UserContext extraction."""

import logging
from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from summit_cap.core.config import settings
from summit_cap.core.keycloak import bust_jwks_cache, get_jwks
from summit_cap.schemas.auth import TokenPayload
from summit_cap.schemas.common import UserContext

logger = logging.getLogger("summit_cap.middleware.auth")
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> UserContext:
    """Extract and validate JWT token, return UserContext.

    Raises:
        HTTPException 401: Invalid or expired token
        HTTPException 403: Valid token but no application role
        HTTPException 503: Keycloak unreachable and no cached JWKS
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authentication token")

    token = credentials.credentials
    payload = await _validate_token(token)

    try:
        role = payload.get_primary_role()
    except ValueError:
        logger.warning(
            "Token for user %s has no application role", payload.sub
        )
        raise HTTPException(status_code=403, detail="No application role assigned")

    user = UserContext(
        user_id=UUID(payload.sub),
        role=role,
        email=payload.email,
        name=payload.name,
    )

    # Set on request.state for Starlette middleware (PII masking) that runs outside DI scope
    request.state.user_context = user

    return user


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> UserContext | None:
    """Optional authentication -- returns None for unauthenticated requests.
    Used for public routes that may optionally accept authentication."""
    if credentials is None:
        return None
    try:
        return await get_current_user(
            request=request,
            credentials=credentials,
        )
    except HTTPException:
        return None


async def _validate_token(token: str) -> TokenPayload:
    """Validate JWT signature and decode claims.

    Attempts validation with cached JWKS first. On signature failure,
    busts cache and retries once (handles Keycloak key rotation).
    """
    try:
        jwks = await get_jwks()
        payload = _decode_jwt(token, jwks)
        return TokenPayload(**payload)
    except JWTError:
        # Cache-bust and retry
        logger.info("JWT validation failed with cached JWKS, retrying with fresh JWKS")
        try:
            jwks = await bust_jwks_cache()
            payload = _decode_jwt(token, jwks)
            return TokenPayload(**payload)
        except JWTError as e:
            logger.warning("JWT validation failed after JWKS refresh: %s", e)
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        except Exception:
            raise HTTPException(status_code=503, detail="Authentication service unavailable")
    except Exception:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")


def _decode_jwt(token: str, jwks: dict) -> dict:
    """Decode and validate a JWT using JWKS."""
    return jwt.decode(
        token,
        jwks,
        algorithms=["RS256"],
        audience=settings.keycloak_client_id,
        issuer=f"{settings.keycloak_url}/realms/{settings.keycloak_realm}",
        options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
    )
```

### Exit Conditions

```bash
# Auth middleware unit tests
cd packages/api && uv run pytest tests/test_auth.py -v

# Keycloak client tests
cd packages/api && uv run pytest tests/test_auth.py::test_jwks_caching -v
cd packages/api && uv run pytest tests/test_auth.py::test_expired_token_returns_401 -v
cd packages/api && uv run pytest tests/test_auth.py::test_no_role_returns_403 -v
cd packages/api && uv run pytest tests/test_auth.py::test_keycloak_down_returns_503 -v
```

---

## WU-4: RBAC Middleware Pipeline

### Description

Implement the three-layer RBAC enforcement for Phase 1: API-level route access, data scope injection, CEO PII masking, CEO document restriction, and the agent tool authorization framework. This WU creates the middleware pipeline that all subsequent phases depend on.

### Stories Covered

- S-1-F14-01: API-level RBAC enforcement
- S-1-F14-02: Data scope injection for LO pipeline
- S-1-F14-03: CEO PII masking enforcement
- S-1-F14-04: CEO document access restriction (metadata only)
- S-1-F14-05: Agent tool authorization at execution time

### Data Flow: RBAC Pipeline (Happy Path)

```
Request arrives with Bearer token
  |
  v
[Auth Middleware] -- validates JWT, creates UserContext
  |
  v
[RBAC Route Guard] -- checks user.role against route's allowed roles
  |                    If denied: 403 Forbidden (before handler)
  v
[Data Scope Injection] -- injects role-specific filters:
  |                        LO: assigned_to = user_id
  |                        CEO: pii_mask = True
  v
[Route Handler] -- executes with scoped UserContext
  |
  v
[PII Masking Middleware] -- if user.role == CEO:
  |                          mask SSN, DOB, account numbers in response
  |                          If masking fails: 500 (never send unmasked)
  v
Response sent to client
```

### Data Flow: Agent Tool Authorization (Phase 1 Framework)

```
Agent decides to invoke a tool
  |
  v
[Pre-Tool Authorization Node] -- reads user_role from session JWT
  |                               checks: role in tool.allowed_roles
  |
  +-- Authorized: tool executes normally
  |
  +-- Unauthorized: returns authorization error to agent
                    agent communicates restriction to user
                    audit event written (security_event)
```

Note: Phase 1 implements this as a standalone function with unit tests. Integration with actual LangGraph agent graphs happens in Phase 2.

### Data Flow: Error Paths

**Unauthorized route access:**
1. User with role `borrower` requests `/api/admin/seed`
2. Route guard checks: `borrower` not in `["admin"]`
3. Returns 403 Forbidden before handler executes
4. Logs: user_id, role, route, timestamp, reason

**LO accessing out-of-scope application:**
1. LO requests `/api/applications/{id}` where `id` is not in their pipeline
2. Data scope injection sets `assigned_to = <user_id>`
3. Query returns no results (application not in LO's scope)
4. Returns 404 (not 403 -- prevents information leakage)

**CEO requests document content:**
1. CEO requests `/api/documents/{id}/content`
2. Route guard for this path explicitly blocks CEO role
3. Returns 403 Forbidden
4. Logs the attempt

**PII masking failure:**
1. CEO requests data, handler returns response
2. PII masking middleware encounters unexpected data structure
3. Masking raises exception
4. Response middleware catches exception
5. Returns 500 Internal Server Error
6. Logs error with full context
7. NEVER sends unmasked response

### File Manifest

```
packages/api/src/summit_cap/middleware/rbac.py         # Route guards, data scope injection
packages/api/src/summit_cap/middleware/pii_masking.py   # CEO PII masking
packages/api/src/summit_cap/agents/tool_auth.py        # Agent tool authorization framework
packages/api/tests/test_rbac.py                        # RBAC middleware unit tests
packages/api/tests/test_pii_masking.py                 # PII masking tests
packages/api/tests/test_tool_auth.py                   # Tool authorization tests
```

### Key File Contents

**packages/api/src/summit_cap/middleware/rbac.py:**
```python
# This project was developed with assistance from AI tools.
"""RBAC middleware -- route-level access control and data scope injection."""

import logging
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from summit_cap.middleware.auth import get_current_user
from summit_cap.middleware.pii_masking import mask_pii_for_ceo
from summit_cap.schemas.common import UserContext, UserRole

logger = logging.getLogger("summit_cap.middleware.rbac")


# --- Route-level access control (Layer 1) ---

def require_roles(*roles: UserRole) -> Callable:
    """FastAPI dependency that enforces role-based route access.

    Usage:
        @router.get("/admin/seed", dependencies=[Depends(require_roles(UserRole.ADMIN))])
        async def seed_data(...): ...
    """
    async def check_role(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role not in roles:
            logger.warning(
                "RBAC denial: user=%s role=%s attempted route requiring %s",
                user.user_id, user.role, roles,
            )
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource",
            )
        return user
    return check_role


# --- Data scope injection ---

async def inject_data_scope(
    user: UserContext = Depends(get_current_user),
) -> UserContext:
    """Inject role-specific data scope filters into UserContext.

    - LO: assigned_to = user_id (see only own pipeline)
    - CEO: pii_mask = True (trigger PII masking in response)
    - Underwriter: full_pipeline = True (see all applications)
    - Borrower: own_data_only = True (see only own application)
    """
    if user.role == UserRole.LOAN_OFFICER:
        user.data_scope["assigned_to"] = str(user.user_id)
    elif user.role == UserRole.CEO:
        user.data_scope["pii_mask"] = True
    elif user.role == UserRole.BORROWER:
        user.data_scope["own_data_only"] = True
        user.data_scope["user_id"] = str(user.user_id)
    elif user.role == UserRole.UNDERWRITER:
        user.data_scope["full_pipeline"] = True
    return user


# --- CEO document access restriction (partial -- route-level block) ---

CEO_BLOCKED_PATHS = {
    "/api/documents/{id}/content",  # CEO cannot access document content
}


def require_non_ceo_for_content() -> Callable:
    """Block CEO role from document content endpoints (REQ-CC-03 Layer 1)."""
    async def check(user: UserContext = Depends(get_current_user)) -> UserContext:
        if user.role == UserRole.CEO:
            logger.warning(
                "CEO document content access blocked: user=%s", user.user_id
            )
            raise HTTPException(
                status_code=403,
                detail="CEO role cannot access document content",
            )
        return user
    return check


# --- Response middleware for PII masking ---

class PIIMaskingMiddleware(BaseHTTPMiddleware):
    """Apply PII masking to all responses for the CEO role.
    If masking fails, returns 500 (never sends unmasked data)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Check if this is a CEO request (set by auth middleware)
        user_context = getattr(request.state, "user_context", None)
        if user_context and user_context.role == UserRole.CEO:
            # Only mask JSON responses
            if response.headers.get("content-type", "").startswith("application/json"):
                try:
                    body = b""
                    async for chunk in response.body_iterator:
                        body += chunk if isinstance(chunk, bytes) else chunk.encode()

                    import json
                    data = json.loads(body)
                    masked = mask_pii_for_ceo(data)
                    masked_body = json.dumps(masked).encode()

                    return Response(
                        content=masked_body,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type="application/json",
                    )
                except Exception:
                    logger.error(
                        "PII masking failed for CEO request -- returning 500",
                        exc_info=True,
                    )
                    return JSONResponse(
                        status_code=500,
                        content={"error": "Internal server error during response processing"},
                    )

        return response
```

**packages/api/src/summit_cap/agents/tool_auth.py:**
```python
# This project was developed with assistance from AI tools.
"""Agent tool authorization framework (Layer 3 RBAC).

Implements the pre-tool authorization check described in REQ-CC-04 and
REQ-CC-12. This module provides the authorization function; integration
with LangGraph pre-tool nodes happens in Phase 2.
"""

import logging
from uuid import UUID

from summit_cap.schemas.common import UserRole

logger = logging.getLogger("summit_cap.agents.tool_auth")


class ToolAuthorizationError(Exception):
    """Raised when a user is not authorized to invoke a tool."""

    def __init__(self, user_role: str, tool_name: str) -> None:
        self.user_role = user_role
        self.tool_name = tool_name
        super().__init__(
            f"Role '{user_role}' is not authorized to invoke tool '{tool_name}'"
        )


# Tool authorization registry -- maps tool name to allowed roles.
# This is loaded from config/agents/*.yaml in production.
# Defined here as a fallback for testing and validation.
TOOL_AUTHORIZATION: dict[str, set[str]] = {
    "product_info": {r.value for r in UserRole},  # All roles
    "affordability_calc": {r.value for r in UserRole},  # All roles
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


def check_tool_authorization(
    user_role: str,
    tool_name: str,
    user_id: UUID | None = None,
) -> bool:
    """Check if a user role is authorized to invoke a specific tool.

    This function is called by the LangGraph pre-tool node immediately
    before each tool invocation. Authorization results are NOT cached
    across conversation turns (per REQ-CC-04).

    Args:
        user_role: The user's role from JWT claims.
        tool_name: The name of the tool being invoked.
        user_id: The user's ID (for audit logging).

    Returns:
        True if authorized.

    Raises:
        ToolAuthorizationError: If the role is not authorized.
    """
    allowed_roles = TOOL_AUTHORIZATION.get(tool_name)

    if allowed_roles is None:
        logger.warning("Unknown tool '%s' -- denying by default", tool_name)
        raise ToolAuthorizationError(user_role, tool_name)

    if user_role not in allowed_roles:
        logger.warning(
            "Tool authorization denied: user=%s role=%s tool=%s",
            user_id, user_role, tool_name,
        )
        raise ToolAuthorizationError(user_role, tool_name)

    logger.debug(
        "Tool authorization granted: role=%s tool=%s", user_role, tool_name
    )
    return True


def load_tool_auth_from_config(agent_config: dict) -> dict[str, set[str]]:
    """Load tool authorization rules from an agent configuration YAML.

    Args:
        agent_config: Parsed YAML from config/agents/<persona>.yaml

    Returns:
        Dict mapping tool_name -> set of allowed role strings.
    """
    tools = agent_config.get("tools", [])
    auth_map: dict[str, set[str]] = {}
    for tool in tools:
        name = tool["name"]
        roles = set(tool.get("allowed_roles", []))
        auth_map[name] = roles
    return auth_map
```

**packages/api/src/summit_cap/main.py:**
```python
# This project was developed with assistance from AI tools.
"""FastAPI application entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from summit_cap.core.config import settings
from summit_cap.middleware.rbac import PIIMaskingMiddleware
from summit_cap.routes import health, public

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(
    title="Summit Cap Financial API",
    version="0.1.0",
    description="AI Banking Quickstart -- Summit Cap Financial",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PII masking middleware (must be added before routes)
app.add_middleware(PIIMaskingMiddleware)

# Route includes
app.include_router(health.router, tags=["health"])
app.include_router(public.router, prefix="/api/public", tags=["public"])

# Conditional route includes (added by feature WUs)
# from summit_cap.routes import hmda, admin
# app.include_router(hmda.router, prefix="/api/hmda", tags=["hmda"])
# app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
```

### Exit Conditions

```bash
# RBAC middleware tests
cd packages/api && uv run pytest tests/test_rbac.py -v

# PII masking tests
cd packages/api && uv run pytest tests/test_pii_masking.py -v

# Tool authorization tests
cd packages/api && uv run pytest tests/test_tool_auth.py -v

# Specific scenario tests
cd packages/api && uv run pytest tests/test_rbac.py::test_lo_data_scope_injection -v
cd packages/api && uv run pytest tests/test_rbac.py::test_ceo_document_content_blocked -v
cd packages/api && uv run pytest tests/test_rbac.py::test_expired_token_returns_401 -v
cd packages/api && uv run pytest tests/test_pii_masking.py::test_ssn_masked_for_ceo -v
cd packages/api && uv run pytest tests/test_pii_masking.py::test_masking_failure_returns_500 -v
cd packages/api && uv run pytest tests/test_tool_auth.py::test_borrower_cannot_submit_to_underwriting -v
```

---

## WU-7: RBAC Integration Tests

### Description

End-to-end integration tests that validate the full RBAC pipeline against a running FastAPI test server with a mock Keycloak. These tests exercise the auth -> RBAC -> handler -> PII masking pipeline, the HMDA isolation enforcement, and the tool authorization framework.

### Stories Covered

Cross-cutting validation of:
- S-1-F14-01 to S-1-F14-05 (RBAC enforcement at all layers)
- S-1-F25-01, S-1-F25-02, S-1-F25-04 (HMDA isolation via role separation)
- S-1-F25-03 (Demographic filter utility -- standalone test)

### Data Flow: Integration Test Setup

1. Test fixtures create an in-memory FastAPI test client
2. Mock JWKS is generated (RSA key pair)
3. Test tokens are minted for each role (borrower, loan_officer, underwriter, ceo)
4. Each test sends requests with role-specific tokens
5. Assertions verify correct access control behavior

### File Manifest

```
packages/api/tests/integration/__init__.py
packages/api/tests/integration/conftest.py             # Test fixtures, mock JWKS, token factory
packages/api/tests/integration/test_rbac_integration.py # Full pipeline tests
packages/api/tests/integration/test_hmda_isolation.py   # HMDA access control tests
packages/api/tests/integration/test_demographic_filter.py # Demographic filter utility tests
```

### Key File Contents

**packages/api/tests/integration/conftest.py:**
```python
# This project was developed with assistance from AI tools.
"""Integration test fixtures -- mock Keycloak, token factory, test database."""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from httpx import ASGITransport, AsyncClient
from jose import jwt

from summit_cap.main import app


@pytest.fixture(scope="session")
def rsa_key_pair():
    """Generate RSA key pair for mock JWT signing."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture
def token_factory(rsa_key_pair):
    """Factory for creating role-specific JWT tokens."""
    private_key, _ = rsa_key_pair

    def create_token(
        role: str,
        user_id: str | None = None,
        expired: bool = False,
    ) -> str:
        now = datetime.now(tz=timezone.utc)
        exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
        user_id = user_id or str(uuid4())
        payload = {
            "sub": user_id,
            "email": f"{role}@example.com",
            "preferred_username": role,
            "name": f"Test {role.title()}",
            "realm_access": {"roles": [role]},
            "iss": "http://localhost:8080/realms/summit-cap",
            "aud": "summit-cap-api",
            "exp": int(exp.timestamp()),
            "iat": int(now.timestamp()),
        }
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        return jwt.encode(payload, pem, algorithm="RS256")

    return create_token


@pytest.fixture
async def client():
    """Async test client for the FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

**Test scenarios to implement:**

| Test | Method | Expected |
|------|--------|----------|
| `test_health_no_auth` | GET /health | 200 |
| `test_public_products_no_auth` | GET /api/public/products | 200 |
| `test_protected_route_no_token` | GET /api/applications | 401 |
| `test_protected_route_expired_token` | GET /api/applications | 401 |
| `test_borrower_access_own_route` | GET /borrower path with borrower token | 200 |
| `test_borrower_blocked_from_lo_route` | GET /loan-officer path with borrower token | 403 |
| `test_ceo_blocked_from_document_content` | GET /api/documents/{id}/content with CEO token | 403 |
| `test_ceo_pii_masking_ssn` | GET /api/applications/{id} with CEO token | SSN is masked |
| `test_ceo_pii_masking_dob` | GET /api/applications/{id} with CEO token | DOB is masked |
| `test_lo_data_scope_filters_pipeline` | GET /api/applications with LO token | Only assigned apps returned |
| `test_hmda_endpoint_uses_compliance_pool` | POST /api/hmda/collect | Uses compliance_app |
| `test_lending_app_cannot_query_hmda` | Direct DB query via lending_app | Permission denied |
| `test_tool_auth_borrower_blocked_from_submit` | check_tool_authorization("borrower", "submit_to_underwriting") | ToolAuthorizationError |
| `test_tool_auth_ceo_can_query_analytics` | check_tool_authorization("ceo", "analytics_query") | True |
| `test_demographic_filter_detects_race` | filter("race: Hispanic") | Detected, excluded |
| `test_demographic_filter_passes_clean_text` | filter("income: $80,000") | No detection |

### Exit Conditions

```bash
# All integration tests pass
cd packages/api && uv run pytest tests/integration/ -v

# Specific scenarios
cd packages/api && uv run pytest tests/integration/test_rbac_integration.py -v
cd packages/api && uv run pytest tests/integration/test_hmda_isolation.py -v
cd packages/api && uv run pytest tests/integration/test_demographic_filter.py -v
```

---

*This chunk is part of the Phase 1 Technical Design. See `plans/technical-design-phase-1.md` for the hub document with all binding contracts and the dependency graph.*
