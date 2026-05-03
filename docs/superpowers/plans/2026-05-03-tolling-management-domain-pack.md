# Tolling Management Domain Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first source-backed customer-specific industry pack: a Tolling Management System memory pack with schemas, operating docs, source notes, and benchmark scenarios.

**Architecture:** Phase 1 is static and local-first. Create a root `packs/tolling-management/` base pack that can later be consumed by `context-compiler`, CLI, and MCP without creating runtime coupling now. Add one benchmark-harness scenario/dataset so ROI proof has a current repo contract path, while keeping pack-local benchmark scenarios inside the pack.

**Tech Stack:** Markdown, YAML, JSON, Node.js validation scripts, existing `npm test` benchmark tests.

---

## File Structure

Create:

- `packs/tolling-management/pack.yaml` - machine-readable manifest and document map.
- `packs/tolling-management/domain.md` - glossary, system boundaries, customer overlay rules.
- `packs/tolling-management/workflows.md` - core tolling workflows and edge cases.
- `packs/tolling-management/entities.yaml` - canonical entity model with sensitivity and lifecycle metadata.
- `packs/tolling-management/business-rules.md` - rule categories and customer-owned policy values.
- `packs/tolling-management/agent-roles.md` - role cards for AI-assisted operations and development.
- `packs/tolling-management/ai-image-review.md` - OCR/image review operating model.
- `packs/tolling-management/trip-posting.md` - trip creation, rating, posting, dedupe, settlement.
- `packs/tolling-management/back-office-ops.md` - account, finance, queue, reconciliation ops.
- `packs/tolling-management/roadside-ops.md` - roadside dispatch bridge to TMS.
- `packs/tolling-management/customer-support.md` - support flows, escalation, scam-safe guidance.
- `packs/tolling-management/security-privacy.md` - sensitive data, agent safety, audit, redaction.
- `packs/tolling-management/ui-ux-patterns.md` - operator/customer UI patterns.
- `packs/tolling-management/cloud-cost-playbook.md` - performance and cost controls.
- `packs/tolling-management/benchmark-scenarios.json` - pack-local scenario catalog.
- `packs/tolling-management/source-notes.md` - source map with retrieval dates and usage notes.
- `benchmarks/datasets/tolling-domain-pack.json` - reusable benchmark dataset manifest.
- `benchmarks/scenarios/tolling-trip-posting-dedupe.json` - flagship benchmark scenario.

Modify:

- None for Phase 1. Do not touch CLI, MCP, context compiler, portal, admin, or package code.

## Acceptance Criteria

- Root `packs/tolling-management/` exists with every file listed above.
- `pack.yaml`, `entities.yaml`, and JSON benchmark files parse successfully.
- `source-notes.md` includes official/government, agency, vendor, and consumer-protection source sections with retrieval date `2026-05-02`.
- Pack docs avoid real customer PII, secrets, raw plate numbers, raw images, card/bank data, and production endpoints.
- Benchmark scenario compares generic baseline vs pack-assisted task for duplicate trip posting.
- Existing benchmark tests pass or any failure is clearly unrelated and documented.

## Task 1: Pack Manifest And Source Notes

**Files:**
- Create: `packs/tolling-management/pack.yaml`
- Create: `packs/tolling-management/source-notes.md`

- [ ] **Step 1: Create the directory**

Run:

```bash
mkdir -p packs/tolling-management
```

Expected: command exits `0`.

- [ ] **Step 2: Add `pack.yaml`**

Use this content:

```yaml
schema_version: 1
pack_id: tolling-management
name: Tolling Management System
pack_type: industry_domain
status: draft
retrieved_at: "2026-05-02"
base_pack_only: true
customer_overlay_supported: true
transportation_bridge:
  included: true
  scope:
    - roadside_dispatch
    - fleet_or_rental_vehicle_handling
    - trip_movement_context
  excluded:
    - shipment_planning
    - carrier_procurement
    - freight_settlement
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
sensitivity_defaults:
  redact_by_default:
    - license_plate
    - plate_image
    - vehicle_owner
    - address
    - account_balance
    - payment_status
    - trip_history
    - support_transcript
  never_include:
    - card_number
    - bank_account_number
    - raw_secret
    - production_endpoint_secret
```

- [ ] **Step 3: Add `source-notes.md`**

Use this content:

```markdown
# Tolling Management Source Notes

Retrieved: 2026-05-02

This pack uses public sources to capture common tolling operating patterns. It does not copy proprietary agency systems, does not create legal policy, and does not replace customer-specific rules. Customer overlays own toll rates, fee amounts, notice windows, collections policy, retention policy, integration endpoints, and state-specific legal language.

## Official And Agency Sources

### TxDOT And HCTRA Toll Operations Consolidation

Source: [TxDOT teams up with HCTRA to enhance toll operations](https://www.txdot.gov/about/newsroom/statewide/2024/txdot-teams-up-with-hctra-to-enhance-toll-operations.html)

Use in pack:

- consolidated invoicing and customer support
- transaction processing, billing, and account-management handoff
- customer experience, fewer fees, and operational savings as ROI framing
- TxTag-to-EZ TAG migration as an example of customer-facing transition risk

### FHWA Electronic Toll Collection Interoperability

Source: [FHWA Nationwide Electronic Toll Collection Interoperability](https://ops.fhwa.dot.gov/publications/fhwahop21023/fhwahop21023.pdf)

Use in pack:

- home agency and away agency concepts
- transponder and license-plate list exchange
- transaction exchange and acknowledgements
- back-office functions
- image review and violation processing
- reconciliation and regional hub cost pressure

### HCTRA EZ TAG Agreement

Source: [HCTRA EZ TAG Agreement](https://www.hctra.org/-/media/BF54E5D5AF9D482DBCD13A2472FDEEA9.ashx)

Use in pack:

- account good standing
- current license plate and payment method responsibility
- transponder activation, mounting, replacement, and non-transferability
- photographed violations
- protest window pattern
- failed payment, negative balance, and account suspension
- interoperability data sharing

### NTTA Billing And ZipCash

Source: [NTTA Pay Your Bill](https://www.ntta.org/pay-your-bill)

Use in pack:

- prepaid tag vs invoice billing UX
- ZipCash invoice handling
- due-date and late-fee risk
- pay-by-mail as higher-cost operational path

### 405 Express Lanes Violations And Payment Policy

Sources:

- [405 Express Lanes Violations](https://www.405expresslanes.com/en/violations/)
- [405 Express Lanes third-party mobile payment FAQ](https://www.405expresslanes.com/en/support/frequently-asked-questions/managing-my-account/can-i-use-the-405-express-lanes-if-i-have-an-account-with-a-third-party-mobile-payment-processor-through-an-app-such-as-go-toll-paytollo-uproad-etc/)

Use in pack:

- violation lookup by notice number and plate
- online dispute and administrative review flow
- account mismatch and insufficient-funds edge cases
- replacement transponder support
- penalty escalation pattern
- transponder requirement
- unsupported third-party mobile payment applications

### TxDOT AI Strategic Plan

Source: [TxDOT Artificial Intelligence Strategic Plan FY 2025-2027](https://www.txdot.gov/content/dam/docs/division/str/ai-strategic-plan-09-20-2024.pdf)

Use in pack:

- secure, transparent, accurate, accountable, privacy-preserving, safety-aware AI
- user-friendly AI interfaces
- complaint and support triage
- tool redundancy and vendor comparison
- large-data performance optimization
- fraud and threat detection

## Vendor Reference

### TransCore Integrity Back Office

Source: [TransCore Integrity Back Office Solution](https://transcore.com/tolling/integrity-back-office)

Use in pack:

- commercial module boundaries
- account management
- image review
- financial accounting
- dynamic business rules
- business intelligence

This is a vendor capability reference, not a product endorsement.

## Consumer Protection Reference

### FTC Toll Text Scam Guidance

Source: [FTC toll text scam guidance](https://consumer.ftc.gov/consumer-alerts/2025/01/got-text-about-unpaid-tolls-its-probably-scam)

Use in pack:

- scam-safe customer support responses
- guidance to use official toll agency websites or known phone numbers
- warning against unknown SMS payment links

## Source Use Rules

- Keep direct quotes short.
- Prefer paraphrase with links.
- Store customer-specific policies in overlays, not this base pack.
- Do not include production customer data in examples.
- Do not encode fee amounts, due dates, or legal outcomes unless a customer overlay supplies them.
```

