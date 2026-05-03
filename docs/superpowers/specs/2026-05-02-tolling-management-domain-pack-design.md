# Tolling Management Domain Pack Design

## Goal

Create the first customer-specific industry memory pack for `be-ai-heart`: a source-backed Tolling Management System pack that gives AI agents enough business, architecture, workflow, security, UI, performance, and benchmark context to build and maintain real tolling products with less repeated prompting.

The pack is not model training. It is durable domain context that can be selected, customized per customer, compiled into task-specific context packs, exposed through MCP, and measured through benchmark scenarios.

## Product Outcome

When a user chooses the Tolling Management pack, `be-ai-heart` should help an AI coding agent reason like it has already been briefed on tolling operations:

- toll road facility, lane, gantry, tag, license plate, account, trip, toll, invoice, violation, dispute, and payment concepts
- back-office account and financial operations
- roadside event intake and dispatch support
- image review and OCR/manual verification workflows
- trip posting, dedupe, rating, reconciliation, and exception handling
- customer support agents for invoice, payment, dispute, waiver, and account recovery flows
- security and privacy guardrails for PII, plate images, payments, and audit logs
- cost and performance rules for image storage, OCR, event processing, third-party integrations, and cloud retention
- benchmark tasks that prove token savings, quality lift, and lower development/maintenance effort

## Agreed Decisions

- Build Tolling Management first.
- Keep Transportation Management as a separate future pack.
- Include a small TMS bridge in Tolling v1 only for roadside dispatch, fleet/rental handling, and trip movement context.
- Use a structured pack plus markdown docs, not markdown-only files.
- Make the pack customer-specific by combining a source-backed base pack with customer overlays.
- Do not build the full pack runtime, UI selector, or hosted marketplace in this design.
- Do not claim legal compliance. The pack provides engineering guardrails and source citations; customer legal counsel owns final policy.

## Scope

In scope:

- base `packs/tolling-management/` layout
- source-backed domain docs
- structured pack manifest
- canonical entities and workflows
- AI agent role definitions
- image review and trip posting operating model
- back-office, roadside, customer support, UI/UX, security, and cloud-cost playbooks
- benchmark scenario definitions
- customer overlay design
- context compiler and MCP integration requirements at design level
- validation approach for docs, schemas, and source citations

Out of scope:

- implementing pack parser/runtime
- implementing portal pack selector UI
- scraping or copying agency proprietary systems
- training or fine-tuning foundation models
- replacing toll agency legal, policy, billing, or collections decisions
- full Transportation Management System pack
- vendor-specific product integration adapters

## Source-Backed Operating Model

The base pack should encode common operating patterns found across public tolling sources and vendor materials:

- TxDOT moved toll billing, customer service, transaction processing, billing, and account management for certain roads to HCTRA to improve regional customer experience, simplify invoicing, reduce fees, and gain operating savings.
- FHWA describes ETC interoperability as a combination of customer identification, transaction exchange, back-office procedures, interface control documents, tag/plate matching, image review, violation processing, and reconciliation.
- HCTRA's EZ TAG agreement highlights good-standing accounts, current plates, valid payment methods, transponder mounting, violation photos, protest windows, failed payment handling, account suspension, and interoperability data sharing.
- NTTA's ZipCash model shows why pay-by-mail/video tolling costs more than prepaid tag tolling: image capture, billing, mail, collection, and late-fee processes increase operating cost.
- 405 Express Lanes shows express-lane operational constraints: FasTrak transponder requirement, violation lookup/dispute, penalty escalation, account mismatch, insufficient funds, replacement transponder support, and third-party mobile payment limitations.
- TxDOT's AI strategy supports secure AI assistants, complaint intake and triage, vendor and tool selection, system redundancy analysis, large-data performance optimization, user-friendly AI interfaces, and fraud/threat detection.
- Back-office vendors such as TransCore expose typical commercial module boundaries: account management, image review, financial accounting, dynamic business rules, and business intelligence.
- FTC toll text scam guidance makes scam-aware customer support a real product need.

The pack must keep those sources in `source-notes.md` with links, retrieval dates, scope notes, and source-to-pack mapping. Source notes must separate official government/agency references from vendor and consumer-protection references.

