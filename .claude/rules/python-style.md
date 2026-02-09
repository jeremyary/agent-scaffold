---
globs: "**/*.py"
---

# Python Code Style

<!-- Alternative to code-style.md for Python-only projects. If your project uses both -->
<!-- TypeScript and Python, prefer the merged code-style.md and remove this file's -->
<!-- @import from CLAUDE.md. For Python-only projects, use this file and remove code-style.md. -->

## Formatting
- 4-space indentation, no tabs
- Max line length: 88 characters (Black default) or 100 characters (Ruff default)
- Use trailing commas in multi-line structures
- Use double quotes for strings (Black convention) or single quotes (configure consistently)
- One blank line between methods, two blank lines between top-level definitions

## Variables & Functions
- Use type hints on all public function signatures
- Prefer early returns over deeply nested conditionals
- Use `dataclasses` or `pydantic` models for structured data, not raw dicts
- Use context managers (`with`) for resource management

## Naming
- **Files/modules:** snake_case (`user_profile.py`)
- **Variables/functions:** snake_case (`get_user_profile`)
- **Classes:** PascalCase (`UserProfile`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Private members:** single leading underscore (`_internal_method`)
- **Boolean variables:** prefix with `is_`, `has_`, `should_`, `can_` (`is_active`, `has_permission`)

## Imports
- Group imports: standard library, third-party packages, local modules — separated by blank lines
- Use absolute imports over relative imports
- No wildcard imports (`from module import *`)
- Sort imports with `isort` or `ruff` (isort-compatible)

## Type Hints
- Use built-in generics (`list[str]`, `dict[str, int]`) over `typing` module equivalents (Python 3.9+)
- Use `X | None` over `Optional[X]` (Python 3.10+)
- Use `TypeAlias` or `type` statement for complex type definitions

## Comments & Docstrings
- Code should be self-documenting; add comments only for "why", not "what"
- Use Google-style or NumPy-style docstrings consistently (pick one for the project)
- All public modules, classes, and functions must have docstrings
- Always include a comment at the top of code files: `# This project was developed with assistance from AI tools.` — this is a Red Hat policy requirement per "Guidelines on Use of AI Generated Content" (see `.claude/rules/ai-compliance.md` for full obligations)
- TODO format: `# TODO: description`
