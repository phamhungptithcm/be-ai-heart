# Benchmark Framework

## Objective

The benchmark suite must prove that `be-ai-heart` improves AI coding outcomes in ways that can survive technical and commercial scrutiny.

The framework exists to answer six questions:

- does `be-ai-heart` reduce token spend
- does it reduce duplicate work
- does it preserve context across follow-up turns
- does it improve architecture and code quality
- does it reduce delivery friction and review cleanup
- can the result be rerun from the CLI with versioned evidence
- can domain packs and sales/demo artifacts reduce repeated domain explanation without hiding uncertainty

## Benchmark Modes

### Baseline

Normal AI coding workflow without `be-ai-heart`.

Allowed inputs:

- repository snapshot
- task prompt
- normal file exploration

Disallowed advantage:

- any extra benchmark-specific context that the assisted run does not get through product surfaces

### Assisted

Same task, same repository snapshot, same model class, but with `be-ai-heart` context and benchmark artifacts.

Allowed inputs:

- repository snapshot
- same task prompt
- `heart pack` or MCP context output
- benchmark scenario and dataset manifests

## Current Local Contract

The repository now treats the benchmark as versioned repo content, not an ad hoc spreadsheet exercise.

Directory layout:

```text
benchmarks/
  datasets/
  scenarios/
```

Runtime artifacts:

```text
.heart/benchmarks/
  <report-id>.json
  <report-id>.md
  captures/
    <run-id>.json
  evidence/<report-id>/
    baseline.json
    assisted.json
    evaluation.json
    scenario.json
    dataset.json
    manifest.json
  suites/
    <suite-id>.json
    <suite-id>.md
```

Evidence bundle manifests use schema version 2 and include local-first traceability fields:

- sanitized `scan_provenance` for the assisted context source, without publishing absolute repo roots
- sanitized `readiness` showing config status, policy status, generated-noise exclusion status, cache status, parser coverage, document count, and warnings
- `provider`, `model`, `task`, and `measurement_mode` copied from the compared runs
- `run_ids` for baseline and assisted telemetry correlation
- `repo_snapshot` with schema/config/policy hashes and compact counts, not local absolute paths
- deterministic `artifact_list` entries for baseline, assisted, evaluation, scenario, and dataset evidence files

Published benchmark reports are checked with `validatePublishedArtifactSafety` before they are written to hosted or surface storage. The validator flags sensitive field names, absolute local paths, and secret-like values, and returned findings redact the matched value. Raw local evidence bundles can remain local-first; hosted surfaces should receive only sanitized reports and manifests.

## ROI Trend Digest

`buildBenchmarkTrendDigest` summarizes benchmark history for portal, admin, repository detail, and compact agent-facing evidence surfaces.

Trend output includes:

- latest and average token savings
- latest and average token-cost savings
- latest and average memory-refresh reduction
- latest and average composite ROI score
- latest and average evidence-quality score
- observed, mixed, and estimated report counts
- evidence bundle availability count
- top repository and top scenario by coverage and evidence quality

Evidence-quality scoring is not a compliance claim or scientific confidence score. It is a product-facing triage signal based on measurement mode, confidence label, observed coverage, sample size, and whether a sanitized evidence bundle is available. Buyer-facing copy must still cite the underlying benchmark report.

## Scenario Design

Each scenario manifest must define:

- `id`, `title`, `category`, and `description`
- `design_partner_type` for the pilot catalog: `bug_fix`, `feature_addition`, `duplicate_refactor`, `cross_module`, or `document_required`
- linked `dataset_id` or dataset path
- task statement and optional follow-up prompts
- expected document references
- expected reuse targets
- architecture rules that must remain true
- expected evidence and a short rubric for design-partner review
- scoring targets for tokens, time, memory refreshes, duplicates, policy violations, and review edits
- baseline run evidence
- assisted run evidence

Current scenario categories in this repo:

- `bug-fix`
- `document-aware-follow-up`
- `duplicate-work-avoidance`
- `architecture-constrained-change`
- `document-required-change`
- `domain-pack-assisted-change`

The design-partner pilot catalog must cover five task types:

- bug fix: `cache-stale-bug-fix`
- feature addition: `login-audit-flow`
- duplicate refactor: `duplicate-refactor`
- cross-module change: `cross-module-change`
- document-required task: `billing-doc-required`

Current domain-pack scenario:

- Tolling Management: `tolling-trip-posting-dedupe`

Domain-pack benchmark scenarios must state which evidence came from source-backed pack files, which evidence came from
the current repo, and which evidence is generated hypothesis. A sales demo kit can support a benchmark scenario, but it
does not prove production performance until an observed benchmark run exists.

