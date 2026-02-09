# AI-Native Team Playbook

A practical reference for engineering teams adopting AI-assisted development workflows. This document covers how traditional Agile practices need adaptation, new team rituals, metrics, role evolution, and common anti-patterns.

> **Audience:** Engineering managers, tech leads, and developers working with AI code assistants.
> **Scope:** Team process and human practices. For agent-level operational rules, see `.claude/rules/agent-workflow.md` and `.claude/rules/review-governance.md`.

---

## 1. Why Traditional Agile Needs Adaptation

The fundamental bottleneck in software development has shifted. When AI agents can generate code faster than humans can review it, the constraint moves from **writing** to **specifying and verifying**.

| Traditional Assumption | AI-Native Reality |
|------------------------|-------------------|
| Writing code is the bottleneck | Specifying *what to write* and verifying *what was written* are the bottlenecks |
| Developers spend most time coding | Developers spend most time reviewing, testing, and specifying |
| Story points estimate coding effort | Story points underweight review effort — the hard part is now verification |
| Sprint velocity measures team productivity | Velocity measures generation speed, not delivery quality |
| Code review is a lightweight gate | Code review is the primary quality assurance activity |

This shift doesn't mean Agile is wrong — it means the time allocation within Agile ceremonies needs to change. Less time estimating coding effort, more time refining specifications and reviewing output.

---

## 2. Bolt Methodology

**Bolt** is a scope-boxed iteration model that replaces fixed-duration sprints with completion-driven cycles. Each bolt has a defined scope (a feature, a fix, a refactor) and progresses through three phases.

### Bolt Lifecycle

```
┌─────────────────────────────────────────────────┐
│                   One Bolt                       │
├──────────┬──────────────────┬───────────────────┤
│  Spec    │      Build       │      Verify       │
│  ~20%    │      ~50%        │      ~30%         │
└──────────┴──────────────────┴───────────────────┘
```

| Phase | Time Share | Activities | Who |
|-------|-----------|------------|-----|
| **Spec** | ~20% | Requirements refinement, acceptance criteria, technical design, interface contracts, exit conditions | PM, Tech Lead, developers |
| **Build** | ~50% | AI-assisted implementation, iterative development, unit testing | AI agents + developers |
| **Verify** | ~30% | Code review, security review, integration testing, manual verification, documentation | Developers, reviewers |

### Key Differences from Sprints

- **No fixed duration** — a bolt ends when the scope is verified, not when a timebox expires
- **Scope is locked** — unlike sprints where scope can flex, a bolt's scope is defined in the Spec phase and doesn't change. If scope needs to change, start a new bolt.
- **Verify is first-class** — verification gets dedicated time, not "whatever's left before the sprint ends"
- **Smaller scope** — a bolt should be completable in 1–3 days, not 2 weeks

---

## 3. Mob Rituals

### Spec Elaboration (Synchronous, 30–60 min)

**When:** Start of each bolt
**Who:** PM, Tech Lead, assigned developer(s)
**Purpose:** Turn a feature request into a precise specification with machine-verifiable exit conditions

**Agenda:**
1. PM presents the user problem and acceptance criteria (10 min)
2. Tech Lead proposes the technical approach and interface contracts (10 min)
3. Group refines exit conditions — every acceptance criterion gets a verification command (15 min)
4. Identify risks and unknowns (5 min)
5. Decision: proceed with bolt or split into smaller bolts (5 min)

**Output:** A spec document with concrete acceptance criteria, interface contracts, and machine-verifiable exit conditions ready for agent consumption.

### Synchronous Debugging (Ad-hoc, timeboxed to 30 min)

**When:** An agent or developer is stuck for more than 15 minutes
**Who:** The stuck person + one other developer (or Tech Lead)
**Purpose:** Break through blockers with a second set of eyes

