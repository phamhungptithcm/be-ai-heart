# Product Maturity Map

## Purpose

This document defines how `be-ai-heart` should mature from a promising prototype into a product with real customer value, benchmark credibility, and enterprise defensibility.

It exists to prevent two common failure modes:

- building too broadly before proving daily workflow value
- shipping impressive demos that do not survive real team usage

## Core Product Bet

`be-ai-heart` becomes valuable when it can reliably do all of the following together:

- remember what a project is
- understand what code already exists
- retrieve the right code and document context for a task
- reduce duplicate work and architecture drift
- prove measurable savings and quality improvement

If one of those is missing, the product is weaker than the full thesis.

## Maturity Stages

### Stage 0: Concept and Prototype

Goal:

- prove the core interaction is possible

What exists at this stage:

- local parser
- basic graph
- basic context pack
- local MCP and CLI skeleton
- early project docs

Acceptance gate:

- can demo a task from one TypeScript repo end-to-end
- can show code context and document context in one flow
- tests pass consistently

Failure signal:

- demos work, but daily usage still requires too much manual re-explanation

### Stage 1: MVP

Goal:

- make `heart` useful for a single engineer or small team on real repos

Required capabilities:

- TypeScript-first production runtime
- persistent graph and document storage
- entity linking across code, docs, domains, and decisions
- stable CLI commands
- stable MCP contracts
- document-aware context compiler
- context quality scoring
- benchmark harness with repeatable scenarios
- basic policy and security controls

Acceptance gate:

- one team can use `heart` repeatedly on the same repo without re-index pain
- benchmark shows directional improvement in at least token savings and reuse quality
- symbol, impact, and context-pack contracts are stable enough for agent integration

Failure signal:

- retrieval remains noisy or inconsistent across similar tasks

### Stage 2: Design Partner Product

Goal:

- prove the product solves a painful problem in real customer workflow

Required capabilities:

- design-partner onboarding flow
- benchmark report suitable for customer review
- website and docs that explain the wedge clearly
- stronger security posture for context and documents
- usage telemetry for product learning
- ability to support multiple repos or meaningful repo scale in limited beta

Acceptance gate:

- `2-3` design partners use the product on real work
- at least one partner confirms measurable workflow improvement
- benchmark outputs are credible enough for pilot sales conversations

Failure signal:

- customer likes the concept but does not change actual workflow

### Stage 3: Team Product

Goal:

- support shared workflows instead of only local solo usage

Required capabilities:

- shared graph store
- team workspace domain
- repo/member/policy management
- benchmark history
- usage analytics
- admin surface baseline

Acceptance gate:

- one team can share and trust the same project memory
- org-level policy and benchmark views exist
- first paid pilot is possible without manual operational chaos

Failure signal:

- product works only as a founder-operated service, not as a repeatable team tool

### Stage 4: Enterprise-Ready Product

Goal:

- sell and operate the product as enterprise infrastructure

Required capabilities:

- multi-repo support
- strong security controls
- SSO/RBAC
- audit logs
- private deployment path
- billing and license operations
- operational readiness and support model

Acceptance gate:

- annual contract motion is technically supportable
- enterprise security review can be answered coherently
- platform can scale beyond founder-led manual operations

Failure signal:

- sales interest exists but security/governance gaps block deals

## Capability Map

| Capability | Prototype | MVP | Design Partner | Team Product | Enterprise-Ready |
| --- | --- | --- | --- | --- | --- |
| Code parsing and graph | basic | persistent and typed | validated on real repos | shared graph | multi-repo and scalable |
| Document memory | basic scan/classify | doc-aware retrieval | required in customer flows | shared and governed | access-controlled and auditable |
| Context compiler | simple ranking | stable ranking and compact packs | tuned from partner feedback | team-aware | policy-rich and enterprise-safe |
| CLI | basic commands | production-grade local UX | onboarding-ready | team workflows | admin and support hooks |
| MCP | local tools | stable stdio contract | validated in agent workflows | workspace-aware | governed and auditable |
| Benchmarking | directional | repeatable | sales-grade pilot report | org benchmarking | procurement-grade ROI asset |
| Security | basic hygiene | threat model and redaction | partner-safe posture | org controls | enterprise controls |
| Website/docs | draft | credible product docs | pilot-ready GTM | scalable acquisition | enterprise trust content |
| Admin/workspace | none | none or stub | limited internal tooling | shared workspace | full enterprise console |

