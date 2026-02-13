# Subagents vs. Agent Teams: SDD Output Comparison

## Source Material

Both approaches processed the same 396-line product brief for a Multi-Agent Mortgage Loan Processing System (MVP maturity, Red Hat AI Quickstart template). The prompt is at `workshop/prompt-comparison/product-brief-prompt.md`.

- **Subagents** (`scaffold-0212/`): Uses the Task tool to spawn individual specialist agents sequentially or in parallel. A single orchestrator context window manages the entire SDD lifecycle.
- **Agent Teams** (`agent-teams/`): Uses TeamCreate with persistent teammates coordinating via shared task lists and messaging. Multiple agents operate concurrently with explicit communication channels.

---

## Artifact Inventory

| Dimension | Subagents | Agent Teams |
|-----------|-----------|-------------|
| Total files | 14 | 31 |
| Total lines (est.) | ~8,900 | ~15,000+ |
| Planning docs | 5 | 7 (requirements chunked into 5 files) |
| Reviews | 9 | 15 |
| Advisory docs | 0 | 8 |
| Orchestrator reviews | **None** | 4 (one per gate) |
| Post-review validation | Inline (TD v1.1 notes 22 changes) | Separate validation doc |

The agent-teams approach produced roughly 2x the volume. The bulk of the difference comes from advisory documents (8 files) and additional reviewers (orchestrator reviews + broader specialist panels).

---

## Product Plan

