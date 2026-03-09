---
description: Reference templates for common multi-agent workflows. Provides sequencing patterns, parallel execution groups, and review gates for orchestrating specialist agents.
user_invocable: false
---

# Workflow Patterns

These templates define standard multi-agent orchestration sequences. Use these as starting points, adapting them to the specific request.

## New Feature (Full-Stack)

A complete feature implementation from product definition through documentation.

```
Phase 1: Product Definition
  → @product-manager: PRD with scope, success metrics, and prioritized features

Phase 2: Requirements
  → @requirements-analyst: Detailed user stories and acceptance criteria from PRD

Phase 3: Design
  → @architect: System design and technology decisions

Phase 4: Requirements Phasing
  → Break requirements into implementation phases with natural PR boundaries
  → Output: plans/requirements-phase-N-<label>.md

Phase 5: Implementation (per phase, PR-based)
  → Plan PRs for the phase, implement sequentially
  → Pre-PR test review before opening each PR
  → Wait for human approval before merging each PR

Phase 6: Inter-Phase Review (parallel)
  → Full specialist panel reviews codebase between phases
  → Consolidate findings, triage with user, address in a PR

Phase 7: Documentation
  → @technical-writer: User docs, API docs, changelog
```

## Bug Fix

Systematic diagnosis, fix, and verification.

```
Phase 1: Diagnosis
  → @debug-specialist: Root cause analysis and fix

Phase 2: Testing
  → @test-engineer: Regression test + verify existing tests pass

Phase 3: Review
  → @code-reviewer: Verify fix quality and no regressions
```

## Performance Optimization

Measure-driven optimization cycle.

```
Phase 1: Profile
  → @performance-engineer: Baseline metrics and bottleneck identification

Phase 2: Optimize
  → [appropriate implementer based on bottleneck location]

Phase 3: Verify
  → @performance-engineer: Measure improvement, compare to baseline

Phase 4: Review
  → @code-reviewer: Verify optimization quality
```

Repeat phases 2-3 if targets not met.

## API Evolution

Contract-first API changes with backward compatibility.

```
Phase 1: Contract
  → @api-designer: Updated API spec with versioning strategy

Phase 2: Implementation
  → @backend-developer: Implement API changes

Phase 3: Contract Testing
  → @test-engineer: Contract tests and integration tests

Phase 4: Documentation
  → @technical-writer: API docs and migration guide
```

## Infrastructure Change

Infrastructure modifications with operational readiness, security, and documentation gates.

```
Phase 1: Implementation
  → @devops-engineer: Infrastructure changes

Phase 2: Operational Readiness
  → @sre-engineer: SLOs, alerting rules, and runbooks for new infrastructure

Phase 3: Review (parallel)
  → @security-engineer: Security review of infrastructure
  → @technical-writer: Runbook and documentation updates
```

## Security Hardening

Security-focused review and remediation cycle.

```
Phase 1: Audit
  → @security-engineer: Full security audit

Phase 2: Remediation (parallel, based on findings)
  → @backend-developer: Fix server-side vulnerabilities
  → @frontend-developer: Fix client-side vulnerabilities
  → @devops-engineer: Fix infrastructure issues

Phase 3: Verification
  → @security-engineer: Verify remediations

Phase 4: Documentation
  → @technical-writer: Security documentation updates
```

## Refactoring

Structured improvement of existing code quality and architecture.

```
Phase 1: Identify
  → @code-reviewer: Audit codebase for code smells, complexity, and improvement targets

Phase 2: Design
  → @architect: Design improved structure, component boundaries, or patterns

Phase 3: Implement (parallel, based on scope)
  → @backend-developer: Refactor server-side code
  → @frontend-developer: Refactor client-side code
  → @database-engineer: Refactor schema or queries

Phase 4: Verify
  → @test-engineer: Verify no regressions, update tests for new structure

Phase 5: Review
  → @code-reviewer: Verify improvement meets design goals
```

## Database Migration (Schema Evolution)

Schema changes that propagate through the application code.

