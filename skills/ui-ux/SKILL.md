---
name: ui-ux
description: Use when designing or reviewing product UI, website UI, admin UI, docs UX, onboarding, or any user-facing flow in be-ai-heart. Trigger on layout, navigation, forms, dashboards, visual hierarchy, onboarding, interaction design, or when selecting a UI inspiration from the imported awesome-design-md library.
---

# UI UX

## Read First

- `docs/01-product-story.md`
- `docs/05-enterprise-platform.md`
- `docs/07-go-to-market-pricing.md`
- `skills/ui-ux/references/awesome-design-md/catalog.md` when the task needs a stronger visual direction or a brand-like interaction style

## Objective

The product should feel credible, enterprise-ready, and efficient. Avoid generic AI-product aesthetics.

## Principles

- clarity before decoration
- strong hierarchy and deliberate typography
- visible ROI and trust signals
- accessible, responsive, keyboard-friendly flows
- onboarding should reduce uncertainty fast

## Workflow

1. Identify user persona and job-to-be-done.
2. Reduce the flow to the smallest understandable steps.
3. If the user wants a stronger aesthetic direction, shortlist 1-3 references from the imported design library with `python3 skills/ui-ux/scripts/search_awesome_design_md.py <query>`.
4. Read only the matching local references under `skills/ui-ux/references/awesome-design-md/<owner>.md`.
5. Translate layout rhythm, typography, color behavior, spacing, and motion into be-ai-heart constraints.
6. Show system state, risk, and next action clearly.
7. Validate empty, loading, error, and success states.

## Guardrails

- do not hide critical cost, security, or benchmark information
- admin UI should optimize for control and auditability, not novelty
- docs UX should favor fast comprehension and copyable examples
- website UX should support demo booking and self-serve trial activation
- use external references for visual language and composition, not for product claims, copy, logos, or brand identity
- prefer one primary inspiration and at most one secondary influence; avoid style soup
- keep imported references local and searchable instead of repeatedly fetching them ad hoc

## Deliverables

- clear flow description
- UI states defined
- accessibility and responsiveness considered

## Imported Library

- Sync or refresh the local library with `python3 skills/ui-ux/scripts/sync_awesome_design_md.py --refresh`
- Search the local catalog with `python3 skills/ui-ux/scripts/search_awesome_design_md.py <query>`
- Good starting queries:
  - `terminal dark developer`
  - `enterprise docs clean`
  - `fintech trust minimal`
  - `creative motion bold`
