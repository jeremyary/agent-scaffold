# Agent Scaffold

A template repository that provides a complete Claude Code multi-agent system for software development -- from product discovery through deployment. It ships pre-configured with 17 specialist agents, 16 convention rules, 8 skills, 2 git hooks, and a shared permissions baseline so your team can start building with AI-assisted workflows immediately.

> **This README describes the template itself.** Once you've set up your project using `/setup` or [START_HERE.md](START_HERE.md), replace this file with your project's own README.

---

## How It Works

The scaffold turns Claude Code into an AI development team. Each agent has a defined role, model tier, tool permissions, and behavioral rules. The main Claude Code session acts as an orchestrator, routing your requests to the right specialist based on a keyword-matching decision matrix.

```
You describe what you need
        |
   Main session (orchestrator)
        |
   Routes to specialist agent(s)
        |
   Agent reads project rules + relevant code
        |
   Agent produces output (plan, code, review, etc.)
```

Agents don't operate in a vacuum. Convention rules constrain how they write code, structure errors, handle secrets, and format commits. Skills provide reusable workflow templates. Hooks automate compliance tasks at commit time.

## Agents

17 specialist agents, each defined in `.claude/agents/`. Agents are invoked with `@agent-name` in your prompt.

### Planning and Strategy

| Agent | Model | Description |
|-------|-------|-------------|
| **Product Manager** | Opus | Product discovery, PRDs, roadmaps, feature prioritization, persona definition |
| **Architect** | Opus | System design, ADRs, technology trade-offs, high-level structure |
| **Tech Lead** | Opus | Feature-level technical designs, interface contracts, implementation approach |
| **Requirements Analyst** | Sonnet | Requirements gathering, user stories, acceptance criteria |

### Implementation

| Agent | Model | Description |
|-------|-------|-------------|
| **Backend Developer** | Sonnet | Server-side code, API handlers, business logic, middleware |
| **Frontend Developer** | Sonnet | UI components, client-side state, accessibility, responsive design |
| **Database Engineer** | Sonnet | Schema design, migrations, query optimization, data integrity |
| **API Designer** | Sonnet | OpenAPI specs, API contracts, REST/GraphQL interface design |

### Quality and Security

| Agent | Model | Description |
|-------|-------|-------------|
| **Code Reviewer** | Opus | Code quality analysis, standards adherence, best practices (read-only) |
| **Test Engineer** | Sonnet | Test strategy, test authoring, coverage analysis |
| **Security Engineer** | Sonnet | Vulnerability analysis, threat modeling, security audit (read-only) |

### Operations and Support

| Agent | Model | Description |
|-------|-------|-------------|
| **Project Manager** | Sonnet | Epic/story breakdown, work estimation, Jira/Linear/GitHub exports |
| **DevOps Engineer** | Sonnet | CI/CD pipelines, Docker/K8s configs, infrastructure as code |
| **SRE Engineer** | Sonnet | SLO/SLI definitions, runbooks, alerting, incident response |
| **Performance Engineer** | Sonnet | Profiling, bottleneck identification, optimization |
| **Debug Specialist** | Sonnet | Structured root cause analysis, systematic bug diagnosis |
| **Technical Writer** | Sonnet | Documentation, changelogs, API docs |

The default model assignment uses an **expanded hybrid** strategy: Opus for planning and review agents (where errors cascade), Sonnet for implementation agents (where well-defined contracts make Opus unnecessary). This is configurable per-agent.

Nine agents have cross-session memory enabled, so they learn your project's patterns, decisions, and preferences over time.

## Convention Rules

15 rule files in `.claude/rules/`. Rules are loaded automatically -- 11 globally via `CLAUDE.md` imports, and 4 scoped to specific file paths (API, UI, database code, and Python files).

| Rule | Scope | What It Governs |
|------|-------|-----------------|
| `code-style.md` | Global | TypeScript + Python naming, formatting, imports, component patterns |
| `python-style.md` | `**/*.py` | Python-only style alternative (for projects without a frontend) |
| `git-workflow.md` | Global | Branch naming, conventional commits, AI assistance trailers |
| `testing.md` | Global | Coverage targets, test naming, AAA pattern, isolation rules |
| `security.md` | Global | Secrets handling, input validation, auth, transport, dependencies |
| `error-handling.md` | Global | RFC 7807 error responses, HTTP status codes, error class hierarchy |
| `observability.md` | Global | Structured logging, log levels, correlation IDs, health checks, metrics |
| `api-conventions.md` | Global | REST resource design, pagination, filtering, versioning, rate limiting |
| `ai-compliance.md` | Global | Human-in-the-loop, AI marking, sensitive data prohibition, licensing |
| `agent-workflow.md` | Global | Task chunking limits (3-5 files, 5-7 steps), context engineering |
| `review-governance.md` | Global | Plan-review-first, anti-rubber-stamping, PR size limits, two-agent review |
| `architecture.md` | Global | Monorepo structure, package managers, inter-package dependencies |
| `api-development.md` | `packages/api/**` | Backend framework patterns (FastAPI by default) |
| `ui-development.md` | `packages/ui/**` | Frontend framework patterns (React/TanStack by default) |
| `database-development.md` | `packages/db/**` | ORM patterns, migration conventions (SQLAlchemy/Alembic by default) |

Rules are meant to be customized. The scaffold ships with opinionated defaults (TypeScript + Python, monorepo, REST APIs) that you adjust to match your stack during setup.

## Skills (Slash Commands)

8 skills in `.claude/skills/`. User-invocable skills are used as slash commands in Claude Code.