## Dataset Design

Datasets define the stable benchmark slice that scenarios operate against.

Each dataset manifest must define:

- `id`, `title`, and `repo_strategy`
- relevant source paths
- relevant documents
- primary reuse targets
- policy or architecture expectations

Datasets are deliberately lighter than scenarios. They describe the reusable benchmark slice; scenarios describe the concrete task and scoring expectations on top of that slice.

## Metrics

## Measurement Sources

The framework now supports two explicit measurement modes and keeps them separate in reports:

- `observed`: token, duration, and cost metrics come from persisted `agent_run` and `llm_call` telemetry captured through the BeHeart OpenAI-compatible proxy
- `estimated`: metrics come from scenario manifests, static benchmark inputs, or incomplete captures where provider usage was not fully observed

Observed mode is the preferred benchmark path. Estimated mode remains available for agents that cannot be routed through an OpenAI-compatible proxy, but those reports should be treated as lower-confidence ROI evidence.

### 1. Context Efficiency

Tracked fields:

- total tokens
- token breakdown: prompt, discovery, tool, completion, other
- elapsed minutes
- token cost in USD
- memory refresh count

Derived score:

- target-based score where lower token/time/cost/refresh counts are better

### 2. Context Retention

Tracked fields:

- retention checkpoints passed / total
- document hits / required document references
- handoff successes / attempts
- memory refresh count

Derived score:

- average of available retention checkpoint rate, document hit rate, handoff success rate, and memory-refresh target score

This is the primary metric for durable project memory, not just prompt compression.

### 3. Duplicate-Work Avoidance

Tracked fields:

- reuse hits / reuse targets
- duplicate-avoidance checks passed / total
- duplicate introductions

Derived score:

- average of reuse-hit rate, duplicate-check pass rate, and duplicate target score

This should be used alongside the simpler public delta:

```text
duplicate_reduction_pct = (baseline_duplicates - assisted_duplicates) / max(baseline_duplicates, 1) * 100
```

### 4. Code Quality

Tracked fields:

- policy violations
- review edits
- tests passed / total
- rubric scores on a `0-5` scale

Default rubric dimensions:

- correctness
- architecture
- reuse
- testing
- intent alignment

Derived score:

- weighted rubric score plus test pass rate and lower-is-better policy/review penalties

### 5. Delivery Outcome

Tracked fields:

- tasks passed / total
- task success flag
- elapsed minutes

Derived score:

- task completion rate combined with time target performance

### 6. Executive ROI

Public delta metrics stored in the report:

- `token_savings_pct`
- `time_savings_pct`
- `token_cost_savings_usd`
- `context_retention_gain_pct`
- `duplicate_avoidance_gain_pct`
- `code_quality_gain_pct`
- `overall_score_gain_pct`

ROI language rules:

- `observed` reports may say what the run measured.
- `estimated` reports may describe directional hypotheses only.
- Domain-pack and sales-demo-kit scenarios may claim faster access to domain context only when the benchmark artifacts show the context source and rubric.
- Public sales copy must not present fixture values, fake demo data, or single-scenario results as general customer ROI.

## Scoring Weights

Default overall weights:

- `25%` context efficiency
- `20%` context retention
- `20%` duplicate avoidance
- `20%` code quality
- `15%` delivery

These weights can be overridden per scenario, but the repo default should remain stable unless the benchmark thesis changes.

## Reporting Format

Each scenario report includes:

- baseline metrics and scorecard
- assisted metrics and scorecard
- framework summary with scenario, dataset, and evaluation contract
- executive summary
- manager summary
- technical summary
- automation commands
- evidence summary

JSON report:

- machine-readable
- suitable for portal/admin ingestion
- includes sanitized benchmark metrics and framework sections

Markdown report:

- boardroom-friendly
- emphasizes deltas and scorecard outcomes

Evidence bundle manifest:

- points to all supporting files
- includes scenario and dataset summaries
- captures the CLI automation commands used to reproduce the run
- records baseline and assisted measurement metadata so portal/admin surfaces can distinguish observed vs estimated evidence
- records sanitized scan provenance for the assisted context path, including cache schema version, config and policy hashes, effective ignores, and document roots without absolute local paths

Observed run comparison requires both `--baseline-run` and `--assisted-run`. The CLI rejects mismatched modes, scenario
mismatches, failed runs, provider/model mismatches, and incomplete usage coverage instead of silently downgrading a
claimed observed comparison.

