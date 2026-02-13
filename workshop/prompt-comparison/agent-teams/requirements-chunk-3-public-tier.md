<!-- This project was developed with assistance from AI tools. -->

# Requirements Chunk 3: Public Tier (Intake Chat, Mortgage Calculator, Market Data)

This document expands the Pass 1 skeleton stories for the public tier features (CHAT-01 through CHAT-07, CALC-01 through CALC-08, MARKET-01 through MARKET-02) into detailed Given/When/Then acceptance criteria.

**Phase:** 3b (Public Access and Intake)
**Priority:** P1 (Should Have)
**Auth Tier:** Public (no authentication required)
**Rate Limits:** 20 req/min per IP for CHAT endpoints (LLM-invoking), 60 req/min per IP for CALC and MARKET endpoints

---

## Intake Chat (CHAT)

### CHAT-01: Create and Use Chat Session

**As a** borrower, **I want** to chat with an AI agent about mortgage questions without logging in, **so that** I can learn about the mortgage process.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Session creation**
- **Given** a borrower visits the chat interface
- **When** they send their first message via `POST /v1/chat/sessions`
- **Then** the system creates a new chat session with a unique session ID, returns the session ID in the response, and stores session metadata in Redis with a 24-hour TTL

**AC-2: Message exchange within session**
- **Given** a borrower has an active chat session
- **When** they send a message via `POST /v1/chat/sessions/:id/messages` with a text body
- **Then** the intake agent processes the message and returns a response, and both the user message and agent response are recorded in the session history

**AC-3: No authentication required**
- **Given** a borrower accesses any chat endpoint (`/v1/chat/*`)
- **When** the request does not include an `Authorization` header
- **Then** the request is accepted and processed normally (no 401 response)

**AC-4: Invalid session ID**
- **Given** a borrower sends a message to a non-existent session ID
- **When** the `POST /v1/chat/sessions/:id/messages` request is processed
- **Then** the system returns 404 with an RFC 7807 error body including `"title": "Not Found"` and a detail message indicating the session does not exist

**AC-5: Rate limiting on chat endpoints**
- **Given** a single IP address has sent 20 requests within the current 1-minute window to chat endpoints
- **When** the IP sends another request to any `/v1/chat/*` endpoint
- **Then** the system returns 429 with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers, and an RFC 7807 error body

#### Notes
- Chat rate limit is 20 req/min per IP (more restrictive than CALC/MARKET because each request invokes an LLM)
- Session metadata stored in Redis; conversation history stored in the intake graph state (PostgreSQL `langgraph` schema or `intake_conversations`/`intake_messages` tables)
- The intake agent runs on a separate LangGraph graph with no access to loan application data or authenticated endpoints (see CHAT-07 notes on isolation)

---

### CHAT-02: Plain Language Responses

**As a** borrower, **I want** the intake agent to answer questions in plain language suitable for someone with limited mortgage knowledge, **so that** I can understand complex concepts.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Plain language explanation of mortgage concepts**
- **Given** a borrower asks "What is DTI?" or a similar question about a mortgage concept
- **When** the intake agent generates a response
- **Then** the response explains the concept in plain language without jargon, includes a practical example where appropriate, and avoids assuming prior financial knowledge

**AC-2: Follow-up clarification**
- **Given** a borrower has received an explanation and asks a follow-up question such as "Can you explain that more simply?"
- **When** the intake agent generates a response
- **Then** the agent rephrases the explanation using simpler terms and shorter sentences, maintaining accuracy while improving accessibility

**AC-3: Conversation context maintained within session**
- **Given** a borrower has asked multiple questions in the same session
- **When** they reference a prior topic (e.g., "What about the DTI thing you mentioned?")
- **Then** the agent uses the session conversation history to provide a contextually appropriate response without requiring the borrower to repeat information

#### Notes
- The plain language requirement is enforced via the intake agent's system prompt, not via post-processing
- Cross-references: CHAT-03 (source citations), CHAT-06 (calculator tool use for practical examples)

---

### CHAT-03: Source Citations for Regulatory Guidance

**As a** borrower, **I want** the intake agent to provide source citations when referencing regulatory guidance, **so that** I can trust the information.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Citation included with regulatory information**
- **Given** the borrower asks a question about a regulatory topic (e.g., "What are the fair lending rules?")
- **When** the intake agent retrieves information from the knowledge base via `knowledge_base_search`
- **Then** the response includes a citation referencing the source document title and relevant section, formatted in a way that is readable but clearly distinguishable from the conversational text