## Current Stage Assessment

As of the current repository state, `be-ai-heart` is between `Stage 0` and early `Stage 1`.

Reasons:

- there is already a real local scaffold, AST-backed parser, MCP server, tests, and document ingestion
- persistent storage does not exist yet
- full TypeScript migration does not exist yet
- benchmark system is still too light for customer-proof ROI
- website/portal/admin are still shells, not real product surfaces

Short version:

- technically beyond concept-only
- commercially not yet MVP-complete

## What Must Happen Before Claiming MVP

These are the non-negotiable items:

1. TypeScript migration for core runtime
2. Persistent graph and document storage
3. Entity linking between code, documents, and architecture decisions
4. Stable `symbol_lookup`, `impact_analysis`, and `context_pack` contracts
5. Document-aware retrieval that is demonstrably useful
6. Context quality scoring with explicit uncertainty
7. Security baseline for ignored paths, redaction, and secret-safe outputs
8. Benchmark harness with repeatable and defensible results

Do not claim MVP before those are complete.

## Benchmark Maturity Levels

### Level A: Directional

- internal runs only
- small fixture repos
- useful for product iteration

### Level B: Repeatable

- same scenarios rerun consistently
- stable scoring model
- suitable for engineering decision-making

### Level C: Sales-Grade

- design partner scenarios
- executive summary plus technical appendix
- suitable for pilot ROI discussion

### Level D: Enterprise-Grade

- multiple repo profiles
- documented methodology
- enough rigor to survive procurement scrutiny

Current target:

- move from `Level A` to `Level B` before building heavier product surfaces

## Feature Priority By Value

### Highest-value next features

- persistent graph/document storage
- TypeScript migration
- entity linking
- deep contract tests
- document-aware context ranking
- policy DSL
- context quality scoring
- benchmark harness
- security baseline

### Medium-value next features

- website and docs shell
- admin shell
- GCP hosted baseline design

### Lower-value for now

- custom CRM
- advanced billing
- wide multi-language support
- graph database migration before storage pain is proven

## Anti-Goals By Stage

### Before MVP

- do not overbuild admin
- do not chase every language
- do not optimize for enterprise procurement before value proof

### Before Design Partner Proof

- do not spend heavily on UI polish that hides weak retrieval
- do not market vague “AI context” claims without benchmark support

### Before Team Product

- do not add shared-workspace complexity without a trustworthy local engine

## Decision Rule

When choosing the next feature, ask:

1. Does it improve trust?
2. Does it improve measurable ROI proof?
3. Does it reduce adoption friction?
4. Does it strengthen the wedge of code-plus-document memory?

If the answer is no to all four, it should not be a priority.

## Recommended Next Execution Sequence

1. Finish MVP-core infrastructure:
   TypeScript migration, persistent storage, entity linking, contract hardening, benchmark harness
2. Finish MVP-proof assets:
   benchmark report format, positioning package, docs shell
3. Start design partner cycle:
   onboarding, scenario runs, retrieval tuning
4. Only then expand into shared team workspace and enterprise operations

## Exit Criteria Summary

### To exit Prototype

- repeatable local workflow
- stable parser and context pack basics

### To exit MVP

- persistent memory
- stable contracts
- benchmark level B

### To exit Design Partner Product

- real partner validation
- sales-grade ROI evidence

### To exit Team Product

- shared memory and governance
- first paid pilot ready

### To exit Enterprise-Ready

- annual-contract technical readiness
- enterprise security and operations baseline
