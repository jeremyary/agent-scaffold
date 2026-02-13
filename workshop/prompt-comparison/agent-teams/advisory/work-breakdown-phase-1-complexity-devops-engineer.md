<!-- This project was developed with assistance from AI tools. -->

# Phase 1 Work Breakdown Complexity Assessment: DevOps Engineer

**Date:** 2026-02-12
**Assessing:** DX-01 through DX-04 (Development Environment task group)

## Executive Summary

The "DX: Development Environment" group conflates **bootstrap infrastructure** (prerequisite for all development) with **developer experience enhancements** (nice-to-haves after basic setup works). This creates a single-point-of-failure task with unclear exit conditions. Recommend splitting into two task groups: minimal bootstrap first, then DX polish.

---

## 1. Undersized Task Assessment

**Current grouping:** DX-01 through DX-04 is presented as a single coherent work area.

**Reality:** This work spans two distinct concerns:

### Critical Bootstrap (blocks all other work)
- compose.yml with PostgreSQL, Redis, MinIO
- Health endpoints (`/health`, `/ready`)
- Database migrations (Alembic setup + Phase 1 migrations)
- Makefile targets: `setup`, `db-start`, `db-upgrade`
- Minimal seed data generation (3 API keys + 1 test application)

### Developer Experience Enhancements (nice-to-haves)
- Full seed data suite (12 applications, documents, audit chains)
- OpenAPI/Swagger docs configuration
- README architecture overview
- Makefile convenience targets (`dev`, `test`, `lint`)

**Problem:** If these are treated as a single task, the implementer may polish Swagger docs while other developers are blocked waiting for a database. The TD does not make the sequencing explicit.

**Recommendation:** Split into two tasks:
1. **DX-Bootstrap:** compose.yml, health endpoints, migrations, minimal `make setup` (exit: `curl /health` succeeds)
2. **DX-Polish:** Seed data, OpenAPI docs, README, full Makefile (exit: `make dev` brings up fully-seeded environment)

Task 1 unblocks all backend implementation tasks. Task 2 can proceed in parallel with backend work.

---

## 2. Hidden Dependencies

### compose.yml needs concrete configuration values
The TD specifies compose.yml must define PostgreSQL, Redis, and MinIO services. What's **not** explicit:

- PostgreSQL must create the `mortgage_app` database on first start (via `POSTGRES_DB` env var)
- PostgreSQL must enable `uuid-ossp` extension (via init script in `/docker-entrypoint-initdb.d/`)
- MinIO must auto-create the `documents` bucket (via `mc mb` in entrypoint or via Python script on first API startup)
- Redis persistence: do we use `appendonly` mode or accept ephemeral data at PoC maturity? (Affects volume mounts.)

**Resolution needed:** These are binding decisions. If not specified, different implementers will make incompatible choices. Recommend the TD specify:
- PG init script path and contents
- MinIO bucket initialization mechanism (script vs manual vs API-layer check-and-create)
- Redis persistence mode (suggest ephemeral for Phase 1)

### Health check timing
The `/ready` endpoint checks PostgreSQL, Redis, and MinIO. What happens if the API starts before PostgreSQL is fully initialized?

- Docker healthcheck on postgres service is insufficient (returns "healthy" before accepting connections)
- FastAPI startup should **retry** database connection with exponential backoff (max 30s), not fail-fast
- Alternatively: use `depends_on` with `condition: service_healthy` in compose.yml (requires custom healthcheck in postgres service)

**Recommendation:** TD should specify retry logic in `packages/api/src/main.py` startup event handler. Document the pattern for other implementers.

### Makefile cross-package coordination
`make dev` must:
1. Start compose services
2. Wait for PostgreSQL readiness
3. Run Alembic migrations
4. Start API server (uvicorn)
5. Start frontend (vite) — but frontend is Phase 6

Phase 1 `make dev` is API-only. The Makefile target can be simpler than the full-stack version. Should the Makefile be written with Phase 6 in mind (with commented-out frontend section), or should it evolve iteratively?

**Recommendation:** Write a Phase-1-scoped Makefile. Phase 6 will modify it. Trying to anticipate future structure wastes time and risks over-engineering.

---

## 3. Domain-Specific Risks

### Docker Compose v2 vs v1
Compose v2 (`docker compose`) is now standard, but v1 (`docker-compose`) still exists on some systems. The TD specifies `compose.yml`, which is v2 syntax.

**Risk:** Developer on legacy system runs `docker-compose up` and gets cryptic errors.