| Command | Description |
|---------|-------------|
| `/setup` | Interactive project setup wizard -- walks through every configuration step |
| `/review` | Combined code quality + security review on the current branch |
| `/status` | Project health check -- lint, type check, tests, dependency audit |
| `/adr` | Create an Architecture Decision Record interactively |

Additional skills are referenced internally by agents (not invoked directly):

| Skill | Used By |
|-------|---------|
| `project-conventions` | All agents -- technology stack details, directory layout, environment config |
| `workflow-patterns` | Orchestrator -- sequencing templates for SDD, bug fixes, refactoring, etc. |
| `pm-exports` | Project Manager -- export templates for Jira, Linear, GitHub Projects |
| `sre-templates` | SRE Engineer -- SLO definitions, runbooks, alerting rules, capacity plans |

## Hooks

2 git hooks in `.claude/hooks/`.

| Hook | Purpose |
|------|---------|
| `prepare-commit-msg` | Appends `Assisted-by: Claude Code` trailer to AI-assisted commits automatically |
| `sensitive-data-check.sh` | Scans for credentials, PII, internal hostnames, and API keys before tool execution |

The commit hook activates via symlink or `git config core.hooksPath`. The sensitive data check is opt-in -- enable it in `settings.local.json` (personal) or `settings.json` (team-wide).

## Permissions

`.claude/settings.json` provides a shared permissions baseline committed to git:

- **Pre-approved:** Git read commands, test runners, linters, type checkers, formatters, Docker build/compose, Terraform plan/validate, file operations (mkdir, cp, mv, touch)
- **Blocked:** `rm -rf`, force push, `git reset --hard`, `chmod 777`, pipe-to-bash, reading `.env` files
- **Intentionally excluded:** Package install commands (`npm install`, `pip install`, `uv add`) -- agents must ask before adding dependencies

A `.claude/settings.local.json.template` provides a starting point for personal overrides (WebFetch domains, org-specific tools). Copy it to `settings.local.json` (which is gitignored) and customize.

## Orchestration

The main Claude Code session routes requests using a decision matrix in `.claude/CLAUDE.md`. For complex, multi-step work, it sequences agents using patterns defined in the `workflow-patterns` skill:

- **Sequential chain** -- tasks in strict order, each feeding the next
- **Parallel fan-out** -- independent tasks run concurrently, then synchronize
- **Review gate** -- implementation followed by mandatory review before proceeding
- **Iterative loop** -- profile, fix, verify, repeat until targets are met

The recommended lifecycle for non-trivial features is **Spec-Driven Development (SDD)**: product plan, architecture, requirements, technical design, task breakdown, implementation, review -- with review gates between phases. Quick tasks (bug fixes, single-file changes) skip the ceremony and go directly to the relevant specialist.

## Getting Started

**Option 1 -- Interactive setup (recommended):**
1. Use this template to create a new repository (or copy the directory)
2. Open the project in Claude Code
3. Run `/setup` -- the wizard asks questions and configures everything

**Option 2 -- Manual setup:**
1. Use this template to create a new repository (or copy the directory)
2. Follow [START_HERE.md](START_HERE.md) -- 11 steps covering project identity, tech stack, style rules, permissions, agents, domain rules, hooks, and secrets

Both paths produce the same result. The wizard is faster; the manual guide gives you more context about what each setting does and why.

## Key Design Decisions

**Why 17 agents instead of one general-purpose agent?** Specialization reduces hallucination. A backend developer agent loaded with API conventions produces better code than a generalist that has to context-switch between UI patterns and database migrations. Each agent loads only the rules relevant to its domain.

**Why Opus for planning, Sonnet for implementation?** Errors in planning cascade through everything downstream. A flawed architecture decision costs far more to fix than a flawed function implementation. Opus handles the high-leverage decisions; Sonnet handles execution within well-defined contracts.

**Why so many rules?** Rules are cheap context (short files, always relevant) that prevent the most common AI code generation failures: inconsistent style, missing error handling, rubber-stamped reviews, over-scoped tasks, leaked secrets. They encode team knowledge that would otherwise be re-explained every session.

**Why task chunking limits?** At 95% per-step reliability, a 20-step autonomous chain succeeds only ~36% of the time. Keeping tasks to 5-7 steps and 3-5 files resets the error chain and keeps compound failure probability manageable.

**Why a repo template instead of a Claude Code plugin?** Plugins cannot ship arbitrary files like git hooks, settings templates, or path-scoped rules -- they only support a subset of what the scaffold provides. A repo template gives you the full file tree on day one with no bootstrap step required.

## Customization

Everything in this scaffold is meant to be modified. During setup you will:

- Set your project's maturity level (PoC, MVP, Production) which governs how much rigor agents apply
- Choose your tech stack and adjust rules to match
- Remove agents you don't need (no frontend? delete `frontend-developer.md`)
- Add domain-specific rules for your industry (healthcare, fintech, etc.)
- Configure which model tier each agent uses based on your budget
- Set up permissions for your specific toolchain

See [START_HERE.md](START_HERE.md) for the full walkthrough, or run `/setup` for the interactive version.

## Documentation

| Document | Purpose |
|----------|---------|
| [START_HERE.md](START_HERE.md) | Complete setup guide (11 steps) |
| [CLAUDE.md](CLAUDE.md) | Project configuration read by all agents |
| [.claude/CLAUDE.md](.claude/CLAUDE.md) | Agent routing matrix and orchestration patterns |
| [docs/ai-native-team-playbook.md](docs/ai-native-team-playbook.md) | Team practices for AI-assisted development |
| [docs/ai-compliance-checklist.md](docs/ai-compliance-checklist.md) | Developer quick-reference for AI compliance |
