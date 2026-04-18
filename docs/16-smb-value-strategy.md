# SMB Value Strategy

## Purpose

This document defines how `be-ai-heart` creates real value for small and medium-sized software businesses that want AI-assisted delivery without enterprise-scale budget waste.

## Core SMB Reality

SMBs do not have the budget or patience to:

- burn large amounts of tokens on repeated context loading
- run long experimentation cycles without visible ROI
- hire specialized internal platform teams just to make AI usable
- absorb architecture damage caused by inconsistent AI-generated work

That means `be-ai-heart` must win on practical economics and trust, not just technical novelty.

## The Buyer Problem

An SMB engineering leader usually asks:

- can AI help my team move faster without increasing cleanup cost
- can I keep token spend under control
- can junior or mid-level engineers use AI safely in a real codebase
- can I avoid duplicate work and architecture drift
- can I prove this is worth paying for

If `be-ai-heart` cannot answer those clearly, it will not be bought.

## Product Promise For SMBs

`be-ai-heart` should promise:

- lower AI cost per useful change
- faster time to acceptable patch
- less duplicate implementation
- better adherence to existing architecture and requirements
- less manual re-explaining of the project

This is not “AI but smarter.”
This is “AI that wastes less money and creates less mess.”

## The Wedge

The product wedge should be:

`Project memory for AI coding that combines code, documents, architecture policy, and benchmark-backed ROI.`

Why this wedge matters:

- code-only context is already crowded
- generic semantic search is not enough
- SMBs care about outcome per dollar, not abstract intelligence

## What Creates Real Value

### 1. Persistent project memory

The heart must remember:

- code structure
- requirements
- technical design
- system design
- decisions and ADRs
- benchmark history

Without persistent memory, the product is only a temporary assistant, not infrastructure.

### 2. Entity linking

The heart must connect:

- document to module
- decision to implementation
- symbol to domain
- policy to affected path
- benchmark scenario to expected reuse and architecture rules

Without linking, retrieval stays shallow.

### 3. Practical policy controls

The product needs a policy DSL that solves real team pain:

- module boundaries
- deprecated paths
- preferred reuse paths
- sensitive paths excluded from context
- document visibility controls later

Without policy, the product cannot create trust.

### 4. Context quality scoring

Every context pack should communicate whether it is likely to be good enough.

Minimum signals:

- relevance score
- reuse confidence
- architecture confidence
- missing-context warnings

Without quality signals, users cannot trust the system when it is uncertain.

### 5. Benchmark-backed proof

SMBs will not buy “better context.”
They will buy:

- saved token budget
- reduced review cleanup
- less duplicate work
- higher-quality changes per engineering hour

## What Should Feel “Wow”

The wow moment for SMBs is not a flashy chat demo.

It is this:

1. Team runs the same AI task without `be-ai-heart`
2. The model explores too much, misses reuse, and burns tokens
3. Team runs it with `be-ai-heart`
4. The system surfaces the right code, the right docs, and the right constraints quickly
5. The patch is cleaner, cheaper, and easier to review
6. The report quantifies the difference

That is the selling moment.

## Product Design Rules For SMB Value

- local-first before hosted complexity
- obvious setup before broad feature count
- persistence before polish
- benchmark before marketing spend
- quality proof before enterprise sprawl

## What To Build First

### Tier 1: Must build now

- persistent graph and document storage
- TypeScript migration for core runtime
- deep retrieval and impact contract tests
- context compiler v2
- security and redaction baseline
- benchmark harness v1

### Tier 2: Build after proof

- website and docs shell
- admin skeleton
- hosted baseline architecture

### Tier 3: Delay

- custom CRM
- complex billing
- multi-cloud
- broad multi-language support
- graph database migration before real pain exists

## Pricing Logic For SMBs

The purchase must feel cheaper than waste.

That means pricing should be framed against:

- token savings
- review time saved
- duplicate work avoided
- onboarding acceleration for engineers using AI

Do not force SMBs to buy an enterprise platform before they see value.

## Required Reports

Every serious pilot should produce three outputs:

### 1. ROI summary for manager

- cost delta
- time delta
- duplicate reduction
- architecture compliance improvement

### 2. Technical breakdown for engineer

- retrieved files and docs
- reuse candidates
- policy warnings
- failure modes and misses

### 3. Raw artifacts

- prompts
- tool outputs
- patches
- evaluation outputs

Without raw artifacts, the benchmark is hard to trust.

## Strategy Risk

The biggest strategic risk is drifting into a generic “AI engineering platform” before proving the narrow wedge.

The protection against that drift is:

- keep the product centered on project memory
- keep benchmark proof central
- keep code-plus-document context as the differentiator
- keep pricing and messaging tied to efficiency and quality

## Strategic Decision Rule

Before starting any feature, ask:

1. Does this reduce AI waste for SMBs?
2. Does this increase trust in AI-generated work?
3. Does this strengthen project memory?
4. Can this be measured in a benchmark?

If the answer is no to most of these, it is not a near-term priority.