- [ ] **Step 4: Validate manifest and sources**

Run:

```bash
ruby -e 'require "yaml"; doc = YAML.safe_load_file("packs/tolling-management/pack.yaml", permitted_classes: [], aliases: false); abort("missing pack_id") unless doc["pack_id"] == "tolling-management"; abort("missing sources") unless doc.dig("documents", "sources") == "source-notes.md"; puts "pack.yaml ok"'
rg -n "https://|Retrieved: 2026-05-02|Source Use Rules" packs/tolling-management/source-notes.md
```

Expected:

```text
pack.yaml ok
```

`rg` prints the source URLs, retrieval date, and source rules.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add packs/tolling-management/pack.yaml packs/tolling-management/source-notes.md
git commit -m "docs(domain-packs): add tolling pack manifest"
```

Expected: commit succeeds with only the two Task 1 files staged.

## Task 2: Domain Glossary And Entity Contract

**Files:**
- Create: `packs/tolling-management/domain.md`
- Create: `packs/tolling-management/entities.yaml`

- [ ] **Step 1: Add `domain.md`**

Use this content:

```markdown
# Tolling Management Domain

## Purpose

This domain pack gives AI agents durable context for toll road, managed lane, and express lane systems. It helps agents build back-office, roadside, image review, trip posting, support, security, UI, and cloud-cost work without re-learning tolling basics in every task.

## Non-Goals

- It does not train or fine-tune a model.
- It does not define legal policy.
- It does not replace customer-specific toll rates, fee rules, notice rules, collections rules, or retention rules.
- It does not cover full Transportation Management System logistics such as carrier procurement, freight planning, or warehouse fulfillment.

## Core Concepts

- Agency: toll authority, transportation department, or operating entity.
- Facility: toll road, bridge, tunnel, or managed lane network.
- Gantry: roadside tolling point that captures tag reads, plate images, vehicle class, and lane events.
- Transponder: tag used for electronic toll collection.
- Plate image: image evidence used when tag read is missing, invalid, or insufficient.
- Account: customer payment and vehicle relationship used for toll posting.
- Trip: rated movement across one or more tolling points.
- Toll transaction: posted financial event for a trip or segment.
- Invoice: bill for non-tag or unresolved account travel.
- Violation notice: enforcement notice for unpaid or unauthorized travel.
- Dispute: customer challenge to toll, fee, notice, plate, ownership, or account state.
- Home agency: agency that owns the customer account or tag.
- Away agency: agency that observed travel by another agency's customer.

## Product Boundaries

Tolling systems typically split into:

- Roadside systems: lane devices, cameras, tag readers, classifiers, gantries, closures, incident signals.
- Back-office systems: accounts, transactions, rating, invoices, violations, disputes, payments, reconciliation.
- Customer channels: web portal, mobile portal, call center, retail payment, email/mail notices.
- Operations tools: queues, dashboards, audit, image review, exception management, reporting.
- Partner interfaces: DMV/vehicle owner lookup, payment providers, collection providers, interoperability partners, notification vendors.

## Customer Overlay Rules

Customer overlays must own:

- facility names and toll zones
- toll rates and vehicle classes
- payment provider names
- notice windows and legal language
- fee and waiver policy
- retention windows
- image review thresholds
- OCR vendor constraints
- support escalation SLAs
- integration endpoint names

The base pack may describe patterns; it must not encode customer-specific legal or financial values.

## Agent Guidance

When an AI agent receives a tolling task:

