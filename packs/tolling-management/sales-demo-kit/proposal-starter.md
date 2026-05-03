# Proposal / RFP Starter

## Capability Matrix

| Capability | Demo kit coverage | Runtime needed | Agency-specific discovery |
|---|---|---|---|
| Account 360 | UI prototype and data model | Account APIs, auth, permissions | Identity verification rules, scripts |
| Customer search | UI prototype | Search service, masking, access control | Allowed search keys |
| Trips/tolls/invoices | Prototype and DB draft | Event ingestion, posting, invoice service | Toll rates, notice rules |
| Payments/funds | Prototype and security posture | Payment processor integration, ledger | Payment methods, refund policy |
| Violations/disputes/cases | Prototype and workflow | Case service, evidence store | Escalation, evidence, timelines |
| Inventory/fulfillment | Prototype and DB draft | Warehouse/order integrations | Tag policy, vendor process |
| Notifications | Prototype and source claims | Email/SMS/mail providers | Consent, templates, languages |
| Reporting | Prototype and report list | Data warehouse/jobs | Required KPIs and exports |
| Security/audit | Spec and boundaries | RBAC/ABAC, audit store, monitoring | Staff roles, retention, audit export |
| Interoperability | Architecture notes | Partner interfaces | Tag networks, settlement contracts |

## Implementation Phases

1. Discovery and overlay: confirm agency policies, integrations, data sources, and current pain.
2. Prototype alignment: customize demo screens, workflow, and fake data to the buyer's operating model.
3. Runtime MVP: implement Account 360, customer portal bill-pay placeholder, case/dispute flow, and audit.
4. Roadside/back-office integration: add event intake, trip posting, dedupe, rating, invoice/violation flow.
5. Operations hardening: reporting, reconciliation, retention, monitoring, DR, and support playbooks.

## Assumptions

- The buyer will provide authoritative policy sources for toll rates, fees, notice timing, dispute rules, retention, and integrations.
- Payment capture will use a hosted/tokenized provider unless a later security review approves another pattern.
- Production data will not be used in demos or benchmark fixtures.
- Agency branding, official links, and public wording require customer review.

## Security Notes

- Treat plates, trips, evidence, contact data, payment metadata, and support records as sensitive.
- Keep payment account data out of the application where possible through hosted/tokenized payment capture.
- Log staff and AI-assisted actions that affect money, evidence, account status, notices, or disputes.
- Use least privilege for support, finance, roadside, fulfillment, and admin roles.

## Integration Checklist

- Roadside event source and payload format
- Tag/account validation lists
- Plate/registration lookup source where authorized
- Payment processor
- Notification providers
- Mail/print vendor
- CRM or case system
- Warehouse/fulfillment vendor
- BI/reporting platform
- SSO/IAM provider
- Audit archive

## Data Migration Checklist

- Customers and accounts
- Vehicles, plates, and transponders
- Account status history
- Funds and ledger history
- Open invoices and notices
- Open cases/disputes
- Notification preferences
- Inventory and tag assignments
- Audit and report retention requirements

## Rollout Timeline

| Phase | Duration hypothesis | Output |
|---|---|---|
| Sales/demo customization | 3-7 days | Tailored microsite, one-pager, demo script. |
| Discovery sprint | 1-2 weeks | Agency overlay, story backlog, integration map. |
| Runtime MVP | 6-10 weeks | Account 360, portal, cases, payments placeholder, audit. |
| Tolling core integration | 10-16 weeks | Event intake, posting, invoices, violations, reporting. |

Durations are planning hypotheses, not delivery commitments.

## Open Questions

- Which account types are in MVP?
- Which tag brands and interoperability partners matter first?
- What payment methods are allowed?
- What dispute and waiver policies are authoritative?
- Which notices require mail vs email/SMS?
- Which reports are mandatory for launch?
- What retention rules apply to plate images and trip history?
- What systems are source of truth for accounts, vehicles, payments, and cases?

