# Issue 21: Incremental Indexing v1

## Title

Implement true incremental indexing for code and project documents

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:heart-core`

## Milestone

`M1 Heart Core MVP`

## Objective

Avoid full rescans and keep the heart fresh enough for repeated daily use.

## Scope

- file fingerprinting
- changed-file detection
- selective re-indexing for code and documents
- persistence of index metadata
- stale-link update strategy

## Acceptance Criteria

- unchanged repos do not trigger full rebuilds
- changed files and docs are reindexed selectively
- index freshness behavior is test-covered

## Dependencies

- Issue 03

## Out of Scope

- distributed indexing
