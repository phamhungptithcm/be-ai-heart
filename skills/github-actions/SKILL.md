---
name: github-actions
description: Use when creating or reviewing GitHub Actions workflows for be-ai-heart. Trigger on CI, release automation, workflow security, caching, matrix builds, artifacts, or GitHub-hosted automation.
---

# GitHub Actions

## Workflow

1. Define the exact trigger and minimal permissions.
2. Keep workflows fast and deterministic.
3. Separate validation, release, and deployment concerns.
4. Use caching and path filters only when they reduce real cost.

## Security Guardrails

- pin actions by trusted version or SHA when practical
- set least-privilege `permissions`
- prefer OIDC over long-lived cloud credentials
- never echo secrets or sensitive files into logs

## Product Guardrails

- CI should validate graph, CLI, MCP, and benchmark contracts over time
- keep workflows readable; avoid sprawling YAML without comments where logic is subtle

## Deliverables

- workflow files
- permissions rationale
- validation proof or dry-run notes
