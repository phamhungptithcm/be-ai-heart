# Tolling Sales MVP Demo Kit Plan

Status: Phase 1 static demo-kit artifacts and BeHeart pack generation are implemented. This document does not approve a production tolling runtime, live payments, OCR/image review automation, legal policy conclusions, real toll rates, or agency integrations.

Source basis:

- [FHWA Nationwide Electronic Toll Collection Interoperability](https://ops.fhwa.dot.gov/publications/fhwahop21023/fhwahop21023.pdf)
- [TxDOT Toll Roads](https://www.txdot.gov/discover/toll-roads-managed-lanes/txdot-toll-roads.html)
- [TxDOT Managed Lanes](https://www.txdot.gov/discover/toll-roads-managed-lanes/managed-lanes.html)
- [HCTRA EZ TAG Agreement](https://www.hctra.org/-/media/BF54E5D5AF9D482DBCD13A2472FDEEA9.ashx)
- [NTTA TollTag](https://www.ntta.org/get-a-tolltag)
- [NTTA Pay Your Bill](https://www.ntta.org/pay-your-bill)
- [FTC unpaid toll scam guidance](https://consumer.ftc.gov/consumer-alerts/2025/01/got-text-about-unpaid-tolls-its-probably-scam)
- [PCI DSS](https://www.pcisecuritystandards.org/standards/pci-dss/)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
- [Databox B2B SaaS landing page research](https://databox.com/landing-page-best-practices)

This plan extracts sales-relevant domain needs, buyer concerns, workflow proof points, trust signals, and demo-kit structure. It must not copy agency/vendor text, invent toll rates, imply official endorsement, or claim measured ROI before a benchmark run exists.

## Implementation Status

Phase 1 implementation status as of 2026-05-03:

| Story group | Status | Implemented artifacts |
|---|---|---|
| TOLL-SALES-1 through TOLL-SALES-4 | Done | `packs/tolling-management/sales-demo-kit/README.md`, `buyer-personas.md`, `demo-data.md`, `source-claims.md`. |
| TOLL-WEB-1 through TOLL-WEB-5 | Done | `apps/website/app/domain-demo-kits/tolling-management/page.jsx` and `page.module.css`. |
| TOLL-UI-1 through TOLL-UI-6 | Done | Back-office and customer portal prototype surfaces in the microsite plus `ui-prototype-spec.md`. |
| TOLL-SALE-ENABLE-1 through TOLL-SALE-ENABLE-4 | Done | `executive-one-pager.md`, `demo-script.md`, `proposal-starter.md`, `roi-story.md`. |
| Architecture and DB demo docs | Done | `architecture-demo.md`, `db-demo-model.md`. |
| BeHeart pack integration | Partial | CLI/MCP/API/portal builder can generate `sales-demo-kit` artifacts with manifests, citations, warnings, and selected tolling overlays. Full production runtime demo remains deferred. |

## 1. Practicality Assessment

A Tolling Sales Demo Kit is useful because domain-specific software teams often need to sell before full implementation exists. For tolling, a credible sales package must show deep operational understanding: roadside events, tag/plate matching, customer service, payments, violations, disputes, fulfillment, reporting, security, and agency-specific policy. A generic landing page is not enough.

Scoring: 1 is low, 5 is high. For implementation risk and cost to build, a high score means higher risk/cost.

| Dimension | Score | Assessment |
|---|---:|---|
| Sales usefulness | 5 | Gives founders/vendors a credible package for agency discovery, demos, design partners, and RFP starts. |
| Speed to demo | 5 | Most artifacts can be generated from the Tolling domain pack without real backend integration. |
| Customer credibility | 5 | Public tolling sources support real workflows, interoperability, customer portals, notices, and payment concerns. |
| Small-company usefulness | 5 | Helps a small vendor look prepared before it can afford a full product, proposal team, and design team. |
| Enterprise buyer trust | 4 | Strong if claims are source-backed and security-aware; weak if presented as production-ready. |
| Engineering usefulness | 4 | Architecture, DB, service map, and demo data reduce later implementation ambiguity. |
| Marketing usefulness | 5 | Produces focused messaging, screenshots, one-pager, demo script, and proposal starter. |
| Design partner usefulness | 5 | Gives concrete artifacts for feedback instead of abstract "we can build it" conversations. |
| Implementation risk | 2 | Low for docs/static prototype; risk rises only if live auth, payment, OCR, or integrations are added. |
| Cost to build | 2 | Low for docs and static UI; moderate if polished microsite and screenshots are included. |

Does this solve a real sales problem?

- Yes. Tolling buyers need to see operational credibility before they trust a vendor. The demo kit turns the domain pack into concrete sales collateral, prototype screens, architecture, and an ROI measurement story.

What is included in Phase 1:

- Executive one-pager
- Buyer personas and sales narrative
- Website/microsite copy and structure
- Interactive UI prototype spec for back office and customer portal
- Safe demo data spec
- Architecture diagram, service map, API map, DB draft, ERD
- Demo scripts for executive, product, technical, and workflow scenarios
- Proposal/RFP starter
- Benchmark/ROI hypothesis
- Source-backed claims register

What should be deferred:

- Full auth
- Real payment processing
- Real OCR/image review
- Real toll rating
- Real agency integrations
- Proposal auto-generation from live customer RFPs
- Hosted multi-tenant demo-kit builder

Fastest to build:

- A static sales-demo kit under `packs/tolling-management/sales-demo-kit/`
- A polished static microsite route or small app using fake data
- One Agent Account 360 preview, one customer pay-bill preview, and one workflow/architecture diagram

Strongest customer impression:

- A credible Agent Account 360 screen backed by a clean roadside-to-back-office story, PCI-safe payment posture, scam-safe notification guidance, and a clear "pilot benchmark will measure this" ROI section.

What can be generated from the Tolling domain pack:

- Domain narrative, module list, buyer pain, workflows, glossary, back-office screens, customer portal screens, security notes, DB/service drafts, demo scripts, benchmark scenarios, and agency overlay examples.

What requires real backend/runtime later:

- Live data loading, authentication, permission checks, payment capture, OCR/manual review queues, event ingestion, trip posting, rating, notices, audit writes, reporting jobs, integrations, and measured benchmark telemetry.

## 2. Sales MVP Product Outcome

When a software company chooses the Tolling Management pack, beheart should help produce a demo kit that lets them say:

> "We understand tolling operations, customer service, payments, roadside events, violations, disputes, and agency-specific workflows. Here is a credible MVP direction we can show and customize quickly."

The demo kit should support:

- Discovery calls: align on agency pain, current systems, policy variation, and priority workflows.
- Sales demos: show a polished product direction without pretending it is production-ready.
- Design partner conversations: collect feedback on workflows, screens, data, integrations, and rollout.
- RFP responses: accelerate capability matrix, architecture response, assumptions, security notes, and implementation phases.
- Technical due diligence: show architecture, service boundaries, DB model, audit posture, and benchmark plan.
- Investor/customer pitch: explain why vertical domain memory speeds sales and implementation.
- Implementation planning: convert demo artifacts into stories, APIs, data model, and validation steps.

Outcome quality bar:

- Customer sees real tolling terminology and workflows.
- Buyer can identify where their agency overlay would change the demo.
- Engineering can see which parts are static demo vs future runtime.
- ROI copy says "designed to measure" or "hypothesis" until evidence exists.
- Security copy avoids unsupported compliance claims.

## 3. Buyer Personas

| Persona | What they care about | Pain points | What demo should show | Proof they need | Objections | Trust signals |
|---|---|---|---|---|---|---|
| Toll agency CTO | Architecture, integrations, security, uptime, vendor risk. | Legacy systems, integration sprawl, audit gaps, long delivery cycles. | Service map, event flow, DB draft, security boundaries, phased rollout. | Clear boundaries, API map, PCI-safe payment posture, source-backed assumptions. | "This is just a mockup." "How does this fit our stack?" | Architecture diagram, no overclaims, migration path, source citations. |
| Toll agency operations director | Queue throughput, exceptions, SLA, roadside-to-back-office flow. | Manual work, image review backlog, duplicate trips, support escalations. | Workflow timeline, exception queues, Account 360, reports dashboard. | Operational metrics planned, failure modes, queue states. | "Will this handle our policy?" | Agency overlay model, configurable rules, demo data, scenario scripts. |
| Customer service director | Handle time, first-contact resolution, scripts, customer trust. | Agents switch systems, policy confusion, disputes, scam calls. | Account 360, customer search, case flow, scam-safe notification script. | Allowed actions, identity verification, audit trail, escalation rules. | "Agents will still need five systems." | Single cockpit preview, policy citations, customer-friendly copy. |
| Finance/payment leader | Ledger accuracy, PCI scope, refunds, chargebacks, reconciliation. | Duplicate charges, manual adjustments, processor errors, audit pressure. | Funds/payment panel, ledger-safe adjustment story, reconciliation report. | Tokenization, idempotency, approval thresholds, audit logs. | "Payment risk is too high for demo." | PCI DSS source note, no raw card data, hosted payment assumption. |
| Roadside operations leader | Device health, event intake, image review, lane exceptions. | Device outages, noisy event feeds, uncertain plate reads. | Roadside-to-back-office flow and exception queue preview. | Event dedupe, raw event traceability, image review audit. | "This ignores roadside reality." | FHWA-aligned event/back-office model, failure-mode table. |
| Procurement/RFP team | Capability coverage, risk, implementation approach, references. | Hard to compare vendors, vague responses, missing assumptions. | Capability matrix, phased rollout, assumptions/open questions. | RFP starter, security notes, integration checklist. | "Can this become a formal response?" | Clear matrix, no unsupported claims, source-backed claims register. |
| Private toll operator | Concession reporting, SLA, revenue share, agency reporting. | Contract reporting, multi-party operations, vendor handoffs. | Private operator overlay, reports, fulfillment/vendor integration map. | SLA/report examples and permission model. | "Our contract is different." | Overlay customization and customer-specific pack. |
| Software vendor founder | Fast credibility, demos, proposals, screenshots, roadmap. | Needs customers before full build; limited product/design resources. | Microsite, one-pager, prototype screens, demo script. | Fast file structure, reusable copy, fake data, clear next stories. | "Can I use this in a call next week?" | 3-7 day MVP slice and screenshot-ready screens. |
| Implementation partner | Scope clarity, delivery plan, integration checklist, migration. | Ambiguous requirements and underestimated back-office details. | Phased roadmap, service map, DB/API draft, open questions. | Story backlog, acceptance criteria, validation plan. | "Sales demo will overpromise." | Explicit defer list and runtime-needed boundaries. |

## 4. Sales Demo Kit Contents

### 4.1 Executive One-Pager

The one-pager should explain:

| Section | Content |
|---|---|
| Problem | Tolling programs need reliable back-office, customer service, payment, dispute, roadside, and reporting workflows; sales teams need to show this understanding before full implementation. |
| Solution | A source-backed Tolling Domain Demo Kit that turns durable domain memory into customer-ready sales, product, design, and technical artifacts. |
| Modules | Account 360, customer portal, trip/toll review, invoices/payments, violations/disputes/cases, inventory/fulfillment, notification center, reports, architecture/security. |
| Value | Faster discovery, faster demo creation, better buyer conversations, fewer missed requirements, clearer implementation scope. |
| Rollout phases | Phase 1 static demo kit; Phase 2 customizable agency overlay; Phase 3 runtime prototype; Phase 4 pilot benchmark. |
| Security posture | No real PII, no real plates, no real payment data, PCI-safe payment assumption, scam-safe notification guidance, audit-first workflows. |
| ROI hypothesis | Designed to measure time-to-demo, time-to-prototype, token savings, reduced duplicate prompting, and improved requirement coverage. |

### 4.2 Marketing Website / Microsite

The microsite should be polished enough for screenshots and customer calls, but clear that it is a demo direction.

Pages/sections:

| Section | Purpose | Key content |
|---|---|---|
| Hero | State the vertical value fast. | "A tolling back-office and customer portal demo kit your team can customize in days, not months." |
| Problem | Make buyer pain visible. | Legacy workflows, expensive support, payment risk, violation disputes, roadside event complexity, sales-cycle friction. |
| Solution | Show the kit. | Domain-backed website, UI prototype, architecture, DB/API map, scripts, proposal starter, ROI hypothesis. |
| Back-office modules | Build confidence in operations. | Account 360, case management, payments, inventory, fulfillment, notifications, reporting. |
| Customer portal | Show customer self-service. | Account home, pay bill, trips/tolls, disputes, vehicles/tags, scam guidance. |
| Agent Account 360 | Primary product proof. | Verification, account summary, funds, vehicles, trips, invoices, cases, eligible actions, audit trail. |
| Roadside-to-back-office flow | Show tolling domain depth. | Event capture, tag/plate match, OCR review, trip building, rating, posting, invoice/violation, payment, dispute, reporting. |
| Security and payments | Establish trust. | PII redaction, no raw card data, payment tokenization assumption, audit, least privilege. |
| Benchmark/ROI | Avoid vague claims. | "Pilot benchmark can compare baseline vs pack-assisted workflows." |
| Demo request CTA | Convert interest. | "Review the Tolling Demo Kit" or "Plan a 30-minute tolling workflow demo." |
| Implementation roadmap | Set expectations. | Static kit, customized overlay, clickable prototype, runtime MVP, pilot benchmark. |

Tone:

- Natural American English
- Friendly, professional, clear, confident
- No hype
- No unsupported claims
- Use source-backed domain language, not generic AI buzzwords

### 4.3 Interactive UI Prototype

Prototype screens:

| Screen | Purpose | Demo interactions |
|---|---|---|
| Agent Account 360 | Show unified support cockpit. | Verify identity, review balance, explain trip, open dispute, order replacement tag, add case note. |
| Customer search | Show fast lookup and ambiguity handling. | Search by fake account, masked plate, fake transponder, phone/email. |
| Account funds/payment panel | Show payment trust. | Add funds demo, failed payment state, refund/adjustment approval-needed state. |
| Trips/tolls/invoices | Show billing traceability. | Trip detail, rate snapshot, invoice line, pay-by-mail/video toll example. |
| Violations/disputes/cases | Show support depth. | Create dispute, view evidence placeholder, SLA, notes, resolution. |
| Inventory/transponder fulfillment | Show physical operations. | Reserve fake tag, pick/pack/ship, replacement flow, return. |
| Notification center | Show communication governance. | Template preview, consent state, official payment guidance, delivery status. |
| Reports dashboard | Show buyer-level operations. | Revenue, queue age, image review, payment failures, case SLA, fulfillment throughput. |
| Customer portal home | Show self-service. | Balance, invoices, trips, vehicles, cases, alerts. |
| Customer pay bill flow | Show PCI-safe flow. | Hosted-payment placeholder, receipt, official link messaging. |
| Customer dispute flow | Show customer issue handling. | Select trip/invoice, reason, upload fake evidence, track case. |

### 4.4 Architecture and DB Design

Required design artifacts:

- System architecture diagram
- Roadside-to-back-office workflow
- Service map
- API map
- Postgres schema draft
- ERD
- Event flow
- Audit/security boundaries

Diagram expectations:

- Use Mermaid for docs.
- Use screenshot-ready visual diagrams for website later.
- Keep payment, PII, plate images, audit logs, and tenant overlays as explicit boundaries.
- Mark demo-only components vs future runtime services.

### 4.5 Demo Data

Create safe fake/demo data:

| Data type | Examples | Rules |
|---|---|---|
| Accounts | `DEMO-ACCT-1001`, `DEMO-FLEET-2040` | No real account numbers. |
| Customers | `Jordan Demo`, `Avery Sample`, `Northline Demo Fleet` | Clearly fake names. |
| Vehicles | `2024 Demo Sedan`, `Demo Fleet Van` | No VINs beyond fake suffixes. |
| Plates | `DEMO123`, `SAMPLE9`, `FAKE404` | Obvious fake values only. |
| Transponders | `TAG-DEMO-0001`, `TAG-SAMPLE-0042` | No real serials. |
| Trips | Fake facility and timestamp records | No real trip histories tied to people. |
| Invoices | `INV-DEMO-9001` | Amounts labeled demo-only. |
| Payments | `PAY-DEMO-OK`, `PAY-DEMO-FAIL` | No card numbers; token placeholders only. |
| Cases | `CASE-DEMO-301` | Fake notes and evidence placeholders. |
| Inventory | `SKU-DEMO-STICKER`, `TAG-DEMO-RESERVED` | Fake serials. |
| Notifications | `EMAIL-DEMO-SENT`, `SMS-DEMO-OPTED-OUT` | No real phone/email. |

No real PII. No real plates. No real payment data. No screenshots of real agency portals unless the source license and attribution allow it.

### 4.6 Demo Script

| Script | Audience | Flow |
|---|---|---|
| 5-minute executive demo | CTO, operations, founder, investor | Problem, demo kit outcome, Account 360 preview, workflow diagram, security/ROI hypothesis, next step. |
| 15-minute product demo | Ops, customer service, product | Account search, Account 360, trip explanation, payment/funds, dispute, fulfillment, report preview. |
| 30-minute technical demo | CTO, architect, implementation partner | Domain pack inputs, pack-to-demo generation, architecture, DB/API map, security boundaries, benchmark plan. |
| Customer service call scenario | Service director | "Customer asks why they received a bill." Agent verifies identity, explains trip/invoice, takes safe action. |
| Dispute handling scenario | Case analyst | Customer disputes a toll; analyst reviews fake evidence, policy, audit, and resolution. |
| Transponder replacement scenario | Fulfillment/ops | Agent identifies non-reading tag, orders replacement, reserves inventory, creates shipment. |
| Payment/funds scenario | Finance/support | Failed auto-replenishment, add funds, payment retry, audit, notification. |

### 4.7 Proposal / RFP Starter

Required sections:

- Capability matrix
- Implementation phases
- Assumptions
- Security notes
- Integration checklist
- Data migration checklist
- Rollout timeline
- Open questions

Proposal posture:

- Be clear this is a starter, not legal or final procurement language.
- Separate "supported by demo kit" from "requires runtime implementation."
- Mark agency-specific policy values as open until the buyer provides source documents.
- Include a source-backed claims table.

### 4.8 Benchmark / ROI Story

Do not claim proven numbers unless evidence exists.

Use language like:

- "designed to measure"
- "pilot benchmark can compare"
- "hypothesis"
- "expected measurement path"
- "observed after benchmark run"

Metrics:

| Metric | Measurement path | MVP status |
|---|---|---|
| Time to prototype | Compare baseline manual asset creation vs demo-kit-assisted creation. | Hypothesis. |
| Token savings for implementation team | Compare prompts with and without domain pack and demo kit context. | Hypothesis until benchmark. |
| Reduced duplicate work | Track repeated domain explanation avoided and reuse of generated artifacts. | Hypothesis. |
| Fewer missed requirements | Score demos against tolling workflow checklist. | Designed to measure. |
| Better docs/spec alignment | Compare website/proposal/prototype against source claims and domain pack. | Designed to measure. |
| Support agent workflow completeness | Rubric for Account 360, cases, payments, audit, identity verification. | Designed to measure. |

## 5. beheart Feature Design

Feature name options:

- Domain Demo Kit
- Sales MVP Pack
- Vertical Demo Pack
- Customer Pitch Pack
- Pack Showcase

Recommended feature: `Domain Demo Kit`.

Why:

- It is broad enough for future industry packs.
- It describes output, not just sales.
- It can include website, prototype, docs, scripts, proposal, ROI, and architecture artifacts.
- It avoids implying a production runtime.

Future CLI ideas:

```bash
heart demo-kit create tolling-management
heart demo-kit create tolling-management --agency texas
heart demo-kit website tolling-management
heart demo-kit prototype tolling-management
heart demo-kit proposal tolling-management
heart demo-kit benchmark tolling-management
```

This should stay future CLI. For now, plan docs/artifacts first.

Feature boundaries:

| Boundary | MVP | Later |
|---|---|---|
| Artifact structure | Static files under pack. | CLI generator. |
| Website | Static microsite plan/copy; optional app after approval. | Customizable generated site. |
| UI prototype | Spec and fake data first. | Clickable React prototype. |
| Architecture | Mermaid/docs diagrams. | Rendered diagrams and downloadable deck. |
| Proposal | Markdown starter. | Customer-specific proposal generation. |
| Benchmark | Scenario/hypothesis docs. | Observed benchmark runs and reports. |

## 6. Pack-to-Demo Compilation

Inputs:

- Core tolling pack
- Regional layer
- Agency overlay
- Customer overlay
- Source notes
- Docs/specs
- DB model
- UI screen specs
- Benchmark scenarios

Outputs:

- Website copy
- Demo page structure
- UI prototype spec
- Architecture diagrams
- DB ERD
- Executive one-pager
- Proposal starter
- Demo script
- Benchmark story

Artifact list and suggested paths:

| Output artifact | Path | Depends on |
|---|---|---|
| README | `packs/tolling-management/sales-demo-kit/README.md` | Domain pack overview. |
| Buyer personas | `packs/tolling-management/sales-demo-kit/buyer-personas.md` | Persona section and source notes. |
| Executive one-pager | `packs/tolling-management/sales-demo-kit/executive-one-pager.md` | Problem, solution, ROI hypothesis. |
| Demo script | `packs/tolling-management/sales-demo-kit/demo-script.md` | Prototype screens and workflows. |
| Proposal starter | `packs/tolling-management/sales-demo-kit/proposal-starter.md` | Capability matrix, assumptions, phases. |
| ROI story | `packs/tolling-management/sales-demo-kit/roi-story.md` | Benchmark framework and scenarios. |
| Demo data | `packs/tolling-management/sales-demo-kit/demo-data.md` | Security/privacy and prototype screens. |
| Source claims | `packs/tolling-management/sales-demo-kit/source-claims.md` | Official/credible sources. |
| Website copy | `packs/tolling-management/sales-demo-kit/website-copy.md` | Buyer narrative and module map. |
| UI prototype spec | `packs/tolling-management/sales-demo-kit/ui-prototype-spec.md` | UI/UX plan and fake data. |

Generation order:

1. Source claims register
2. Buyer personas
3. Sales narrative and one-pager
4. Demo data spec
5. UI prototype spec
6. Architecture/DB/API diagrams
7. Website copy
8. Demo scripts
9. Proposal/RFP starter
10. ROI/benchmark story

Source citation rules:

- Cite official/agency sources for tolling domain claims.
- Cite PCI/NIST for payment/privacy/security posture.
- Cite B2B landing research only for website/demo UX principles, not tolling claims.
- Every numeric performance/ROI claim must be either source-backed or labeled hypothesis.
- Agency names like TxDOT, HCTRA, NTTA, and 405 Express Lanes can be used only as public examples, not endorsements.

Unsupported claim detection:

- Flag phrases such as "guaranteed savings", "PCI compliant", "agency approved", "production ready", "real-time at scale", "universal tolling workflow", and "works with every toll agency" unless backed by explicit evidence.
- Flag unqualified legal, collections, fee, notice, toll-rate, or retention statements.
- Flag claims that imply measured ROI when the artifact only contains a hypothesis.

Stale content detection:

- Store `retrieved_at`, source URL, section, and last reviewed date for every source-backed claim.
- Mark toll rates, fee amounts, payment options, agency policies, and managed lane rules as high-staleness.
- Require review before customer-facing export if a high-staleness source is older than configured threshold.

## 7. Website MVP Plan

Recommended repo fit:

- Prefer adding a route/section under `apps/website` for first implementation if approved, because the repo already has a public website surface.
- Use `apps/tolling-demo-site/` only if the demo needs a standalone deployable artifact with independent branding and dependencies.

Suggested structure:

```text
apps/website/app/domain-demo-kits/tolling-management/
  page.jsx
  components/
    TollingDemoHero.jsx
    TollingModuleShowcase.jsx
    TollingAccount360Preview.jsx
    TollingCustomerPortalPreview.jsx
    TollingWorkflowDiagram.jsx
    TollingArchitecturePreview.jsx
    TollingSecurityRoi.jsx
```

Website should include:

- Polished landing page
- Module overview
- Agent Account 360 preview
- Customer portal preview
- Workflow diagram
- Architecture preview
- Security/privacy page or section
- Demo CTA

Must be:

- Responsive
- Professional
- Smooth subtle animation
- Not generic AI design
- Good for screenshots
- Good for customer calls
- Easy to customize per agency/operator

Content principles:

- Lead with tolling buyer pain, not AI novelty.
- Show product visuals early.
- Use one primary CTA and one secondary CTA at most.
- Keep copy focused on a specific vertical audience.
- Do not bury security, source basis, or implementation boundaries.
- Make demo-only status visible without weakening the sales story.

## 8. Design System Direction

UI feel:

- Enterprise SaaS
- Clean operations dashboard
- Trust-heavy
- High signal
- Not flashy
- Smooth animation
- Readable data tables
- Clear status badges
- Accessible colors
- Natural American English

Visual direction:

- Dense but calm layouts for operator screens.
- Light or neutral base with restrained accent color; avoid one-note blue/purple gradient SaaS look.
- Clear table rows, side panels, and status chips.
- Use real product-like UI previews, not decorative abstract illustrations.
- Use subtle motion for workflow progression, hover states, and section reveal; no distracting animation.

Components:

| Component | Purpose |
|---|---|
| `MetricCard` | Show demo-kit outcomes and benchmark hypotheses. |
| `ModuleCard` | Explain back-office/customer portal modules. |
| `WorkflowTimeline` | Roadside-to-back-office event flow. |
| `Account360Preview` | Primary proof screen for call-center workflow. |
| `CaseQueuePreview` | Dispute/case SLA and queue preview. |
| `PaymentPanelPreview` | Funds, payment, refund, and audit-safe actions. |
| `InventoryStatusPreview` | Transponder stock and status summary. |
| `FulfillmentQueuePreview` | Replacement/shipping flow. |
| `ReportPreview` | Revenue, cases, events, aging, and operations KPIs. |
| `SecurityBadge` | PCI-safe, PII redaction, audit, scam-safe notification notes. |
| `DemoCTA` | Focused call to action. |
| `ArchitectureDiagram` | Service/event/security boundary view. |
| `ERDPreview` | DB relationship preview. |

Accessibility:

- High contrast text and status colors.
- Keyboard navigable prototype controls.
- No color-only status meaning.
- Mobile tables collapse to cards or summary rows.
- Text must fit across desktop/mobile screenshots.

## 9. Fastest MVP Slice

3-7 day MVP:

1. Tolling demo microsite
2. Agent Account 360 mock/demo screen
3. Customer portal mock/demo screen
4. Back-office module overview
5. DB/architecture diagram
6. Demo script
7. Proposal one-pager
8. Benchmark/ROI hypothesis
9. Source notes

Day-level sequence:

| Day | Output |
|---|---|
| Day 1 | Sales narrative, source claims, buyer personas, artifact structure. |
| Day 2 | One-pager, proposal starter, demo scripts, demo data. |
| Day 3 | Microsite copy and layout spec. |
| Day 4 | Account 360 and customer portal prototype spec/screens. |
| Day 5 | Architecture/DB/API diagrams and ROI story. |
| Days 6-7 | Polish, responsive review, screenshot QA, source-claim validation. |

Explicit exclusions:

- No full auth
- No real payment
- No real OCR
- No real agency integration
- No production PII
- No production claims

## 10. Implementation Stories

### Epic 1: Sales Demo Kit Foundation

| Story ID | User story | Buyer/user persona | Business value | Acceptance criteria | Files likely touched | Functions/components affected | Docs needed | Tests/validation | Priority | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|
| TOLL-SALES-1 | As a vendor founder, I need a stable demo-kit artifact structure. | Software vendor founder | Makes assets repeatable and reusable. | `sales-demo-kit/` structure documented with artifact purposes and generation order. | `packs/tolling-management/sales-demo-kit/README.md` | Future `heart demo-kit create` | README | File presence and link check. | P0 | Structure is clear, static, and does not require runtime. |
| TOLL-SALES-2 | As a salesperson, I need buyer personas and sales narrative. | Vendor founder, implementation partner | Helps demos speak to CTO, ops, service, finance, procurement. | Persona docs cover care-abouts, pain, proof, objections, trust signals. | `buyer-personas.md`, `website-copy.md` | None | Persona docs | Review for clear audience and no hype. | P0 | Narrative maps to tolling buyer pains. |
| TOLL-SALES-3 | As a demo builder, I need safe fake demo data. | Engineering team | Enables screenshots without PII risk. | Demo data uses obvious fake accounts, plates, tags, payments, cases, inventory. | `demo-data.md` | Future demo fixtures | Demo data docs | PII/plate/payment lint checklist. | P0 | No real PII, plates, payment data, or production endpoints. |
| TOLL-SALES-4 | As a reviewer, I need source-backed claims and citation rules. | Procurement/RFP team | Improves trust and reduces overclaim risk. | Claim register maps claim, source, date, allowed use, stale risk. | `source-claims.md` | Future claim validator | Source claims docs | Unsupported-claim scan. | P0 | Customer-facing claims are cited or labeled hypothesis. |

### Epic 2: Tolling Demo Website

| Story ID | User story | Buyer/user persona | Business value | Acceptance criteria | Files likely touched | Functions/components affected | Docs needed | Tests/validation | Priority | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|
| TOLL-WEB-1 | As a founder, I need a polished tolling microsite. | Vendor founder | Creates customer-ready first impression. | Landing page includes hero, problem, solution, modules, CTA. | `apps/website/app/domain-demo-kits/tolling-management/page.jsx` | `TollingDemoHero`, `DemoCTA` | Website copy | Build and screenshot checks. | P0 | Page is responsive, clear, screenshot-ready. |
| TOLL-WEB-2 | As an ops buyer, I need back-office module showcase. | Operations director | Shows operational depth. | Modules cover Account 360, cases, payments, inventory, fulfillment, notifications, reports. | Website route/components | `TollingModuleShowcase` | Module copy | Visual QA and copy review. | P0 | Modules are tolling-specific and not generic. |
| TOLL-WEB-3 | As a customer service buyer, I need customer portal showcase. | Customer service director | Shows self-service deflection potential. | Portal preview shows pay bill, trips, vehicles/tags, disputes, notifications. | Website components | `TollingCustomerPortalPreview` | Portal copy | Responsive QA. | P1 | Preview is credible without real backend. |
| TOLL-WEB-4 | As a CTO/finance buyer, I need security/ROI sections. | CTO, finance leader | Builds trust and avoids overclaims. | Security and ROI copy cites PCI/NIST/benchmark plan and labels hypotheses. | Website components | `TollingSecurityRoi` | ROI story | Claim scan. | P0 | No compliance or measured-ROI overclaim. |
| TOLL-WEB-5 | As a sales user, I need polish and animation. | Vendor founder | Improves screenshots and live calls. | Mobile, desktop, subtle motion, accessible color, no text overlap. | CSS/components | All microsite components | UI notes | Browser screenshots and accessibility basics. | P1 | Page works across target viewports. |

### Epic 3: UI Prototype

| Story ID | User story | Buyer/user persona | Business value | Acceptance criteria | Files likely touched | Functions/components affected | Docs needed | Tests/validation | Priority | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|
| TOLL-UI-1 | As a service director, I need Agent Account 360 prototype. | Customer service director | Primary demo proof. | Shows verification, account, funds, trips, invoices, cases, tags, actions, audit. | Prototype spec/components | `Account360Preview` | UI prototype spec | Screenshot and content review. | P0 | Screen tells a complete call-center story. |
| TOLL-UI-2 | As a case analyst, I need case management prototype. | Case analyst | Shows dispute workflow maturity. | Shows case queue, evidence placeholder, SLA, notes, resolution. | Prototype spec/components | `CaseQueuePreview` | Case workflow docs | Security/evidence review. | P1 | Evidence is fake and access notes visible. |
| TOLL-UI-3 | As finance, I need payment/funds prototype. | Finance/payment leader | Builds payment trust. | Shows tokenized payment placeholder, ledger entries, approval states. | Prototype spec/components | `PaymentPanelPreview` | Payment notes | PCI-safe review. | P0 | No raw payment data appears. |
| TOLL-UI-4 | As fulfillment, I need inventory/fulfillment prototype. | Fulfillment operator | Shows physical tag operations. | Shows stock, reservation, replacement, shipment, return states. | Prototype spec/components | `InventoryStatusPreview`, `FulfillmentQueuePreview` | Inventory notes | Fake serial check. | P1 | Flow maps to demo data. |
| TOLL-UI-5 | As operations, I need reports prototype. | Operations director | Shows management visibility. | Shows events, trips posted, aging, cases, payments, fulfillment KPIs. | Prototype spec/components | `ReportPreview` | Reporting notes | Label all metrics demo-only. | P2 | KPI cards avoid unsupported claims. |
| TOLL-UI-6 | As a customer, I need customer portal prototype. | Tolling customer | Shows self-service value. | Shows account home, pay bill, trip detail, dispute, vehicles/tags, preferences. | Prototype spec/components | `TollingCustomerPortalPreview` | Portal flow docs | Mobile QA. | P1 | Portal is clear and scam-safe. |

### Epic 4: Sales Enablement

| Story ID | User story | Buyer/user persona | Business value | Acceptance criteria | Files likely touched | Functions/components affected | Docs needed | Tests/validation | Priority | Definition of done |
|---|---|---|---|---|---|---|---|---|---|---|
| TOLL-SALE-ENABLE-1 | As a founder, I need an executive one-pager. | CTO, procurement, founder | Enables quick outreach and follow-up. | One-pager covers problem, solution, modules, phases, security, ROI hypothesis. | `executive-one-pager.md` | None | One-pager | Copy and claim review. | P0 | One-pager can be sent after a call. |
| TOLL-SALE-ENABLE-2 | As a sales lead, I need demo scripts. | Vendor founder | Makes demos consistent. | Scripts for 5, 15, 30 minutes and workflow scenarios. | `demo-script.md` | None | Script docs | Walkthrough review. | P0 | Scripts match prototype screens. |
| TOLL-SALE-ENABLE-3 | As an implementation partner, I need proposal/RFP starter. | Procurement/RFP team | Speeds formal opportunity response. | Capability matrix, phases, assumptions, security, integrations, migration, timeline, open questions. | `proposal-starter.md` | None | Proposal docs | Completeness review. | P1 | Clearly separates demo vs runtime. |
| TOLL-SALE-ENABLE-4 | As a product owner, I need benchmark/ROI story. | CTO, investor, founder | Makes value measurable. | ROI story uses hypothesis language and maps to benchmark framework. | `roi-story.md` | Future benchmark scenarios | ROI docs | Overclaim scan. | P0 | No proven-number claim without evidence. |

## 11. File Structure

Recommended structure:

```text
packs/
  tolling-management/
    sales-demo-kit/
      README.md
      buyer-personas.md
      executive-one-pager.md
      demo-script.md
      proposal-starter.md
      roi-story.md
      demo-data.md
      source-claims.md
      website-copy.md
      ui-prototype-spec.md

apps/
  website/
    app/
      domain-demo-kits/
        tolling-management/
          page.jsx
          components/

docs/
  specs/
    tolling-sales-mvp-demo-kit-plan.md
```

Alternative standalone app:

```text
apps/
  tolling-demo-site/
```

Use standalone only if the demo needs separate deployment, dependencies, or visual identity. Otherwise prefer `apps/website` to reuse existing public surface patterns.

## 12. Validation Plan

Validate:

| Check | Method |
|---|---|
| No fake customer PII accidentally looks real | Review demo data for obvious fake names, plates, accounts, tags, emails, phones, addresses. |
| No real plates/payment data | Use explicit fake patterns like `DEMO`, `SAMPLE`, `FAKE`; no card numbers; token placeholders only. |
| Source-backed claims only | Maintain `source-claims.md`; run unsupported-claim checklist. |
| Website builds | Run repo build or targeted app build after implementation. |
| Screenshots look good | Use browser screenshots at desktop and mobile widths. |
| Copy is clear and natural | Review against buyer personas and remove hype. |
| Mobile responsive | Check hero, tables, previews, CTA, diagrams. |
| Accessibility basics | Check contrast, headings, keyboard focus, alt text, no color-only status. |
| Demo script matches UI | Walk scripts against prototype states. |
| Architecture diagram matches DB/service docs | Cross-check services, data stores, event flow, and security boundaries. |
| ROI claims labeled correctly | All unmeasured numbers are removed or labeled hypothesis. |

Docs-only validation for this plan:

- File exists at `docs/specs/tolling-sales-mvp-demo-kit-plan.md`.
- Main sections `1` through `13` exist.
- No unresolved placeholder markers.
- `git diff --check` passes for this file.

## 13. Final Recommendation

beheart should add `Domain Demo Kit` support.

Why this helps sales fast:

- It turns domain memory into customer-facing proof.
- It gives small vendors a credible demo package before full implementation.
- It reduces sales-prep time across docs, website copy, UI mockups, architecture, proposal, and demo scripts.
- It keeps claims safer by tying them to source notes and benchmark hypotheses.

What to build first:

- Static `packs/tolling-management/sales-demo-kit/` artifacts.
- Website copy and microsite plan.
- Agent Account 360 and customer portal prototype specs.
- Demo data rules.
- Source claims register.
- Executive one-pager, demo scripts, proposal starter, ROI story.

What to defer:

- CLI generation.
- Hosted builder.
- Runtime auth, payment, OCR, event ingestion, rating, posting, audit writes, integrations.
- Measured ROI claims until benchmark evidence exists.

How this helps small software companies sell before full implementation:

- They can show a polished, domain-specific product direction in days.
- They can run better discovery calls with buyer-specific screens and scripts.
- They can answer technical due diligence with architecture and DB/API drafts.
- They can start RFP responses with a capability matrix and assumptions.
- They can collect design-partner feedback before spending on full build.

How this becomes reusable for other industry packs:

- `Domain Demo Kit` becomes a standard output layer for any domain pack.
- Each pack can compile source notes, personas, workflows, screens, architecture, demo data, proposal, and ROI story.
- The same validation model applies: no fake PII that looks real, no unsupported claims, no measured ROI without evidence, and clear demo-vs-runtime boundaries.

Next approved implementation plan should create the sales-demo-kit docs first, then optionally build a screenshot-ready microsite using the existing `apps/website` surface.
