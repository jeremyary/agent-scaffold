---
description: Reference templates for common multi-agent workflows. Provides sequencing patterns, parallel execution groups, and review gates for the dispatcher.
user_invocable: false
---

# Workflow Patterns

These templates define standard multi-agent orchestration sequences. The dispatcher uses these as starting points, adapting them to the specific request.

Note: The dispatcher (`.claude/agents/dispatcher.md`) has compact one-line summaries of these same workflows for quick reference. If you update a workflow here, update the dispatcher's summary to match.

## New Feature (Full-Stack)

A complete feature implementation from requirements through documentation.

```
Phase 1: Requirements
  → @requirements-analyst: Gather and document requirements

Phase 2: Design
  → @architect: System design and technology decisions

Phase 3: Contracts (parallel)
  → @api-designer: API contract and OpenAPI spec
  → @database-engineer: Schema design and migrations

Phase 4: Implementation (parallel)
  → @backend-developer: API handlers and business logic
  → @frontend-developer: UI components and integration

Phase 5: Testing
  → @test-engineer: Unit, integration, and e2e tests

Phase 6: Review (parallel)
  → @code-reviewer: Code quality review
  → @security-engineer: Security audit

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

Infrastructure modifications with security and documentation gates.

```
Phase 1: Implementation
  → @devops-engineer: Infrastructure changes

Phase 2: Review (parallel)
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

Extends the Bug Fix workflow through deployment and post-mortem.

```
Phase 1: Diagnose
  → @debug-specialist: Root cause analysis and hotfix implementation

Phase 2: Verify
  → @test-engineer: Regression test and existing test verification

Phase 3: Deploy
  → @devops-engineer: Deploy hotfix to production

Phase 4: Review (parallel)
  → @code-reviewer: Review hotfix quality
  → @technical-writer: Write post-mortem (timeline, root cause, remediation, prevention)
```

## Greenfield Project Setup

Initial project scaffolding from scratch.

```
Phase 1: Requirements
  → @requirements-analyst: Gather project requirements

Phase 2: Architecture
  → @architect: Technology selection, project structure, ADRs

Phase 3: Foundation (parallel)
  → @devops-engineer: CI/CD pipeline, Docker setup, development environment
  → @database-engineer: Initial schema and migration framework
  → @api-designer: API contract foundation

Phase 4: Scaffold (parallel)
  → @backend-developer: Project skeleton, middleware, error handling
  → @frontend-developer: Project skeleton, routing, layout

Phase 5: Quality Gates
  → @test-engineer: Testing framework setup and example tests

Phase 6: Documentation
  → @technical-writer: README, contributing guide, architecture docs
```
