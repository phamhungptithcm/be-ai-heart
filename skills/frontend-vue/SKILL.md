---
name: frontend-vue
description: Use when be-ai-heart work explicitly requires Vue.js or a partner-facing Vue application. Trigger on Vue components, Vue routing, Pinia/state design, or Vue-based dashboards and portals.
---

# Frontend Vue

## Read First

- `docs/05-enterprise-platform.md`
- `skills/ui-ux/SKILL.md`

## Workflow

1. Confirm Vue is the correct choice for the requested surface.
2. Keep composables focused and reusable.
3. Separate display concerns from domain and integration concerns.
4. Preserve consistency with the rest of the product experience.

## Guardrails

- do not fork product patterns arbitrarily between React and Vue surfaces
- avoid hidden state mutation and implicit data flow
- document why Vue is used if the repo default is React/Node

## Deliverables

- Vue implementation aligned to product standards
- clear component and composable boundaries
