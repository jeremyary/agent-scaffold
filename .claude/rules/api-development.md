---
globs: "packages/api/**/*"
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

## Adding a New Endpoint

### 1. Create Pydantic Schemas

```python
# src/schemas/users.py
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    name: str
    email: EmailStr

class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    model_config = {"from_attributes": True}
```

### 2. Create Route Handler

```python
# src/routes/users.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session, User
from src.schemas.users import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(session: AsyncSession = Depends(get_session)):
    """List all users."""
    result = await session.execute(select(User))
    return result.scalars().all()

@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new user."""
    user = User(**user_data.model_dump())
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
```

### 3. Register the Router

```python
# src/main.py
from src.routes.users import router as users_router

app.include_router(users_router)
```

### 4. Add Tests

```python
# tests/test_users.py
def test_create_user(client):
    response = client.post("/users/", json={
        "name": "Test User",
        "email": "test@example.com"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test User"

def test_list_users(client):
    response = client.get("/users/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

## Dependency Injection

Use FastAPI's `Depends()` for:

```python
# Database sessions
from db import get_session
session: AsyncSession = Depends(get_session)

# Settings
from src.core.config import Settings, get_settings
settings: Settings = Depends(get_settings)
```

## Configuration

Settings are managed via Pydantic Settings:

```python
# src/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    debug: bool = False
    database_url: str
    allowed_hosts: list[str] = ["*"]

    model_config = {"env_file": ".env"}
```

## Error Handling

> **Note:** For the full error response standard (RFC 7807), see `error-handling.md`. For REST API design conventions, see `api-conventions.md`.

Use FastAPI's HTTPException for quick error responses:

```python
from fastapi import HTTPException

raise HTTPException(status_code=404, detail="Resource not found")
raise HTTPException(status_code=400, detail="Invalid input")
raise HTTPException(status_code=403, detail="Not authorized")
```

For production APIs, implement an exception handler that maps domain errors to RFC 7807 responses.

## API Documentation

FastAPI auto-generates OpenAPI docs:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

Add docstrings to endpoints for better documentation.
