# Issue 19: Context Quality Score

## Title

Add context quality scoring and missing-context warnings to every context pack

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Help users and agents know whether a context pack is trustworthy enough before they act on it.

## Scope

- relevance score
- reuse confidence
- architecture confidence
- missing-context warnings
- contract shape for score outputs

## Acceptance Criteria

- context packs expose all four signals
- signals are deterministic enough for testing
- warnings are surfaced when required documents or clear reuse paths are missing

## Dependencies

- Issue 05
- Issue 17
- Issue 18

## Out of Scope

- model-trained confidence calibration
