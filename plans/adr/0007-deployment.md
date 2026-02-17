# ADR-0007: Deployment Architecture

## Status
Amended (2026-02-16) -- Decision changed from Option 3 (Kustomize) to Option 2 (Helm) for cross-quickstart consistency with the ai-quickstart-template standard. See Amendment section below.

## Context

The application targets two deployment environments: local development (a developer running the full stack on their machine with a single command) and OpenShift AI production (enterprise container platform with model serving, object storage, and managed services). The same application code must run in both environments with only infrastructure configuration changes.

Stakeholder preferences:
- Single-command local setup that works in under 10 minutes (F22).
- Container platform deployment manifests (F23).
- OpenShift AI usage where natural (model serving, object storage, pipelines).
- Support both local inference and remote inference endpoints.

## Options Considered

### Option 1: Docker Compose Only
Docker Compose for local development. Manually translate to Kubernetes manifests for production.

- **Pros:** Simple local development experience. Docker Compose is widely understood.
- **Cons:** No shared manifest format between local and production. Manual translation introduces drift risk.

### Option 2: Docker Compose (Local) + Helm Charts (Production)
Docker Compose for local development. Helm charts for OpenShift/Kubernetes deployment.

- **Pros:** Docker Compose is the best DX for local development. Helm charts are the standard for Kubernetes deployments. Each format is optimized for its environment. Clear separation: local developers use Docker Compose; platform engineers use Helm. Cross-quickstart consistency -- the ai-quickstart-template establishes Helm as the standard deployment pattern. Full parameterization via values.yaml, conditionals, and environment-specific overrides.
- **Cons:** Two manifest formats to maintain. Risk of configuration drift. Helm's Go templates are less readable than plain YAML for beginners.

### Option 3: Docker Compose (Local) + Kustomize (Production)
Docker Compose for local development. Kustomize overlays for OpenShift/Kubernetes deployment.

- **Pros:** Same benefits as Option 2. Kustomize is lighter than Helm (no template engine, just overlays). Kustomize is built into kubectl/oc. Better for a reference architecture where users want to read and understand the manifests, not debug Helm templates.
- **Cons:** Two manifest formats. Kustomize is less powerful than Helm for complex parameterization.

### Option 4: Podman Compose / Podman Pod (Local) + Kubernetes Manifests
Use Podman instead of Docker for local development, with direct Kubernetes manifest generation.

- **Pros:** Podman can generate Kubernetes manifests from running pods, reducing drift. No Docker dependency. Red Hat alignment.
- **Cons:** Podman Compose has compatibility gaps with Docker Compose. Developer experience is less polished. Docker Compose has broader community support and tooling.

## Decision

**Option 3: Docker Compose (Local) + Kustomize (Production).**

Docker Compose provides the best local development experience -- it is widely understood, well-documented, and handles service dependencies, health checks, and networking with minimal configuration. The Makefile wraps Docker Compose commands to provide the single-command setup (`make run`).

Kustomize provides production deployment manifests for OpenShift AI that are readable, maintainable, and closer to plain Kubernetes YAML than Helm templates. For a reference architecture, readability matters more than parameterization power. Quickstart users deploying to their own OpenShift cluster can read and modify the base manifests directly.

### Local Development (Docker Compose)

**Container inventory:**

| Service | Image | Purpose | Port |
|---------|-------|---------|------|
| `ui` | nginx:alpine + built static files | React SPA serving | 3000 |
| `api` | Custom (Python 3.11) | FastAPI application | 8000 |
| `keycloak` | quay.io/keycloak/keycloak | Identity provider | 8080 |
| `postgres` | pgvector/pgvector:pg16 | Database | 5432 |
| `llamastack` | LlamaStack server image | Model serving abstraction | 8321 |
| `langfuse-web` | langfuse/langfuse | Observability UI | 3001 |
| `langfuse-worker` | langfuse/langfuse-worker | Event processing | -- |
| `redis` | redis:7-alpine | LangFuse cache | 6379 |
| `clickhouse` | clickhouse/clickhouse-server | LangFuse analytics | 8123 |