Both product plans score **6/6** on the review-governance.md Product Plan Review Checklist. Both correctly isolate technology mandates in a constraints section, use MoSCoW prioritization, include user flows, and describe phases as capability milestones.

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Length | 588 lines | 610 lines |
| Phases | 4 (consolidated from brief's 6) | 6 (Phase 3 split into 3a/3b) |
| Auth approach | `Bearer <api_key>` with server-side role resolution | Same approach |
| Reviewers | 2 (Architect, Security Engineer) | 4 (Architect, Security Engineer, API Designer, Orchestrator) |
| Open questions | 10 with impact descriptions | Fewer, less prominent |
| Post-review validation | Implicit in downstream artifacts | Explicit validation doc confirming 11 resolutions |

### Subagent Strengths

- More disciplined about surfacing open questions (10 with explicit impact descriptions)
- Consolidated 6 phases to 4, which both reviewers judged as architecturally sound
- Transparent "Known Limitation" callout on threshold changes (single-reviewer authority)

### Agent-Teams Strengths

- Broader review coverage (4 reviewers vs. 2)
- Explicit post-triage validation document confirming all 11 stakeholder-triaged resolutions and 6/6 scope compliance
- Phase 3a/3b split correctly separates internal agent deployment from public-facing tier

### Assessment

**Edge: Tie.** Both are high quality. The subagent version is slightly more disciplined about surfacing open questions. The agent-teams version has broader review coverage and an explicit validation checkpoint.

---

## Requirements

This is where the approaches diverge most visibly.

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Story count | 81 | 95 |
| File structure | Single 103.5KB file | Master index + 4 chunk files (~5,250 lines total) |
| AC format | Gherkin (Given/When/Then) | Gherkin (Given/When/Then) |
| Architecture consistency notes | None | 4 proactive conflict flags |
| Data flow trace | None | Happy-path trace with story cross-references |
| Critical gaps | Streaming chat (P1), 6 P2 features | Dashboard UI stories, AUDIT-04 ACs |
| Systemic risk | Oversized single file (103.5KB) | **Master-to-chunk divergence (14+ mismatches)** |

### Subagent Strengths

Single source of truth -- no synchronization risk. All stories in one file means no phase/priority contradictions between documents. Despite the file being unwieldy at 103.5KB, internal consistency is maintained.

### Agent-Teams Strengths

Chunked requirements allow parallel authoring. Architecture consistency notes and data flow traces are genuinely valuable cross-cutting artifacts that the subagent version lacks entirely. The 4 architecture consistency notes proactively flag potential conflicts:

1. Review queue sorting using `updated_at` as an escalation timestamp proxy (risk of overwrite)
2. Document upload status constraint extending in Phase 4
3. Fraud flag routing existing before the fraud detector agent
4. Compliance checker parallel timing with credit/risk agents

All three reviewers praised these as a positive finding.

### Agent-Teams Weakness

The master story map has **14+ incorrect phase/priority assignments** versus the chunk files. All three reviewers (orchestrator, architect, product manager) independently flagged this as Critical. Specific discrepancies include:

- KB-01/02/03 listed as P1 Phase 3a in master, but P2 Phase 5 in chunk 4
- THRESHOLD-01/02/03 listed as P1 Phase 3a in master, but P2 Phase 5 in chunk 4
- DEPLOY-01 listed as P0 Phase 1 in master, but P2 Phase 5 in chunk 4
- CHAT-06/07 story IDs swapped between master map and chunk 3

A project manager using the master map would produce a fundamentally different work breakdown than one using chunks.

### Assessment

**Edge: Subagents** -- barely. The agent-teams version has richer cross-referencing, but the master-to-chunk divergence is a serious process risk that undercuts the chunking benefit. The subagent version's single-file approach avoids this class of error entirely.

---

## Architecture

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Length | ~2,000+ lines | ~1,193 lines |
| DDL completeness | 8 tables with full DDL | Full DDL for core entities with indexes |
| Error path coverage | Dedicated error paths table (7 failure modes) + graceful degradation matrix | Covered but less systematically organized |
| ADRs | None (decisions inline) | 6 formal ADRs |
| Middleware stack | Explicit 7-layer execution order | Present but less detailed |
| Pre-creation input | None | 2 advisory memos (API Designer: 174 lines, DB Engineer: 264 lines) |
| Reviewers | 2 (Code Reviewer, Security Engineer) | 4 (Security Engineer, API Designer, Backend Developer, Orchestrator) |
| Review verdict | APPROVE WITH CONDITIONS | All 4 APPROVE |

### Subagent Strengths

More exhaustive single-document coverage. The error paths table, graceful degradation matrix, Redis key patterns with TTLs, and ASCII system diagram create a self-contained reference. Middleware execution order is explicit (7 layers with defined ordering). The document is nearly twice as long and serves as a complete implementation reference.

### Agent-Teams Strengths

The advisory document pattern is a genuinely novel contribution. The API Designer and Database Engineer provided substantive memos (438 lines combined) *before* the architecture was written, meaning specialist knowledge was front-loaded rather than discovered during review. The 6 formal ADRs provide traceable decision rationale. The bcrypt-to-HMAC-SHA256 issue was independently identified by 3 reviewers -- a strong cross-convergence signal validating the multi-reviewer approach.

### Security Architecture (Both)

Both architectures take security seriously beyond MVP expectations:

- Three-layer audit immutability (database role + trigger guard + hash chain)
- Fernet/AES encryption for PII with key versioning
- IDOR prevention via 404 responses
- Server-side role resolution (preventing client-asserted privilege escalation)
- PII redaction pipeline

### Assessment

**Edge: Subagents on depth, Agent Teams on process.** The subagent architecture is a more complete reference document. The agent-teams architecture benefits from advisory input and broader review, but is shorter and less self-contained.

---

## Technical Design Phase 1

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Length | ~1,200 lines (v1.1 post-triage) | ~2,142 lines |
| Work units | 25 (WU20 split into WU20a/WU20b) | 24 |
| Pydantic models | 15+ with validators and aliases | Complete with field validators, aliases, model config |
| ORM models | 8 matching architecture DDL | Present, matching DDL |
| Python implementations | Repository interfaces with signatures | Full implementations (EncryptionService, AuditService, PostgresSaver config, Settings) |
| Exit conditions | All machine-verifiable (bash commands) | All machine-verifiable (20 task groups) |
| Post-review revision | v1.1 with 22 triage changes applied | Unrevised |
| Advisory input | None | 3 memos (API Designer, DB Engineer, Security Engineer) |

### Subagent Strengths

The TD was explicitly revised post-review (v1.1 with 22 documented triage changes). This means the artifact downstream agents would implement has already incorporated review findings. Forward compatibility design (all LangGraph state types defined in Phase 1 even for stub agents) prevents checkpoint migration across phases -- identified positively by multiple reviewers.

### Agent-Teams Strengths

Longer and more detailed, with actual Python implementations rather than just interfaces. The advisory pattern contributed specialist input before authoring. The code reviewer caught genuine bugs that would cause functional defects:

- Checkpointer not wired to `graph.compile()` (Critical)
- `analysiPass` typo in a binding contract field name (Critical -- implementers would faithfully reproduce this misspelling)
- `DocumentSummaryResponse` referenced but never defined
- `annual_income_cents >= 0` DB constraint conflicting with `annual_income > 0` Pydantic validator

### Agent-Teams Weakness

The work breakdown claims "TD Inconsistencies Discovered: None" despite the code reviewer finding 2 Critical and 6 Warning issues. This suggests the WB was created from an unrevised TD, or created in parallel with the TD review. The subagent approach's explicit v1.1 revision avoids this problem -- downstream artifacts inherit a corrected upstream.

### Assessment

**Edge: Tie**, with different strengths. The subagent TD is a cleaner post-review artifact ready for implementation. The agent-teams TD is more detailed but carries unresolved review findings into the work breakdown.

---

## Work Breakdown Phase 1

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Stories | 25 | 37 |
| Work units | 25 | 24 |
| Tasks | 25 (1:1 story-to-WU) | 67 (tasks within WUs) |
| Agent prompts | Story descriptions with exit conditions | Concrete Read/Do/Verify prompts with TD line references |
| Complexity sizing | None | T-shirt sizes (S/M/L) |
| Duration estimates | **None** (compliant) | **"12-15 working days"** (governance violation) |
| Dependency graph | Wave-based scheduling | Mermaid graph + parallel execution groups |
| Pre-creation input | None | 3 complexity assessment advisories |

### Subagent Strengths

Clean governance compliance -- no prohibited duration estimates. Perfect 1:1 story-to-WU mapping verified by Tech Lead. No methodology assumptions (no sprints, velocity, or capacity planning).

### Agent-Teams Strengths

Task prompts are remarkably specific. Example: Task T-008 (Audit Immutability Infrastructure) includes exact DDL references, a 5-step upgrade sequence with correct ordering, a reverse-order down migration, and 5 verification steps including trigger block tests. Task T-023 (Audit Service Core) includes the advisory lock pattern, hash chain computation formula, null sentinel handling, and `SET LOCAL ROLE` with `RESET ROLE` cleanup.

The 3 complexity advisories caught issues *before* the WB was finalized:

- **Backend Developer:** Identified undersized tasks (AUTH-01 touching 5+ files, APP-01 touching 8+ files) and hidden dependencies (correlation middleware before auth, error hierarchy before routes)
- **Database Engineer:** Identified audit immutability as undersized (4 distinct mechanisms in one migration) and seed data as deceptively complex
- **DevOps Engineer:** Identified bootstrap-vs-polish conflation and recommended splitting DX tasks

All recommended splits were adopted in the final work breakdown.

### Agent-Teams Weakness

The duration estimate ("12-15 working days" and "12-14 working days critical path") directly violates review-governance.md: "No effort/time estimates (hours, person-days). Effort estimation requires knowledge of who is doing the work. Agents must not fabricate either."

### Subagent Weakness

Wave scheduling has 3 errors: critical path count wrong (states 14, actual 11), S-P1-22 (audit immutability test) delayed 4 waves unnecessarily, S-P1-13 (health checks) delayed 3 waves unnecessarily. These reduce parallelism and delay feedback on critical properties.

### Assessment

**Edge: Agent Teams on task quality, Subagents on governance compliance.** The agent-teams task prompts (Read/Do/Verify with TD line references) are more directly implementable. The subagent version avoids the governance violation but has scheduling optimization misses.

---

## Review Process

This is the most significant structural difference between the two approaches.

| Aspect | Subagents | Agent Teams |
|--------|-----------|-------------|
| Total reviews | 9 | 15 |
| Reviewers per artifact | 2 (except WB: 1) | 3-4 (orchestrator at every gate) |
| Advisory documents | 0 | 8 |
| Orchestrator reviews | **Missing** | Present at all 4 gates |
| Cross-reviewer convergence | Present but limited by 2-reviewer panels | Strong (bcrypt flagged by 3, master-chunk divergence by 3) |
| Anti-self-approval | Compliant | Compliant |
| Mandatory findings rule | Compliant (all 9 reviews) | Compliant (all 15 reviews) |
| Rubber-stamping signals | None | None |

### Review Quality (Both)

Neither approach shows rubber-stamping. Both produce reviews with specific line references, concrete alternatives, and substantive findings. Positive findings in both sets reference specific patterns rather than offering generic praise.

### Subagent Review Highlights

- The Architect's product plan review identifies that human-in-the-loop belongs in Phase 2 with confidence-based routing -- an architectural insight, not a surface-level observation
- The Security Engineer consistently cites OWASP references (LLM Top 10, API Security Top 10, NIST 800-53)
- The Code Reviewer for architecture identifies that agent-to-agent contracts are informally defined by comments rather than typed structures -- the single most important technical gap addressed by the TD
- The Tech Lead's WB review identifies stories delayed 3-4 waves unnecessarily -- scheduling optimization requiring genuine dependency graph analysis

### Agent-Teams Review Highlights

- The orchestrator reviews catch cross-cutting issues that specialist reviewers miss: workflow persistence contradiction, DOC-04 story-to-endpoint mapping error, `confidence_thresholds` table created without a Phase 1 API surface
- Three-reviewer convergence on the auth token escalation issue (architect, security engineer, API designer all independently flag `Bearer <role>:<key>`)
- The Security Engineer's architecture review includes a complete OWASP Top 10 coverage table (9/10 PASS, 1/10 PARTIAL) and traces every product plan finding to its architectural resolution
- The Code Reviewer's TD review finds genuine implementation bugs (checkpointer not wired, typo in binding contract) with exact line numbers and specific fixes

### Advisory Pattern (Agent Teams Only)

The 8 advisory documents fall into two categories:

**Pre-creation advisories** (5 files): Specialist input *before* artifacts are written. The API Designer's architecture advisory (174 lines) defines endpoint groupings, auth middleware patterns, pagination strategy, and mocked service contracts. The Database Engineer's architecture advisory (264 lines) defines entity models, PII encryption strategy, audit immutability, and migration ordering. All advisory sections were incorporated into the final artifacts.

**Post-creation complexity assessments** (3 files): Task sizing validation *before* the work breakdown is finalized. These caught undersized tasks and hidden dependencies that would have caused implementation failures.

The advisory pattern is a form of "reviewed-before-written" that front-loads quality. This capability is unique to the agent-teams approach.

### Assessment

**Edge: Agent Teams** -- decisively. The orchestrator review, advisory pattern, and broader panels represent a more complete implementation of the SDD governance model. The subagent approach's missing orchestrator reviews is a governance gap.

---

## Governance Compliance Summary

| Rule | Subagents | Agent Teams |
|------|-----------|-------------|
| Plan review before implementation | Pass | Pass |
| Anti-self-approval | Pass | Pass |
| Mandatory findings rule | Pass (9/9) | Pass (15/15) |
| Two-agent review for security-sensitive work | Pass | Pass |
| Machine-verifiable exit conditions | Pass | Pass |
| Chunking heuristics (3-5 files) | Mostly (21/25) | Pass (advisories caught oversized tasks pre-creation) |
| No methodology/effort estimation | **Pass** | **Fail** (duration estimates in WB) |
| Orchestrator review at each gate | **Fail** (missing) | Pass |
| PR size guidance | N/A | N/A |

**Score: Subagents 7/8, Agent Teams 7/8** -- different violations.

---

## Process Characteristics

| Characteristic | Subagents | Agent Teams |
|----------------|-----------|-------------|
| Parallelism model | Sequential artifact creation, parallel reviews | Parallel advisory input, parallel reviews, parallel complexity assessments |
| Knowledge transfer | Implicit (via context window) | Explicit (advisory memos as traceable artifacts) |
| Specialist integration | At review time only | At advisory time (pre-creation) AND review time |
| Error correction | Post-review revision (TD v1.1) | Findings documented but not applied before downstream work |
| Traceability | Review findings reference line numbers | Advisory memos + reviews + TD line references in task prompts |
| Process overhead | Lower (14 files) | Higher (31 files, ~2x volume) |
| Coordination risk | Lower (single orchestrator context) | Higher (master-chunk divergence, parallel artifact sync) |
| Context window pressure | Lower (half the volume) | Higher (more artifacts to maintain coherence across) |

---

## Unique Contributions

### Subagents Only

- **Post-review artifact revision:** The TD v1.1 with 22 documented triage changes means downstream artifacts inherit a corrected upstream. The agent-teams approach does not revise artifacts before creating downstream work.
- **Open questions as a first-class artifact:** 10 open questions with explicit impact descriptions in the product plan. These surface genuine unknowns rather than burying them.
- **Leaner artifact set:** 14 files vs. 31. Less to read, less to maintain, less coordination overhead.

### Agent Teams Only

- **Advisory documents:** 8 specialist memos (pre-creation advisories + complexity assessments) that front-load quality. This is a genuinely novel process innovation not available in the subagent model.
- **Orchestrator reviews:** Cross-cutting reviews at every gate catching issues between specialist scopes.
- **Architecture Consistency Notes:** 4 proactive conflict flags in requirements that anticipate architecture-requirements tensions.
- **Data flow trace:** Happy-path trace through the system with story cross-references.
- **Mermaid dependency graphs:** Visual dependency representation in the work breakdown.
- **Task-level agent prompts:** Read/Do/Verify structure with TD line references, ready for direct agent execution.

---

## Verdict

**Neither approach is strictly superior.** They make different trade-offs:

### Choose Subagents When

- You need a lean, internally consistent artifact set
- Context window pressure is a concern (half the volume)
- You want a simpler coordination model with less sync risk
- Post-review revision cycles are acceptable and preferred (TD v1.1 pattern)
- You want to minimize process overhead and token cost

### Choose Agent Teams When

- You want the broadest possible review coverage (orchestrator reviews, 3-4 reviewer panels)
- Front-loading quality via advisory memos is valuable to your workflow
- Task decomposition needs specialist validation before finalization (complexity advisories)
- You want task prompts ready for direct agent execution (Read/Do/Verify with line references)
- You can manage the coordination overhead (master-chunk sync, parallel artifact consistency)

### Key Differentiators

**The advisory pattern is the agent-teams approach's strongest differentiator.** The 8 advisory documents represent specialist input that is both traceable and incorporated before artifacts are written. This is not available in the subagent model, where specialists only participate at review time. The "reviewed-before-written" workflow catches issues when they are cheapest to fix.

**The subagent approach's strongest differentiator is consistency.** A single orchestrator context window managing sequential artifact creation avoids the sync failures (master-chunk divergence) that emerge with parallel coordination. The explicit post-review revision (TD v1.1) also means downstream artifacts inherit a corrected upstream -- a property the agent-teams approach does not demonstrate.

### Bottom Line

Both approaches produce planning artifacts of sufficient quality to begin implementation. The Critical findings in both sets (missing orchestrator reviews vs. duration estimates, wave scheduling errors vs. master-chunk divergence) are correctable in a single revision pass. Neither set has structural or architectural defects that would require starting over.

The choice between approaches is a trade-off between **depth of specialist integration** (agent teams) and **coordination simplicity** (subagents). For complex, multi-domain systems like this mortgage processor, the agent-teams approach's advisory pattern provides genuine value. For simpler projects or teams that prioritize lean process overhead, the subagent approach delivers equivalent planning quality with half the artifacts.
