# Project Name
<!-- Run /setup to configure this project. Placeholder sections waste context tokens. -->

> **One-line description of what this project does and who it serves.**

## Project Context
<!-- Run /setup to configure. -->

| Attribute | Value |
|-----------|-------|
| Maturity | |
| Domain | |
| Primary Users | |
| Compliance | |

## Goals
<!-- Run /setup to configure. -->

## Non-Goals
<!-- Run /setup to configure. -->

## Constraints
<!-- Run /setup to configure. -->

## Stakeholder Preferences
<!-- Accumulates over time as agents learn from interactions. Run /setup for initial values. -->

| Preference Area | Observed Pattern |
|-----------------|-----------------|

## Maturity Expectations

Maturity level governs **implementation quality**, not **workflow phases**. A PoC still follows the full plan-review-build-verify sequence when SDD criteria are met. See `.claude/rules/maturity-expectations.md` for the full matrix.

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
<!-- Run /setup to configure. -->

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
| Optimize performance | **Performance Engineer** | `@performance-engineer` |
| Set up CI/CD or infra | **DevOps Engineer** | `@devops-engineer` |
| Define SLOs & incident response | **SRE Engineer** | `@sre-engineer` |
| Debug a problem | **Debug Specialist** | `@debug-specialist` |
| Write documentation | **Technical Writer** | `@technical-writer` |

### How It Works

1. **Describe what you need** — for non-trivial tasks, the main session uses the routing matrix and workflow-patterns skill to select agents and sequence work.
2. **Use a specialist directly** when you know exactly which agent you need (e.g., `@backend-developer`).
3. **Rules files** enforce project conventions automatically — global rules are imported below, and path-scoped rules (API, UI, database development) load automatically for matching files.
4. **Spec-Driven Development** is the default for non-trivial features — plan review before code review, machine-verifiable exit conditions, and anti-rubber-stamping governance.
5. **Skills** provide workflow templates and project convention references.

## Project Conventions

@.claude/rules/ai-compliance.md
@.claude/rules/code-style.md
@.claude/rules/git-workflow.md
@.claude/rules/testing.md
@.claude/rules/security.md
@.claude/rules/error-handling.md
@.claude/rules/observability.md
@.claude/rules/api-conventions.md
@.claude/rules/agent-workflow.md
@.claude/rules/review-governance.md
@.claude/rules/architecture.md

## Project Commands
<!-- Run /setup to configure. -->
