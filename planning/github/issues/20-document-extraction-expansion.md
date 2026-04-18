# Issue 20: Document Extraction Expansion

## Title

Expand project-memory ingest to pdf, docx, ADRs, and ticket/spec exports

## Labels

- `type:feature`
- `type:docs`
- `priority:p1`
- `track:heart-core`

## Milestone

`M2 Agent Runtime and Benchmark`

## Objective

Make project memory useful in the real formats teams already use, not only Markdown.

## Scope

- `.pdf` extraction
- `.docx` extraction
- ADR conventions
- ticket/spec export ingestion strategy
- secure handling of extracted text

## Acceptance Criteria

- at least pdf and docx ingestion work for representative project docs
- extracted docs are classified and searchable
- security notes for extracted content are documented

## Dependencies

- Issue 04
- Issue 10

## Out of Scope

- OCR for scanned image documents