**AC-2: No citation fabrication**
- **Given** the intake agent is asked a question for which no relevant knowledge base document exists
- **When** the agent generates a response based on general knowledge
- **Then** the response does not include fabricated citations and instead indicates the information is general guidance, not sourced from a specific regulation

**AC-3: Multiple citations when applicable**
- **Given** the borrower asks a question that spans multiple regulatory topics
- **When** the intake agent retrieves information from multiple knowledge base documents
- **Then** the response includes citations for each source document referenced, keeping them clearly associated with the relevant portion of the response

#### Notes
- Citations are sourced from the `rag.knowledge_documents` metadata (title, source URL, section) via the `knowledge_base_search` tool
- The knowledge base must be seeded with regulatory documents before this feature is testable (dependency on Phase 3a RAG infrastructure)

---

### CHAT-04: Market Data Retrieval in Chat

**As a** borrower, **I want** the intake agent to retrieve current mortgage rates and economic indicators when I ask about market conditions, **so that** I get up-to-date information.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Current rate retrieval via tool**
- **Given** the borrower asks "What are current mortgage rates?" or a similar question
- **When** the intake agent invokes the `fred_api_lookup` tool
- **Then** the response includes current rate data (e.g., 30-year fixed, 15-year fixed, Treasury yields) with a date indicating when the data was last updated, presented in plain language with context about what the rates mean

**AC-2: Cached data served when available**
- **Given** FRED API data has been cached in Redis within the last hour
- **When** the intake agent invokes `fred_api_lookup`
- **Then** the cached data is returned without making a new FRED API call, and the response still includes the data freshness timestamp

**AC-3: FRED API unavailable**
- **Given** the FRED API is unreachable and the Redis cache has expired (no cached data available)
- **When** the intake agent invokes `fred_api_lookup`
- **Then** the agent informs the borrower that current rate data is temporarily unavailable and suggests checking back later, rather than providing potentially stale or fabricated rates

**AC-4: FRED API unavailable with stale cache**
- **Given** the FRED API is unreachable but stale cached data exists (older than 1-hour TTL)
- **When** the intake agent invokes `fred_api_lookup`
- **Then** the agent may serve the stale data with a clear disclaimer indicating the data age, or indicate that current data is unavailable (implementation decides the stale-serve policy)

#### Notes
- FRED API series used: DGS10 (10-Year Treasury), CSUSHPISA (Case-Shiller Home Price Index), and mortgage rate series
- Cache TTL: 1 hour in Redis (key pattern: `fred:<series_id>`)
- Cross-references: MARKET-01, MARKET-02 for the standalone market data endpoints

---

### CHAT-05: Property Data Lookup in Chat

**As a** borrower, **I want** the intake agent to look up property information when I ask about a specific address, **so that** I can understand property values and comparable sales.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Property data retrieval via tool**
- **Given** the borrower provides a property address (e.g., "What is 123 Main St, Springfield worth?")
- **When** the intake agent invokes the `property_data_lookup` tool with the address
- **Then** the response includes the property's estimated value, and if available, comparable sales data, presented in plain language

**AC-2: Property not found**
- **Given** the borrower provides an address that the property data service does not have data for
- **When** the `property_data_lookup` tool returns no results
- **Then** the agent informs the borrower that property data is not available for that address and suggests alternative approaches (e.g., contacting a local appraiser or real estate agent)

**AC-3: Mocked data behavior**
- **Given** the property data provider is configured as "mock" (default)
- **When** the intake agent invokes `property_data_lookup`
- **Then** the tool returns realistic fixture data from the mock implementation with the same response structure as the real BatchData API

#### Notes
- Property data is mocked by default (BatchData interface). Real API key can be configured via `BATCHDATA_API_KEY` environment variable
- Property data responses are cached in Redis with a 24-hour TTL (key pattern: `property:<address_hash>`)
- The property data service follows the `PropertyDataService` Protocol contract

---

### CHAT-06: Mortgage Calculator Tool Use in Chat

