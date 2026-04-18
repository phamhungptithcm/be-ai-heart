---
name: frontend-react
description: Use when building or reviewing React-based UI in be-ai-heart. Trigger on website, admin, docs portal, dashboard, onboarding, settings, charts, or component architecture implemented with React or Next.js.
---

# Frontend React

## Read First

- `docs/05-enterprise-platform.md`
- `skills/ui-ux/SKILL.md`

## Workflow

1. Keep product flows clear before componentizing.
2. Build with predictable state boundaries and typed data contracts.
3. Keep domain logic outside presentational components where practical.
4. Optimize for empty, error, loading, and permission states.

## Guardrails

- do not introduce UI-only state containers without clear need
- prefer server-safe patterns for data loading when framework supports them
- keep design consistent across website, docs, and admin without making them visually identical
- accessibility is required, especially for admin workflows

## Deliverables

- well-structured components
- stable UI states
- tests for meaningful behavior when risk justifies them
