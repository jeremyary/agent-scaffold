# Project Architecture

<!-- This rule describes the monorepo structure and inter-package dependencies. -->
<!-- Update to match your actual project layout after running the setup wizard. -->

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

<!-- Update these commands to match your project's Makefile or scripts. -->

```bash
# Setup
make setup              # Install all dependencies (Node + Python)

# Development
make dev                # Start all dev servers (UI + API)
make db-start           # Start database container
make db-upgrade         # Run database migrations

# Quality
make lint               # Run linters across all packages
make test               # Run tests across all packages

# Containers
make containers-build   # Build all container images
make containers-up      # Start all services via compose
```

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
