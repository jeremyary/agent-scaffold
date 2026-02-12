---
paths:
  - "packages/ui/**/*"
---

# UI Development

<!-- This rule is path-scoped to the UI package. Update the glob if your frontend -->
<!-- lives in a different directory (e.g., "web/**/*" or "frontend/**/*"). -->

## Technology Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **TanStack Router** for file-based routing
- **TanStack Query** for server state management
- **Tailwind CSS** for styling
- **shadcn/ui** for accessible UI components
- **Vitest** + React Testing Library for testing

## Project Structure

<!-- Update to match your actual UI package layout. -->

```
packages/ui/
├── src/
│   ├── components/      # UI components (atoms, molecules, organisms)
│   ├── routes/          # TanStack Router file-based routes
│   ├── hooks/           # Custom React hooks (TanStack Query wrappers)
│   ├── services/        # API client functions
│   ├── schemas/         # Zod schemas for API responses
│   ├── styles/          # Global CSS and Tailwind config
│   └── test/            # Test utilities and setup
└── vitest.config.ts     # Test configuration
```

## Routing

TanStack Router uses file-based route definitions:

| File | Route |
|------|-------|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/users/$id.tsx` | `/users/:id` (dynamic) |
| `routes/settings/index.tsx` | `/settings` |
| `routes/__root.tsx` | Root layout wrapper |

The route tree (`routeTree.gen.ts`) regenerates automatically during development.

## Component Conventions

- Organize by complexity: `atoms/` > `molecules/` > `organisms/` > `templates/`
- Each component: `component-name.tsx` + `component-name.test.tsx` (co-located)
- Define props interface above the component, use named exports

## API Integration Pattern

Follow the layered pattern: `Component -> Hook -> TanStack Query -> Service -> API`

- Define Zod schemas in `schemas/` for response validation
- Create fetch functions in `services/` that validate responses against schemas
- Wrap service calls in TanStack Query hooks in `hooks/`
- Components consume hooks, never call services directly

## Styling Guidelines

- Use Tailwind CSS utility classes
- Use `cn()` helper for conditional classes
- Prefer shadcn/ui components for accessibility
- Define design tokens in `tailwind.config.js`
- Keep component-specific styles with components
