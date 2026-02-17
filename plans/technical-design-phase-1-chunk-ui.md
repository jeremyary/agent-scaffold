# Technical Design Phase 1 -- Chunk: Frontend Scaffolding and Landing Page

**Covers:** WU-8a (Frontend Scaffold + Auth + Route Guards), WU-8b (Public Landing Page + Calculator)
**Features:** F1 (Prospect Landing Page and Affordability Calculator), F2 (Route Guards), F20 (Empty States)

---

## WU-8a / WU-8b: Frontend Scaffolding + Landing Page

### Description

Scaffold the React SPA with TanStack Router, implement Keycloak OIDC integration on the frontend, create role-based route guards, build the public landing page with product information and affordability calculator, and add empty state handling for Phase 1 surfaces.

### Stories Covered

- S-1-F1-01: Prospect accesses product information without login
- S-1-F1-02: Prospect uses affordability calculator
- S-1-F1-03: Prospect initiates prequalification chat (chat widget stub)
- S-1-F2-02: Role-based access to persona UIs (frontend route guard portion)
- S-1-F20-05: Empty state handling in all UIs (Phase 1 surfaces only)

### Data Flow: Public Landing Page (Happy Path)

1. Prospect visits `http://localhost:3000/` (root route)
2. TanStack Router renders the public landing page (no auth check)
3. Landing page displays Summit Cap Financial branding, product cards, affordability calculator
4. Prospect views product information without any authentication prompt
5. No cookies, session tokens, or user tracking are set

### Data Flow: Affordability Calculator

**Happy path:**
1. Prospect opens affordability calculator (tab or section on landing page)
2. Enters: income ($80,000/yr), monthly debts ($500), down payment ($30,000)
3. Client-side Zod validation passes
4. Frontend calls `POST /api/public/calculate-affordability`
5. API computes:
   - `gross_monthly_income = 80000 / 12 = $6,666.67`
   - `max_monthly_housing = 6666.67 * 0.43 - 500 = $2,366.67`
   - `loan_constant` for 6.5% / 30yr = 158.21 per $1000
   - `max_loan = 2366.67 / (6.5 * 158.21 / 12 / 1000) = ~$373,000`
   - `estimated_purchase_price = max_loan + down_payment = ~$403,000`
   - `estimated_monthly_payment = max_loan * rate_factor`
   - `dti_ratio = (monthly_payment + debts) / gross_monthly_income`
6. API returns `AffordabilityResponse`
7. Frontend displays results with formatted currency values
8. If DTI > 43%: warning message displayed
9. If down payment < 3% of purchase price: PMI warning displayed

**Error paths:**
- Invalid input (negative income): Zod validation catches on client, field-level errors shown
- API down: Fetch fails, error boundary shows "Calculator temporarily unavailable"
- API returns validation error (422): Field-level errors extracted and displayed

### Data Flow: Chat Widget Stub

1. Prospect clicks "Chat with us" button
2. Chat widget opens (slide-in panel or overlay)
3. Phase 1: displays "AI assistant coming soon. In the meantime, use our affordability calculator or call us at (303) 555-0100."
4. Phase 2+: widget connects to WebSocket for real-time chat

**Degraded mode (LlamaStack down):**
1. Chat widget checks API health
2. LlamaStack shows "down" in health response
3. Widget displays: "Our chat assistant is temporarily unavailable. Please try again later or call us at (303) 555-0100."

### Data Flow: Authenticated Route Access

**Happy path (correct role):**
1. User with `borrower` role navigates to `/borrower/dashboard`
2. TanStack Router `beforeLoad` hook reads role from stored token
3. Role matches route requirement (`borrower`)
4. Route renders borrower dashboard (placeholder in Phase 1)

**Wrong role:**
1. User with `borrower` role navigates to `/loan-officer/pipeline`
2. `beforeLoad` hook reads role from stored token
3. Role `borrower` does not match route requirement (`loan_officer`)
4. Route redirects to 403 error page: "You do not have access to this page"

**No token:**
1. Unauthenticated user navigates to `/borrower/dashboard`
2. `beforeLoad` hook detects no valid token
3. Redirects to Keycloak login page
4. After login, redirects back to original URL

**Token refresh:**
1. User's access token expires (< 1 minute remaining)
2. TanStack Query `onError` interceptor detects 401
3. Frontend sends refresh token to Keycloak
4. New access token received, original request retried
5. If refresh fails: user redirected to login