**As a** borrower, **I want** the intake agent to invoke the mortgage calculator within the conversation to show me payment scenarios, **so that** I can explore affordability.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Calculator invocation from natural language**
- **Given** the borrower asks "What would my monthly payment be on a $300,000 loan at 6.5% for 30 years?"
- **When** the intake agent parses the request and invokes the `mortgage_calculator` tool with the extracted parameters
- **Then** the response includes the calculated monthly payment (PITI breakdown), formatted in plain language with context about what each component represents

**AC-2: Affordability estimation in conversation**
- **Given** the borrower says "I make $75,000 a year and have $500 in monthly debts. How much house can I afford?"
- **When** the intake agent invokes the `mortgage_calculator` tool with an affordability calculation
- **Then** the response includes an estimated home price range, estimated monthly payment, and DTI ratio context, all in plain language

**AC-3: Multiple scenarios comparison**
- **Given** the borrower asks to compare scenarios (e.g., "Compare a 15-year vs 30-year loan on $250,000")
- **When** the intake agent invokes the `mortgage_calculator` tool for each scenario
- **Then** the response presents the comparison side by side with differences highlighted (monthly payment, total interest, total cost)

**AC-4: Legal disclaimer included**
- **Given** the intake agent has invoked the `mortgage_calculator` tool and received results
- **When** presenting the calculator output in the conversation
- **Then** the response includes a legal disclaimer indicating that the calculations are estimates only and do not constitute a loan offer or commitment

**AC-5: Missing parameters**
- **Given** the borrower asks for a payment calculation but provides incomplete information (e.g., "What's my payment on a $300,000 loan?")
- **When** the intake agent identifies missing required parameters (interest rate, loan term)
- **Then** the agent asks the borrower for the missing information rather than assuming default values

#### Notes
- The `mortgage_calculator` tool calls the pure computation engine directly (no LLM involved in the calculation itself). The LLM only translates between natural language and calculator inputs/outputs
- All calculator computations use `Decimal` types internally; results are string decimal serialized
- Cross-references: CALC-01 through CALC-08 for the standalone calculator API endpoints, CALC-07 for legal disclaimer requirement

---

### CHAT-07: Streaming Chat Responses (SSE)

**As a** borrower, **I want** chat responses to stream incrementally rather than waiting for a complete response, **so that** the conversation feels responsive.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: SSE streaming on message send**
- **Given** a borrower sends a message via `POST /v1/chat/sessions/:id/messages` with the `Accept: text/event-stream` header
- **When** the intake agent begins generating a response
- **Then** the response is delivered as a Server-Sent Events stream with `Content-Type: text/event-stream`, where each SSE event contains a token or small chunk of the response text

**AC-2: Stream event format**
- **Given** an SSE stream is established for a chat response
- **When** the intake agent produces response tokens
- **Then** each SSE event includes a `data` field with the incremental text content, and the stream includes a final event indicating completion (e.g., `event: done` or `data: [DONE]`)

**AC-3: Tool call events in stream**
- **Given** the intake agent invokes a tool (e.g., `mortgage_calculator`, `fred_api_lookup`) during response generation
- **When** the tool call occurs mid-stream
- **Then** the stream emits a tool-call event indicating which tool is being called (e.g., `event: tool_call` with `data` containing the tool name), followed by the tool result integrated into the response text stream

**AC-4: Stream error handling**
- **Given** the LLM API becomes unavailable mid-stream
- **When** the intake agent cannot continue generating the response
- **Then** the SSE stream emits an error event (e.g., `event: error` with `data` containing a user-friendly error message) and closes the connection, rather than hanging indefinitely

**AC-5: Non-streaming fallback**
- **Given** a borrower sends a message without the `Accept: text/event-stream` header
- **When** the message is processed
- **Then** the response is returned as a standard JSON response with the complete agent reply, not as an SSE stream

**AC-6: Session expiry during stream**
- **Given** a chat session has reached its 24-hour TTL
- **When** the borrower attempts to send a new message
- **Then** the system returns 410 Gone (or 404) with an RFC 7807 error indicating the session has expired, and the borrower must start a new session

#### Notes
- SSE streaming uses POST (not GET), which is non-standard. The frontend uses `fetch` with `ReadableStream`, not the native `EventSource` API (which supports GET only). This is documented in the architecture.
- Chat session TTL is 24 hours absolute from creation, stored in Redis
- The intake agent is sandboxed: it has NO access to loan application data, authenticated endpoints, or the `public` schema. Its tool set is limited to `mortgage_calculator`, `fred_api_lookup`, `property_data_lookup`, and `knowledge_base_search`
- Cross-references: architecture "Intake Graph" section for isolation boundaries

