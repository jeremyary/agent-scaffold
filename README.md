# Agent Scaffold

A **Template repository** providing Claude Code agent scaffolding for full software development lifecycle — from proof-of-concept to production-ready.

> **New here?** See **[START_HERE.md](START_HERE.md)** for the complete setup guide, or run `/setup` in Claude Code for an interactive walkthrough.

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Agents** | 17 | Product Manager, Architect, Tech Lead, Backend/Frontend Developer, Database Engineer, API Designer, Code Reviewer, Test Engineer, Security Engineer, Performance Engineer, DevOps Engineer, Project Manager, SRE Engineer, Debug Specialist, Technical Writer, Requirements Analyst |
| **Convention Rules** | 15 | Code style (TS + Python), git workflow, testing, security, error handling, observability, API conventions, AI compliance, agent workflow, review governance, architecture, API development, UI development, database development |
| **Hooks** | 2 | `prepare-commit-msg` (AI assistance trailers), `sensitive-data-check.sh` (credential/PII scanner) |
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
| **[START_HERE.md](START_HERE.md)** | Complete setup guide — 11 steps to customize the scaffold for your project |
| **[CLAUDE.md](CLAUDE.md)** | Project configuration file read by all agents — customize this first |
| **[docs/ai-native-team-playbook.md](docs/ai-native-team-playbook.md)** | Team process reference — bolt methodology, metrics, role evolution, anti-patterns |

## Project Structure

```
.claude/
├── agents/          # 17 specialist agent definitions
├── hooks/           # 2 hooks (AI commit trailers, sensitive data scanner)
├── rules/           # 15 convention rules (code style, testing, security, AI compliance, agent workflow, review governance, architecture, API/UI/DB development, etc.)
├── skills/          # 6 skills (setup wizard, review, status, ADR, workflows, conventions)
├── settings.json    # Shared tool permissions (committed to git)
└── CLAUDE.md        # Routing rules and orchestration patterns
```

## After Setup

Once you've run `/setup` or followed [START_HERE.md](START_HERE.md), replace this README with your project's own documentation. The scaffold's reference material lives in START_HERE.md if you need it later.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