### File Manifest

```
# Core app structure
packages/ui/src/main.tsx                           # React entry point
packages/ui/src/app.tsx                            # TanStack Router provider
packages/ui/src/router.tsx                         # Router configuration
packages/ui/src/vite-env.d.ts                      # Vite type declarations

# Auth (keycloak-js manages token storage/refresh internally via sessionStorage)
packages/ui/src/services/auth.ts                   # Keycloak OIDC integration
packages/ui/src/hooks/use-auth.ts                  # Auth context hook
packages/ui/src/components/auth-provider.tsx        # Auth context provider

# API client
packages/ui/src/services/types.ts                  # TypeScript interfaces (from hub)
packages/ui/src/services/api-client.ts             # API client functions (from hub)

# Routes
packages/ui/src/routes/__root.tsx                  # Root layout with auth provider
packages/ui/src/routes/index.tsx                   # Public landing page
packages/ui/src/routes/products.tsx                # Product information page
packages/ui/src/routes/borrower/index.tsx          # Borrower dashboard (placeholder)
packages/ui/src/routes/loan-officer/index.tsx      # LO pipeline (placeholder)
packages/ui/src/routes/underwriter/index.tsx       # Underwriter queue (placeholder)
packages/ui/src/routes/ceo/index.tsx               # CEO dashboard (placeholder)

# Components
packages/ui/src/components/ui/button.tsx           # shadcn/ui button
packages/ui/src/components/ui/card.tsx             # shadcn/ui card
packages/ui/src/components/ui/input.tsx            # shadcn/ui input
packages/ui/src/components/ui/label.tsx            # shadcn/ui label
packages/ui/src/components/layout/header.tsx        # App header with nav/auth
packages/ui/src/components/layout/footer.tsx        # App footer
packages/ui/src/components/landing/hero.tsx         # Landing page hero section
packages/ui/src/components/landing/product-cards.tsx # Mortgage product cards
packages/ui/src/components/landing/calculator.tsx   # Affordability calculator form
packages/ui/src/components/landing/calculator-result.tsx  # Calculator results display
packages/ui/src/components/landing/chat-widget-stub.tsx   # Chat widget placeholder
packages/ui/src/components/common/error-page.tsx    # 403/404 error page
packages/ui/src/components/common/empty-state.tsx   # Reusable empty state component

# Validation schemas
packages/ui/src/schemas/calculator.ts               # Zod schema for affordability input

# Keycloak SSO
packages/ui/public/silent-check-sso.html            # Standard Keycloak silent SSO check page -- minimal HTML that posts auth result back to parent frame

# Styles
packages/ui/src/styles/globals.css                  # Tailwind base + custom styles

# Tests
packages/ui/src/components/landing/__tests__/calculator.test.tsx
packages/ui/src/services/__tests__/auth.test.ts
packages/ui/src/hooks/__tests__/use-auth.test.ts
```

### Key File Contents

**packages/ui/src/services/auth.ts:**
```typescript
// This project was developed with assistance from AI tools.
// Keycloak OIDC integration using keycloak-js adapter.
//
// keycloak-js uses sessionStorage for tab-scoped token persistence.
// Tokens survive page refresh but are cleared on tab close.
// We do NOT extract or store raw tokens in React state -- keycloak-js
// manages its own token lifecycle and storage internally.

import Keycloak from "keycloak-js";
import type { AuthUser, UserRole } from "./types";

const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL ?? "http://localhost:8080",
    realm: "summit-cap",
    clientId: "summit-cap-ui",
};

let keycloakInstance: Keycloak | null = null;

export function getKeycloak(): Keycloak {
    if (!keycloakInstance) {
        keycloakInstance = new Keycloak(keycloakConfig);
    }
    return keycloakInstance;
}

export async function initAuth(): Promise<AuthUser | null> {
    const kc = getKeycloak();
    try {
        const authenticated = await kc.init({
            onLoad: "check-sso",
            pkceMethod: "S256",
            silentCheckSsoRedirectUri:
                window.location.origin + "/silent-check-sso.html",
        });

        if (!authenticated || !kc.tokenParsed) {
            return null;
        }

        return extractUser(kc);
    } catch (error) {
        console.error("Keycloak init failed:", error);
        return null;
    }
}

export async function login(): Promise<void> {
    const kc = getKeycloak();
    await kc.login({ redirectUri: window.location.href });
}

export async function logout(): Promise<void> {
    const kc = getKeycloak();
    await kc.logout({ redirectUri: window.location.origin });
}

export function getAccessToken(): string | null {
    // Returns the current token directly from the keycloak-js instance.
    // keycloak-js manages token storage via sessionStorage internally.
    const kc = getKeycloak();
    return kc.token ?? null;
}

function extractUser(kc: Keycloak): AuthUser {
    // Returns only user metadata (id, email, name, role) -- NOT tokens.
    // Token access is via getAccessToken() which reads from keycloak-js directly.
    const parsed = kc.tokenParsed as Record<string, unknown> | undefined;
    const realmAccess = parsed?.realm_access as { roles: string[] } | undefined;
    const roles = realmAccess?.roles ?? [];

    // Extract first matching application role
    const appRoles: UserRole[] = [
        "borrower",
        "loan_officer",
        "underwriter",
        "ceo",
    ];
    const role = (appRoles.find((r) => roles.includes(r)) ??
        "prospect") as UserRole;

    return {
        id: parsed?.sub as string,
        email: parsed?.email as string,
        name: parsed?.name as string,
        role,
    };
}
```