## Research Sources

Initial source set retrieved on 2026-05-02:

- [TxDOT teams up with HCTRA to enhance toll operations](https://www.txdot.gov/about/newsroom/statewide/2024/txdot-teams-up-with-hctra-to-enhance-toll-operations.html): consolidation, customer service, billing, account management, and savings signal.
- [FHWA Nationwide Electronic Toll Collection Interoperability](https://ops.fhwa.dot.gov/publications/fhwahop21023/fhwahop21023.pdf): ETC interoperability, back-office functions, home/away agency concepts, transaction exchange, image review, and reconciliation.
- [HCTRA EZ TAG Agreement](https://www.hctra.org/-/media/BF54E5D5AF9D482DBCD13A2472FDEEA9.ashx): account good standing, plate/payment maintenance, transponder mounting, violations, protest window, failed replenishment, suspension, and interoperability data sharing.
- [NTTA Pay Your Bill](https://www.ntta.org/pay-your-bill): ZipCash invoice/payment behavior and fee risk for unpaid invoices.
- [405 Express Lanes Violations](https://www.405expresslanes.com/en/violations/): violation lookup, online dispute, account mismatch, insufficient funds, transponder replacement, and penalty escalation.
- [405 Express Lanes third-party mobile payment FAQ](https://www.405expresslanes.com/en/support/frequently-asked-questions/managing-my-account/can-i-use-the-405-express-lanes-if-i-have-an-account-with-a-third-party-mobile-payment-processor-through-an-app-such-as-go-toll-paytollo-uproad-etc/): FasTrak requirement and unsupported third-party payment-app behavior.
- [TxDOT Artificial Intelligence Strategic Plan FY 2025-2027](https://www.txdot.gov/content/dam/docs/division/str/ai-strategic-plan-09-20-2024.pdf): AI governance, security, transparency, accuracy, accountability, privacy, safety, user-friendly AI interfaces, performance, and fraud/threat detection themes.
- [TransCore Integrity Back Office Solution](https://transcore.com/tolling/integrity-back-office): commercial back-office module pattern for account management, image review, financial accounting, rules, and BI.
- [FTC toll text scam guidance](https://consumer.ftc.gov/consumer-alerts/2025/01/got-text-about-unpaid-tolls-its-probably-scam): scam-safe customer support guidance for unpaid toll SMS/payment-link scenarios.

## Customer-Specific Pack Strategy

Use two layers.

### Base Pack

`packs/tolling-management/` contains reusable industry memory:

- shared terminology
- generic workflows
- canonical entities
- common business rules
- agent roles
- security defaults
- UI and performance patterns
- benchmark scenarios
- source notes

The base pack must avoid customer-specific toll rates, road names, vendor contracts, secrets, and production data.

### Customer Overlay

Customer repos can add:

```text
.heart/packs/tolling-management/customer.yaml
.heart/packs/tolling-management/customer-domain.md
.heart/packs/tolling-management/customer-rules.md
.heart/packs/tolling-management/customer-sources.md
```

Overlay examples:

- agency name and facility list
- allowed payment vendors
- customer support escalation policies
- toll class/rate policy references
- state-specific dispute and collections rules
- image retention policy
- OCR vendor constraints
- cloud vendor constraints
- SLA and queue thresholds
- preferred UI vocabulary
- integration endpoints by contract name, not secret value

The compiler should resolve context in this order:

1. user task
2. customer overlay
3. base Tolling pack
4. project docs
5. code graph and tests

## Pack Layout

```text
packs/tolling-management/
  pack.yaml
  domain.md
  workflows.md
  entities.yaml
  business-rules.md
  agent-roles.md
  ai-image-review.md
  trip-posting.md
  back-office-ops.md
  roadside-ops.md
  customer-support.md
  security-privacy.md
  ui-ux-patterns.md
  cloud-cost-playbook.md
  benchmark-scenarios.json
  source-notes.md
```

## Pack Manifest

`pack.yaml` is the machine-readable entrypoint:

```yaml
schema_version: 1
pack_id: tolling-management
name: Tolling Management System
pack_type: industry_domain
status: draft
primary_use_cases:
  - back_office
  - road_side
  - trip_posting
  - image_review
  - customer_support
  - ai_agent_support
  - cloud_cost_optimization
recommended_context_budget:
  minimal_tokens: 1200
  standard_tokens: 3500
  deep_tokens: 7000
documents:
  domain: domain.md
  workflows: workflows.md
  entities: entities.yaml
  business_rules: business-rules.md
  agent_roles: agent-roles.md
  image_review: ai-image-review.md
  trip_posting: trip-posting.md
  back_office: back-office-ops.md
  roadside: roadside-ops.md
  customer_support: customer-support.md
  security_privacy: security-privacy.md
  ui_ux: ui-ux-patterns.md
  cloud_cost: cloud-cost-playbook.md
  benchmarks: benchmark-scenarios.json
  sources: source-notes.md
```

Manifest fields must stay deterministic and parseable. No prose-only hidden routing.

## Canonical Domain Model

`entities.yaml` should define at least:

- `Agency`
- `Facility`
- `RoadSegment`
- `Gantry`
- `Lane`
- `Transponder`
- `Vehicle`
- `LicensePlate`
- `VehicleClass`
- `Account`
- `PaymentMethod`
- `ReplenishmentEvent`
- `RoadsideEvent`
- `LaneEvent`
- `PlateImage`
- `ImageReviewTask`
- `OcrCandidate`
- `TollTransaction`
- `Trip`
- `TripSegment`
- `RatePlan`
- `Invoice`
- `ViolationNotice`
- `Dispute`
- `WaiverRequest`
- `CollectionCase`
- `InteroperabilityPartner`
- `HomeAgencySettlement`
- `AwayAgencyTransaction`
- `SupportCase`
- `AgentAction`
- `AuditEvent`

Each entity should include:

- description
- common fields
- sensitive fields
- source systems
- lifecycle states
- relationships
- common validation rules
- useful test fixture hints

## Workflows

`workflows.md` should describe these first-class flows.

### Tag-Based Trip Posting

Lane event reads transponder, identifies account, validates account/tag/vehicle state, rates toll, posts transaction, updates balance, records audit trail, and emits reconciliation events.

Common edge cases:

- inactive tag
- negative balance
- tag mounted incorrectly
- duplicate read
- mismatched vehicle class
- away-agency tag
- delayed settlement

### Video Toll / Pay-By-Plate

Lane image captures plate, OCR extracts candidates, confidence and plate/state validation decide auto-post or review, owner/account lookup resolves billing route, transaction becomes account charge, invoice, or violation workflow.

Common edge cases:

- unreadable plate
- obstructed plate
- trailer/cab plate ambiguity
- temporary plate
- out-of-state owner
- rental fleet plate
- sold/stolen vehicle claim
- stale DMV address

### Image Review

Image review should be modeled as a safety-critical exception queue:

- AI proposes plate, state, class, confidence, and reason codes.
- Human review remains required below policy threshold or for high-risk cases.
- Every correction creates training/evaluation data but does not auto-train a model.
- Review UI must optimize keyboard speed, side-by-side evidence, zoom, contrast, and audit capture.

### Invoice, Violation, Dispute, and Waiver

Workflow should separate:

- invoice generation
- reminder/late fee policy
- violation notice
- dispute intake
- evidence review
- fee waiver request
- administrative review
- collections handoff

The pack should explain that rules vary by agency and state, so customer overlays must own dates, fees, notices, and legal language.

### Customer Support

Support flows must cover:

- account login/recovery
- add/remove vehicle
- update plate/address/payment
- failed replenishment
- invoice lookup
- violation dispute
- transponder replacement
- scam warning
- accessible support and language support
- escalation to human agent

AI support must cite policy/source docs and avoid inventing toll amounts, deadlines, penalties, or legal outcomes.

### Roadside Operations

Roadside workflows should cover:

- incident intake
- disabled vehicle
- debris
- lane closure
- safety patrol dispatch
- customer notification
- event closure
- linkage to toll facility and lane status

This is the v1 bridge to Transportation Management.

### Interoperability and Settlement

Interoperability should cover:

- home agency vs away agency
- tag and plate lists
- transaction exchange
- acknowledgements
- exception files
- reconciliation
- partner-specific interface control documents

The pack should guide developers to model partner contracts behind interfaces instead of hardcoding agency-specific behavior throughout product code.

## AI Agent Roles

`agent-roles.md` should define role cards for:

- Customer Support Agent
- Violation Review Agent
- Image Review QA Agent
- Trip Posting Agent
- Back-Office Ops Agent
- Roadside Support Agent
- Fraud/Smishing Agent
- Cloud Cost Agent
- Developer Context Agent
- Product Owner Agent
- QA/Benchmark Agent

Each role card should include:

- purpose
- allowed inputs
- forbidden actions
- required citations
- escalation triggers
- output format
- risk level
- audit requirements
- benchmark scenarios

High-risk roles must be advisory by default. Agents may draft, classify, summarize, route, and recommend, but must not silently waive fees, change legal status, delete evidence, or submit payment actions without explicit system permission and audit.

## Security and Privacy

`security-privacy.md` must make these defaults explicit:

- Treat plates, vehicle owner data, addresses, account balances, payment status, trip history, images, disputes, and support transcripts as sensitive.
- Never store card numbers or bank details in pack examples.
- Use payment tokens and provider references only.
- Redact plate numbers and customer data in generated context artifacts unless the task explicitly needs them and policy allows it.
- Keep raw images out of benchmark reports by default; use metadata or synthetic fixtures.
- Require audit events for AI recommendations that affect customer money, account status, dispute outcome, collections state, or image-review evidence.
- Require human review for low-confidence OCR, disputed violations, fee/waiver decisions, and collections escalation.
- Prefer least privilege for agents and integrations.
- Include scam-safe customer guidance: users should verify toll payment requests through official toll agency sites or numbers, not unknown text links.

## UI/UX Guidance

`ui-ux-patterns.md` should emphasize operational surfaces, not marketing pages:

- dense but readable queue tables
- saved filters for account, invoice, violation, image review, dispute, and roadside queues
- detail panels with audit trail, evidence, and next action
- keyboard-first image review
- clear confidence indicators without overtrusting AI
- side-by-side image, OCR candidate, account/vehicle evidence, and prior trips
- no decorative UI that slows repeat operations
- mobile-safe customer support and payment flows
- multilingual support where customer base requires it
- error states that explain what can be done next without leaking sensitive data

The pack should remind AI agents to build real operator tools first: queue, detail, search, evidence, action, audit.

## Performance and Cloud Cost Playbook

`cloud-cost-playbook.md` should give default engineering constraints:

- event ingestion must be idempotent
- trip posting must dedupe by lane event, agency, gantry, timestamp window, tag, plate, and correlation id
- OCR/image review should use tiered confidence thresholds to avoid reviewing obvious cases manually
- images should use lifecycle storage, thumbnails, and restricted access
- raw image retention must be configurable by customer policy
- support agents should use retrieval over compact policy/context docs before calling expensive models
- batch OCR and enrichment where latency does not need to be real time
- cache rate tables and static facility metadata
- isolate vendor adapters behind contracts
- avoid per-request cloud calls for stable reference data
- measure cost per 1,000 transactions, cost per image reviewed, cost per support case deflected, and cloud spend per facility

## Benchmark Scenarios

`benchmark-scenarios.json` should include at least:

- implement failed replenishment handling
- add low-confidence image review queue
- fix duplicate trip posting bug
- build invoice dispute intake API
- add customer support answer grounded in official policy docs
- add scam warning to payment support flow
- optimize image retention cost
- add away-agency transaction reconciliation
- design operator UI for violation queue
- create synthetic tolling fixture data with redacted PII

Each scenario should define:

- task prompt
- expected context files
- expected entities
- expected guardrails
- baseline prompt token estimate
- pack-assisted token estimate
- quality rubric
- security rubric
- expected tests or validation
- ROI measurement fields

ROI fields should include:

- prompt tokens avoided
- duplicated domain explanation avoided
- implementation defects avoided
- manual review time reduced
- cloud/vendor cost lever identified
- support or operations work reduced

## Context Compiler Integration

This design expects future context compiler support for pack-aware retrieval:

- load selected pack manifest
- load customer overlay when present
- rank pack sections against task intent
- include only relevant domain sections in task context
- cite base pack and customer overlay separately
- expose pack provenance in context output
- respect token budget
- redact sensitive overlay data when policy requires
- prefer project docs/code over generic pack details when conflict exists

Example task mapping:

- "build image review UI" -> `ai-image-review.md`, `ui-ux-patterns.md`, `entities.yaml`, customer image policy, relevant UI code
- "fix double charge" -> `trip-posting.md`, `business-rules.md`, `entities.yaml`, project transaction code
- "customer asks about toll text scam" -> `customer-support.md`, `security-privacy.md`, FTC source notes, support code

## MCP Integration

Future MCP responses should expose:

- selected pack id
- selected pack sections
- customer overlay status
- source citation ids
- sensitivity warnings
- suggested files/symbols from repo graph
- suggested tests and benchmark scenario

The MCP server should not return the entire pack by default. It should compile a task-focused slice.

## Validation

Spec-level validation before implementation:

- every pack file has clear owner and purpose
- `pack.yaml`, `entities.yaml`, and `benchmark-scenarios.json` are parseable
- `source-notes.md` contains official/source links and retrieval dates
- no source quotes copied into pack docs beyond short citations
- no real customer PII or secrets in examples
- benchmark scenarios include security and ROI rubrics
- customer overlay rules override base pack without mutating base docs

Implementation validation later:

- schema tests for manifest/entities/scenarios
- context pack golden tests for image review, trip posting, dispute, support, and cloud-cost tasks
- MCP contract tests for selected pack metadata
- benchmark tests showing pack-assisted context reduces repeated domain explanation
- security tests for redaction and forbidden raw image/customer-data leakage

## Delivery Plan

Phase 1: Design and docs

- commit this design spec
- write `packs/tolling-management/` source-backed pack files
- add source notes with official links
- add synthetic benchmark scenario definitions

Phase 2: Local pack consumption

- add pack schema validation
- add config/CLI support for selecting pack
- include pack slices in `heart pack`
- add tests for pack-aware context output

Phase 3: MCP and benchmark

- expose selected pack metadata in MCP context responses
- add benchmark runs comparing generic prompt vs pack-assisted prompt
- publish sanitized evidence fields

Phase 4: Customer overlay

- add `.heart/packs/.../customer.yaml`
- merge overlay into context compiler
- enforce redaction and provenance

Phase 5: Product surfaces

- add portal/admin pack inventory
- show selected pack, overlay health, benchmark ROI, and missing source/policy warnings

## Risks and Mitigations

- Risk: pack becomes generic industry fluff.
  Mitigation: every section maps to workflows, entities, tests, and benchmark scenarios.

- Risk: pack implies legal advice.
  Mitigation: customer overlay owns agency/state policy; pack tells agents to cite sources and escalate legal outcomes.

- Risk: source drift.
  Mitigation: source notes include retrieval dates and source-to-section mapping; benchmark scenarios avoid brittle fee amounts unless customer overlay supplies them.

- Risk: sensitive data leaks into examples.
  Mitigation: use synthetic fixtures, redacted plates, fake accounts, and no raw images in default reports.

- Risk: pack increases token usage.
  Mitigation: compiler slices pack by task, uses token budgets, and benchmark scenarios measure domain context contribution.

- Risk: Transportation scope expands v1.
  Mitigation: only roadside/fleet/rental/dispatch bridge belongs in Tolling v1; logistics TMS gets a separate pack later.

## Open Questions

- Should `packs/` be committed at repo root now, or should initial pack docs live under `docs/domain-packs/` until runtime support exists?
- Should customer overlays be ignored by default in `.gitignore`, or versioned when they contain no sensitive content?
- Should pack validation live in `packages/context-compiler`, `packages/core`, or a future `packages/domain-packs` package?
- Which first benchmark should be the flagship demo: image review queue, duplicate trip posting, or support scam guidance?

## Review Gate

After this design is accepted, the next step is an implementation plan. The first implementation plan should cover only Phase 1: writing the Tolling Management base pack files plus schema/source validation fixtures. Runtime/CLI/MCP work should wait for a separate plan unless the user expands scope.
