# Review Governance

This rule establishes review discipline for AI-native development. It prevents rubber-stamping, enforces plan-review-first for non-trivial work, and limits PR size to what humans can meaningfully review.

## Plan Review First

> Correcting a plan takes minutes; refactoring bad code takes days.

For features with **3+ implementation tasks**, both the Product Manager's product plan and the Tech Lead's Technical Design Document must be reviewed before downstream work begins. Use the Product Plan Review Checklist for product plans and the Technical Design Review Checklist for TDs. These are the highest-leverage reviews in the entire workflow.

### Product Plan Review Checklist

| Check | What to Look For |
|-------|-----------------|
| **No technology names in feature descriptions** | Features describe capabilities ("document storage", "real-time chat"), not solutions ("MinIO", "WebSockets", "LangGraph"). Technology mandates from stakeholders should be in a Constraints section, not woven into features. |
| **MoSCoW prioritization used** | Features classified as Must/Should/Could/Won't — not organized as numbered epics with dependency maps |
| **No epic or story breakout** | Features are described and prioritized, not decomposed into implementation work items. No dependency graphs, entry/exit criteria, or agent assignments. |
| **NFRs are user-facing** | Quality expectations framed as user outcomes ("feels responsive"), not implementation targets ("< 200ms Redis cache hit") |
| **User flows present** | Key persona journeys through the system are documented — not just feature lists |
| **Phasing describes capability milestones** | Each phase describes what the system can do, not which epics/stories are included |

### Technical Design Review Checklist

| Check | What to Look For |
|-------|-----------------|
| **Contracts are concrete** | Actual JSON shapes, actual type definitions, actual file paths — not "use a clean pattern" |
| **Data flow covers error paths** | Happy path AND what happens when things fail at each boundary |
| **Exit conditions are machine-verifiable** | Every task has a command that returns pass/fail (see `agent-workflow.md`) |
| **File structure maps to actual codebase** | Proposed paths match existing project layout — not an idealized structure |
| **No TBDs in binding contracts** | If something is undefined, it must be flagged as an open question, not left as "TBD" |

### When to Skip Plan Review

Plan review can be skipped when:
- The feature has 1–2 implementation tasks (single-concern, single-implementer)
- The work is a bug fix with a clear root cause
- The change is purely additive (new test, new documentation) with no interface changes

## Orchestrator Review

At each SDD plan review gate (Phases 2, 5, 8, 10), the main session performs its own review as part of the **agent team** with the specialist reviewers. The orchestrator acts as a safety net for cross-cutting issues that fall between specialist scopes. Running within the team allows the orchestrator to cross-reference specialist findings in real time.

### Focus Areas

| Area | What to Look For |
|------|-----------------|
| **Cross-cutting coherence** | Do the parts of this artifact tell a consistent story, or do sections contradict each other? |
| **Scope discipline** | Does the artifact stay within its phase's scope boundaries (see `workflow-patterns` SDD Scope Discipline table), or does it make decisions that belong to a downstream phase? |
| **Assumption gaps** | Are there unstated assumptions that two specialists might interpret differently? |
| **Compounding scope creep** | Has the cumulative scope grown beyond what the product plan authorized? Compare the artifact against the original feature set. |
| **Downstream feasibility** | Will downstream agents (implementers, testers, project manager) be able to act on this artifact without ambiguity? |
| **Review coverage gaps** | Is there a concern that no specialist reviewer is scoped to catch? Flag it explicitly. |

### How It Differs from Specialist Reviews

The orchestrator does **not** duplicate specialist work. It reads with the question: *"What would I miss if I only read the specialist reviews?"* Specialists evaluate depth within their domain; the orchestrator evaluates breadth across domains.

### Output Format

- Same severity levels as specialist reviews: **Critical**, **Warning**, **Suggestion**, **Positive**
- Same verdict options: APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION
- The **Mandatory Findings Rule** applies — at least one Suggestion or Positive finding per review
- Output path: `plans/reviews/<artifact>-review-orchestrator.md`

## Code Review Anti-Rubber-Stamping

### PR Size Guidance

