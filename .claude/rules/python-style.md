# Python Code Style

> **Scope:** This is the project's primary style guide. All Python code must follow these conventions.

## General

- Never use emojis anywhere: code, comments, commit messages, documentation, agent output, PR descriptions, PR titles, GitHub comments, branch names, or any other artifact visible to users or stored in the repository
- Always include a comment at the top of code files: `# This project was developed with assistance from AI tools.` — this is a Red Hat policy requirement per `.claude/rules/ai-compliance.md`
- Code should be self-documenting; add comments only for "why", not "what"
- Include only comments necessary to understand the code
- TODO format: `# TODO: description`

## General Rules

- Follow PEP 8 (enforced by Ruff)
- Line length: 100 characters max
- Use type hints for all public function signatures
- Use async/await for database and I/O operations
- Use `dataclasses` or `pydantic` models for structured data, not raw dicts
- Use context managers (`with`) for resource management

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `UserService`, `BaseModel` |
| Functions | snake_case | `get_user`, `create_session` |
| Variables | snake_case | `user_id`, `is_active` |
| Constants | UPPER_SNAKE_CASE | `DATABASE_URL` |
| Files | snake_case | `user_service.py` |
| Private members | single leading underscore | `_internal_method` |
| Boolean variables | prefix with `is_`, `has_`, `should_`, `can_` | `is_active`, `has_permission` |

## Type Hints

- Use built-in generics (`list[str]`, `dict[str, int]`) over `typing` module equivalents (Python 3.9+)
- Use `X | None` over `Optional[X]` (Python 3.10+)
- Use `TypeAlias` or `type` statement for complex type definitions

## Import Order

1. Standard library
2. Third-party packages
3. Local imports

- Use absolute imports over relative imports
- No wildcard imports (`from module import *`)
- Sort imports with `isort` or `ruff` (isort-compatible)

## Docstrings

- Use Google-style docstrings consistently
- All public modules, classes, and functions must have docstrings

## Formatting

- 4-space indentation, no tabs
- Use trailing commas in multi-line structures
- Use double quotes for strings (Black/Ruff default)
- One blank line between methods, two blank lines between top-level definitions