---

## Mortgage Calculator (CALC)

### CALC-01: Monthly Payment Calculation

**As a** borrower, **I want** to calculate monthly mortgage payments (principal, interest, taxes, insurance) given loan amount, interest rate, term, property taxes, and insurance, **so that** I can estimate costs.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: PITI calculation with all inputs**
- **Given** a borrower provides loan amount, interest rate, loan term (years or months), annual property taxes, and annual insurance premium
- **When** they submit `POST /v1/calculator/monthly-payment` with these parameters
- **Then** the response includes a breakdown of monthly principal and interest (P&I), monthly property taxes, monthly insurance, and total monthly payment (PITI), all serialized as string decimals (e.g., `"monthlyPayment": "1842.50"`)

**AC-2: Minimum required inputs**
- **Given** a borrower provides only loan amount, interest rate, and loan term (no taxes or insurance)
- **When** they submit the request
- **Then** the response includes the principal and interest (P&I) calculation, with taxes and insurance fields set to `"0.00"`, and the total reflects P&I only

**AC-3: Input validation -- positive numbers**
- **Given** a borrower provides a loan amount of 0, a negative interest rate, or a loan term of 0
- **When** they submit the request
- **Then** the system returns 422 with an RFC 7807 error body detailing which fields have invalid values and what the valid ranges are

**AC-4: Input validation -- reasonable ranges**
- **Given** a borrower provides an interest rate above 30% or a loan term exceeding 50 years
- **When** they submit the request
- **Then** the system returns 422 with an RFC 7807 error body indicating the values are outside acceptable ranges

**AC-5: No authentication required**
- **Given** a request to `POST /v1/calculator/monthly-payment` without an `Authorization` header
- **When** the request is processed
- **Then** it is accepted and returns results normally

**AC-6: Rate limiting**
- **Given** a single IP has sent 60 requests within the current 1-minute window to calculator endpoints
- **When** the IP sends another request
- **Then** the system returns 429 with rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

#### Notes
- Stateless POST endpoint, no database access
- All calculations use `Decimal` types internally to avoid floating-point precision errors
- Response values are string decimals, not floats or integers
- Cross-references: CALC-07 (legal disclaimers on all outputs)

---

### CALC-02: Total Interest Over Loan Life

**As a** borrower, **I want** to see total interest paid over the life of the loan, **so that** I understand the long-term cost.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Total interest included in payment response**
- **Given** a borrower submits a monthly payment calculation via `POST /v1/calculator/monthly-payment`
- **When** the calculation completes
- **Then** the response includes `totalInterest` (string decimal) representing the total interest paid over the full loan term, alongside the monthly payment breakdown

**AC-2: Total cost included**
- **Given** a borrower submits a monthly payment calculation
- **When** the calculation completes
- **Then** the response also includes `totalCost` (string decimal) representing the sum of all payments (principal + interest) over the loan term

**AC-3: Decimal precision**
- **Given** a loan amount of `"250000.00"` at `"6.875"` percent for 30 years
- **When** the total interest is calculated
- **Then** the result is computed using `Decimal` arithmetic and serialized as a string decimal with two decimal places (e.g., `"341230.47"`), not a floating-point approximation

#### Notes
- Total interest is derived from the amortization computation: sum of all interest payments across all periods
- This information is included in the `POST /v1/calculator/monthly-payment` response, not a separate endpoint
- Cross-references: CALC-06 (amortization schedule for period-by-period breakdown)

---

### CALC-03: DTI Ratio Preview

**As a** borrower, **I want** to preview my DTI ratio given my income and debts, **so that** I can see if I'm likely to qualify.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: DTI calculation**
- **Given** a borrower provides annual gross income, existing monthly debt obligations, and the estimated new monthly mortgage payment (or loan parameters to calculate it)
- **When** they submit a DTI preview request
- **Then** the response includes the front-end DTI ratio (housing expense / gross monthly income), the back-end DTI ratio (total debts including housing / gross monthly income), and both are serialized as string decimal percentages (e.g., `"dtiRatio": "43.50"`)