**Mitigation:** Makefile should invoke `docker compose` (with space), not `docker-compose`. Add version check in `make setup`: `docker compose version` must return v2.x.

### PostgreSQL container initialization race
If the API starts and runs migrations before PostgreSQL has created the `mortgage_app` database, migrations fail. The TD specifies database URL `postgresql+asyncpg://postgres:postgres@localhost:5432/mortgage_app`.

**Risk:** First-time setup fails non-deterministically depending on timing.

**Mitigation:**
- Use `POSTGRES_DB=mortgage_app` in compose.yml to ensure database exists on first start
- API startup should retry connection 10 times with 3s delay (total 30s timeout) before failing

### MinIO bucket initialization
The TD specifies bucket name `documents` but does not specify who creates it. If the API assumes the bucket exists and the bucket doesn't, document upload will fail with a cryptic MinIO error.

**Options:**
1. Use `mc` (MinIO client) in compose entrypoint to create bucket
2. Check-and-create in `packages/api/src/services/minio_client.py` on first upload
3. Manual step in README ("Run `mc mb local/documents` after first start")

**Recommendation:** Option 2 (API-layer check-and-create). Most resilient. Document in TD.

### Python dependency management with uv
The TD specifies `uv` as Python package manager. `uv` is newer and faster than `pip`, but:

- Not all developers will have it installed
- `make setup` must install `uv` if missing (use `pip install uv` as fallback)
- `uv pip sync` requires a lockfile; TD should specify lockfile generation command (`uv pip compile pyproject.toml -o requirements.lock`)

**Recommendation:** Makefile should check for `uv`, install if missing, and regenerate lockfiles if `pyproject.toml` is newer than `requirements.lock`.

### Volume persistence across restarts
If `compose down` deletes PostgreSQL data, seed data vanishes. Developers must re-seed on every restart.

**Risk:** Frustration. Slow iteration.

**Mitigation:** Use named volumes in compose.yml (`postgres_data`, `minio_data`, `redis_data`). These persist across `compose down` unless explicitly deleted with `-v` flag. Document cleanup command: `docker compose down -v` (wipes all data).

### Turborepo cache directory
The TD specifies Turborepo. Turbo caches build outputs in `.turbo/`. This directory should be in `.gitignore` but NOT in `.dockerignore` (if we later build containers via Turbo).

**Risk:** Git clutter or cache thrashing.

**Mitigation:** Ensure `.gitignore` includes `.turbo/`. Not strictly a Phase 1 risk (containers are Phase 5), but good to flag.

---

## 4. Bootstrap Ordering

**Minimum viable dev setup:**

```
1. Developer clones repo
2. `make setup` runs:
   a. Install uv (if missing)
   b. Install pnpm (if missing)
   c. Copy .env.example to .env
   d. Run `uv pip sync` in packages/api and packages/db
3. `make db-start` runs:
   a. `docker compose up -d postgres redis minio`
   b. Wait for postgres readiness (pg_isready loop)
4. `make db-upgrade` runs:
   a. `cd packages/db && uv run alembic upgrade head`
   b. Seed data migration creates 3 API keys (printed to console)
5. Developer manually starts API:
   `cd packages/api && uv run uvicorn src.main:app --reload`
6. Developer curls /health to verify
```

**What blocks other tasks:**
- Backend implementation tasks (APP, AUTH, AUDIT, etc.) require steps 1-5 to be complete.
- Without seed API keys, manual API testing is painful (must run key creation endpoint first).
- Without health endpoints, no way to verify the stack is up.

**What can proceed in parallel with backend tasks:**
- Full seed data suite (12 apps) — not needed for unit tests
- OpenAPI docs polish — API works without it
- README architecture section — non-blocking

**Critical path:** compose.yml → database migrations → seed keys → API startup. Everything else is off the critical path.

---

## Recommendations

1. **Split DX into two tasks:** DX-Bootstrap (critical path) and DX-Polish (parallel).
2. **Specify MinIO bucket creation mechanism** in TD (recommend API-layer check-and-create).
3. **Add PostgreSQL init script** to compose.yml for `uuid-ossp` extension and database creation.
4. **Document API startup retry logic** for database connection (10 retries, 3s delay).
5. **Use named volumes** in compose.yml to persist data across restarts.
6. **Add Compose v2 version check** to Makefile setup target.
7. **Generate and commit lockfiles** (`requirements.lock`) to ensure reproducible builds.

These changes will prevent the DX task from becoming a bottleneck and reduce non-deterministic first-time setup failures.
