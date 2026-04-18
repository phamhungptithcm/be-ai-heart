# Benchmark Framework

## Benchmark Objective

Prove that `be-ai-heart` improves AI coding outcomes in measurable ways, not just anecdotal ways.

The benchmark should answer:

- Does the agent need fewer tokens to complete a task
- Does it reuse existing code more often
- Does it produce cleaner, more architecture-compliant changes
- Does it reduce human cleanup time

## Core Hypotheses

1. `be-ai-heart` reduces total prompt and retrieval tokens by at least `30%` on repeated project tasks.
2. `be-ai-heart` reduces duplicate implementation incidents by at least `40%`.
3. `be-ai-heart` improves architecture compliance by at least `25%`.
4. `be-ai-heart` reduces time-to-acceptable-patch by at least `20%`.

## Benchmark Modes

### Mode A: Baseline

AI works without `be-ai-heart`.

Inputs:

- repository
- task prompt
- normal file exploration

### Mode B: Assisted

AI works with `be-ai-heart`.

Inputs:

- repository
- same task prompt
- context packs from CLI or MCP

## Task Categories

- Bug fix in existing module
- Add feature in established domain
- Refactor duplicated logic
- Add endpoint or service with architecture constraints
- Update test coverage around a change

## Measurement Dimensions

### 1. Context Efficiency

- total prompt tokens
- total tool payload tokens
- number of discovery steps
- time spent exploring codebase

### 2. Code Reuse Quality

- existing reusable component identified
- reused component actually used
- duplicate functionality introduced or avoided

### 3. Architecture Quality

- policy violations introduced
- wrong-layer imports
- naming or placement inconsistency
- clean architecture score

### 4. Delivery Outcome

- time to first plausible patch
- time to acceptable patch
- number of review corrections
- tests passing or required follow-up

### 5. Business Impact

- estimated token cost savings
- estimated engineering review time saved
- pilot-level annualized savings estimate

## Scoring Model

Suggested weighted score:

- `30%` context efficiency
- `25%` code reuse quality
- `25%` architecture quality
- `20%` delivery outcome

## Example Formulas

### Token Savings

```text
token_savings_pct = (baseline_tokens - assisted_tokens) / baseline_tokens * 100
```

### Cost Savings

```text
cost_savings = (baseline_token_cost - assisted_token_cost) + review_time_saved_value
```

### Duplicate Work Avoidance

```text
duplicate_avoidance_pct = (baseline_duplicates - assisted_duplicates) / max(baseline_duplicates, 1) * 100
```

## Benchmark Harness Design

Recommended directory plan for implementation:

```text
benchmarks/
  scenarios/
  datasets/
  prompts/
  runners/
  reports/
```

### Scenario Spec

Each scenario should define:

- repo snapshot
- task description
- expected architectural boundaries
- evaluation rubric
- expected reuse targets

### Runner Responsibilities

- execute task with and without `be-ai-heart`
- log step count, tokens, and elapsed time
- collect resulting patch or output
- run post-task evaluation checks

## Evaluation Pipeline

1. Run baseline task
2. Run assisted task
3. Diff outputs
4. Run policy and duplication checks
5. Score both runs
6. Generate a report

## Report Format

Executive summary:

- token reduction
- cost reduction
- architecture score delta
- reuse improvement

Engineering detail:

- scenario-by-scenario breakdown
- failed retrievals
- false positives
- recommendations

## How To Use in Sales

The benchmark is not just QA. It is a go-to-market asset.

Use it to:

- prove ROI in pilots
- qualify enterprise deals
- produce case studies
- support pricing justification

## Important Caveat

Benchmark design must be fair:

- same repository snapshot
- same task statements
- same model class if possible
- same evaluation rubric
- no hidden prompt advantages outside the product itself
