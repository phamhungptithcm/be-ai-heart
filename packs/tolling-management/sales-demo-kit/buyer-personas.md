# Buyer Personas

This document helps a sales engineer tailor the Tolling Demo Kit to the buyer in the room.

| Persona | What they care about | Pain points | What to show first | Proof needed | Likely objection | Trust signal |
|---|---|---|---|---|---|---|
| Toll agency CTO | Architecture, integration risk, security, uptime, vendor control. | Legacy back offices, brittle integrations, unclear audit boundaries. | Architecture preview, service map, security/payment section. | Clear service boundaries, API map, no production-data dependency. | "A demo site is not an implementation." | Demo vs runtime boundaries are explicit. |
| Operations director | Queue health, roadside exceptions, case throughput, reporting. | Manual review, device exceptions, duplicate trips, aging queues. | Roadside-to-back-office flow and reports preview. | Failure modes, exception queues, SLA metrics. | "Our policies are different." | Agency overlay model and configurable rules. |
| Customer service director | Handle time, customer trust, scripts, first-contact resolution. | Agents switch tools, cannot explain charges quickly, scam calls. | Agent Account 360 preview. | Identity verification, allowed actions, audit trail. | "Will agents still need other systems?" | Single cockpit storyboard and escalation states. |
| Finance/payment leader | Ledger safety, payment scope, reconciliation, chargebacks. | Duplicate charges, manual corrections, payment provider failures. | Funds/payment panel and security section. | Tokenized payment assumption, ledger, approvals, idempotency. | "Payment risk is too high." | No raw card data in the demo; PCI DSS cited for payment-data posture. |
| Roadside operations leader | Device health, event quality, image review, incident flow. | Noisy events, low-confidence plates, reader failures. | Event flow and exception queue. | Traceability from event to posting and audit. | "This ignores the lane systems." | FHWA-aligned roadside/back-office model. |
| Procurement/RFP team | Capability coverage, assumptions, rollout, risk. | Vague proposals and hidden gaps. | Proposal starter and capability matrix. | Clear phases, open questions, source-backed claims. | "Can this become a formal response?" | Matrix separates demo-ready from runtime-needed. |
| Private toll operator | Concession reporting, SLA, revenue share, partner reporting. | Contract-specific operations and multi-vendor handoffs. | Reports and integration checklist. | SLA/report templates and permission model. | "Our contract model is custom." | Private operator overlay path. |
| Software vendor founder | Fast demo, pitch assets, credibility, implementation path. | Needs sales assets before revenue funds full build. | Microsite, one-pager, demo script. | 3-7 day MVP sequence and reusable artifacts. | "Can we show this next week?" | Screenshot-ready website and safe demo data. |
| Implementation partner | Scope clarity, migration, integrations, phased delivery. | Underestimated discovery and unclear ownership. | Architecture, DB, RFP starter. | Service map, migration checklist, story backlog. | "Demo will overpromise." | Every deferred runtime item is listed. |

## Demo Positioning By Buyer

- CTO: "This is the reference architecture and demo surface we use to validate fit before implementation."
- Operations: "This shows the roadside-to-back-office workflow and where agency rules customize the system."
- Customer service: "This is the cockpit that lets an agent answer, explain, and act safely in one place."
- Finance: "This keeps payment capture out of the demo and models ledger, approval, and audit first."
- Procurement: "This starter package makes RFP scope and assumptions visible early."

