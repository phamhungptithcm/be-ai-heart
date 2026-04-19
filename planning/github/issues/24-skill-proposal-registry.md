# Issue 24: Skill Proposal Registry

## Title

Create a versioned skill and upgrade-proposal registry for governed evolution

## Labels

- `type:feature`
- `type:backend`
- `priority:p1`
- `track:runtime`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Make skill and policy upgrades diffable, reviewable, and reversible before any team relies on them.

## Scope

- skill version schema
- upgrade proposal artifact schema
- provenance, evidence links, and rollback metadata
- local storage and listing helpers
- proposal diff inputs for CLI and future portal or admin review

## Acceptance Criteria

- skill or policy upgrades can be represented as versioned draft proposals
- proposals link back to supporting reflections and task runs
- active, draft, and deprecated states are supported
- tests cover proposal creation, listing, and rollback metadata

## Dependencies

- Issue 18
- Issue 22
- Issue 23

## Out of Scope

- automated promotion
- full admin authoring UI
