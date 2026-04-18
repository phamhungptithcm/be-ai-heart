# Document Ingestion Context Layer

## Purpose

`be-ai-heart` should not only understand code. It should understand the intent around the code.

In most real teams, the highest-value context is split across:

- business docs
- product requirements
- technical design docs
- system design docs
- rollout and execution plans

If AI reads only source code, it can still miss why the system was built, what the constraints are, and what decisions are already locked.

## Product Goal

Add a document-ingestion layer that scans project documents and turns them into durable context for AI agents.

This layer should help answer:

- what problem is this feature solving
- which requirements are already defined
- what architecture has been approved
- which tradeoffs were already chosen
- what should not be changed casually

## MVP Scope

### Inputs

- Markdown docs
- Text docs
- JSON/YAML config-like knowledge docs

### Initial categories

- `business`
- `requirements`
- `technical`
- `execution`
- `general`

### Outputs

- document title
- category
- headings
- summary
- path
- relevance score in context retrieval

## Retrieval Behavior

Document retrieval should be:

- task-aware
- compact
- citation-friendly
- safe by default

For a task like “improve login audit flow”, the heart should return:

- relevant implementation files
- relevant symbols
- relevant requirement docs
- relevant system design notes
- policy warnings

## Security Requirements

- honor ignore paths and future redaction rules
- support sensitive-document exclusion
- never dump full internal strategy docs by default into prompts
- prefer summaries and references over raw document bodies

## Future Enhancements

- `.pdf` and `.docx` extraction
- document-to-code linkage
- decision timeline and ADR support
- document freshness detection
- cross-repo knowledge packs