```
Phase 1: Schema
  → @database-engineer: Design migration (up + down), indexes, constraints

Phase 2: Application Code
  → @backend-developer: Update ORM models, queries, and service logic

Phase 3: Testing
  → @test-engineer: Test migration up/down, verify queries, integration tests

Phase 4: Review
  → @code-reviewer: Review migration safety and code changes
```

## Incident Response (Production Bug)

Extends the Bug Fix workflow through triage, deployment, and post-incident review.

```
Phase 1: Triage
  → @sre-engineer: Severity assessment, impact analysis, initial response coordination

Phase 2: Diagnose
  → @debug-specialist: Root cause analysis and hotfix implementation

Phase 3: Verify
  → @test-engineer: Regression test and existing test verification

Phase 4: Deploy
  → @devops-engineer: Deploy hotfix to production

Phase 5: Post-Incident (parallel)
  → @sre-engineer: Post-incident review (timeline, root cause, action items)
  → @code-reviewer: Review hotfix quality
  → @technical-writer: Document incident and remediation
```

## Greenfield Project Setup

Initial project scaffolding from product vision through operational readiness.

```
Phase 1: Product Definition
  → @product-manager: PRD with vision, personas, success metrics, and phased roadmap

Phase 2: Requirements
  → @requirements-analyst: Detailed user stories and acceptance criteria

Phase 3: Architecture
  → @architect: Technology selection, project structure, ADRs

Phase 4: Requirements Phasing
  → Break requirements into implementation phases with natural PR boundaries
  → Output: plans/requirements-phase-N-<label>.md

Phase 5: Foundation (parallel)
  → @devops-engineer: CI/CD pipeline, Docker setup, development environment
  → @database-engineer: Initial schema and migration framework
  → @api-designer: API contract foundation

Phase 6: Scaffold (parallel)
  → @backend-developer: Project skeleton, middleware, error handling
  → @frontend-developer: Project skeleton, routing, layout

Phase 7: Quality Gates
  → @test-engineer: Testing framework setup and example tests

Phase 8: Operational Readiness
  → @sre-engineer: SLOs, alerting, runbooks, incident response process

Phase 9: Documentation
  → @technical-writer: README, contributing guide, architecture docs
```

## Production Readiness

Prepare an existing application for production deployment.

```
Phase 1: SLO Definition
  → @sre-engineer: Define SLOs/SLIs, error budgets, and capacity plan

Phase 2: Infrastructure (parallel)
  → @devops-engineer: Production deployment, monitoring infrastructure, alerting integration
  → @sre-engineer: Alerting rules, runbooks, and incident response process

Phase 3: Security Audit
  → @security-engineer: Full OWASP audit and dependency scanning

Phase 4: Documentation
  → @technical-writer: Runbooks, operational docs, architecture guide
```

## Spec-Driven Development (SDD)

The default workflow for non-trivial features. The defining principle is **scope discipline** — each phase stays strictly within its responsibility and does not do work that belongs to downstream agents. This prevents premature solutioning and ensures each agent gets to do their job with fresh perspective rather than rubber-stamping decisions already baked into an upstream artifact.

Use SDD when a feature is complex enough that getting the spec wrong would waste more time than writing the spec takes. For simple, single-concern tasks (1–2 files, one implementer), use the simpler Bug Fix or direct single-agent routing instead.

### Scope Discipline

This is the most important principle in the workflow. Each phase must stay within its lane:

| Phase | IN Scope | OUT of Scope |
|-------|----------|-------------|
| **Product Plan** | Problem, users, success metrics, feature scope (MoSCoW), user flows, phasing, risks | Architecture, technology choices, epic/story breakout, database design, API design |
| **Architecture** | System design, component boundaries, technology decisions, ADRs, integration patterns | Product scope changes, detailed API contracts, task breakdown, implementation details |
| **Requirements** | User stories, acceptance criteria (Given/When/Then), edge cases, non-functional requirements | Architecture decisions, task sizing, implementation approach |

**Why this matters:** When a product plan includes architecture decisions, the Architect is reduced to rubber-stamping rather than designing. When requirements include implementation approach, implementers have no room to apply their own judgment. Each agent's value comes from doing their analysis fresh — not from inheriting premature decisions from upstream.

