# Issue 27: Index Truthfulness v2

## Title

Deliver index truthfulness for config, ignore rules, and policy provenance

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:heart-core`

## Milestone

`V2 M1 Index Truthfulness`

## Objective

Make repository scans reflect real project intent instead of generated noise, ignored-path drift, or stale policy state.

## Scope

- parse `heart.config.yaml` into a real applied config object
- load repo-local `.heart/policies.yaml` rules into the policy engine
- expand and preserve generated/vendor ignore handling
- persist scan provenance in cache artifacts
- invalidate cache when config or policy inputs change
- add regression tests for config parsing, ignore behavior, and policy loading

## Acceptance Criteria

- configured document roots and ignore paths are applied during normal scans
- generated output such as `.next` artifacts does not pollute diagrams or top context
- policy checks use repo-local rules when present
- cached workspace state records scan provenance clearly enough to detect config or policy drift
- repeated scans of an unchanged repo remain stable in regression tests

## Dependencies

- Issue 21

## Out of Scope

- typed graph edges beyond current import and containment model
- semantic retrieval ranking changes
- portal visualization changes