1. Identify the workflow: trip posting, image review, invoice, violation, support, roadside, reconciliation, UI, security, or cloud cost.
2. Retrieve the relevant pack sections and customer overlay.
3. Prefer customer policy over base-pack defaults.
4. Avoid inventing toll amounts, deadlines, penalties, legal outcomes, or agency commitments.
5. Preserve auditability when customer money, evidence, disputes, or account status can change.
```

- [ ] **Step 2: Add `entities.yaml`**

Use this content:

```yaml
schema_version: 1
pack_id: tolling-management
entities:
  Agency:
    description: Toll authority, transportation department, or operating partner.
    sensitive_fields: []
    lifecycle_states: [active, maintenance_mode, retired]
    relationships: [owns Facility, partners_with InteroperabilityPartner]
    validation_rules:
      - agency identifiers must be stable across integrations
  Facility:
    description: Toll road, bridge, tunnel, managed lane, or express lane network.
    sensitive_fields: []
    lifecycle_states: [planned, active, closed, retired]
    relationships: [owned_by Agency, contains RoadSegment, contains Gantry]
    validation_rules:
      - facility must map to a customer-owned rate policy
  RoadSegment:
    description: Rated segment or corridor unit used for toll calculation and operations.
    sensitive_fields: []
    lifecycle_states: [active, closed, under_maintenance]
    relationships: [belongs_to Facility, has Gantry]
    validation_rules:
      - segment direction and facility must be explicit
  Gantry:
    description: Roadside point that records lane events, tag reads, images, and classification evidence.
    sensitive_fields: []
    lifecycle_states: [active, degraded, offline, maintenance]
    relationships: [belongs_to Facility, contains Lane, emits LaneEvent]
    validation_rules:
      - gantry clock drift must be observable
  Lane:
    description: Roadside lane monitored by tolling equipment.
    sensitive_fields: []
    lifecycle_states: [open, closed, degraded, maintenance]
    relationships: [belongs_to Gantry, emits LaneEvent]
    validation_rules:
      - lane status changes must be auditable
  Transponder:
    description: Electronic toll tag associated with an account or interoperability partner.
    sensitive_fields: [tag_serial]
    lifecycle_states: [active, inactive, lost, stolen, replaced, suspended]
    relationships: [assigned_to Vehicle, linked_to Account, issued_by Agency]
    validation_rules:
      - tag cannot silently move between vehicles without policy-controlled history
  Vehicle:
    description: Vehicle that can travel through toll facilities.
    sensitive_fields: [vin, owner_reference]
    lifecycle_states: [active, sold, stolen, rental, removed]
    relationships: [has LicensePlate, linked_to Account, may_have Transponder]
    validation_rules:
      - ownership and account association require effective dates
  LicensePlate:
    description: Plate identifier, state, country, and effective period.
    sensitive_fields: [plate_number]
    lifecycle_states: [active, expired, replaced, disputed]
    relationships: [belongs_to Vehicle, appears_in PlateImage]
    validation_rules:
      - plate number must be redacted in context artifacts unless required
  Account:
    description: Customer toll account with vehicles, tags, payment status, and balance.
    sensitive_fields: [customer_name, address, email, phone, account_balance, payment_status]
    lifecycle_states: [active, good_standing, negative_balance, suspended, closed]
    relationships: [owns Vehicle, owns Transponder, uses PaymentMethod]
    validation_rules:
      - account money-changing actions require audit
  PaymentMethod:
    description: Tokenized payment instrument or provider reference.
    sensitive_fields: [payment_token, billing_address]
    lifecycle_states: [active, expired, failed, removed]
    relationships: [belongs_to Account, creates ReplenishmentEvent]
    validation_rules:
      - raw card and bank data must never be stored in pack examples
  ReplenishmentEvent:
    description: Account funding event, retry, failure, or threshold trigger.
    sensitive_fields: [payment_status, provider_reference]
    lifecycle_states: [scheduled, succeeded, failed, retried, exhausted]
    relationships: [uses PaymentMethod, updates Account]
    validation_rules:
      - failed replenishment must not silently produce duplicate charges
  LaneEvent:
    description: Raw roadside event containing tag, plate, timestamp, lane, class, and evidence references.
    sensitive_fields: [plate_number, image_reference, tag_serial]
    lifecycle_states: [received, enriched, matched, posted, exception, rejected]
    relationships: [emitted_by Lane, may_create TripSegment, may_create ImageReviewTask]
    validation_rules:
      - event ingestion must be idempotent
  PlateImage:
    description: Image evidence for plate recognition and violation support.
    sensitive_fields: [image_uri, plate_number, vehicle_image]
    lifecycle_states: [captured, redacted, reviewed, retained, purged]
    relationships: [belongs_to LaneEvent, reviewed_by ImageReviewTask]
    validation_rules:
      - raw image access must be restricted and retention-controlled
  ImageReviewTask:
    description: Human or AI-assisted review item for OCR confidence, plate, state, class, or evidence quality.
    sensitive_fields: [image_uri, plate_number]
    lifecycle_states: [queued, ai_suggested, human_review_required, approved, rejected, escalated]
    relationships: [reviews PlateImage, updates LaneEvent]
    validation_rules:
      - low-confidence or high-risk outcomes require human review
  OcrCandidate:
    description: AI/OCR candidate plate result with confidence and reason codes.
    sensitive_fields: [plate_number]
    lifecycle_states: [candidate, selected, rejected, corrected]
    relationships: [belongs_to ImageReviewTask]
    validation_rules:
      - confidence must not be presented as final truth
  TollTransaction:
    description: Posted charge, credit, adjustment, or reversal tied to rated travel.
    sensitive_fields: [account_balance, payment_status]
    lifecycle_states: [pending, posted, adjusted, reversed, disputed, settled]
    relationships: [created_from Trip, belongs_to Account, may_create Invoice]
    validation_rules:
      - transaction posting must be idempotent and auditable
  Trip:
    description: Rated travel movement across one or more tolling events.
    sensitive_fields: [trip_history, plate_number]
    lifecycle_states: [assembled, rated, posted, exception, disputed, reversed]
    relationships: [contains TripSegment, creates TollTransaction]
    validation_rules:
      - duplicate trip detection must run before posting
  Invoice:
    description: Customer bill for posted tolls not charged to a valid prepaid account.
    sensitive_fields: [customer_name, address, amount_due, plate_number]
    lifecycle_states: [draft, issued, paid, past_due, disputed, cancelled]
    relationships: [contains TollTransaction, may_create ViolationNotice]
    validation_rules:
      - fee amounts and dates come from customer overlay
  ViolationNotice:
    description: Enforcement notice for unpaid or unauthorized toll travel.
    sensitive_fields: [plate_number, address, evidence_reference]
    lifecycle_states: [draft, issued, disputed, upheld, dismissed, collections]
    relationships: [references Invoice, may_create Dispute]
    validation_rules:
      - legal language and escalation policy come from customer overlay
  Dispute:
    description: Customer challenge to toll, fee, plate, ownership, evidence, or account state.
    sensitive_fields: [customer_statement, evidence_reference, plate_number]
    lifecycle_states: [submitted, evidence_review, awaiting_customer, resolved, appealed]
    relationships: [references Invoice, references ViolationNotice]
    validation_rules:
      - AI may recommend but not decide legal outcome without authorization
  SupportCase:
    description: Customer or operator case for account, payment, invoice, violation, roadside, or scam issue.
    sensitive_fields: [transcript, customer_contact, account_reference]
    lifecycle_states: [open, triaged, pending_customer, escalated, resolved]
    relationships: [may_reference Account, Invoice, ViolationNotice, Dispute]
    validation_rules:
      - support answers must cite policy and avoid invented commitments
  AuditEvent:
    description: Immutable trace of system, human, or AI action.
    sensitive_fields: [actor_reference, case_reference]
    lifecycle_states: [recorded]
    relationships: [records AgentAction, records TollTransaction, records Dispute]
    validation_rules:
      - money, evidence, account status, and dispute changes require audit events
```

- [ ] **Step 3: Validate entity YAML**

Run:

```bash
ruby -e 'require "yaml"; doc = YAML.safe_load_file("packs/tolling-management/entities.yaml", permitted_classes: [], aliases: false); abort("missing entities") unless doc["entities"].is_a?(Hash); abort("missing Trip") unless doc["entities"].key?("Trip"); puts "entities.yaml ok"'
```

Expected:

```text
entities.yaml ok
```

- [ ] **Step 4: Commit Task 2**

Run:

```bash
git add packs/tolling-management/domain.md packs/tolling-management/entities.yaml
git commit -m "docs(domain-packs): add tolling domain model"
```

Expected: commit succeeds with only the two Task 2 files staged.

## Task 3: Core Workflows And Agent Roles

**Files:**
- Create: `packs/tolling-management/workflows.md`
- Create: `packs/tolling-management/business-rules.md`
- Create: `packs/tolling-management/agent-roles.md`

- [ ] **Step 1: Add `workflows.md`**

Use this content:

```markdown
# Tolling Workflows

