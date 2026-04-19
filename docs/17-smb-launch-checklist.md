# SMB Launch Checklist

## Purpose

This checklist defines the minimum bar for launching `be-ai-heart` to small and medium-sized software businesses in a way that creates real value instead of just a good demo.

Use it as a pass/fail gate before:

- design partner outreach
- paid beta
- self-serve team onboarding

## Status Scale

- `PASS`: good enough to rely on for the next stage
- `PARTIAL`: useful but not strong enough to claim readiness
- `FAIL`: missing or too weak

## Gate 1: Product Value Proof

### 1.1 Core problem is solved

- [ ] `PASS` AI no longer starts cold on repeated project tasks
- [ ] `PASS` code and project documents are both part of retrieval
- [ ] `PASS` context packs reduce duplicate implementation risk
- [ ] `PASS` context packs surface architecture or policy constraints

Launch rule:

- do not launch if more than one item above is `FAIL`

### 1.2 Differentiation is visible

- [ ] `PASS` product clearly goes beyond code-only indexing
- [ ] `PASS` document memory is visible in real workflows
- [ ] `PASS` benchmark story is part of the product narrative
- [ ] `PASS` project memory is explained as the wedge, not generic “AI context”

Launch rule:

- do not launch if the product still looks like a generic code search/indexing tool

## Gate 2: Technical Readiness

### 2.1 Heart memory is real

- [ ] `PASS` persistent graph storage exists
- [ ] `PASS` persistent document storage exists
- [ ] `PASS` scans survive across sessions
- [ ] `PASS` schema versioning exists for stored data

Minimum required for design partner:

- `persistent graph/document storage`

### 2.2 Repeated use is efficient

- [ ] `PASS` incremental indexing exists
- [ ] `PASS` unchanged repos do not trigger full rebuilds
- [ ] `PASS` changed code and changed docs reindex selectively
- [ ] `PASS` index freshness is visible or explainable

Minimum required for paid beta:

- `incremental indexing`

### 2.3 Retrieval is trustworthy

- [ ] `PASS` `symbol_lookup` contract is stable
- [ ] `PASS` `impact_analysis` contract is stable
- [ ] `PASS` `context_pack` contract is stable
- [ ] `PASS` retrieval is deterministic enough for repeatable tests
- [ ] `PASS` code-plus-document retrieval improves real tasks

Minimum required for design partner:

- `stable contracts`

### 2.4 Context quality is explicit

- [ ] `PASS` relevance score exists
- [ ] `PASS` reuse confidence exists
- [ ] `PASS` architecture confidence exists
- [ ] `PASS` missing-context warnings exist

Minimum required for paid beta:

- at least first-pass context quality scoring

## Gate 3: Project Memory Depth

### 3.1 Artifact coverage

- [ ] `PASS` code is indexed
- [ ] `PASS` requirements docs are indexed
- [ ] `PASS` technical/system design docs are indexed
- [ ] `PASS` decisions or ADRs are supported
- [ ] `PASS` benchmark history can be stored or referenced

### 3.2 Linking quality

- [ ] `PASS` document-to-module linking exists
- [ ] `PASS` symbol-to-domain linking exists
- [ ] `PASS` decision-to-implementation linking exists

Launch rule:

- do not claim “project memory” strongly until at least two linking classes are real

## Gate 4: Safety and Trust

### 4.1 Policy control

- [ ] `PASS` module boundary rules exist
- [ ] `PASS` deprecated paths can be marked
- [ ] `PASS` preferred reuse paths can be marked
- [ ] `PASS` sensitive paths can be excluded from context

### 4.2 Security baseline

- [ ] `PASS` ignored paths are honored
- [ ] `PASS` redaction policy exists for sensitive content
- [ ] `PASS` secret-safe logging rules exist
- [ ] `PASS` MCP output stays protocol-clean and safe

Minimum required for design partner:

- `policy baseline + redaction baseline`