### Conditional Re-Review

After resolving review feedback on any artifact, the user decides whether re-review is necessary:

> **Re-review an updated artifact only if the update involved new design decisions not already triaged by the stakeholder.** If the update is purely incorporating already-triaged decisions, trust the validating agent and proceed — the next downstream phase serves as implicit verification.

This prevents unnecessary review cycles while still catching problems. Each downstream agent naturally verifies the upstream artifact because they must build on it:

| Artifact Updated After | Downstream Verifier | Implicit Verification |
|---|---|---|
| Product Plan Validation (Phase 3) | Architect (Phase 4) | Flags product plan inconsistencies while designing |
| Architecture Validation (Phase 6) | Requirements Analyst (Phase 7) | Flags architecture inconsistencies while writing requirements |
| Requirements Phasing (Phase 9) | Implementers (Phase 10) | Flags requirements inconsistencies while implementing |

If a downstream agent discovers an inconsistency, pause and resolve it before continuing — don't work around it. This is cheaper than discovering the problem during implementation.

### SDD State Tracking

The SDD workflow is stateful — each phase depends on prior phases. To survive session boundaries and context compaction, the orchestrator maintains a persistent state file at `plans/sdd-state.md`.

**Create this file when starting Phase 1.** Update it at each phase transition (completion, review gate pass, consensus gate). Read it at the start of any new or continued session to resume state.

Template:

```markdown
# SDD Progress

**Current Phase:** 1 — Product Plan
**Implementation Phase:** —
**Status:** In progress

## Completed Phases

| Phase | Label | Artifact | Status |
|-------|-------|----------|--------|

## Consensus Gates

- [ ] Post-Phase 8: Product plan, architecture, and requirements agreed

## Notes

```

Phase transition updates should be minimal — one line change to Current Phase/Status, one row added to Completed Phases. This keeps the file under 2KB even for long workflows.

### Lifecycle

