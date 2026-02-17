# Work Breakdown Phase 1 Review: Tech Lead

**Artifact:** Work Breakdown Phase 1 (hub + 4 chunks)
**Reviewer:** Tech Lead
**Date:** 2026-02-17
**Verdict:** REQUEST_CHANGES

## Summary

The Work Breakdown is a solid artifact that faithfully translates the Phase 1 Technical Design into implementable stories with detailed prompts. The hub/chunk structure mirrors the TD structure well, the dependency graph is accurate, and the cross-WU coordination notes are helpful. However, there are several issues that must be addressed before implementation begins: (1) the complexity sizing key maps T-shirt sizes to hour estimates, violating the no-methodology rule; (2) several implementation prompts reference TD chunks by line number without inlining the actual content, creating dangling references that will break implementer self-containment; (3) some exit conditions include manual verification steps that are not machine-verifiable; and (4) the WU-8 landing page story groups 3 stories into a single task touching ~15 files, significantly exceeding chunking heuristics.

## Findings

### Critical

**C-1: Complexity sizing key maps to hour estimates.**
The hub document (line 100) defines: `S = Small (1-2 hours), M = Medium (2-4 hours), L = Large (4-8 hours)`. Per review-governance.md and agent-workflow.md, work breakdowns must not include effort/time estimates (hours, person-days). Relative complexity sizing (S/M/L, story points, T-shirt sizes) is allowed -- but mapping them to hours crosses into estimation territory. Remove the parenthetical hour ranges from the sizing key. Keep S/M/L as relative complexity indicators.

**C-2: Multiple implementation prompts contain dangling references to TD chunks by line number instead of inlining content.**
The following story prompts reference TD chunk content by line number without inlining the actual code/config, violating the self-containment requirement for implementation prompts:

| Story | Dangling Reference |
|-------|--------------------|
| T-0-02 | "TD chunk-infra lines 118-175", "TD chunk-infra lines 119-150", "TD chunk-infra lines 152-171" |
| T-0-03 | "TD chunk-infra lines 73-95" |
| T-0-04 | "TD chunk-infra lines 98-113", "TD chunk-infra lines 529-581", "TD hub lines 534-628" |
| S-1-F18-01 | "TD hub lines 696-721" |
| S-1-F21-01 | "TD chunk-infra lines 413-480", "TD hub lines 662-691" |
| S-1-F21-04 | "TD chunk-infra lines 211-236" |
| S-1-F22-01 | "TD chunk-infra lines 651-824" |
| S-1-F18-03 | "TD hub lines 899-969" |

An implementing agent given one of these prompts would need to independently locate and read these line ranges from the TD -- breaking the "implementation prompt is self-contained" contract. The contracts sections in some stories (e.g., S-1-F18-01, S-1-F21-01) do inline the signatures, which is correct. But the "Steps" sections and "Context files" frequently point to line ranges instead. Each reference must either (a) inline the content directly or (b) reference a file path that will exist at implementation time (i.e., a file created by a prior WU task).

**C-3: Several "Context files" references point to files that reference line ranges in upstream documents.**
Some implementation prompts list context files like:
- `plans/technical-design-phase-1-chunk-infra.md lines 118-175`

Context file entries must be absolute file paths that will exist on disk at implementation time. A line range within a planning document is not a valid context file. Either inline the relevant content into the prompt's Contracts section, or reference the actual source file (e.g., the `pyproject.toml` that T-0-01 will have created).

### Warning

**W-1: WU-8 landing page story groups 3 requirement stories (S-1-F1-01, S-1-F1-02, S-1-F1-03) into a single implementation task touching ~15 files.**
This exceeds the chunking heuristic of 3-5 files per task by 3x. The story's own description acknowledges "~15 files but many are boilerplate." While boilerplate reduces decision density, 15 files in a single autonomous task pushes well past the compound-error threshold. Consider splitting into:
- Task A: Scaffolding + types + API client (5 files: types.ts, api-client.ts, schemas/calculator.ts, main.tsx, app.tsx)
- Task B: Landing page components (5 files: hero.tsx, product-cards.tsx, calculator.tsx, calculator-result.tsx, chat-widget-stub.tsx)
- Task C: shadcn/ui component installation + route file (index.tsx + 4 shadcn components)