Portal and admin benchmark detail views surface the same v2 evidence manifest trace fields: provider, model, task,
baseline/assisted run IDs, repo snapshot hash presence, ignored-path count, document-root count, and artifact inventory.

## CLI Automation

Single scenario:

```bash
heart benchmark run login-audit-flow
```

Observed scenario from captured runs:

```bash
heart benchmark capture baseline login-audit-flow --upstream-base-url http://127.0.0.1:8787/v1 -- <agent command ...>
heart benchmark capture assisted login-audit-flow --upstream-base-url http://127.0.0.1:8787/v1 -- <agent command ...>
heart benchmark run login-audit-flow --baseline-run <baseline-run-id> --assisted-run <assisted-run-id>
```

Whole suite:

```bash
heart benchmark run --all
```

Compare two captured runs:

```bash
heart benchmark compare baseline.json assisted.json
```

General launcher:

```bash
heart agent run --mode baseline --scenario login-audit-flow --upstream-base-url http://127.0.0.1:8787/v1 -- <agent command ...>
```

Cost capture notes:

- BeHeart stores token and cost telemetry at the `llm_call` level
- cost is computed from provider usage plus optional CLI pricing flags when the upstream API does not provide cost fields directly
- benchmark reports should present token and cost savings as `observed` only when full usage coverage exists for the traced calls

Recommended repeatable workflow:

1. pin the repository snapshot
2. keep scenario and dataset manifests under version control
3. run `heart benchmark run <scenario>` or `heart benchmark run --all`
4. review `.heart/benchmarks/*.json` and `.md`
5. inspect `.heart/benchmarks/evidence/<report-id>/manifest.json`
6. publish sanitized reports to portal/admin if needed

## Portal Launcher

The portal can now trigger benchmark runs for a tenant workspace, but only under a strict local-first condition:

- the workspace identity must have a registered `benchmark_runner.repo_root`
- that path must still exist on the same host running `services/api`
- the repository must contain versioned benchmark scenarios under `benchmarks/scenarios`

When those conditions hold, the portal can:

- launch `observed` benchmark runs with baseline and assisted command argv arrays
- poll launch status and live token/cost counters from persisted `agent_run` and `llm_call` telemetry
- publish the finished benchmark report back into the normal tenant benchmark history

If the service cannot reach the local repo path anymore, the portal must fall back to CLI-driven benchmarking and only display previously published reports.

## Fairness Rules

The benchmark is only credible if these hold:

- same repository snapshot
- same task wording
- same model class
- same rubric
- no hidden prompt advantage for the assisted run beyond product surfaces
- observed numbers must stay separate from interpretation

## Review Guidance

Prefer blind review where practical.

Reviewers should score:

- correctness
- reuse quality
- architecture fit
- test adequacy
- intent alignment

Token savings alone are not sufficient proof.

## Sales Use

This benchmark is a go-to-market asset, not just internal QA.

Use it to:

- prove ROI in pilots
- support pricing discussions
- create technical case studies
- show that `be-ai-heart` improves both cost and trust
- demonstrate how a domain pack changes context quality for vertical workflows

## Domain Pack And Sales Demo Kit Scenarios

Domain-pack benchmarks should test whether source-backed reusable domain memory helps agents avoid repeated discovery and
unsafe assumptions.

Tolling scenarios should validate:

- trip posting and dedupe remain idempotent before money movement
- payment and ledger flows avoid raw card data and require audit
- support responses direct users to official payment channels and avoid suspicious links
- regional/agency/customer overlay conflicts are surfaced instead of silently merged
- generated demo kit artifacts stay fake-data-only and source-cited

Sales demo kit benchmarks should measure preparation and requirement coverage, not production runtime claims:

| Scenario type | Valid measurement | Invalid claim |
| --- | --- | --- |
| Time to demo | Time and token cost to produce source-cited demo artifacts | Production implementation speed |
| Requirement coverage | Rubric coverage against pack/source checklist | Legal or agency compliance |
| Prototype quality | Completeness of fake-data UI/story artifacts | Runtime reliability |
| Proposal starter | Assumptions, risks, integrations, and security notes present | Procurement-ready final response |

## Portal ROI Display Rules

The portal benchmark and ROI dashboard should display evidence without overstating it:

- show observed and estimated values separately
- show baseline vs assisted comparisons only when benchmark artifacts exist
- show token savings, cost savings, time savings, duplicate-work reduction, context retention, architecture compliance, and review cleanup reduction as designed measurement categories when evidence is missing
- keep report IDs, generated timestamps, model/provider, scenario, and evidence bundle state visible
- feed founder/admin metrics from benchmark artifacts and label financial rollups as estimates until billing integration is live