**AC-2: Qualification context**
- **Given** a DTI ratio is calculated
- **When** the response is returned
- **Then** it includes a plain-language indication of how the DTI compares to common qualification thresholds (e.g., "Your back-end DTI of 43.5% is at the typical maximum threshold of 43% for conventional loans"), without making a definitive qualification determination

**AC-3: Input validation -- income must be positive**
- **Given** a borrower provides zero or negative income
- **When** the request is submitted
- **Then** the system returns 422 with an RFC 7807 error body indicating income must be a positive value

**AC-4: Input validation -- debts must be non-negative**
- **Given** a borrower provides negative monthly debts
- **When** the request is submitted
- **Then** the system returns 422 with an RFC 7807 error body indicating debts must be zero or positive

#### Notes
- DTI preview may be computed as part of the monthly-payment or affordability endpoint rather than a standalone endpoint -- the requirements define the behavior, not the endpoint structure
- All ratios use `Decimal` arithmetic internally, string decimal serialization in responses
- Cross-references: CALC-01 (monthly payment inputs can feed DTI), CALC-04 (affordability uses DTI)

---

### CALC-04: Affordability Estimation

**As a** borrower, **I want** to estimate how much home I can afford given my income, debts, and down payment, **so that** I can set realistic expectations.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Affordability estimate calculation**
- **Given** a borrower provides annual gross income, existing monthly debt obligations, available down payment, estimated interest rate, and desired loan term
- **When** they submit `POST /v1/calculator/affordability`
- **Then** the response includes: estimated maximum home price (string decimal), estimated maximum loan amount (string decimal), estimated monthly payment at that price (PITI breakdown), and the resulting DTI ratio

**AC-2: Default assumptions when optional inputs are omitted**
- **Given** a borrower provides income and debts but omits interest rate or loan term
- **When** the request is processed
- **Then** the system uses reasonable defaults (e.g., current average 30-year rate from market data if available, or a stated default rate) and clearly indicates which values were assumed in the response

**AC-3: Down payment impact**
- **Given** a borrower provides a down payment amount
- **When** the affordability is calculated
- **Then** the estimated home price accounts for the down payment (home price = loan amount + down payment), and the response includes the implied LTV ratio

**AC-4: Input validation**
- **Given** a borrower provides invalid inputs (negative income, negative down payment)
- **When** the request is submitted
- **Then** the system returns 422 with field-level validation errors

#### Notes
- Affordability is typically computed by working backward from the maximum acceptable DTI ratio to the maximum loan amount
- Stateless POST endpoint, no authentication required
- Cross-references: CALC-03 (DTI ratio), CALC-01 (monthly payment), CALC-07 (legal disclaimer)

---

### CALC-05: Side-by-Side Scenario Comparison

**As a** borrower, **I want** to compare multiple scenarios side by side (different loan amounts, down payments, rates), **so that** I can explore options.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Multi-scenario comparison**
- **Given** a borrower provides two or more sets of loan parameters (e.g., scenario A: $300,000 at 6.5% for 30 years, scenario B: $300,000 at 6.0% for 15 years)
- **When** they submit the scenarios to the calculator
- **Then** the response includes the full calculation results for each scenario (monthly payment, total interest, total cost, DTI if income provided), with each scenario labeled and clearly distinguishable

**AC-2: Comparison limits**
- **Given** a borrower submits more than a reasonable number of scenarios (e.g., more than 10)
- **When** the request is processed
- **Then** the system returns 422 with an error indicating the maximum number of scenarios allowed

**AC-3: Partial validation**
- **Given** a borrower submits multiple scenarios where some have valid inputs and some have invalid inputs
- **When** the request is processed
- **Then** the system returns 422 with validation errors identifying which specific scenarios have invalid inputs, rather than rejecting the entire request with a generic error

#### Notes
- Comparison may be implemented as a batch endpoint that accepts an array of scenario inputs, or as a client-side composition of individual calculator calls -- the requirement defines the capability, not the API structure
- All calculations use `Decimal` types internally
- Cross-references: CALC-01 (each scenario uses the same monthly payment calculation)

---

### CALC-06: Amortization Schedule

**As a** borrower, **I want** to see an amortization schedule showing principal and interest breakdown over the loan life, **so that** I can understand payment structure.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Full amortization schedule**
- **Given** a borrower provides loan amount, interest rate, and loan term
- **When** they submit `POST /v1/calculator/amortization`
- **Then** the response includes a period-by-period schedule where each period contains: period number, monthly payment amount, principal portion, interest portion, and remaining balance, all as string decimals

