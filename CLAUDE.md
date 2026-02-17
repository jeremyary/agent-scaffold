# AI Banking Quickstart

> **A Red Hat Quickstart demonstrating agentic AI with role-based access control in a financial services context, built for Summit Spotlight showcase and production-grade extensibility.**

## Project Context

| Attribute | Value |
|-----------|-------|
| Maturity | Proof-of-Concept (architected for production growth) |
| Domain | Financial Services |
| Primary Users | Red Hat Summit attendees, Quickstart adopters, AI BU stakeholders |
| Compliance | None (PoC) |

## Goals

1. Demonstrate agentic AI patterns (guardrails, RBAC, model routing) on OpenShift AI
2. Serve as a production-extensible Red Hat Quickstart foundation
3. Deliver a compelling Red Hat Summit Spotlight showcase within ~3 months
4. Show multi-persona experiences (public user, customer, employee) with tiered access controls
5. Ship with pre-seeded data that simulates an established, active pipeline

## Non-Goals

- Real banking system integrations (ServiceNow, Salesforce, etc.)
- Production security hardening beyond demo-appropriate RBAC
- Real customer data handling or PII processing
- Mobile or native client support

## Constraints

- ~3 month delivery timeline targeting Red Hat Summit Spotlight
- Must run on OpenShift AI for production model hosting
- Must accommodate local or OpenAI API-compatible model endpoints for development
- Dual-purpose: must serve as both a Quickstart foundation and a showcase demo
- Requires alignment with AI BU team on final use case direction
- Use case still under evaluation: mortgage loan process vs. general banking (video concept)

## Stakeholder Preferences

| Preference Area | Observed Pattern |
|-----------------|-----------------|
| Planning granularity | Values extremely broken down plans |
| Technology choices | Prefers LangGraph, LangFuse, LlamaStack ecosystem |
| Data realism | Wants pre-seeded data to simulate established system activity |
| Development flexibility | Requires local/OpenAI API-compatible endpoint support alongside OpenShift AI |
| OpenShift AI integration | Use OpenShift AI where possible and showcase different aspects where it makes sense; don't go extremely far out of the way, but attempt to find natural integration points |
| Authentication | Wants real auth via production-grade identity provider (Keycloak suggested); not simulated |
| UX philosophy | Prefers agentic conversational flows over traditional form-based UI |

## Maturity Expectations

Maturity level is **Proof-of-Concept** — smoke tests, console error handling, local dev infra. This governs implementation quality, not workflow phases. A PoC still follows the full plan-review-build-verify sequence when SDD criteria are met. See `.claude/rules/maturity-expectations.md` for the PoC expectations table.

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

- **Language:** Python 3.11+
- **AI/Agent Framework:** LangGraph (agentic orchestration)
- **Observability:** LangFuse (LLM tracing and analytics)
- **LLM Stack:** LlamaStack (model serving abstraction)
- **Model Hosting:** OpenShift AI (production); local or OpenAI API-compatible endpoints (development)
- **Web Framework:** FastAPI
- **Data Validation:** Pydantic 2.x
- **Platform:** OpenShift / Kubernetes
- **Package Manager:** uv
- **Linting / Formatting:** Ruff
- **Testing:** pytest
- **Container:** Podman / Docker
- **Data Strategy:** Pre-seeded demo data simulating established pipeline activity

---

## Agent System

This project uses a multi-agent system with specialized Claude Code agents. The main session handles routing and orchestration using the routing matrix in `.claude/CLAUDE.md`. Each agent has a defined role, model tier, and tool set optimized for its task.

### Quick Reference — "I need to..."

| Need | Agent | Command |
|------|-------|---------|
| Plan a feature or large task | **Main session** | Describe what you need; routing matrix and workflow-patterns skill guide orchestration |
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
| Set up CI/CD or infra | **DevOps Engineer** | `@devops-engineer` |
| Debug a problem | **Debug Specialist** | `@debug-specialist` |

### How It Works

1. **Describe what you need** — for non-trivial tasks, the main session uses the routing matrix and workflow-patterns skill to select agents and sequence work.
2. **Use a specialist directly** when you know exactly which agent you need (e.g., `@backend-developer`).
3. **Rules files** enforce project conventions automatically — global rules are imported below, and path-scoped rules (API, UI, database development) load automatically for matching files.
4. **Spec-Driven Development** is the default for non-trivial features — plan review before code review, machine-verifiable exit conditions, and anti-rubber-stamping governance.
5. **Skills** provide workflow templates and project convention references.

## Project Conventions

### Always-loaded rules (all sessions)

@.claude/rules/ai-compliance.md
@.claude/rules/python-style.md
@.claude/rules/git-workflow.md
@.claude/rules/testing.md
@.claude/rules/security.md
@.claude/rules/agent-workflow.md
@.claude/rules/review-governance.md

### Path-scoped rules (load automatically when editing matching files)

<!-- These rules are NOT @-imported to reduce context pressure on orchestrator sessions. -->
<!-- They load automatically via path-scoping when agents work on files in packages/. -->
<!-- See each rule file's frontmatter for its path scope. -->
<!-- - .claude/rules/error-handling.md      → packages/api/**, packages/db/** -->
<!-- - .claude/rules/observability.md       → packages/api/**, packages/db/** -->
<!-- - .claude/rules/api-conventions.md     → packages/api/** -->
<!-- - .claude/rules/architecture.md        → packages/** -->
<!-- - .claude/rules/maturity-expectations.md (no path scope — loaded on demand) -->

## Project Commands

```bash
# TBD — commands will be defined during architecture phase
# Expected pattern:
# make setup              # Install all dependencies
# make test               # Run test suite
# make lint               # Run ruff check + format
# make dev                # Start local development server
# make seed               # Load pre-seeded demo data
```