AI-generated PRs should target **~400 lines of changed code** (excluding tests and generated files). Beyond this threshold, meaningful human review is impractical — reviewers begin skimming rather than reading.

| PR Size (changed lines) | Review Quality |
|--------------------------|---------------|
| < 200 | Thorough review feasible |
| 200–400 | Careful review feasible with focused attention |
| 400–800 | Reviewer fatigue sets in; split if possible |
| > 800 | Meaningful review is impractical — must split |

If a task produces more than 400 lines of changes, the task was likely over-scoped. Split it for the next iteration.

### Mandatory Findings Rule

A review that produces zero findings and an APPROVE is suspicious. There is always at least one improvement — a clearer name, a missing edge case, a test that could be stronger, a comment that would help the next reader. Zero findings suggests the review was skimmed, not read.

Acceptable minimum: at least one **Suggestion** or **Positive** finding per review, even if the overall verdict is APPROVE.

### Two-Agent Review

The following code categories require review by **both** `@code-reviewer` and `@security-engineer`:

- Authentication and authorization logic
- Cryptographic operations and secrets handling
- Data deletion or hard-delete operations
- Input validation at system boundaries (user input, external API responses)
- Database migration with data transformation

For all other code, `@code-reviewer` alone is sufficient. Add `@security-engineer` whenever you're unsure.

### Team-Based Review

**Default for Two-Agent Review:** When both `@code-reviewer` and `@security-engineer` are required (see Two-Agent Review categories above), they run as an **agent team** rather than independent parallel reviewers. This is the default, not an option. For code that only requires `@code-reviewer` (not in the Two-Agent Review categories), no team is needed — single-agent review suffices.

**Cross-Pollination:** Each reviewer reads the other's findings before finalizing their own assessment. Security findings may reveal patterns the code reviewer should check more broadly; code quality findings may expose areas where security assumptions are fragile.

**Disagreement Protocol:** When reviewers disagree on severity or approach:
- The **higher severity** stands — if one reviewer flags Critical and the other flags Warning for the same issue, it's treated as Critical
- Both perspectives are documented in the review output
- The implementing agent addresses the higher-severity assessment

**Single Consolidated Output:** Team review produces a single consolidated review document rather than separate per-agent files. Findings are attributed `[code-reviewer]` or `[security-engineer]` so the implementing agent knows which domain the feedback comes from. Output path follows the standard review naming convention.

**SDD Plan Review Gates:** At each SDD plan review gate (Phases 2, 5, 8, 10), reviewers run as an agent team by default, enabling them to challenge each other's findings rather than reporting independently. The orchestrator participates as a parallel reviewer within the same team. This replaces the implicit fan-out assumption in earlier versions of the workflow.

### "Explain It to Me" Protocol

When a reviewer flags a finding, the implementing agent must:

1. **Summarize the finding in its own words** — not quote the reviewer's text
2. **Explain what it will change and why** — demonstrate understanding, not just compliance
3. **Make the fix**

This prevents pattern-matching fixes where the agent changes code to look different without understanding the underlying issue.

## Review Scope Rules

### Scope Matching

Review must match task scope. If a PR contains changes to files that weren't in the original task description:

- Those out-of-scope changes are **themselves a finding** (Warning severity)
- The reviewer should flag them and ask for justification
- Unjustified out-of-scope changes should be reverted and handled in a separate task

### Test Review

Test review is **not optional**. Reviewers must verify:

- Tests cover the behavior described in the task's exit conditions
- Tests include at least one error/edge case — happy-path-only tests are a **Warning** finding
- Test names describe the behavior being verified (see `testing.md` naming convention)
- Tests are deterministic — no timing dependencies, no order dependencies, no shared mutable state

### Repeat Pattern Detection

If `@code-reviewer` flags the **same pattern** 3+ times across different reviews in the same project, that pattern should be promoted to a project rule:

1. Document the pattern in the relevant rule file (e.g., `code-style.md`, `security.md`)
2. Add a brief rationale for why it matters
3. Future reviews can reference the rule instead of re-explaining

This prevents review fatigue from repeatedly flagging the same issue and ensures institutional knowledge is captured.
