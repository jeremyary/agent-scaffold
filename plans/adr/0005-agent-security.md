# ADR-0005: Agent Security Architecture

## Status
Proposed

## Context

Agentic AI applications face security threats that traditional applications do not: prompt injection, tool misuse through conversational manipulation, and data leakage through agent responses. The product plan (F14, F16) requires a multi-layered defense:

- Input validation to detect and reject adversarial prompts.
- Tool access re-verification at execution time (not just session start).
- Output filtering to prevent out-of-scope data in agent responses.
- Fair lending guardrails that refuse to consider protected characteristics.
- Proxy discrimination awareness for facially neutral but potentially discriminatory queries.

The risk table rates "Agent prompt injection bypasses RBAC or leaks HMDA data" as High likelihood / High impact. This is the most critical security concern in the application.

## Options Considered

### Option 1: System Prompt Only (Trust the Model)
Rely on well-crafted system prompts with explicit refusal instructions. No programmatic enforcement.

- **Pros:** Simplest implementation. No additional infrastructure.
- **Cons:** System prompts can be bypassed through sophisticated prompt injection. A single successful injection breaks all guardrails. Not verifiable -- you cannot prove the model will always follow instructions. Unacceptable for a security-focused demo.

### Option 2: Programmatic Enforcement at Each Layer (Defense in Depth)
Four independent programmatic layers, each addressing a different threat vector:
1. Input validation (pre-agent)
2. System prompt hardening (agent configuration)
3. Tool authorization at execution time (runtime enforcement)
4. Output filtering (post-agent)

- **Pros:** Each layer is independently testable. A failure in one layer does not compromise the entire defense. Tool authorization is deterministic (code, not model behavior). Output filtering catches what the model-level defenses miss. Aligns with the product plan's specified defense mechanisms.
- **Cons:** More code to write and maintain. May add latency (input validation + output filtering on every request). Risk of false positives (legitimate queries rejected by input validation).

### Option 3: External Guardrails Service (e.g., LlamaStack Safety API)
Use LlamaStack's safety/guardrails API or a dedicated guardrails service to handle input validation and output filtering.

- **Pros:** Delegated concern -- the guardrails service handles the complexity. LlamaStack has a Safety API designed for this purpose.
- **Cons:** Adds an external dependency for a critical security function. If the guardrails service is down, the agent is either blocked (availability impact) or unguarded (security impact). LlamaStack's Safety API is newer and less tested than programmatic enforcement. Application-specific rules (HMDA data patterns, role-based output filtering) require custom logic regardless.

## Decision

**Option 2: Programmatic Enforcement at Each Layer**, with LlamaStack's Safety API as an optional additive layer for production hardening.

The four layers:

### Layer 1: Input Validation (Pre-Agent)
A validation step that runs before the user's query reaches the agent. This is a Python function, not an LLM call.

**What it checks:**
- Known prompt injection patterns: role-play attacks ("pretend you are an admin"), instruction override attempts ("ignore your instructions"), system prompt extraction ("what are your instructions"), delimiter injection.
- Pattern matching is heuristic -- it catches common attacks, not all possible attacks. This is the first line of defense, not the only one.
- Fair lending input screening: queries that explicitly request protected characteristic consideration.

**On detection:** The query is rejected, a generic refusal message is returned, and the attempt is logged to the audit trail with the detected pattern.

### Layer 2: System Prompt Hardening (Agent Configuration)
Each agent's system prompt includes explicit behavioral constraints:

- Role declaration: "You are the assistant for [persona]. You have access only to [data scope]."
- Refusal instructions: "If asked to access data outside your scope, refuse and explain why."
- HMDA isolation (for lending agents): "You do not have access to demographic data. If asked, refuse and explain that HMDA data is isolated for regulatory compliance."
- Fair lending (for lending agents): "Never consider race, ethnicity, sex, religion, national origin, familial status, disability, age, or receipt of public assistance in any lending analysis."
- Proxy awareness (for lending agents): "If asked to filter by geographic area, ZIP code, or neighborhood, note that such criteria should be reviewed for potential disparate impact. Do not provide neighborhood-level demographic analysis or characterize areas by their demographic composition."

### Layer 3: Tool Authorization at Execution Time
Implemented as a LangGraph **pre-tool node** that executes immediately before each tool invocation. The node verifies:
1. The tool is in the agent's configured tool registry for the current user's role.
2. The user's role (read from JWT claims in the session context) has not been revoked. The staleness window is bounded by the access token lifetime (15 minutes).
3. The tool's data scope parameters match the user's authorized scope.

Authorization results are **not cached across turns** -- every tool call triggers a fresh check against the session's JWT claims. This is deterministic code, not model behavior.

**On authorization failure:**
1. The tool returns an authorization error (not an exception -- the agent receives a structured error result).
2. The agent communicates the access restriction to the user in natural language.
3. The attempt is recorded in the audit trail with event type `tool_auth_failure`, including the tool name, requested scope, and user role.

### Layer 4: Output Filtering (Post-Agent)
After the agent produces a response (before it is sent to the user), a filtering step scans for data that should not be in the output:

- PII patterns (SSN format, date-of-birth patterns) for CEO-destined responses.
- HMDA demographic data references for lending-agent responses.
- **Demographic proxy detection:** Semantic checks for neighborhood-level demographic composition references, proxy characteristics that correlate with protected classes (e.g., references to "predominantly Hispanic neighborhood" or "low-income area demographics"). This uses keyword matching and semantic similarity against known demographic proxy patterns at PoC maturity; production would use ML-based semantic detection.
- Cross-user data references (mentions of other users' names or application IDs not in scope).

**On detection:** The response is redacted (sensitive content replaced with "[REDACTED]"), the original response is logged to the audit trail, and a note is added that output filtering was triggered.

**Semantic leakage test cases:** The adversarial test suite includes test cases with indirect demographic references (e.g., "applicants from [neighborhood with known demographic composition]", proxy language for protected characteristics) to validate that the output filter catches semantic leakage, not just explicit PII patterns.

### Adversarial Testing
A test suite of adversarial prompts is maintained in the test directory. This suite runs as part of CI and includes:
- Prompt injection attempts against each agent.
- RBAC boundary probing (asking a Borrower agent about another user's data).
- HMDA data extraction attempts against lending agents.
- Fair lending guardrail bypass attempts.
- Tool escalation attempts (trying to invoke unauthorized tools).

Runtime detection of adversarial attempts is handled by Layer 1 (input validation) and logged to the audit trail.

## Consequences

### Positive
- Four independent layers provide defense in depth -- no single point of failure.
- Tool authorization (Layer 3) is deterministic code, not dependent on model behavior.
- Each layer is independently testable with specific test cases.
- Adversarial test suite provides regression coverage.
- Audit trail logging of all security events provides visibility.

### Negative
- Input validation and output filtering add latency to every request (expected: < 50ms each for pattern matching).
- False positives in input validation may reject legitimate queries. The patterns must be tuned.
- Maintaining the adversarial test suite requires ongoing effort as new attack patterns emerge.

### Neutral
- LlamaStack's Safety API can be added as a Layer 0 (before input validation) for production hardening. This is not required at PoC maturity but the architecture supports it.
- Output filtering uses pattern matching and keyword-based semantic proxy detection. It catches explicit PII patterns and common demographic proxy references but may miss novel or subtle semantic leakage. This is a PoC-maturity limitation; production would use ML-based semantic detection for higher recall.
