---
name: security-engineering
description: Use when working on any security-sensitive part of be-ai-heart. Trigger on auth, billing, admin, MCP, CLI execution, CI/CD, cloud infrastructure, secrets, prompt/context handling, multi-tenant features, or data governance.
---

# Security Engineering

## Read First

- `docs/03-technical-architecture.md`
- `docs/05-enterprise-platform.md`

## Threat Model Priorities

- context leakage across tenants or repos
- secret exposure in graph artifacts, logs, prompts, or benchmark reports
- unsafe tool execution through CLI or MCP
- over-privileged CI, GitHub, or cloud identities
- unsafe admin and billing surfaces

## Workflow

1. Identify assets, trust boundaries, and attack paths.
2. Minimize permissions and data exposure first.
3. Add input validation, output redaction, and safe defaults.
4. Ensure logs and reports do not leak secrets or sensitive code.
5. Add tests or checklists for the chosen control.

## Guardrails

- never hardcode secrets
- never log tokens, credentials, or raw customer secrets
- prefer allowlists over blocklists
- prefer OIDC and short-lived credentials over static keys
- protect against path traversal, command injection, SSRF, and prompt-driven unsafe execution
- security review is mandatory for cloud, GitHub Actions, admin, billing, and MCP changes

## Deliverables

- brief threat note in code comments, PR notes, or docs when needed
- security-conscious implementation
- validation for the highest-risk path
