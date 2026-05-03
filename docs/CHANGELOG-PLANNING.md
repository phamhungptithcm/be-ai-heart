# Planning Changelog

This file tracks changes to roadmap, story status, product scope, and planning assumptions. It is not a release changelog.

## 2026-05-03

### Added

- Added `docs/23-enterprise-startup-replan.md` as the current continuation plan and function/API inventory.
- Added `docs/DECISIONS.md` for durable product and architecture decisions.
- Added explicit story map for:
  - Clean Local MVP Foundation
  - Durable Repo Memory
  - Context Pack and MCP Workflow
  - Docs / Business Requirements / Spec Sync
  - CLI Developer Experience
  - Web UI / Portal UX
  - Benchmark and ROI Proof
  - Governance, Security, and Enterprise Readiness
  - Team Workspace Future
  - Customer Adoption and Design Partner Flow

### Updated Planning Assumptions

- v2 contracts are mostly implemented; the next gap is adoption, benchmark credibility, docs/spec sync, and enterprise trust posture.
- `BR-03` is not a small implementation story. It is part of design-partner and future team workspace readiness.
- Raw benchmark artifacts should remain local-first by default.
- Enterprise features must remain labeled future unless implemented and tested.

### Next Recommended Implementation Order

1. `CADP-03`: founder/operator pipeline can triage design partners by benchmark readiness and next action.
2. `DBS-01 follow-up`: generated registry for accepted planning change requests.
3. `GSE-03 follow-up`: route-by-route authorization review and retention/export implementation hooks.
4. `TWF-02`: shared graph storage ADR after tenant isolation and retention constraints are locked.

### Completed During Implementation Pass

- `CLIDX-01`: `heart doctor` now renders and returns a first-run checklist for `init`, `doctor`, `scan`, `overview`, `pack`, and `mcp serve`.
- `CMCP-04`: MCP exposes compact benchmark readiness through `benchmark_summary`.
- `BRP-03`: design-partner scenarios now cover bug fix, feature addition, duplicate refactor, cross-module, and document-required task types.
- `WUX-01` and `CADP-01`: website copy now includes local-first onboarding, evidence-labeled proof language, and a one-repo pilot path.
- `GSE-02`: benchmark artifact publication refuses unsafe sanitized reports before hosted/surface storage.
- `CADP-02`: pricing narrative now labels current local MVP, guided pilot, and future enterprise scope with benchmark caveats.
- `BRP-04`: benchmark trends now include evidence quality, measurement-mode counts, artifact availability, and top repo/scenario signals.
- `DBS-01`: planning change requests now have a core schema/validator/markdown renderer, docs, and template.
- `GSE-04`: security packet now includes production threat model, retention/export plan, deployment posture, and buyer-safe language limits.
