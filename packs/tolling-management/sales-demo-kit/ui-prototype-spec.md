# UI Prototype Spec

The prototype must feel like enterprise operations software: dense, calm, readable, and safe. Every screen uses fake demo data and labels ROI as hypothesis where shown.

## Global UI Rules

- Show "Demo data" on operational previews.
- Use clear status badges for risk, action, SLA, and payment state.
- Avoid decorative layouts that hide the workflow.
- Keep actions visible but mark runtime-required actions.
- Include empty, loading, error, and permission-denied state notes in implementation.
- Use responsive layouts that work for screenshots on desktop and mobile.

## Back-Office Screens

| Screen | Primary user | Data shown | Actions | Safety notes |
|---|---|---|---|---|
| Customer search | Agent | Account ID, fake plate, fake transponder, confidence, status. | Select account, refine search, open new case. | Mask identifiers; avoid broad search without role. |
| Agent Account 360 | Agent | Verified identity, balance, vehicles, plates, tags, trips, invoices, cases, notifications, audit. | Add note, open dispute, pay bill placeholder, order replacement tag. | Risky actions need auth, policy, and audit in runtime. |
| Funds/payment panel | Agent/finance | Balance, token placeholder, payments, refunds, failed replenishment, ledger entries. | Add funds placeholder, refund request, adjustment request. | No raw payment data; hosted payment assumption. |
| Trips/tolls/invoices | Agent/customer service | Trip IDs, facility labels, plate/tag match, invoice lines, rate snapshot placeholder. | Explain charge, open dispute, send receipt. | No agency toll rate claims. |
| Violations/disputes/cases | Analyst | Case queue, evidence placeholder, SLA, notes, resolution codes. | Add note, request evidence, escalate, resolve. | Evidence access logged in runtime. |
| Inventory/fulfillment | Fulfillment operator | SKU, tag ID, stock status, order state, shipment placeholder. | Reserve, release, ship, return. | No customer address in static demo. |
| Notification center | Support/ops | Templates, consent, delivery status, official guidance. | Preview, resend, opt-out, report scam. | Avoid unknown payment links. |
| Reports dashboard | Supervisor | Events, trips, invoices, case SLA, payment failures, fulfillment throughput. | Filter, export placeholder, schedule placeholder. | Metrics are demo-only unless measured. |

## Customer Portal Screens

| Screen | Primary user | Data shown | Actions | Safety notes |
|---|---|---|---|---|
| Portal home | Tolling customer | Balance, open invoice, recent trips, vehicles/tags, case status. | Pay bill placeholder, add vehicle, open dispute. | Own-account access required in runtime. |
| Pay bill flow | Tolling customer | Invoice, amount, hosted payment placeholder, receipt. | Continue to hosted payment, download receipt. | No raw card fields in demo. |
| Dispute flow | Tolling customer | Trip/invoice selection, reason, fake evidence upload, case status. | Submit dispute placeholder, track case. | Evidence upload requires runtime scanning and access controls. |
| Vehicles/tags | Tolling customer | Fake plate, tag status, replacement eligibility. | Request replacement, update plate placeholder. | Step-up auth required in runtime. |
| Notification preferences | Tolling customer | Email/SMS/mail preferences, official payment guidance. | Opt in/out, report suspicious text. | Consent and scam guidance visible. |

## Prototype Completion Criteria

- A sales engineer can run the 15-minute demo script with these screens.
- The customer understands demo vs runtime boundaries.
- No production PII, actual plates, payment account data, or credential material appears.
- The Account 360 screen is the primary screenshot.

