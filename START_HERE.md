# Start Here — New Project Setup Guide

This guide walks you through customizing the agent scaffold for a new project. Follow these steps in order after copying the scaffold into your new project directory.

**Time estimate:** 15–30 minutes for a thorough setup.


## Interactive Setup (Recommended)

Instead of following this guide manually, open Claude Code in your new project and run:

```
/setup
```

The setup wizard will walk you through each step interactively — asking questions, gathering your answers, and making all the file edits for you. It covers everything in this guide (the wizard's 13 interactive steps correspond to the 11 steps below, broken into a more granular sequence).

**This document serves as a detailed reference** if you want to understand what each step does, make manual edits later, or customize beyond what the wizard covers. The manual guide has 11 steps covering project identity, tech stack, code style, permissions, agents, domain rules, other rules, personal settings, secrets, AI compliance, and AI-native workflow practices. The scaffold ships with 15 convention rules (11 loaded globally, 4 path-scoped to specific directories) covering both general practices and stack-specific development patterns.

## Prerequisites

- Claude Code CLI installed
- The scaffold copied into your new project directory
- A general idea of your project's goals, tech stack, and target maturity level


## Step 1: Project Identity (`CLAUDE.md`)

**Why this matters:** Every agent inherits the root `CLAUDE.md`. This is where you define *what you're building and why*. Without this, agents make generic decisions instead of project-aligned ones.

**File:** `CLAUDE.md` (root)

Fill in every section at the top of the file:

### 1a. Project Name & Description

Replace the placeholder with your project's name and a one-line summary.

```markdown
# Acme Billing Dashboard

> Internal dashboard for the finance team to manage invoices, track payments, and generate reports.
```

### 1b. Project Context Table

This table drives agent behavior globally. The most impactful field is **Maturity**:

| Maturity | What It Tells Agents |
|----------|---------------------|
| `proof-of-concept` | Optimize for speed of learning. Skip extensive testing, use simple error handling, minimal docs. Focus on validating the idea. |
| `mvp` | Balance speed and quality. Cover happy paths and critical edge cases. Basic CI, lightweight review. |
| `production` | Full rigor. Comprehensive testing, OWASP security audit, structured error handling, monitoring, full documentation. |

Example for a PoC:

```markdown
| Attribute | Value |
|-----------|-------|
| Maturity | `proof-of-concept` |
| Domain | Internal tooling |
| Primary Users | Finance team (5 people) |
| Compliance | none |
```

### 1c. Maturity Expectations Table

Delete the rows for maturity levels that don't apply. Keep only your level so agents have unambiguous guidance. For example, if you're building a PoC, delete the MVP and Production columns.

### 1d. Goals, Non-Goals, Constraints

These prevent agents from over-engineering or wandering into out-of-scope work.

**Goals** — be specific and ordered by priority:
```markdown
1. Validate that real-time invoice status updates are technically feasible with our existing PostgreSQL setup
2. Demonstrate a working prototype to the finance team within 2 weeks
3. Identify whether we need a dedicated reporting service or can query directly
```

**Non-Goals** — explicitly exclude what you're NOT building:
```markdown
- No user authentication (prototype uses hardcoded test user)
- No mobile support
- No payment processing — read-only view of existing Stripe data
```

**Constraints** — things agents must respect:
```markdown
- Must connect to existing production PostgreSQL 14 (read-only replica)
- Must deploy to existing internal Kubernetes cluster
- No new paid services — use only what we already have
```

### 1e. Key Decisions

Lock in your technology choices so all agents stay aligned:

```markdown
- **Language:** TypeScript 5.7
- **Runtime:** Node.js 22 LTS
- **Backend:** Fastify 5
- **Frontend:** React 19 + Vite 6
- **Database:** PostgreSQL 14 (existing, read-only access)
- **ORM:** Drizzle
- **Testing:** Vitest + Playwright
- **Package Manager:** pnpm
```

### 1f. Project Commands

Uncomment and fill in the actual commands at the bottom of CLAUDE.md:

```markdown
### Build
\`\`\`bash
pnpm build
\`\`\`

### Test
\`\`\`bash
pnpm test
\`\`\`
```

## Step 2: Technology Stack Details (`project-conventions/SKILL.md`)

**Why this matters:** This file provides detailed implementation conventions — directory layout, naming patterns, error handling patterns, and environment variables. Agents reference it when writing code.

**File:** `.claude/skills/project-conventions/SKILL.md`

### 2a. Technology Stack Table

Replace the placeholder options with your actual choices and versions:

```markdown
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | 5.7 |
| Runtime | Node.js | 22.x LTS |
| Backend Framework | Fastify | 5.x |
| Frontend Framework | React | 19.x |
| Database | PostgreSQL | 14.x |
| ORM | Drizzle | 0.38.x |
| Testing | Vitest | 3.x |
| E2E Testing | Playwright | 1.50.x |
| Package Manager | pnpm | 9.x |
| CI/CD | GitHub Actions | — |
| Container | Docker | — |
| Cloud | AWS (EKS) | — |
```

### 2b. Project Structure

Replace the example directory tree with your actual (or planned) layout:

```
acme-billing/
├── src/
│   ├── routes/           # Fastify route handlers
│   ├── services/         # Business logic
│   ├── db/
│   │   ├── schema/       # Drizzle schema definitions
│   │   └── migrations/   # Drizzle migrations
│   ├── plugins/          # Fastify plugins
│   └── types/            # Shared TypeScript types
├── web/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── api/          # API client
├── tests/
│   ├── integration/
│   └── e2e/
└── infra/
    ├── docker/
    └── k8s/
```

### 2c. Error Handling Pattern

Replace the TypeScript example with your project's actual pattern, or delete it if you haven't decided yet and want the architect agent to design it.

### 2d. Environment Configuration

List the actual environment variables your project needs:

```markdown
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Read-only replica connection string |
| `STRIPE_API_KEY` | Yes | Stripe read-only API key |
| `PORT` | No | Server port (default: 3000) |
```

## Step 3: Code Style Rules

**Why this matters:** Style rules ensure consistent code across agents. The scaffold ships with two style rules:

| File | Scope | Coverage |
|------|-------|----------|
| `.claude/rules/code-style.md` | Global | TypeScript + Python (merged) — default for full-stack projects |
| `.claude/rules/python-style.md` | `**/*.py` | Python-only alternative — for projects without a frontend |

### 3a. Keep, Modify, or Remove

- **Full-stack project (Python + React):** Use `code-style.md` (the merged version, globally imported). Delete `python-style.md` entirely since `code-style.md` covers Python.
- **Python-only project:** Use `python-style.md`. Remove `code-style.md` and its `@` import from `CLAUDE.md`.
- **JS/TS-only project:** Use `code-style.md` (ignore the Python section). Delete `python-style.md`.
- **Other language:** Delete both and create your own (e.g., `go-style.md` with `globs: "**/*.go"`). Import it from `CLAUDE.md`.

### 3b. Adjust Glob Patterns

The merged `code-style.md` is global (no glob). The path-scoped rules (`api-development.md`, `ui-development.md`, `database-development.md`) use globs targeting the monorepo package layout. If your source code lives in different directories, update the globs:

```yaml
---
globs: "packages/api/**/*"        # Default API scope
globs: "backend/**/*"             # Alternative backend directory
globs: "app/**/*.py"              # Django-style
---
```

### 3c. Review Style Conventions

Each style file has opinionated defaults. Review and adjust:
- **Python:** indentation, line length, formatter (Black/Ruff), import sorting, type hint requirements
- **JS/TS:** indentation, line length, semicolons, quote style, import grouping

## Step 4: Bash Permissions (`.claude/settings.json`)

**Why this matters:** The shared settings file pre-approves safe shell commands so agents don't prompt you for every `git status` or `pytest`. The defaults cover both Python and Node.js/npm toolchains.

**Note:** Package install commands (`npm install`, `pip install`, `uv add`) are intentionally excluded from the allow list. This prevents agents from adding arbitrary dependencies without your approval.

**File:** `.claude/settings.json`

### 4a. Review Built-In Commands

The defaults cover Python (pytest, ruff, mypy, uv, pip, etc.) and Node.js (npm, pnpm, yarn, etc.) out of the box. Review and remove commands for stacks you don't use to keep the list clean.

### 4b. Add Language-Specific Commands (if not Python or Node.js)

If your project uses Go, Rust, Java, or another language, add safe commands:

**Go:**
```json
"Bash(go build *)",
"Bash(go test *)",
"Bash(go vet *)",
"Bash(go mod *)",
"Bash(go fmt *)",
"Bash(golangci-lint *)"
```

**Rust:**
```json
"Bash(cargo build *)",
"Bash(cargo test *)",
"Bash(cargo clippy *)",
"Bash(cargo fmt *)",
"Bash(cargo doc *)",
"Bash(cargo check *)"
```

**Java/Kotlin:**
```json
"Bash(./gradlew *)",
"Bash(gradle *)",
"Bash(mvn *)",
"Bash(./mvnw *)"
```

### 4c. Add WebFetch Domains

Add documentation sites relevant to your stack:

```json
"WebFetch(domain:fastify.dev)",
"WebFetch(domain:react.dev)",
"WebFetch(domain:orm.drizzle.team)",
"WebFetch(domain:vitest.dev)",
"WebFetch(domain:playwright.dev)"
```

### 4d. Review Deny Rules

The defaults block dangerous operations. Add project-specific denials if needed:

```json
"Bash(terraform apply *)",
"Bash(kubectl delete *)",
"Bash(helm uninstall *)"
```

## Step 5: Prune or Add Agents

**Why this matters:** Not every project needs all 17 agents. Unused agents add noise to routing decisions.

**Directory:** `.claude/agents/`

### 5a. Remove Agents You Don't Need

| If your project... | Consider removing |
|--------------------|-------------------|
| Has no frontend | `frontend-developer.md` |
| Has no database | `database-engineer.md` |
| Is a PoC (no infra yet) | `devops-engineer.md`, `security-engineer.md`, `sre-engineer.md` |
| Is a library (no API) | `api-designer.md`, `frontend-developer.md` |
| Is documentation-only | Keep only `technical-writer.md`, remove all others |
| Solo developer (no PM tools) | `project-manager.md` (Jira/Linear export not needed) |
| No product discovery phase | `product-manager.md` (if requirements are already defined) |
| Not running production yet | `sre-engineer.md` (add back when you deploy) |

### 5b. Update the Routing Matrix

If you remove agents, update the routing matrix in `.claude/CLAUDE.md` — remove rows for deleted agents from the "Routing Decision Matrix" and "Agent Capabilities Matrix" tables.

### 5c. Add Custom Agents (Optional)

If your project needs a specialist not in the scaffold, create a new file in `.claude/agents/`. Use an existing agent as a template and follow the frontmatter pattern:

```yaml
---
name: my-agent
description: One-line role summary for routing.
model: sonnet
tools: Read, Write, Edit, Glob, Grep, Bash
permissionMode: acceptEdits
---
```

Note: `name` must be kebab-case and match the filename. `tools` is a comma-separated string (not a YAML array). Optional fields: `memory: project` for cross-session persistence.

Add the new agent to the routing matrix and agent capabilities matrix in `.claude/CLAUDE.md`.

### 5d. Agent Model Tiers

The scaffold defaults to an **expanded hybrid** model strategy — Opus for planning and review agents, Sonnet for implementation agents. You can adjust this based on your budget and quality needs.

| Preset | Opus Agents | Sonnet Agents | Best For |
|--------|-------------|---------------|----------|
| **Cost-optimized** | None | All 17 | PoC, solo developer, budget-constrained, rapid iteration |
| **Hybrid** | Product Manager, Architect | All others | Budget-conscious teams where planning quality still matters |
| **Expanded hybrid** (default) | Product Manager, Architect, Tech Lead, Code Reviewer | All others | Most teams — plan quality and review rigor get Opus, implementation gets Sonnet |
| **Quality-optimized** | All 17 | None | Security-sensitive domains, can't afford to redo work, cost is not a constraint |

To change an agent's model tier, edit the `model:` field in its frontmatter (`.claude/agents/<agent-name>.md`). Then update the Agent Capabilities Matrix and Cost Tiers tables in `.claude/CLAUDE.md` to match.

**Guidance on where Opus matters most:**
- **Product Manager, Architect** — Errors in product direction and architecture cascade through everything downstream.
- **Tech Lead** — Plan quality is the highest-leverage activity in AI-native development. Poor contracts cause integration failures.
- **Code Reviewer** — The last line of defense before code ships. Opus catches subtle issues Sonnet may miss.
- **Implementation agents** — Sonnet is genuinely sufficient for writing code within well-defined contracts. Upgrading these to Opus has the lowest return.

## Step 6: Domain-Specific Rules (Optional)

**Why this matters:** Some projects have domain constraints that cut across all agents — data handling requirements, calculation precision, regulatory formats, etc.

**File:** `.claude/rules/domain.md` (new file)

Create this file if your project has domain-specific rules:

```markdown
# Domain Rules — Healthcare

## Data Handling
- All patient data must be encrypted at rest and in transit
- Never log PII (names, SSNs, DOBs, addresses, phone numbers)
- All database queries involving patient data must include audit trail entries
- Data retention: patient records must support configurable retention periods

## Compliance
- All API endpoints handling PHI must require authenticated sessions
- Session timeout: 15 minutes of inactivity
- Failed login lockout after 5 attempts
```

Import it from root CLAUDE.md by adding:

```markdown
@.claude/rules/domain.md
```

## Step 7: Adjust Other Rules (If Needed)

Review the remaining rules files and adjust if they don't fit your project:

| File | When to Modify |
|------|---------------|
| `.claude/rules/ai-compliance.md` | Different org AI policies, different license list, different internal hostname patterns |
| `.claude/rules/git-workflow.md` | Different branch strategy, non-Conventional Commits |
| `.claude/rules/testing.md` | Different coverage targets, test structure, or naming |
| `.claude/rules/security.md` | Stricter compliance requirements or different security model |
| `.claude/rules/error-handling.md` | Different error format (not RFC 7807), different status code conventions |
| `.claude/rules/observability.md` | Different logging format, different metrics system, custom health check paths |
| `.claude/rules/api-conventions.md` | GraphQL-only (no REST), different pagination strategy, different naming convention |
| `.claude/rules/agent-workflow.md` | Different chunking limits (file count, step count), different context budget |
| `.claude/rules/review-governance.md` | Different PR size limits, different plan-review thresholds, PoC projects may want to remove this |
| `.claude/rules/architecture.md` | Different monorepo layout, different package managers, different dev commands |
| `.claude/rules/api-development.md` | Different backend framework (not FastAPI), different project structure. Remove if no backend API |
| `.claude/rules/ui-development.md` | Different frontend framework (not React/TanStack), different component patterns. Remove if no frontend |
| `.claude/rules/database-development.md` | Different ORM (not SQLAlchemy), different migration tool (not Alembic). Remove if no database |

For most projects, the defaults are reasonable and don't need changes.

## Step 8: Personal Settings (`.claude/settings.local.json`)

**Why this matters:** This file is gitignored — it's for your personal preferences that shouldn't be shared with the team.

**Files:**
- `.claude/settings.local.json.template` — Documented starting point (committed to git)
- `.claude/settings.local.json` — Your active personal config (gitignored)

### 8a. Copy the Template

If `settings.local.json` doesn't already exist, copy the template:

```bash
cp .claude/settings.local.json.template .claude/settings.local.json
```

### 8b. Replace Organization-Specific Domains

The template ships with **Red Hat / OpenShift defaults** for the scaffold author's workflow. These are listed in the `_template.org_domains` key in `settings.local.json.template` for easy identification.

**If you're in the Red Hat ecosystem:** The defaults are ready to use as-is.

**If you're NOT in the Red Hat ecosystem:** Replace the org-specific domains with your organization's equivalents:

| Org-Specific (Red Hat) | Replace With Your Org's Equivalent |
|------------------------|-----------------------------------|
| `docs.openshift.com`, `*.openshift.com` | Your container platform docs |
| `docs.redhat.com`, `access.redhat.com`, `developers.redhat.com` | Your vendor's documentation portal |
| `catalog.redhat.com`, `connect.redhat.com`, `quay.io` | Your container registry / software catalog |
| `docs.opendatahub.io`, `ai-on-openshift.io` | Your ML/AI platform docs |
| `tekton.dev`, `knative.dev` | Your CI/CD and serverless platform docs |
| `olm.operatorframework.io`, `sdk.operatorframework.io` | Your operator/extension framework docs |

The remaining domains (StackOverflow, Kubernetes, Docker, Helm, Prometheus, Grafana, Terraform, Ansible, PyTorch, TensorFlow, etc.) are **general-purpose** and useful across organizations.

### 8c. Add Your Own

Add any personal overrides or additional domains:

```json
"Bash(my-custom-tool *)",
"WebFetch(domain:internal-docs.mycompany.com)"
```

## Step 9: Secrets & Environment File Protection

**Why this matters:** If your project uses `.env` files or similar for secrets, you need multiple layers of protection — not just git, but also AI-assisted tools that can read your files.

### What the scaffold already provides

These protections are built in and active by default:

| Layer | Protection | File |
|-------|-----------|------|
| **Git** | `.env` and `.env.*` excluded from version control | `.gitignore` |
| **Claude Code** | `Read(./.env)` and `Read(./.env.*)` in the deny list — agents cannot read secrets | `.claude/settings.json` |

### What you may still need

**Other AI-assisted IDEs** have their own ignore/deny mechanisms. If you use these tools, configure them separately:

| Tool | Ignore File | Add Pattern |
|------|------------|-------------|
| **Cursor** | `.cursorignore` | `.env*` |
| **Windsurf** | `.windsurfignore` | `.env*` |
| **GitHub Copilot** | IDE settings | Review file access controls |

**Additional secret file patterns** — If your project uses other secret files (e.g., `credentials.json`, `*.pem`, `*.key`, `serviceaccount.json`), add them to:
1. `.gitignore`
2. The `deny` list in `.claude/settings.json` (e.g., `"Read(./credentials.json)"`)
3. Any IDE-specific ignore files you use

**Docker** — If you're building containers, ensure `.env` files are in your `.dockerignore` too.

### Create a `.env.example` (Recommended)

A `.env.example` documents which environment variables your project needs with placeholder values (not real secrets). This is safe to commit and helps new developers know what to configure:

```bash
# .env.example — copy to .env and fill in real values
APP_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
SECRET_KEY=change-me-to-a-random-string
PORT=8000
```

Reference the environment variables you defined in Step 2d (project-conventions) when creating this file.

## Step 10: AI Compliance & Hooks

**Why this matters:** If your team uses AI code assistants, you need clear compliance guardrails — marking AI-generated code, preventing sensitive data leaks, and tracking AI assistance in git history. The scaffold ships with a Red Hat-aligned AI compliance framework that you can adopt as-is or customize for your organization.

### 10a. AI Compliance Rule

**File:** `.claude/rules/ai-compliance.md`

This rule enforces 6 obligations for AI-assisted development: human-in-the-loop review, sensitive data prohibition, AI marking requirements, copyright/licensing checks, upstream contribution policy, and security review standards.

**To customize for your organization:**
- Replace Red Hat-specific references (e.g., `*.redhat.com`, `*.corp.redhat.com`) with your org's internal domains
- Replace the [Fedora Allowed Licenses](https://docs.fedoraproject.org/en-US/legal/allowed-licenses/) link with your org's approved license list
- Adjust the upstream contribution policy section to match your org's open-source guidelines

**To remove if not needed:** Delete `.claude/rules/ai-compliance.md`, remove the `@.claude/rules/ai-compliance.md` import from `CLAUDE.md`, and remove the "Red Hat AI Compliance" section from `CLAUDE.md`.

### 10b. Git Hook: AI Assistance Trailers

**File:** `.claude/hooks/prepare-commit-msg`

This hook automatically appends an `Assisted-by: Claude Code` trailer to commits made through Claude Code. It detects Claude Code commits by checking for the `Co-Authored-By` trailer or the `CLAUDE_CODE` environment variable.

**Setup (choose one):**

```bash
# Option 1 — Symlink (recommended, stays in sync with the repo)
ln -sf ../../.claude/hooks/prepare-commit-msg .git/hooks/prepare-commit-msg

# Option 2 — Set hooks directory (replaces ALL hooks paths — copy existing hooks first)
git config core.hooksPath .claude/hooks

# Option 3 — Copy (static, won't auto-update)
cp .claude/hooks/prepare-commit-msg .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg
```

The hook does nothing for merge or squash commits. To change the default trailer (e.g., to `Generated-by: Claude Code`), edit the `DEFAULT_TRAILER` variable in the script or set the `CLAUDE_COMMIT_TRAILER` environment variable.

### 10c. Sensitive Data Check (Optional)

**File:** `.claude/hooks/sensitive-data-check.sh`

This script scans text for patterns that may indicate sensitive data (credentials, internal hostnames, PII) before it's sent to AI tools. It catches AWS keys, API tokens, private keys, internal hostnames, RFC 1918 IPs, email addresses, passwords, connection strings, and GitHub/GitLab tokens.

**To enable for yourself (personal use):**

Copy the hooks configuration from `.claude/settings.local.json.template` into your `.claude/settings.local.json`:

```json
{
  "permissions": { ... },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "command": ".claude/hooks/sensitive-data-check.sh"
      }
    ]
  }
}
```

**To enable for the whole team:**

Add the same `hooks` block to `.claude/settings.json` (the shared, committed config).

**To customize patterns:** Edit the script to add project-specific patterns in the `CUSTOM_PATTERNS` section, or adjust the internal hostname regex for your organization (replace `redhat.com` patterns with your org's domains).

### 10d. AI Compliance Checklist

**File:** `docs/ai-compliance-checklist.md`

A developer quick-reference checklist covering pre-work, during development, at commit time, at PR/review time, and upstream contributions. Also includes common scenarios and an FAQ. Share this with your team as a practical guide alongside the machine-enforced rules.

## Step 11: AI-Native Workflow Practices

**Why this matters:** Traditional Agile breaks down when AI generates code faster than humans can review it. These rules operationalize practices that keep AI-generated code from becoming unreviewed tech debt.

### 11a. Agent Workflow Rule

**File:** `.claude/rules/agent-workflow.md`

This rule enforces two disciplines across all agents:

- **Task Chunking** — Keeps autonomous work small enough to succeed (3–5 files per task, 5–7 steps per chain, machine-verifiable exit conditions). Based on the error propagation model: at 95% per-step reliability, long chains compound errors.
- **Context Engineering** — Teaches agents to load only what's relevant and stop when the codebase diverges from the spec.

**When to adjust:** If your tasks consistently need more than 5 files (e.g., cross-cutting refactors), increase the limit in the rule file. The 3–5 file limit is a default for typical feature work.

### 11b. Review Governance Rule

**File:** `.claude/rules/review-governance.md`

This rule enforces review discipline:

- **Plan-Review-First** — For features with 3+ tasks, the Tech Lead's Technical Design must be reviewed before implementation begins.
- **Anti-Rubber-Stamping** — Reviews must produce at least one finding. Zero-finding APPROVE is flagged as suspicious.
- **PR Size Limits** — AI-generated PRs target ~400 changed lines (excluding tests/generated files). Beyond this, meaningful review is impractical.
- **Two-Agent Review** — Auth, crypto, and data deletion code requires both `@code-reviewer` and `@security-engineer`.

**Note for PoC maturity:** At proof-of-concept maturity, you may want to relax plan-review-first (skip the Tech Lead step for rapid iteration). You can remove the `@.claude/rules/review-governance.md` import from `CLAUDE.md` and re-add it when the project matures to MVP.

### 11c. Team Playbook

**File:** `docs/ai-native-team-playbook.md`

A human-facing reference covering bolt methodology (scope-boxed iterations), new team rituals, metrics to track (and stop tracking), role evolution, and common anti-patterns. Recommended reading for the whole team — it doesn't affect agent behavior, but it provides context for why the agent rules exist.

## Quick-Start Checklist

Copy this checklist and check off items as you go:

```
[ ] Step 1: CLAUDE.md — project name, maturity, goals, non-goals, constraints, key decisions, commands
[ ] Step 2: project-conventions/SKILL.md — tech stack table, directory structure, env vars
[ ] Step 3: Style rules — keep/remove/adjust python-style.md and code-style.md for your language(s)
[ ] Step 4: settings.json — bash commands + WebFetch domains for your stack
[ ] Step 5: Remove unused agents, update routing matrix in .claude/CLAUDE.md
[ ] Step 6: (Optional) Add .claude/rules/domain.md for domain-specific rules
[ ] Step 7: (Optional) Review ai-compliance.md, git-workflow.md, testing.md, security.md, error-handling.md, observability.md, api-conventions.md
[ ] Step 8: Copy settings.local.json.template → settings.local.json, replace org-specific domains
[ ] Step 9: Verify secrets protection — IDE ignore files, .env.example, .dockerignore if applicable
[ ] Step 10: AI compliance — review ai-compliance.md, set up prepare-commit-msg hook, optionally enable sensitive data check
[ ] Step 11: AI-native workflow — review agent-workflow.md and review-governance.md rules, share team playbook
```

## Available Slash Commands

After setup, these skills are available in your project:

| Command | What It Does |
|---------|-------------|
| `/setup` | Re-run the interactive setup wizard to reconfigure the project |
| `/review` | Run a combined code quality + security review on the current branch |
| `/status` | Run lint, typecheck, tests, and dependency audit — report a health dashboard |
| `/adr` | Create a new Architecture Decision Record interactively |

## Glossary of Claude Code Concepts

If you're new to Claude Code's agent system, here's a quick reference:

| Concept | What It Means |
|---------|---------------|
| **`@agent-name`** | Mention an agent in your prompt to invoke it (e.g., `@architect design a caching layer`) |
| **`/skill-name`** | Invoke a user-invocable skill as a slash command (e.g., `/review`, `/setup`) |
| **`tools`** | Frontmatter field in agent files — comma-separated string restricting which tools the agent can use |
| **`memory: project`** | Agent retains context across sessions for this project (learns over time) |
| **`model: opus`** | Uses the most capable (and most expensive) Claude model — reserved for high-impact decisions |
| **`model: sonnet`** | Uses the standard Claude model — good quality at lower cost, used for most implementation work |
| **plan mode (read-only)** | Agent can read and analyze code but cannot modify files — enforced by lacking Write/Edit tools |
| **acceptEdits mode** | Agent can read and modify files; file edits are auto-accepted, Bash commands still require approval |
| **`blockedBy`** | Task dependency — a task won't start until the tasks it's blocked by are complete |
| **`settings.json`** | Shared permission configuration — committed to git, applies to all team members |
| **`settings.local.json`** | Personal permission overrides — gitignored, only applies to you |
| **`@.claude/rules/file.md`** | Import directive in CLAUDE.md — includes the referenced rule file's content |
| **`globs` frontmatter** | Path-scoping for rules — the rule only applies to files matching the glob pattern |

## Cost Guidance

The scaffold uses two model tiers. The cost difference is significant:

| Tier | Model | Agents | Relative Cost | Use For |
|------|-------|--------|---------------|---------|
| **High** | Opus | Product Manager, Architect, Tech Lead, Code Reviewer | ~5x Sonnet | Product strategy, architecture, technical design, code review — errors in planning and review cascade |
| **Standard** | Sonnet | All 13 others | 1x (baseline) | Implementation, analysis, project management, documentation — quality is sufficient for the task |

The default is **expanded hybrid** — Opus for agents where plan quality and review rigor have the highest leverage (product, architecture, technical design, code review). Implementation agents use Sonnet, which is sufficient for writing code within well-defined contracts.

For cost-conscious usage:
- Use specialist agents directly (e.g., `@backend-developer`) when you know which agent you need
- The workflow-patterns skill provides sequencing templates for complex, cross-cutting tasks
- Switch to all-sonnet for rapid PoC iteration where cost matters more than precision (see Step 5d)

## What's Next — Using the Scaffold

Setup is done. Now you need to know how to actually use this thing. Here's what to reach for depending on what you're doing.

### "I need to build a non-trivial feature"

Follow the **Spec-Driven Development (SDD) workflow** — the scaffold's recommended lifecycle for any feature involving new APIs, data shapes, or 3+ implementation tasks.

**How it works in practice:**

1. Ask `@product-manager` to create a product plan (`plans/product-plan.md`) — scoped to product concerns only (no architecture, no story breakout)
2. Ask relevant agents (Architect, API Designer, Security Engineer) to review the plan — each writes a review to `plans/reviews/`
3. Step through each review's recommendations with Claude Code and resolve them
4. Ask `@product-manager` to validate the plan after changes
5. Ask `@architect` to create the architecture design (`plans/architecture.md`) — same review-resolve-validate cycle
6. Ask `@requirements-analyst` to create requirements (`plans/requirements.md`) — same review-resolve-validate cycle
7. **Pause here** — don't proceed until product plan, architecture, and requirements are all thorough and agreed upon
8. Ask `@tech-lead` to create a technical design for Phase 1 — review and validate
9. Ask `@project-manager` to break out sized tasks for Phase 1
10. Implement, review, repeat for Phase 2

Each step stays strictly within its scope — the product plan doesn't include architecture, the architecture doesn't include task breakdown, etc. This prevents premature solutioning and gives each agent room to do their job well.

**Full details:** `.claude/skills/workflow-patterns/SKILL.md` → "Spec-Driven Development (SDD)" section.

### "I need to do something quick"

Not everything needs the full SDD lifecycle. Use the right tool for the job:

| Situation | What to Do |
|-----------|-----------|
| Bug fix with known cause | `@debug-specialist` directly |
| Single-file code change | Ask the relevant implementer directly (`@backend-developer`, `@frontend-developer`) |
| Performance issue | `@performance-engineer` directly |
| Quick code review | `/review` slash command |
| Health check | `/status` slash command |
| Architecture decision | `@architect` directly, or `/adr` for an interactive ADR |

### "I have a complex request but I'm not sure which agents to use"

Describe what you need in plain language. The main session uses the routing matrix (`.claude/CLAUDE.md`) and the workflow-patterns skill to select the right agents and sequence work.

For single-domain tasks where you know the right agent, invoke it directly (e.g., `@backend-developer`). For cross-cutting work, the workflow-patterns skill provides sequencing templates for common scenarios.

### Key references

| Document | What It Covers | When to Read |
|----------|---------------|-------------|
| **`.claude/skills/workflow-patterns/SKILL.md`** | All workflow patterns (SDD, bug fix, refactoring, etc.) with phase-by-phase breakdowns | When you need to know the right sequence of agents for a type of work |
| **`docs/ai-native-team-playbook.md`** | Team rituals, metrics, role evolution, anti-patterns | When onboarding the team or establishing team practices around AI-assisted development |
| **`.claude/rules/agent-workflow.md`** | Task chunking limits and context engineering rules | When agents are producing poor results (tasks may be too large or context too noisy) |
| **`.claude/rules/review-governance.md`** | Review discipline — plan-first, anti-rubber-stamping, PR size | When reviews feel rubber-stamped or AI-generated PRs are too large to review meaningfully |
| **`.claude/CLAUDE.md`** | Agent routing matrix and orchestration patterns | When you need to know which agent handles what, or how agents coordinate |
