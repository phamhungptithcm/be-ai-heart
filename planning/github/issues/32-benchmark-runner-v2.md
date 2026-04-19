# Issue 32: Benchmark Runner v2

## Title

Back benchmark ROI claims with repeatable evidence bundles

## Labels

- `type:feature`
- `priority:p1`
- `track:runtime`

## Milestone

`V2 M6 Benchmark Runner v2`

## Objective

Replace scenario-summary benchmarking with evidence-rich runs that can support customer trust, design-partner conversations, and pricing justification.

## Scope

- store baseline and assisted runs as separate evidence bundles
- capture raw prompts, tool outputs, result artifacts, and evaluation outputs
- keep repo snapshot, task statement, model class, and rubric aligned across compared runs
- generate manager, technical, and raw-evidence report views from the same artifact set
- publish benchmark history to portal and admin surfaces
- add regression tests for benchmark schema and publishing contracts

## Acceptance Criteria

- token and cost claims can be traced back to raw run artifacts
- the same benchmark scenario can be rerun repeatably on the same snapshot
- executive and engineering reports stay consistent with the same evidence base
- benchmark output is credible enough for design-partner and pilot conversations

## Dependencies

- Issue 29
- Issue 31

## Out of Scope

- sales CRM automation
- multi-model leaderboard infrastructure
- external customer-facing benchmark self-serve tooling
