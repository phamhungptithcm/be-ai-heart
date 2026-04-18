# Issue 17: Entity Linking v1

## Title

Link code, documents, domains, and architecture decisions into a unified heart model

## Labels

- `type:feature`
- `type:backend`
- `priority:p0`
- `track:heart-core`

## Milestone

`M1 Heart Core MVP`

## Objective

Move beyond loose retrieval by linking the project memory together.

## Scope

- document-to-module links
- symbol-to-domain links
- decision-to-implementation links
- lightweight relationship storage
- retrieval use of these links

## Acceptance Criteria

- at least three relationship classes are represented in the stored heart model
- context retrieval uses linked entities to improve relevance
- linked-entity behavior is test-covered with fixtures

## Dependencies

- Issue 03
- Issue 04

## Out of Scope

- full knowledge graph reasoning across every possible artifact