**packages/ui/src/hooks/use-auth.ts:**
```typescript
// This project was developed with assistance from AI tools.

import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import type { AuthUser } from "../services/types";
import { getAccessToken, getKeycloak, initAuth, login, logout } from "../services/auth";

interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        initAuth().then((u) => {
            setUser(u);
            setIsLoading(false);
        });

        // Use keycloak-js built-in token expiry callback instead of polling.
        // This avoids the stale-closure problem that setInterval would have
        // (interval captures `user` at its initial null value with [] deps).
        const kc = getKeycloak();
        kc.onTokenExpired = () => {
            kc.updateToken(30).catch(() => {
                setUser(null);
            });
        };

        return () => {
            kc.onTokenExpired = undefined;
        };
    }, []);

    const value: AuthContextValue = {
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        getToken: getAccessToken,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
```

**packages/ui/src/routes/__root.tsx:**
```typescript
// This project was developed with assistance from AI tools.

import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AuthProvider } from "../hooks/use-auth";
import { Header } from "../components/layout/header";
import { Footer } from "../components/layout/footer";

export const Route = createRootRoute({
    component: RootLayout,
});

function RootLayout() {
    return (
        <AuthProvider>
            <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">
                    <Outlet />
                </main>
                <Footer />
            </div>
        </AuthProvider>
    );
}
```

**packages/ui/src/routes/index.tsx** (Public Landing Page):
```typescript
// This project was developed with assistance from AI tools.

import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "../components/landing/hero";
import { ProductCards } from "../components/landing/product-cards";
import { Calculator } from "../components/landing/calculator";
import { ChatWidgetStub } from "../components/landing/chat-widget-stub";

export const Route = createFileRoute("/")({
    component: LandingPage,
});

function LandingPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <Hero />
            <ProductCards />
            <Calculator />
            <ChatWidgetStub />
        </div>
    );
}
```

**Route guard pattern for protected routes:**
```typescript
// packages/ui/src/routes/borrower/index.tsx
// This project was developed with assistance from AI tools.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessToken } from "../../services/auth";
import { EmptyState } from "../../components/common/empty-state";

export const Route = createFileRoute("/borrower/")({
    beforeLoad: () => {
        const token = getAccessToken();
        if (!token) {
            // Redirect to Keycloak login
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

function BorrowerDashboard() {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-4">Borrower Dashboard</h1>
            <EmptyState
                title="No applications yet"
                description="Your mortgage applications will appear here once you begin the intake process."
                actionLabel="Start Application"
                actionHref="/borrower/apply"
            />
        </div>
    );
}
```

**packages/ui/src/schemas/calculator.ts:**
```typescript
// This project was developed with assistance from AI tools.

import { z } from "zod";

export const affordabilitySchema = z.object({
    gross_annual_income: z
        .number({ required_error: "Income is required" })
        .positive("Income must be positive"),
    monthly_debts: z
        .number({ required_error: "Monthly debts is required" })
        .min(0, "Monthly debts cannot be negative"),
    down_payment: z
        .number({ required_error: "Down payment is required" })
        .min(0, "Down payment cannot be negative"),
    interest_rate: z
        .number()
        .min(0, "Interest rate cannot be negative")
        .max(15, "Interest rate seems too high")
        .optional()
        .default(6.5),
    loan_term_years: z
        .number()
        .int()
        .min(10)
        .max(40)
        .optional()
        .default(30),
});

export type AffordabilityFormValues = z.infer<typeof affordabilitySchema>;
```