**Startup sequence:** Managed by Compose `depends_on` with health checks:
1. PostgreSQL, Redis, ClickHouse (infrastructure, no dependencies)
2. Keycloak (uses embedded H2 for PoC -- does not depend on the application PostgreSQL. The pre-configured realm import file `summit-cap-realm.json` is loaded on startup, making Keycloak's state reproducible without persistent storage.)
3. LangFuse (depends on PostgreSQL, Redis, ClickHouse)
4. LlamaStack (depends on model endpoint availability -- configurable)
5. API (depends on PostgreSQL, Keycloak, LlamaStack, LangFuse)
6. UI (depends on API for proxy configuration)

**Setup command:** `make run` executes:
1. `docker compose up -d` (starts all services)
2. Waits for health checks (API `/health`, Keycloak `/realms/summit-cap`)
3. Runs database migrations (`alembic upgrade head`)
4. Optionally seeds demo data (`python -m summit_cap.seed` if `SEED_DEMO_DATA=true`)
5. Prints access URLs

**Configuration:** Environment-specific values are in `.env` files (`.env.local`, `.env.remote-inference`). The `.env.local` file configures local inference (Ollama/vLLM endpoint). The `.env.remote-inference` file configures a remote model endpoint (no local model serving needed).

### OpenShift AI Production (Kustomize)

**Structure:**
```
deploy/openshift/
  base/
    api-deployment.yaml
    frontend-deployment.yaml
    keycloak-deployment.yaml
    postgres-statefulset.yaml
    llamastack-deployment.yaml
    langfuse-deployment.yaml
    configmaps.yaml
    secrets.yaml (placeholder)
    kustomization.yaml
  overlays/
    dev/
      kustomization.yaml       # Dev-specific patches
    production/
      kustomization.yaml       # Production patches (resource limits, replicas)
      model-serving.yaml       # OpenShift AI InferenceService definitions
      odf-storage.yaml         # S3-compatible storage for documents
```

**OpenShift AI-specific resources:**
- `InferenceService` for model serving (replaces the local LlamaStack + Ollama setup).
- S3-compatible object storage via OpenShift Data Foundation for document storage.
- Optional: Data science pipeline for compliance KB ingestion.
- Optional: Separate namespace for HMDA data path (defense-in-depth).

## Consequences

### Positive
- Docker Compose provides the simplest possible local setup -- single `make run` command.
- Kustomize manifests are readable Kubernetes YAML, suitable for a reference architecture.
- Same application code in both environments -- only infrastructure configuration changes.
- OpenShift AI integration is additive (overlays), not invasive (code changes).

### Negative
- Two manifest formats (Docker Compose + Kustomize) require parallel maintenance.
- Keycloak adds a significant container to the local stack (memory-heavy). Pre-configured realm import minimizes configuration burden but Keycloak itself uses ~512MB RAM.
- Nine containers in the local stack is a lot. Resource requirements documentation is essential.

### Neutral
- Model download time is excluded from the 10-minute setup target. The setup documentation clearly separates first-time setup from subsequent startup.
- The `.env` file approach for environment-specific configuration is standard but requires documentation for each configuration option.

## Amendment: Kustomize to Helm (2026-02-16)

### Reason for Amendment

The `rh-ai-quickstart/ai-quickstart-template` establishes Helm as the standard deployment pattern for all quickstarts in the ecosystem. This introduces a new evaluation factor -- **cross-quickstart consistency** -- that was not considered in the original decision. The template also provides working Helm charts (api, ui, db, migration job) that we extend rather than writing manifests from scratch.

### Updated Evaluation

| Factor | Kustomize (original decision) | Helm (amended decision) |
|--------|-------------------------------|------------------------|
| Starting effort | Write from scratch | Extend existing template charts |
| OpenShift ecosystem alignment | Good (built into `oc`) | Good (Helm is first-class on OpenShift) |
| Parameterization | Limited (patches only) | Full (values.yaml, conditionals) |
| Cross-quickstart consistency | Poor (each quickstart is unique YAML) | Good (shared chart patterns across ai-quickstart-template ecosystem) |
| Readability for beginners | Better (plain YAML) | Worse (Go templates) |
| Deployment flexibility | Medium | High (values overrides for different environments) |

### Amended Decision

**Option 2: Compose (Local) + Helm Charts (Production).**

The local development experience uses `compose.yml` (Compose Spec format, compatible with both podman-compose and docker compose). The `podman-compose` runtime is the default (Red Hat alignment); `docker compose` is a compatible alternative. The Makefile uses a configurable variable:

```makefile
COMPOSE ?= podman-compose
```

Production deployment uses Helm charts at `deploy/helm/summit-cap-financial/`. The template provides base charts for api, ui, db, and migration that we extend with additional subcharts for keycloak, llamastack, langfuse, redis, and clickhouse. Services with established community Helm charts (Keycloak, Redis, ClickHouse) are included as chart dependencies.

### Compose Profiles

The compose.yml uses profiles to allow running subsets of the full 9-service stack:

| Profile | Services | Use Case |
|---------|----------|----------|
| Default (no profile) | postgres, api, ui | Minimal for non-AI development |
| `--profile ai` | + llamastack | Adds AI agent capability |
| `--profile auth` | + keycloak | Adds authentication |
| `--profile observability` | + langfuse-web, langfuse-worker, redis, clickhouse | Adds observability |
| `--profile full` | All services | Full stack |

### Amended Consequences

The original consequences remain valid with these changes:

- **Positive (added):** Extending template charts is faster than writing Kustomize manifests from scratch. Operators familiar with any ai-quickstart-template quickstart can deploy ours without learning a different manifest format.
- **Negative (updated):** Helm's Go templates are less readable than Kustomize's plain YAML. Mitigated by providing a values-reference document; quickstart users primarily modify `values.yaml`, not Go templates.
- **Neutral (added):** The `deploy/` directory structure changes from `deploy/openshift/base/` + `deploy/openshift/overlays/` to `deploy/helm/summit-cap-financial/` with `Chart.yaml`, `values.yaml`, and `templates/`.
