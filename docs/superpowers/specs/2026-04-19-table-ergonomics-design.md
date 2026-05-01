# Table Ergonomics Design

## Goal

Make the `repositories`, `customers`, `support`, and `benchmarks` tables feel production-ready by adding fast scan ergonomics:

- text search
- purposeful quick filters
- explicit sort state on headers
- filtered result counts and empty states

## Scope

In scope:

- `apps/portal/components/PortalProfilesClient.jsx`
- `apps/portal/components/PortalBenchmarkHistoryClient.jsx`
- `apps/admin/components/AdminCustomerInventoryClient.jsx`
- `apps/admin/components/AdminSupportOperationsClient.jsx`
- `apps/admin/components/AdminBenchmarkHistoryClient.jsx`
- new table-helper modules and focused tests inside `apps/portal/src` and `apps/admin/src`
- minimal CSS additions in each app to support controls and sort affordances

Out of scope:

- server-side filtering
- URL-persisted table state
- pagination or virtualized rows
- cross-app shared UI package extraction

## Design

### Interaction Model

Every target table gets the same baseline interaction model:

- one search input for the most useful human-readable fields
- one or two quick filters tuned to the table's job
- clickable sortable headers with visible active direction
- a small result summary that reflects the filtered dataset
- a filtered empty state that explains whether the problem is data absence or current controls

### Table-Specific Filters

`Repositories`:

- search by repository name and summary
- quick filters for readiness (`all`, `ready`, `watch`, `needs work`)
- quick filters for sync truth (`all`, `fresh`, `needs resync`)
- quick filter for benchmark proof (`all`, `backed`, `missing`)

`Customers`:

- search by display name, slug, plan, and status
- quick filters for account posture (`all`, `active`, `trial`, `high risk`)
- quick filters for expansion (`all`, `ready`, `watch`, `blocked`)

`Support`:

- search by repository and customer slug
- quick filters for queue severity (`all`, `critical`, `watch`, `healthy`)
- quick filters for sync posture (`all`, `stale`, `fresh`)

`Benchmarks`:

- search by scenario, repository, model, provider, and summary
- quick filters for ROI posture (`all`, `strong`, `watch`, `weak`)
- quick filters for archive entity where relevant (`all`, `scenario`, `repository`) stay out of row tables; the row tables themselves use search + sort + ROI filter

## Architecture

Keep table derivation logic local to each app:

- `apps/portal/src/*` owns portal table derivation
- `apps/admin/src/*` owns admin table derivation

The helpers are pure functions that:

- normalize raw records into table rows
- apply search/filter state
- sort rows from explicit table state
- return filtered counts for UI summaries

This keeps domain logic out of presentational components without creating a premature shared package boundary.

## Security Note

These are admin and portal surfaces, so the implementation must not:

- expose hidden fields through search/filter controls
- add logging of raw payloads or internal notes
- mix portal and admin helper modules or payload assumptions

The controls operate only on already-rendered safe fields.

## Validation

- add focused `node --test` coverage for portal helper behavior
- add focused `node --test` coverage for admin helper behavior
- run the new tests red-green
- run app builds if feasible to catch JSX or CSS regressions

## Risks

- repeated control markup across tables may stay somewhat duplicated; this is acceptable for the current slice because the portal/admin boundaries differ
- result quality depends on choosing filters that match operator intent; keep the first version small and obvious
