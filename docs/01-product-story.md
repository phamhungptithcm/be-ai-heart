# Product Story

## Narrative

Teams are not actually buying more AI output. They are buying reliable engineering progress.

Current AI coding workflows fail when the model has poor situational awareness:

- It does not know which module already solves the problem.
- It forgets decisions made yesterday.
- It cannot reliably infer project boundaries and architecture rules.
- It often proposes code that looks right locally but is wrong systemically.

That forces engineers to spend tokens re-explaining the codebase and spend time cleaning up after the model.

`be-ai-heart` exists to become the project memory and safe workbench that AI lacks.

It gives each repository a persistent “heart”:

- what the project is
- what already exists
- what is safe to reuse
- what patterns are allowed
- how modules relate
- which changes are likely to break architecture
- which docs, specs, business requirements, and domain rules should shape the task
- which model/provider and tool actions are being used
- what benchmark evidence exists for the workflow

When an agent starts a task, it should not start cold.

## Product Story in One Sentence

`be-ai-heart` turns codebases, project documents, and domain packs into durable, queryable memory so AI agents can work like informed teammates instead of stateless autocomplete.

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
4. The user chooses the model/provider and sees which repo, docs, domain-pack, benchmark, and policy context is attached.
5. The agent sees modules, symbols, owners, rules, recent decisions, and likely reuse targets.
6. The final change is more consistent, cheaper, and easier to review.

## Jobs To Be Done

### For the individual engineer

- “Before I ask AI to code, I want it to understand my project and reuse existing patterns.”

### For the tech lead

- “I want AI-generated changes to respect architecture and reduce review cleanup.”

### For the engineering manager

- “I want measurable savings and confidence that our AI spend improves output quality.”

### For the enterprise buyer

- “I need AI-assisted development to be governable, secure, and economically defensible.”

### For the sales engineer or founder

- “I need source-backed domain assets, demo kits, and benchmark scenarios that make customer conversations concrete without overclaiming.”

## Product Principles

1. Context before generation
2. Minimal tokens, maximal signal
3. Reuse before creation
4. Rules must be explicit, not implied
5. Local-first for developers, enterprise-ready for companies
6. Benchmark value, do not merely claim it
7. Label current, prototype, planned, and future capabilities explicitly

## Positioning

Do not position `be-ai-heart` as:

- a full IDE replacement
- another LLM wrapper
- another vector search product

Position it as:

- the context operating layer for AI software delivery
- project memory for coding agents
- an enterprise-grade AI coding governance and efficiency platform
- a local-first AI coding workbench that connects repo memory, docs/specs, MCP, domain packs, provider choice, and ROI evidence

## Current Product Story

| Layer | What users can do now | Planned next |
| --- | --- | --- |
| CLI | Initialize, scan, inspect, generate packs, sync docs/profile/benchmarks, build domain-pack artifacts, choose models, run one-shot chat | More guided agent execution and richer terminal artifact cards |
| CLI workbench | Use slash and natural commands for repo memory, model status, context, tools, packs, and benchmarks | Deeper streaming/tool orchestration and confirmation flows |
| MCP | Expose compact local tools to compatible agents | More tool budget and policy tests as tools expand |
| Portal | Review synced repo memory, docs/spec status, graph, diagrams, benchmarks, domain packs, model settings, and chat command records | Saved context pack history, richer AI chat execution, team workflow polish |
| Domain packs | Use Tolling Management pack and generate demo-safe sales kit artifacts | More customer overlays, domain-pack benchmarks, and additional vertical packs |
| Benchmarks | Run local baseline vs assisted scenarios and publish sanitized reports | Customer-calibrated observed benchmark evidence |
| Enterprise | Use role-aware portal/admin surfaces and documented security boundaries | SSO/RBAC hardening, billing adapters, private deployment, audit/retention depth |

## Brand Angle

The name `heart` should represent:

- the living core of the codebase
- a central memory and coordination organ
- a signal that keeps AI work coherent and safe

## Elevator Pitch

`be-ai-heart` helps AI coding tools understand your codebase before they write code. It builds a live graph of your project, exposes it through CLI, portal chat, and MCP, and gives agents the exact context they need to reuse code, follow architecture, respect docs/specs, use domain memory, and spend fewer tokens.
