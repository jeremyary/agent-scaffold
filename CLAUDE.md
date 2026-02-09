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

## Red Hat AI Compliance

All AI-assisted work in this project must comply with Red Hat's internal AI policies. The full machine-enforceable rules are in `.claude/rules/ai-compliance.md`. Summary of obligations:

1. **Human-in-the-Loop** — All AI-generated code must be reviewed, tested, and validated by a human before merge
2. **Sensitive Data Prohibition** — Never input confidential data, PII, credentials, or internal hostnames into AI tools
3. **AI Marking** — Include `// This project was developed with assistance from AI tools.` (or language equivalent) at the top of AI-assisted files, and use `Assisted-by:` / `Generated-by:` commit trailers
4. **Copyright & Licensing** — Verify generated code doesn't reproduce copyrighted implementations; all dependencies must use [Fedora Allowed Licenses](https://docs.fedoraproject.org/en-US/legal/allowed-licenses/)
5. **Upstream Contributions** — Check upstream project AI policies before contributing AI-generated code; default to disclosure
6. **Security Review** — Treat AI-generated code with the same or higher scrutiny as human-written code, especially for auth, crypto, and input handling

See `docs/ai-compliance-checklist.md` for the developer quick-reference checklist.

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
| Shape a product idea into a plan | **Product Manager** | `@product-manager` |
| Gather requirements | **Requirements Analyst** | `@requirements-analyst` |
| Design system architecture | **Architect** | `@architect` |
| Design feature-level implementation approach | **Tech Lead** | `@tech-lead` |
| Break work into epics & stories | **Project Manager** | `@project-manager` |
| Write backend/API code | **Backend Developer** | `@backend-developer` |
| Build UI components | **Frontend Developer** | `@frontend-developer` |
| Design database schema | **Database Engineer** | `@database-engineer` |
| Design API contracts | **API Designer** | `@api-designer` |
| Review code quality | **Code Reviewer** | `@code-reviewer` |
| Write or fix tests | **Test Engineer** | `@test-engineer` |
| Audit security | **Security Engineer** | `@security-engineer` |
| Optimize performance | **Performance Engineer** | `@performance-engineer` |
| Set up CI/CD or infra | **DevOps Engineer** | `@devops-engineer` |
| Define SLOs & incident response | **SRE Engineer** | `@sre-engineer` |
| Debug a problem | **Debug Specialist** | `@debug-specialist` |
| Write documentation | **Technical Writer** | `@technical-writer` |

### How It Works

1. **Start with the Dispatcher** for any non-trivial task — it analyzes your request and creates a sequenced task plan with the right agents.
2. **Use a specialist directly** when you know exactly which agent you need.
3. **Rules files** (imported below) enforce project conventions automatically across all agents.
4. **Spec-Driven Development** is the default for non-trivial features — plan review before code review, machine-verifiable exit conditions, and anti-rubber-stamping governance.
5. **Skills** provide workflow templates and project convention references.

## Project Conventions

@.claude/rules/ai-compliance.md
@.claude/rules/code-style.md
@.claude/rules/python-style.md
@.claude/rules/git-workflow.md
@.claude/rules/testing.md
@.claude/rules/security.md
@.claude/rules/error-handling.md
@.claude/rules/observability.md
@.claude/rules/api-conventions.md
@.claude/rules/agent-workflow.md
@.claude/rules/review-governance.md
@.claude/rules/architecture.md
@.claude/rules/api-development.md
@.claude/rules/ui-development.md
@.claude/rules/database-development.md

## Project Commands

<!-- Uncomment and fill in the actual commands for your project. -->
<!-- The defaults below assume a Makefile-based workflow with Turborepo. -->

### Build
```bash
# make build
```

### Test
```bash
# make test
```

### Lint
```bash
# make lint
```

### Type Check
```bash
# pnpm type-check
```

### Database
```bash
# make db-start
# make db-upgrade
```

### Dev Server
```bash
# make dev
```
