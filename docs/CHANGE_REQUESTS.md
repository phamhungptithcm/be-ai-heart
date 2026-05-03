# Planning Change Requests

This file defines how BeHeart records "latest discussed and agreed" product, business requirement, spec, and architecture changes before implementation.

Change requests are not release notes. They are durable planning records that let humans and AI agents understand why scope changed and what acceptance criteria now apply.

## Current Contract

Use the planning change request schema from `packages/core/src/planning.js`.

Required fields:

- `id`: `CR-YYYYMMDD-XX`
- `status`: `proposed`, `accepted`, `superseded`, or `rejected`
- `title`
- `actor`
- `trigger`
- `problem`
- `proposed_change`
- `latest_agreed_summary`
- `affected_story_ids`
- `acceptance_criteria`
- `docs_required`
- `validation_plan`
- `security_considerations`

The utility functions are:

- `createPlanningChangeRequestId`
- `normalizePlanningChangeRequest`
- `validatePlanningChangeRequest`
- `renderPlanningChangeRequestMarkdown`

## Workflow

1. Create a change request before implementation when product behavior, acceptance criteria, buyer messaging, security posture, benchmark method, CLI/MCP contract, or architecture changes.
2. Link the affected story IDs from `docs/23-enterprise-startup-replan.md` or `docs/10-user-stories.md`.
3. Record the latest agreed summary in one or two concrete sentences.
4. Update acceptance criteria before coding.
5. Add or update a `docs/DECISIONS.md` entry when the change materially affects product promise, architecture, security posture, or customer data boundaries.
6. Update `docs/CHANGELOG-PLANNING.md` after implementation.
7. Run the tests listed in the validation plan.

## Storage

For now, accepted change requests may live in this file, in issue tracker records, or in a future generated planning registry. Do not store customer secrets, raw prompts, private source excerpts, credentials, or full customer names here.

## Example

```md
## CR-20260503-01: Require Evidence-Labeled Pricing Claims

Status: Accepted

Metadata:
- Actor: Product owner
- Trigger: Pricing page update
- Created: 2026-05-03T12:00:00.000Z
- Updated: 2026-05-03T12:00:00.000Z
- Decision required: no

Problem:
- Pricing copy could imply guaranteed savings before a buyer has a benchmark report.

Proposed change:
- Public pricing copy must label current local MVP, design-partner pilot, and future enterprise controls separately.

Latest discussed and agreed:
- Buyers should see local proof first. Upgrade language must cite measurement mode and confidence label when discussing ROI.

Affected stories:
- CADP-02
- BRP-04

Acceptance criteria:
- Pricing labels current and future scope.
- Savings language points to benchmark evidence instead of fixed claims.
- Website build passes.
```
