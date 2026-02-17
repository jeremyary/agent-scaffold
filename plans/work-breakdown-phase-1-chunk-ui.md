# This project was developed with assistance from AI tools.
# Work Breakdown Phase 1 -- Chunk: Frontend Scaffolding and Landing Page

**Work Unit:** WU-8
**Stories:** S-1-F1-01, S-1-F1-02, S-1-F1-03, S-1-F2-02 (route guards), S-1-F20-05 (empty states)
**Features:** F1 (Prospect Landing Page and Affordability Calculator), F2 (Role-Based Route Access), F20 (Empty State Handling)
**Agent:** @frontend-developer
**Dependencies:** WU-0 (project bootstrap)

---

## Overview

WU-8 scaffolds the React SPA with TanStack Router, implements Keycloak OIDC integration on the frontend, creates role-based route guards, builds the public landing page with product information and affordability calculator, and adds empty state handling for Phase 1 surfaces.

**Complexity:** L (Large) -- ~15 files but many are boilerplate scaffolding. Grouped into 3 logical sub-stories.

**File Budget:** 15 files total, grouped as:
- Scaffolding + Auth (5 core files: main.tsx, app.tsx, router.tsx, auth.ts, use-auth.ts)
- Landing Page Features (5 components: hero, product-cards, calculator, calculator-result, chat-widget-stub)
- Route Guards + Empty States (5 files: route examples, empty-state component, error-page)

**Exit Condition:**
```bash
cd /home/jary/git/agent-scaffold/packages/ui && pnpm exec tsc --noEmit && pnpm test -- --run
```

---

## WU-8 Shared Context

This context applies to all stories in this WU. Read once before starting any story.

### Binding Contracts (from TD Hub)

**TypeScript Interfaces** (`packages/ui/src/services/types.ts`):

```typescript
export type UserRole =
    | "admin"
    | "prospect"
    | "borrower"
    | "loan_officer"
    | "underwriter"
    | "ceo";

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    // Tokens managed by keycloak-js (sessionStorage, tab-scoped).
    // Use getAccessToken() to read kc.token directly -- do not store in React state.
}

export interface HealthResponse {
    status: "healthy" | "degraded";
    version: string;
    services: Record<string, "up" | "down">;
}

export interface ErrorResponse {
    error: string;
    detail?: string;
    request_id?: string;
}

export interface ProductInfo {
    id: string;
    name: string;
    description: string;
    min_down_payment_pct: number;
    typical_rate: number;
}

export interface AffordabilityRequest {
    gross_annual_income: number;
    monthly_debts: number;
    down_payment: number;
    interest_rate?: number;
    loan_term_years?: number;
}

export interface AffordabilityResponse {
    max_loan_amount: number;
    estimated_monthly_payment: number;
    estimated_purchase_price: number;
    dti_ratio: number;
    dti_warning: string | null;
    pmi_warning: string | null;
}
```

**API Client Functions** (`packages/ui/src/services/api-client.ts`):

```typescript
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function fetchHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
}

export async function fetchProducts(): Promise<ProductInfo[]> {
    const res = await fetch(`${API_BASE}/api/public/products`);
    return res.json();
}

export async function calculateAffordability(
    data: AffordabilityRequest,
): Promise<AffordabilityResponse> {
    const res = await fetch(`${API_BASE}/api/public/calculate-affordability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
