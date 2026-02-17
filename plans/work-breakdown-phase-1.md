# Work Breakdown: Phase 1 (Foundation)

**Delivery Phase:** Phase 1
**Source TD:** `plans/technical-design-phase-1.md` + 4 chunks
**Stories:** 32 (across 8 features: F1, F2, F14, F18, F20, F21, F22, F25)
**Work Units:** 10 (WU-0 through WU-9)

---

## Document Structure

This work breakdown uses the hub/chunk pattern. The hub (this file) contains the dependency map, WU-to-story mapping, complexity sizing, execution order, and cross-WU coordination. Detailed stories with implementation prompts are in chunk files:

| Chunk | File | Work Units |
|-------|------|-----------|
| Infrastructure | `work-breakdown-phase-1-chunk-infra.md` | WU-0 (Bootstrap), WU-5 (LangFuse + Model Routing), WU-9 (Docker Compose) |
| Auth/RBAC | `work-breakdown-phase-1-chunk-auth.md` | WU-2 (Keycloak Auth), WU-4 (RBAC Middleware), WU-7 (Integration Tests) |
| Data/HMDA | `work-breakdown-phase-1-chunk-data.md` | WU-1 (DB Schema), WU-3 (HMDA Endpoint), WU-6 (Demo Data) |
| Frontend | `work-breakdown-phase-1-chunk-ui.md` | WU-8 (Frontend Scaffolding + Landing Page) |

---

## Dependency Graph

### Execution Order (from TD)

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

### Parallelization Opportunities

After WU-0 completes, three independent streams can run in parallel:

| Stream | WUs | Blocking Dependency |
|--------|-----|-------------------|
| **Data** | WU-1 -> WU-3, WU-6 (parallel after WU-1) | None after WU-0 |
| **Auth** | WU-2 | None after WU-0 |
| **Infra** | WU-5 | None after WU-0 |
| **Frontend** | WU-8 | None after WU-0 |

Convergence points:
- **WU-4** requires both WU-1 and WU-2 (merges data + auth streams)
- **WU-7** requires WU-4 and WU-3 (merges RBAC + HMDA)
- **WU-9** requires all WU-0 through WU-8

---

## WU-to-Story Mapping

| WU | Stories | Feature | Count |
|----|---------|---------|-------|
| WU-0 | (prerequisite -- no stories) | Infrastructure | 0 |
| WU-1 | S-1-F25-02, S-1-F20-04 (partial) | F25, F20 | 2 |
| WU-2 | S-1-F2-01, S-1-F2-02, S-1-F2-03 | F2 | 3 |
| WU-3 | S-1-F25-01, S-1-F25-04, S-1-F25-05 | F25 | 3 |
| WU-4 | S-1-F14-01, S-1-F14-02, S-1-F14-03, S-1-F14-04, S-1-F14-05 | F14 | 5 |
| WU-5 | S-1-F18-01, S-1-F18-02, S-1-F18-03, S-1-F21-01, S-1-F21-02, S-1-F21-03, S-1-F21-04 | F18, F21 | 7 |
| WU-6 | S-1-F20-01, S-1-F20-02, S-1-F20-03 | F20 | 3 |
| WU-7 | S-1-F14-01 to S-1-F14-05 (integration), S-1-F25-03 | F14, F25 | 6 |
| WU-8 | S-1-F1-01, S-1-F1-02, S-1-F1-03, S-1-F2-02 (route guards), S-1-F20-05 | F1, F2, F20 | 5 |
| WU-9 | S-1-F22-01, S-1-F22-02, S-1-F22-03, S-1-F22-04 | F22 | 4 |
| **Total** | | | **38 story-tasks** (32 unique stories, some tested across multiple WUs) |

---

## Complexity Sizing