**Rules:**
- Timebox to 30 minutes — if not resolved, escalate or re-scope
- The stuck person explains the problem; the helper asks questions (not the reverse)
- If the root cause is a spec problem, stop and revise the spec (don't work around it)

### Review Roundtable (Async-first, sync fallback)

**When:** End of each bolt's Build phase, before Verify begins
**Who:** Code reviewer, security reviewer (if applicable), implementing developer
**Purpose:** Review the AI-generated code as a cohesive unit, not as isolated diffs

**Process:**
1. Implementing developer posts a summary of what was built and why (async)
2. Reviewers read the code and post findings (async, within 4 hours)
3. If findings are purely mechanical (naming, style, minor improvements), resolve async
4. If findings are architectural or design-level, schedule a 15-min sync to align

---

## 4. New Metrics

### Metrics to Track

| Metric | Definition | Target | Why It Matters |
|--------|-----------|--------|----------------|
| **Code survival rate** | % of AI-generated lines unchanged after 30 days | > 70% | Low survival means AI output is being rewritten — specs were imprecise or review was insufficient |
| **Review-to-coding ratio** | Hours spent reviewing / hours spent coding | ≥ 1:1 for production | If review time is much less than coding time, reviews are being skimmed |
| **Time to first green build** | Time from bolt start to first passing CI | Trending down | Measures spec quality — precise specs produce code that passes on first try |
| **Spec revision rate** | % of bolts that required spec revision during Build | < 20% | High revision rate means Spec phase is too rushed |
| **Review findings per PR** | Average findings per code review | ≥ 1 | Zero-finding reviews suggest rubber-stamping (see review-governance.md) |

### Metrics to Stop Tracking

| Metric | Why It's Misleading |
|--------|-------------------|
| **Lines of code per developer** | AI inflates this metric to meaninglessness — a developer using AI can produce 10x LoC with the same or lower quality |
| **Velocity in story points** | Story points estimated coding effort; with AI, coding is cheap — the constraint is review and verification |
| **Individual commit counts** | Commit frequency measures activity, not value — one well-reviewed commit is worth more than ten unreviewed ones |
| **Time to first PR** | Speed of generation isn't the bottleneck — speed of verified, reviewed delivery is |

---

## 5. Role Evolution

### Junior Developer → AI Supervisor

The junior developer's primary job shifts from writing code to **reviewing and testing AI-generated code**. This is harder than it sounds — it requires reading code critically, understanding edge cases, and catching subtle bugs.

**Key activities:**
- Review AI-generated code for correctness and edge cases
- Write tests that exercise the boundaries AI tends to miss
- Flag code that "looks right but feels wrong" — AI often produces plausible but subtly incorrect implementations
- Learn codebase patterns by reviewing how AI applies them (and where it gets them wrong)

### Tech Lead → Orchestrator

The Tech Lead's primary job shifts from writing code to **writing specifications and reviewing plans**. Code review remains important, but plan review is now higher leverage.

**Key activities:**
- Write Technical Design Documents with concrete interface contracts
- Review plans before implementation begins — this is the highest-leverage review
- Define machine-verifiable exit conditions for every task
- Resolve spec conflicts when implementation discovers problems
- Coach juniors on how to review AI output effectively

### Product Manager → Context Engineer

The PM's primary job shifts from managing backlogs to **engineering precise context** for AI consumption. Vague requirements produce vague code.

**Key activities:**
- Write acceptance criteria that are specific enough to generate machine-verifiable exit conditions
- Define scope boundaries explicitly — what's IN and what's OUT
- Provide concrete examples (sample data, expected behavior) rather than abstract descriptions
- Prioritize ruthlessly — AI makes it easy to build everything, but review capacity is limited

### Code Reviewer → Last Line of Defense

Code review becomes the **primary quality gate** rather than a formality. The reviewer is now the last human who reads the code before it ships.

**Key activities:**
- Read every line, not just the diff summary — AI-generated code often has subtle issues that aren't visible in a quick skim
- Verify tests actually test the behavior, not just the implementation
- Check that the code matches the spec, not just that it compiles
- Flag patterns for promotion to project rules when they recur

---

## 6. The Broken Rung Problem

AI-assisted development creates a risk for junior developers: if they spend all their time reviewing AI output, they may never develop the deep skills that come from writing code from scratch — debugging production issues, designing systems, making architectural trade-offs.

This is the "broken rung" — juniors who can supervise AI but can't function without it.

### Mitigations

| Practice | How It Helps |
|----------|-------------|
| **Rotation** | Alternate between AI-supervised work and manual implementation — e.g., 3 weeks with AI, 1 week without |
| **Pair programming** | Pair a junior with a senior on tasks where the junior writes code and the senior reviews — not the reverse |
| **Learning sprints** | Dedicate occasional bolts where AI assistance is limited or prohibited — focus on skill-building |
| **Focus on AI-weak areas** | Assign juniors to areas where AI is weakest: system design, production debugging, business context interpretation, cross-system integration |
| **Code review mentorship** | Seniors review the junior's reviews — teach them what to look for and how to evaluate AI output critically |

---

## 7. Anti-Patterns

### Vibe Coding

**Symptom:** Code is generated directly from conversational prompts with no persistent specification. No written acceptance criteria, no interface contracts, no exit conditions.

**Why it's harmful:** Without a spec, there's no way to verify correctness. "Does it look right?" is not verification. When the code needs to change, there's nothing to change it *against* — every modification is a fresh conversation.

**Fix:** Adopt Spec-Driven Development — even a brief spec with acceptance criteria and exit conditions prevents vibe coding.

### Rubber-Stamping

**Symptom:** Code reviews consistently produce zero findings. Review time is a fraction of coding time. PRs are approved within minutes of submission.

**Why it's harmful:** AI-generated code is plausible but not necessarily correct. Rubber-stamping lets subtle bugs, security issues, and spec deviations through to production.

**Fix:** Enforce the mandatory findings rule (see `review-governance.md`). Track review-to-coding ratio. Make review quality a team metric, not just review speed.

### Context Drift

**Symptom:** The codebase diverges from the architectural vision over time. Each bolt's code is internally consistent but inconsistent with prior bolts. Technical debt accumulates as a series of "good enough" deviations.

**Why it's harmful:** AI agents don't have persistent memory of architectural intent (unless explicitly loaded). Each new task is an opportunity for drift. Small deviations compound into incoherent architecture.

**Fix:** Regular architecture reviews (monthly). Maintain ADRs as living documents. The Tech Lead should periodically audit recent code against architectural decisions and flag drift before it compounds.

### Over-Delegation

**Symptom:** Developers delegate tasks to AI and move on without reading the output. "The AI wrote it and the tests pass" becomes the definition of done.

**Why it's harmful:** Tests written by the same AI that wrote the code tend to test the implementation, not the behavior. Both the code and the tests can be wrong in the same way.

**Fix:** Require human-written or human-reviewed tests for critical paths. The developer who delegates must read the output — delegation without review is abdication.

---

## Further Reading

- `.claude/rules/agent-workflow.md` — Machine-enforced chunking and context engineering rules for agents
- `.claude/rules/review-governance.md` — Machine-enforced review governance rules
- `docs/ai-compliance-checklist.md` — Developer quick-reference for AI compliance obligations
