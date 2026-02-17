# ADR-0001: HMDA Data Isolation Architecture

## Status
Proposed

## Context

The Home Mortgage Disclosure Act (HMDA) requires mortgage lenders to collect demographic data (race, ethnicity, sex) from applicants for regulatory reporting purposes. Simultaneously, fair lending laws (ECOA, Fair Housing Act) prohibit using this data in lending decisions. The application must demonstrate this tension: collecting HMDA data while provably preventing its use in lending analysis.

This is the most architecturally significant challenge in the application. The product plan (F25, F14, F16) requires HMDA data isolation at four stages: collection, document extraction, storage, and retrieval. The isolation must be demonstrable -- not just "we promise the code does not use it," but architecturally verifiable through data path separation.

## Options Considered

### Option 1: Access Control Only (Same Data Path)
Store HMDA data alongside other application data in the same tables. Use application-level access control to prevent lending services from reading HMDA columns.

- **Pros:** Simple implementation. No schema complexity. Standard RBAC pattern.
- **Cons:** A single query bug or ORM misconfiguration could leak HMDA data into the lending path. Not architecturally verifiable -- requires trusting every query in the codebase. Does not satisfy the "two fundamentally different data access paths" requirement from the security review. Fails the demo narrative: "we just used access control" is not compelling.

### Option 2: Separate Tables, Same Schema
Store HMDA data in separate tables within the same PostgreSQL schema. Lending services do not join to HMDA tables.

- **Pros:** Clear table-level separation. Easy to audit which services query which tables.
- **Cons:** Tables are still in the same schema, so a developer could accidentally join. ORM eager-loading could pull related HMDA data. Weaker than schema-level isolation.

### Option 3: Separate PostgreSQL Schema (Dual-Data-Path)
Store HMDA data in a dedicated PostgreSQL schema (`hmda`). The lending data path services query only the default schema. The Compliance Service is the sole accessor of the `hmda` schema and exposes only aggregate statistics.

- **Pros:** Schema-level isolation is verifiable by auditing schema references in code. PostgreSQL schema permissions can restrict which database roles access which schemas. Clear demonstration narrative: "demographic data lives in a different schema that lending services cannot even query." Supports future enhancement with namespace-level isolation on OpenShift.
- **Cons:** Slightly more complex schema management. Migrations must handle both schemas. Aggregate reporting requires a service that bridges the schemas.

### Option 4: Separate Database
Run a dedicated PostgreSQL instance for HMDA data, completely separate from the lending database.

- **Pros:** Strongest possible isolation. Network-level separation.
- **Cons:** Doubles the database operational burden. Overkill for PoC maturity. Complicates single-command setup. The aggregate reporting bridge becomes a cross-database service.

## Decision

**Option 3: Separate PostgreSQL Schema (Dual-Data-Path)** with four-stage isolation enforcement.

This provides the strongest isolation that is practical at PoC maturity. Schema-level separation is architecturally verifiable (grep for `hmda` schema references outside the Compliance Service) without the operational complexity of a separate database. It supports the compelling demo narrative and can be upgraded to separate-database or namespace-level isolation for production.

**Four-stage enforcement:**

1. **Collection:** HMDA data is collected through a dedicated API endpoint (`/api/hmda/collect`) that writes only to the `hmda` schema. This endpoint shares no transaction or code path with lending data operations.

2. **Document Extraction:** The document processing pipeline includes a demographic data filter step. After extraction, any detected demographic content is excluded from the extraction result, the exclusion is logged, and the excluded data is not written to any lending-path table.

3. **Storage:** The `hmda` PostgreSQL schema is accessible only by a dedicated PostgreSQL role (`compliance_app`). The lending service role (`lending_app`) has no grants on the `hmda` schema. In the monolithic FastAPI process, role separation is enforced through separate SQLAlchemy connection pools -- the Compliance Service uses a dedicated pool configured with `compliance_app` credentials, and all other services use the primary pool configured with `lending_app` credentials. Verification: `psql -U lending_app -c "SELECT * FROM hmda.demographics"` must return a permission denied error.

4. **Retrieval:** AI agents for lending personas (Loan Officer, Underwriter) have tool registries that contain no HMDA-querying tools. The CEO agent has a single tool (`get_hmda_aggregates`) that returns only aggregate statistics, never individual records. If a lending agent is asked about demographic data, it refuses per its system prompt and logs the attempt. TrustyAI fairness metrics (SPD, DIR) are computed by the Compliance Service on aggregate HMDA data using the `trustyai` Python library, consistent with the isolation architecture -- the library operates within the Compliance Service process and only accesses pre-aggregated data.

**Aggregation constraint:** The Compliance Service exposes only pre-aggregated statistics. No API returns individual HMDA records joined with lending decisions. The aggregation happens inside the Compliance Service; consumers receive pre-aggregated results.

## Consequences

### Positive
- Architecturally verifiable isolation -- code audits can confirm separation by checking schema references.
- Compelling demonstration narrative for the Summit demo.
- Satisfies the security review requirement for "two fundamentally different data access paths."
- Upgrade path to stronger isolation (separate database, namespace isolation) without rearchitecture.

### Negative
- Two schemas to manage in migrations.
- The Compliance Service acts as a bridge between schemas, adding a service that would not exist in a single-schema design.
- Aggregate statistics computation requires the Compliance Service to query `hmda` data and combine it with lending outcome data. This bridging service must itself be carefully audited.

### Neutral
- The demographic data filter in the extraction pipeline adds a processing step but is straightforward to implement as a post-extraction scan.
- Pre-seeded HMDA data for historical loans (for CEO dashboard fair lending metrics) must be seeded in the `hmda` schema, not in the lending data seed.
