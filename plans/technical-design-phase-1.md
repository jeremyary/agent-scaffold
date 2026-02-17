# Technical Design: Phase 1 -- Foundation

## Overview

Phase 1 establishes the foundational infrastructure for the Summit Cap Financial AI Banking Quickstart: monorepo scaffolding, database schema with dual-role HMDA isolation, Keycloak authentication, RBAC middleware, LangFuse observability plumbing, model routing configuration, Docker Compose orchestration, demo data seeding, and the public-facing prospect landing page with affordability calculator. This is a greenfield project -- all files are created from scratch.

**Features covered (32 stories):**

| Feature | Stories | Description |
|---------|---------|-------------|
| F1 | S-1-F1-01 to S-1-F1-03 (3) | Public landing page, affordability calculator, prequalification chat stub |
| F2 | S-1-F2-01 to S-1-F2-03 (3) | Keycloak OIDC authentication, role-based route access, token refresh |
| F14 | S-1-F14-01 to S-1-F14-05 (5) | API RBAC, data scope injection, PII masking, CEO doc restriction, agent tool auth |
| F18 | S-1-F18-01 to S-1-F18-03 (3) | LangFuse callback integration, trace display, trace-to-audit correlation |
| F20 | S-1-F20-01 to S-1-F20-05 (5) | Demo data seeding, active apps, historical loans, idempotency, empty states |
| F21 | S-1-F21-01 to S-1-F21-04 (4) | Model routing classifier, fast/small routing, capable/large routing, YAML config |
| F22 | S-1-F22-01 to S-1-F22-04 (4) | Single-command setup, health checks, 10-min target, Compose profiles |
| F25 | S-1-F25-01 to S-1-F25-05 (5) | HMDA collection endpoint, PostgreSQL role separation, demographic filter, CI lint |

**Document structure (hub/chunk):** This hub document contains the project bootstrap plan, all cross-task interface contracts (Pydantic models, TypeScript types, API routes, database schema), the dependency graph, and Work Unit summaries with exit conditions. Detailed per-feature designs (data flows, error paths, file manifests) are in chunk files:

- `plans/technical-design-phase-1-chunk-infra.md` -- F21 (Model Routing), F22 (Docker Compose), F18 (LangFuse), project bootstrap
- `plans/technical-design-phase-1-chunk-auth.md` -- F2 (Keycloak Auth), F14 (RBAC)
- `plans/technical-design-phase-1-chunk-data.md` -- F25 (HMDA Isolation), F20 (Demo Data Seeding), database schema
- `plans/technical-design-phase-1-chunk-ui.md` -- F1 (Prospect Landing Page), frontend scaffolding

---

## System Context

**Architectural decisions that bind Phase 1 (inlined from ADRs):**

- **ADR-0001 (HMDA Isolation):** Dual-data-path with four-stage isolation. Separate `hmda` PostgreSQL schema, `compliance_app` role is sole accessor. Phase 1 establishes the schema, roles, connection pools, and HMDA collection endpoint.
- **ADR-0002 (Database):** PostgreSQL 16 + pgvector. Single instance for relational data, audit events, conversation checkpoints, and vector embeddings.
- **ADR-0003 (Frontend):** React + Vite SPA. TanStack Router (file-based routing), TanStack Query, shadcn/ui + Radix. No SSR.
- **ADR-0004 (LlamaStack):** Model serving abstraction. Application code interacts with a thin inference wrapper, not LlamaStack SDK directly.
- **ADR-0005 (Agent Security):** Four-layer defense -- input validation, system prompt hardening, tool authorization (pre-tool node), output filtering. Phase 1 implements the tool authorization layer.
- **ADR-0006 (Audit Trail):** Append-only PostgreSQL table, INSERT+SELECT only grants, trigger rejection of UPDATE/DELETE, hash chain tamper evidence.
- **ADR-0007 (Deployment):** podman-compose (default) / docker compose for local dev. Compose profiles for service subsets. Helm for OpenShift production (Phase 4b).
- **Monorepo tooling:** Turborepo + pnpm for TS packages, uv + hatchling for Python packages. Makefile wraps turbo.

**Maturity level:** PoC -- smoke tests, console errors acceptable, but component boundaries and data model are designed for production hardening without rearchitecture.

---

## Project Bootstrap

Phase 1 begins with a greenfield monorepo. The bootstrap work unit creates the directory structure, tooling configuration, and empty package scaffolding before any feature work begins.

### Monorepo Structure (canonical, from architecture Section 10)

```
summit-cap-financial/
  compose.yml
  Makefile
  turbo.json
  package.json
  pnpm-workspace.yaml
  pyproject.toml                       # Root uv workspace for Python packages
  README.md
  .gitignore
  .env.example
  config/
    app.yaml
    agents/
      public-assistant.yaml
    models.yaml
    keycloak/
      summit-cap-realm.json
  data/
    compliance-kb/
      tier1-federal/
      tier2-agency/
      tier3-internal/
      manifest.yaml
    demo/
      seed.json
  packages/
    ui/
      package.json
      vite.config.ts
      tsconfig.json
      tailwind.config.ts
      postcss.config.js
      index.html
      src/
        main.tsx
        app.tsx
        components/
        routes/
        hooks/
        services/
        schemas/
        styles/
          globals.css
      vitest.config.ts
    api/
      pyproject.toml
      src/summit_cap/
        __init__.py
        main.py
        core/
          __init__.py
          config.py
          settings.py
        middleware/
          __init__.py
          auth.py
          rbac.py
          pii_masking.py
        routes/
          __init__.py
          health.py
          public.py
          hmda.py
          admin.py
        agents/
          __init__.py
        services/
          __init__.py
          compliance/
            __init__.py
        inference/
          __init__.py
          client.py
        schemas/
          __init__.py
          common.py
          auth.py
          hmda.py
          calculator.py
      tests/
        __init__.py
        conftest.py
        test_health.py
    db/
      pyproject.toml
      src/summit_cap_db/
        __init__.py
        database.py
        models/
          __init__.py
          base.py
          application.py
          borrower.py
          document.py
          audit.py
          hmda.py
          demo.py
          conversation.py
      alembic/
        alembic.ini
        env.py
        versions/
    configs/
      package.json
  tests/
    integration/
    e2e/
```