## Tag-Based Trip Posting

Trigger: a gantry or lane emits an event with a tag read.

Flow:

1. Accept lane event through an idempotent ingestion key.
2. Normalize facility, gantry, lane, timestamp, direction, and vehicle class.
3. Match transponder to home or away agency.
4. Validate account, tag, vehicle, and payment state.
5. Assemble trip or trip segment.
6. Rate against customer-owned rate policy.
7. Deduplicate against matching lane events, tag, plate, class, and time window.
8. Post toll transaction.
9. Emit audit and reconciliation events.

Edge cases:

- inactive tag
- negative balance
- transponder mounted incorrectly
- duplicate read
- mismatched vehicle class
- away-agency tag
- delayed settlement
- lane clock drift

## Video Toll / Pay-By-Plate

Trigger: a lane event lacks a valid tag match or policy requires plate evidence.

Flow:

1. Capture plate image and metadata.
2. Run OCR and vehicle-class enrichment.
3. Route high-confidence matches to auto-processing when customer policy allows it.
4. Route low-confidence, obstructed, ambiguous, or high-risk matches to image review.
5. Resolve plate to account, fleet/rental owner, DMV owner, or invoice workflow.
6. Post to account, issue invoice, or create violation path based on customer rules.

Edge cases:

- unreadable plate
- obstructed plate
- trailer/cab plate ambiguity
- temporary plate
- out-of-state owner
- rental fleet plate
- sold or stolen vehicle claim
- stale DMV address

## Invoice, Violation, Dispute, And Waiver

Flow:

1. Create invoice from eligible unpaid transactions.
2. Issue invoice through customer-owned channel policy.
3. Track due status.
4. Create violation notice when policy criteria are met.
5. Accept dispute or waiver request.
6. Review evidence, account state, payment history, and customer statement.
7. Draft recommendation.
8. Require authorized human or system approval for outcome.
9. Record audit and update case state.

Rules:

- Fee amounts, notice windows, and collections language live in customer overlay.
- AI may classify, summarize, and recommend.
- AI must not silently waive fees, dismiss violations, or move cases to collections.

## Customer Support

Supported intents:

- account recovery
- add or remove vehicle
- update plate, address, or payment method
- failed replenishment
- invoice lookup
- violation dispute
- transponder replacement
- toll text scam concern
- accessible support or language support

Agent behavior:

- Cite source or customer policy.
- Ask for human escalation when identity, payment, legal, or evidence review is involved.
- Never request raw card or bank data.
- Direct users to official agency websites or known phone numbers for suspicious toll texts.

## Roadside Operations

This pack includes only the TMS bridge needed for tolling operations.

Flow:

1. Intake incident, disabled vehicle, debris, lane closure, or safety concern.
2. Link event to facility, segment, gantry, lane, and current lane status.
3. Dispatch roadside support or notify operations.
4. Update customer messaging when lanes or facility availability change.
5. Close incident with audit trail and operational metrics.

## Interoperability And Settlement

Flow:

1. Identify whether the tag or account is home agency or away agency.
2. Exchange valid tag and plate lists through partner interface contracts.
3. Send and acknowledge away-agency transactions.
4. Reconcile accepted, rejected, duplicate, adjusted, and delayed settlement records.
5. Route exceptions to partner-specific queues.

Architecture rule:

- Partner rules belong behind interfaces. Do not scatter agency-specific conditions across trip posting, invoicing, support, or UI code.
```

- [ ] **Step 2: Add `business-rules.md`**

Use this content:

```markdown
# Tolling Business Rules

## Rule Ownership

The base pack defines rule categories. Customer overlays define actual values.

Customer-owned values include:

- toll rates
- vehicle class mapping
- HOV or managed-lane eligibility
- account replenishment thresholds
- failed payment retry policy
- invoice due windows
- violation fee amounts
- waiver eligibility
- dispute and appeal windows
- collections handoff criteria
- image retention periods
- OCR confidence thresholds
- partner settlement cutoffs

## Default Engineering Rules

- Every money-changing action requires audit.
- Every evidence-changing action requires audit.
- Event ingestion and transaction posting must be idempotent.
- Duplicate detection runs before posting.
- Account state changes require effective dates.
- Plate, owner, account, image, and payment fields are sensitive by default.
- Legal text and customer-facing deadlines must come from customer policy.
- Agents must cite policy before giving support guidance.

## Exception Rules

Route to exception queues when:

- OCR confidence is below customer threshold.
- plate and state conflict with account or DMV data.
- transponder and plate resolve to different accounts.
- vehicle class conflicts with observed class.
- duplicate transaction confidence is high.
- failed payment retry limit is reached.
- dispute changes legal or financial state.
- interoperability partner rejects or delays acknowledgement.

## Cost Rules

- Store raw images only as long as policy requires.
- Generate thumbnails for review UI.
- Cache rate tables and static facility metadata.
- Batch OCR/enrichment when real-time latency is not required.
- Track cost per 1,000 lane events, cost per image reviewed, cost per support case deflected, and cloud spend per facility.
```

- [ ] **Step 3: Add `agent-roles.md`**

Use this content:

```markdown
# Tolling AI Agent Roles

## Customer Support Agent

Purpose: answer account, invoice, payment, dispute, transponder, and scam-safety questions.

Allowed inputs: support case, redacted account state, customer policy, source notes.

Forbidden actions: request raw card data, invent deadlines, waive fees, dismiss violations, submit payments without explicit system permission.

Escalate when: identity verification, payment update, legal outcome, dispute decision, or collections status is involved.

Output: concise answer with citation, next action, and escalation flag.

## Violation Review Agent

Purpose: summarize violation evidence and recommend routing.

Allowed inputs: redacted notice data, plate evidence metadata, account state, dispute statement, customer rules.

Forbidden actions: delete evidence, issue final legal decision, move case to collections without authorization.

Escalate when: disputed ownership, unreadable evidence, stale address, legal appeal, or waiver decision appears.

Output: case summary, evidence checklist, recommendation, confidence, audit note.

## Image Review QA Agent

Purpose: assist OCR and plate-review quality.

Allowed inputs: plate image metadata, OCR candidates, confidence, reviewer corrections, synthetic fixtures.

Forbidden actions: expose raw images in benchmark reports, treat confidence as final truth, approve low-confidence cases without human review.