| WU | Title | Files | Complexity | Rationale |
|----|-------|-------|-----------|-----------|
| WU-0 | Project Bootstrap | ~8 | M | Monorepo scaffolding, config files, Makefile. Boilerplate-heavy but low decision density. |
| WU-1 | Database Schema + Roles | 5 | M | 14 SQLAlchemy models, 1 Alembic migration, init scripts. Contracts fully defined in TD. |
| WU-2 | Keycloak Auth | 4 | L | JWKS client, JWT validation, FastAPI dependency. Well-constrained by TD contracts. |
| WU-3 | HMDA Endpoint | 5 | M | Dual connection pools, compliance-only route, demographic filter utility, CI lint. Cross-schema isolation adds complexity. |
| WU-4 | RBAC Middleware | 5 | L | Three-layer RBAC, data scope injection, PII masking, tool auth framework. Highest decision density. |
| WU-5 | LangFuse + Model Routing | 4 | S | Config loading, callback factory, model routing. Mostly wiring. |
| WU-6 | Demo Data Seeding | 3 | M | Realistic data generation for 5 personas, idempotent via manifest table. Data crafting is the complexity. |
| WU-7 | Integration Tests | 3 | L | 16+ test cases across RBAC, HMDA isolation, auth. Must verify cross-WU interactions. |
| WU-8 | Frontend Scaffolding | ~15 | L | React scaffold, routing, auth flow, affordability calculator, landing page. Most files but many are boilerplate. |
| WU-9 | Docker Compose | 4 | M | Profile orchestration, health checks, init scripts, full-stack verification. Integration complexity. |

**Sizing key:** S = Small, M = Medium, L = Large (relative complexity, not effort estimates)

---

## Cross-WU Coordination Notes

### Shared Database Schema
WU-1 creates ALL tables upfront (including Phase 2+ tables) per TD-OQ-01 decision. WU-3, WU-6, and WU-7 consume the schema but do not modify it.

### Auth Context Flow
WU-2 produces `get_current_user` dependency -> WU-4 wraps it with RBAC -> WU-7 tests the full pipeline -> WU-8 consumes via API client. Each WU must use the exact `UserContext` model from the TD hub.

### HMDA Isolation Chain
WU-1 creates dual schemas and roles -> WU-3 enforces pool separation -> WU-7 tests cross-schema denial -> WU-9 verifies in full stack. The CI lint check (WU-3) runs in WU-9's verification.

### Partial Implementations
- **WU-3** (TD-I-03): Demographic filter is standalone utility -- no extraction pipeline until Phase 2
- **WU-4** (TD-I-04): Tool auth is framework-only -- no LangGraph agents until Phase 2

### Frontend-Backend Contract
WU-8 depends on TypeScript interfaces defined in the TD hub, not on running backend services. The API client uses the `ProductInfo`, `AffordabilityRequest`/`Response`, `HealthResponse`, `ErrorResponse`, and `AuthUser` interfaces. WU-9 verifies the full frontend-backend integration.

---

## Chunk Index

Detailed stories with acceptance criteria, implementation prompts, file manifests, and exit conditions:

- **Infrastructure (WU-0, WU-5, WU-9):** `plans/work-breakdown-phase-1-chunk-infra.md`
- **Auth/RBAC (WU-2, WU-4, WU-7):** `plans/work-breakdown-phase-1-chunk-auth.md`
- **Data/HMDA (WU-1, WU-3, WU-6):** `plans/work-breakdown-phase-1-chunk-data.md`
- **Frontend (WU-8):** `plans/work-breakdown-phase-1-chunk-ui.md`

---

## TD Inconsistencies Carried Forward

The following TD inconsistencies affect work breakdown scoping:

| TD-I | Impact on WB | Handling |
|------|-------------|---------|
| TD-I-01 | Story counts in task description were inflated | Using actual 32 stories from requirements |
| TD-I-03 | Demographic filter without extraction pipeline | WU-3 implements standalone utility with unit tests |
| TD-I-04 | Agent tool auth without LangGraph agents | WU-4 implements framework with unit tests |
| TD-I-05 | Empty states for non-existent UIs | WU-8 covers landing page empty states only |
