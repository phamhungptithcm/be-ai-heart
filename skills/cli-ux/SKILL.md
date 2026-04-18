---
name: cli-ux
description: Use when shaping the user experience of the `heart` CLI. Trigger on help text, command discoverability, prompts, examples, onboarding flow, output readability, and local developer ergonomics.
---

# CLI UX

## Objective

Make the CLI feel obvious, calm, and trustworthy for engineers using it repeatedly during AI-assisted coding.

## Workflow

1. Optimize the first-run path.
2. Show only the information needed for the next decision.
3. Prefer examples over long prose in help output.
4. Ensure errors teach the user what to do next.

## Guardrails

- avoid chatty output
- avoid decorative symbols that reduce readability
- `--json` should strip human framing
- command naming must be memorable and literal

## Deliverables

- improved help or output design
- clearer onboarding flow
- reduced ambiguity in success and failure states
