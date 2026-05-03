# Roadmap and Operating Model

## 18-Month Roadmap

Status note: the repository is past concept-only local scaffolding. Current work includes local CLI/workbench, MCP,
document memory, context packs, domain packs, benchmark artifacts, and guided website/portal/admin surfaces. Roadmap
items below separate what is implemented enough for guided pilots from what remains planned or future.

### Phase 0: Validation and Design Partner Setup

Duration:

- `0-6` weeks

Goals:

- Validate pain with `15-20` customer interviews
- Confirm best initial ICP
- Lock MVP scope
- Recruit `2-3` design partners

Deliverables:

- clickable product narrative
- benchmark methodology draft
- technical architecture decision memo

### Phase 1: Local MVP And Guided Pilot

Duration:

- `6-16` weeks

Goals:

- local indexing
- code graph
- context pack generation
- local MCP server
- CLI happy path
- interactive CLI AI workbench
- provider/model selection and one-shot AI chat
- docs/spec sync
- Tolling Management Domain Pack and Tolling Sales MVP Demo Kit
- early benchmark runner

Success criteria:

- usable on one TypeScript repo
- benchmark shows directional value with clear observed/estimated labels
- generated demo artifacts stay fake-data-only and source-cited
- design partners can run the local flow without hosted dependency

### Phase 2: Team Product

Duration:

- `4-6` months

Goals:

- shared graph store
- team policies
- portal chat over synced artifacts
- saved context pack history
- team model settings and provider posture
- usage analytics
- report export
- basic billing and org management

Success criteria:

- first paid pilot
- first shared-team workflow in production

### Phase 3: Enterprise Readiness

Duration:

- `6-12` months

Goals:

- multi-repo support
- SSO/SAML
- audit logs
- VPC/on-prem
- customer admin console
- billing provider integration
- enterprise model administration
- backup, restore, retention, and deletion operations

Success criteria:

- repeatable enterprise pilot motion
- annual contracts

## Team Plan

### Initial Team

- Founder/CEO product and sales
- Founding engineer for graph/runtime
- Full-stack engineer for CLI/web/admin
- Part-time design/brand support

### First Expansion

- developer relations / content
- customer success / solutions engineer
- data or infra engineer if benchmark and SaaS load grows

## Delivery Cadence

- Weekly product review
- Weekly customer feedback review
- Bi-weekly roadmap review
- Monthly benchmark and KPI review

## KPI Scorecard

- activated repos
- weekly active teams
- benchmark completion rate
- observed benchmark coverage
- domain-pack artifact generation
- portal chat command completion rate
- token savings median
- duplicate reduction median
- trial-to-pilot conversion
- pilot-to-paid conversion
- net revenue retention after enterprise launch

## Budget Discipline

Spend in order:

1. product proof
2. benchmark proof
3. distribution assets
4. enterprise hardening

Avoid early waste on:

- overbuilding admin
- broad multi-language support before demand
- heavy compliance spend before pilots justify it

## Major Risks

### Product risk

The graph may be interesting but not sufficiently valuable in daily workflow.

Mitigation:

- benchmark every release against real tasks

### Adoption risk

Teams may like the concept but not change workflow.

Mitigation:

- local CLI first
- easy MCP integration
- low-friction onboarding

### Technical risk

Indexing quality may be too weak for trust.

Mitigation:

- narrow first language support
- explicit confidence markers
- human-readable explanations

### Commercial risk

ROI claim may feel soft.

Mitigation:

- strong benchmark framework
- design partner case studies

## Decision Framework

Prioritize roadmap items that improve one of these:

- trust
- measurable savings
- adoption friction
- enterprise defensibility

## Recommended Milestones

### Now / Local Pilot

- keep README, PRD, CLI/MCP spec, security docs, and benchmark docs aligned with implemented command surface
- run one-repo local pilot with `heart init`, `doctor`, `scan`, `pack`, `mcp tools`, `models`, `chat`, and one benchmark
- validate Tolling Sales MVP Demo Kit generation and safety labels

### Next 30-60 Days

- improve portal chat execution depth while keeping allowlisted actions
- add saved context-pack history and stronger docs/spec drift visibility
- calibrate benchmark scenarios with real design-partner tasks
- decide first billing provider adapter and enterprise model admin scope

### 90 Days

- first design partner usage
- website/portal/admin guided pilot flow stable
- Tolling demo kit used in a discovery or sales workflow with caveated ROI story
- security review completed for API keys, portal chat, MCP, generated artifacts, and benchmark publication

### 180 Days

- first paid pilot
- benchmark report standardized
- shared workspace beta
- billing/provider adapter decision implemented or deferred with explicit rationale
- private deployment and SSO/RBAC requirements documented for enterprise pipeline
