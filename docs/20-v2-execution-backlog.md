# v2 Execution Backlog

## Status Note

This backlog is now partly historical. Many M1-M6 contracts are implemented in the current repo and summarized in
[Project Implementation Story Plan](./22-project-implementation-story-plan.md) and [Implementation Blueprint v2](./11-implementation-blueprint-v2.md).
Use this file for original milestone intent and remaining hardening themes, not as proof that every listed work package
is still unstarted.

## Purpose

This document turns [Implementation Blueprint v2](./11-implementation-blueprint-v2.md) into an execution-facing backlog.

The intent is to make the next delivery phase actionable without forcing each engineer or agent to reinterpret the blueprint from scratch.

## How To Use This Backlog

- Treat each milestone as a gated execution block.
- Do not start a later milestone by default if the earlier gate is still materially open.
- Keep changes scoped to the owning packages whenever possible.
- Prefer contract-first work before UI or hosted polish.

## Delivery Order

1. M1: Index Truthfulness
2. M2: Typed Graph v2
3. M3: Context Compiler v2
4. M4: Diagram Engine v2
5. M5: Document Memory v2
6. M6: Benchmark Runner v2

## M1: Index Truthfulness

### Outcome

Scans should reflect the real repository, not generated noise or ignored config drift.

### Primary owners

- `packages/core`
- `packages/parser-ts`
- `packages/document-ingest`
- `packages/policy-engine`

### Work packages

- Parse `heart.config.yaml` into a real config object instead of falling back to defaults for most fields.
- Load `.heart/policies.yaml` into the policy engine.
- Expand default ignore handling to exclude generated and vendor artifacts such as `.next`.
- Preserve scan provenance and schema version clearly in local cache artifacts.
- Add tests for config loading, ignore behavior, and policy loading.

### Exit criteria

- Generated build output does not appear in normal diagrams or top context results.
- Configured document paths and ignore rules are actually applied.
- Policy checks reflect repo-local rules instead of only hardcoded defaults.
- Repeated scans of an unchanged repo are stable enough for regression tests.

### Blockers for later milestones

- M2 graph quality will be misleading if indexing is polluted.
- M3 retrieval quality will overfit noise if generated code stays indexed.

## M2: Typed Graph v2

### Outcome

The graph should model collaboration and architecture structure, not only file containment and imports.

### Primary owners

- `packages/parser-ts`
- `packages/graph`

### Work packages

- Introduce typed nodes for `Class`, `Interface`, `Function`, `Method`, `Test`, `Document`, and `Policy`.
- Persist `EXTENDS` and `IMPLEMENTS` edges from parser output.
- Add first-pass `CALLS` extraction for supported TypeScript and JavaScript patterns.
- Add `TESTED_BY` derivation from test imports and naming conventions.
- Expand impact analysis helpers to use typed graph relationships.
- Add snapshot schema versioning and diff support for typed graph changes.

### Exit criteria

- Function-to-function and class-to-class relationships are queryable.
- `impact_analysis` is no longer import-only.
- Graph snapshots can be diffed between scans in a deterministic way.
- Typed graph edges are available for downstream compiler and diagram use.

### Blockers for later milestones

- M3 ranking cannot become materially better without richer graph edges.
- M4 diagrams cannot become trustworthy if they still rely on thin graph data.

## M3: Context Compiler v2

### Outcome

`context_pack` should become the main compact memory object for AI ingestion.

### Primary owners

- `packages/context-compiler`
- `packages/graph`
- `packages/mcp-server`

### Work packages

- Add a real `token_budget` input and deterministic trimming logic.
- Rank by graph proximity, linked documents, reuse signals, policy relevance, and likely test impact.
- Add explicit citations for symbols, documents, and graph-derived evidence.
- Add a stable `context_pack` JSON schema shared by CLI and MCP.
- Add confidence rollups and missing-context warnings tuned for repeated tasks.
- Add regression fixtures for document-heavy, reuse-heavy, and cross-module tasks.

### Exit criteria

- Similar tasks return similar top context across repeated runs.
- Context packs are compact enough to replace broad file rescanning in common tasks.
- Reuse candidates and risks point to concrete project evidence.
- Missing-context warnings are explicit when the system is uncertain.