Escalate when: plate obstruction, trailer ambiguity, temporary plate, state mismatch, low confidence, or high-value account risk appears.

Output: suggested plate/state/class, confidence, reason codes, review action.

## Trip Posting Agent

Purpose: explain and test trip assembly, rating, posting, dedupe, and settlement behavior.

Allowed inputs: lane events, rate policy references, trip state, transaction history, partner acknowledgements.

Forbidden actions: post unreconciled duplicate charges, hardcode agency-specific partner rules in generic modules.

Escalate when: duplicate risk, account mismatch, away-agency reject, missing rate, or payment-state conflict appears.

Output: posting decision, dedupe evidence, tests to run, audit fields.

## Back-Office Ops Agent

Purpose: help operators triage queues and understand account, finance, reconciliation, and exception status.

Allowed inputs: queue metrics, redacted account summaries, reconciliation summaries, policy docs.

Forbidden actions: alter financial state or purge audit trails.

Escalate when: settlement imbalance, high retry failure, high image backlog, or policy violation appears.

Output: queue diagnosis, likely cause, recommended next action.

## Roadside Support Agent

Purpose: assist incident intake, lane status, and dispatch coordination.

Allowed inputs: facility, segment, lane status, incident type, dispatch policy.

Forbidden actions: issue unsafe instructions or override emergency procedures.

Escalate when: injury, crash, law enforcement, hazardous material, or live-lane safety risk appears.

Output: incident summary, dispatch category, linked facility/lane, safety escalation.

## Fraud And Smishing Agent

Purpose: help detect and respond to suspicious toll payment messages.

Allowed inputs: customer message text, official agency payment guidance, FTC guidance.

Forbidden actions: open unknown links, request credentials, validate non-official payment URLs.

Escalate when: customer reports credential exposure, payment-card exposure, or identity theft.

Output: scam risk, safe verification path, official-channel reminder.

## Cloud Cost Agent

Purpose: identify waste in image storage, OCR, event processing, retrieval, vendors, and model calls.

Allowed inputs: architecture notes, cost metrics, retention policy, queue volumes, benchmark results.

Forbidden actions: recommend deleting evidence before retention policy allows it.

Escalate when: savings conflict with legal retention, audit, or safety requirements.

Output: cost lever, risk, measurement path, expected metric.

## Developer Context Agent

Purpose: guide implementation using this pack plus repo graph.

Allowed inputs: selected pack sections, customer overlay, code graph, tests, docs.

Forbidden actions: ignore customer overlay, skip security guardrails, invent domain rules.

Escalate when: task requires runtime support not present in Phase 1.

Output: relevant pack sections, files, tests, risks, and benchmark scenario.
```

- [ ] **Step 4: Verify no prohibited actions are missing audit language**

Run:

```bash
rg -n "audit|Forbidden actions|Escalate when|customer overlay|idempotent|Duplicate" packs/tolling-management/workflows.md packs/tolling-management/business-rules.md packs/tolling-management/agent-roles.md
```

Expected: matches in each of the three files.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add packs/tolling-management/workflows.md packs/tolling-management/business-rules.md packs/tolling-management/agent-roles.md
git commit -m "docs(domain-packs): add tolling workflows and agents"
```

Expected: commit succeeds with only Task 3 files staged.

## Task 4: Operational Playbooks

**Files:**
- Create: `packs/tolling-management/ai-image-review.md`
- Create: `packs/tolling-management/trip-posting.md`
- Create: `packs/tolling-management/back-office-ops.md`
- Create: `packs/tolling-management/roadside-ops.md`
- Create: `packs/tolling-management/customer-support.md`
- Create: `packs/tolling-management/security-privacy.md`
- Create: `packs/tolling-management/ui-ux-patterns.md`
- Create: `packs/tolling-management/cloud-cost-playbook.md`

- [ ] **Step 1: Add `ai-image-review.md`**

Use this content:

```markdown
# AI Image Review

## Purpose

Image review converts plate evidence into trusted transaction evidence. AI may suggest plate, state, vehicle class, confidence, and reason codes, but low-confidence or high-risk outcomes require human review.

## Queue Inputs

- lane event id
- image reference
- facility, gantry, lane, timestamp
- OCR candidates
- observed vehicle class
- tag read status
- account or DMV match status
- prior corrections

## Review Decisions

- approve OCR candidate
- correct plate or state
- mark unreadable
- mark obstructed
- route trailer/cab ambiguity
- request additional evidence
- escalate to dispute or fraud review

## UI Requirements

- keyboard-first approve, reject, next, previous, zoom, contrast, rotate
- side-by-side image, OCR candidates, plate/account evidence, prior trips
- visible confidence and reason codes
- no raw customer PII beyond what review policy allows
- audit for every correction and approval

## Benchmark Signals

- review time per image
- auto-accept rate above policy threshold
- human correction rate
- false positive and false negative rates
- raw image storage cost
- low-confidence queue age
```

- [ ] **Step 2: Add `trip-posting.md`**

Use this content:

```markdown
# Trip Posting

## Purpose

Trip posting turns lane events into financial transactions. The highest-risk failures are duplicate charges, missed charges, wrong account, wrong vehicle class, wrong rate, and settlement mismatch.

## Posting Flow

1. Ingest lane event idempotently.
2. Normalize facility, gantry, lane, timestamp, direction, class, tag, and plate.
3. Match tag or plate to account or partner.
4. Assemble trip segments.
5. Rate trip through customer-owned rate policy.
6. Check duplicate candidates before posting.
7. Post transaction or create exception.
8. Emit audit, account update, and reconciliation event.

## Dedupe Keys

Use a combination of:

- agency id
- facility id
- gantry id
- lane id
- timestamp window
- tag id
- plate id
- vehicle class
- source event id
- correlation id

## Exceptions

- duplicate candidate
- missing rate
- account mismatch
- tag and plate conflict
- away-agency reject
- failed payment
- delayed event
- lane outage

## Tests To Prefer

- same event replay does not double post
- same tag within duplicate window creates one charge
- tag/plate conflict routes to exception
- away-agency transaction waits for acknowledgement
- reversal keeps audit and original transaction reference
```

- [ ] **Step 3: Add remaining operational files**

Use this content map:

```markdown
# Back-Office Operations

Back-office operations cover account management, finance, image queues, invoice queues, violation queues, disputes, reconciliation, reporting, and audit.

## Core Queues

- account exceptions
- failed replenishment
- image review
- invoice generation
- violation review
- dispute review
- partner reconciliation
- collections handoff

## Operator Metrics

- queue age
- queue volume
- first-contact resolution
- image review throughput
- failed payment retry rate
- duplicate transaction rate
- settlement imbalance
- support case deflection

## Architecture Guidance

- Keep financial accounting separate from support UI.
- Keep dynamic business rules configurable.
- Keep partner contracts behind interfaces.
- Keep audit immutable.
- Keep reports based on sanitized aggregates by default.
```