**AC-2: Schedule completeness**
- **Given** a 30-year loan (360 months)
- **When** the amortization schedule is generated
- **Then** the schedule contains exactly 360 periods, and the final period's remaining balance is `"0.00"` (or within rounding tolerance of one cent)

**AC-3: Balance accuracy**
- **Given** any period in the amortization schedule
- **When** the borrower examines it
- **Then** the principal portion plus the interest portion equals the monthly payment amount (within one cent due to rounding), and the remaining balance equals the previous balance minus the principal portion (within one cent)

**AC-4: Summary totals**
- **Given** an amortization schedule is generated
- **When** the response is returned
- **Then** it includes summary totals: total of all payments, total principal paid, and total interest paid

**AC-5: Large schedule performance**
- **Given** a request for a 30-year (360-period) amortization schedule
- **When** the calculation completes
- **Then** the response is returned without unreasonable delay (the computation is pure arithmetic, not LLM-dependent)

#### Notes
- Stateless POST endpoint, no authentication or database access
- All computations use `Decimal` types internally; all serialized values are string decimals
- Cross-references: CALC-02 (total interest is derivable from the amortization schedule)

---

### CALC-07: Legal Disclaimers on All Calculator Outputs

**As a** borrower, **I want** all calculator outputs to include appropriate legal disclaimers (e.g., "estimates only, not a commitment"), **so that** I understand the limitations.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Disclaimer present on every calculator response**
- **Given** a borrower submits any calculator request (monthly payment, affordability, amortization, scenario comparison)
- **When** the response is returned
- **Then** the response JSON includes a `disclaimer` field containing text that clearly states the results are estimates only, do not constitute a loan offer or commitment, and actual terms may vary based on creditworthiness and other factors

**AC-2: Disclaimer is not empty or null**
- **Given** any calculator endpoint
- **When** the response is generated
- **Then** the `disclaimer` field is a non-empty string, never `null` or omitted

**AC-3: Disclaimer on error responses**
- **Given** a calculator request with valid structure but edge-case inputs
- **When** the calculation succeeds (not a validation error)
- **Then** the disclaimer is included even if the results are unusual or at boundary values

#### Notes
- The disclaimer text should be consistent across all calculator endpoints
- The disclaimer also applies when the intake agent presents calculator results in conversation (CHAT-06)
- This is a legal and compliance requirement, not optional formatting

---

### CALC-08: Current Market Rates in Calculator

**As a** borrower, **I want** the calculator to display current market rates from live data, **so that** my estimates are realistic.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Market rates available alongside calculator**
- **Given** a borrower is using the mortgage calculator
- **When** they want to know what interest rate to use
- **Then** current market rates are available (via the market data endpoints or embedded in the calculator response) so the borrower can use a realistic rate

**AC-2: Rates sourced from FRED API**
- **Given** the FRED API has been queried and rates are cached in Redis
- **When** market rates are requested in the calculator context
- **Then** the rates returned match the cached FRED data, with the cache freshness timestamp included

**AC-3: Calculator functions without live rates**
- **Given** the FRED API is unavailable and no cached rate data exists
- **When** a borrower uses the calculator
- **Then** the calculator still functions normally -- the borrower must provide their own interest rate. The calculator does not block or fail due to missing market data

#### Notes
- The calculator endpoints are stateless and always require an interest rate as input; CALC-08 is about making current rates easily accessible so borrowers can use realistic values, not about auto-populating rates into calculations
- Market rate display may be a UI concern (showing MARKET endpoint data near the calculator widget) rather than a calculator API change
- Cross-references: MARKET-01 (standalone rate endpoint), CHAT-04 (rate retrieval in conversation)

---

## Market Data (MARKET)

### MARKET-01: Current Mortgage Rates

**As a** borrower, **I want** to view current mortgage rates (30-year fixed, 15-year fixed, ARM rates) from a public federal data source, **so that** I can set realistic expectations.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Rate data retrieval**
- **Given** a borrower requests current mortgage rates via `GET /v1/market-data/rates`
- **When** the request is processed
- **Then** the response includes current rates for available mortgage products (e.g., 30-year fixed, 15-year fixed) sourced from the FRED API, each with the rate value (string decimal), the FRED series ID, and the observation date

