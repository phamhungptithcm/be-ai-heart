---
name: backend-java
description: Use when be-ai-heart explicitly needs a Java service, enterprise integration, or JVM-based component. Trigger on Java APIs, batch workers, enterprise connectors, or JVM ecosystem requirements that are intentionally chosen over Node.js.
---

# Backend Java

## Read First

- `docs/03-technical-architecture.md`
- `docs/08-roadmap-operating-model.md`

## Default Position

Node.js is the default backend for the MVP. Use Java only when the task explicitly requires it or when enterprise integration constraints justify the tradeoff.

## Workflow

1. State why Java is required.
2. Keep contract boundaries language-neutral.
3. Avoid duplicating logic already present in Node packages.
4. Prefer interoperable APIs and documented schemas.

## Guardrails

- do not introduce Java for prestige or habit
- do not split business logic across two stacks without clear ownership
- keep operational burden justified by customer value

## Deliverables

- rationale for Java usage
- isolated, well-documented JVM component
- contract and operational notes
