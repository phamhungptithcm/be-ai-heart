---
name: devops-platform
description: Use when setting up repository automation, environments, containers, deployment workflows, observability, release processes, or developer platform foundations for be-ai-heart. Trigger on CI/CD, environments, infra automation, Docker, deployment pipelines, or operational tooling.
---

# DevOps Platform

## Read First

- `docs/05-enterprise-platform.md`
- `docs/08-roadmap-operating-model.md`
- `docs/11-implementation-blueprint.md`

## Workflow

1. Optimize first for a reproducible local workflow.
2. Add CI checks that reflect real delivery risk.
3. Keep deployment topology simple in early stages.
4. Make logs, metrics, and traces possible before scale forces them.

## Guardrails

- avoid premature multi-cluster or multi-region complexity
- use immutable builds where practical
- prefer short-lived credentials and audited deployment paths
- document environment variables and secret ownership

## Deliverables

- reproducible scripts or workflow config
- environment assumptions documented
- rollback or failure behavior considered