Alternatively, since many of these files are created by `shadcn-ui add`, the actual authored files might be fewer. Clarify the distinction between generated and authored files.

**W-2: S-1-F22-03 exit condition is not fully machine-verifiable.**
The exit condition comment says `# Verify output shows "healthy" and time < 10 minutes`. The `time make run` output goes to stderr and the "< 10 minutes" assertion requires human interpretation. Replace with a script that captures timing and asserts programmatically, e.g.:
```bash
START=$(date +%s) && make run && END=$(date +%s) && ELAPSED=$((END - START)) && test $ELAPSED -lt 600
```

**W-3: S-1-F18-02 exit condition includes manual verification.**
The exit condition has both a pytest command (good) and a comment: `# Manual: open http://localhost:3001, navigate to traces, verify session_id filter works`. The machine-verifiable part (pytest) is sufficient for Phase 1. The manual step should be documented as a "post-implementation verification note", not as part of the exit condition. Separate the two clearly.

**W-4: S-1-F25-03 (Demographic filter) appears in both WU-3 (as implementation story) and WU-7 (as integration test story).**
The WB hub's WU-to-Story Mapping (line 78) lists "S-1-F25-03" under WU-7. The WB chunk-data also has "S-1-F25-03" as a full implementation story under WU-3 (lines 798-947). The chunk-auth then has a separate WU-7 story titled "S-1-F25-03 (Integration) -- Demographic filter utility tests" (lines 891-959) which re-implements `detect_demographic_data` with a different signature (`-> bool` vs the WU-3 version which returns `DemographicFilterResult`).

This is a contract inconsistency:
- WU-3 defines `detect_demographic_data(text: str) -> DemographicFilterResult` (a class with `is_demographic`, `matched_keywords`, `original_text`)
- WU-7 defines `detect_demographic_data(text: str) -> bool`

The WU-7 version is a simplified re-implementation, not a test of the WU-3 version. The WU-7 story should test the WU-3 implementation, not redefine it. Fix the WU-7 story to import and test the existing function from `services/compliance/demographic_filter.py` using the `DemographicFilterResult` return type.

**W-5: S-1-F2-02 exit condition uses multiple separate `cd` commands instead of a single combined command.**
The exit condition lists three separate bash blocks. A machine-verifiable exit condition should be a single command that returns pass/fail. Combine into:
```bash
cd /home/jary/git/agent-scaffold/packages/api && uv run pytest tests/test_auth.py::test_multi_role_uses_first tests/test_auth.py::test_no_role_returns_403 tests/test_auth.py::test_role_extracted_correctly -v
```

**W-6: S-1-F20-01 context files list includes `packages/api/src/summit_cap/services/compliance/hmda.py` with the note "you will create this" in the wrong story.**
The context file note says "you will create this" for `audit.py`, but `hmda.py` is listed as a context file when it is created by WU-3 (S-1-F25-01), which runs before WU-6. This is technically correct dependency-wise but potentially confusing. The `audit.py` service is created within S-1-F25-01 (WU-3) per the WB chunk-data. However, WU-6 lists it as a context file (implying it exists), which is correct. The confusing note "(you will create this)" should be removed since by WU-6, the file already exists from WU-3.

**W-7: WU-0 tasks exceed the 5-file heuristic.**
T-0-01 creates ~10 root-level files (Makefile, turbo.json, package.json, pnpm-workspace.yaml, pyproject.toml, .gitignore, .env.example, .nvmrc, README.md) plus several directory structures. T-0-02 creates ~12 files across packages/api and packages/db. While these are boilerplate scaffolding files with low decision density, the file counts should be acknowledged. The TD already handles this by noting "Boilerplate-heavy but low decision density" which is acceptable at PoC maturity.

### Suggestion

**S-1: Add `--check` flag documentation to S-1-F20-01.**
The TD hub's WU-6 exit condition references `uv run python -m summit_cap.seed --check`, but the WB implementation prompt only mentions `--force`. Add a `--check` flag that verifies seeding without modifying data (returns 0 if seeded, 1 if not). This makes the WU-6 exit condition self-documenting.

