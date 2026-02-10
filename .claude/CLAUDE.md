# Agent System — Routing & Orchestration

## Routing Decision Matrix

When the user's request matches keywords below, route to the corresponding agent:

| Keywords / Signals | Primary Agent | Secondary |
|---|---|---|
| "product", "PRD", "vision", "roadmap", "feature priority", "discovery", "persona" | Product Manager | Requirements Analyst |
| "design", "architecture", "ADR", "trade-off", "tech stack" | Architect | Tech Lead |
| "technical design", "interface contract", "implementation approach", "how should we build" | Tech Lead | Architect |
| "API", "endpoint", "handler", "middleware", "server" | Backend Developer | API Designer |
| "component", "UI", "CSS", "accessibility", "responsive" | Frontend Developer | — |
| "schema", "migration", "query", "index", "database" | Database Engineer | — |
| "OpenAPI", "contract", "REST", "GraphQL", "versioning" | API Designer | Backend Developer |
| "review", "code quality", "standards", "best practices" | Code Reviewer | — |
| "test", "coverage", "fixture", "mock", "assertion" | Test Engineer | — |
| "security", "vulnerability", "OWASP", "CVE", "auth" | Security Engineer | — |
| "performance", "slow", "profiling", "optimize", "latency" | Performance Engineer | — |
| "deploy", "CI/CD", "Docker", "Kubernetes", "Terraform" | DevOps Engineer | — |
| "epic", "story", "sprint", "Jira", "backlog", "work breakdown", "estimate" | Project Manager | — |
| "SLO", "SLI", "runbook", "incident", "on-call", "error budget", "capacity" | SRE Engineer | DevOps Engineer |
| "bug", "error", "crash", "debug", "broken", "not working" | Debug Specialist | — |
| "docs", "README", "changelog", "documentation" | Technical Writer | — |
| "requirements", "user story", "acceptance criteria" | Requirements Analyst | Product Manager |
| Multi-step, cross-cutting, or ambiguous | **Main session** | Use workflow-patterns skill |

## Agent Capabilities Matrix

Mode is determined by the agent's tool set: agents without Write/Edit tools are effectively **read-only** (plan mode); agents with Write/Edit operate in **acceptEdits** mode where file changes are auto-accepted but Bash still requires approval.

| Agent | Model | Mode | Tools | Memory |
|---|---|---|---|---|
| Product Manager | opus | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, AskUserQuestion | project |
| Architect | opus | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch | project |
| Backend Developer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Frontend Developer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Database Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| API Designer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch | — |
| Tech Lead | opus | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | project |
| Code Reviewer | opus | plan | Read, Glob, Grep, Bash | project |
| Test Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Security Engineer | sonnet | plan | Read, Glob, Grep, Bash, WebSearch | project |
| Performance Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| DevOps Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | — |
| Project Manager | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash, WebSearch | project |
| SRE Engineer | sonnet | acceptEdits | Read, Write, Edit, Glob, Grep, Bash | project |
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

## Planning Principles

When orchestrating multi-agent work, apply these principles:

- **When in doubt, include a review gate.** Code-reviewer and security-engineer are read-only and cheap.
- **Prefer parallel execution** when tasks are independent — don't create unnecessary sequential chains.
- **Right-size the plan** — a single file change doesn't need 7 agents. Match plan complexity to request complexity.
- **Include context propagation** — each task description should include what prior steps will have produced.
- **Apply chunking heuristics** — each task should touch 3-5 files max, have a machine-verifiable exit condition, and be completable in ~1 hour. Split tasks that violate these limits.
- **Every task needs a verifiable exit condition** in its description (test command, type-check, endpoint assertion). "Implementation complete" is not verifiable.
- **Prefer spec-first** for work involving new data shapes, APIs, or integration points — the cost of specifying before building is always less than the cost of reworking after.

## Cost Tiers

| Tier | Model | Agents | Use When |
|---|---|---|---|
| **High** | opus | Product Manager, Architect, Tech Lead, Code Reviewer | Product strategy, architecture, technical design, code review — errors in planning and review cascade through everything |
| **Standard** | sonnet | All others | Implementation, analysis, project management, documentation — quality sufficient for the task |

Opus is reserved for decisions and reviews with high blast radius: product direction, architecture, technical design (plan quality), and code review (review rigor). All implementation, analysis, and project management work uses sonnet to optimize cost.

## Agent Memory (`memory: project`)

Nine agents have `memory: project` enabled: Product Manager, Architect, Tech Lead, Code Reviewer, Security Engineer, Project Manager, SRE Engineer, Technical Writer, and Requirements Analyst. This means they retain context across sessions for the current project.

**What agents should remember:**

*Agent-specific knowledge:*
- Product vision, personas, success metrics, and feature priorities (Product Manager)
- Architectural decisions and their rationale (Architect)
- Feature-level technical patterns, interface conventions, and implementation approaches that worked well (Tech Lead)
- Recurring code quality patterns — both positive and negative (Code Reviewer)
- Known vulnerabilities, accepted risks, and security exceptions (Security Engineer)
- Estimation accuracy, velocity patterns, and dependency structures (Project Manager)
- SLO targets, incident history, capacity baselines, and operational patterns (SRE Engineer)
- Project terminology, documentation structure, and style preferences (Technical Writer)
- Stakeholder preferences, domain rules, and requirements history (Requirements Analyst)

*Cross-cutting — all memory-enabled agents should track:*
- **Stakeholder preferences** — Decision patterns, risk tolerance, scope tendencies, communication style, technology biases. When you observe a consistent preference across interactions (e.g., "stakeholder always defers nice-to-haves to Phase 2", "prefers conservative technology choices"), record it. Over time, this lets agents anticipate preferences rather than re-asking. The canonical record lives in the root `CLAUDE.md` Stakeholder Preferences table — update it when a pattern is clear.

**What agents should NOT remember:**
- Transient debugging state or temporary workarounds
- Content of secret/credential values encountered during sessions
- Personal preferences of individual developers (use `settings.local.json` for those)

Memory builds up naturally over sessions. Agents with memory become more effective as the project matures because they can reference prior decisions and patterns without re-reading every file.
