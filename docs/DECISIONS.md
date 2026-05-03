# Decision Log

This file records latest agreed product and architecture decisions that should survive beyond chat context.

## Format

Use this template for new decisions:

```md
## D-YYYYMMDD-XX: Short Title

Status: Proposed | Accepted | Superseded | Rejected

Context:
- What changed or what uncertainty exists.

Decision:
- What is now agreed.

Consequences:
- What this enables.
- What this defers or risks.

Affected:
- Docs:
- Code/packages:
- Story IDs:
```

## D-20260503-01: Position BeHeart as Local-First AI Context and Governance Layer

Status: Accepted

Context:
- The repository now includes more than a parser and CLI. It has local graph/document memory, MCP, benchmark evidence, hosted APIs, and web surfaces.
- The product should remain useful for small teams while being credible for future enterprise buyers.

Decision:
- Position `be-ai-heart` as a local-first AI context, cost-control, and governance layer for software teams.
- Avoid positioning it as a generic coding assistant, vector search tool, or enterprise platform before the local wedge is proven.

Consequences:
- Next stories prioritize onboarding, benchmark proof, docs/spec sync, and security posture.
- Enterprise features stay labeled future unless implemented and tested.

Affected:
- Docs: README, PRD, product story, benchmark framework, this replan.
- Code/packages: no immediate code change.
- Story IDs: LMVP-01, CADP-01, BRP-03, GSE-04.

## D-20260503-02: Keep Raw Benchmark Artifacts Local-First by Default

Status: Accepted

Context:
- Benchmark evidence is necessary for ROI proof.
- Raw prompts, patches, tool outputs, and evaluation outputs may contain sensitive source or customer content.

Decision:
- Keep raw benchmark artifacts local-first by default.
- Hosted portal/admin surfaces should publish sanitized summaries, measurement provenance, repo snapshot hashes/counts, readiness, and deterministic artifact inventories.

Consequences:
- Sales-grade reports can show evidence without leaking raw content.
- Any future raw artifact sync requires an explicit security story and opt-in design.

Affected:
- Docs: benchmark framework, enterprise security docs.
- Code/packages: `packages/benchmark`, `services/api`, portal/admin benchmark views.
- Story IDs: BRP-01, BRP-04, GSE-02.

## D-20260503-03: Treat `docs_search` as an MCP Alias for `document_search`

Status: Accepted

Context:
- Docs and users may refer to document lookup as either `document_search` or `docs_search`.
- Duplicate implementation would increase contract drift.

Decision:
- `docs_search` is a compatibility alias for `document_search`.
- Enabling either alias in MCP config exposes both names, and both dispatch to the same document-memory search behavior.

Consequences:
- MCP client compatibility improves without widening domain logic.
- Allowlist enforcement must account for aliases.

Affected:
- Docs: CLI/MCP spec.
- Code/packages: `packages/core`, `packages/mcp-server`.
- Story IDs: CMCP-03.

## D-20260503-04: Use Docs as Planning Source of Truth Until Issue Tracker Is Introduced

Status: Accepted

Context:
- Future agents need a durable way to know latest agreed scope.
- Chat context is not durable enough.

Decision:
- Use `docs/DECISIONS.md`, `docs/CHANGELOG-PLANNING.md`, `docs/10-user-stories.md`, and `docs/23-enterprise-startup-replan.md` as the planning source of truth.
- Update docs before or alongside behavior changes.

Consequences:
- Planning drift is reduced.
- Future automation can generate or validate story status from docs.

Affected:
- Docs: planning docs.
- Code/packages: future docs drift script.
- Story IDs: LMVP-04, DBS-01.

## D-20260503-05: Hosted Sync Publishes Sanitized Summaries by Default

Status: Accepted

Context:
- Portal and admin surfaces need artifact visibility for repo memory, documents, benchmarks, and customer support.
- Raw source, prompts, patches, local paths, ignored files, and benchmark captures may contain sensitive customer content.

Decision:
- Hosted sync and hosted APIs should default to tenant-scoped summaries, manifests, readiness metadata, benchmark scores, and sanitized artifact inventories.
- Raw artifacts require an explicit future security story, opt-in contract, and tests before they can be synced.