```
Phase 1: Product Plan
  → @product-manager: Product plan (plans/product-plan.md)
    - Problem statement, target users, success metrics
    - Feature scope with MoSCoW prioritization
    - User flows, phasing, risks
    SCOPE: No architecture, no technology choices, no epic/story breakout.
      Anything better decided by downstream agents is left out to avoid
      premature solutioning.

Phase 2: Product Plan Review (parallel)
  → @architect: Review from architecture feasibility perspective
  → @api-designer: Review from API design perspective
  → @security-engineer: Review from security/compliance perspective
  → Orchestrator: Cross-cutting review (see review-governance.md § Orchestrator Review)
  → OPTIONAL: Assemble stakeholder persona agents for the application
    domain (e.g., end users, administrators, operators) and include
    their reviews. See review-governance.md § Stakeholder Persona Review.
  → Reviews written to plans/reviews/product-plan-review-[agent-name].md
  SCOPE CHECK: All reviewers also check for scope violations per the
    Product Plan Review Checklist in review-governance.md (technology
    names in features, epic breakout, architecture decisions, etc.).
    The Architect reviewer is the primary scope checker.
  REVIEW GATE: User steps through each review's recommendations with
    Claude Code and makes decisions on how to handle them.
  ORCHESTRATOR ASSESSMENT: While agent reviews run, the main session
    reads the artifact independently and prepares its own assessment.
    Use /consolidate-reviews to merge all review files into a
    de-duplicated triage table (see review-governance.md § Review
    Resolution Process).

Phase 3: Product Plan Validation
  → @product-manager: Re-reviews the product plan after changes from
    review feedback. Checks for internal consistency, completeness,
    AND scope compliance (run scope compliance checklist — scope
    violations are commonly introduced during review resolution).
  CONDITIONAL RE-REVIEW: Only re-engage reviewing agents if changes
    involved new design decisions not already triaged by the stakeholder.
    If purely incorporating triaged decisions, proceed — Phase 4 serves
    as implicit verification.

Phase 4: Architecture
  → @architect: Architecture design (plans/architecture.md)
    - System design, component boundaries, data flow
    - Technology decisions with trade-off analysis, ADRs
    - Integration patterns, deployment model
    SCOPE: No product scope changes, no detailed API contracts,
      no implementation details, no task breakdown.
    DOWNSTREAM VERIFICATION: Flag any product plan inconsistencies
      discovered while designing. This serves as implicit verification
      of the post-review product plan.

Phase 5: Architecture Review (parallel)
  → Relevant agents review from their perspectives
    (e.g., @security-engineer, @api-designer, @backend-developer, @sre-engineer)
  → Orchestrator: Cross-cutting review (see review-governance.md § Orchestrator Review)
  → Reviews written to plans/reviews/architecture-review-[agent-name].md
  REVIEW GATE: User steps through review recommendations with Claude Code.
  ORCHESTRATOR ASSESSMENT: While agent reviews run, the main session
    reads the artifact independently and prepares its own assessment.
    Use /consolidate-reviews to merge all review files into a
    de-duplicated triage table (see review-governance.md § Review
    Resolution Process).

Phase 6: Architecture Validation
  → @architect: Final review of architecture document after changes.
  CONDITIONAL RE-REVIEW: Same rule as Phase 3. Only re-engage
    reviewers if changes involved new design decisions.

Phase 7: Requirements
  → @requirements-analyst: Requirements document (plans/requirements.md)
    - Built from product plan AND architecture
    - Detailed user stories with Given/When/Then acceptance criteria
    - Edge cases, non-functional requirements
    SCOPE: No architecture decisions, no task breakdown,
      no implementation approach.
    DOWNSTREAM VERIFICATION: Flag any architecture inconsistencies
      discovered while writing requirements.
    LARGE PROJECTS: If upstream documents are thorough (5+ Must-Have
      features, or 3-4 with complex architecture), use the hub/index
      pattern: (1) master document (plans/requirements.md, ~300-600 lines)
      with story map, cross-cutting concerns, and dependency map, then
      (2) chunk files (plans/requirements-chunk-{N}-{area}.md, ~800-1300
      lines each) with full Given/When/Then criteria. A single monolithic
      document will exceed output limits at ~2000 lines. See the
      requirements-analyst agent's Large Document Strategy for details.

Phase 8: Requirements Review (parallel)
  → @product-manager: Review for completeness against product plan
  → @architect: Review for alignment with architecture
  → Orchestrator: Cross-cutting review (see review-governance.md § Orchestrator Review)
  → OPTIONAL: Stakeholder persona review panel (same as Phase 2).
    Particularly valuable for requirements since personas validate
    that acceptance criteria match real user expectations.
  → Reviews written to plans/reviews/requirements-review-[agent-name].md
  REVIEW GATE: User steps through review recommendations with Claude Code.
  CONDITIONAL RE-REVIEW: Same rule — only re-engage reviewers if
    changes involved new design decisions.
  ORCHESTRATOR ASSESSMENT: While agent reviews run, the main session
    reads the artifact independently and prepares its own assessment.
    Use /consolidate-reviews to merge all review files into a
    de-duplicated triage table (see review-governance.md § Review
    Resolution Process).

  ** CONSENSUS GATE: Pause here. Product plan, architecture, and
     requirements must be thorough, well-documented, accurate, and
     agreed upon by all parties (including the user) before proceeding.

--- Requirements Phasing Boundary ---

  After the consensus gate, the workflow shifts from planning to
  implementation. Requirements are broken into implementation phases
  with natural PR boundaries. Each phase is implemented via a series
  of PRs, with comprehensive codebase reviews between phases.

Phase 9: Requirements Phasing
  → Orchestrator (or @project-manager): Break requirements into
    implementation phases with natural PR boundaries.
    - Each phase should be a coherent chunk of functionality
    - Phases should lend themselves to appropriately sized/scoped PRs
    - Consider natural breaks where comprehensive codebase reviews
      add value between phases
    - Output: plans/requirements-phase-N-<label>.md
      (e.g., requirements-phase-1-foundation.md,
       requirements-phase-2-api-core.md)
    SCOPE: Organize existing requirements into phases. Do not
      introduce new requirements or make architecture decisions.

Phase 10: Implementation (per phase, PR-based)
  → For each phase, plan a series of PRs, then implement sequentially:
    1. Read the phase requirements and plan PR sequence
    2. Create a task list to track progress across context clears
    3. For each PR:
       a. Branch from main
       b. Implement the PR scope
       c. Pre-PR test review: verify tests are meaningful,
          non-ceremonious, and adequately cover the code
          (unit, functional, and integration as appropriate)
       d. Commit, push, and open PR for human review
       e. STOP and wait for human approval before merging
    4. Repeat until all PRs for the phase are merged
  → If a requirements problem is discovered: STOP and flag it
    rather than working around it

Phase 11: Inter-Phase Codebase Review
  → Between implementation phases, run comprehensive multi-agent
    codebase review:
    1. Launch specialist agents in parallel — each reviews the
       codebase from their perspective and writes findings to
       plans/reviews/pre-phase-N-review/review-<agent-name>.md
       Agents: api-designer, architect, backend-developer,
       code-reviewer, database-engineer, debug-specialist,
       frontend-developer, performance-engineer, security-engineer,
       tech-lead, test-engineer (select those relevant to the project)
    2. Orchestrator also reviews for cross-cutting gaps
    3. Agents do NOT need to record positive observations
    4. Use /consolidate-reviews to merge findings into triage table
    5. User triages findings and decides what to address
    6. Address approved findings in a single PR
    7. Verify, merge, then proceed to next phase
  → Also run a test comprehensiveness review:
    Verify tests are comprehensive, non-ceremonious, and adequately
    covering the code. Fix any gaps before moving on.

Phase 12: Documentation
  → @technical-writer: User docs, API docs, changelog
```