## Gate 5: Benchmark Credibility

### 5.1 Benchmark design

- [ ] `PASS` same repo snapshot is used in baseline and assisted runs
- [ ] `PASS` same task statement is used
- [ ] `PASS` same model class is used
- [ ] `PASS` same evaluation rubric is used

### 5.2 Benchmark scenario coverage

- [ ] `PASS` bug-fix scenario exists
- [ ] `PASS` feature-addition scenario exists
- [ ] `PASS` duplicate-refactor scenario exists
- [ ] `PASS` cross-module change scenario exists
- [ ] `PASS` document-context-required scenario exists

### 5.3 Benchmark metrics

- [ ] `PASS` token saving %
- [ ] `PASS` time to acceptable patch
- [ ] `PASS` duplicate implementation rate
- [ ] `PASS` review cleanup effort
- [ ] `PASS` architecture compliance
- [ ] `PASS` reuse hit rate
- [ ] `PASS` context retention across long sessions
- [ ] `PASS` cost saving by model/provider

### 5.4 Benchmark outputs

- [ ] `PASS` ROI summary for manager
- [ ] `PASS` technical breakdown for engineer
- [ ] `PASS` raw run artifacts for verification
- [ ] `PASS` blind review path exists where practical

Minimum required for design partner:

- benchmark maturity `Level B: Repeatable`

Minimum required for paid beta:

- at least one sales-grade benchmark report

## Gate 6: User Experience

### 6.1 Local onboarding

- [ ] `PASS` setup is under 10 minutes on a happy-path repo
- [ ] `PASS` CLI commands are understandable without long docs
- [ ] `PASS` common errors explain next steps

### 6.2 Product clarity

- [ ] `PASS` website or docs explain the wedge clearly
- [ ] `PASS` product does not overclaim against current capability
- [ ] `PASS` demo flow is stable and repeatable

Minimum required for design partner:

- `stable demo + usable local onboarding`

## Gate 7: Commercial Readiness

### 7.1 Design partner readiness

- [ ] `PASS` positioning is clear for SMB buyers
- [ ] `PASS` pilot offer is defined
- [ ] `PASS` benchmark report can support a customer conversation
- [ ] `PASS` one target ICP profile is chosen clearly

### 7.2 Paid beta readiness

- [ ] `PASS` there is a simple pricing hypothesis
- [ ] `PASS` support expectations are defined
- [ ] `PASS` scope limits for beta customers are explicit

## Decision Matrix

### Ready for internal dogfooding

Required:

- Gate 1 mostly `PASS`
- Gate 2 partially complete
- tests and demo stable

### Ready for design partner beta

Required:

- Gate 1 `PASS`
- Gate 2.1 `PASS`
- Gate 2.3 `PASS`
- Gate 4 baseline `PASS`
- Gate 5 benchmark maturity `Level B`
- Gate 6 local onboarding `PASS`
- Gate 7.1 `PASS`

### Ready for SMB paid beta

Required:

- all design partner gates
- Gate 2.2 `PASS`
- Gate 2.4 `PASS`
- Gate 3 mostly `PASS`
- Gate 5.4 mostly `PASS`
- Gate 7.2 `PASS`

### Ready for enterprise pilot

Required:

- SMB paid beta readiness
- shared workspace and org controls
- stronger auditability and deployment posture

## Current Assessment Snapshot

Based on the current repository state:

- `Internal dogfooding`: close
- `Design partner beta`: not ready yet
- `SMB paid beta`: not ready yet
- `Enterprise pilot`: not ready

Main blockers right now:

- no persistent storage
- no incremental indexing
- no entity linking
- no policy DSL
- no context quality score
- benchmark not yet strong enough

## Immediate Next Actions

1. Complete persistent graph and document storage
2. Complete incremental indexing
3. Add entity linking
4. Add policy DSL
5. Add context quality scoring
6. Finish benchmark harness v1

Do not launch before these become substantially real.
