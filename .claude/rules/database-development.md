---
paths:
  - "packages/db/**/*"
---

# Database Development

<!-- This rule is path-scoped to the database package. Update the glob if your -->
<!-- database code lives elsewhere (e.g., "src/db/**/*" or "backend/models/**/*"). -->

## Technology Stack

- **PostgreSQL** — Primary database
- **SQLAlchemy 2.0** — Async ORM with type hints
- **Alembic** — Database migrations
- **asyncpg** — Async PostgreSQL driver

## Package Structure

<!-- Update to match your actual database package layout. -->

```
packages/db/
├── src/
│   ├── db/
│   │   ├── database.py   # Connection and session management
│   │   └── models.py     # SQLAlchemy model definitions
│   └── __init__.py       # Public exports
├── alembic/
│   ├── versions/         # Migration files
│   ├── env.py            # Alembic environment config
│   └── script.py.mako    # Migration template
├── alembic.ini           # Alembic configuration
└── pyproject.toml        # Python dependencies
```

## Conventions

- Import database objects from the `db` package: `from db import get_session, engine, User`
- Export all public models and utilities from `packages/db/src/__init__.py`
- Use `Mapped[]` type annotations for all columns (SQLAlchemy 2.0 style, not legacy `Column()`)
- Use `X | None` for nullable columns: `Mapped[str | None]`
- Index frequently queried columns with `index=True`
- Use `server_default=func.now()` for timestamp columns (not Python-side defaults)
- Define relationships explicitly with `back_populates` on both sides

## Migrations

- Generate: `uv run alembic revision --autogenerate -m "description"` (or `make db-migrate-new m="description"`)
- Apply: `uv run alembic upgrade head` (or `make db-upgrade`)
- Always review auto-generated migrations before applying — verify column types, constraints, and indexes
- Every migration must have both `upgrade()` and `downgrade()` functions