Save as `packs/tolling-management/back-office-ops.md`.

```markdown
# Roadside Operations

This file is the Tolling v1 bridge to Transportation Management. It covers only roadside operations needed by toll roads, managed lanes, and express lanes.

## Events

- disabled vehicle
- debris
- lane closure
- wrong-way or safety alert
- gantry equipment outage
- crash or emergency
- roadside assistance request

## Flow

1. Intake event.
2. Classify safety risk.
3. Link to facility, segment, gantry, lane, and timestamp.
4. Dispatch safety patrol or escalate to emergency process.
5. Update lane status and customer messaging when policy allows.
6. Close event with audit and metrics.

## Agent Safety

AI may summarize, classify, route, and draft messages. AI must not override emergency procedures, issue unsafe driving instructions, or suppress safety escalation.
```

Save as `packs/tolling-management/roadside-ops.md`.

```markdown
# Customer Support

## Supported Intents

- account access
- vehicle or plate update
- payment method update
- failed replenishment
- invoice lookup
- violation explanation
- dispute intake
- transponder replacement
- rental, sold, or stolen vehicle issue
- toll text scam concern

## Response Rules

- Cite source or customer policy.
- Avoid fee amounts, deadlines, penalties, and legal outcomes unless customer overlay supplies them.
- Never ask for raw card or bank data.
- Escalate identity, payment, dispute, collections, legal, and evidence decisions.
- For suspicious toll texts, tell users to verify through official agency websites or known phone numbers, not unknown links.

## Output Shape

- `summary`: short customer-safe answer
- `citation`: source or customer policy reference
- `next_action`: what the user can do next
- `escalate`: boolean escalation flag
- `sensitive_data_requested`: boolean safety flag
```

Save as `packs/tolling-management/customer-support.md`.

```markdown
# Security And Privacy

## Sensitive Data

Treat these as sensitive:

- license plate
- plate image
- vehicle owner
- address
- account balance
- payment status
- trip history
- support transcript
- dispute evidence
- payment provider reference

## Forbidden In Examples

- real plate numbers
- real account numbers
- real customer names
- card numbers
- bank account numbers
- raw secrets
- raw production endpoints
- raw plate images in benchmark evidence

## Agent Guardrails

- Redact by default.
- Cite policy for customer-facing claims.
- Require audit for money, evidence, account status, dispute, waiver, and collections changes.
- Require human review for low-confidence OCR and disputed outcomes.
- Prefer least privilege for support, OCR, payment, DMV, and notification integrations.
- Do not let prompt instructions override customer privacy policy.

## Threats

- context leakage across customers
- prompt leakage of plate or account data
- support agent requesting payment secrets
- fake toll payment links
- unauthorized image access
- duplicate charge through replayed event
- partner settlement tampering
```

Save as `packs/tolling-management/security-privacy.md`.

```markdown
# UI And UX Patterns

## Operator UI

Build work surfaces for repeated action:

- queue table
- saved filters
- detail panel
- evidence panel
- next action
- audit trail
- keyboard shortcuts for image review
- clear confidence and reason codes

Avoid decorative layouts that slow operators. Tolling back-office UI needs density, scanability, and predictable actions.

## Customer UI

Customer surfaces need:

- invoice lookup
- payment status
- account/vehicle update
- dispute intake
- transponder replacement
- scam warning
- accessible language
- mobile-safe forms

## Error States

Good errors say:

- what failed
- whether money or account status changed
- what the user can do next
- whether human support is needed

Errors must not leak sensitive account, plate, or payment data.
```

Save as `packs/tolling-management/ui-ux-patterns.md`.

```markdown
# Cloud Cost Playbook

## Cost Drivers

- raw image storage
- OCR and computer vision calls
- event streaming and enrichment
- payment provider calls
- notification vendor calls
- support model calls
- reporting queries over high-volume transaction tables

## Controls

- Use idempotent ingestion to prevent replay charges and wasted processing.
- Store thumbnails separately from raw images.
- Apply customer-owned image retention policy.
- Batch OCR when real-time processing is not needed.
- Cache rate tables and facility metadata.
- Use compact retrieval before large-model support answers.
- Keep vendor adapters behind contracts so redundant tools can be replaced.
- Measure cost per 1,000 lane events, per image reviewed, per support case deflected, and per facility.

## Benchmark Measures

- prompt tokens avoided
- OCR calls avoided
- duplicate postings avoided
- manual review minutes reduced
- storage cost reduced
- support cases deflected safely
```

Save as `packs/tolling-management/cloud-cost-playbook.md`.

- [ ] **Step 4: Verify sensitive-data guardrails are present**

Run:

```bash
rg -n "audit|redact|raw card|bank|human review|official agency|idempotent|thumbnails|retention" packs/tolling-management/*.md
```

