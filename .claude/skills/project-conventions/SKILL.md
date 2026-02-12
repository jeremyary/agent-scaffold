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
│   ├── api/                  # FastAPI backend (uv/Python)
│   ├── db/                   # Database models & migrations (uv/Python)
│   └── configs/              # Shared ESLint, Prettier, Ruff configs
├── deploy/
│   └── helm/                 # Helm charts for OpenShift/Kubernetes
├── plans/                    # SDD planning artifacts (product plan, architecture, requirements)
│   └── reviews/              # Agent review documents
├── docs/
│   ├── api/                  # API documentation
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
| Work breakdown (per phase) | `plans/work-breakdown-phase-N.md` | @project-manager |

### Review File Naming Convention

```
plans/reviews/product-plan-review-architect.md
plans/reviews/product-plan-review-security-engineer.md
plans/reviews/architecture-review-security-engineer.md
plans/reviews/technical-design-phase-1-review-code-reviewer.md
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

## Cross-References

Detailed conventions are defined in the rules files — do not duplicate here:

- **Naming:** `code-style.md`
- **Error handling:** `error-handling.md`
- **Git workflow:** `git-workflow.md`
- **API design:** `api-conventions.md`
- **Frontend patterns:** `ui-development.md` (path-scoped to `packages/ui/`)
- **Database patterns:** `database-development.md` (path-scoped to `packages/db/`)
- **Backend patterns:** `api-development.md` (path-scoped to `packages/api/`)
