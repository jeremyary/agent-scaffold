# ADR-0004: LlamaStack Abstraction Layer

## Status
Proposed

## Context

LlamaStack is a stakeholder-mandated technology for model serving / inference abstraction. It provides a unified API for inference, RAG, agents, tools, and safety with a provider plugin system that supports multiple backends (vLLM, Ollama, OpenAI-compatible endpoints, OpenShift AI model serving).

The downstream notes from the product plan review explicitly warn: "LlamaStack has a smaller ecosystem and is less battle-tested. Abstractions must not leak into business logic. Isolate behind interfaces." The question is not whether to use LlamaStack (it is mandated), but how to integrate it so that business logic and agent code are not tightly coupled to its API surface.

Additionally, LangGraph is the mandated agent orchestration framework. The relationship between LangGraph (which manages agent state and tool orchestration) and LlamaStack (which provides model inference) must be clearly defined.

## Options Considered

### Option 1: Direct LlamaStack SDK Usage Throughout
Import and use the LlamaStack Python SDK (`llama_stack_client`) directly in agent code, domain services, and anywhere inference is needed.

- **Pros:** Simplest integration. No wrapper code. Direct access to all LlamaStack features.
- **Cons:** LlamaStack API surface leaks into every file that calls inference. If LlamaStack's API changes (it is a newer project with an evolving API), changes propagate throughout the codebase. Agent code becomes coupled to LlamaStack-specific patterns. Harder for Quickstart users to replace LlamaStack with a different inference provider.

### Option 2: Thin Application-Level Interface Wrapping LlamaStack
Define a small Python interface (protocol class or abstract base class) for inference operations. The interface exposes the operations the application needs (chat completion, embedding generation, streaming). A LlamaStack implementation class wraps the LlamaStack SDK behind this interface. Agent code and domain services import only the application interface.

- **Pros:** LlamaStack API changes affect only the wrapper implementation. Agent code is portable -- swap the wrapper to use a different provider. Clean import boundaries -- business logic never imports `llama_stack_client`. Testable -- mock the interface for unit tests without a running LlamaStack server. Quickstart users can understand the interface contract without learning LlamaStack.
- **Cons:** An extra layer of indirection. Some LlamaStack features may not map cleanly to a generic interface.

### Option 3: LangGraph Custom LLM Provider
Integrate LlamaStack as a LangGraph-compatible LLM provider (implementing LangChain's BaseChatModel interface), so LangGraph agents use LlamaStack transparently through the LangChain/LangGraph abstractions.

- **Pros:** Agent code uses standard LangGraph/LangChain patterns with no awareness of LlamaStack. LangGraph handles all the plumbing.
- **Cons:** LangChain's BaseChatModel may not expose all LlamaStack features. Debugging inference issues requires understanding two abstraction layers (LangChain + LlamaStack). LlamaStack's OpenAI-compatible endpoint means we could use LangChain's ChatOpenAI class directly -- adding a custom provider class is unnecessary complexity.

## Decision

**Option 2: Thin Application-Level Interface**, combined with a pragmatic use of LlamaStack's OpenAI-compatible endpoint for LangGraph integration.

The integration has two paths:

1. **LangGraph agents** use LangChain's standard `ChatOpenAI` (or equivalent) class, pointed at LlamaStack's OpenAI-compatible endpoint (`http://llamastack:8321/v1`). This is the simplest, most maintainable approach -- LangGraph agents use standard LangChain abstractions, and LlamaStack provides the OpenAI-compatible backend. No custom LLM provider class is needed.

2. **Non-agent inference** (document extraction, embedding generation, model routing classification) uses the thin application-level interface that wraps the LlamaStack Python SDK. This interface provides:
   - `chat_completion(messages, model, **kwargs) -> str` -- synchronous completion
   - `stream_completion(messages, model, **kwargs) -> AsyncIterator[str]` -- streaming
   - `generate_embedding(text, model) -> list[float]` -- embedding generation

This dual approach balances pragmatism with isolation: LangGraph uses its natural integration path (OpenAI-compatible endpoints), while application-specific inference needs are isolated behind the thin interface.

**Key rule:** No file outside the inference wrapper module (`packages/api/src/summit_cap/inference/`) imports `llama_stack_client` directly. This is verifiable by grep.

## Consequences

### Positive
- LangGraph agents use standard patterns -- no custom LLM class to maintain.
- Application-specific inference (extraction, embedding) is isolated behind a testable interface.
- LlamaStack API changes affect only the wrapper module.
- Quickstart users can swap inference providers by changing the wrapper implementation.
- The OpenAI-compatible endpoint means standard tools (LangSmith, debugging utilities) work.

### Negative
- Two integration paths (LangChain ChatOpenAI for agents, thin wrapper for non-agent inference) is slightly more complex than a single path.
- The thin wrapper adds a small amount of boilerplate code.

### Neutral
- LlamaStack's `run.yaml` configuration determines which backend provider (Ollama, vLLM, OpenShift AI) actually serves inference. This configuration is deployment-environment-specific and does not affect application code.
- The LlamaStack server runs as a separate container in Docker Compose, adding to the container count but providing clean process isolation.
