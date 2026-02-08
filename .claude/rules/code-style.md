---
globs: "src/**/*.{ts,tsx,js,jsx}"
---

# Code Style

## Formatting
- 4-space indentation, no tabs
- Max line length: 150 characters (180 for strings/URLs)
- Trailing commas in multi-line structures
- Semicolons required
- Single quotes for strings, backticks for interpolation

## Variables & Functions
- Use `const` by default; `let` only when reassignment is necessary; never `var`
- Prefer early returns over deeply nested conditionals
- Destructure objects and arrays at point of use
- Arrow functions for callbacks; named `function` declarations for top-level exports

## Naming
- **Files:** kebab-case (`user-profile.ts`)
- **Variables/functions:** camelCase (`getUserProfile`)
- **Classes/components:** PascalCase (`UserProfile`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Types/interfaces:** PascalCase with no `I` prefix (`UserProfile`, not `IUserProfile`)
- **Boolean variables:** prefix with `is`, `has`, `should`, `can` (`isActive`, `hasPermission`)

## Imports
- Group imports: external packages → internal modules → relative imports, separated by blank lines
- No circular imports
- Prefer named exports over default exports

## Comments
- Code should be self-documenting; add comments only for "why", not "what"
- Include only comments necessary to understand the code
- always include a comment at the top of code files indicating "This project was developed with assistance from AI tools." 
- Use JSDoc for public API functions
- TODO format: `// TODO: description`