**STATE TRACKING:** Update `plans/sdd-state.md` at every phase transition — when completing a phase, passing a review gate, or reaching a consensus gate. This is the authoritative record of SDD progress that survives session boundaries.

The implementation cycle (Phase 10 → Phase 11) repeats for each delivery phase from Phase 9. Always complete one phase before starting the next. Real implementation informs better understanding of subsequent phases.

### Artifact Map

| Phase | Output | Path |
|-------|--------|------|
| Product Plan | Product plan | `plans/product-plan.md` |
| Product Plan Review | Agent + orchestrator reviews | `plans/reviews/product-plan-review-[agent-name\|orchestrator].md` |
| Architecture | Architecture design | `plans/architecture.md` |
| Architecture Review | Agent + orchestrator reviews | `plans/reviews/architecture-review-[agent-name\|orchestrator].md` |
| Requirements | Requirements document | `plans/requirements.md` |
| Requirements Review | Agent + orchestrator reviews | `plans/reviews/requirements-review-[agent-name\|orchestrator].md` |
| Requirements Phasing | Phase breakdown | `plans/requirements-phase-N-<label>.md` |
| Inter-Phase Review | Specialist agent reviews | `plans/reviews/pre-phase-N-review/review-<agent-name>.md` |
| Review Consolidation | De-duplicated triage table | `plans/reviews/<artifact>-review-consolidated.md` |
| SDD State | Phase progress tracker | `plans/sdd-state.md` |

### When to Use SDD vs. Simpler Workflows

**Only the signals in this table determine whether to use SDD.** Project maturity level (PoC, MVP, Production) is **not** a valid reason to skip SDD phases. Maturity affects the depth of artifacts (e.g., lighter documentation at PoC), not whether phases are executed. If any "Use SDD" signal is present, follow the full phase sequence regardless of maturity.

| Signal | Use SDD | Use Simpler Workflow |
|--------|---------|---------------------|
| New API endpoints or data shapes | Yes | — |
| 3+ implementation tasks | Yes | — |
| Multiple agents need to produce integrating code | Yes | — |
| Cross-cutting concern (auth, logging, error handling) | Yes | — |
| Single file change | — | Direct single-agent routing |
| Bug fix with known root cause | — | Bug Fix workflow |
| Performance optimization | — | Performance Optimization workflow |
| Documentation-only change | — | Direct @technical-writer |
