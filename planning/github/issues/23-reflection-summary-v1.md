# Issue 23: Reflection Summary v1

## Title

Generate reflection summaries and stale-skill signals from repeated task runs

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Turn repeated run history into governed evidence about what context, rules, or skill instructions are going stale.

## Scope

- recurring missing-context detection
- repeated retry or failure pattern clustering
- stale-skill and stale-policy heuristics
- reflection artifact schema and summary output
- deterministic ranking for top recurring misses and affected domains

## Acceptance Criteria

- the heart can produce reflection summaries from stored task runs
- summaries identify top recurring misses, likely stale instructions, and affected domains
- low-confidence reflections are marked explicitly rather than presented as facts
- tests cover deterministic ranking and summary output

## Dependencies

- Issue 17
- Issue 19
- Issue 22

## Out of Scope

- direct skill edits
- automatic promotion of any change