Expected: matches across security, support, image review, trip posting, and cloud cost files.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add packs/tolling-management/ai-image-review.md packs/tolling-management/trip-posting.md packs/tolling-management/back-office-ops.md packs/tolling-management/roadside-ops.md packs/tolling-management/customer-support.md packs/tolling-management/security-privacy.md packs/tolling-management/ui-ux-patterns.md packs/tolling-management/cloud-cost-playbook.md
git commit -m "docs(domain-packs): add tolling operations playbooks"
```

Expected: commit succeeds with only Task 4 files staged.

## Task 5: Benchmark Scenarios

**Files:**
- Create: `packs/tolling-management/benchmark-scenarios.json`
- Create: `benchmarks/datasets/tolling-domain-pack.json`
- Create: `benchmarks/scenarios/tolling-trip-posting-dedupe.json`

- [ ] **Step 1: Add pack-local benchmark catalog**

Use this content for `packs/tolling-management/benchmark-scenarios.json`:

```json
{
  "schema_version": 1,
  "pack_id": "tolling-management",
  "scenarios": [
    {
      "id": "tolling-trip-posting-dedupe",
      "title": "Duplicate Trip Posting Prevention",
      "task_prompt": "Fix a duplicate toll posting bug when the same lane event is replayed after an acknowledgement timeout.",
      "expected_context_files": [
        "packs/tolling-management/trip-posting.md",
        "packs/tolling-management/business-rules.md",
        "packs/tolling-management/entities.yaml",
        "packs/tolling-management/security-privacy.md"
      ],
      "expected_entities": ["LaneEvent", "Trip", "TollTransaction", "AuditEvent"],
      "guardrails": [
        "posting must be idempotent",
        "duplicate detection runs before posting",
        "money-changing actions require audit"
      ],
      "roi_fields": [
        "prompt_tokens_avoided",
        "duplicate_domain_explanation_avoided",
        "implementation_defects_avoided",
        "manual_review_time_reduced",
        "cloud_or_vendor_cost_lever_identified"
      ]
    },
    {
      "id": "tolling-low-confidence-image-review",
      "title": "Low Confidence Image Review Queue",
      "task_prompt": "Add an operator queue for low-confidence OCR results with human review and audit.",
      "expected_context_files": [
        "packs/tolling-management/ai-image-review.md",
        "packs/tolling-management/ui-ux-patterns.md",
        "packs/tolling-management/entities.yaml",
        "packs/tolling-management/security-privacy.md"
      ],
      "expected_entities": ["PlateImage", "ImageReviewTask", "OcrCandidate", "AuditEvent"],
      "guardrails": [
        "low-confidence outcomes require human review",
        "raw image access is restricted",
        "review corrections create audit events"
      ],
      "roi_fields": [
        "prompt_tokens_avoided",
        "manual_review_time_reduced",
        "image_storage_cost_lever_identified",
        "support_or_operations_work_reduced"
      ]
    },
    {
      "id": "tolling-support-smishing-guidance",
      "title": "Toll Text Scam Support Guidance",
      "task_prompt": "Add a support response for customers asking whether a toll payment text message is legitimate.",
      "expected_context_files": [
        "packs/tolling-management/customer-support.md",
        "packs/tolling-management/security-privacy.md",
        "packs/tolling-management/source-notes.md"
      ],
      "expected_entities": ["SupportCase", "AgentAction", "AuditEvent"],
      "guardrails": [
        "direct users to official agency websites or known phone numbers",
        "do not validate unknown payment links",
        "do not request credentials or payment data"
      ],
      "roi_fields": [
        "prompt_tokens_avoided",
        "support_cases_deflected_safely",
        "security_risk_reduced"
      ]
    }
  ]
}
```

- [ ] **Step 2: Add benchmark dataset manifest**

Use this content for `benchmarks/datasets/tolling-domain-pack.json`:

```json
{
  "schema_version": 1,
  "id": "tolling-domain-pack",
  "title": "Tolling Management Domain Pack Dataset",
  "repo_strategy": "current-repo",
  "summary": "Static domain-pack benchmark slice covering tolling trip posting, image review, support safety, security, and ROI evidence.",
  "source_paths": [
    "packs/tolling-management",
    "docs/superpowers/specs/2026-05-02-tolling-management-domain-pack-design.md",
    "docs/06-benchmark-framework.md"
  ],
  "documents": [
    {
      "path": "packs/tolling-management/trip-posting.md",
      "title": "Trip Posting",
      "reason": "Defines idempotent posting, duplicate detection, exceptions, and tests."
    },
    {
      "path": "packs/tolling-management/business-rules.md",
      "title": "Business Rules",
      "reason": "Defines audit, idempotency, duplicate, exception, and cost rule categories."
    },
    {
      "path": "packs/tolling-management/security-privacy.md",
      "title": "Security And Privacy",
      "reason": "Defines sensitive data and audit requirements for tolling tasks."
    },
    {
      "path": "packs/tolling-management/entities.yaml",
      "title": "Entity Contract",
      "reason": "Defines LaneEvent, Trip, TollTransaction, and AuditEvent."
    }
  ],
  "reuse_targets": [
    {
      "path": "packs/tolling-management/trip-posting.md",
      "title": "Trip posting playbook",
      "reason": "Avoid re-explaining duplicate posting and idempotency every run."
    },
    {
      "path": "packs/tolling-management/entities.yaml",
      "title": "Tolling entity model",
      "reason": "Keep transaction and audit vocabulary stable across tasks."
    }
  ],
  "policy_targets": [
    "Do not invent toll rates, fee amounts, deadlines, or legal outcomes.",
    "Do not include raw customer PII, raw plate images, card data, or bank data.",
    "Require audit for money-changing, evidence-changing, account-status, dispute, waiver, and collections actions."
  ]
}
```

- [ ] **Step 3: Add flagship benchmark scenario**

Use this content for `benchmarks/scenarios/tolling-trip-posting-dedupe.json`:

```json
{
  "schema_version": 2,
  "id": "tolling-trip-posting-dedupe",
  "title": "Duplicate Toll Trip Posting Prevention",
  "category": "domain-pack-context",
  "description": "Measures whether the Tolling Management domain pack reduces repeated domain explanation and improves correctness for a high-risk duplicate toll posting task.",
  "repo": "be-ai-heart",
  "provider": "openai",
  "model": "gpt-5.4",
  "dataset_id": "tolling-domain-pack",
  "task": {
    "statement": "Fix a duplicate toll posting bug when the same lane event is replayed after an acknowledgement timeout.",
    "follow_up_prompts": [
      "Now explain which audit events prove no duplicate customer charge occurred.",
      "Show which pack sections should be included in a compact context pack for this bug."
    ]
  },
  "expected_documents": [
    "packs/tolling-management/trip-posting.md",
    "packs/tolling-management/business-rules.md",
    "packs/tolling-management/entities.yaml",
    "packs/tolling-management/security-privacy.md"
  ],
  "reuse_targets": [
    "packs/tolling-management/trip-posting.md",
    "packs/tolling-management/entities.yaml"
  ],
  "architecture_rules": [
    "Keep domain pack content under packs/tolling-management for Phase 1.",
    "Do not add runtime pack parser, CLI, MCP, portal, or admin code in this scenario.",
    "Do not invent customer-specific toll rates, fee amounts, deadlines, or legal outcomes.",
    "Money-changing actions require audit language."
  ],
  "evaluation": {
    "targets": {
      "max_tokens": 1600,
      "max_minutes": 18,
      "max_memory_refreshes": 1,
      "max_token_cost_usd": 0.32,
      "max_duplicates": 0,
      "max_policy_violations": 0,
      "max_review_edits": 2
    }
  },
  "baseline": {
    "tokens": 2800,
    "token_breakdown": {
      "prompt_tokens": 900,
      "discovery_tokens": 1000,
      "tool_tokens": 0,
      "completion_tokens": 900
    },
    "minutes": 34,
    "duplicates": 2,
    "policy_violations": 2,
    "review_edits": 7,
    "memory_refreshes": 4,
    "token_cost_usd": 0.56,
    "context_retention": {
      "checkpoints_passed": 1,
      "checkpoints_total": 4,
      "document_hits": 1,
      "document_targets": 4,
      "handoff_successes": 0,
      "handoff_attempts": 1
    },
    "duplicate_work": {
      "reuse_hits": 0,
      "reuse_targets": 2,
      "checks_passed": 1,
      "checks_total": 4,
      "duplicate_introductions": 2
    },
    "code_quality": {
      "tests_passed": 1,
      "tests_total": 4,
      "rubric_scores": {
        "correctness": 2,
        "architecture": 2,
        "reuse": 1,
        "testing": 2,
        "intent_alignment": 2
      }
    },
    "delivery": {
      "tasks_passed": 1,
      "tasks_total": 2
    },
    "prompt": "Fix duplicate toll posting when events replay after timeout.",
    "evaluation_outputs": [
      {
        "type": "review-note",
        "body": "Baseline answer re-explained tolling terms, missed audit requirements, and did not preserve the duplicate-detection keys for follow-up."
      }
    ]
  },
  "assisted": {
    "tokens": 1500,
    "token_breakdown": {
      "prompt_tokens": 420,
      "discovery_tokens": 160,
      "tool_tokens": 320,
      "completion_tokens": 600
    },
    "minutes": 17,
    "duplicates": 0,
    "policy_violations": 0,
    "review_edits": 2,
    "memory_refreshes": 1,
    "token_cost_usd": 0.3,
    "context_retention": {
      "checkpoints_passed": 4,
      "checkpoints_total": 4,
      "document_hits": 4,
      "document_targets": 4,
      "handoff_successes": 1,
      "handoff_attempts": 1
    },
    "duplicate_work": {
      "reuse_hits": 2,
      "reuse_targets": 2,
      "checks_passed": 4,
      "checks_total": 4,
      "duplicate_introductions": 0
    },
    "code_quality": {
      "tests_passed": 4,
      "tests_total": 4,
      "rubric_scores": {
        "correctness": 5,
        "architecture": 5,
        "reuse": 5,
        "testing": 4,
        "intent_alignment": 5
      }
    },
    "delivery": {
      "tasks_passed": 2,
      "tasks_total": 2
    },
    "prompt": "Use the Tolling Management domain pack to fix duplicate toll posting when events replay after timeout.",
    "tool_outputs": [
      {
        "tool": "context_pack",
        "status": "ok"
      }
    ],
    "context_pack": {
      "task": "fix duplicate toll posting replay bug",
      "token_budget": 1200,
      "estimated_tokens": 720,
      "truncated": false,
      "relevant_files": [
        {
          "path": "packs/tolling-management/trip-posting.md"
        },
        {
          "path": "packs/tolling-management/business-rules.md"
        },
        {
          "path": "packs/tolling-management/entities.yaml"
        },
        {
          "path": "packs/tolling-management/security-privacy.md"
        }
      ],
      "relevant_documents": [
        {
          "path": "docs/superpowers/specs/2026-05-02-tolling-management-domain-pack-design.md",
          "title": "Tolling Management Domain Pack Design"
        }
      ],
      "tests_to_run": [
        "ruby -e 'require \"yaml\"; YAML.safe_load_file(\"packs/tolling-management/entities.yaml\", permitted_classes: [], aliases: false)'",
        "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"packs/tolling-management/benchmark-scenarios.json\", \"utf8\"))'"
      ],
      "citations": [
        {
          "type": "domain-pack",
          "path": "packs/tolling-management/trip-posting.md",
          "reason": "Defines posting flow, dedupe keys, exceptions, and tests."
        },
        {
          "type": "domain-pack",
          "path": "packs/tolling-management/business-rules.md",
          "reason": "Defines idempotency, duplicate, audit, and cost rules."
        },
        {
          "type": "domain-pack",
          "path": "packs/tolling-management/security-privacy.md",
          "reason": "Defines money-changing audit and sensitive data guardrails."
        }
      ],
      "confidence": {
        "overall": 0.84
      }
    }
  }
}
```

- [ ] **Step 4: Validate JSON**

Run:

```bash
node -e 'for (const file of ["packs/tolling-management/benchmark-scenarios.json", "benchmarks/datasets/tolling-domain-pack.json", "benchmarks/scenarios/tolling-trip-posting-dedupe.json"]) { const doc = JSON.parse(require("node:fs").readFileSync(file, "utf8")); if (!doc.schema_version) throw new Error(`${file} missing schema_version`); } console.log("json ok")'
```

Expected:

```text
json ok
```

- [ ] **Step 5: Run benchmark tests**

Run:

```bash
npm test -- tests/benchmark.test.js
```

Expected: test command exits `0`.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add packs/tolling-management/benchmark-scenarios.json benchmarks/datasets/tolling-domain-pack.json benchmarks/scenarios/tolling-trip-posting-dedupe.json
git commit -m "docs(domain-packs): add tolling benchmark scenarios"
```

