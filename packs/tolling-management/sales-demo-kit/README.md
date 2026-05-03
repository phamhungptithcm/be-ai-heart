# Tolling Sales Demo Kit

Status: Phase 1 static sales/demo package. This is not a tolling runtime, payment system, OCR system, or agency integration.

## Purpose

The Tolling Sales Demo Kit helps a software company show a credible tolling MVP direction before a full implementation is funded. It converts the Tolling Management domain pack into sales-ready artifacts: narrative, buyer personas, website copy, UI prototype specs, safe demo data, architecture and DB drafts, demo scripts, proposal starter content, and benchmark/ROI hypotheses.

## What A Sales Engineer Should Show First

1. Open the microsite at `/domain-demo-kits/tolling-management`.
2. Start with the Agent Account 360 preview because it proves back-office depth quickly.
3. Walk the roadside-to-back-office flow to show tolling domain understanding.
4. Show payment/security posture before discussing any bill-pay flow.
5. Close with the implementation roadmap and pilot benchmark hypothesis.

## Phase 1 Story Status

| Story ID | Status | Evidence |
|---|---|---|
| TOLL-SALES-1 | Done | This artifact structure and README exist. |
| TOLL-SALES-2 | Done | `buyer-personas.md` and `website-copy.md`. |
| TOLL-SALES-3 | Done | `demo-data.md`. |
| TOLL-SALES-4 | Done | `source-claims.md`. |
| TOLL-WEB-1 | Done | Website route under `apps/website/app/domain-demo-kits/tolling-management/`. |
| TOLL-WEB-2 | Done | Back-office module showcase in website and `ui-prototype-spec.md`. |
| TOLL-WEB-3 | Done | Customer portal showcase in website and `ui-prototype-spec.md`. |
| TOLL-WEB-4 | Done | Security/ROI sections in website, `roi-story.md`, and `source-claims.md`. |
| TOLL-WEB-5 | Done | Route-specific responsive CSS module and subtle motion. |
| TOLL-UI-1 | Done | Agent Account 360 prototype in website and spec. |
| TOLL-UI-2 | Done | Case management prototype spec and showcase. |
| TOLL-UI-3 | Done | Payment/funds prototype spec and showcase. |
| TOLL-UI-4 | Done | Inventory/fulfillment prototype spec and showcase. |
| TOLL-UI-5 | Done | Reports prototype spec and showcase. |
| TOLL-UI-6 | Done | Customer portal prototype in website and spec. |
| TOLL-SALE-ENABLE-1 | Done | `executive-one-pager.md`. |
| TOLL-SALE-ENABLE-2 | Done | `demo-script.md`. |
| TOLL-SALE-ENABLE-3 | Done | `proposal-starter.md`. |
| TOLL-SALE-ENABLE-4 | Done | `roi-story.md`. |

## Artifact Map

| Artifact | Use |
|---|---|
| `buyer-personas.md` | Discovery and demo targeting. |
| `executive-one-pager.md` | Post-call summary and executive outreach. |
| `demo-script.md` | 5, 15, 30 minute and workflow demo scripts. |
| `proposal-starter.md` | RFP/proposal starter with assumptions and discovery questions. |
| `roi-story.md` | Benchmark/ROI hypothesis without unmeasured claims. |
| `demo-data.md` | Safe fake data rules and sample records. |
| `source-claims.md` | Source-backed claim register and forbidden overclaims. |
| `website-copy.md` | Microsite copy system and CTA language. |
| `ui-prototype-spec.md` | Back-office and customer portal prototype requirements. |
| `architecture-demo.md` | Architecture, service map, event flow, and security boundaries. |
| `db-demo-model.md` | Postgres demo schema draft and ERD. |

## Demo Boundaries

Included:

- Static website/microsite
- Static UI prototype surfaces
- Fake demo data
- Architecture and DB drafts
- Proposal/RFP starter
- Demo scripts
- Source-backed sales claims
- ROI hypotheses designed for later benchmark measurement

Excluded:

- Runtime toll event ingestion
- Live account auth
- Payment capture
- OCR/image review execution
- Toll rating engine
- Agency production integration
- Production notices, collections, or legal policy

## Source And Claim Rules

- Use official/credible sources for external tolling, payment, privacy, and scam-safety claims.
- Use "designed to measure" or "hypothesis" for ROI language until benchmark evidence exists.
- Mark agency policy values as discovery items unless a customer-provided source resolves them.
- Use only safe fake records in demos, screenshots, and benchmark fixtures.

