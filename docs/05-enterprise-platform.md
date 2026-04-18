# Enterprise Platform Plan

## Purpose

The enterprise surface should support acquisition, activation, governance, and revenue operations without forcing the product team to overbuild the back office too early.

## Platform Layers

### 1. Marketing Website

Goals:

- Explain the product clearly
- Show token savings and quality improvement narrative
- Capture leads
- Support self-serve trial signup
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

### 2. Docs Portal

Goals:

- Installation guide
- CLI docs
- MCP integration docs
- Policies and configuration docs
- Benchmark guide
- Enterprise deployment guide

### 3. Customer Workspace

Goals:

- Manage repositories
- See graph/index status
- Review benchmark history
- Monitor token savings and usage analytics
- Manage organization members and policies
- Download reports

### 4. Admin Control Plane

Goals:

- Manage customers and licenses
- View revenue metrics
- Track trial conversions
- Support onboarding and customer health
- View ingestion and service health

## Build vs Buy Recommendation

For the first 12 months, do not build a full CRM from scratch.

Use:

- Stripe for billing and subscription management
- HubSpot for CRM and pipeline
- PostHog for product analytics
- Clerk/Auth0 for auth
- Metabase or internal admin pages for reporting

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
