# Project Name

<!-- Replace with your project name and a one-line description -->
> **One-line description of what this project does and who it serves.**

## Project Context

<!-- Fill in these values when starting a new project. Every agent reads this file. -->

| Attribute | Value |
|-----------|-------|
| Maturity | `proof-of-concept` / `mvp` / `production` |
| Domain | <!-- e.g., fintech, healthcare, developer tooling, internal ops --> |
| Primary Users | <!-- e.g., internal developers, end customers, ops team --> |
| Team Size | <!-- solo / small team / large team --> |
| Compliance | <!-- e.g., none, SOC 2, HIPAA, PCI-DSS, FedRAMP --> |

### Maturity Expectations

<!-- Delete the rows that don't apply and keep only your maturity level -->

| Concern | Proof-of-Concept | MVP | Production |
|---------|-------------------|-----|------------|
| Testing | Smoke tests only | Happy path + critical edges | Full coverage targets (80%+) |
| Error handling | Console output is fine | Basic error responses | Structured errors, monitoring, alerting |
| Security | Don't store real secrets | Auth + input validation | Full OWASP audit, dependency scanning, threat model |
| Documentation | README with setup steps | README + API basics | Full docs suite, ADRs, runbooks |
| Performance | Ignore unless broken | Profile obvious bottlenecks | Load testing, SLOs, optimization |
| Code review | Optional | Light review | Full review + security audit gate |
| Infrastructure | Local dev only | Basic CI + single deploy target | Full CI/CD, staging, monitoring, IaC |

## Goals

<!-- What is this project trying to achieve? Be specific. -->

1. <!-- Primary goal -->
2. <!-- Secondary goal -->
3. <!-- Tertiary goal -->

## Non-Goals

<!-- What this project explicitly does NOT do. Helps agents avoid scope creep. -->

- <!-- e.g., "Does not handle payment processing — uses Stripe" -->
- <!-- e.g., "No mobile app — web only for now" -->
- <!-- e.g., "Not building a custom auth system — using Auth0" -->

## Constraints

<!-- Technical, business, or organizational constraints agents should respect. -->

- <!-- e.g., "Must integrate with existing PostgreSQL 14 database" -->
- <!-- e.g., "All services must run in AWS us-east-1" -->
- <!-- e.g., "Budget: no paid services beyond hosting during PoC" -->
- <!-- e.g., "Must support IE11" or "Modern browsers only (last 2 versions)" -->

## Key Decisions

<!-- Record major technology choices here so all agents stay aligned. -->
<!-- Move detailed trade-off analysis to docs/adr/ as the project matures. -->

- **Language:** <!-- e.g., TypeScript 5.x -->
- **Runtime:** <!-- e.g., Node.js 22 LTS -->
- **Backend:** <!-- e.g., Fastify 5 -->
- **Frontend:** <!-- e.g., React 19 + Vite -->
- **Database:** <!-- e.g., PostgreSQL 16 -->
- **ORM:** <!-- e.g., Drizzle -->
- **Testing:** <!-- e.g., Vitest + Playwright -->
- **Package Manager:** <!-- e.g., pnpm -->

---

## Agent System

This project uses a multi-agent system with specialized Claude Code agents orchestrated by a central dispatcher. Each agent has a defined role, model tier, and tool set optimized for its task.

### Quick Reference — "I need to..."

| Need | Agent | Command |
|------|-------|---------|
| Plan a feature or large task | **Dispatcher** | Start here for any multi-step work |
| Design system architecture | **Architect** | `@architect` |
| Write backend/API code | **Backend Developer** | `@backend-developer` |
| Build UI components | **Frontend Developer** | `@frontend-developer` |
| Design database schema | **Database Engineer** | `@database-engineer` |
| Design API contracts | **API Designer** | `@api-designer` |
| Review code quality | **Code Reviewer** | `@code-reviewer` |
| Write or fix tests | **Test Engineer** | `@test-engineer` |
| Audit security | **Security Engineer** | `@security-engineer` |
| Optimize performance | **Performance Engineer** | `@performance-engineer` |
| Set up CI/CD or infra | **DevOps Engineer** | `@devops-engineer` |
| Debug a problem | **Debug Specialist** | `@debug-specialist` |
| Write documentation | **Technical Writer** | `@technical-writer` |
| Gather requirements | **Requirements Analyst** | `@requirements-analyst` |

### How It Works

1. **Start with the Dispatcher** for any non-trivial task — it analyzes your request and creates a sequenced task plan with the right agents.
2. **Use a specialist directly** when you know exactly which agent you need.
3. **Rules files** (imported below) enforce project conventions automatically across all agents.
4. **Skills** provide workflow templates and project convention references.

## Project Conventions

@.claude/rules/code-style.md
@.claude/rules/python-style.md
@.claude/rules/git-workflow.md
@.claude/rules/testing.md
@.claude/rules/security.md
@.claude/rules/error-handling.md
@.claude/rules/observability.md
@.claude/rules/api-conventions.md

## Project Commands

<!-- Uncomment and fill in the actual commands for your project -->

### Build
```bash
# npm run build
```

### Test
```bash
# npm test
```

### Lint
```bash
# npm run lint
```

### Type Check
```bash
# npm run typecheck
```
