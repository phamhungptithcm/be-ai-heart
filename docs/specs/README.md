# Specs Index

This folder holds current product and implementation specs that are too detailed for the main PRD.

| Spec | Status | Use |
| --- | --- | --- |
| [beheart AI Agent CLI and Portal Chat Plan](./beheart-ai-agent-cli-portal-chat-plan.md) | Current vertical slice implemented; production hardening remains | Provider/model selection, CLI AI workbench, portal chat, BYOK, tool safety, and deferred enterprise model admin |
| [Tolling Management Domain Pack Plan](./tolling-management-domain-pack-plan.md) | Phase 1 pack integration implemented | Tolling domain memory, overlays, MCP/CLI/portal integration, citations, conflicts, and safety limits |
| [Tolling Sales MVP Demo Kit Plan](./tolling-sales-mvp-demo-kit-plan.md) | Phase 1 static/demo artifact generation implemented | Sales demo kit contents, fake data rules, buyer workflows, proposal starter, and benchmark hypotheses |

Rules:

- Specs may describe planned work, but implemented behavior must be checked against code and `docs/04-mcp-cli-spec.md`.
- Future command names such as `heart demo-kit ...` are not current CLI commands unless the CLI spec says they are.
- ROI, payment, security, and enterprise claims must stay evidence-labeled and must not exceed implemented controls.