```

**Route Structure:**
- `/` -- Public landing page (no auth)
- `/products` -- Product information page (no auth)
- `/borrower/*` -- Borrower UI (requires `borrower` role)
- `/loan-officer/*` -- LO UI (requires `loan_officer` role)
- `/underwriter/*` -- Underwriter UI (requires `underwriter` role)
- `/ceo/*` -- CEO UI (requires `ceo` role)
- `/403` -- Forbidden error page

### Key Decisions (from TD)

- **Keycloak JS adapter:** `keycloak-js` library manages tokens via sessionStorage. Do NOT extract or store raw tokens in React state. Use `getAccessToken()` to read `kc.token` directly.
- **Token refresh:** Use `kc.onTokenExpired` callback (NOT setInterval polling) to trigger token refresh. This avoids stale closure issues.
- **Silent SSO:** Include `packages/ui/public/silent-check-sso.html` for seamless session restoration.
- **Route guards:** TanStack Router `beforeLoad` hook checks role from token claims. Frontend guards are defense-in-depth -- real enforcement is API-side.
- **Chat widget:** Phase 1 displays "Coming soon" stub or "AI unavailable" message. Real chat is Phase 2+.
- **Empty states:** Reusable `EmptyState` component with icon, title, description, and optional action button.

### Scope Boundaries

**In scope for WU-8:**
- React app scaffold with TanStack Router
- Keycloak OIDC integration (auth flow, token storage, refresh)
- Role-based route guards for borrower/LO/underwriter/CEO routes
- Public landing page with hero, product cards, affordability calculator
- Chat widget stub (displays "Coming soon" message)
- Empty state component (used on landing page and Phase 1 route stubs)

**Out of scope for WU-8:**
- Chat interface implementation (Phase 2+)
- Document upload UI (Phase 2+)
- LO/Underwriter/CEO dashboard content (Phase 2-4)
- AI assistant integration (Phase 2+)

---

## Story Breakdown

### Story: S-1-F1-01, S-1-F1-02, S-1-F1-03 -- Public Landing Page with Calculator and Chat Stub

**WU:** WU-8
**Features:** F1 (Prospect Landing Page and Affordability Calculator)
**Complexity:** M

#### Acceptance Criteria

**S-1-F1-01: Prospect accesses product information without login**

**Given** a prospect visits the Summit Cap Financial public landing page
**When** they view the page
**Then** they see product information (loan types, terms, rates) without any authentication prompt

**Given** a prospect on the public landing page
**When** they attempt to access product details
**Then** no cookies, session tokens, or user tracking are required to view the content

**Given** a prospect clicks a product information link
**When** the link points to a deep link route (e.g., `/products/conventional-loans`)
**Then** the page loads without redirection to a login screen

**Given** the public assistant is unavailable (LlamaStack down)
**When** a prospect visits the public landing page
**Then** static product information is still visible (degraded mode: no chat, but information pages work)

**S-1-F1-02: Prospect uses affordability calculator**

**Given** a prospect on the public landing page
**When** they open the affordability calculator
**Then** they see input fields for income, monthly debts, and down payment

**Given** a prospect enters valid financial data into the calculator
**When** they submit the calculation
**Then** the calculator returns an estimated maximum loan amount, monthly payment, and affordability range

**Given** a prospect enters invalid data (e.g., negative income, non-numeric values)
**When** they submit the calculation
**Then** the calculator displays field-level validation errors and refuses to compute

**Given** a prospect's DTI exceeds 43%
**When** the calculator computes affordability
**Then** the result includes a warning that the DTI may exceed conventional lending guidelines

**Given** a prospect enters a down payment that represents < 3% of the estimated purchase price
**When** the calculator computes affordability
**Then** the result flags that a low down payment may require PMI

**S-1-F1-03: Prospect initiates prequalification chat**

**Given** a prospect on the public landing page
**When** they click "Chat with us" or a similar CTA
**Then** a chat widget opens with a message: "AI assistant coming soon. In the meantime, use our affordability calculator or call us at (303) 555-0100."

**Given** the LlamaStack service is unavailable
**When** a prospect attempts to open the chat widget
**Then** the widget displays "Our chat assistant is temporarily unavailable. Please try again later or call us at (303) 555-0100."

#### Files

- `packages/ui/src/routes/index.tsx` -- Public landing page route
- `packages/ui/src/components/landing/hero.tsx` -- Hero section (branding, tagline)
- `packages/ui/src/components/landing/product-cards.tsx` -- Product cards (fetches from API)
- `packages/ui/src/components/landing/calculator.tsx` -- Affordability calculator form
- `packages/ui/src/components/landing/calculator-result.tsx` -- Calculator results display
- `packages/ui/src/components/landing/chat-widget-stub.tsx` -- Chat widget placeholder
- `packages/ui/src/schemas/calculator.ts` -- Zod schema for affordability input
- `packages/ui/src/components/ui/button.tsx` -- shadcn/ui button component
- `packages/ui/src/components/ui/card.tsx` -- shadcn/ui card component
- `packages/ui/src/components/ui/input.tsx` -- shadcn/ui input component
- `packages/ui/src/components/ui/label.tsx` -- shadcn/ui label component

#### Implementation Prompt

**Role:** @frontend-developer

**Context files:**
- `packages/ui/src/services/types.ts` -- Read to understand `ProductInfo`, `AffordabilityRequest`, `AffordabilityResponse` interfaces
- `packages/ui/src/services/api-client.ts` -- Read to understand `fetchProducts()` and `calculateAffordability()` functions
- WU-8 Shared Context (above) -- Binding contracts and key decisions

**Requirements:**

Build the public landing page with the following components:

1. **Hero Section** (`hero.tsx`)
   - Summit Cap Financial branding (logo, tagline: "Your trusted partner in homeownership")
   - Brief intro paragraph
   - CTA button: "Get Started" (scrolls to calculator or opens chat)

2. **Product Cards** (`product-cards.tsx`)
   - Fetch products from `fetchProducts()` API
   - Display 6 product cards (30-yr fixed, 15-yr fixed, ARM, Jumbo, FHA, VA)
   - Each card shows: product name, description, min down payment %, typical rate
   - No authentication required -- public route

3. **Affordability Calculator** (`calculator.tsx`)
   - Form with inputs: gross annual income, monthly debts, down payment, interest rate (optional, default 6.5%), loan term years (optional, default 30)
   - Client-side validation via `react-hook-form` + `zod` (see schema below)
   - Submit button triggers `calculateAffordability()` API call
   - Display results via `calculator-result.tsx` component
   - Show field-level validation errors on invalid input
   - Show DTI warning if DTI > 43%
   - Show PMI warning if down payment < 3% of estimated purchase price
   - Error handling: if API call fails, display "Calculator temporarily unavailable. Please try again later."

4. **Calculator Results** (`calculator-result.tsx`)
   - Display: max loan amount, estimated monthly payment, estimated purchase price, DTI ratio
   - Format currency values with commas and 2 decimal places
   - Display DTI and PMI warnings if present
   - Use shadcn/ui Card for results container

5. **Chat Widget Stub** (`chat-widget-stub.tsx`)
   - Button: "Chat with us"
   - On click: opens overlay/modal
   - Content: "AI assistant coming soon. In the meantime, use our affordability calculator or call us at (303) 555-0100."
   - No backend integration -- pure UI stub for Phase 1

6. **Zod Schema** (`schemas/calculator.ts`)
   - Define affordability input schema matching `AffordabilityRequest` interface
   - Validation rules:
     - `gross_annual_income`: required, positive number
     - `monthly_debts`: required, >= 0
     - `down_payment`: required, >= 0
     - `interest_rate`: optional, default 6.5, range 0-15
     - `loan_term_years`: optional, default 30, range 10-40

7. **shadcn/ui Components**
   - Install shadcn/ui components: `button`, `card`, `input`, `label` (via `pnpm dlx shadcn-ui@latest add <component>`)
   - Use these components throughout landing page

**Steps:**

1. Install dependencies: `cd /home/jary/git/agent-scaffold/packages/ui && pnpm add react-hook-form @hookform/resolvers zod keycloak-js @tanstack/react-router @tanstack/react-query`
2. Install shadcn/ui components: `pnpm dlx shadcn-ui@latest init` (choose defaults), then `pnpm dlx shadcn-ui@latest add button card input label`
3. Create `packages/ui/src/services/types.ts` with TypeScript interfaces (from WU-8 Shared Context)
4. Create `packages/ui/src/services/api-client.ts` with API client functions (from WU-8 Shared Context)
5. Create Zod schema `packages/ui/src/schemas/calculator.ts`
6. Create hero component `packages/ui/src/components/landing/hero.tsx`
7. Create product cards component `packages/ui/src/components/landing/product-cards.tsx`
8. Create calculator form component `packages/ui/src/components/landing/calculator.tsx` (use react-hook-form + zod)
9. Create calculator result component `packages/ui/src/components/landing/calculator-result.tsx`
10. Create chat widget stub component `packages/ui/src/components/landing/chat-widget-stub.tsx`
11. Create landing page route `packages/ui/src/routes/index.tsx` that composes all components
12. Add AI compliance comment at top of all files: `// This project was developed with assistance from AI tools.`
13. Run TypeScript compiler: `pnpm exec tsc --noEmit` (verify no errors)
14. Write unit tests for calculator component in `packages/ui/src/components/landing/__tests__/calculator.test.tsx`

**Contracts:**

Use the following API client functions (already provided in `packages/ui/src/services/api-client.ts`):

```typescript
export async function fetchProducts(): Promise<ProductInfo[]>
export async function calculateAffordability(data: AffordabilityRequest): Promise<AffordabilityResponse>
```

Use these TypeScript interfaces (already provided in `packages/ui/src/services/types.ts`):

```typescript
export interface ProductInfo {
    id: string;
    name: string;
    description: string;
    min_down_payment_pct: number;
    typical_rate: number;
}

export interface AffordabilityRequest {
    gross_annual_income: number;
    monthly_debts: number;
    down_payment: number;
    interest_rate?: number;
    loan_term_years?: number;
}

export interface AffordabilityResponse {
    max_loan_amount: number;
    estimated_monthly_payment: number;
    estimated_purchase_price: number;
    dti_ratio: number;
    dti_warning: string | null;
    pmi_warning: string | null;
}
```

**Exit condition:**
```bash
cd /home/jary/git/agent-scaffold/packages/ui && pnpm exec tsc --noEmit && pnpm test -- --run
```

---

### Story: S-1-F2-02 -- Role-Based Route Guards

**WU:** WU-8
**Feature:** F2 (Authentication and Authorization)
**Complexity:** M

#### Acceptance Criteria

**Given** a user with role `borrower` is authenticated
**When** they navigate to `/borrower/dashboard`
**Then** the route loads and displays the borrower-specific UI

**Given** a user with role `borrower` is authenticated
**When** they attempt to navigate to `/loan-officer/pipeline`
**Then** the route does not load, and they see a 403 error page: "You do not have access to this page"

**Given** a user with role `loan_officer` is authenticated
**When** they navigate to `/loan-officer/pipeline`
**Then** the route loads and displays the LO-specific pipeline UI

**Given** a user with role `ceo` is authenticated
**When** they navigate to `/ceo/dashboard`
**Then** the route loads and displays the executive dashboard

**Given** a user with role `ceo` is authenticated
**When** they attempt to navigate to `/underwriter/queue`
**Then** the route does not load, and they see a 403 error page

**Given** a user with multiple roles assigned in Keycloak (edge case)
**When** they authenticate
**Then** the system uses the first role in the token's role claim array, logs a warning that multiple roles are present, and proceeds with that role

**Given** a user with no role assigned in Keycloak (edge case)
**When** they authenticate
**Then** the API rejects all requests with 403 and logs the authorization failure

**Given** a user's role is changed in Keycloak while they are logged in
**When** their access token expires and they refresh the token
**Then** the new token reflects the updated role, and the user's UI permissions change accordingly on the next page load

#### Files

- `packages/ui/src/services/auth.ts` -- Keycloak OIDC integration
- `packages/ui/src/hooks/use-auth.ts` -- Auth context hook and provider
- `packages/ui/src/routes/__root.tsx` -- Root layout with auth provider
- `packages/ui/src/routes/borrower/index.tsx` -- Borrower dashboard (placeholder with empty state)
- `packages/ui/src/routes/loan-officer/index.tsx` -- LO pipeline (placeholder with empty state)
- `packages/ui/src/routes/underwriter/index.tsx` -- Underwriter queue (placeholder with empty state)
- `packages/ui/src/routes/ceo/index.tsx` -- CEO dashboard (placeholder with empty state)
- `packages/ui/src/components/common/error-page.tsx` -- 403/404 error page
- `packages/ui/public/silent-check-sso.html` -- Keycloak silent SSO check page

#### Implementation Prompt

**Role:** @frontend-developer

**Context files:**
- `packages/ui/src/services/types.ts` -- Read `AuthUser` and `UserRole` interfaces
- WU-8 Shared Context (above) -- Keycloak auth contracts and key decisions

**Requirements:**

Implement Keycloak OIDC authentication and role-based route guards:

1. **Keycloak Auth Service** (`auth.ts`)
   - Use `keycloak-js` library for OIDC flow
   - Config: realm `summit-cap`, client `summit-cap-ui`, URL from `VITE_KEYCLOAK_URL` env var (default `http://localhost:8080`)
   - Init with `onLoad: "check-sso"`, `pkceMethod: "S256"`, `silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html"`
   - Tokens managed by keycloak-js via sessionStorage (tab-scoped persistence)
   - Export functions: `initAuth(): Promise<AuthUser | null>`, `login(): Promise<void>`, `logout(): Promise<void>`, `getAccessToken(): string | null`
   - Extract user metadata from token: `{ id: sub, email, name, role: extractPrimaryRole(realm_access.roles) }`
   - Role extraction: find first matching app role (`borrower`, `loan_officer`, `underwriter`, `ceo`) from token's `realm_access.roles` array

2. **Auth Context Hook** (`use-auth.ts`)
   - React context provider wrapping keycloak-js
   - State: `user: AuthUser | null`, `isLoading: boolean`
   - Use `useEffect` to call `initAuth()` on mount, set user state
   - Use `kc.onTokenExpired` callback (NOT setInterval) to trigger token refresh: `kc.updateToken(30).catch(() => setUser(null))`
   - Context value: `{ user, isLoading, isAuthenticated: user !== null, login, logout, getToken: getAccessToken }`
   - Export `AuthProvider` component and `useAuth()` hook

3. **Root Layout** (`__root.tsx`)
   - Wrap app with `AuthProvider`
   - Include `Header` and `Footer` components (create stubs if needed)
   - Use `<Outlet />` for child routes

4. **Route Guards** (borrower/LO/underwriter/CEO routes)
   - TanStack Router `beforeLoad` hook checks role from token
   - If no token: redirect to `/` (public landing page)
   - If wrong role: redirect to `/403`
   - If correct role: allow route to render
   - Phase 1 route content: display `EmptyState` component with placeholder message (e.g., "Your applications will appear here once you begin the intake process")

5. **Error Page** (`error-page.tsx`)
   - Display 403 Forbidden or 404 Not Found message
   - Include "Go Home" button to return to landing page

6. **Silent SSO Check** (`public/silent-check-sso.html`)
   - Minimal HTML file that posts auth result back to parent frame
   - Standard Keycloak silent SSO pattern (see Keycloak docs)

**Steps:**

1. Create `packages/ui/src/services/auth.ts` with Keycloak OIDC integration (see TD chunk for full implementation)
2. Create `packages/ui/src/hooks/use-auth.ts` with auth context provider (see TD chunk for full implementation)
3. Create `packages/ui/src/routes/__root.tsx` with root layout and auth provider
4. Create protected routes:
   - `packages/ui/src/routes/borrower/index.tsx` with `beforeLoad` guard
   - `packages/ui/src/routes/loan-officer/index.tsx` with `beforeLoad` guard
   - `packages/ui/src/routes/underwriter/index.tsx` with `beforeLoad` guard
   - `packages/ui/src/routes/ceo/index.tsx` with `beforeLoad` guard
5. Create `packages/ui/src/components/common/error-page.tsx` for 403/404 handling
6. Create `packages/ui/public/silent-check-sso.html` for Keycloak silent SSO
7. Create header/footer stub components in `packages/ui/src/components/layout/`
8. Add AI compliance comment at top of all files: `// This project was developed with assistance from AI tools.`
9. Run TypeScript compiler: `pnpm exec tsc --noEmit` (verify no errors)
10. Write unit tests for auth service in `packages/ui/src/services/__tests__/auth.test.ts`

**Contracts:**

**Auth Service Functions:**

```typescript
export async function initAuth(): Promise<AuthUser | null>
export async function login(): Promise<void>
export async function logout(): Promise<void>
export function getAccessToken(): string | null
```

**Auth Context Hook:**

```typescript
interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getToken: () => string | null;
}

export function useAuth(): AuthContextValue
```

**Route Guard Pattern** (example for `/borrower/index.tsx`):

```typescript
export const Route = createFileRoute("/borrower/")({
    beforeLoad: () => {
        const token = getAccessToken();
        if (!token) {
            throw redirect({ to: "/" });
        }
        // Decode token to check role (lightweight check -- real auth is API-side)
        try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const roles: string[] = payload?.realm_access?.roles ?? [];
            if (!roles.includes("borrower")) {
                throw redirect({ to: "/403" });
            }
        } catch {
            throw redirect({ to: "/" });
        }
    },
    component: BorrowerDashboard,
});
```

**Exit condition:**
```bash
cd /home/jary/git/agent-scaffold/packages/ui && pnpm exec tsc --noEmit && pnpm test -- --run
```

---

### Story: S-1-F20-05 -- Empty State Handling

**WU:** WU-8
**Feature:** F20 (Pre-Seeded Demo Data)
**Complexity:** S

#### Acceptance Criteria

**Given** the database is empty (no applications, no loans)
**When** I view the LO pipeline dashboard
**Then** I see an empty state message: "No applications yet. Applications will appear here once borrowers begin the intake process."

**Given** the database is empty
**When** I view the CEO dashboard
**Then** I see charts with zero values and an empty state message: "No data available. Historical data will appear as applications are processed."

**Given** the database is empty
**When** I query the borrower assistant about application status
**Then** the assistant responds: "You do not have any active applications yet. Would you like to start a new application?"

**Given** the database is empty
**When** I view the underwriter queue
**Then** I see an empty state message: "No applications in underwriting. Applications will appear here once loan officers submit them."

**Given** a specific entity is missing (e.g., no documents uploaded for an application)
**When** I view the document list for that application
**Then** I see: "No documents uploaded yet. Upload documents to continue the application process."

**Given** the audit trail has no events for a specific application
**When** I query the audit trail for that application
**Then** I see: "No audit events found for this application."

#### Files

- `packages/ui/src/components/common/empty-state.tsx` -- Reusable empty state component

#### Implementation Prompt

**Role:** @frontend-developer

**Context files:**
- WU-8 Shared Context (above) -- Empty state design pattern

**Requirements:**

Create a reusable empty state component used throughout the UI when no data exists:

1. **EmptyState Component** (`empty-state.tsx`)
   - Props: `{ title: string, description: string, actionLabel?: string, actionHref?: string }`
   - Display:
     - Icon (generic inbox/folder icon from Heroicons or Lucide)
     - Title (e.g., "No applications yet")
     - Description (e.g., "Your mortgage applications will appear here once you begin the intake process.")
     - Optional action button (e.g., "Start Application") that links to `actionHref`
   - Use Tailwind for styling: centered layout, muted colors, clear hierarchy

2. **Usage Pattern**
   - Phase 1 route stubs (borrower/LO/underwriter/CEO) all use this component
   - Later phases: use for empty document lists, empty audit trails, empty analytics charts

**Steps:**

1. Create `packages/ui/src/components/common/empty-state.tsx` with reusable component (see TD chunk for full implementation)
2. Add AI compliance comment at top of file: `// This project was developed with assistance from AI tools.`
3. Use `EmptyState` in all Phase 1 route stubs (borrower/LO/underwriter/CEO)
4. Run TypeScript compiler: `pnpm exec tsc --noEmit` (verify no errors)
5. Write unit test for `EmptyState` component in `packages/ui/src/components/common/__tests__/empty-state.test.tsx`

**Contracts:**

**EmptyState Component Interface:**

```typescript
interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
}

export function EmptyState(props: EmptyStateProps): JSX.Element
```

**Example Usage:**

```typescript
<EmptyState
    title="No applications yet"
    description="Your mortgage applications will appear here once you begin the intake process."
    actionLabel="Start Application"
    actionHref="/borrower/apply"
/>
```

**Exit condition:**
```bash
cd /home/jary/git/agent-scaffold/packages/ui && pnpm exec tsc --noEmit && pnpm test -- --run
```

---

## WU-8 Exit Conditions

All stories in WU-8 must pass the following verification:

1. **TypeScript Compilation:**
   ```bash
   cd /home/jary/git/agent-scaffold/packages/ui && pnpm exec tsc --noEmit
   ```
   Expected: No errors.

2. **Unit Tests:**
   ```bash
   cd /home/jary/git/agent-scaffold/packages/ui && pnpm test -- --run
   ```
   Expected: All tests pass. Minimum tests:
   - `calculator.test.tsx`: Affordability calculator validation
   - `auth.test.ts`: Auth service initialization and role extraction
   - `use-auth.test.ts`: Auth context provider token refresh
   - `empty-state.test.tsx`: EmptyState component rendering

3. **Build Success:**
   ```bash
   cd /home/jary/git/agent-scaffold/packages/ui && pnpm build
   ```
   Expected: Vite build completes without errors, outputs to `dist/`.

4. **Manual Verification (Integration with WU-9):**
   - Start full stack: `make run`
   - Visit `http://localhost:3000/`
   - Verify landing page renders with product cards, calculator, and chat stub
   - Verify affordability calculator computes correct values
   - Log in as demo borrower (`sarah.mitchell`)
   - Verify `/borrower/dashboard` renders with empty state
   - Attempt to navigate to `/loan-officer/pipeline`
   - Verify 403 error page displays

---

## TD Inconsistencies Resolved

**TD-I-05:** Empty state handling references UIs that do not exist in Phase 1. Resolution: WU-8 implements empty states for landing page and Phase 1 route stubs only. Later phases add empty states for their respective UIs.

---

## AI Compliance

All files created in this WU must include the AI assistance comment at the top:

**TypeScript/JavaScript:**
```typescript
// This project was developed with assistance from AI tools.
```

---

*Generated during SDD Phase 11 (Work Breakdown). This is Chunk 4 of 4 for Phase 1.*
