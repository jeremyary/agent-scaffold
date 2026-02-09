---
description: Customizable project conventions template. Adapt these settings to match your specific project's technology stack, structure, and standards.
user_invocable: false
---

# Project Conventions

Customize the sections below to match your project. All agents reference these conventions when making implementation decisions.

## Technology Stack

<!-- Update these to match your project. The defaults below reflect a typical full-stack setup. -->

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Language | Python | 3.11+ |
| Backend Framework | FastAPI | — |
| Frontend Language | TypeScript | 5.x |
| Frontend Framework | React | 19.x |
| Frontend Build | Vite | 6.x |
| Frontend Routing | TanStack Router | — |
| Frontend State | TanStack Query | — |
| Frontend Styling | Tailwind CSS + shadcn/ui | — |
| Database | PostgreSQL | — |
| ORM | SQLAlchemy 2.0 (async) | — |
| Migrations | Alembic | — |
| Backend Testing | pytest | — |
| Frontend Testing | Vitest + React Testing Library | — |
| E2E Testing | Playwright | — |
| Backend Package Manager | uv | — |
| Frontend Package Manager | pnpm | — |
| Build System | Turborepo | — |
| CI/CD | GitHub Actions | — |
| Container | Podman / Docker | — |
| Cloud | OpenShift / Kubernetes | — |

## Project Structure

<!-- Update to match your project's directory layout. The default below is a Turborepo monorepo. -->

```
project/
├── packages/
│   ├── ui/                   # React frontend (pnpm)
│   │   ├── src/
│   │   │   ├── components/   # UI components (atoms, molecules, organisms, templates)
│   │   │   ├── routes/       # TanStack Router file-based routes
│   │   │   ├── hooks/        # Custom React hooks (TanStack Query wrappers)
│   │   │   ├── services/     # API client functions
│   │   │   ├── schemas/      # Zod schemas for API response validation
│   │   │   ├── styles/       # Global CSS and Tailwind config
│   │   │   └── test/         # Test utilities and setup
│   │   └── vitest.config.ts
│   ├── api/                  # FastAPI backend (uv/Python)
│   │   ├── src/
│   │   │   ├── core/         # Settings and configuration
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── schemas/      # Pydantic request/response models
│   │   │   ├── models/       # SQLAlchemy models (re-exported from db)
│   │   │   └── main.py       # FastAPI application entry point
│   │   └── tests/
│   ├── db/                   # Database models & migrations (uv/Python)
│   │   ├── src/db/
│   │   │   ├── database.py   # Connection and session management
│   │   │   └── models.py     # SQLAlchemy model definitions
│   │   └── alembic/          # Alembic migration versions
│   └── configs/              # Shared ESLint, Prettier, Ruff configs
├── deploy/
│   └── helm/                 # Helm charts for OpenShift/Kubernetes
├── plans/                    # SDD planning artifacts (product plan, architecture, requirements)
│   └── reviews/              # Agent review documents (product-plan-review-*.md, etc.)
├── docs/
│   ├── adr/                  # Architecture Decision Records
│   ├── api/                  # API documentation
│   ├── product/              # PRDs and product plans (legacy — prefer plans/ for SDD)
│   ├── project/              # Work breakdowns, Jira/Linear exports
│   ├── technical-designs/    # Technical Design Documents
│   └── sre/                  # SLOs, runbooks, incident reviews
├── compose.yml               # Local development with containers
├── turbo.json                # Turborepo pipeline configuration
└── Makefile                  # Common development commands
```

## Planning Artifacts (SDD Workflow)

When following the Spec-Driven Development workflow (see `workflow-patterns/SKILL.md`), planning artifacts live in `plans/` with agent reviews in `plans/reviews/`.

| Artifact | Path | Produced By |
|----------|------|-------------|
| Product plan | `plans/product-plan.md` | @product-manager |
| Architecture design | `plans/architecture.md` | @architect |
| Requirements document | `plans/requirements.md` | @requirements-analyst |
| Technical design (per phase) | `plans/technical-design-phase-N.md` | @tech-lead |
| Agent review | `plans/reviews/<artifact>-review-<agent-name>.md` | Reviewing agent |
| Work breakdown (per phase) | `docs/project/work-breakdown-phase-N.md` | @project-manager |

### Review File Naming Convention