**S-2: Consider adding a `conftest.py` for WU-5 tests.**
S-1-F21-01 through S-1-F21-04 all reference `packages/api/tests/test_model_routing.py`. Since multiple stories add tests to the same file, a shared fixture for model config loading would reduce boilerplate. A `packages/api/tests/conftest.py` with a `model_config` fixture would simplify all four stories.

**S-3: Standardize exit condition format across all stories.**
Some stories use `cd /home/jary/git/agent-scaffold/packages/api && ...` (absolute path) while others use `cd packages/api && ...` (relative path). Since agents may have different working directories, standardize on absolute paths throughout. The WU-0 and WU-5 chunks generally use absolute paths; the data and auth chunks mix relative and absolute.

**S-4: The WU-9 Compose profile "full" semantics could be clearer.**
S-1-F22-04 defines profiles: `auth` (keycloak), `ai` (llamastack), `observability` (redis + clickhouse + langfuse). But the TD hub also mentions a `default` profile (postgres + api + ui). Clarify whether "default" is the no-profile behavior (services without any `profiles:` key) or an explicit profile. This affects how `podman-compose up` (no profile flag) behaves vs `podman-compose --profile full up`.

### Positive

**P-1: Binding contracts are consistently inlined where it matters most.**
The auth/RBAC chunk (chunk-auth) inlines the full `UserContext`, `TokenPayload`, `UserRole`, and `DataScope` Pydantic models at the top of the chunk, then references them throughout all stories. This is exactly the right pattern -- implementers see the contract once and all stories reference the same inlined version. The data chunk does the same with SQLAlchemy models.

**P-2: Cross-WU coordination notes in the hub are well-organized.**
The "Shared Database Schema", "Auth Context Flow", "HMDA Isolation Chain", "Partial Implementations", and "Frontend-Backend Contract" notes concisely explain how work units interact. This gives the Project Manager clear context for sequencing and gives implementers awareness of upstream/downstream dependencies without needing to read the full TD.

**P-3: TD inconsistencies are explicitly carried forward from the TD into the WB.**
The hub's "TD Inconsistencies Carried Forward" table (lines 136-144) makes it clear which TD-flagged issues affect the WB and how they were handled. This prevents implementers from re-discovering these issues.

**P-4: WU-7 integration test stories provide realistic test fixtures.**
The RBAC integration test story includes a detailed `conftest.py` with RSA keypair generation and token factory fixture. This is exactly what an implementing test engineer needs -- a concrete, copy-pasteable fixture pattern rather than a vague "mock the auth" instruction.

## Checklist Results

| Check | Result | Notes |
|-------|--------|-------|
| (1) Story-to-WU mapping | PASS with note | All 32 stories accounted for. WU-0 has infrastructure tasks instead of stories (appropriate). Some stories appear in multiple WUs (implementation + integration test), which is documented. S-1-F25-03 has a contract inconsistency between WU-3 and WU-7 implementations (see W-4). |
| (2) Dependencies accurate | PASS | WB dependency graph matches TD hub exactly. Parallelization opportunities correctly identified. Convergence points (WU-4 needs WU-1+WU-2, WU-7 needs WU-4+WU-3, WU-9 needs all) are accurate. No over-strict chains detected. |
| (3) Exit conditions verifiable | FAIL | S-1-F22-03 and S-1-F18-02 include manual verification steps. S-1-F2-02 uses multiple separate commands. See W-2, W-3, W-5. Most other exit conditions are properly machine-verifiable. |
| (4) Chunking heuristics | FAIL | WU-8 landing page story touches ~15 files in a single task. WU-0 tasks also exceed 5 files but are acknowledged as boilerplate. See W-1, W-7. |
| (5) No methodology assumptions | FAIL | Sizing key maps S/M/L to hour estimates (C-1). Remove the hour parentheticals. |
| (6) Prompts self-contained | FAIL | Multiple prompts reference TD chunks by line number without inlining content (C-2, C-3). Several context file entries point to planning documents rather than source files. Some prompts say "Already loaded from prior task" without specifying what was loaded. |
