---
description: Customizable project conventions template. Adapt these settings to match your specific project's technology stack, structure, and standards.
user_invocable: false
---

# Project Conventions

Customize the sections below to match your project. All agents reference these conventions when making implementation decisions.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Python | 3.11+ |
| AI/Agent Framework | LangGraph | — |
| Observability | LangFuse | — |
| LLM Stack | LlamaStack | — |
| Model Hosting (prod) | OpenShift AI | — |
| Model Hosting (dev) | Local / OpenAI API-compatible endpoints | — |
| Web Framework | FastAPI | — |
| Data Validation | Pydantic | 2.x |
| Testing | pytest | — |
| Linting / Formatting | Ruff | — |
| Package Manager | uv | — |
| Container | Podman / Docker | — |
| Platform | OpenShift / Kubernetes | — |

## Project Structure

<!-- This is a starting-point layout. Refine during architecture phase. -->

```
ai-banking-quickstart/
├── src/
│   ├── agents/              # LangGraph agent definitions and graphs
│   ├── api/                 # FastAPI backend
│   ├── models/              # Pydantic data models
│   ├── tools/               # Agent tools (calculators, data lookups, etc.)
│   ├── guardrails/          # Input/output guardrails and RBAC logic
│   └── config/              # Configuration and endpoint settings
├── data/
│   └── seed/                # Pre-seeded demo data (simulates established activity)
├── tests/                   # Test suite
├── deploy/
│   └── openshift/           # OpenShift deployment manifests
├── plans/                   # SDD planning artifacts
│   └── reviews/             # Agent review documents
├── docs/                    # Documentation
├── pyproject.toml           # Python project config (uv)
├── compose.yml              # Local development
└── Makefile                 # Common development commands
```

## Planning Artifacts (SDD Workflow)

When following the Spec-Driven Development workflow (see `workflow-patterns/SKILL.md`), planning artifacts live in `plans/` with agent reviews in `plans/reviews/`.

| Artifact | Path | Produced By |
|----------|------|-------------|
| Product plan | `plans/product-plan.md` | @product-manager |
| Architecture design | `plans/architecture.md` | @architect |
| Requirements document | `plans/requirements.md` | @requirements-analyst |
| Technical design (per phase) | `plans/technical-design-phase-N.md` | @tech-lead |
| Agent review | `plans/reviews/<artifact>-review-<agent-name>.md` | Reviewing agent |
| Orchestrator review | `plans/reviews/<artifact>-review-orchestrator.md` | Main session (orchestrator) |
| Work breakdown (per phase) | `plans/work-breakdown-phase-N.md` | @project-manager |

### Review File Naming Convention

```
plans/reviews/product-plan-review-architect.md
plans/reviews/product-plan-review-security-engineer.md
plans/reviews/product-plan-review-orchestrator.md
plans/reviews/architecture-review-security-engineer.md
plans/reviews/architecture-review-orchestrator.md
plans/reviews/requirements-review-orchestrator.md
plans/reviews/technical-design-phase-1-review-code-reviewer.md
plans/reviews/technical-design-phase-1-review-orchestrator.md
```

## Environment Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENV` | Yes | `development`, `staging`, `production` |
| `MODEL_ENDPOINT` | Yes | OpenShift AI or OpenAI API-compatible endpoint URL |
| `MODEL_NAME` | No | Model name for inference (default varies by environment) |
| `LANGFUSE_HOST` | No | LangFuse server URL (default: local) |
| `LANGFUSE_PUBLIC_KEY` | No | LangFuse public key |
| `LANGFUSE_SECRET_KEY` | Yes | LangFuse secret key |
| `LOG_LEVEL` | No | Logging level (default: `info`) |
| `PORT` | No | Server port (default: 8000) |

## Cross-References

Detailed conventions are defined in the rules files — do not duplicate here:

- **Naming & style:** `python-style.md`
- **Git workflow:** `git-workflow.md`
- **Security baseline:** `security.md`
- **Testing standards:** `testing.md`