Consequences:
- Local-first remains the default source of truth for raw repo memory and evidence.
- Portal/admin UI must label local-only versus synced/sanitized data.
- Service, benchmark, document, and UI tests should cover artifact redaction and tenant filtering before enterprise claims expand.

Affected:
- Docs: enterprise platform, benchmark framework, MCP/CLI spec, this replan.
- Code/packages: `packages/benchmark`, `packages/document-sync`, `services/api`, `apps/portal`, `apps/admin`.
- Story IDs: BRP-01, BRP-04, GSE-02, GSE-03, WUX-02, WUX-04.

## D-20260503-06: Buyer Pricing Claims Must Follow Evidence Quality

Status: Accepted

Context:
- The website and pricing page must help small teams understand value without implying fixed savings.
- Benchmark reports now expose measurement mode, confidence labels, evidence bundle availability, and trend-level evidence quality.

Decision:
- Public pricing and buyer copy should separate current local MVP, guided design-partner pilot, and future enterprise scope.
- ROI language must cite benchmark evidence quality instead of fixed savings claims.

Consequences:
- Pricing can support design partner conversations without overclaiming.
- Broader public savings claims require repeated observed runs and reviewed evidence.

Affected:
- Docs: `docs/07-go-to-market-pricing.md`, `docs/06-benchmark-framework.md`.
- Code/packages: `apps/website`, `packages/benchmark`, portal/admin benchmark visuals.
- Story IDs: CADP-02, BRP-04.

## D-20260503-07: Planning Change Requests Are a First-Class Source of Truth

Status: Accepted

Context:
- Product, docs, and architecture scope can change faster than static user stories.
- Future AI agents need a compact, structured way to preserve latest discussed and agreed requirements.

Decision:
- Use planning change requests with schema version 1 for material scope changes.
- Keep the pure schema/validation/markdown rendering logic in `packages/core` and keep persistence as a future docs tooling or service story.

Consequences:
- Agents can validate and render change-request records deterministically.
- A generated accepted-request registry remains future work.

Affected:
- Docs: `docs/CHANGE_REQUESTS.md`, `docs/templates/change-request.md`, `docs/CHANGELOG-PLANNING.md`.
- Code/packages: `packages/core/src/planning.js`.
- Story IDs: DBS-01.

## D-20260503-08: Security Packet Must Include Retention and Export Limits

Status: Accepted

Context:
- Enterprise and design-partner review needs more than local-first copy.
- Buyers need to understand raw artifact boundaries, retention expectations, export scope, and known limitations before production rollout.

Decision:
- Maintain `docs/26-production-threat-model-retention.md` as the production threat model, retention, export, and deployment-boundary packet.
- Website security docs may summarize this packet, but must not claim certifications or future enterprise controls as complete.

Consequences:
- Security language is more credible for enterprise review.
- Retention/export implementation remains a future service-hardening story.

Affected:
- Docs: `docs/25-security-overview.md`, `docs/26-production-threat-model-retention.md`.
- Code/packages: `apps/website` security/docs pages.
- Story IDs: GSE-04.

## D-20260503-09: Make Browser Login the Default CLI Auth Path

Status: Accepted

Context:
- Requiring users to pass `--url` during login creates avoidable setup friction.
- The desired CLI experience should match familiar developer tools: run one command, authenticate in the browser, then return to the terminal with credentials saved.

Decision:
- `heart login` opens the hosted BeHeart portal and completes credential sync through a state-bound loopback callback.
- `heart login --api-key=<key>` remains available for manual one-time portal keys and scripts.
- `--url` is only a local development or self-hosted API override.

Consequences:
- The normal hosted path has no URL copying.
- Portal callback handling must restrict destinations to loopback URLs and must never list raw API keys after creation.
- Local/self-hosted operators still have an explicit override path.

Affected:
- Docs: `README.md`, `docs/03-technical-architecture.md`, `docs/04-mcp-cli-spec.md`, `docs/10-user-stories.md`.
- Code/packages: `packages/cli`, `services/api`, `apps/portal`.
- Story IDs: Story 1.0b.
