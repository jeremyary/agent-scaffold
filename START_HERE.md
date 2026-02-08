# Start Here — New Project Setup Guide

This guide walks you through customizing the agent scaffold for a new project. Follow these steps in order after copying the scaffold into your new project directory.

**Time estimate:** 15–30 minutes for a thorough setup.

---

## Interactive Setup (Recommended)

Instead of following this guide manually, open Claude Code in your new project and run:

```
/setup
```

The setup wizard will walk you through each step interactively — asking questions, gathering your answers, and making all the file edits for you. It covers everything in this guide (the wizard's 13 interactive steps correspond to the 9 steps below, broken into a more granular sequence).

**This document serves as a detailed reference** if you want to understand what each step does, make manual edits later, or customize beyond what the wizard covers.

---

## Prerequisites

- Claude Code CLI installed
- The scaffold copied into your new project directory
- A general idea of your project's goals, tech stack, and maturity level

---

## Glossary of Claude Code Concepts

If you're new to Claude Code's agent system, here's a quick reference:

| Concept | What It Means |
|---------|---------------|
| **`@agent-name`** | Mention an agent in your prompt to invoke it (e.g., `@architect design a caching layer`) |
| **`/skill-name`** | Invoke a user-invocable skill as a slash command (e.g., `/review`, `/setup`) |
| **`allowedTools`** | YAML frontmatter field in agent files — restricts which tools the agent can use |
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
| **High** | Opus | Dispatcher, Architect | ~5x Sonnet | Routing decisions, architecture — errors here cascade through everything |
| **Standard** | Sonnet | All 12 others | 1x (baseline) | Implementation, review, analysis — quality is sufficient for the task |

For cost-conscious usage:
- Use specialist agents directly (e.g., `@backend-developer`) instead of the dispatcher when you know which agent you need — this skips the Opus routing step
- The dispatcher is most valuable for complex, cross-cutting tasks where routing errors would waste downstream work
- Read-only agents (Code Reviewer, Security Engineer) are cheap since they don't generate file edits

---

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
| Team Size | solo |
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

---

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

---

## Step 3: Code Style Rules

**Why this matters:** Style rules are path-scoped and language-specific. The scaffold ships with two style rules out of the box:

| File | Language | Glob |
|------|----------|------|
| `.claude/rules/python-style.md` | Python | `**/*.py` |
| `.claude/rules/code-style.md` | TypeScript/JS/React | `src/**/*.{ts,tsx,js,jsx}` |

### 3a. Keep, Modify, or Remove

- **Python + React project:** Both files are relevant — review each and adjust conventions to match your tooling (e.g., Black vs. Ruff, Vitest vs. Jest).
- **Python-only project:** Delete `code-style.md` and remove its `@` import from `CLAUDE.md`.
- **JS/TS-only project:** Delete `python-style.md` and remove its `@` import from `CLAUDE.md`.
- **Other language:** Delete both and create your own (e.g., `go-style.md` with `globs: "**/*.go"`). Import it from `CLAUDE.md`.

### 3b. Adjust Glob Patterns

If your source code lives in a non-standard directory, update the glob:

```yaml
---
globs: "app/**/*.py"              # Django-style
globs: "{src,web}/**/*.{ts,tsx}"  # Multiple directories
---
```

### 3c. Review Style Conventions

Each style file has opinionated defaults. Review and adjust:
- **Python:** indentation, line length, formatter (Black/Ruff), import sorting, type hint requirements
- **JS/TS:** indentation, line length, semicolons, quote style, import grouping

---

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

---

## Step 5: Prune or Add Agents

**Why this matters:** Not every project needs all 14 agents. Unused agents add noise to the dispatcher's routing decisions.

**Directory:** `.claude/agents/`

### 5a. Remove Agents You Don't Need

| If your project... | Consider removing |
|--------------------|-------------------|
| Has no frontend | `frontend-developer.md` |
| Has no database | `database-engineer.md` |
| Is a PoC (no infra yet) | `devops-engineer.md`, `security-engineer.md` |
| Is a library (no API) | `api-designer.md`, `frontend-developer.md` |
| Is documentation-only | Keep only `technical-writer.md`, remove all others |

### 5b. Update the Dispatcher

If you remove agents, update the dispatcher's agent table in `.claude/agents/dispatcher.md` — remove the deleted agents from the "Available Agents" table so it doesn't try to route to them.

### 5c. Update the Routing Matrix

Also update the routing matrix in `.claude/CLAUDE.md` — remove rows for deleted agents from the "Routing Decision Matrix" and "Agent Capabilities Matrix" tables.

### 5d. Add Custom Agents (Optional)

If your project needs a specialist not in the scaffold, create a new file in `.claude/agents/`. Use an existing agent as a template and follow the frontmatter pattern:

```yaml
---
model: sonnet
allowedTools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
---
```

Add the new agent to the dispatcher's table and the routing matrix in `.claude/CLAUDE.md`.

---

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

---

## Step 7: Adjust Other Rules (If Needed)

Review the remaining rules files and adjust if they don't fit your project:

| File | When to Modify |
|------|---------------|
| `.claude/rules/git-workflow.md` | Different branch strategy, non-Conventional Commits |
| `.claude/rules/testing.md` | Different coverage targets, test structure, or naming |
| `.claude/rules/security.md` | Stricter compliance requirements or different security model |
| `.claude/rules/error-handling.md` | Different error format (not RFC 7807), different status code conventions |
| `.claude/rules/observability.md` | Different logging format, different metrics system, custom health check paths |
| `.claude/rules/api-conventions.md` | GraphQL-only (no REST), different pagination strategy, different naming convention |

For most projects, the defaults are reasonable and don't need changes.

---

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

The template ships with **Red Hat / OpenShift defaults** for the scaffold author's workflow. These are listed in the `_template.org_domains` key at the top of the template file for easy identification.

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

---

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

---

## Quick-Start Checklist

Copy this checklist and check off items as you go:

```
[ ] Step 1: CLAUDE.md — project name, maturity, goals, non-goals, constraints, key decisions, commands
[ ] Step 2: project-conventions/SKILL.md — tech stack table, directory structure, env vars
[ ] Step 3: Style rules — keep/remove/adjust python-style.md and code-style.md for your language(s)
[ ] Step 4: settings.json — bash commands + WebFetch domains for your stack
[ ] Step 5: Remove unused agents, update dispatcher + routing matrix
[ ] Step 6: (Optional) Add .claude/rules/domain.md for domain-specific rules
[ ] Step 7: (Optional) Review git-workflow.md, testing.md, security.md, error-handling.md, observability.md, api-conventions.md
[ ] Step 8: Copy settings.local.json.template → settings.local.json, replace org-specific domains
[ ] Step 9: Verify secrets protection — IDE ignore files, .env.example, .dockerignore if applicable
```

---

## Available Slash Commands

After setup, these skills are available in your project:

| Command | What It Does |
|---------|-------------|
| `/setup` | Re-run the interactive setup wizard to reconfigure the project |
| `/review` | Run a combined code quality + security review on the current branch |
| `/status` | Run lint, typecheck, tests, and dependency audit — report a health dashboard |
| `/adr` | Create a new Architecture Decision Record interactively |

## Verification

After completing setup, verify everything works:

1. **Open Claude Code** in the project directory
2. **Check agents are discovered:** Type `@` and verify your agents appear in autocomplete
3. **Test the dispatcher:** Ask it to plan a small task relevant to your project
4. **Test a specialist:** Ask a relevant agent to do a small, concrete task
5. **Check rules apply:** Ask an implementation agent to write code and verify it follows your code style rules
6. **Test a skill:** Run `/status` to verify project commands are configured correctly

---

## Example: PoC Setup in 5 Minutes

If you're starting a quick proof-of-concept, here's the minimal path:

1. **CLAUDE.md** — Fill in project name, set maturity to `proof-of-concept`, list 2-3 goals, note key tech choices, fill in commands
2. **project-conventions/SKILL.md** — Fill in tech stack table only (skip the rest)
3. **Style rules** — Delete the style rule file you don't need (python-style.md or code-style.md) and remove its `@` import from CLAUDE.md
4. **Delete agents:** Remove `security-engineer.md`, `devops-engineer.md`, `performance-engineer.md`, `technical-writer.md`, `requirements-analyst.md` — you won't need them yet
5. **Update dispatcher:** Remove deleted agents from the Available Agents table
6. **Start building**

You can always re-add agents and flesh out conventions as the project matures from PoC to MVP to production.