**AC-2: Cached response**
- **Given** FRED API data was fetched within the last hour
- **When** a subsequent request for rates arrives
- **Then** the cached data is returned from Redis without calling the FRED API, and the response includes a `lastUpdated` timestamp indicating when the data was last fetched from FRED

**AC-3: Cache miss -- fresh fetch**
- **Given** no cached rate data exists or the cache has expired (older than 1 hour)
- **When** a request for rates arrives
- **Then** the system fetches fresh data from the FRED API, caches it in Redis with a 1-hour TTL, and returns the fresh data

**AC-4: FRED API unavailable -- stale cache available**
- **Given** the FRED API is unreachable and the cache has expired but stale data is still present in Redis (or an application-level stale store)
- **When** a request for rates arrives
- **Then** the system returns the stale data with a `stale: true` flag (or equivalent indicator) and the original observation date, so the borrower knows the data may not be current

**AC-5: FRED API unavailable -- no cached data**
- **Given** the FRED API is unreachable and no cached data exists at all
- **When** a request for rates arrives
- **Then** the system returns 503 with an RFC 7807 error body indicating market data is temporarily unavailable

**AC-6: No authentication required**
- **Given** a request to `GET /v1/market-data/rates` without an `Authorization` header
- **When** the request is processed
- **Then** it is accepted and returns results normally

**AC-7: Rate limiting**
- **Given** a single IP has sent 60 requests within the current 1-minute window to market data endpoints
- **When** the IP sends another request
- **Then** the system returns 429 with rate limit headers

#### Notes
- FRED API is the Federal Reserve Economic Data API (free tier available with API key)
- Redis cache key pattern: `fred:<series_id>` with 1-hour TTL
- The stale-serve behavior (AC-4) is a resilience pattern: prefer serving stale data over returning an error when the upstream is temporarily unavailable
- Cross-references: CHAT-04 (intake agent retrieves rates via tool), CALC-08 (calculator context)

---

### MARKET-02: Economic Indicators

**As a** borrower, **I want** to see economic indicators (Treasury yields, housing price indices) that affect mortgage rates, **so that** I can understand market context.

**Priority:** P1 | **Phase:** 3b

#### Acceptance Criteria

**AC-1: Economic indicator retrieval**
- **Given** a borrower requests economic indicators via `GET /v1/market-data/indicators`
- **When** the request is processed
- **Then** the response includes available economic indicators sourced from the FRED API: at minimum the 10-Year Treasury yield (DGS10) and the Case-Shiller Home Price Index (CSUSHPISA), each with the value (string decimal), series ID, observation date, and a human-readable label

**AC-2: Cached response**
- **Given** FRED indicator data was fetched within the last hour
- **When** a subsequent request arrives
- **Then** the cached data is returned from Redis, and the response includes a `lastUpdated` timestamp

**AC-3: FRED API unavailable -- graceful degradation**
- **Given** the FRED API is unreachable
- **When** a request for indicators arrives
- **Then** the system follows the same stale-cache-or-error pattern as MARKET-01 (serve stale data with indicator if available, 503 if no cached data)

**AC-4: No authentication required**
- **Given** a request to `GET /v1/market-data/indicators` without an `Authorization` header
- **When** the request is processed
- **Then** it is accepted and returns results normally

**AC-5: Rate limiting**
- **Given** a single IP has sent 60 requests within the current 1-minute window to market data endpoints
- **When** the IP sends another request
- **Then** the system returns 429 with rate limit headers

#### Notes
- FRED series: DGS10 (10-Year Treasury Constant Maturity Rate), CSUSHPISA (S&P/Case-Shiller U.S. National Home Price Index)
- Same caching strategy as MARKET-01: 1-hour TTL in Redis
- Cross-references: CHAT-04 (intake agent can retrieve this data via `fred_api_lookup` tool)

---

## Cross-Cutting Requirements for Public Tier

### Rate Limiting

All public-tier endpoints enforce per-IP rate limiting via Redis-backed sliding window counters:

| Endpoint Group | Limit | Rationale |
|---------------|-------|-----------|
| `/v1/chat/*` | 20 req/min per IP | Each request invokes an LLM, incurring cost |
| `/v1/calculator/*` | 60 req/min per IP | Pure computation, no LLM cost |
| `/v1/market-data/*` | 60 req/min per IP | Cached data, no LLM cost |

