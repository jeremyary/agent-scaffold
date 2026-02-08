# Agent Scaffold

A **Template repository** providing Claude Code agent scaffolding for full software development lifecycle — from proof-of-concept to production-ready.

> **New here?** See **[START_HERE.md](START_HERE.md)** for the complete setup guide, or run `/setup` in Claude Code for an interactive walkthrough.

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Agents** | 14 | Dispatcher, Architect, Backend/Frontend Developer, Database Engineer, API Designer, Code Reviewer, Test Engineer, Security Engineer, Performance Engineer, DevOps Engineer, Debug Specialist, Technical Writer, Requirements Analyst |
| **Convention Rules** | 8 | Code style (JS/TS + Python), git workflow, testing, security, error handling, observability, API conventions |
| **Slash Commands** | 4 | `/setup` (wizard), `/review` (code + security), `/status` (health dashboard), `/adr` (architecture decisions) |
| **Permissions** | Pre-configured | Safe Bash commands pre-approved, dangerous operations blocked, secrets protected |

## Quick Start

**From GitHub:**
1. Click **"Use this template"** → **"Create a new repository"**
2. Clone your new repo and open it in Claude Code
3. Run `/setup` — the interactive wizard walks you through customization

**From a local copy:**
```bash
cp -r agent-scaffold/ my-new-project/
cd my-new-project/
claude
/setup
```

## Documentation

| Document | Purpose |
|----------|---------|
| **[START_HERE.md](START_HERE.md)** | Complete setup guide — 9 steps to customize the scaffold for your project |
| **[CLAUDE.md](CLAUDE.md)** | Project configuration file read by all agents — customize this first |

## Project Structure

```
.claude/
├── agents/          # 14 agent definitions (1 orchestrator + 13 specialists)
├── rules/           # 8 convention rules (code style, testing, security, etc.)
├── skills/          # 6 skills (setup wizard, review, status, ADR, workflows, conventions)
├── settings.json    # Shared tool permissions (committed to git)
└── CLAUDE.md        # Routing rules and orchestration patterns
```

## After Setup

Once you've run `/setup` or followed [START_HERE.md](START_HERE.md), replace this README with your project's own documentation. The scaffold's reference material lives in START_HERE.md if you need it later.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
