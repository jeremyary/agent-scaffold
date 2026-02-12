---
paths:
  - "packages/api/**/*"
---

# API Development

<!-- This rule is path-scoped to the API package. Update the glob if your backend -->
<!-- lives in a different directory (e.g., "src/api/**/*" or "backend/**/*"). -->

## Technology Stack

- **FastAPI** for async web framework
- **Pydantic v2** for data validation and settings
- **SQLAlchemy 2.0** with async support
- **pytest** for testing
- **Ruff** for linting and formatting

## Project Structure

<!-- Update to match your actual API package layout. -->

```
packages/api/
├── src/
│   ├── main.py           # FastAPI application entry point
│   ├── core/
│   │   └── config.py     # Settings and configuration
│   ├── routes/           # API route handlers
│   ├── schemas/          # Pydantic request/response models
│   └── models/           # SQLAlchemy models (re-exported from db)
├── tests/
│   ├── conftest.py       # Pytest fixtures
│   └── test_*.py         # Test files
└── pyproject.toml        # Python dependencies and tools config
```

## Conventions

- Place Pydantic schemas in `src/schemas/` with `Create`/`Response` suffix naming
- Place route handlers in `src/routes/` with one router per resource
- Register routers in `src/main.py` via `app.include_router()`
- Use FastAPI's `Depends()` for database sessions and settings injection
- Manage settings via `pydantic_settings.BaseSettings` in `src/core/config.py`
- For error handling, see `error-handling.md` (RFC 7807) and `api-conventions.md`

## API Documentation

FastAPI auto-generates OpenAPI docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

Add docstrings to endpoints for better documentation.