**packages/ui/src/components/landing/calculator.tsx:**
```typescript
// This project was developed with assistance from AI tools.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { affordabilitySchema, type AffordabilityFormValues } from "../../schemas/calculator";
import { calculateAffordability } from "../../services/api-client";
import type { AffordabilityResponse } from "../../services/types";
import { CalculatorResult } from "./calculator-result";

export function Calculator() {
    const [result, setResult] = useState<AffordabilityResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<AffordabilityFormValues>({
        resolver: zodResolver(affordabilitySchema),
        defaultValues: {
            interest_rate: 6.5,
            loan_term_years: 30,
        },
    });

    const onSubmit = async (data: AffordabilityFormValues) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await calculateAffordability(data);
            setResult(response);
        } catch (err) {
            setError("Calculator temporarily unavailable. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section id="calculator" className="py-12">
            <h2 className="text-xl font-semibold mb-6">Affordability Calculator</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label htmlFor="income" className="block text-sm font-medium mb-1">
                            Annual Gross Income ($)
                        </label>
                        <input
                            id="income"
                            type="number"
                            step="1000"
                            className="w-full rounded border px-3 py-2"
                            {...register("gross_annual_income", { valueAsNumber: true })}
                        />
                        {errors.gross_annual_income && (
                            <p className="text-sm text-red-600 mt-1">
                                {errors.gross_annual_income.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="debts" className="block text-sm font-medium mb-1">
                            Monthly Debts ($)
                        </label>
                        <input
                            id="debts"
                            type="number"
                            step="50"
                            className="w-full rounded border px-3 py-2"
                            {...register("monthly_debts", { valueAsNumber: true })}
                        />
                        {errors.monthly_debts && (
                            <p className="text-sm text-red-600 mt-1">
                                {errors.monthly_debts.message}
                            </p>
                        )}
                    </div>
                    <div>
                        <label htmlFor="down" className="block text-sm font-medium mb-1">
                            Down Payment ($)
                        </label>
                        <input
                            id="down"
                            type="number"
                            step="1000"
                            className="w-full rounded border px-3 py-2"
                            {...register("down_payment", { valueAsNumber: true })}
                        />
                        {errors.down_payment && (
                            <p className="text-sm text-red-600 mt-1">
                                {errors.down_payment.message}
                            </p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? "Calculating..." : "Calculate Affordability"}
                    </button>
                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </form>
                <div>
                    {result && <CalculatorResult result={result} />}
                </div>
            </div>
        </section>
    );
}
```

**packages/ui/src/components/common/empty-state.tsx:**
```typescript
// This project was developed with assistance from AI tools.

interface EmptyStateProps {
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
}

export function EmptyState({
    title,
    description,
    actionLabel,
    actionHref,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
                <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
            {actionLabel && actionHref && (
                <a
                    href={actionHref}
                    className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                    {actionLabel}
                </a>
            )}
        </div>
    );
}
```