### Blockers for later milestones

- M4 sequence and component diagrams should use the same core evidence model.
- M6 assisted benchmark mode depends on a stable pack contract.

## M4: Diagram Engine v2

### Outcome

Diagrams should be honest, clean, and useful for customer review and internal onboarding.

### Primary owners

- `packages/diagram-generator`
- `packages/graph`
- `apps/portal`

### Work packages

- Add a `component` diagram type.
- Refactor `high-level` to use typed domain/component inputs.
- Refactor `class` to suppress generated or low-confidence shapes.
- Refactor `sequence` to use route, handler, service, and call-chain evidence where possible.
- Add diagram confidence and scope metadata.
- Add portal presentation cues that explain inference mode and limits.

### Exit criteria

- Portal diagrams are readable without generated-code pollution.
- Each diagram answers one clear review question.
- Sequence output is based on stronger evidence than raw import ordering alone.
- Diagram confidence is visible when inference is heuristic.

### Blockers for later milestones

- Customer-facing trust is weaker if the visual layer remains noisy.

## M5: Document Memory v2

### Outcome

Document memory should become more useful, more governable, and safer to expose.

### Primary owners

- `packages/document-ingest`
- `packages/document-sync`
- `services/api`

### Work packages

- Add `.pdf` and `.docx` ingestion adapters.
- Add freshness tracking, source lineage, and version references.
- Add sensitivity tags and redaction-aware default output behavior.
- Strengthen document-to-module and decision-to-implementation linking.
- Ensure portal-submitted document updates appear in the next scan and context pack with citations.
- Add tests for local import, portal sync, and sensitivity-safe output behavior.

### Exit criteria

- Portal document updates materially change subsequent retrieval where relevant.
- Sensitive content is not dumped raw into default agent outputs.
- Document retrieval can explain why a document was matched.
- Document memory remains compact enough to support token-saving claims.

### Blockers for later milestones

- M6 document-context-required benchmark scenarios are weak without this milestone.

## M6: Benchmark Runner v2

### Outcome

Benchmark reports should be backed by evidence-rich runs, not only scenario summaries.

### Primary owners

- `packages/benchmark`
- `packages/cli`
- `services/api`
- `apps/portal`

### Work packages

- Introduce a runner that stores baseline and assisted runs as separate evidence bundles.
- Capture raw prompts, tool outputs, patches or result artifacts, and evaluation outputs.
- Keep repo snapshot, task statement, model class, and rubric aligned across compared runs.
- Generate manager, technical, and raw-evidence report views from the same artifact set.
- Publish benchmark history to portal and admin surfaces with workspace and repo trends.
- Add regression tests for benchmark schema and report publishing.

### Exit criteria

- ROI claims can be traced to raw artifacts.
- The same benchmark scenario can be rerun repeatably on the same snapshot.
- Manager and engineering reports are consistent with the same evidence base.
- Benchmark output is credible enough for design-partner conversations.

## Cross-Cutting Controls

### Security

- Protect against tenant context leakage in sync and hosted reads.
- Keep default outputs summary-first and citation-first.
- Avoid raw secret or sensitive-path emission in graph, pack, docs, and benchmark artifacts.

### Testing

- Favor contract tests for graph snapshot, context pack, document artifact, diagram manifest, and benchmark report schemas.
- Add regression tests for noise exclusion and retrieval stability.

### Docs

- Keep the main blueprint, backlog, and maturity docs aligned when milestone meaning changes.
- Do not claim a milestone is complete unless its exit criteria are actually met.

## Suggested First Ticket Set

Start with this order inside `M1`:

1. Real config parsing for `heart.config.yaml`
2. Real policy file loading
3. Generated artifact ignore baseline
4. Regression tests for clean scans

Then move to this order inside `M2`:

1. Typed node schema
2. `EXTENDS` and `IMPLEMENTS` graph edges
3. First-pass `CALLS`
4. `TESTED_BY`
5. Impact query upgrade

## Readiness Check

`v2` should be considered execution-ready only when:

- the team agrees this backlog is the active sequence
- current milestone ownership is explicit
- acceptance gates are used as stop/go boundaries
- new work does not bypass these dependencies for presentation polish
