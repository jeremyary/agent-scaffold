# Agent Workflow Discipline

This rule applies to all agents. It operationalizes two practices that prevent AI-generated code from becoming unreviewed tech debt: **task chunking** (keeping autonomous work small enough to succeed) and **context engineering** (loading only what's relevant).

## Task Chunking Heuristics

### Why Chunking Matters

At 95% per-step reliability, a 20-step autonomous chain succeeds only ~36% of the time (0.95^20). Errors compound — each step that builds on a flawed prior step makes recovery harder. Small, verifiable chunks reset the error chain.

### Constraints

| Dimension | Limit | Rationale |
|-----------|-------|-----------|
| **Files touched** | 3–5 per task | More than 5 files signals over-scoping or a cross-cutting concern that needs a design phase first |
| **Autonomous steps** | 5–7 per chain | Keeps compound error probability above 70% (0.95^7 ≈ 0.70) |
| **Autonomy duration** | ~1 hour | If an agent can't complete in roughly 1 hour, the task needs splitting |
| **Scope** | Single concern | One endpoint, one migration, one component, one module — not a feature |

### Exit Conditions

Every task must have a **machine-verifiable** exit condition — a command that returns pass/fail:

| Acceptable | Not Acceptable |
|------------|----------------|
| `pytest tests/unit/test_foo.py` | "Implementation is complete" |
| `npx tsc --noEmit` | "Code follows conventions" |
| `curl -s localhost:3000/health \| jq .status` | "Endpoint works correctly" |
| `ruff check src/` | "Code is clean" |

If a task description doesn't include a verification command, add one before starting work. If you can't define one, the task is underspecified — report it rather than guessing.

### When to Split

Split a task if **any** of these apply:

- It touches more than 5 files
- It requires more than 7 sequential steps to complete
- It addresses more than one concern (e.g., "add endpoint AND update schema AND write tests")
- The exit condition requires manual verification (visual inspection, subjective judgment)
- You can't summarize what "done" looks like in one sentence

## Context Engineering

### Context Anchoring

Load only what the task requires:

1. **Task description** — the primary input
2. **Relevant rules** — project conventions that apply to the files being modified
3. **Specific files being modified** — read them before editing
4. **Interface contracts** — if the task references a Technical Design Document, load the relevant contracts

That's it. Don't speculatively load files that "might be related."

### Context Pruning

Before reading a file, articulate why it's relevant to the current task:

| Valid Reason | Invalid Reason |
|-------------|----------------|
| "I need to match the existing pattern in user.service.ts" | "It might have something useful" |
| "The API contract references this type definition" | "I should understand the whole module" |
| "The test imports this fixture" | "Let me read around to get more context" |

### Context Budget

Budget approximately **5 source files** per task. This is a soft limit — occasionally you'll need 6 or 7, but if you're regularly exceeding it, the tasks are too large.

When working within a **Work Unit**, shared context files (loaded for the first task) remain in context for subsequent tasks. Only count task-specific files against the budget for the second task onward — the WU shared context is already loaded.

Context budget does NOT include:
- Rule files (these are short and always relevant)
- The task description itself
- Generated files you're reading for reference (e.g., OpenAPI specs, migration files)

### Context Poisoning Awareness

More context does NOT mean better results. Loading irrelevant files:
- Dilutes attention on the files that matter
- Introduces patterns from unrelated parts of the codebase that may conflict
- Increases the chance of hallucinating connections between unrelated code

### Stale Context Detection

If you discover that the codebase has diverged from what the task description assumed (e.g., a file the task references doesn't exist, an interface has changed, a module has been restructured):

1. **Stop** — don't attempt to reconcile the discrepancy yourself
2. **Report** — describe what the task assumed vs. what you found
3. **Wait** — let the task be revised before proceeding

Working around a stale spec creates code that matches neither the spec nor the codebase. It's always cheaper to update the spec first.

## Agent Team Coordination (Experimental)

When running as part of an agent team (see `.claude/CLAUDE.md` § Agent Team), these additional disciplines apply on top of the standard task chunking and context engineering rules.

### File Ownership

Each teammate owns distinct files, defined in the task description before the team is spawned. Ownership is exclusive — only the owning teammate edits a file.

If you need a change in another teammate's file:
1. **Do not edit it** — send a mailbox message describing the change you need
2. **Include specifics** — file path, what to change, and why
3. **Wait for acknowledgment** — the owning teammate confirms or proposes an alternative
4. **Continue with other work** while waiting — do not block on the response

### Communication Discipline

Use the shared mailbox for:
- Findings that affect another teammate's work (e.g., "the schema I'm seeing doesn't match the contract you're implementing against")
- Contract clarifications (e.g., "should this field be nullable?")
- Blocking dependencies (e.g., "I need the type definition you're creating before I can proceed")

Do NOT use the mailbox for:
- Progress updates ("I'm 50% done") — the task list already tracks this
- Questions the task description already answers — re-read the task first
- Out-of-scope requests — if the work wasn't in the task description, it doesn't belong in this session

### Exit Coordination

When your task's exit condition passes:
1. **Send a completion message** to the mailbox — include what you produced, what verification command you ran, and any deviations from the task description
2. **Wait for all teammates** to signal completion before the team session ends
3. **Flag unresolved issues** — if you discovered something that affects a teammate's work but couldn't resolve it through the mailbox, call it out explicitly in your completion message