```
plans/reviews/product-plan-review-architect.md
plans/reviews/product-plan-review-api-designer.md
plans/reviews/product-plan-review-security-engineer.md
plans/reviews/architecture-review-security-engineer.md
plans/reviews/architecture-review-sre-engineer.md
plans/reviews/requirements-review-product-manager.md
plans/reviews/requirements-review-architect.md
plans/reviews/technical-design-phase-1-review-code-reviewer.md
```

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Python files | snake_case | `user_profile.py` |
| Python variables/functions | snake_case | `get_user_profile` |
| Python classes | PascalCase | `UserProfile` |
| React component files | PascalCase | `UserProfile.tsx` |
| React hooks | camelCase with `use` prefix | `useUserProfile.ts` |
| TypeScript utility files | kebab-case | `api-client.ts` |
| TypeScript variables/functions | camelCase | `getUserProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| DB tables | snake_case | `user_profiles` |
| DB columns | snake_case | `created_at` |
| API endpoints | kebab-case | `/user-profiles` |
| Env variables | UPPER_SNAKE_CASE | `DATABASE_URL` |

## Error Handling Pattern

<!-- Customize for your project's error handling approach -->

### Backend (Python)

```python
class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)

class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(
            message=f"{resource} {id} not found",
            code="NOT_FOUND",
            status_code=404,
        )
```

### Frontend (TypeScript)

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
```

## Environment Configuration

<!-- List required environment variables -->

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENV` | Yes | `development`, `staging`, `production` |
| `PORT` | No | Server port (default: 8000) |
| `DATABASE_URL` | Yes | Database connection string |
| `LOG_LEVEL` | No | Logging level (default: `info`) |
| `SECRET_KEY` | Yes | Application secret key |
| `CORS_ORIGINS` | No | Allowed CORS origins (default: `http://localhost:5173`) |

## Git Workflow

<!-- Customize merge strategy and branch rules for your project. -->
<!-- The git-workflow rule (.claude/rules/git-workflow.md) defines commit conventions. -->
<!-- Override the merge strategy below to match your team's preference. -->

- Branch from `main`
- PR required for merge
- At least 1 approval required
- CI must pass before merge
- Rebase onto main before merging (prefer linear history)

## Frontend Architecture

<!-- Customize for your project's frontend patterns. Remove if backend-only. -->
<!-- For detailed path-scoped rules, see .claude/rules/ui-development.md -->

### Routing

TanStack Router with file-based route definitions:

| File | Route |
|------|-------|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/users/$id.tsx` | `/users/:id` (dynamic) |
| `routes/__root.tsx` | Root layout wrapper |

### State Management

- **Server state:** TanStack Query for all API data (fetching, caching, synchronization)
- **Client state:** React hooks (`useState`, `useReducer`) for local UI state
- **No global state library** unless the project genuinely needs client-side state beyond server cache

### Component Organization

Atomic design pattern:

```
components/
├── atoms/           # Basic building blocks (Button, Input, Badge)
├── molecules/       # Combinations of atoms (FormField, Card)
├── organisms/       # Complex components (Header, Footer, DataTable)
└── templates/       # Page layouts (DashboardLayout)
```

### API Integration Pattern

```
Component → Hook → TanStack Query → Service → API
```

- **Schemas** (`schemas/`): Zod schemas for API response validation
- **Services** (`services/`): Fetch functions that call the API and parse responses
- **Hooks** (`hooks/`): TanStack Query wrappers around services
- **Components**: Consume hooks for data, handle loading/error states

## Database Development

<!-- Customize for your project's database patterns. Remove if no database. -->
<!-- For detailed path-scoped rules, see .claude/rules/database-development.md -->

### ORM Patterns (SQLAlchemy 2.0)

Use the modern `Mapped[]` type annotations for all models:

```python
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

### Migration Workflow

1. Define or modify the SQLAlchemy model
2. Auto-generate migration: `alembic revision --autogenerate -m "description"`
3. **Review the generated migration** — auto-generate is not infallible
4. Apply: `alembic upgrade head`
5. Always provide both `upgrade()` and `downgrade()` functions

### Best Practices

- Index frequently queried columns
- Use server defaults for timestamps (`server_default=func.now()`)
- Use `async` sessions for all database operations
- Define relationships explicitly with `back_populates`

## Inter-Package Dependencies

<!-- Customize for your project's package dependency graph. -->

```
ui ──────► api (HTTP)
           │
           ▼
          db (Python import)
```

- The `ui` package calls the `api` via HTTP (configured via environment variable)
- The `api` package imports models from `db` as a Python dependency
- The `db` package is standalone and manages database connections/models
