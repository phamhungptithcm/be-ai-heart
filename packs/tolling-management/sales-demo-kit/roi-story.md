# Benchmark / ROI Story

This artifact defines what the demo kit is designed to measure. It does not claim proven savings.

## Positioning

The Tolling Sales Demo Kit should reduce the time and repeated context needed to create a credible tolling sales package. A pilot benchmark can compare a generic baseline workflow against a pack-assisted workflow using the same task, repo snapshot, model class, and review rubric.

## Metrics

| Metric | Baseline expectation | Assisted expectation | Measurement path |
|---|---|---|---|
| Time to prototype | Team writes domain narrative, screens, and architecture from scratch. | Team starts from generated kit and customizes overlay. | Track elapsed minutes from task start to review-ready artifact. |
| Token savings | AI is repeatedly briefed on tolling operations. | AI receives compact pack and demo-kit context. | Compare prompt/tool/completion tokens. |
| Reduced duplicate work | Rewrites similar buyer personas, UI specs, and proposal sections. | Reuses demo-kit artifact structure. | Count duplicated sections and review edits. |
| Fewer missed requirements | Generic demo misses payments, audit, violations, fulfillment, or scam guidance. | Checklist covers tolling modules and risk areas. | Rubric score across required workflows. |
| Docs/spec alignment | Website, proposal, and UI copy drift. | Source claims and pack docs drive copy. | Cross-check against claim register and specs. |
| Support workflow completeness | Account support story is shallow. | Account 360 includes identity, trips, invoices, cases, actions, audit. | Persona-based workflow review. |

## Pilot Benchmark Scenario

Task: "Create a tolling sales demo package for an agency discovery call, including website copy, Account 360 mockup, customer portal mockup, architecture summary, proposal starter, and ROI story."

Baseline inputs:

- Task statement
- Public repo context
- Normal file exploration

Assisted inputs:

- Same task statement
- Tolling Management domain pack
- Sales Demo Kit artifacts
- Source-claims register

Quality rubric:

| Dimension | Score 0 | Score 5 |
|---|---|---|
| Tolling domain fit | Generic SaaS copy | Covers roadside, back office, customer portal, payments, disputes, inventory, reporting. |
| Buyer usefulness | One audience only | CTO, operations, customer service, finance, procurement, vendor founder all supported. |
| Safety | Uses sensitive-looking data or overclaims | Uses fake data, cites sources, labels hypotheses. |
| Architecture readiness | No implementation path | Service map, DB draft, API map, event flow, boundaries. |
| Demo readiness | Abstract docs only | Screens, scripts, CTA, and walkthrough. |

## Reporting Language

Allowed:

- "Designed to measure sales-prep time and context savings."
- "Pilot benchmark can compare baseline vs pack-assisted workflows."
- "Hypothesis: reusable domain artifacts reduce repeated prompting and missed requirements."

Forbidden:

- "Guaranteed savings."
- "Proven ROI" without observed benchmark evidence.
- "Production-ready tolling platform."
- "Agency-approved implementation."

