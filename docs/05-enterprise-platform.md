# Enterprise Platform Plan

`BeHeart` has three web surfaces on purpose. They should not collapse into one blended UI:

- `Website`: public marketing, docs, benchmark proof, sign-up, and demo booking
- `Portal`: customer-only workspace for synced repositories, documents, usage, benchmarks, and tenant settings
- `Admin`: internal BeHeart control plane for revenue, support, customer health, ops, and platform governance

## Purpose

The enterprise surface should support acquisition, activation, governance, and revenue operations without forcing the product team to overbuild the back office too early.

## Platform Layers

### 1. Public Website

Goals:

- Explain the product clearly
- Show token savings and quality improvement narrative
- Capture leads
- Support self-serve trial signup
- Support sign-in and redirect users into the customer portal
- Host docs, pricing, security overview, and benchmark proof points

Suggested pages:

- Home
- Product
- How It Works
- Benchmark
- Pricing
- Security
- Docs
- Book Demo
- Customers/Case Studies

### 2. Docs Experience

Goals:

- Installation guide
- CLI docs
- MCP integration docs
- Policies and configuration docs
- Benchmark guide
- Enterprise deployment guide

Implementation direction:

- Keep docs on the public website so buying, onboarding, and trust signals stay connected.
- Do not create a fourth product surface unless versioning/search needs force it later.

### 3. Customer Portal

Goals:

- Let individuals and organizations access the product after signup or purchase
- Manage repositories and CLI sync targets
- See project memory status, synced diagrams, and linked documents on the web
- Review benchmark history
- Monitor token savings and usage analytics
- Manage organization members, policies, licenses, and workspace settings
- Download reports

UX rules:

- Optimize for operational clarity and ROI visibility, not marketing novelty
- Prefer tables, trend panels, inventory rows, and scoped detail views over decorative cards
- Keep CLI sync status and hosted API trust boundary visible

### 4. Admin Control Plane

Goals:

- Internal-only website for the `BeHeart` owner and staff
- Manage customers and licenses
- View revenue metrics
- Track trial conversions
- Support onboarding and customer health
- Configure platform settings and service health

UX rules:

- Optimize for auditability and decision-making speed
- Show revenue, retention, intake, benchmark health, and service health in one coherent control plane
- Avoid exposing internal operations to portal users

## Build vs Buy Recommendation

For the first 12 months, do not build a full CRM from scratch.

Use:

- Stripe for billing and subscription management
- HubSpot for CRM and pipeline
- PostHog for product analytics
- Clerk/Auth0 for auth
- internal admin pages plus optional Metabase for deeper reporting

Build custom admin only for:

- tenant management
- license status
- benchmark report management
- operational health

## Website Messaging Strategy

### Primary message

Stop paying AI to relearn your codebase.

### Supporting messages

- Give coding agents durable project memory
- Reduce token spend and duplicate work
- Keep AI aligned to architecture and reusable code
- Measure cost savings with benchmark reports

### CTA strategy

- Start local free
- Run a benchmark
- Book an enterprise pilot

## Enterprise Features Roadmap

### Wave 1

- Team billing
- Usage metering
- Report export
- Basic org/workspace management

### Wave 2

- SSO/SAML
- RBAC
- Audit logs
- Policy packs
- Private deployment options

### Wave 3

- VPC deployment
- On-prem package
- data retention controls
- compliance posture artifacts

## Admin Roles

- `Super Admin`
- `Support Admin`
- `Sales Ops`
- `Customer Success`
- `Org Admin`
- `Engineering Admin`

## Key Admin Views

- Account list
- Customer portal access status
- Active trials
- Usage and token savings
- Billing status
- Benchmark results by customer
- Error queues and failed scans
- License seat allocation

## Suggested SaaS Data Domains

- Organizations
- Users
- Repositories
- Graph jobs
- Policies
- Benchmarks
- Reports
- Licenses
- Invoices
- Leads and opportunities

## Compliance Readiness

You do not need full enterprise compliance on day one, but you should design toward it:

- auditability
- tenant isolation
- encryption at rest and in transit
- least privilege access
- secret redaction and path exclusions

## Enterprise Sales Motion

1. Demo using benchmark narrative
2. 2-week pilot on selected repos
3. Deliver token savings and code quality report
4. Convert to annual license with team expansion path
