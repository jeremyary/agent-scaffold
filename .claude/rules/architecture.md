# Project Architecture

<!-- TEMPLATE: This structure is created during /setup. Until then, the directory -->
<!-- layout below is aspirational — verify against the actual project before relying -->
<!-- on file paths described here. -->

## Monorepo Structure

This project uses a **Turborepo monorepo** with separate packages for frontend, backend, and database.

<!-- Update this tree to reflect your actual package layout. -->

```
project/
├── packages/
│   ├── ui/              # React frontend (pnpm)
│   ├── api/             # FastAPI backend (uv/Python)
│   ├── db/              # Database models & migrations (uv/Python)
│   └── configs/         # Shared ESLint, Prettier, Ruff configs
├── deploy/helm/         # Helm charts for OpenShift/Kubernetes
├── compose.yml          # Local development with containers
├── turbo.json           # Turborepo pipeline configuration
└── Makefile             # Common development commands
```

## Package Managers

- **Node.js packages** (ui, configs): Use `pnpm`
- **Python packages** (api, db): Use `uv`
- **Root commands**: Use `make` or `pnpm` (which delegates to Turbo)

## Key Commands

<!-- The canonical command list is in the root CLAUDE.md "Project Commands" section. -->
<!-- Update commands there; this section cross-references to avoid duplication. -->

See **Project Commands** in the root `CLAUDE.md` for the full command reference.

## Development URLs

<!-- Update ports to match your project's configuration. -->

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (Swagger UI)
- **Database**: postgresql://localhost:5432

## Inter-Package Dependencies

```
ui ──────► api (HTTP)
           │
           ▼
          db (Python import)
```

- The `ui` package calls the `api` via HTTP (configured via environment variable, e.g., `VITE_API_BASE_URL`)
- The `api` package imports models from `db` as a Python dependency
- The `db` package is standalone and manages database connections/models

## Environment Configuration

- `.env` — Local development variables (gitignored)
- `.env.example` — Template for required environment variables (committed)
- Production secrets managed via Helm values, OpenShift secrets, or your platform's secret management
