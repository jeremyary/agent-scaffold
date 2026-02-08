# Agent System — Routing & Orchestration

## Routing Decision Matrix

When the user's request matches keywords below, route to the corresponding agent:

| Keywords / Signals | Primary Agent | Secondary |
|---|---|---|
| "design", "architecture", "ADR", "trade-off", "tech stack" | Architect | — |
| "API", "endpoint", "handler", "middleware", "server" | Backend Developer | API Designer |
| "component", "UI", "CSS", "accessibility", "responsive" | Frontend Developer | — |
| "schema", "migration", "query", "index", "database" | Database Engineer | — |
| "OpenAPI", "contract", "REST", "GraphQL", "versioning" | API Designer | Backend Developer |
| "review", "code quality", "standards", "best practices" | Code Reviewer | — |
| "test", "coverage", "fixture", "mock", "assertion" | Test Engineer | — |
| "security", "vulnerability", "OWASP", "CVE", "auth" | Security Engineer | — |
| "performance", "slow", "profiling", "optimize", "latency" | Performance Engineer | — |
| "deploy", "CI/CD", "Docker", "Kubernetes", "Terraform" | DevOps Engineer | — |
| "bug", "error", "crash", "debug", "broken", "not working" | Debug Specialist | — |
| "docs", "README", "changelog", "documentation" | Technical Writer | — |
| "requirements", "user story", "acceptance criteria" | Requirements Analyst | — |
| Multi-step, cross-cutting, or ambiguous | **Dispatcher** | — |

## Agent Capabilities Matrix

Mode is determined by the agent's tool set: agents without Write/Edit tools are effectively **read-only** (plan mode); agents with Write/Edit operate in **acceptEdits** mode where file changes are auto-accepted but Bash still requires approval.

| Agent | Model | Mode | Tools | Memory |
|---|---|---|---|---|
| Dispatcher | opus | plan | Read, Glob, Grep, Bash, WebSearch, WebFetch, TaskCreate, TaskUpdate, TaskList, TaskGet | project |
| Architect | opus | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch | project |
| Backend Developer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Frontend Developer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Database Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| API Designer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch | — |
| Code Reviewer | sonnet | plan | Read, Glob, Grep, Bash | project |
| Test Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Security Engineer | sonnet | plan | Read, Glob, Grep, Bash, WebSearch | project |
| Performance Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| DevOps Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Debug Specialist | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Technical Writer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch | project |
| Requirements Analyst | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch, AskUserQuestion | project |

## Orchestration Patterns

### Sequential Chain
Tasks execute in strict order. Each task's output feeds the next.
```
A → B → C → D
```
Use `blockedBy` to enforce ordering.

### Parallel Fan-Out
Independent tasks run concurrently, followed by a synchronization point.
```
A → [B, C, D] (parallel) → E
```
B, C, D each have `blockedBy: [A]`. E has `blockedBy: [B, C, D]`.

### Review Gate
Implementation followed by mandatory review before proceeding.
```
implement → [code-reviewer, security-engineer] (parallel) → proceed only if pass
```
If reviewers flag Critical issues, loop back to implementation.

### Iterative Loop
Profile → implement → verify cycle, repeated until targets are met.
```
performance-engineer (profile) → implementer (fix) → performance-engineer (verify)
```
Repeat if metrics not met.

## Cost Tiers

| Tier | Model | Agents | Use When |
|---|---|---|---|
| **High** | opus | Dispatcher, Architect | Routing decisions, architectural choices — errors here cascade |
| **Standard** | sonnet | All others | Implementation, review, analysis — quality sufficient for task |

Opus is reserved for decisions with high blast radius. All implementation and analysis work uses sonnet to optimize cost.

## Agent Memory (`memory: project`)

Six agents have `memory: project` enabled: Dispatcher, Architect, Code Reviewer, Security Engineer, Technical Writer, and Requirements Analyst. This means they retain context across sessions for the current project.

**What agents should remember:**
- Architectural decisions and their rationale (Architect)
- Recurring code quality patterns — both positive and negative (Code Reviewer)
- Known vulnerabilities, accepted risks, and security exceptions (Security Engineer)
- Project terminology, documentation structure, and style preferences (Technical Writer)
- Stakeholder preferences, domain rules, and requirements history (Requirements Analyst)
- Routing patterns that worked well and agent selection rationale (Dispatcher)

**What agents should NOT remember:**
- Transient debugging state or temporary workarounds
- Content of secret/credential values encountered during sessions
- Personal preferences of individual developers (use `settings.local.json` for those)

Memory builds up naturally over sessions. Agents with memory become more effective as the project matures because they can reference prior decisions and patterns without re-reading every file.
