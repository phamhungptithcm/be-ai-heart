# Issue 30: Diagram Engine v2

## Title

Generate trustworthy component, class, and sequence diagrams from typed project memory

## Labels

- `type:feature`
- `priority:p1`
- `track:product-surface`

## Milestone

`V2 M4 Diagram Engine v2`

## Objective

Produce diagrams that are clean enough for customer review and honest enough to serve as lightweight onboarding artifacts.

## Scope

- add a `component` diagram type
- refactor `high-level` output around typed domain and component data
- suppress generated or low-confidence class shapes
- improve sequence generation with route, handler, service, and call-chain evidence
- attach confidence and scope metadata to diagram artifacts
- update portal presentation cues for inference mode and limitations

## Acceptance Criteria

- diagrams no longer surface generated-code noise in normal portal views
- each diagram type answers one clear review question
- sequence diagrams rely on stronger evidence than raw import ordering
- diagram confidence and inference limits are visible to customers

## Dependencies

- Issue 29

## Out of Scope

- runtime trace capture
- interactive graph explorer UX
- whiteboard-style editing in the portal
