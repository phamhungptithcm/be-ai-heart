# Product Story

## Narrative

Teams are not actually buying more AI output. They are buying reliable engineering progress.

Current AI coding workflows fail when the model has poor situational awareness:

- It does not know which module already solves the problem.
- It forgets decisions made yesterday.
- It cannot reliably infer project boundaries and architecture rules.
- It often proposes code that looks right locally but is wrong systemically.

That forces engineers to spend tokens re-explaining the codebase and spend time cleaning up after the model.

`be-ai-heart` exists to become the project memory that AI lacks.

It gives each repository a persistent “heart”:

- what the project is
- what already exists
- what is safe to reuse
- what patterns are allowed
- how modules relate
- which changes are likely to break architecture

When an agent starts a task, it should not start cold.

## Product Story in One Sentence

`be-ai-heart` turns codebases into durable, queryable project memory so AI agents can work like informed teammates instead of stateless autocomplete.

## Customer Pain Story

Typical team today:

1. A developer asks an AI tool to add a feature.
2. The AI inspects only a thin slice of the repo.
3. It misses an existing service or helper.
4. It creates duplicate logic.
5. The pull request passes locally but violates architecture rules or conventions.
6. The developer rewrites, re-prompts, and re-contextualizes.
7. Tokens rise while trust falls.

The actual pain is not just bad generation. It is lack of durable context.

## Desired Outcome

With `be-ai-heart`:

1. The repo is indexed into a structured graph.
2. The agent asks `heart-mcp` what the system already has.
3. The runtime returns the minimal high-signal context pack for the task.
4. The agent sees modules, symbols, owners, rules, recent decisions, and likely reuse targets.
5. The final change is more consistent, cheaper, and easier to review.

## Jobs To Be Done

### For the individual engineer

- “Before I ask AI to code, I want it to understand my project and reuse existing patterns.”

### For the tech lead

- “I want AI-generated changes to respect architecture and reduce review cleanup.”

### For the engineering manager

- “I want measurable savings and confidence that our AI spend improves output quality.”

### For the enterprise buyer

- “I need AI-assisted development to be governable, secure, and economically defensible.”

## Product Principles

1. Context before generation
2. Minimal tokens, maximal signal
3. Reuse before creation
4. Rules must be explicit, not implied
5. Local-first for developers, enterprise-ready for companies
6. Benchmark value, do not merely claim it

## Positioning

Do not position `be-ai-heart` as:

- another code editor
- another LLM wrapper
- another vector search product

Position it as:

- the context operating layer for AI software delivery
- project memory for coding agents
- an enterprise-grade AI coding governance and efficiency platform

## Brand Angle

The name `heart` should represent:

- the living core of the codebase
- a central memory and coordination organ
- a signal that keeps AI work coherent and safe

## Elevator Pitch

`be-ai-heart` helps AI coding tools understand your codebase before they write code. It builds a live graph of your project, exposes it through CLI and MCP, and gives agents the exact context they need to reuse code, follow architecture, and spend fewer tokens.
