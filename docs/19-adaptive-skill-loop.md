# Adaptive Skill Loop

## Purpose

Add a product capability that solves the core pain that static prompts, workflows, and AI skills become stale.

`be-ai-heart` should not only remember the project. It should help teams evolve the way AI works inside the project through a governed learning loop.

## Problem

Current AI workflows usually behave like frozen artifacts:

- a prompt is written once
- a skill file is packaged once
- a workflow is reused many times
- the artifact ages faster than the team thinking behind it

This creates a new class of waste:

- stale instructions
- repeated human correction
- workflow drift from current architecture
- hidden tribal knowledge that never makes it back into the reusable layer
- static “best practices” that no longer match reality

Validation is necessary, but validation alone only catches bad output after the fact.

The missing layer is structured reflection and upgrade.

## Product Thesis

`be-ai-heart` should evolve from `durable project memory` into `durable project memory with a governed skill evolution loop`.

The product should not promise unsafe self-modifying agents.

The stronger and more defensible promise is:

`Capture real work, extract reusable lessons, propose upgrades to team skills and context, benchmark them, and promote only what proves better.`

## Product Capability

### 1. Capture real work

For each meaningful AI-assisted task, store a bounded run record:

- task intent
- context pack version
- skill/version references used
- files explored
- files changed
- benchmark or review outcome
- human corrections
- retry count
- missing-context warnings

This must be selective and redactable, not a raw transcript dump.

### 2. Score the outcome

Every run should produce compact outcome signals:

- success or failure
- review edits required
- policy violations introduced
- duplicate work detected or avoided
- context quality score
- time to acceptable patch
- memory refresh count

### 3. Generate structured reflection

From repeated runs, the heart should generate reflection artifacts such as:

- which context was repeatedly missing
- which document or module should have been linked earlier
- which rule or warning would have prevented rework
- which implementation path was repeatedly chosen by humans
- which existing skill instruction is obsolete or too generic

Reflections are not yet upgrades. They are evidence-backed observations.

### 4. Propose skill or policy upgrades

From reflection evidence, the system creates diffable proposals:

- add a reuse rule
- update a context-pack ranking weight
- add a missing architecture constraint
- revise a skill step
- split one generic skill into two narrower skills
- deprecate a stale instruction

Every proposal must include:

- rationale
- supporting runs
- predicted impact
- risk level
- rollback path

### 5. Benchmark before promotion

No proposed skill upgrade should become default only because it sounds better.

Each proposal should be compared against the current version on repeatable scenarios:

- same repo snapshot
- same task family
- same model class where possible
- same scoring rubric

Promote only the changes that improve quality, cost, or trust without increasing unacceptable risk.

## What This Is Not

Do not frame this as:

- autonomous self-rewriting prompts with no controls
- silent self-editing in production
- model fine-tuning
- fully unsupervised learning from every run

That is harder to trust, harder to sell, and harder to secure.

## Product Positioning

Recommended positioning:

`be-ai-heart is the project memory and skill evolution layer for AI coding teams.`

Support points:

- remembers code, documents, decisions, and policies
- learns from repeated work instead of freezing past assumptions
- proposes upgrades with evidence
- benchmarks changes before rollout
- keeps humans in control of what becomes team standard

This is stronger than generic “context engine” positioning and more practical than generic “self-improving agents.”

## Architecture Fit

This capability should extend the existing architecture, not bypass it.

### Existing assets to reuse

- `packages/document-ingest`
- `packages/entity-linker`
- `packages/context-compiler`
- `packages/policy-engine`
- `packages/benchmark`
- `packages/cli`
- `packages/mcp-server`
- workspace and service storage in `packages/core` and `services/api`

### Recommended new bounded domain

Add a new reusable package only when the logic becomes non-trivial:

- `packages/learning-loop`

Responsibilities:

- run outcome normalization
- reflection synthesis
- proposal generation
- proposal scoring
- promotion workflow helpers

Do not couple it directly to MCP transport or UI apps.

## Proposed Data Model

### `TaskRun`

- task id
- repo or workspace id
- context pack version
- skill versions used
- execution metadata
- outcome metrics

### `Reflection`

- reflection id
- scope: repo, workspace, domain, or skill
- observed pattern
- evidence run ids
- confidence
- created at

### `PatternCandidate`

- candidate id
- candidate type: reuse, policy, ranking, instruction, split, deprecate
- affected domain
- expected benefit
- confidence

### `SkillVersion`

- skill id
- version
- instruction body or structured steps
- status: draft, active, deprecated
- provenance

### `UpgradeProposal`

- proposal id
- target skill or policy
- before and after
- evidence
- benchmark status
- approval status

### `ExperimentResult`

- proposal id
- scenario ids
- baseline metrics
- candidate metrics
- delta summary

## CLI Surface

Keep the command surface sparse.

Recommended additions:

```bash
heart reflect run <run-id>
heart reflect summary
heart skill status
heart skill propose <skill-id>
heart skill benchmark <proposal-id>
heart skill promote <proposal-id>
```

Human mode should show:

- top recurring misses
- proposals worth reviewing
- benchmarked improvements
- risky or low-confidence proposals to ignore

JSON mode should remain deterministic for automation.