Expected: commit succeeds with only Task 5 files staged.

## Task 6: Final Validation And Drift Check

**Files:**
- Modify only if validation finds an issue in files created by Tasks 1-5.

- [ ] **Step 1: Verify pack manifest references every pack file**

Run:

```bash
ruby -e 'require "yaml"; root = "packs/tolling-management"; doc = YAML.safe_load_file("#{root}/pack.yaml", permitted_classes: [], aliases: false); missing = doc["documents"].values.reject { |path| File.exist?("#{root}/#{path}") }; abort("missing files: #{missing.join(", ")}") unless missing.empty?; puts "manifest file references ok"'
```

Expected:

```text
manifest file references ok
```

- [ ] **Step 2: Scan for obvious secret-like content**

Run:

```bash
rg -n "AKIA|BEGIN PRIVATE KEY|card_number: [0-9]|bank_account_number: [0-9]|password:|secret:|token: [A-Za-z0-9_-]{20,}" packs/tolling-management benchmarks/datasets/tolling-domain-pack.json benchmarks/scenarios/tolling-trip-posting-dedupe.json
```

Expected: no matches. If matches appear only because the text documents forbidden field names, inspect them and keep only non-secret examples such as `card_number` without values.

- [ ] **Step 3: Verify docs cite source-backed claims**

Run:

```bash
rg -n "TxDOT|FHWA|HCTRA|NTTA|405 Express Lanes|FTC|TransCore|Retrieved: 2026-05-02" packs/tolling-management/source-notes.md docs/superpowers/specs/2026-05-02-tolling-management-domain-pack-design.md
```

Expected: matches in both source notes and design spec.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit `0`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/benchmark.test.js
```

Expected: exit `0`.

- [ ] **Step 6: Capture final status**

Run:

```bash
git status --short
```

Expected: only intentional uncommitted files remain if the worker did not follow per-task commits. Existing unrelated worktree changes may appear; do not revert them.

## Self-Review Checklist

- Spec coverage: Tasks 1-5 cover base pack layout, source-backed docs, structured manifest, canonical entities, workflows, agent roles, image review, trip posting, back-office, roadside, support, security, UI/UX, cost, benchmark scenarios, and validation.
- Deferred scope: runtime parser, CLI/MCP integration, portal selector, admin surfaces, and customer overlay merge are intentionally outside Phase 1.
- Security: Task 4 and Task 6 cover sensitive fields, forbidden examples, audit, human review, and secret-like scan.
- Benchmark ROI: Task 5 defines fair baseline/assisted fields aligned with `docs/06-benchmark-framework.md`.
- QA: YAML parse, JSON parse, manifest reference check, whitespace check, and focused benchmark tests are required.
