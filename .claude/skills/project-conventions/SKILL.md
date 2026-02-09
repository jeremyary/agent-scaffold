---
description: Customizable project conventions template. Adapt these settings to match your specific project's technology stack, structure, and standards.
user_invocable: false
---

# Project Conventions

Customize the sections below to match your project. All agents reference these conventions when making implementation decisions.

## Technology Stack

<!-- Update these to match your project -->

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Language | Python | 3.12+ |
| Backend Framework | FastAPI / Flask / Django | — |
| Frontend Language | TypeScript | 5.x |
| Frontend Framework | React | 19.x |
| Frontend Build | Vite | 6.x |
| Database | PostgreSQL / MySQL / MongoDB | — |
| ORM | SQLAlchemy / SQLModel / Django ORM | — |
| Backend Testing | pytest | — |
| Frontend Testing | Vitest / Jest | — |
| E2E Testing | Playwright / Cypress | — |
| Backend Package Manager | uv / pip / poetry | — |
| Frontend Package Manager | npm / pnpm / yarn | — |
| CI/CD | GitHub Actions / GitLab CI | — |
| Container | Docker | — |
| Cloud | AWS / GCP / Azure / OpenShift | — |

## Project Structure

<!-- Define your project's directory layout -->

```
project/
├── src/                  # Python backend
│   ├── api/              # API route handlers / views
│   ├── services/         # Business logic
│   ├── models/           # Data models / ORM entities
│   ├── middleware/        # ASGI/WSGI middleware
│   ├── utils/            # Shared utilities
│   └── schemas/          # Pydantic schemas / serializers
├── web/                  # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page-level components / routes
│   │   ├── hooks/        # Custom React hooks
│   │   ├── api/          # API client layer
│   │   └── types/        # TypeScript type definitions
│   └── public/
├── tests/
│   ├── unit/             # Unit tests (pytest)
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests (Playwright)
├── migrations/           # Database migrations (Alembic, etc.)
├── plans/                # SDD planning artifacts (product plan, architecture, requirements)
│   └── reviews/          # Agent review documents (product-plan-review-*.md, etc.)
├── docs/
│   ├── adr/              # Architecture Decision Records
│   ├── api/              # API documentation
│   ├── product/          # PRDs and product plans (legacy — prefer plans/ for SDD)
│   ├── project/          # Work breakdowns, Jira/Linear exports
│   ├── technical-designs/ # Technical Design Documents
│   └── sre/              # SLOs, runbooks, incident reviews
├── infra/                # Infrastructure as code
│   ├── docker/
│   └── terraform/
└── scripts/              # Build and utility scripts
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
