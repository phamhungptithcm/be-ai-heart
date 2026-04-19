# Issue 25: Adaptive Benchmark Mode

## Title

Extend the benchmark harness for static-vs-adaptive workflow comparisons

## Labels

- `type:feature`
- `type:research`
- `priority:p0`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Prove that adaptive skill evolution creates compounding value over repeated work instead of just adding complexity.

## Scope

- assisted-static and assisted-adaptive benchmark modes
- repeated-task scenario families for realistic workflow comparisons
- delta reporting for memory refreshes, review edits, reuse hit rate, and context quality
- manager and technical report updates for adaptive comparisons

## Acceptance Criteria

- at least two repeated-task scenario families run in both static and adaptive modes
- reports show comparable baseline, static-assisted, and adaptive-assisted metrics
- raw artifacts support verification of adaptive claims
- output is usable in demos and pilot conversations

## Dependencies

- Issue 09
- Issue 22
- Issue 23
- Issue 24

## Out of Scope

- public benchmark leaderboard
- statistically significant external study
