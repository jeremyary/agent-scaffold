# Template Alignment Review: ai-quickstart-template vs. Architecture v1.2

**Template:** `rh-ai-quickstart/ai-quickstart-template` at commit `13c477ac`
**Architecture:** `plans/architecture.md` v1.2 + ADRs 0001-0007
**Reviewer:** Architect
**Date:** 2026-02-16

---

## 1. Summary Table

| # | Area | Template | Architecture | Verdict | Resolution |
|---|------|----------|-------------|---------|------------|
| 1 | Deployment tooling (prod) | Helm charts | Kustomize (ADR-0007) | **Conflict** | Adopt Helm from template |
| 2 | Container tooling (local) | podman-compose | Docker Compose (ADR-0007) | **Conflict (minor)** | Keep `compose.yml` syntax; document podman-compose compatibility |
| 3 | Build system | Turborepo + pnpm workspaces | Not specified | **Gap** | Adopt Turborepo + pnpm from template |
| 4 | Database package separation | Separate `packages/db/` Python package | Domain services as modules within `packages/api/` | **Conflict** | Adopt template's `packages/db/` pattern |
| 5 | Python build system | hatchling | Not specified | **Gap** | Adopt hatchling from template |
| 6 | Python package manager | uv | Not specified | **Gap** | Adopt uv from template |
| 7 | UI routing | TanStack Router (file-based, type-safe) | React Router (ADR-0003) | **Conflict** | Adopt TanStack Router from template |
| 8 | UI server state | TanStack Query | No data-fetching library (ADR-0003) | **Conflict** | Adopt TanStack Query from template |
| 9 | UI component library | shadcn/ui + Radix + CVA | Tailwind CSS only (ADR-0003) | **Gap** | Adopt shadcn/ui from template |
| 10 | UI testing | Vitest + React Testing Library | Not specified | **Gap** | Adopt from template |
| 11 | Storybook | Included | Not specified | **Gap** | Adopt from template |
| 12 | Pre-commit hooks | Husky + commitlint + lint-staged | Not specified | **Gap** | Adopt from template |
| 13 | Semantic release | Automated on merge to main | Not specified | **Gap (low priority)** | Defer -- not needed at PoC |
| 14 | pgvector in Helm | `pgvector/pgvector:pg16` image | PostgreSQL 16 + pgvector (ADR-0002) | **Aligned** | No action |
| 15 | SQLAdmin | Admin dashboard at `/admin` | Not specified | **Gap** | Adopt from template |
| 16 | Project structure | `packages/{api,ui,db,configs}/` | `packages/{api,frontend}/` with nested structure | **Conflict** | Adopt template's layout with extensions |
| 17 | Compose stack | PostgreSQL only | PostgreSQL + 8 other services | **Gap (expected)** | Extend template's compose.yml |
| 18 | Helm chart structure | api + ui + db + migration charts | Need additional service charts | **Gap (expected)** | Extend template's Helm charts |
| 19 | React version | React 19 | Not specified | **Aligned** | Adopt React 19 |
| 20 | FastAPI + Pydantic + SQLAlchemy + asyncpg | Included | Included in architecture | **Aligned** | No action |
| 21 | Alembic migrations | In `packages/db/` | In `packages/api/src/summit_cap/db/` | **Conflict (follows from #4)** | Migrations live in `packages/db/` |
| 22 | ESLint + Prettier + Ruff configs | Shared in `packages/configs/` | Not specified | **Gap** | Adopt from template |

**Totals:** 5 Aligned, 7 Conflicts, 10 Gaps, 0 items where we should override the template entirely.

---

## 2. Detailed Analysis

### 2.1 Deployment Tooling: Helm vs. Kustomize [CONFLICT -- High Impact]

**Current architecture (ADR-0007):** Kustomize for OpenShift AI production deployment. Rationale was readability: "Kustomize manifests are readable Kubernetes YAML, suitable for a reference architecture."

**Template:** Helm charts at `deploy/helm/` with subcharts for api, ui, db, and migration.

**Analysis:**

The original ADR-0007 evaluated Helm as Option 2 and Kustomize as Option 3. The decision favored Kustomize on readability grounds. However, the template provides a working Helm chart structure that we would be discarding to rewrite as Kustomize from scratch. This changes the cost calculus:

| Factor | Kustomize (current decision) | Helm (template) |
|--------|------------------------------|-----------------|
| Starting effort | Write from scratch | Extend existing charts |
| OpenShift ecosystem alignment | Good (built into `oc`) | Good (Helm is first-class on OpenShift) |
| Parameterization | Limited (patches only) | Full (values.yaml, conditionals) |
| Template reuse across quickstarts | Poor (each quickstart is unique YAML) | Good (shared chart patterns) |
| Readability for beginners | Better (plain YAML) | Worse (Go templates) |
| Deployment flexibility | Medium | High (values overrides for different environments) |

The critical new factor is **cross-quickstart consistency**. If the `ai-quickstart-template` establishes Helm as the standard deployment pattern, our quickstart should follow that pattern so that operators familiar with one quickstart can deploy another without learning a different manifest format. This is a stronger argument than the original readability preference.

**Resolution: Adopt Helm from the template.** Amend ADR-0007 to select Option 2 (Helm) instead of Option 3 (Kustomize). Add a new consideration: "Cross-quickstart consistency with the ai-quickstart-template standard." The `deploy/` directory structure changes from `deploy/openshift/base/` + `deploy/openshift/overlays/` to `deploy/helm/` with subcharts.

**Architecture doc impact:** Section 7.1 (deployment modes table), Section 7.2 (references Docker Compose), ADR-0007 full rewrite. The `deploy/openshift/` path in Section 10 changes to `deploy/helm/`.

---

### 2.2 Container Tooling: podman-compose vs. Docker Compose [CONFLICT -- Low Impact]

**Current architecture (ADR-0007):** Docker Compose. Rationale: "widely understood, well-documented."

**Template:** Uses podman-compose (the compose.yml is compatible with both).

**Analysis:**

The compose.yml specification (Compose Spec) is container-runtime-agnostic. A well-written `compose.yml` works with both `docker compose` and `podman-compose`. The template likely uses `compose.yml` (not `docker-compose.yml`), which is the runtime-neutral filename.

The real question is what the Makefile invokes. The template's Makefile likely calls `podman-compose` or uses a variable. Our Makefile should be runtime-agnostic:

```makefile
COMPOSE ?= podman-compose
# or detect: COMPOSE := $(shell command -v podman-compose 2>/dev/null || echo docker compose)
```

**Resolution: Keep `compose.yml` syntax (compatible with both). Make the Makefile runtime-agnostic.** Document that podman-compose is the default (Red Hat alignment), with docker compose as an alternative. No ADR amendment needed -- ADR-0007 references "Docker Compose" as a shorthand for the compose specification, not as a vendor choice.

**Architecture doc impact:** Minor wording change in Section 7.1 and 7.2. Replace "Docker Compose" references with "Compose" where they refer to the file format, and note podman-compose as the default runtime.

---

### 2.3 Build System: Turborepo + pnpm [GAP -- Medium Impact]

**Current architecture:** Does not specify a monorepo build system. The project structure in Section 10 implies a flat directory under `packages/` but no orchestration.

**Template:** Turborepo for task orchestration (build, test, lint across packages), pnpm workspaces for package management, turbo.json for pipeline definitions.

**Analysis:**

Our project has at minimum `packages/api/` (Python) and `packages/ui/` (TypeScript/React). The template adds `packages/db/` (Python) and `packages/configs/` (shared lint configs). Running `make test` needs to run both Python tests and Vitest. Running `make lint` needs Ruff + ESLint. A monorepo orchestrator like Turborepo handles this naturally:

```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "test": {},
    "lint": {}
  }
}
```

The alternative is a Makefile that manually sequences commands across packages. Turborepo is more elegant and cacheable, but it adds Node.js as a root dependency (pnpm, turbo). Our architecture already accepts Node.js at build-time (ADR-0003), so this is not a new constraint.

**Resolution: Adopt Turborepo + pnpm from the template.** The Makefile wraps turbo commands (e.g., `make test` calls `turbo run test`). Python package management within `packages/api/` and `packages/db/` uses uv (see 2.5). The root `package.json` defines pnpm workspaces. This is the template's established pattern and provides task caching and parallel execution.

**Architecture doc impact:** Section 10 (project structure) needs a `turbo.json` and root `package.json`. New subsection or note about build tooling.

---

### 2.4 Database Package Separation [CONFLICT -- Medium Impact]

**Current architecture (Section 10):** Database models and migrations live inside the API package at `packages/api/src/summit_cap/db/`.

**Template:** Database is a separate Python package at `packages/db/` with its own `pyproject.toml`, imported by the API as a dependency via uv workspace path.

**Analysis:**

The template's pattern has real advantages for our project:

1. **HMDA schema isolation clarity.** Having `packages/db/` contain all SQLAlchemy models, including the `hmda` schema models, makes the schema boundary visible in the package structure. The CI lint check ("no code outside `services/compliance/` references the `hmda` schema") is easier to enforce when the DB models are in a separate package with clear imports.

2. **Migration independence.** Alembic migrations in their own package can be run independently of the API process. This matters for the Helm migration job pattern (the template includes a migration subchart).

3. **Shared models.** If we ever add a background worker or CLI tool (we already have `python -m summit_cap.seed`), they import models from `packages/db/` rather than reaching into the API package.

4. **Template consistency.** Following the template pattern means less divergence for anyone familiar with the quickstart template.

The downside is that domain services in `packages/api/` now import from an external package (`packages/db/`), adding a dependency edge. With uv workspaces, this is a path dependency (no PyPI publishing needed), so the practical cost is low.

**Resolution: Adopt the `packages/db/` pattern from the template.** SQLAlchemy models, Alembic migrations, and database connection configuration live in `packages/db/`. The API package (`packages/api/`) depends on `packages/db/` as a workspace path dependency. Domain services import models from the db package.

**Architecture doc impact:** Section 10 (project structure) gets `packages/db/`. Section 3.2 (schema overview) notes that models are defined in `packages/db/`. The dual connection pool pattern (lending_app / compliance_app) is configured in `packages/db/` and imported by the API.

---

### 2.5 Python Build System: hatchling [GAP -- Low Impact]

**Current architecture:** Does not specify a Python build system.

**Template:** Uses hatchling (PEP 517 build backend) with `pyproject.toml`.

**Analysis:**

hatchling is a modern, standards-compliant Python build backend. It is lighter than setuptools, faster than Poetry's backend, and works well with uv. The template already has working `pyproject.toml` files using hatchling. No reason to diverge.

**Resolution: Adopt hatchling from the template.** Both `packages/api/` and `packages/db/` use hatchling as the build backend in `pyproject.toml`.

**Architecture doc impact:** Minimal -- this is an implementation detail. The notable Python dependencies table in Section 10 could mention uv + hatchling as the build tooling, but this is Tech Lead territory.

---

### 2.6 Python Package Manager: uv [GAP -- Low Impact]

**Current architecture:** Does not specify a Python package manager.

**Template:** Uses uv for Python dependency management and workspace path dependencies.

**Analysis:**

uv is fast, Rust-based, and handles virtual environments, dependency resolution, and workspace path dependencies. It is the modern replacement for pip + pip-tools. The template's pattern of `packages/api/` depending on `packages/db/` via uv workspace path is clean and avoids the need for local pip install -e.

**Resolution: Adopt uv from the template.**

**Architecture doc impact:** None -- this is implementation tooling.

---

### 2.7 UI Routing: TanStack Router vs. React Router [CONFLICT -- Medium Impact]

**Current architecture (ADR-0003):** "React Router with role-based route guards."

**Template:** TanStack Router with file-based, type-safe routing.

**Analysis:**

| Factor | React Router | TanStack Router |
|--------|-------------|-----------------|
| Type safety | Manual typing of params | Fully type-safe params, search params, loaders |
| Routing model | Component-based, declarative | File-based with type-safe code generation |
| Role-based guards | Custom `ProtectedRoute` wrapper | Built-in `beforeLoad` hooks |
| Learning curve | Lower (more widely known) | Higher (newer, less community content) |
| Template alignment | No | Yes |

TanStack Router's `beforeLoad` hooks are actually a better fit for our role-based routing pattern. Instead of wrapping routes in guard components, the route definition itself declares the required role, and the `beforeLoad` function checks it before rendering:

```typescript
// File-based route: routes/borrower/index.tsx
export const Route = createFileRoute('/borrower/')({
  beforeLoad: ({ context }) => {
    if (context.auth.role !== 'borrower') throw redirect({ to: '/unauthorized' })
  },
})
```

The trade-off is that TanStack Router has a smaller community than React Router. For a PoC aimed at developers evaluating AI patterns (where the backend is the primary interest), this risk is acceptable -- developers are unlikely to deeply customize routing.

**Resolution: Adopt TanStack Router from the template.** Amend ADR-0003 to change the routing choice. The role-based guard pattern maps to `beforeLoad` hooks. File-based routing provides clear structure for the five persona route trees.

**Architecture doc impact:** ADR-0003 updated. Section 2.1 (frontend) notes file-based routing.

---

### 2.8 UI Server State: TanStack Query [CONFLICT -- Low Impact]

**Current architecture (ADR-0003):** "No complex data fetching library. React's built-in state is sufficient."

**Template:** TanStack Query for server state management.

**Analysis:**

The original ADR-0003 rationale was simplicity for Python-focused developers. However, our application has significant data-fetching needs:

- Pipeline dashboard polling for the Loan Officer (application status changes)
- Document processing status polling (`GET /api/documents/{id}/status`)
- CEO dashboard with multiple API calls for different metric categories
- Audit trail queries with pagination
- Application status checks

TanStack Query handles caching, background refetching, pagination, and optimistic updates declaratively. Without it, we would write custom `useEffect` + `useState` patterns for each of these, which is *more* complex and error-prone than using TanStack Query. The "simpler without a library" argument breaks down when you have more than a couple of data-fetching use cases.

TanStack Query also pairs naturally with TanStack Router (shared context, integrated loaders).

**Resolution: Adopt TanStack Query from the template.** Amend ADR-0003 to include it. The original rationale ("no state management library") was aimed at Redux/Zustand-style client state managers, not server state cache managers. TanStack Query is a different category -- it reduces complexity rather than adding it.

**Architecture doc impact:** ADR-0003 updated. Section 2.1 mentions TanStack Query for server state.

---

### 2.9 UI Component Library: shadcn/ui [GAP -- Medium Impact]

**Current architecture (ADR-0003):** Tailwind CSS for styling. No component library specified.

**Template:** shadcn/ui (copy-paste component library) + Radix primitives (accessible headless components) + class-variance-authority (variant management).

**Analysis:**

Our application needs substantial UI components: chat interfaces, data tables (pipeline, audit trail), form inputs (document upload, application intake), modals, tabs, navigation, charts. Building these from raw Tailwind CSS is time-consuming and produces inconsistent results.

shadcn/ui is an excellent fit because:
- Components are copied into the project (not installed as a dependency), so they are fully customizable.
- Built on Radix primitives, which provide accessibility out of the box (important for any Red Hat-published reference).
- Uses Tailwind CSS under the hood, which is already in our stack.
- The template has it set up, so we get a working component library from day one.

**Resolution: Adopt shadcn/ui + Radix + CVA from the template.** This complements Tailwind CSS -- it does not replace it. The architecture's "Tailwind CSS" decision in ADR-0003 is preserved; shadcn/ui is an additive layer.

**Architecture doc impact:** ADR-0003 updated to list shadcn/ui as the component library.

---

### 2.10 UI Testing: Vitest [GAP -- Low Impact]

**Template:** Vitest + React Testing Library.

Vitest is the natural testing framework for Vite projects. Aligns with our build tooling.

**Resolution: Adopt from template.** Implementation detail for Tech Lead.

---

### 2.11 Storybook [GAP -- Low Priority]

**Template:** Storybook included for UI component development.

Storybook is useful for developing components in isolation. At PoC maturity, it is a "nice to have" -- the template includes it, so we get it for free.

**Resolution: Adopt from template.** Do not invest time configuring stories for every component at PoC maturity, but keep the infrastructure available.

---

### 2.12 Pre-commit Hooks: Husky + commitlint [GAP -- Low Impact]

**Template:** Husky for git hooks, commitlint for conventional commit enforcement, lint-staged for pre-commit linting of staged files only.

**Analysis:**

Our `git-workflow.md` rule already mandates conventional commits. The template provides automated enforcement. This is strictly better than relying on human discipline.

**Resolution: Adopt from template.** Aligns with our existing commit message conventions and the AI compliance commit trailer requirements.

**Architecture doc impact:** None. This is tooling, not architecture.

---

### 2.13 Semantic Release [GAP -- Low Priority]

**Template:** Automated semantic versioning on merge to main.

At PoC maturity, automated versioning adds complexity without clear value. We are not publishing packages to registries.

**Resolution: Defer.** Keep the template's semantic-release config files but do not activate the CI workflow. Revisit if the project moves to MVP maturity.

---

### 2.14 pgvector in Helm [ALIGNED]

**Template:** Helm values reference `pgvector/pgvector:pg16` image.
**Architecture (ADR-0002):** PostgreSQL 16 + pgvector.

Exact alignment. The template's Helm chart already uses the correct image.

---

### 2.15 SQLAdmin [GAP -- Useful]

**Template:** SQLAdmin dashboard at `/admin` for database inspection.

**Analysis:**

SQLAdmin provides a web UI for browsing and editing database records. For PoC development, this is extremely useful:
- Inspect seeded demo data without writing SQL.
- Manually adjust application states during development.
- Verify HMDA schema isolation (can the admin see hmda tables? It should not, if connected via the `lending_app` role).

The security concern (exposing an admin panel) is mitigated at PoC maturity: the admin panel should be restricted to a development/admin role or disabled in production deployment.

**Resolution: Adopt from template.** Wire it to the `lending_app` connection pool by default (so it naturally cannot see HMDA data). Add a note that it must be disabled or restricted in production.

**Architecture doc impact:** Add SQLAdmin to the API gateway routing table (Section 2.2) under `/api/admin/*`.

---

### 2.16 Project Structure [CONFLICT -- High Impact]

**Current architecture (Section 10):**
```
summit-cap/
  packages/
    api/
      src/summit_cap/
        main.py
        middleware/
        routes/
        agents/
        services/
        models/
        db/
    frontend/
      src/
```

**Template:**
```
packages/
  ui/          # Not "frontend"
  api/
    src/<project_name>/
  db/          # Separate Python package
  configs/     # Shared lint configs
```

**Key differences:**

| Aspect | Architecture | Template | Impact |
|--------|-------------|----------|--------|
| Frontend directory name | `packages/frontend/` | `packages/ui/` | Naming convention |
| Database location | `packages/api/src/summit_cap/db/` | `packages/db/` | Structural (see 2.4) |
| Shared configs | Not specified | `packages/configs/` | Organizational |
| Root build files | `Makefile`, `docker-compose.yaml` | `Makefile`, `compose.yml`, `turbo.json`, `package.json`, `pnpm-workspace.yaml` | Build tooling |

**Resolution: Adopt the template's layout as the base.** This means:

- `packages/ui/` (not `packages/frontend/`)
- `packages/api/` (same)
- `packages/db/` (extracted from api, see 2.4)
- `packages/configs/` (shared lint configs)
- Root: `Makefile`, `compose.yml`, `turbo.json`, `package.json`, `pnpm-workspace.yaml`

Our extensions to the template layout:

```
packages/
  ui/                          # Template base
  api/
    src/summit_cap/
      main.py                  # FastAPI app entry point
      middleware/               # Auth, RBAC, PII masking
      routes/                  # API route handlers
      agents/                  # LangGraph agent definitions (our addition)
      services/                # Domain services (our addition)
        compliance/
          knowledge_base/      # KB submodule (our addition)
      inference/               # LlamaStack wrapper (our addition)
      models/                  # Pydantic request/response models
  db/
    src/summit_cap_db/
      models/                  # SQLAlchemy models (all schemas)
      migrations/              # Alembic migrations
  configs/                     # Template base
config/                        # Application config (our addition)
  app.yaml
  agents/
  models.yaml
  keycloak/
data/                          # Demo and compliance KB data (our addition)
  compliance-kb/
  demo/
deploy/
  helm/                        # Template base (extended with our services)
```

**Architecture doc impact:** Section 10 (project structure) full rewrite. The naming change from `frontend` to `ui` propagates to references in Sections 2.1, 7.2.

---

### 2.17 Compose Stack Extension [GAP -- Expected]

**Template:** Minimal compose.yml with PostgreSQL only.

**Architecture (Section 7.2):** 9 services: frontend, api, keycloak, postgres, llamastack, langfuse-web, langfuse-worker, redis, clickhouse.

The template provides the base; we extend it with our additional services. This is expected and planned. The template's compose.yml structure (service definitions, health checks, networking) becomes the foundation.

**Resolution: Extend the template's compose.yml.** Add our 8 additional services to the template's PostgreSQL service. Use compose profiles to allow running subsets:

```yaml
# Profile strategy
# Default (no profile): postgres, api, ui -- minimal for non-AI development
# --profile ai: + llamastack -- adds AI agent capability
# --profile auth: + keycloak -- adds authentication
# --profile observability: + langfuse-web, langfuse-worker, redis, clickhouse
# --profile full: all services
```

This allows developers to start with a lighter stack and add services as needed, rather than requiring 9 containers from day one.

**Architecture doc impact:** Section 7.2 updated to describe profile-based compose configuration.

---

### 2.18 Helm Chart Extension [GAP -- Expected]

**Template:** Helm subcharts for api, ui, db, migration.

We need additional subcharts for: keycloak, llamastack, langfuse, redis, clickhouse. Some of these have existing community Helm charts (Keycloak, Redis, ClickHouse) that can be included as dependencies.

**Resolution: Extend the template's Helm structure.** Add subcharts for additional services. Use Helm chart dependencies for services with established community charts.

**Architecture doc impact:** The `deploy/` section of project structure (Section 10) and the OpenShift deployment section (7.1, ADR-0007).

---

## 3. Architecture Document Updates Required

The following sections of `plans/architecture.md` need updates based on this review:

### High-Priority Updates (structural changes)

| Section | Change | Reason |
|---------|--------|--------|
| **ADR-0007** | Amend: Kustomize -> Helm. Add cross-quickstart consistency rationale. | Conflict 2.1 |
| **ADR-0003** | Amend: Add TanStack Router, TanStack Query, shadcn/ui. Remove "no data-fetching library" statement. | Conflicts 2.7, 2.8, Gap 2.9 |
| **Section 10** | Rewrite project structure to match template layout. `packages/ui/`, `packages/db/`, `packages/configs/`. Add root build files. | Conflict 2.16 |
| **Section 7.1** | Update deployment modes table: "Helm charts" instead of "Kustomize". Note podman-compose as default. | Conflicts 2.1, 2.2 |
| **Section 7.2** | Add compose profile strategy. Change "Docker Compose" to "Compose" where referring to format. | Gap 2.17, Conflict 2.2 |

### Medium-Priority Updates (additive, no structural change)

| Section | Change | Reason |
|---------|--------|--------|
| **Section 2.1** | Note TanStack Router file-based routing, TanStack Query for server state, shadcn/ui for components. | Conflicts 2.7, 2.8, Gap 2.9 |
| **Section 2.2** | Add SQLAdmin to routing table. | Gap 2.15 |
| **Section 3.2** | Note that models are defined in `packages/db/`. Dual connection pools configured there. | Conflict 2.4 |

### Low-Priority Updates (notes, no architectural change)

| Section | Change | Reason |
|---------|--------|--------|
| **Section 10** | Note Turborepo + pnpm as build system. | Gap 2.3 |
| **Section 10** | Note hatchling + uv as Python build/package tooling. | Gaps 2.5, 2.6 |

---

## 4. New ADR Needed?

**No new ADR is needed.** The changes are amendments to existing ADRs:

- **ADR-0007** needs the most significant amendment (Kustomize -> Helm). The trade-off analysis should add "cross-quickstart consistency" as a new evaluation factor and note that the template provides a working Helm chart base.
- **ADR-0003** needs an additive amendment (routing library, server state, component library). The core decision (React + Vite SPA) is unchanged.

These amendments should be made as "Amended" status updates to the existing ADRs, not as superseding ADRs, because the fundamental decisions (Docker Compose for local, Kubernetes manifests for prod, React SPA) are preserved.

---

## 5. Risk Assessment

### Risks of Adopting Template Patterns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TanStack Router has a smaller community than React Router | Medium | Low | Backend is the primary focus; routing complexity is low. Five role-based route trees with shared layout. |
| Turborepo adds Node.js complexity to the root | Low | Low | Already accepted Node.js at build-time. Turborepo is transparent to developers who just use `make` targets. |
| Helm chart templating is harder to read than Kustomize | Medium | Medium | Provide a values-reference document. Quickstart users primarily modify `values.yaml`, not Go templates. |
| DB package separation adds import indirection | Low | Low | uv workspace path dependencies are transparent. Developers use standard Python imports. |

### Risks of NOT Adopting Template Patterns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Divergence from quickstart ecosystem standards | High | High | Other quickstarts following the template will use Helm, pnpm, TanStack -- our quickstart would be the outlier. |
| Rebuilding solved problems (lint config, git hooks, build orchestration) | High | Medium | We spend implementation time on infrastructure that the template already provides. |
| Helm vs. Kustomize confusion for operators | Medium | Medium | An operator deploying multiple quickstarts expects consistent patterns. |

---

## 6. Recommended Next Steps

1. **Amend ADR-0007** to select Helm over Kustomize, with the cross-quickstart consistency rationale.
2. **Amend ADR-0003** to incorporate TanStack Router, TanStack Query, and shadcn/ui.
3. **Update Section 10** of architecture.md with the template-aligned project structure.
4. **Update Section 7** with Helm deployment and compose profile strategy.
5. **Carry template alignment decisions into Requirements phase** (Phase 7) -- the requirements analyst should reference the template's patterns when specifying story acceptance criteria.
6. **When the Tech Lead designs Phase 1** (foundation), the template repository should be the starting scaffold -- clone it and extend, do not start from scratch.

---

## 7. What the Template Does NOT Solve

These are architectural concerns in our design that the template does not address. They remain our responsibility to implement on top of the template:

- HMDA data isolation (separate schemas, dual DB roles, dual connection pools)
- Keycloak integration and RBAC middleware
- LangGraph agent layer
- LlamaStack integration
- LangFuse observability
- WebSocket chat streaming
- Audit trail (append-only, hash chain)
- Compliance knowledge base (RAG pipeline)
- Document processing pipeline
- Agent security layers (input validation, tool auth, output filtering)
- Demo data seeding
- TrustyAI fairness metrics
- Model routing

This is expected. The template provides infrastructure scaffolding (build system, project layout, deployment charts, component library). Our architecture provides the application design. They are complementary layers.
