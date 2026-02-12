# Code Style Guidelines

> **Scope:** This file is global — it covers both TypeScript and Python. Apply the relevant language section based on the file you are editing. For Python-only projects, you may use `python-style.md` instead.

## General

- Never use emojis in code, comments, commit messages, documentation, or agent output
- Always include a comment at the top of code files indicating AI assistance: `// This project was developed with assistance from AI tools.` (JS/TS) or `# This project was developed with assistance from AI tools.` (Python) — this is a Red Hat policy requirement per `.claude/rules/ai-compliance.md`
- Code should be self-documenting; add comments only for "why", not "what"
- Include only comments necessary to understand the code
- TODO format: `// TODO: description` (JS/TS) or `# TODO: description` (Python)

## TypeScript

### General Rules

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for exported functions
- Avoid `any` — use `unknown` if type is truly unknown

### Formatting

- 4-space indentation, no tabs
- Max line length: 150 characters (180 for strings/URLs)
- Trailing commas in multi-line structures
- Semicolons required
- Single quotes for strings, backticks for interpolation

### Variables & Functions

- Use `const` by default; `let` only when reassignment is necessary; never `var`
- Prefer early returns over deeply nested conditionals
- Destructure objects and arrays at point of use
- Arrow functions for callbacks; named `function` declarations for top-level exports

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile`, `NavBar` |
| Hooks | camelCase with `use` prefix | `useAuth`, `useUsers` |
| Functions | camelCase | `fetchUser`, `handleClick` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Files (components) | kebab-case | `user-profile.tsx` |
| Files (utilities) | kebab-case | `format-date.ts` |
| Types/interfaces | PascalCase with no `I` prefix | `UserProfile`, not `IUserProfile` |
| Boolean variables | prefix with `is`, `has`, `should`, `can` | `isActive`, `hasPermission` |

### Component Patterns

- Define props interface above the component
- Use named exports for components (not default exports)
- Use `cn()` helper for conditional class composition

### Import Order

1. React and external libraries
2. Internal aliases (`@/` paths)
3. Relative imports
4. Styles

- No circular imports
- Prefer named exports over default exports

### Comments

- Use JSDoc for public API functions

## Python

### General Rules

- Follow PEP 8 (enforced by Ruff)
- Line length: 100 characters max
- Use type hints for all public function signatures
- Use async/await for database operations
- Use `dataclasses` or `pydantic` models for structured data, not raw dicts
- Use context managers (`with`) for resource management

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `UserService`, `BaseModel` |
| Functions | snake_case | `get_user`, `create_session` |
| Variables | snake_case | `user_id`, `is_active` |
| Constants | UPPER_SNAKE_CASE | `DATABASE_URL` |
| Files | snake_case | `user_service.py` |
| Private members | single leading underscore | `_internal_method` |
| Boolean variables | prefix with `is_`, `has_`, `should_`, `can_` | `is_active`, `has_permission` |

### Type Hints

- Use built-in generics (`list[str]`, `dict[str, int]`) over `typing` module equivalents (Python 3.9+)
- Use `X | None` over `Optional[X]` (Python 3.10+)
- Use `TypeAlias` or `type` statement for complex type definitions

### Import Order

1. Standard library
2. Third-party packages
3. Local imports

- Use absolute imports over relative imports
- No wildcard imports (`from module import *`)
- Sort imports with `isort` or `ruff` (isort-compatible)

### Docstrings

- Use Google-style docstrings consistently
- All public modules, classes, and functions must have docstrings

### Formatting

- 4-space indentation, no tabs
- Use trailing commas in multi-line structures
- Use double quotes for strings (Black/Ruff default)
- One blank line between methods, two blank lines between top-level definitions