When a rate limit is exceeded, all endpoints return:
- HTTP 429 status
- `X-RateLimit-Limit` header (the limit for the current window)
- `X-RateLimit-Remaining` header (`0` when exceeded)
- `X-RateLimit-Reset` header (UTC epoch seconds when the window resets)
- RFC 7807 error body with `"title": "Too Many Requests"`

If Redis is unavailable:
- Chat endpoints fail closed (refuse requests to prevent unmetered LLM cost)
- Calculator and market data endpoints fall back to in-memory rate limiting counters (acceptable for single-instance MVP)

### Intake Agent Isolation

The intake agent is sandboxed with explicit permission boundaries:

**CAN access:**
- `mortgage_calculator` (pure computation)
- `fred_api_lookup` (cached public market data)
- `property_data_lookup` (mocked or real external API, no PII)
- `knowledge_base_search` (RAG over regulatory documents in `rag` schema)

**CANNOT access:**
- `loan_applications`, `documents`, `audit_events`, `agent_decisions`, `review_actions` tables
- Any authenticated API endpoint
- The `public` schema connection pool
- Any internal service that touches application data

This isolation is architectural: the intake graph's tool definitions only reference the calculator module, external API clients, and the RAG connection pool. There is no code path from the intake graph to application data.

### Financial Precision

All calculator computations use `Decimal` types internally. API responses serialize all monetary values, interest rates, and ratios as string decimals (e.g., `"1842.50"`, `"6.875"`, `"43.50"`). No floating-point arithmetic is used for financial calculations.

### Response Envelope

All public-tier endpoints follow the project response conventions:
- Success: `{ "data": { ... } }` or `{ "data": [...], "pagination": { ... } }`
- Error: RFC 7807 Problem Details format
- SSE: `Content-Type: text/event-stream` (chat streaming only)

---

## Non-Functional Requirements

### Responsiveness
- Chat responses begin streaming within a conversational pause (perceived latency before first token)
- Calculator responses return without noticeable delay (pure computation, no LLM dependency)
- Market data responses return without noticeable delay (served from cache in typical case)

### Reliability
- Chat sessions persist for 24 hours from creation
- Calculator endpoints are stateless and have no external dependencies that could fail
- Market data endpoints degrade gracefully when FRED API is unavailable (serve stale cache or return 503)
- If Redis is unavailable, chat sessions cannot be created (fail closed), but calculator continues to operate

### Security
- No PII is collected by public-tier endpoints
- Chat input is processed by the intake agent's LLM, which has prompt injection defenses via system prompt and sandboxing
- All public endpoints enforce rate limiting to prevent abuse and control LLM costs
- No authentication required for any public-tier endpoint

---

## Open Questions

1. **Stale cache policy for FRED data:** When the FRED API is unavailable and the 1-hour cache TTL has expired, should stale data be served with a staleness indicator, or should the system return 503? The acceptance criteria above suggest serving stale data when available (MARKET-01 AC-4), but the implementation may need a configurable stale TTL (e.g., serve stale up to 24 hours, then 503). This needs confirmation.

2. **Chat session storage model:** The architecture mentions `intake_conversations` and `intake_messages` tables (Phase 3b migration) alongside Redis session metadata and LangGraph state. The exact split between Redis (session token/metadata) and PostgreSQL (conversation history) should be confirmed during Technical Design.

3. **Calculator endpoint structure for DTI and comparison:** The requirements define DTI preview (CALC-03) and scenario comparison (CALC-05) as capabilities. Whether these are separate endpoints, parameters on existing endpoints, or client-side compositions is a Technical Design decision.

---

## Assumptions

1. The knowledge base (RAG infrastructure) from Phase 3a is available before CHAT-03 (source citations) can be fully tested.

2. FRED API access is available (free tier API key) for development and testing of CHAT-04, CALC-08, MARKET-01, and MARKET-02.

3. The mock property data service provides sufficient fixture data for testing CHAT-05 without a real BatchData API key.

4. The 24-hour chat session TTL is absolute from creation time, not sliding (i.e., activity does not extend the session).

5. The intake agent's system prompt and tool definitions are sufficient to enforce plain language responses (CHAT-02) and source citation behavior (CHAT-03) without additional application-level post-processing.