### Tooling Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - "packages/ui"
  - "packages/configs"
```

**Root pyproject.toml** (uv workspace):
```toml
[project]
name = "summit-cap-financial"
version = "0.1.0"
requires-python = ">=3.11"

[tool.uv.workspace]
members = ["packages/api", "packages/db"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
```

**turbo.json:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] },
    "lint": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

**Makefile targets:**
```makefile
COMPOSE ?= podman-compose

.PHONY: setup dev test lint run

setup:
	pnpm install
	uv sync

dev:
	turbo run dev

test:
	turbo run test
	cd packages/api && uv run pytest
	cd packages/db && uv run pytest

lint:
	turbo run lint
	uv run ruff check packages/api packages/db

run:
	$(COMPOSE) --profile full up -d
	@echo "Waiting for services..."
	@$(COMPOSE) exec api python -m summit_cap.wait_for_services
	@echo "Running migrations..."
	@$(COMPOSE) exec api alembic upgrade head
	@echo "UI: http://localhost:3000"
	@echo "API: http://localhost:8000"
	@echo "LangFuse: http://localhost:3001"
	@echo "Keycloak: http://localhost:8080"

seed:
	$(COMPOSE) exec api python -m summit_cap.seed
```

---

## Interface Contracts: Summary

All binding contracts are defined here in the hub. Implementers must conform exactly to these shapes. Detailed designs in the chunk files reference these contracts by name.

### API Route Map (Phase 1)

| Method | Path | Auth Required | Roles | Handler | Feature |
|--------|------|--------------|-------|---------|---------|
| GET | `/health` | No | Any | `routes/health.py` | F22 |
| GET | `/api/public/products` | No | Any | `routes/public.py` | F1 |
| POST | `/api/public/calculate-affordability` | No | Any | `routes/public.py` | F1 |
| POST | `/api/hmda/collect` | Yes | borrower | `routes/hmda.py` | F25 |
| POST | `/api/admin/seed` | Yes | admin (dev only) | `routes/admin.py` | F20 |
| GET | `/api/admin/seed/status` | Yes | admin (dev only) | `routes/admin.py` | F20 |

**Note:** Phase 1 establishes the middleware pipeline and RBAC framework. The full `/api/applications/*`, `/api/documents/*`, `/api/audit/*`, `/api/chat` routes are added in Phases 2-4 as domain services are built. Phase 1 validates the framework with the routes above plus integration tests that exercise the RBAC middleware against stub endpoints.

### Pydantic Models (Python -- `packages/api/src/summit_cap/schemas/`)

See chunk file `technical-design-phase-1-chunk-auth.md` for the full auth/RBAC models. See chunk file `technical-design-phase-1-chunk-data.md` for HMDA and demo data models. Summary of all binding schemas:

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


class ApplicationStage(StrEnum):
    PROSPECT = "prospect"
    APPLICATION = "application"
    UNDERWRITING = "underwriting"
    CONDITIONAL_APPROVAL = "conditional_approval"
    FINAL_APPROVAL = "final_approval"
    CLOSING = "closing"
    CLOSED = "closed"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"


class AuditEventType(StrEnum):
    QUERY = "query"
    TOOL_CALL = "tool_call"
    DATA_ACCESS = "data_access"
    DECISION = "decision"
    OVERRIDE = "override"
    SYSTEM = "system"
    STATE_TRANSITION = "state_transition"
    SECURITY_EVENT = "security_event"
    HMDA_COLLECTION = "hmda_collection"
    HMDA_EXCLUSION = "hmda_exclusion"
    COMPLIANCE_CHECK = "compliance_check"
    COMMUNICATION_SENT = "communication_sent"


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


class HealthResponse(BaseModel):
    status: str  # "healthy" or "degraded"
    version: str
    services: dict[str, str]  # service_name -> "up" | "down"


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    request_id: str | None = None
```

```python
# packages/api/src/summit_cap/schemas/calculator.py

from pydantic import BaseModel, Field


class AffordabilityRequest(BaseModel):
    """Input for the affordability calculator (F1)."""

    gross_annual_income: float = Field(gt=0, description="Gross annual income in USD")
    monthly_debts: float = Field(ge=0, description="Total monthly debt payments in USD")
    down_payment: float = Field(ge=0, description="Available down payment in USD")
    interest_rate: float = Field(
        default=6.5, ge=0, le=15, description="Assumed annual interest rate (%)"
    )
    loan_term_years: int = Field(default=30, ge=10, le=40, description="Loan term in years")


class AffordabilityResponse(BaseModel):
    """Output from the affordability calculator."""

    max_loan_amount: float
    estimated_monthly_payment: float
    estimated_purchase_price: float
    dti_ratio: float
    dti_warning: str | None = None  # Set if DTI exceeds 43%
    pmi_warning: str | None = None  # Set if down payment < 3% of purchase price
```

```python
# packages/api/src/summit_cap/schemas/hmda.py

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HmdaCollectionRequest(BaseModel):
    """HMDA demographic data collection (F25).
    Written only to hmda schema via compliance_app pool."""

    application_id: UUID
    race: str | None = None
    ethnicity: str | None = None
    sex: str | None = None
    race_collected_method: str = Field(
        default="self_reported",
        description="'self_reported' or 'visual_observation'"
    )
    ethnicity_collected_method: str = Field(
        default="self_reported",
        description="'self_reported' or 'visual_observation'"
    )
    sex_collected_method: str = Field(
        default="self_reported",
        description="'self_reported' or 'visual_observation'"
    )


class HmdaCollectionResponse(BaseModel):
    """Response from HMDA collection endpoint."""

    id: UUID
    application_id: UUID
    collected_at: datetime
    status: str = "collected"
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

### TypeScript Interfaces (Frontend -- `packages/ui/src/`)

```typescript
// packages/ui/src/services/types.ts

export type UserRole =
    | "admin"
    | "prospect"
    | "borrower"
    | "loan_officer"
    | "underwriter"
    | "ceo";

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    // Tokens managed by keycloak-js (sessionStorage, tab-scoped).
    // Use getAccessToken() to read kc.token directly -- do not store in React state.
}

export interface HealthResponse {
    status: "healthy" | "degraded";
    version: string;
    services: Record<string, "up" | "down">;
}

export interface ErrorResponse {
    error: string;
    detail?: string;
    request_id?: string;
}

export interface ProductInfo {
    id: string;
    name: string;
    description: string;
    min_down_payment_pct: number;
    typical_rate: number;
}

export interface AffordabilityRequest {
    gross_annual_income: number;
    monthly_debts: number;
    down_payment: number;
    interest_rate?: number;
    loan_term_years?: number;
}

export interface AffordabilityResponse {
    max_loan_amount: number;
    estimated_monthly_payment: number;
    estimated_purchase_price: number;
    dti_ratio: number;
    dti_warning: string | null;
    pmi_warning: string | null;
}
```

```typescript
// packages/ui/src/services/api-client.ts

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function fetchHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
}

export async function fetchProducts(): Promise<ProductInfo[]> {
    const res = await fetch(`${API_BASE}/api/public/products`);
    return res.json();
}

export async function calculateAffordability(
    data: AffordabilityRequest,
): Promise<AffordabilityResponse> {
    const res = await fetch(`${API_BASE}/api/public/calculate-affordability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
```

### Keycloak Realm Configuration

The Keycloak realm JSON (`config/keycloak/summit-cap-realm.json`) pre-configures:

**Note:** Passwords are injected via environment variables at realm import time. Keycloak supports `${ENV_VAR}` substitution in realm JSON. See `.env.example` for defaults. DO NOT commit real passwords.

```json
{
    "realm": "summit-cap",
    "enabled": true,
    "sslRequired": "external",
    "accessTokenLifespan": 900,
    "refreshTokenLifespan": 28800,
    "refreshTokenRotation": true,
    "clients": [
        {
            "clientId": "summit-cap-ui",
            "publicClient": true,
            "standardFlowEnabled": true,
            "directAccessGrantsEnabled": false,
            "redirectUris": ["http://localhost:3000/*"],
            "webOrigins": ["http://localhost:3000"],
            "attributes": {
                "pkce.code.challenge.method": "S256"
            }
        },
        {
            "clientId": "summit-cap-api",
            "publicClient": false,
            "bearerOnly": true,
            "standardFlowEnabled": false
        }
    ],
    "roles": {
        "realm": [
            { "name": "prospect" },
            { "name": "borrower" },
            { "name": "loan_officer" },
            { "name": "underwriter" },
            { "name": "ceo" },
            { "name": "admin" }
        ]
    },
    "users": [
        {
            "username": "sarah.mitchell",
            "email": "sarah@example.com",
            "firstName": "Sarah",
            "lastName": "Mitchell",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "${DEMO_USER_PASSWORD}", "temporary": false }],
            "realmRoles": ["borrower"]
        },
        {
            "username": "james.torres",
            "email": "james@summitcap.example",
            "firstName": "James",
            "lastName": "Torres",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "${DEMO_USER_PASSWORD}", "temporary": false }],
            "realmRoles": ["loan_officer"]
        },
        {
            "username": "maria.chen",
            "email": "maria@summitcap.example",
            "firstName": "Maria",
            "lastName": "Chen",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "${DEMO_USER_PASSWORD}", "temporary": false }],
            "realmRoles": ["underwriter"]
        },
        {
            "username": "david.park",
            "email": "david@summitcap.example",
            "firstName": "David",
            "lastName": "Park",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "${DEMO_USER_PASSWORD}", "temporary": false }],
            "realmRoles": ["ceo"]
        },
        {
            "username": "admin",
            "email": "admin@summitcap.example",
            "firstName": "Admin",
            "lastName": "User",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "${ADMIN_PASSWORD}", "temporary": false }],
            "realmRoles": ["admin"]
        }
    ],
    "clientScopeMappings": {
        "summit-cap-ui": [
            { "client": "summit-cap-ui", "roles": ["prospect", "borrower", "loan_officer", "underwriter", "ceo", "admin"] }
        ]
    }
}
```

**Token claims structure:** Keycloak issues JWTs with `realm_access.roles` containing the user's role(s). The API middleware extracts the first matching application role.

### Database Schema (SQLAlchemy Models)

Full model definitions are in chunk file `technical-design-phase-1-chunk-data.md`. Summary of all tables created by Phase 1 migration:

**Public schema (lending_app role):**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `applications` | Mortgage application lifecycle | `id`, `borrower_id`, `stage`, `loan_type`, `property_address`, `loan_amount`, `property_value`, `assigned_to` |
| `borrowers` | Borrower identity | `id`, `keycloak_user_id`, `first_name`, `last_name`, `email`, `ssn_encrypted`, `dob` |
| `application_financials` | Income/debt/asset data | `id`, `application_id`, `gross_monthly_income`, `monthly_debts`, `total_assets`, `credit_score`, `dti_ratio` |
| `rate_locks` | Rate lock tracking | `id`, `application_id`, `locked_rate`, `lock_date`, `expiration_date`, `is_active` |
| `conditions` | Underwriting conditions | `id`, `application_id`, `description`, `severity`, `status`, `issued_by`, `responded_at`, `cleared_by` |
| `decisions` | Underwriting decisions | `id`, `application_id`, `decision_type`, `rationale`, `ai_recommendation`, `decided_by` |
| `documents` | Document metadata | `id`, `application_id`, `doc_type`, `file_path`, `status`, `quality_flags`, `uploaded_by` |
| `document_extractions` | Extracted data | `id`, `document_id`, `field_name`, `field_value`, `confidence`, `source_page` |
| `audit_events` | Append-only audit log | `id`, `timestamp`, `prev_hash`, `user_id`, `user_role`, `event_type`, `application_id`, `decision_id`, `event_data`, `source_document_id`, `session_id` |
| `audit_violations` | Rejected UPDATE/DELETE attempts | `id`, `timestamp`, `attempted_operation`, `user_role`, `table_name` |
| `conversation_checkpoints` | LangGraph state persistence | `id`, `user_id`, `thread_id`, `checkpoint_data`, `created_at` |
| `demo_data_manifest` | Demo data tracking | `id`, `seeded_at`, `config_hash`, `summary` |

**hmda schema (compliance_app role only):**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `hmda.demographics` | HMDA demographic data | `id`, `application_id`, `race`, `ethnicity`, `sex`, `collected_at`, `collection_method` |

### Model Routing Configuration

```yaml
# config/models.yaml

routing:
  default_tier: capable_large
  classification:
    strategy: rule_based  # "rule_based" for PoC, "llm_based" for production
    rules:
      simple:
        max_query_words: 10
        requires_tools: false
        patterns:
          - "status"
          - "when"
          - "what is"
          - "show me"
      complex:
        default: true  # Everything not classified as simple

models:
  fast_small:
    provider: llamastack
    model_name: "meta-llama/Llama-3.2-3B-Instruct"
    description: "Fast model for simple factual queries"
    endpoint: "${LLAMASTACK_URL:-http://llamastack:8321}/v1"
  capable_large:
    provider: llamastack
    model_name: "meta-llama/Llama-3.1-70B-Instruct"
    description: "Capable model for complex reasoning and tool use"
    endpoint: "${LLAMASTACK_URL:-http://llamastack:8321}/v1"
```

### LangFuse Configuration

```python
# packages/api/src/summit_cap/core/observability.py

from langfuse.callback import CallbackHandler as LangfuseCallbackHandler


def create_langfuse_handler(
    session_id: str,
    user_id: str | None = None,
    trace_name: str = "agent_invocation",
) -> LangfuseCallbackHandler | None:
    """Create a LangFuse callback handler for agent tracing.
    Returns None if LangFuse is unavailable (graceful degradation)."""
    try:
        handler = LangfuseCallbackHandler(
            session_id=session_id,
            user_id=user_id,
            trace_name=trace_name,
        )
        return handler
    except Exception:
        import logging
        logging.getLogger("summit_cap.observability").warning(
            "LangFuse unavailable -- tracing disabled for this invocation"
        )
        return None
```

---

## Cross-Cutting Implementation

### RBAC Enforcement (Three-Layer Pattern)

**Layer 1: API Gateway Middleware** (`packages/api/src/summit_cap/middleware/rbac.py`)

Every route declares its required roles using a FastAPI dependency:

```python
# Pattern for route-level RBAC
from fastapi import Depends, HTTPException

def require_roles(*roles: UserRole):
    """FastAPI dependency that enforces role-based route access."""
    async def check(user: UserContext = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return check

# Data scope injection for LO (UserContext is frozen -- return new instance)
async def inject_data_scope(user: UserContext) -> UserContext:
    """Injects data scope filters based on role.
    Returns a new UserContext instance (frozen model)."""
    if user.role == UserRole.LOAN_OFFICER:
        return user.model_copy(update={
            "data_scope": DataScope(assigned_to=str(user.user_id))
        })
    elif user.role == UserRole.CEO:
        return user.model_copy(update={
            "data_scope": DataScope(pii_mask=True)
        })
    return user
```

**Layer 2: Domain Services** -- Every service method receives `UserContext` and re-applies filters. Even if middleware is bypassed, the service blocks unauthorized data.

**Layer 3: Agent Tool Authorization** -- A LangGraph pre-tool node checks `user_role in tool.allowed_roles` before each tool invocation. See chunk file `technical-design-phase-1-chunk-auth.md` for the full implementation pattern.

### PII Masking (CEO Role)

```python
# packages/api/src/summit_cap/middleware/pii_masking.py

import re
from typing import Any


SSN_PATTERN = re.compile(r"\d{3}-\d{2}-\d{4}")
ACCOUNT_PATTERN = re.compile(r"\d{8,16}")

PII_FIELDS = {"ssn", "ssn_encrypted", "date_of_birth", "dob", "account_number"}


def mask_pii_for_ceo(data: Any) -> Any:
    """Recursively mask PII fields in response data for the CEO role.
    SSN: ***-**-XXXX (last 4), DOB: age or YYYY-**-**, Account: ****XXXX (last 4)."""
    if isinstance(data, dict):
        masked = {}
        for key, value in data.items():
            if key in {"ssn", "ssn_encrypted"} and isinstance(value, str):
                masked[key] = f"***-**-{value[-4:]}" if len(value) >= 4 else "***-**-****"
            elif key in {"dob", "date_of_birth"} and value is not None:
                masked[key] = f"{str(value)[:4]}-**-**" if isinstance(value, str) else "****-**-**"
            elif key == "account_number" and isinstance(value, str):
                masked[key] = f"****{value[-4:]}" if len(value) >= 4 else "********"
            else:
                masked[key] = mask_pii_for_ceo(value)
        return masked
    elif isinstance(data, list):
        return [mask_pii_for_ceo(item) for item in data]
    return data
```

The PII masking middleware is applied as a FastAPI response middleware that runs after the handler but before the response is sent. If masking fails (unexpected data structure), the middleware returns 500 and does not send the unmasked response.

### HMDA Isolation (Dual-Schema, Dual-Role)

**Database setup** (in initial Alembic migration):

```sql
-- Create schemas
CREATE SCHEMA IF NOT EXISTS hmda;

-- Create roles
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lending_app') THEN
        CREATE ROLE lending_app WITH LOGIN PASSWORD '${LENDING_APP_PASSWORD}';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'compliance_app') THEN
        CREATE ROLE compliance_app WITH LOGIN PASSWORD '${COMPLIANCE_APP_PASSWORD}';
    END IF;
END $$;

-- lending_app: full access to public schema, no access to hmda
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lending_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lending_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lending_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lending_app;
-- Explicitly REVOKE hmda access from lending_app
REVOKE ALL ON SCHEMA hmda FROM lending_app;

-- compliance_app: read hmda, read public, write audit_events
GRANT USAGE ON SCHEMA hmda TO compliance_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hmda TO compliance_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA hmda GRANT ALL ON TABLES TO compliance_app;
GRANT USAGE ON SCHEMA public TO compliance_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO compliance_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO compliance_app;
-- compliance_app can INSERT to audit_events
GRANT INSERT, SELECT ON audit_events TO compliance_app;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO compliance_app;

-- Audit table: restrict to INSERT + SELECT only for lending_app too
REVOKE UPDATE, DELETE ON audit_events FROM lending_app;
```

**Dual connection pools** (`packages/db/src/summit_cap_db/database.py`):

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Primary pool -- used by all services except Compliance
lending_engine = create_async_engine(
    settings.database_url_lending,  # postgresql+asyncpg://lending_app:...
    pool_size=10,
    max_overflow=5,
)
LendingSession = sessionmaker(lending_engine, class_=AsyncSession, expire_on_commit=False)

# Compliance pool -- used ONLY by Compliance Service
compliance_engine = create_async_engine(
    settings.database_url_compliance,  # postgresql+asyncpg://compliance_app:...
    pool_size=3,
    max_overflow=2,
)
ComplianceSession = sessionmaker(compliance_engine, class_=AsyncSession, expire_on_commit=False)
```

**CI lint check** (Makefile target):

```bash
lint-hmda:
	@echo "Checking HMDA isolation..."
	@if grep -rn --include="*.py" "hmda" packages/api/src/summit_cap/ \
	    | grep -v "services/compliance/" \
	    | grep -v "schemas/hmda.py" \
	    | grep -v "routes/hmda.py" \
	    | grep -v "__pycache__" \
	    | grep -v ".pyc"; then \
	    echo "ERROR: HMDA reference found outside Compliance Service"; exit 1; \
	fi
	@if grep -rn --include="*.py" "compliance_engine\|ComplianceSession" packages/api/src/summit_cap/ \
	    | grep -v "services/compliance/" \
	    | grep -v "database.py" \
	    | grep -v "__pycache__"; then \
	    echo "ERROR: compliance_app pool import found outside Compliance Service"; exit 1; \
	fi
	@echo "HMDA isolation check passed"
```

**Note on allowed HMDA references:** The `routes/hmda.py` file handles the HMDA collection endpoint routing but delegates to the Compliance Service for actual database writes. The `schemas/hmda.py` file defines Pydantic request/response models (no database access). Both are permitted references.

### Audit Trail Integration

Phase 1 creates the `audit_events` table and the immutability trigger, but does not implement the full audit event logging for every action (that is Phase 2+). Phase 1 establishes:

1. Table with proper grants (INSERT+SELECT only)
2. Database trigger rejecting UPDATE/DELETE
3. `audit_violations` table for rejected operations
4. Utility function for writing audit events (used by HMDA collection endpoint in Phase 1)

```python
# packages/api/src/summit_cap/services/audit.py

import json
from uuid import UUID, uuid4
import hashlib
from datetime import datetime, timezone

from sqlalchemy import select, text
from summit_cap_db.database import LendingSession
from summit_cap_db.models.audit import AuditEvent


async def write_audit_event(
    user_id: UUID,
    user_role: str,
    event_type: str,
    event_data: dict,
    application_id: UUID | None = None,
    decision_id: UUID | None = None,
    source_document_id: UUID | None = None,
    session_id: UUID | None = None,
) -> int:
    """Write an append-only audit event. Returns the event ID.
    Uses advisory lock for hash chain integrity."""
    async with LendingSession() as session:
        # Acquire advisory lock for serial hash chain computation
        await session.execute(text("SELECT pg_advisory_lock(1)"))
        try:
            # Get previous event for hash chain computation (ORM query builder)
            result = await session.execute(
                select(
                    AuditEvent.id,
                    AuditEvent.prev_hash,
                    AuditEvent.user_id,
                    AuditEvent.event_type,
                    AuditEvent.event_data,
                ).order_by(AuditEvent.id.desc()).limit(1)
            )
            prev = result.first()
            prev_hash = ""
            if prev:
                # Include content fields in hash -- do not add user-controlled
                # fields without sanitization
                hash_input = (
                    f"{prev.id}:{prev.prev_hash}:{prev.user_id}"
                    f":{prev.event_type}"
                    f":{json.dumps(prev.event_data, sort_keys=True)}"
                )
                prev_hash = hashlib.sha256(hash_input.encode()).hexdigest()

            # Insert new event
            new_event = AuditEvent(
                prev_hash=prev_hash,
                user_id=user_id,
                user_role=user_role,
                event_type=event_type,
                application_id=application_id,
                decision_id=decision_id,
                event_data=event_data,
                source_document_id=source_document_id,
                session_id=session_id,
            )
            session.add(new_event)
            await session.flush()
            event_id = new_event.id
            await session.commit()
            return event_id
        finally:
            await session.execute(text("SELECT pg_advisory_unlock(1)"))
```

### Observability (LangFuse Callback Pattern)

Every agent invocation creates a LangFuse callback handler with a `session_id` that is also written to the audit trail. This enables trace-to-audit correlation (F18-03).

```python
# Usage pattern in agent invocation (Phase 2+, stub in Phase 1)
from summit_cap.core.observability import create_langfuse_handler

session_id = str(uuid4())
handler = create_langfuse_handler(
    session_id=session_id,
    user_id=str(user_context.user_id),
    trace_name="public_assistant",
)
# handler is passed as a callback to LangGraph invoke
# The same session_id is used in write_audit_event calls
```

---

## Dependency Graph

### Feature Dependencies (Phase 1 internal)

```
F22 (Docker Compose) ─── required by everything (provides runtime)
  │
  ├──> F25-02 (DB roles/schemas) ─── must exist before any DB operations
  │      │
  │      ├──> F25-01 (HMDA endpoint) ─── needs compliance_app pool
  │      ├──> F20 (Demo data) ─── needs schema to exist
  │      └──> F14-01 (RBAC) ─── needs user tables
  │
  ├──> F2 (Auth/Keycloak) ─── needed for any authenticated route
  │      │
  │      ├──> F14 (RBAC middleware) ─── needs auth context
  │      ├──> F18 (LangFuse) ─── needs user context for traces
  │      └──> F1-03 (Chat stub) ─── the chat itself is unauthed, but the
  │                                   framework needs auth working for contrast
  │
  ├──> F21 (Model routing config) ─── parallel, no hard dependency
  │
  └──> F1 (Landing page) ─── depends on API + UI scaffolding only
```

### Work Unit Dependency Order

```
WU-0 (Bootstrap) ──────────────────────────────────────────────┐
  │                                                             │
  ├──> WU-1 (Database Schema + Roles)                           │
  │      │                                                      │
  │      ├──> WU-3 (HMDA Endpoint + Isolation)                  │
  │      ├──> WU-6 (Demo Data Seeding)                          │
  │      └──> WU-4 (RBAC Middleware)                             │
  │              │                                               │
  │              └──> WU-7 (Integration Tests)                   │
  │                                                              │
  ├──> WU-2 (Keycloak Auth + Token)                              │
  │      │                                                       │
  │      └──> WU-4 (RBAC Middleware) ← also needs WU-1           │
  │                                                              │
  ├──> WU-5 (LangFuse + Model Routing)                           │
  │                                                              │
  └──> WU-8 (Frontend Scaffolding + Landing Page)                │
         │                                                       │
         └──> WU-9 (Docker Compose + Full Stack) ← needs all ────┘
```

---

## Work Unit Summary

Each WU groups 2-4 related tasks that can be assigned to a single implementer. Exit conditions are machine-verifiable commands.

| WU | Title | Dependencies | Stories Covered | Exit Condition | Notes |
|----|-------|-------------|-----------------|----------------|-------|
| WU-0 | Project Bootstrap | None | Prerequisite (no stories -- enables all subsequent WUs) | See chunk-infra: 3 import checks (api, db, ui tsc) | |
| WU-1 | Database Schema, Roles, Migrations | WU-0 | S-1-F25-02, S-1-F20-04 (partial) | See chunk-data: alembic upgrade + HMDA permission denied check | |
| WU-2 | Keycloak Auth Integration | WU-0 | S-1-F2-01, S-1-F2-02, S-1-F2-03 | `cd packages/api && uv run pytest tests/test_auth.py -v` | |
| WU-3 | HMDA Collection Endpoint | WU-1 | S-1-F25-01, S-1-F25-04, S-1-F25-05 | `cd packages/api && uv run pytest tests/test_hmda.py -v` + `make lint-hmda` | Partial: demographic filter is standalone utility (extraction pipeline deferred to Phase 2, see TD-I-03) |
| WU-4 | RBAC Middleware Pipeline | WU-1, WU-2 | S-1-F14-01 to S-1-F14-05 | `cd packages/api && uv run pytest tests/test_rbac.py -v` | Partial: tool auth is framework-only (no LangGraph agents until Phase 2, see TD-I-04) |
| WU-5 | LangFuse + Model Routing Config | WU-0 | S-1-F18-01 to S-1-F18-03, S-1-F21-01 to S-1-F21-04 | See chunk-infra: pytest test_observability.py + test_model_routing.py | |
| WU-6 | Demo Data Seeding | WU-1 | S-1-F20-01, S-1-F20-02, S-1-F20-03 | `cd packages/api && uv run python -m summit_cap.seed --check` | |
| WU-7 | RBAC Integration Tests | WU-4, WU-3 | S-1-F14-01 to S-1-F14-05, S-1-F25-03 | `cd packages/api && uv run pytest tests/integration/ -v` | |
| WU-8 | Frontend Scaffolding + Landing Page | WU-0 | S-1-F1-01 to S-1-F1-03, S-1-F2-02 (route guards), S-1-F20-05 | `cd packages/ui && pnpm test -- --run` + `pnpm exec tsc --noEmit` | |
| WU-9 | Docker Compose + Full Stack | WU-0 through WU-8 | S-1-F22-01 to S-1-F22-04 | `make run && curl -sf http://localhost:8000/health \| jq -e '.status == "healthy"'` | |

Detailed Work Unit specifications (task breakdown, file manifests, error paths) are in the chunk files:
- WU-0, WU-5, WU-9: `technical-design-phase-1-chunk-infra.md`
- WU-2, WU-4, WU-7: `technical-design-phase-1-chunk-auth.md`
- WU-1, WU-3, WU-6: `technical-design-phase-1-chunk-data.md`
- WU-8: `technical-design-phase-1-chunk-ui.md`

---

## Context Package

### Infrastructure (WU-0, WU-5, WU-9)

**Files to read:** `turbo.json`, `Makefile`, `compose.yml`, `config/models.yaml`, `packages/api/src/summit_cap/core/observability.py`, `packages/api/src/summit_cap/inference/client.py`

**Binding contracts:**
- Model routing YAML schema (Section: Model Routing Configuration above)
- `HealthResponse` Pydantic model (Section: Pydantic Models above)
- LangFuse callback handler factory (`create_langfuse_handler` signature)
- Compose service names and profiles (compose.yml)

**Key decisions:**
- podman-compose is default runtime; docker compose is compatible alternative
- LangFuse degradation is graceful (no-op callback, warning log)
- Model routing is rule-based at PoC; config-driven for swappability
- Health endpoint checks all dependencies and reports per-service status

**Scope boundaries:** This group covers project scaffolding, tooling, Compose orchestration, model routing configuration, and LangFuse integration. It does NOT include any domain services, authentication, or frontend features.

### Authentication and RBAC (WU-2, WU-4, WU-7)

**Files to read:** `packages/api/src/summit_cap/middleware/auth.py`, `packages/api/src/summit_cap/middleware/rbac.py`, `packages/api/src/summit_cap/middleware/pii_masking.py`, `packages/api/src/summit_cap/schemas/auth.py`, `packages/api/src/summit_cap/schemas/common.py`, `config/keycloak/summit-cap-realm.json`

**Binding contracts:**
- `UserContext` Pydantic model (Section: Pydantic Models above)
- `TokenPayload` Pydantic model (Section: Pydantic Models above)
- `UserRole` enum (Section: Pydantic Models above)
- Keycloak realm configuration (Section: Keycloak Realm Configuration above)
- RBAC dependency pattern: `require_roles()`, `inject_data_scope()` (Section: RBAC Enforcement above)
- PII masking function: `mask_pii_for_ceo()` (Section: PII Masking above)

**Key decisions:**
- JWKS cached 5 min, cache-busted on verification failure
- Fail-closed: Keycloak unreachable -> 503 for all authenticated requests
- Multi-role tokens: use first matching role, log warning
- Data scope injection is part of RBAC middleware, not domain services (but services re-verify)
- PII masking failure -> 500, never send unmasked response

**Scope boundaries:** This group covers Keycloak integration, token validation, RBAC enforcement middleware (Layers 1 and 3), and PII masking. It does NOT include domain service logic (Layer 2 enforcement is a pattern applied by each service in later phases).

### Data Layer and HMDA (WU-1, WU-3, WU-6)

**Files to read:** `packages/db/src/summit_cap_db/database.py`, `packages/db/src/summit_cap_db/models/`, `packages/db/alembic/`, `packages/api/src/summit_cap/routes/hmda.py`, `packages/api/src/summit_cap/services/compliance/__init__.py`, `packages/api/src/summit_cap/schemas/hmda.py`

**Binding contracts:**
- All SQLAlchemy models (Section: Database Schema above, full definitions in chunk-data)
- Dual connection pool configuration (Section: HMDA Isolation above)
- `HmdaCollectionRequest`/`HmdaCollectionResponse` Pydantic models (Section: Pydantic Models above)
- Audit event schema and `write_audit_event()` function (Section: Audit Trail Integration above)
- CI lint check for HMDA isolation (Section: HMDA Isolation above)

**Key decisions:**
- Single Alembic migration creates all Phase 1 tables (lending + hmda schemas)
- PostgreSQL advisory lock for hash chain integrity in audit events
- Demo data seeding is idempotent via `demo_data_manifest` table
- `compliance_app` pool size is small (3) since only Compliance Service uses it
- Audit event `prev_hash` uses SHA-256 of previous event (id, prev_hash, user_id, event_type, event_data) for content-covering tamper evidence

**Scope boundaries:** This group covers database setup, migrations, HMDA isolation enforcement, demo data seeding, and audit trail infrastructure. It does NOT include domain service business logic or agent layer data access.

### Frontend (WU-8)

**Files to read:** `packages/ui/src/`, `packages/ui/package.json`, `packages/ui/vite.config.ts`

**Binding contracts:**
- TypeScript interfaces (`AuthUser`, `AffordabilityRequest`, `AffordabilityResponse`, etc.)
- API client functions (`fetchHealth`, `fetchProducts`, `calculateAffordability`)
- Route structure: `/` (public landing), `/products/*` (public products), `/borrower/*`, `/loan-officer/*`, `/underwriter/*`, `/ceo/*`
- Role-based route guards via TanStack Router `beforeLoad`

**Key decisions:**
- Single React SPA, no SSR
- TanStack Router for file-based routing with role guards
- TanStack Query for server state (with 401 interceptor for token refresh)
- shadcn/ui + Radix + Tailwind for components
- Keycloak JS adapter (`keycloak-js`) for OIDC flow in the browser
- Chat widget is a visual stub in Phase 1 (displays "Coming soon" or "AI unavailable" message)

**Scope boundaries:** This group covers React scaffolding, routing, auth UI flow, affordability calculator, and product landing page. It does NOT include chat interface implementation, document upload UI, pipeline dashboards, or executive charts (those are Phases 2-4).

---

## Cross-Task Dependencies

| Produces | Consumed By | Contract |
|----------|-------------|----------|
| WU-0 (Bootstrap) | All WUs | Package structure, import paths, tooling config |
| WU-1 (DB Schema) | WU-2, WU-3, WU-4, WU-6, WU-7 | SQLAlchemy models, Alembic migration, connection pools |
| WU-2 (Keycloak Auth) | WU-4, WU-7, WU-8 | `UserContext`, `TokenPayload`, `get_current_user` dependency |
| WU-3 (HMDA Endpoint) | WU-7 | HMDA collection route, compliance pool usage |
| WU-4 (RBAC) | WU-7, WU-8 | `require_roles()`, `inject_data_scope()`, `mask_pii_for_ceo()` |
| WU-5 (LangFuse + Routing) | WU-7 | `create_langfuse_handler()`, model routing config loader |
| WU-8 (Frontend) | WU-9 | Built UI container image, Vite dev server |
| WU-1 through WU-8 | WU-9 | All services ready for Compose orchestration |

---

## Requirements Inconsistencies Discovered

During design, I identified the following issues:

| ID | Issue | Severity | Recommendation |
|----|-------|----------|----------------|
| TD-I-01 | The task description states "F1: 5 stories" but the requirements chunk contains only 3 (S-1-F1-01 to S-1-F1-03). Similarly, "F2: 5 stories" but requirements has 3 (S-1-F2-01 to S-1-F2-03). The hub story map confirms 3 each. | Low | Use actual story counts from requirements (3 each). The task description had inaccurate counts. |
| TD-I-02 | The story map in requirements.md lists F1 as "Public Virtual Assistant with Guardrails" (suggesting chat + guardrails), but the product plan describes F1 as "Prospect Landing Page and Affordability Calculator" and F2 as just "Prospect Affordability and Pre-Qualification." The feature numbering between product plan and requirements is offset (product plan F1 = landing/calc, F2 = prequalification; requirements F1 covers all three). | Low | No design impact -- the Phase 1 stories are clear regardless of feature naming. Using requirements chunk as the source of truth for acceptance criteria. |
| TD-I-03 | S-1-F25-03 (Demographic data filter in document extraction pipeline) is in Phase 1 scope, but document extraction itself (F5) is Phase 2. The demographic filter cannot be fully tested without the extraction pipeline. | Medium | Phase 1 implements the filter as a standalone utility module with unit tests against synthetic extraction output. Full integration testing occurs in Phase 2 when the extraction pipeline is built. |
| TD-I-04 | S-1-F14-05 (Agent tool authorization) references LangGraph pre-tool nodes, but no agents exist in Phase 1 (agents are Phase 2+). | Medium | Phase 1 implements the authorization framework (the pre-tool node function and tool registry config) with unit tests. Integration with actual LangGraph agents occurs in Phase 2. |
| TD-I-05 | S-1-F20-05 (Empty state handling in all UIs) references LO pipeline, CEO dashboard, underwriter queue, and borrower assistant -- UIs that do not exist in Phase 1. | Low | Phase 1 implements empty state handling for the landing page and any Phase 1 UI surfaces. Later phases add empty states for their respective UIs. WU-8 covers the landing page empty state. |
| TD-I-06 | The requirements mention "S-1-F1-04" and "S-1-F1-05" and "S-1-F2-04"/"S-1-F2-05" in the task scope but these story IDs do not exist in the requirements document. | Info | These stories do not exist. The task scope description had inflated counts. All 32 actual stories are covered by this design. |

---

## Open Questions

| ID | Question | Impact | Blocker? |
|----|----------|--------|----------|
| TD-OQ-01 | Should the Phase 1 Alembic migration create ALL tables (including those not used until Phase 2+), or only Phase 1 tables? Creating all tables upfront means Phase 2 starts with schema in place; creating only Phase 1 tables means Phase 2 adds incremental migrations. | Medium -- affects migration strategy for all subsequent phases | No -- recommend creating all tables upfront since the schema is fully designed. This avoids migration ordering issues when Phase 2-4 features reference shared tables. |
| TD-OQ-02 | The F25-03 demographic filter requires semantic similarity detection. What embedding model should be used for the keyword+semantic filter at PoC level? Architecture OQ-A1 asks about embedding model for compliance KB but the demographic filter is a separate concern. | Low -- keyword matching alone may suffice for PoC | No -- implement keyword-only for Phase 1; add semantic similarity in Phase 2 when the extraction pipeline and embedding model are established. |
| TD-OQ-03 | Should the `admin` role (used for seed endpoint) be a Keycloak role or a separate mechanism (e.g., API key for dev-only routes)? | Low -- dev-only endpoint | No -- use Keycloak `admin` role for consistency. The seed endpoint is disabled in production via environment variable. |

---

## Checklist

- [x] All cross-task interface contracts defined with concrete types (no TBDs)
- [x] Data flow covers happy path and primary error paths (in chunk files)
- [x] Error handling strategy is feature-specific per chunk
- [x] File/module structure maps to architecture Section 10 project layout
- [x] Every Work Unit has a machine-verifiable exit condition
- [x] Cross-task dependency map complete
- [x] Context Package defined for each work area
- [x] No TBDs in binding contracts
- [x] Requirements inconsistencies flagged (TD-I-01 through TD-I-06)