**packages/api/src/summit_cap/routes/public.py** (Backend for landing page):
```python
# This project was developed with assistance from AI tools.
"""Public routes -- no authentication required."""

import math

from fastapi import APIRouter

from summit_cap.schemas.calculator import AffordabilityRequest, AffordabilityResponse

router = APIRouter()

# Static product data for Summit Cap Financial
PRODUCTS = [
    {
        "id": "30yr-fixed",
        "name": "30-Year Fixed-Rate",
        "description": "The most popular mortgage option with a fixed interest rate for the full 30-year term.",
        "min_down_payment_pct": 3,
        "typical_rate": 6.5,
    },
    {
        "id": "15yr-fixed",
        "name": "15-Year Fixed-Rate",
        "description": "Build equity faster with a shorter term and typically lower interest rate.",
        "min_down_payment_pct": 3,
        "typical_rate": 5.75,
    },
    {
        "id": "arm",
        "name": "Adjustable-Rate (ARM)",
        "description": "Lower initial rate that adjusts periodically after an introductory period.",
        "min_down_payment_pct": 5,
        "typical_rate": 5.5,
    },
    {
        "id": "jumbo",
        "name": "Jumbo Loan",
        "description": "For loan amounts exceeding conventional conforming limits.",
        "min_down_payment_pct": 10,
        "typical_rate": 6.75,
    },
    {
        "id": "fha",
        "name": "FHA Loan",
        "description": "Government-backed loan with flexible qualification requirements.",
        "min_down_payment_pct": 3.5,
        "typical_rate": 6.25,
    },
    {
        "id": "va",
        "name": "VA Loan",
        "description": "Available to eligible veterans and active-duty military with no down payment required.",
        "min_down_payment_pct": 0,
        "typical_rate": 6.0,
    },
]


@router.get("/products")
async def get_products() -> list[dict]:
    """Return mortgage product information. No authentication required."""
    return PRODUCTS


@router.post("/calculate-affordability", response_model=AffordabilityResponse)
async def calculate_affordability(request: AffordabilityRequest) -> AffordabilityResponse:
    """Calculate estimated borrowing capacity.

    Formula: max_monthly_housing = gross_monthly_income * 0.43 - monthly_debts
    Then: max_loan = max_monthly_housing / monthly_payment_per_dollar_borrowed
    """
    gross_monthly_income = request.gross_annual_income / 12
    max_monthly_housing = gross_monthly_income * 0.43 - request.monthly_debts

    if max_monthly_housing <= 0:
        return AffordabilityResponse(
            max_loan_amount=0,
            estimated_monthly_payment=0,
            estimated_purchase_price=request.down_payment,
            dti_ratio=100.0,
            dti_warning="Your debt-to-income ratio exceeds 43%. "
                        "You may need to reduce debts or increase income to qualify.",
            pmi_warning=None,
        )

    # Monthly payment factor: r(1+r)^n / ((1+r)^n - 1)
    # where r = monthly rate, n = total months
    monthly_rate = request.interest_rate / 100 / 12
    num_payments = request.loan_term_years * 12

    if monthly_rate > 0:
        payment_factor = (
            monthly_rate * math.pow(1 + monthly_rate, num_payments)
        ) / (math.pow(1 + monthly_rate, num_payments) - 1)
    else:
        payment_factor = 1 / num_payments

    max_loan = max_monthly_housing / payment_factor
    estimated_monthly_payment = max_loan * payment_factor
    estimated_purchase_price = max_loan + request.down_payment
    dti_ratio = (estimated_monthly_payment + request.monthly_debts) / gross_monthly_income * 100

    # Warnings
    dti_warning = None
    if dti_ratio > 43:
        dti_warning = (
            f"Your estimated DTI of {dti_ratio:.1f}% exceeds the conventional "
            "lending guideline of 43%. You may qualify for certain programs."
        )

    pmi_warning = None
    if estimated_purchase_price > 0 and request.down_payment < estimated_purchase_price * 0.03:
        pmi_warning = (
            "Your down payment is less than 3% of the estimated purchase price. "
            "Private Mortgage Insurance (PMI) may be required."
        )

    return AffordabilityResponse(
        max_loan_amount=round(max_loan, 2),
        estimated_monthly_payment=round(estimated_monthly_payment, 2),
        estimated_purchase_price=round(estimated_purchase_price, 2),
        dti_ratio=round(dti_ratio, 2),
        dti_warning=dti_warning,
        pmi_warning=pmi_warning,
    )
```

### Exit Conditions

```bash
# TypeScript compiles without errors
cd packages/ui && pnpm exec tsc --noEmit

# Frontend tests pass
cd packages/ui && pnpm test -- --run

# Affordability calculator API test
cd packages/api && uv run pytest tests/test_public.py -v

# Landing page renders (manual check via browser, or:)
cd packages/ui && pnpm build  # Build succeeds

# Specific test scenarios
cd packages/api && uv run pytest tests/test_public.py::test_affordability_happy_path -v
cd packages/api && uv run pytest tests/test_public.py::test_affordability_high_dti_warning -v
cd packages/api && uv run pytest tests/test_public.py::test_affordability_low_down_payment_warning -v
cd packages/api && uv run pytest tests/test_public.py::test_affordability_invalid_income -v
cd packages/api && uv run pytest tests/test_public.py::test_products_returns_six_products -v
```

---

*This chunk is part of the Phase 1 Technical Design. See `plans/technical-design-phase-1.md` for the hub document with all binding contracts and the dependency graph.*
