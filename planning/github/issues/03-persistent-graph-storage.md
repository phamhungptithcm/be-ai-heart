# Issue 03: Persistent Graph Storage v1

## Title

Implement persistent graph storage for scans, diffs, and retrieval

## Labels

- `type:feature`
- `type:backend`
- `type:infra`
- `priority:p0`
- `track:heart-core`

## Milestone

`M1 Heart Core MVP`

## Objective

Persist graph and document-index outputs instead of rebuilding everything in-memory every session.

## Scope

- storage adapter selection
- graph snapshot persistence
- document index persistence
- scan metadata persistence
- retrieval read path
- local development mode
- schema versioning for future linked entities

## Acceptance Criteria

- scan results persist across CLI sessions
- graph snapshots can be loaded without a full rescan
- storage format and schema versioning are documented
- tests cover load/save compatibility

## Dependencies

- Issue 01
- Issue 02

## Out of Scope

- multi-tenant cloud storage
