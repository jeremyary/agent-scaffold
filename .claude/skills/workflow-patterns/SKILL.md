---
description: Reference templates for common multi-agent workflows. Provides sequencing patterns, parallel execution groups, and review gates for the dispatcher.
user_invocable: false
---

# Workflow Patterns

These templates define standard multi-agent orchestration sequences. The dispatcher uses these as starting points, adapting them to the specific request.

Note: The dispatcher (`.claude/agents/dispatcher.md`) has compact one-line summaries of these same workflows for quick reference. If you update a workflow here, update the dispatcher's summary to match.

## New Feature (Full-Stack)

A complete feature implementation from product definition through documentation.

```
Phase 1: Product Definition
  → @product-manager: PRD with scope, success metrics, and prioritized features

Phase 2: Requirements
  → @requirements-analyst: Detailed user stories and acceptance criteria from PRD

Phase 3: Design
  → @architect: System design and technology decisions

Phase 4: Work Breakdown
  → @project-manager: Epics, stories, and tasks with estimates and dependencies

Phase 5: Contracts (parallel)
  → @api-designer: API contract and OpenAPI spec
  → @database-engineer: Schema design and migrations

Phase 6: Implementation (parallel)
  → @backend-developer: API handlers and business logic
  → @frontend-developer: UI components and integration

Phase 7: Testing
  → @test-engineer: Unit, integration, and e2e tests

Phase 8: Review (parallel)
  → @code-reviewer: Code quality review
  → @security-engineer: Security audit

Phase 9: Documentation
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

Phase 4: Work Breakdown
  → @project-manager: Epics, stories, tasks with estimates — Jira/Linear export

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

The default workflow for non-trivial features — those involving new data shapes, APIs, integration points, or 3+ implementation tasks. The key difference from "New Feature (Full-Stack)" is explicit review gates after each planning phase, machine-verifiable exit conditions, task sizing constraints, and anti-rubber-stamping governance.

Use SDD when a feature is complex enough that getting the spec wrong would waste more time than writing the spec takes. For simple, single-concern tasks (1–2 files, one implementer), use the simpler Bug Fix or direct single-agent routing instead.

```
Phase 1: Product Definition
  → @product-manager: PRD with scope, success metrics, and prioritized features
  ★ REVIEW GATE: User confirms PRD scope and priorities before proceeding

Phase 2: Requirements
  → @requirements-analyst: Detailed user stories with Given/When/Then acceptance criteria
  ★ REVIEW GATE: User confirms acceptance criteria are complete and correct

Phase 3: Technical Design
  → @tech-lead: Technical Design Document with:
    - Concrete interface contracts (actual JSON shapes, actual type definitions)
    - Data flow covering happy path AND error paths
    - Machine-verifiable exit conditions per task (see agent-workflow.md)
    - File structure mapped to actual codebase layout
    - No TBDs in binding contracts
  ★ REVIEW GATE: Plan review per review-governance.md checklist:
    (1) Contracts concrete, (2) Error paths covered, (3) Exit conditions verifiable,
    (4) File structure maps to codebase, (5) No TBDs in binding contracts

Phase 4: Work Breakdown
  → @project-manager: Epics, stories, and tasks with:
    - 3–5 file scope per task (agent-workflow.md constraint)
    - Machine-verifiable "Done When" with verification commands
    - Self-contained descriptions (no "see document X" references)
    - Estimates and dependency mapping

Phase 5: Implementation (parallel where possible)
  → Assigned implementers (@backend-developer, @frontend-developer, etc.)
  → Each task verified against its exit condition before marking complete
  → If a spec problem is discovered: STOP → revise TD → unblock (tech-lead's spec revision protocol)

Phase 6: Review (parallel)
  → @code-reviewer: Code quality review with anti-rubber-stamping (review-governance.md):
    - At least one finding per review (mandatory findings rule)
    - Test review is not optional — happy-path-only tests are a Warning
    - Scope matching — out-of-scope changes are themselves a finding
  → @security-engineer: Security audit (required for auth, crypto, data deletion code)

Phase 7: Documentation
  → @technical-writer: User docs, API docs, changelog
```

### When to Use SDD vs. Simpler Workflows

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
