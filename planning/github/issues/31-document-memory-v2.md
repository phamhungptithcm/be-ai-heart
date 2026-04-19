# Issue 31: Document Memory v2

## Title

Upgrade document memory for governable ingestion, linkage, and retrieval

## Labels

- `type:feature`
- `type:docs`
- `priority:p0`
- `track:heart-core`

## Milestone

`V2 M5 Document Memory v2`

## Objective

Make project requirements and business documents safer, more durable, and more useful for both customer review and AI-assisted implementation.

## Scope

- add `.pdf` and `.docx` ingestion adapters
- track freshness, source lineage, and version references
- add sensitivity tags and redaction-aware defaults
- strengthen document-to-module and decision-to-implementation linking
- ensure portal-submitted document updates affect the next scan and context pack
- add tests for local import, portal sync, and sensitivity-safe output behavior

## Acceptance Criteria

- portal-submitted document updates materially affect subsequent retrieval where relevant
- sensitive content is not dumped raw into default context outputs
- document retrieval explains why a document matched
- document memory stays compact enough to support token-saving claims

## Dependencies

- Issue 29

## Out of Scope

- OCR for scanned-image documents
- enterprise-grade document permissions beyond current tenant model
- full document editing inside the portal