## MCP Tool Surface

Each tool should answer one question well.

Recommended tools:

### `reflection_summary`

Returns:

- recurring failure patterns
- stale-skill signals
- missing-context hotspots

### `skill_upgrade_candidates`

Returns:

- candidate upgrades
- supporting evidence
- confidence and risk

### `skill_benchmark_status`

Returns:

- proposal status
- compared metrics
- promotion recommendation

## Learning Loop Stages

### Stage 1: Passive memory

Ship first:

- record run outcomes
- surface repeated misses
- no automatic skill edits

Goal:

- prove there is measurable stale-skill pain in real workflows

### Stage 2: Human-reviewed proposals

Ship next:

- generate upgrade proposals
- show diff and evidence
- require human approval

Goal:

- turn reflection into governed improvement

### Stage 3: Benchmark-gated promotion

Ship after that:

- compare old vs new skill versions
- promote only benchmark winners
- keep rollback history

Goal:

- make “self-upgrade” technically defensible

### Stage 4: Team learning workspace

Ship later:

- team-level history
- repo-specific learning
- role-specific skill variants
- analytics on upgrade impact over time

Goal:

- make the learning loop a shared operating capability, not just a local solo feature

## Security and Governance

This feature touches sensitive trust boundaries and must inherit the security baseline.

Required controls:

- per-repo and per-workspace isolation
- redact secrets and sensitive paths from stored evidence
- never store full code or full transcripts by default when compact evidence is enough
- keep proposal diffs inspectable
- require explicit promotion for team-wide changes
- preserve version history and rollback
- log who approved a promotion

For SaaS or multi-tenant operation, learning must never leak patterns across tenants unless explicitly aggregated and anonymized later.

## Success Metrics

This capability should be judged by operational improvement, not novelty.

Primary metrics:

- reduction in memory refreshes per repeated task family
- reduction in human prompt rewrites
- increase in reuse hit rate
- increase in context quality score
- reduction in review edits for repeated workflows
- time-to-acceptable-patch improvement across repeated tasks

Secondary metrics:

- proposal acceptance rate
- benchmark win rate for promoted upgrades
- rollback rate on promoted upgrades
- stale-skill detection lead time

## Benchmark Design

Add a new benchmark mode beyond baseline vs assisted:

- assisted-static
- assisted-adaptive

This answers a higher-value question:

`Does the learning loop compound value over repeated work, or does it only add complexity?`

Suggested scenario families:

- repeated auth changes
- recurring API extension tasks
- onboarding into an unfamiliar module
- bugfixes with hidden document constraints
- refactors where architecture drift previously happened

## Feasibility in Current Repo

### What already exists

- task-oriented context packs
- document-aware retrieval
- entity linking
- context quality signals
- benchmark comparison logic
- CLI and MCP surfaces
- local and service storage foundations

### What is missing

- normalized run history for repeated AI work
- reflection synthesis pipeline
- versioned skill registry
- proposal workflow and approvals
- benchmark harness for skill-version comparisons
- tenant-safe learning controls
- UI surface for proposal review and promotion

### Feasibility assessment

This is feasible, but only if scoped correctly.

Recommended delivery path:

- `4-6 weeks`: passive run capture plus reflection summaries in local mode
- `6-10 weeks`: proposal generation plus CLI review flow
- `10-14 weeks`: benchmark-gated promotion and early portal/admin visibility
- `14+ weeks`: team workspace and shared promotion history

Do not start with autonomous promotion.

## Packaging and GTM

### Best wedge

Sell this as:

`AI project memory that learns from your team’s real work.`

Not:

`self-improving AGI for software engineering`

### Best initial buyers

- AI-heavy startup engineering leaders
- platform teams standardizing AI usage
- teams with repeated work on the same codebase
- teams with high senior-review burden

### Why startups care

- compounds value from every task instead of paying the same context tax every week
- reduces dependence on a few senior engineers who “just know the system”
- improves onboarding speed for new hires using AI

### Why HR may care

HR is not the primary economic buyer.

But this is a strong supporting narrative for:

- faster ramp-up for new engineers
- clearer transfer of institutional knowledge
- less onboarding dependence on one manager or staff engineer

### Demo narrative

The strongest demo is not one-shot generation.

It is:

1. run a repeated task family with static context
2. show the misses, retries, and cleanup
3. let the heart capture reflections
4. review a proposed upgrade
5. rerun the scenario
6. show measured lift in reuse, cost, and review effort

That tells a compounding-value story, which is more persuasive than a single benchmark win.

## Recommended Next Steps

1. Treat this as a named product capability: `Adaptive Skill Loop`.
2. Add run-history capture and reflection summaries before any auto-upgrade logic.
3. Reuse the existing benchmark framework to compare static vs adaptive behavior.
4. Keep promotion human-approved and versioned.
5. Position this as the layer that keeps AI workflows from going stale, not as a generic prompt manager.

## Decision Rule

Before building any part of this loop, ask:

1. Does it help the heart learn from repeated work?
2. Does it increase trust rather than reduce it?
3. Can it be benchmarked fairly?
4. Can it be explained simply to a buyer?

If the answer is no to most of these, it should not be in the near-term scope.
