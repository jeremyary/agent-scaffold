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

## 4. Am I Being Productive?

### Measurements to Self-Evaluate

| Metric | Definition | Target | Why It Matters |
|--------|-----------|--------|----------------|
| **Code survival rate** | % of AI-generated lines unchanged after 30 days | > 70% | Low survival means AI output is being rewritten — specs were imprecise or review was insufficient |
| **Review-to-coding ratio** | Hours spent reviewing / hours spent coding | ≥ 1:1 for production | If review time is much less than coding time, reviews are being skimmed |
| **Time to first green build** | Time from bolt start to first passing CI | Trending down | Measures spec quality — precise specs produce code that passes on first try |
| **Spec revision rate** | % of bolts that required spec revision during Build | < 20% | High revision rate means Spec phase is too rushed |
| **Review findings per PR** | Average findings per code review | ≥ 1 | Zero-finding reviews suggest rubber-stamping (see review-governance.md) |

### Outdated Measurements to Stop Worrying With

| Metric | Why It's Misleading |
|--------|-------------------|
| **Lines of code per developer** | AI inflates this metric to meaninglessness — a developer using AI can produce 10x LoC with the same or lower quality |
| **Velocity in story points** | Story points estimated coding effort; with AI, coding is cheap — the constraint is review and verification |
| **Individual commit counts** | Commit frequency measures activity, not value — one well-reviewed commit is worth more than ten unreviewed ones |
| **Time to first PR** | Speed of generation isn't the bottleneck — speed of verified, reviewed delivery is |

---

## 5. Role Evolution

AI-assisted development shifts the bottleneck from writing code to specifying and verifying it. This affects every role on the team — human and agent alike.

### Human vs. Agent Roles

Some roles in this scaffold exist as both a **human position** and an **AI agent**. The human and the agent are not interchangeable — they have different strengths and the human is always accountable.

| Role | Human | Agent | Relationship |
|------|-------|-------|-------------|
| **Product Manager** | Owns product vision, stakeholder relationships, business context | `@product-manager` — structures PRDs, prioritizes features | Human drives discovery and decisions; agent structures and documents |
| **Tech Lead** | Owns technical direction, mentors team, resolves ambiguity | `@tech-lead` — writes TDs, defines contracts | Human reviews and approves plans; agent produces the detailed artifacts |
| **Architect** | Owns system-level decisions, evaluates trade-offs in business context | `@architect` — documents architecture, writes ADRs | Human makes judgment calls; agent captures and structures decisions |
| **Code Reviewer** | Accountable for what ships, catches subtle issues, enforces standards | `@code-reviewer` — systematic quality analysis | Human is the final gate; agent provides thorough first-pass analysis |
| **Security Engineer** | Owns threat model, risk acceptance decisions | `@security-engineer` — scans for known vulnerability patterns | Human assesses risk in context; agent catches mechanical issues |
| **Developer** | Writes specs, reviews output, makes design judgments, debugs production | `@backend-developer`, `@frontend-developer` — generates code from specs | Human specifies and verifies; agent implements within constraints |

**The key distinction:** Agents generate artifacts. Humans make decisions, bear accountability, and verify quality. No agent output ships without human review.

### How Engineering Roles Shift

#### Early-Career Engineers

The shift: from writing code as the primary learning activity to **reviewing, testing, and debugging AI-generated code** as the primary learning activity.

**Key activities:**
- Review AI-generated code for correctness and edge cases — this builds code-reading skills faster than writing from scratch
- Write tests that exercise the boundaries AI tends to miss (error paths, concurrency, edge cases)
- Flag code that "looks right but feels wrong" — AI often produces plausible but subtly incorrect implementations
- Debug failures in AI-generated code — understanding *why* something broke builds deeper skills than writing it correctly the first time
- Pair with more experienced engineers on spec writing and plan review to build those muscles early

**Growth path:** As review skills develop, take on spec writing for small features, then plan review for features you didn't spec.

#### Mid-Level Engineers

The shift: from implementing features end-to-end to **specifying features precisely enough that agents can implement them correctly**, and reviewing the results critically.

**Key activities:**
- Write clear, scoped task descriptions with machine-verifiable exit conditions
- Review AI-generated code with domain expertise — catch business logic errors that agents miss
- Own the verify phase of bolts — integration testing, manual verification, edge case validation
- Identify when AI output is structurally correct but architecturally wrong (right code, wrong place)
- Mentor early-career engineers on effective AI review techniques

**Growth path:** Take on technical design for multi-task features, define interface contracts, lead spec elaboration sessions.

#### Senior / Staff Engineers

The shift: from writing the hardest code to **writing the specifications and plans that make AI-generated code correct**, and serving as the quality backstop.

**Key activities:**
- Write Technical Design Documents with concrete interface contracts and exit conditions
- Lead plan review — the highest-leverage review activity in AI-native development
- Resolve spec conflicts when implementation discovers problems (spec revision protocol)
- Conduct architecture reviews to detect context drift before it compounds
- Design the system-level patterns that agents apply at the feature level
- Coach other engineers on spec quality, review effectiveness, and when to override AI suggestions

**Growth path:** Shape team workflow and agent configurations, contribute to agent prompt engineering, define project-level conventions.

### How Non-Engineering Roles Shift

#### Product Manager → Context Engineer

The PM's primary job shifts from managing backlogs to **engineering precise context** for AI consumption. Vague requirements produce vague code.

**Key activities:**
- Write acceptance criteria that are specific enough to generate machine-verifiable exit conditions
- Define scope boundaries explicitly — what's IN and what's OUT
- Provide concrete examples (sample data, expected behavior) rather than abstract descriptions
- Prioritize ruthlessly — AI makes it easy to build everything, but review capacity is the real constraint

#### Code Reviewer → Quality Gate

Code review becomes the **primary quality assurance activity** rather than a formality. Whether performed by a human, an agent, or both — the human reviewer is the last person who reads the code before it ships.

**Key activities:**
- Read every line, not just the diff summary — AI-generated code often has subtle issues that aren't visible in a quick skim
- Verify tests actually test the behavior, not just the implementation
- Check that the code matches the spec, not just that it compiles
- Flag recurring patterns for promotion to project rules (see `review-governance.md`)

---

## 6. Anti-Patterns

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
