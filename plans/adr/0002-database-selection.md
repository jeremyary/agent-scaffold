# ADR-0002: Database Selection

## Status
Proposed

## Context

The application requires persistent storage for multiple concerns: mortgage application state, user data, append-only audit events, document metadata, conversation checkpoints (LangGraph state), vector embeddings for the compliance knowledge base RAG pipeline, aggregate analytics for the CEO dashboard, and pre-seeded demo data. No database is mandated by stakeholder constraints.

The storage requirements span relational data (applications, conditions, documents), append-only data (audit trail), time-series-like data (analytics), key-value-like data (conversation checkpoints), and vector data (compliance KB embeddings). The question is whether to use a single database that handles all concerns or multiple specialized databases.

## Options Considered

### Option 1: PostgreSQL Only (with pgvector)
A single PostgreSQL 16 instance with the pgvector extension handles all storage concerns.

- **Pros:** Single database to operate, backup, migrate, and configure. PostgreSQL is mature, well-understood, and has excellent Python ecosystem support (asyncpg, SQLAlchemy, Alembic). pgvector provides vector similarity search sufficient for PoC-scale RAG (hundreds of chunks). Append-only semantics are enforceable through role grants and triggers. LangGraph has a PostgreSQL checkpoint adapter. Aggregate analytics use standard SQL (materialized views). Docker Compose setup is simple -- one database container. Fedora-allowed license (PostgreSQL License).
- **Cons:** pgvector is less performant than purpose-built vector databases (Milvus, Qdrant) at scale. Not optimal for time-series analytics at high volume. Single point of failure (acceptable for PoC).

### Option 2: PostgreSQL + Dedicated Vector Database (e.g., Qdrant, ChromaDB)
PostgreSQL for relational data, a separate vector database for the compliance KB embeddings.

- **Pros:** Purpose-built vector search with better performance at scale. Cleaner separation between relational and vector concerns.
- **Cons:** Two databases to operate. Doubles the infrastructure complexity. Increases single-command setup time. For PoC-scale data (hundreds of compliance document chunks), the performance difference versus pgvector is negligible. LangChain/LangGraph have good pgvector integration already.

### Option 3: PostgreSQL + Redis (for Conversation State)
PostgreSQL for relational data and vector search, Redis for conversation checkpoints and caching.

- **Pros:** Redis provides fast key-value access for conversation state. LangGraph has a Redis checkpoint adapter.
- **Cons:** Redis is already in the stack for LangFuse. Using it for application state creates a shared dependency that complicates failure modes. LangGraph's PostgreSQL checkpointer is adequate for PoC scale. Conversation state does not need sub-millisecond access -- users tolerate a few hundred milliseconds of session restore.

### Option 4: SQLite (Embedded)
Embedded database, no separate container.

- **Pros:** Zero infrastructure. Simplest possible setup.
- **Cons:** No concurrent access (multiple API workers). No pgvector equivalent for vector search. No schema-level isolation for HMDA. Not production-viable. Does not support the append-only audit trail requirements (no role grants, no triggers).

## Decision

**Option 1: PostgreSQL 16 with pgvector** as the single database.

The PoC operates at a data scale where PostgreSQL handles all concerns adequately. The compliance KB will contain hundreds of document chunks, not millions -- pgvector is performant at this scale. Conversation checkpoints are infrequent (one write per conversation turn), not a high-throughput concern. Audit events are append-only inserts that PostgreSQL handles efficiently.

The single-database approach minimizes operational complexity, simplifies the single-command setup, and avoids the need for cross-database consistency management. The schema is organized into logical domains (application, hmda, audit, conversation, knowledge base) that provide conceptual separation without infrastructure complexity.

**Version and extensions:**
- PostgreSQL 16 (latest stable with good pgvector support)
- pgvector extension (vector similarity search for compliance KB RAG)
- Standard PostgreSQL features: schemas, role-based access, triggers, materialized views

**Migration tool:** Alembic for schema migrations, supporting both the default schema and the `hmda` schema.

## Consequences

### Positive
- Single container to manage, backup, and configure.
- Simple Docker Compose setup -- one database service.
- Mature ecosystem: asyncpg for async access, SQLAlchemy for ORM, Alembic for migrations.
- pgvector is well-integrated with LangChain/LangGraph vector store abstractions.
- LangGraph PostgreSQL checkpoint adapter provides cross-session memory out of the box.

### Negative
- pgvector will need replacement if the compliance KB grows to millions of chunks in production. This is a known limitation accepted at PoC maturity.
- All data in one database means a single-point-of-failure. Acceptable for PoC; production would add replication.
- Audit trail on the same database as application data means a database compromise exposes both. Production would isolate the audit trail (see ADR-0006 upgrade path).

### Neutral
- Redis remains in the stack for LangFuse, but is not used for application state. This is a clean boundary.
- The separate `hmda` schema (ADR-0001) adds migration complexity but is manageable with Alembic's multi-schema support.
