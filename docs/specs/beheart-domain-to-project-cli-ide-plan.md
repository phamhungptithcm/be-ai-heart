# beheart Domain-to-Project CLI IDE Plan

Status: MVP foundation implemented in CLI/MCP/package contracts. Full portal UI, long customization wizard, production integrations, and marketplace workflows remain future work.

Implemented slice:

- `heart generate` previews and confirms Domain-to-Project generation.
- `heart ide generate` routes the same workflow through the CLI IDE.
- MVP stack presets: `next-fullstack-postgres`, `react-node-postgres`, `spring-react-postgres`.
- MVP modes: `docs-only`, `sales-demo`, `product-starter`, `service-starter`, `ui-starter`, `custom-domain-builder`.
- Generation manifest, rollback snapshot, fake-data guard, secret scan, path sandbox, source citations, selected domain layers, benchmark scenario output, and implementation backlog are included.
- MCP tools: `stack_preset_list`, `domain_project_plan`, `domain_project_generate`.
- Portal integration is represented by shared generation contracts; visual portal screens are still P1.

This plan reframes the `heart ide` workbench from a repo-memory CLI IDE into a Domain-to-Project AI Workbench: a terminal-first flow where a developer selects a domain pack, selects a tech stack, generates a starter project foundation, then keeps building inside beheart with domain-aware AI, repo memory, docs/spec sync, benchmark scenarios, and context packs already attached.

The first domain is `tolling-management`, with a Tolling Sales MVP Demo Kit as the first sales/demo output. Future domains should support reusable packs, customer overlays, and custom pack creation from a structured interview.

## 1. Product Vision

beheart CLI IDE becomes a terminal-first AI workbench where developers can select a domain pack, generate a useful project foundation, and continue coding with domain-aware AI.

Positioning:

- Not just CLI editor: it uses repo memory, docs/spec state, domain packs, benchmarks, and patch safety.
- Not just AI chat: it grounds model responses in selected domain context, generated artifacts, code graph, docs/specs, citations, and warnings.
- Not just project generator: generated projects become live beheart workspaces with context packs, implementation backlog, validation commands, and docs sync.
- Not just docs pack: packs compile into code, DB schema, UI routes, API/service boundaries, tests, fixtures, demo data, benchmark scenarios, and roadmap artifacts.
- beheart combines domain memory, project generation, coding workbench, docs/spec sync, benchmark ROI, and governed AI assistance.

Product promise:

- Domain pack provides reusable industry knowledge.
- Stack preset provides implementation defaults.
- Generator creates a clean starter repo.
- CLI IDE opens that repo with the domain context already loaded.
- Context packs keep AI grounded during continued development.
- Docs/spec sync prevents generated plan, code, and roadmap from drifting silently.
- Benchmarks prove whether pack-assisted work reduces repeated discovery, duplicate work, and review cleanup.

## 2. Problem Solved

Current pain:

- Starting a serious domain-specific product is slow because teams repeat discovery, data modeling, workflow mapping, security review, and UI planning.
- AI lacks stable domain context, so generated projects are generic and miss real business constraints.
- Generated projects often stop at a superficial CRUD shell instead of domain-specific architecture, API boundaries, tests, fixtures, and roadmap.
- Docs/specs/code drift quickly after generation.
- Sales MVPs need credible domain-specific assets fast without pretending demo artifacts are production systems.
- Developers need a clean place to continue coding after generation, with model choice, repo memory, safety checks, and context attached.

beheart solution:

- Domain pack gives source-backed domain memory, glossary, entities, workflows, rules, UI patterns, security notes, and benchmark scenarios.
- Demo kit gives sales MVP assets: buyer story, UI prototype, proposal starter, demo data, ROI hypothesis, architecture, and DB/API drafts.
- Project generator turns a selected domain and stack into a starter repo with clear docs, code, DB schema, APIs, UI screens, tests, fixtures, benchmark scenarios, context packs, and implementation backlog.
- CLI IDE lets developers continue from generated stories, inspect diffs, run tests, update docs/specs, and attach context to AI chat.
- Context packs keep AI grounded in the selected domain, generated project, accepted requirements, and current code graph.
- Docs/spec sync keeps project intent explainable.
- Benchmark harness measures whether the pack-assisted workflow lowers token spend, reduces missed requirements, and improves architecture fit.

## 3. Target Workflow

Default UX principle: the user should choose domain pack and tech stack only. Long customization belongs behind advanced actions.

### Flow A: Generate From Existing Domain Pack

Command:

```bash
heart ide
```

Interactive path:

1. User chooses `Start from domain pack`.
2. User selects `Tolling Management`.
3. beheart infers output mode from prompt or asks one lightweight follow-up only when needed:
   - full product starter
   - sales MVP/demo kit
   - back-office app
   - customer portal
   - API/backend service
   - docs/spec only
4. User chooses stack:
   - `next-fullstack-postgres`
   - `react-node-postgres`
   - `spring-react-postgres`
   - later presets
5. Optional only when requested: regional, agency, or customer overlay.
6. beheart applies smart defaults for domain modules, DB schema, API boundaries, UI routes, demo data, tests, security notes, benchmark scenarios, and implementation backlog.
7. beheart shows generation plan preview:
   - selected domain and stack
   - output directory
   - generated modules
   - estimated files
   - warnings/conflicts
   - validation commands
8. User confirms before any write.
9. beheart generates files inside selected output directory only.
10. beheart creates generation manifest and context pack manifest.
11. beheart runs configured validation or prints exact validation commands when dependencies are not installed.
12. beheart opens generated project in CLI IDE.

Direct command examples:

```bash
heart generate tolling-management --stack next-fullstack-postgres
heart generate tolling-management --stack react-node-postgres
heart generate tolling-management --stack spring-react-postgres
heart generate tolling-management --mode sales-demo --stack next-fullstack-postgres
```

### Flow B: Customize Existing Domain

User starts from Tolling Management, then customizes only when needed:

- agency rules
- account workflow
- payment rules
- case workflow
- UI modules
- DB schema
- API boundaries
- branding/copy
- benchmark scenarios
- regional/customer overlay

Customization should be layered:

1. Start from pack defaults.
2. Apply selected regional layer.
3. Apply selected agency overlay.
4. Apply customer overlay or accepted docs.
5. Surface conflicts and blocking questions.
6. Preview effective rules and generated changes.
7. Confirm before write.

### Flow C: Create New Custom Domain

Natural command examples:

```text
Create a new domain pack for healthcare claims.
Create a domain pack for fleet maintenance.
```

beheart should:

1. Ask structured questions about actors, workflows, entities, data sensitivity, integrations, UI surfaces, rules, and benchmarkable tasks.
2. Create a domain pack skeleton.
3. Generate glossary, workflows, data model, UI/API/security docs, source-notes placeholders, benchmark scenarios, and roadmap.
4. Validate that assumptions are labeled and source citations are missing where needed.
5. Optionally generate starter code from the new pack and selected stack.
6. Save pack for reuse under an approved pack directory.

Custom domain pack creation must not invent legal, medical, financial, or compliance claims. It should label assumptions, request source notes for binding rules, and keep generated demo data fake.

### Flow D: Continue Coding After Generation

After generation, `heart ide` should:

- open generated project root
- show selected domain pack, stack preset, generation mode, output path, and manifest status
- show domain context and effective rules
- show docs/spec and generated README
- show next implementation stories
- allow AI chat with domain, docs/spec, graph, and benchmark attachments
- propose code changes as patch previews
- show diffs and require confirmation before writes
- run tests/lint/typecheck/dev scripts through safe task runner
- update docs/spec after accepted changes
- continue from generated story IDs
- keep generation manifest and context pack current

## 4. Domain-to-Project Outputs

| Output | Input needed | Generated files | Expected quality | Validation | MVP or Later |
|---|---|---|---|---|---|
| Domain pack docs | domain id or custom interview | `pack.yaml`, glossary, workflows, entities, rules, security, sources, benchmarks | Source-backed, layered, assumption-labeled | schema check, link/source check, sensitive-content scan | MVP |
| Sales demo kit | domain, optional mode/overlay | one-pager, buyer personas, website copy, UI prototype, fake data, proposal, ROI story | Demo-safe, credible, no production claims | fake data guard, claim scan, source citation review | MVP |
| Project starter repo | domain, stack, output dir | app skeleton, README, docs, DB/API/UI/test fixtures, context packs | Runnable starter with clear boundaries | install/build/test smoke where feasible | MVP |
| Frontend app | domain, stack, selected UI surface | routes, components, fake fixtures, states, UI copy | Enterprise-ready screens, no decorative generic AI UI | browser smoke later, component/route tests | MVP for selected stack |
| Backend API | domain, stack, selected services | API routes/controllers/services/contracts | Explicit service boundaries, no raw secrets/payment data | unit/contract tests, schema validation | MVP skeleton |
| Database schema/migrations | domain, stack, ORM | schema, seed fixtures, migration notes | Postgres-first, relational integrity, audit-aware | ORM validate/generate, migration dry run | MVP |
| UI prototype | domain, mode, UI surface | prototype spec, screen map, component skeletons | Work-focused, fake data, state coverage | responsive checklist, no PII | MVP |
| Customer portal | domain, stack | customer routes, own-account flows, fake fixtures | Self-service workflow, step-up notes for risky actions | route smoke, auth boundary notes | MVP skeleton |
| Admin/back-office portal | domain, stack | Account 360, queues, reports, case/payment placeholders | Dense operational UI, audit/risk visible | route smoke, fixture tests | MVP skeleton |
| Agent/call-center cockpit | domain, stack | Account 360, action model, case notes, policy warnings | Safe action separation, audit notes | permission and redaction checklist | P1 |
| Benchmark scenarios | domain, generated project | scenario manifests, datasets, rubrics | Fair baseline vs assisted path | scenario schema tests | MVP |
| Implementation backlog | generation plan | story docs, acceptance criteria, tests, security notes | Actionable next stories | markdown lint/checklist review | MVP |
| README/setup docs | stack preset | install/run/test/build/deploy commands | Copyable and accurate | commands checked where feasible | MVP |
| Deployment guide | stack preset | deployment notes, env list, warnings | Safe placeholders, no secret values | secret scan, env validation | P1 |
| Security notes | domain + stack | threat notes, sensitive fields, tool/write boundaries | Explicit risks and controls | secret/PII/payment scan | MVP |

## 5. Project Generation Modes

### Mode 1: Docs Only

Generate docs/specs/domain memory only.

Use when user says `plan`, `spec`, `docs`, `domain memory`, or `no code`.

MVP output:

- domain pack docs or compiled pack docs
- effective rules summary
- architecture plan
- DB/API/UI/test plan
- benchmark scenarios
- implementation backlog
- context pack manifest

### Mode 2: Sales MVP

Generate website/demo kit/proposal/demo data/ROI story.

Use when user says `demo`, `sales`, `showcase`, `pitch`, `proposal`, or `MVP demo`.

MVP output:

- sales-demo-kit docs
- screenshot-ready UI prototype skeleton where stack supports it
- fake demo data
- buyer/demo script
- proposal starter
- ROI hypothesis with benchmark path

### Mode 3: Product Starter

Generate code starter with frontend, backend, database, docs, tests, fixtures, benchmark scenarios, and backlog.

Default when user asks to `start a project` or `build a product`.

MVP output:

- selected stack project structure
- domain modules
- DB schema
- API contracts/routes
- UI routes/components
- test fixtures
- README/setup docs
- implementation backlog
- generated context pack

### Mode 4: Service Starter

Generate backend services and API contracts.

Use when user says `backend`, `API`, `service`, `worker`, or `contracts`.

MVP output:

- service modules
- API contracts
- DB schema/migrations
- fixture data
- service tests
- OpenAPI or contract docs when preset supports it

### Mode 5: UI Starter

Generate portal/back-office/customer UI only.

Use when user says `frontend`, `UI`, `portal`, `back-office`, `customer app`, or `prototype`.

MVP output:

- routes and components
- fake fixtures
- state map
- UI docs/spec
- browser smoke checklist

### Mode 6: Custom Domain Builder

Generate a new domain pack from user interview.

Use when user says `create a new domain pack`, `custom domain`, or names an unsupported domain.

MVP output:

- domain pack skeleton
- assumptions register
- missing source notes
- glossary/workflows/entities/security/UI/API docs
- benchmark scenarios
- optional starter repo after stack selection

## 6. Stack Selection

Stack selection must be explicit but lightweight. The user chooses stack; beheart applies stack-specific defaults.

MVP presets:

| Stack id | Display name | Pros | Cons | Best use | Generated files | Setup commands | Deployment path |
|---|---|---|---|---|---|---|---|
| `next-fullstack-postgres` | Next.js full-stack + Postgres | Fastest full-stack starter, one app, strong route/UI conventions | Can blur backend boundaries if not disciplined | Product starter, sales MVP, customer portal | `app/`, `components/`, `lib/`, ORM schema, fixtures, tests | `npm install`, `npm run dev`, `npm test` | Vercel/Node host + Postgres |
| `react-node-postgres` | React + Node API + Postgres | Clear frontend/backend separation, good service boundary | More folders and local orchestration | Back-office + API service | `apps/web`, `services/api`, shared contracts, DB schema | `npm install`, `npm run dev`, `npm test` | Web host + Node service + Postgres |
| `spring-react-postgres` | Java Spring Boot + React + Postgres | Enterprise-friendly backend, strong typing, common agency stack | More setup weight; Java not beheart MVP default | Agency/backend-heavy starter | `services/api-spring`, `apps/web`, migrations, contracts | `./mvnw spring-boot:run`, `npm run dev` | Containerized Spring + static/web host + Postgres |

Later presets:

| Stack | Pros | Cons | Best use |
|---|---|---|---|
| NestJS | Structured Node backend | Framework ceremony | Larger service starter |
| Fastify | Fast lightweight Node API | Less built-in app structure | API-first Node service |
| Express | Familiar, simple | Easy to sprawl | Minimal prototypes |
| React/Vite | Fast UI-only | Needs separate API | UI starter |
| Vue | Good if customer team prefers Vue | Diverges from repo React default | Partner-facing Vue apps |
| Python/FastAPI | Strong data/API ergonomics | Separate language runtime | Data-heavy API starter |
| Go | Efficient services | More boilerplate for UI/product | High-throughput services |
| Cloudflare Workers | Edge/serverless | Runtime constraints | Lightweight public APIs |
| Supabase | Fast auth/db/storage bootstrap | Platform coupling | SMB MVPs |
| Firebase | Fast hosted app stack | No Postgres default | Consumer-style prototype |

### Stack Preset Contract

Each tech stack preset must define:

- stack id
- display name
- frontend framework
- backend framework
- database
- ORM/query layer
- auth approach
- test framework
- package manager
- dev command
- build command
- deploy target
- generated folder structure
- supported modules
- limitations
- security notes
- benchmark command support

## 7. Domain Pack Compilation

Inputs:

- core domain pack
- regional layer
- agency overlay
- customer overlay
- selected output mode
- selected stack
- user custom requirements
- source notes
- current docs/specs
- constraints
- security profile

Compiler steps:

1. Load pack registry.
2. Validate pack.
3. Merge layers.
4. Detect conflicts.
5. Infer generation mode from prompt when not explicit.
6. Select stack preset.
7. Create default generation plan with smart defaults.
8. Ask only blocking questions:
   - output directory exists
   - stack unclear
   - overwrite risk
   - high-risk payment/security action
   - overlay conflict
   - agency/customer-specific rule requested without source
9. Preview generation plan.
10. Confirm generation.
11. Generate docs.
12. Generate code.
13. Generate tests.
14. Generate demo data.
15. Generate benchmark scenarios.
16. Create artifact manifest.
17. Run validation.
18. Open generated project in IDE workbench.

Important architecture decision: existing `packages/core/src/domain-packs.js` owns current pack metadata and static artifact building. New project generation should move reusable generation planning into dedicated packages rather than expanding `core` into a generator.

## 8. CLI IDE UX

When user opens:

```bash
heart ide
```

Show:

- repo/project status
- selected model
- selected domain pack
- generation mode
- selected stack
- output directory
- context sources
- current tasks
- suggested actions
- warnings/conflicts

Commands:

```text
/domains
/domain select tolling-management
/domain create
/generate
/generate sales-demo
/generate starter
/generate backend
/generate ui
/overlay select texas
/agency select hctra-example
/customize
/plan
/preview
/build
/open
/run
/test
/docs
/context
/benchmark
/deploy
/exit
```

Natural commands:

- `start a tolling management project`
- `generate a sales demo kit`
- `create a back-office portal starter`
- `customize this for HCTRA-style rules`
- `generate customer portal only`
- `create a new domain pack`
- `continue coding this project`
- `show next story`
- `run tests`
- `update docs with latest accepted changes`

Default interactive flow:

```text
User: start tolling project
beheart: Choose tech stack:
  1. Next.js full-stack + Postgres
  2. React + Node API + Postgres
  3. Java Spring Boot + React + Postgres
  4. Custom

After selection:
beheart shows:
- project plan
- generated modules
- output directory
- estimated files
- warnings
- next action

beheart asks:
Generate this project? yes/no
```

Smart default mode inference:

| User prompt signal | Generation mode |
|---|---|
| `demo`, `sales`, `showcase`, `pitch` | Sales MVP |
| `plan`, `spec`, `docs` | Docs Only |
| `CRM`, `account`, `case`, `payment`, `inventory` | Back-office/Product Starter |
| `self-service`, `customer app`, `portal` | Customer Portal/UI Starter |
| `API`, `backend`, `service` | Service Starter |
| `start project`, `starter`, `build product` | Product Starter |

## 9. Portal UX Integration

Portal should support the same workflow visually while respecting local-first boundaries.

Screens:

- Domain Pack Library
- Domain Pack Detail
- New Project From Domain
- Stack Selector
- Overlay/Agency Selector
- Requirements Interview
- Generation Plan Preview
- Generated Artifact Viewer
- Generated Repo Summary
- AI Chat Workbench
- Benchmark/ROI View
- Docs/Spec Sync View

Portal default flow:

1. Domain selector.
2. Tech stack selector.
3. Generate button.
4. Advanced customization collapsed by default.
5. Preview before write.
6. Confirm side effects.
7. Show generated artifacts and local CLI open command.

Portal chat commands:

- `Generate a tolling product starter`
- `Use the Sales MVP mode`
- `Show generated DB schema`
- `Customize payment rules`
- `Create new domain pack`
- `Open generated project in CLI`

Boundary:

- Portal can prepare and review generation plans over synced artifacts.
- Local CLI owns direct local repo scans and file writes unless a safe local runner is explicitly available.
- Portal must not become a raw shell or raw source mirror.

## 10. Architecture

Proposed packages/modules:

| Package | Responsibility |
|---|---|
| `packages/domain-pack-registry` | List/select packs, metadata, source notes, versions, pack availability, registry schema. |
| `packages/domain-pack-compiler` | Merge core/regional/agency/customer layers, conflict detection, effective rule explanation. |
| `packages/project-generator` | Generate docs/code/tests/demo data, write files safely, run validation, rollback. |
| `packages/generation-manifest` | Track generated files, sources, prompts, warnings, story IDs, validation results. |
| `packages/template-engine` | Reusable templates, stack-specific rendering, no ad-hoc string sprawl. |
| `packages/stack-presets` | Supported stacks, commands, dependencies, deployment notes, limitations. |
| `packages/cli-workbench` | Existing IDE state and command loop; add domain/project generation panels and commands. |
| `packages/ai-agent-runtime` | Existing chat/runtime/tool orchestration concept; attach generated domain/project context to chat. |
| `packages/portal-generation-contracts` | Shared portal/service contracts for generation plans, previews, artifacts, confirmations. |

Package notes:

- `packages/core` can keep current pack functions during migration, but new generation responsibilities should not be added there long-term.
- `packages/domain-pack-registry` can initially wrap current `listDomainPacks`, `getDomainPack`, and `validateDomainPack`.
- `packages/domain-pack-compiler` can initially wrap current `mergePackLayers`, `detectPackLayerConflicts`, and `explainEffectivePackRules`.
- `packages/project-generator` owns path safety, generation plan execution, validation, and rollback.
- `packages/template-engine` prevents stack-specific code generation from becoming scattered string concatenation.
- `packages/stack-presets` keeps CLI and portal stack labels, commands, limitations, and deployment notes consistent.
- Portal components consume contracts only; they do not own domain generation logic.

## 11. Function Inventory

| Function | Package/File | Exists? | Purpose | Inputs | Outputs | Tests |
|---|---|---|---|---|---|---|
| `listDomainPacks` | `packages/core/src/domain-packs.js`, future `packages/domain-pack-registry` | Yes | Show supported packs | repo root | pack list | existing domain pack tests |
| `selectDomainPack` | future `packages/domain-pack-registry/src/index.js` | No | Resolve chosen pack and default layers | domain id/prompt | selected pack | registry fixture |
| `createDomainPack` | future `packages/domain-pack-registry` | No | Create custom pack skeleton | interview answers | pack files/manifest | pack skeleton tests |
| `loadDomainPack` | current internal, future registry API | Partial | Load pack metadata and docs | pack id | DomainPack | pack fixture |
| `validateDomainPack` | `packages/core/src/domain-packs.js` | Yes | Validate pack source files and schema | pack id | ValidationResult | existing/expanded |
| `mergeDomainLayers` | current `mergePackLayers`, future compiler | Yes as pack merge | Merge core/regional/agency/customer layers | layer selection | effective rules | conflict fixtures |
| `detectDomainConflicts` | current `detectPackLayerConflicts`, future compiler | Yes | Surface incompatible rules | layer selection | ConflictWarning[] | conflict tests |
| `askDomainQuestions` | future `packages/domain-pack-compiler/src/questions.js` | No | Ask structured custom-domain questions | pack draft | DomainQuestion[] | question fixture |
| `createGenerationPlan` | future `packages/project-generator/src/plan.js` | No | Build explicit generation plan | domain, mode, stack, overlays | GenerationPlan | plan golden tests |
| `previewGenerationPlan` | future generator + CLI/portal renderers | No | Show files/modules/warnings before write | GenerationPlan | preview model | snapshot tests |
| `selectGenerationMode` | future generator | No | Select mode from flag or prompt | prompt/flag | GenerationMode | inference tests |
| `selectStackPreset` | future `packages/stack-presets` | No | Resolve stack | stack id | StackPreset | preset tests |
| `listStackPresets` | future `packages/stack-presets` | No | Show supported tech stacks | none | StackPreset[] | preset tests |
| `validateStackPreset` | future `packages/stack-presets` | No | Check preset completeness | stack id | ValidationResult | schema tests |
| `explainStackTradeoffs` | future `packages/stack-presets` | No | Explain when stack fits | stack id | tradeoff text/data | snapshot |
| `inferGenerationMode` | future generator | No | Choose full/sales/docs/back-office/customer portal | user prompt | GenerationMode | inference fixture |
| `createDefaultGenerationPlan` | future generator | No | Build smart-default plan | domain id, stack id | GenerationPlan | golden plan tests |
| `askOnlyBlockingQuestions` | future generator | No | Ask only required questions | plan | DomainQuestion[] | blocking rules tests |
| `confirmGeneration` | future CLI/portal contracts | No | Confirm writes | plan, user confirmation | confirmation token | confirmation tests |
| `generateProjectFromDomainAndStack` | future generator | No | Main generation entry | domain id, stack id, mode | GeneratedProject | integration fixture |
| `generateDomainDocs` | future generator/templates | No | Generate docs/spec/domain memory | plan | artifacts | golden files |
| `generateSalesDemoKit` | current `writePackArtifact` for static pack artifacts, future generator | Partial | Generate sales demo kit | plan | artifacts | safety tests |
| `generateProjectStarter` | future generator | No | Generate full starter repo | plan | file tree | smoke fixture |
| `generateFrontendStarter` | future generator | No | Generate UI routes/components | plan | frontend files | route/component tests |
| `generateBackendStarter` | future generator | No | Generate API/service skeleton | plan | backend files | contract tests |
| `generateDbSchema` | future generator | No | Generate schema/migrations | plan | DB files | schema validation |
| `generateApiContracts` | future generator | No | Generate API contracts | plan | OpenAPI/routes/contracts | contract validation |
| `generateUiPrototype` | future generator | No | Generate prototype spec/components | plan | UI artifacts | screenshot/smoke later |
| `generateTests` | future generator | No | Generate tests | plan | test files | test run |
| `generateDemoData` | future generator | No | Generate fake fixtures | plan | fixture files | fake data guard |
| `generateBenchmarkScenarios` | future generator/benchmark package | No | Generate scenarios and datasets | plan | benchmark manifests | scenario schema tests |
| `createGenerationManifest` | future `packages/generation-manifest` | No | Track generated files/sources/warnings | plan, artifacts | GenerationManifest | manifest schema tests |
| `writeGeneratedFiles` | future generator file adapter | No | Safe write under output dir | artifacts, output dir | write result | path traversal/overwrite tests |
| `validateGeneratedProject` | future generator | No | Run validation commands/checks | generated project | ValidationResult[] | smoke tests |
| `openGeneratedProjectInIde` | future `packages/cli-workbench` | No | Open generated root | project path | WorkbenchSession | CLI smoke |
| `attachDomainContextToChat` | current `attachDomainPack`, future wrapper | Partial | Attach domain context to AI chat | pack/plan | ContextAttachment | chat attachment tests |
| `updateDocsAfterCodeChange` | current docs proposal concept, future workflow | Partial | Sync docs/spec after accepted code changes | diff, docs | doc patch proposal | docs sync tests |
| `continueFromStory` | future CLI workbench | No | Start AI/code flow from generated story | story id | task context | story fixture |

## 12. Data Contracts

### DomainPack

```ts
type DomainPack = {
  schema_version: number;
  pack_id: string;
  name: string;
  version: string;
  status: "draft" | "active" | "deprecated";
  pack_type: "industry_domain" | "custom_domain";
  description: string;
  documents: Record<string, string>;
  layers_available: DomainLayer[];
  generated_outputs: string[];
  source_notes: SourceCitation[];
  security_warnings: string[];
};
```

### DomainLayer

```ts
type DomainLayer = {
  id: string;
  layer: "core" | "regional" | "agency" | "customer" | "accepted_customer_docs";
  label: string;
  priority: number;
  rules: DomainRule[];
  source_citations: SourceCitation[];
};
```

### AgencyOverlay

```ts
type AgencyOverlay = {
  overlay_id: string;
  name: string;
  layer: "agency";
  description: string;
  rules: DomainRule[];
  ui_flows?: string[];
  api_boundaries?: string[];
  data_model_extensions?: string[];
};
```

### CustomerOverlay

```ts
type CustomerOverlay = {
  overlay_id: string;
  layer: "customer";
  accepted_docs: SourceCitation[];
  requirements: string[];
  rules: DomainRule[];
  constraints: string[];
  sensitive_fields: string[];
};
```

### DomainRule

```ts
type DomainRule = {
  rule_id: string;
  title: string;
  summary: string;
  layer: string;
  source_ref: string;
  risk: "low" | "privacy" | "payment_data" | "money_movement" | "legal_policy" | "security" | "operational";
  tags: string[];
  override_owner?: "core" | "regional" | "agency" | "customer";
};
```

### GenerationMode

```ts
type GenerationMode =
  | "docs-only"
  | "sales-demo"
  | "product-starter"
  | "service-starter"
  | "ui-starter"
  | "custom-domain-builder";
```

### StackPreset

```ts
type StackPreset = {
  stack_id: string;
  display_name: string;
  frontend_framework: string;
  backend_framework: string;
  database: string;
  orm: string;
  auth_approach: string;
  test_framework: string;
  package_manager: string;
  dev_command: string;
  build_command: string;
  deploy_target: string;
  folder_structure: string[];
  supported_modules: string[];
  limitations: string[];
  security_notes: string[];
};
```

### GenerationPlan

```ts
type GenerationPlan = {
  schema_version: number;
  plan_id: string;
  domain_pack_id: string;
  mode: GenerationMode;
  stack_preset_id: string;
  output_dir: string;
  selected_layers: DomainLayer[];
  modules: string[];
  generated_artifacts: GeneratedArtifact[];
  warnings: ConflictWarning[];
  blocking_questions: DomainQuestion[];
  validation_commands: string[];
};
```

### GeneratedArtifact

```ts
type GeneratedArtifact = {
  artifact_id: string;
  kind: "doc" | "source" | "test" | "fixture" | "migration" | "benchmark" | "manifest";
  relative_path: string;
  source_refs: SourceCitation[];
  story_ids: string[];
  overwrite_policy: "create_only" | "confirm_overwrite" | "merge_with_markers";
};
```

### GenerationManifest

```ts
type GenerationManifest = {
  schema_version: number;
  manifest_id: string;
  plan_id: string;
  domain_pack_id: string;
  stack_preset_id: string;
  mode: GenerationMode;
  output_dir: string;
  generated_files: GeneratedArtifact[];
  source_citations: SourceCitation[];
  prompts: string[];
  assumptions: string[];
  warnings: ConflictWarning[];
  validation_results: ValidationResult[];
  rollback_token?: string;
  created_at: string;
};
```

### DomainQuestion

```ts
type DomainQuestion = {
  question_id: string;
  reason: "blocking" | "optional_customization";
  prompt: string;
  answer_type: "single_select" | "multi_select" | "text" | "path" | "confirmation";
  options?: string[];
  default_answer?: string;
};
```

### DomainAnswer

```ts
type DomainAnswer = {
  question_id: string;
  answer: string | string[] | boolean;
  source: "user" | "default" | "inferred";
};
```

### GeneratedProject

```ts
type GeneratedProject = {
  project_id: string;
  root: string;
  domain_pack_id: string;
  stack_preset_id: string;
  manifest_path: string;
  readme_path: string;
  next_story_id: string;
  validation_summary: ValidationResult[];
};
```

### ValidationResult

```ts
type ValidationResult = {
  check_id: string;
  status: "passed" | "failed" | "warning" | "skipped";
  message: string;
  command?: string;
  evidence_path?: string;
};
```

### SourceCitation

```ts
type SourceCitation = {
  source_ref: string;
  label: string;
  path_or_url: string;
  layer?: string;
  claim?: string;
};
```

### ConflictWarning

```ts
type ConflictWarning = {
  warning_id: string;
  severity: "info" | "warning" | "blocking";
  rule_id?: string;
  layers: string[];
  message: string;
  resolution_required: boolean;
  suggested_question?: string;
};
```

## 13. Safety and Governance

Controls:

- Preview before writing.
- Write only inside selected output directory.
- No overwrite without confirmation.
- Generation manifest required for every write.
- Generated demo data must be fake and obvious.
- Secrets never generated.
- API keys never written.
- Payment logic must be PCI-safe placeholder unless real integration is approved in a separate security plan.
- AI-generated code must include tests where feasible.
- Docs must label generated assumptions.
- Conflicts must be surfaced with source layer and severity.
- User can rollback generated files.
- Portal generation must be allowlisted and confirmation-aware.
- Stack presets must never include live credentials or production endpoints.
- Customer overlays must reject raw PII, raw payment data, and secret-like values by default.
- Generated benchmark reports must separate observed, estimated, and hypothesis values.

Threat boundaries:

| Risk | Control |
|---|---|
| Path traversal or overwrite | Resolve output dir, reject writes outside root, create-only default, confirmation token for overwrite |
| Secret leakage | Secret scan generated content and manifests; redact prompts/requirements in manifest |
| Fake PII looks real | Demo data guard with obvious fake IDs, domains, plates, phone numbers, and addresses |
| Payment overclaim | Hosted/tokenized placeholder only; no card fields; PCI notes in docs |
| Legal/agency policy invention | Unknown toll rates, fees, notice windows, legal outcomes, and collections rules become blocking assumptions |
| Portal shell abuse | Portal maps actions to allowlisted contracts only |
| Context bloat | Context packs use token budgets and cite artifacts instead of raw dumps |
| Docs/code drift | Manifest links stories, generated files, docs, and validation state |

## 14. MVP Scope

Fastest MVP:

- Domain Pack Library.
- One domain first: `tolling-management`.
- Three stack presets first:
  - `next-fullstack-postgres`
  - `react-node-postgres`
  - `spring-react-postgres`
- Docs-only generation.
- Sales MVP generation.
- Full starter generation.
- Stack selector.
- Smart default generation plan.
- Ask only blocking questions.
- Generation plan preview.
- Confirm before write.
- Generated docs/code/tests/demo data.
- Generated benchmark scenarios.
- Generated artifact manifest.
- CLI IDE opens generated project.
- AI chat with domain context attached.
- Run validation command.
- Docs update workflow.

Defer:

- Long customization wizard.
- Many stack options.
- Agency-specific wizard.
- Full production backend generation.
- Real payment integration.
- Real deployment automation.
- Autonomous multi-day project generation.
- Domain marketplace.
- Collaboration features.
- Advanced LSP/editor features.
- Production tolling account/payment/OCR integrations.

First generated domain output:

1. Tolling Sales MVP Demo Kit as a safe sales/demo proof.
2. Tolling docs-only compiled pack.
3. Tolling product starter skeleton with Next.js full-stack + Postgres.

## 15. Implementation Stories

### Epic 1: Domain-to-Project Foundation

#### D2P-1: Domain Pack Registry

- User story: As a developer, I can list and select reusable domain packs.
- Acceptance criteria: `tolling-management` appears with metadata, outputs, warnings, source notes, and current status; JSON output is stable.
- Files likely touched: `packages/domain-pack-registry`, wrappers around `packages/core/src/domain-packs.js`, `packages/cli/src/index.js`, `docs/04-mcp-cli-spec.md`.
- Functions/APIs: `listDomainPacks`, `selectDomainPack`, `loadDomainPack`, `validateDomainPack`.
- UI/CLI flow: `/domains`, `/domain select tolling-management`, `heart generate tolling-management --preview`.
- Tests: registry fixture, missing pack, invalid pack, JSON contract.
- Docs: CLI/MCP spec and domain-to-project user guide.
- Security notes: pack metadata must not expose local absolute paths or secrets.
- Priority: P0.
- Definition of done: CLI and package API can select the tolling pack deterministically.

#### D2P-2: Generation Modes

- User story: As a user, beheart can infer whether I need docs, sales demo, starter, service, UI, or custom domain output.
- Acceptance criteria: explicit `--mode` wins; prompt inference handles demo/docs/backend/UI/full starter; unknown prompts default to full starter with preview.
- Files likely touched: `packages/project-generator/src/modes.js`, CLI command parser, tests.
- Functions/APIs: `selectGenerationMode`, `inferGenerationMode`.
- UI/CLI flow: `heart generate tolling-management --mode sales-demo`, natural `generate a sales demo kit`.
- Tests: prompt inference table, explicit flag override.
- Docs: command examples.
- Security notes: high-risk mode inference should not bypass confirmation.
- Priority: P0.
- Definition of done: mode inference is deterministic and tested.

#### D2P-3: Stack Presets

- User story: As a developer, I choose one stack and beheart knows project structure, commands, limits, and deployment path.
- Acceptance criteria: three MVP presets validate; CLI lists presets; invalid stack returns usage error and next action.
- Files likely touched: `packages/stack-presets/src/index.js`, `packages/cli/src/index.js`, docs.
- Functions/APIs: `listStackPresets`, `selectStackPreset`, `validateStackPreset`, `explainStackTradeoffs`.
- UI/CLI flow: stack picker in `heart ide`, `heart generate tolling-management --stack next-fullstack-postgres`.
- Tests: schema tests, missing required preset fields, JSON output.
- Docs: stack selector UX and preset contract.
- Security notes: no preset may contain secrets or live endpoint values.
- Priority: P0.
- Definition of done: stack selection is one-step and scriptable.

#### D2P-4: Generation Manifest

- User story: As a developer, I can inspect exactly what beheart generated and why.
- Acceptance criteria: every generation writes manifest with files, sources, assumptions, warnings, story IDs, validation results, and rollback metadata.
- Files likely touched: `packages/generation-manifest/src/index.js`, `packages/project-generator`.
- Functions/APIs: `createGenerationManifest`.
- UI/CLI flow: `/preview`, `/open manifest`, generated repo summary.
- Tests: manifest schema, redaction, deterministic file list.
- Docs: manifest format.
- Security notes: redact prompts, requirements, local roots, and secret-like values.
- Priority: P0.
- Definition of done: no generated file exists without manifest entry.

### Epic 2: Domain Compiler

#### D2P-COMP-1: Layer Merge

- User story: As an AI agent, I need effective domain rules compiled from pack layers.
- Acceptance criteria: core, regional, agency, and customer overlays merge by priority; output cites each rule layer.
- Files likely touched: `packages/domain-pack-compiler`, wrappers around current `mergePackLayers`.
- Functions/APIs: `mergeDomainLayers`.
- UI/CLI flow: `/overlay select texas`, `/agency select hctra-example`, `/plan`.
- Tests: layer priority fixture, customer override fixture.
- Docs: architecture and conflict model.
- Security notes: customer-specific overlays must reject secrets and raw PII.
- Priority: P0.
- Definition of done: effective rules summary is deterministic and source-cited.

#### D2P-COMP-2: Conflict Detection

- User story: As a product owner, I see conflicting domain rules before generation.
- Acceptance criteria: conflicts show severity, rule, layers, values, and required resolution; blocking conflicts stop write.
- Files likely touched: `packages/domain-pack-compiler`, CLI/portal preview.
- Functions/APIs: `detectDomainConflicts`.
- UI/CLI flow: `/preview` shows conflict warnings before confirm.
- Tests: type conflict, policy conflict, UI/payment-link conflict.
- Docs: safety and governance.
- Security notes: payment, legal, PII, and official-link conflicts are blocking.
- Priority: P0.
- Definition of done: conflicts cannot be silently merged.

#### D2P-COMP-3: Missing Question Flow

- User story: As a user, I only answer questions that block a safe generation.
- Acceptance criteria: asks only for unclear stack, output dir overwrite, high-risk security/payment details, blocking overlay conflicts, or explicit agency/customer customization.
- Files likely touched: `packages/project-generator/src/questions.js`, CLI/portal renderers.
- Functions/APIs: `askOnlyBlockingQuestions`, `askDomainQuestions`.
- UI/CLI flow: one stack question by default; advanced questions collapsed.
- Tests: no-question happy path, overwrite path, conflict path.
- Docs: simplified user flow.
- Security notes: high-risk unknowns become assumptions or blockers, not invented values.
- Priority: P0.
- Definition of done: default tolling project asks only stack selection unless blocked.

#### D2P-COMP-4: Effective Rules Summary

- User story: As a developer, I understand which domain rules shaped generated code.
- Acceptance criteria: generated README and context pack include effective rules, citations, assumptions, and conflicts.
- Files likely touched: compiler, generator templates, chat attachment code.
- Functions/APIs: `attachDomainContextToChat`.
- UI/CLI flow: `/context`, generated repo summary.
- Tests: rules summary snapshot, citation presence.
- Docs: README template and docs/spec template.
- Security notes: restricted customer details redacted from summary.
- Priority: P0.
- Definition of done: AI chat can attach a compact rules summary.

### Epic 3: Project Generator

#### D2P-GEN-1: Docs-Only Generator

- User story: As a user, I can generate docs/spec/domain memory without code.
- Acceptance criteria: docs-only mode writes architecture, DB/API/UI/security/test/benchmark/backlog docs and manifest.
- Files likely touched: `packages/project-generator`, `packages/template-engine`, `docs/templates`.
- Functions/APIs: `generateDomainDocs`, `createDefaultGenerationPlan`.
- UI/CLI flow: `heart generate tolling-management --mode docs-only --stack next-fullstack-postgres`.
- Tests: golden docs, manifest, no source files.
- Docs: generated docs user guide.
- Security notes: assumptions labeled; no secrets or real PII.
- Priority: P0.
- Definition of done: docs-only output validates without installing app dependencies.

#### D2P-GEN-2: Sales Demo Kit Generator

- User story: As a founder or sales engineer, I can generate a tolling sales demo kit from the domain pack.
- Acceptance criteria: sales mode creates demo docs, fake fixtures, UI prototype artifacts, ROI story, proposal starter, and manifest.
- Files likely touched: current pack generator wrappers, future project generator templates.
- Functions/APIs: `generateSalesDemoKit`, current `writePackArtifact`.
- UI/CLI flow: `/generate sales-demo`, `heart generate tolling-management --mode sales-demo`.
- Tests: fake data guard, claim scan, manifest.
- Docs: sales demo kit guide.
- Security notes: no real PII, plates, payment data, agency legal claims, or measured ROI overclaims.
- Priority: P0.
- Definition of done: Tolling demo kit generation is reviewable and demo-safe.

#### D2P-GEN-3: Starter Project Skeleton

- User story: As a developer, I get a runnable starter repo for selected domain and stack.
- Acceptance criteria: full starter writes app structure, README, docs, fixtures, tests, stack commands, manifest; validation command exists.
- Files likely touched: `packages/project-generator`, stack templates.
- Functions/APIs: `generateProjectStarter`, `generateProjectFromDomainAndStack`.
- UI/CLI flow: choose domain + stack, preview, confirm, open IDE.
- Tests: file tree snapshot, generated README, package scripts.
- Docs: setup guide.
- Security notes: generated env examples contain placeholders only.
- Priority: P0.
- Definition of done: generated skeleton can be opened in `heart ide`.

#### D2P-GEN-4: DB/API/UI/Test Generator

- User story: As a developer, generated starter includes domain-specific DB, API, UI, tests, and fixtures.
- Acceptance criteria: tolling modules include account, trips, invoices, cases, payments placeholders, inventory, notifications, reports, audit, benchmark fixtures.
- Files likely touched: generator templates, stack presets, tests.
- Functions/APIs: `generateDbSchema`, `generateApiContracts`, `generateUiPrototype`, `generateFrontendStarter`, `generateBackendStarter`, `generateTests`, `generateDemoData`.
- UI/CLI flow: generated repo summary links modules and tests.
- Tests: schema validation, fixture fake-data scan, test command.
- Docs: generated architecture and schema docs.
- Security notes: payment is hosted/tokenized placeholder; ledger/audit notes present.
- Priority: P1.
- Definition of done: generated code reflects domain modules, not generic CRUD only.

#### D2P-GEN-5: Validation and Rollback

- User story: As a developer, I can validate generated output and roll it back.
- Acceptance criteria: validation checks path safety, manifest, fake data, secret scan, stack commands; rollback removes generated files listed in manifest.
- Files likely touched: `packages/project-generator`, `packages/generation-manifest`, CLI.
- Functions/APIs: `validateGeneratedProject`, `writeGeneratedFiles`.
- UI/CLI flow: `/run validation`, `/rollback generation`.
- Tests: rollback fixture, path traversal, overwrite guard.
- Docs: generated artifact safety.
- Security notes: rollback uses manifest only and never deletes untracked unrelated files.
- Priority: P0.
- Definition of done: failed validation gives exact next action.

### Epic 4: CLI IDE Integration

#### D2P-CLI-1: Domain Selection in CLI IDE

- User story: As a developer, I can pick a domain pack inside `heart ide`.
- Acceptance criteria: `/domains` lists packs; `/domain select tolling-management` sets session state; status row shows selected pack.
- Files likely touched: `packages/cli-workbench`, `packages/cli/src/index.js`.
- Functions/APIs: `selectDomainPack`.
- UI/CLI flow: `heart ide`, `/domains`.
- Tests: CLI workbench command tests.
- Docs: CLI IDE guide.
- Security notes: selected pack metadata redacts local paths.
- Priority: P0.
- Definition of done: selection persists for current generation flow.

#### D2P-CLI-2: Generation Flow in CLI IDE

- User story: As a developer, I can start generation from natural language inside the workbench.
- Acceptance criteria: natural command resolves to generation plan; stack picker appears only if missing; default mode inferred.
- Files likely touched: `packages/cli-workbench`, generator command bridge.
- Functions/APIs: `createGenerationPlan`, `inferGenerationMode`, `selectStackPreset`.
- UI/CLI flow: `start a tolling management project`.
- Tests: natural command fixtures.
- Docs: examples.
- Security notes: no writes before preview/confirm.
- Priority: P0.
- Definition of done: flow reaches preview without file writes.

#### D2P-CLI-3: Preview and Confirm Writes

- User story: As a developer, I can review planned writes before generation.
- Acceptance criteria: preview lists output dir, files, modules, warnings, validation, and overwrite risks; confirmation required for writes.
- Files likely touched: CLI workbench, project generator.
- Functions/APIs: `previewGenerationPlan`, `confirmGeneration`.
- UI/CLI flow: `/preview`, `/generate`.
- Tests: no-confirm write blocked, confirm token accepted once.
- Docs: safety guide.
- Security notes: path traversal and overwrite guard.
- Priority: P0.
- Definition of done: generator cannot write from a natural command alone.

#### D2P-CLI-4: Open Generated Project

- User story: As a developer, beheart opens generated repo with context loaded.
- Acceptance criteria: IDE status shows generated project, domain pack, stack, next story, docs, validation state.
- Files likely touched: `packages/cli-workbench`, `packages/chat-runtime`.
- Functions/APIs: `openGeneratedProjectInIde`, `attachDomainContextToChat`.
- UI/CLI flow: generation success -> open in IDE.
- Tests: CLI smoke.
- Docs: generated README.
- Security notes: avoid leaking absolute home path in synced summaries.
- Priority: P0.
- Definition of done: generated project is the active workbench root.

#### D2P-CLI-5: Continue From Story

- User story: As a developer, I can continue coding from generated backlog stories.
- Acceptance criteria: `/story next` or natural `show next story` loads story context, relevant files, docs, tests, and domain rules into chat.
- Files likely touched: CLI workbench, project generator, chat runtime.
- Functions/APIs: `continueFromStory`, `attachDomainContextToChat`.
- UI/CLI flow: `/context`, `/chat`, `/test`.
- Tests: story fixture and context attachment.
- Docs: backlog format.
- Security notes: high-risk stories include confirmation and security checklist.
- Priority: P1.
- Definition of done: AI chat can start from story with citations and tests.

### Epic 5: Portal Integration

#### D2P-PORTAL-1: Domain Pack Library

- User story: As a portal user, I can browse available domain packs.
- Acceptance criteria: library shows `tolling-management`, outputs, layers, source notes, benchmark scenarios, and warnings.
- Files likely touched: portal domain pack pages, service contracts, future `portal-generation-contracts`.
- Functions/APIs: `listDomainPacks`, `validateDomainPack`.
- UI/CLI flow: Portal `Domain Packs`.
- Tests: service contract and page smoke.
- Docs: portal guide.
- Security notes: tenant-safe synced state only.
- Priority: P1.
- Definition of done: portal mirrors CLI pack metadata.

#### D2P-PORTAL-2: New Project From Domain Flow

- User story: As a portal user, I can prepare a new project from domain and stack.
- Acceptance criteria: domain selector, stack selector, generate button, advanced customization collapsed.
- Files likely touched: portal route/component, service contract.
- Functions/APIs: `listStackPresets`, `createGenerationPlan`.
- UI/CLI flow: Domain -> stack -> preview.
- Tests: UI smoke and contract.
- Docs: portal generation guide.
- Security notes: portal prepares plan; local write requires CLI/local runner confirmation.
- Priority: P1.
- Definition of done: portal can create a generation plan preview.

#### D2P-PORTAL-3: Generation Plan Preview

- User story: As a portal user, I can inspect generated modules/files/warnings before execution.
- Acceptance criteria: preview shows files, stack, output mode, assumptions, conflicts, validation commands.
- Files likely touched: portal components, generation contracts.
- Functions/APIs: `previewGenerationPlan`.
- UI/CLI flow: preview page.
- Tests: snapshot.
- Docs: safety guide.
- Security notes: no write action from preview without confirmation and safe runner.
- Priority: P1.
- Definition of done: warnings/conflicts are visible before generation.

#### D2P-PORTAL-4: Artifact Viewer

- User story: As a user, I can review generated docs/code/demo artifacts in the portal.
- Acceptance criteria: viewer shows manifest, generated files, citations, warnings, and validation results.
- Files likely touched: portal artifact components, service API.
- Functions/APIs: `createGenerationManifest`.
- UI/CLI flow: Generated Artifact Viewer.
- Tests: manifest contract and redaction.
- Docs: artifact viewer notes.
- Security notes: raw local source never displayed unless synced/generated artifact is allowed.
- Priority: P1.
- Definition of done: generated outputs are reviewable with provenance.

#### D2P-PORTAL-5: Portal Chat Commands

- User story: As a portal user, I can ask chat to generate or customize a domain project safely.
- Acceptance criteria: commands normalize to allowlisted generation actions; shell-like input rejected; confirmation required for side effects.
- Files likely touched: `services/api/src/portal-contracts.js`, `packages/agent-tools`, portal workbench.
- Functions/APIs: `createGenerationPlan`, `previewGenerationPlan`, `confirmGeneration`.
- UI/CLI flow: `Generate a tolling product starter`.
- Tests: malicious input denial, confirmation required.
- Docs: portal chat command guide.
- Security notes: no arbitrary shell, no raw secrets, tenant scope enforced.
- Priority: P1.
- Definition of done: chat can prepare generation without becoming a shell.

### Epic 6: Safety and QA

#### D2P-SEC-1: Write Sandbox/Confirmation

- User story: As a developer, generated files cannot escape selected output directory.
- Acceptance criteria: path normalization rejects traversal, symlinks outside root, absolute target file writes, and unconfirmed overwrites.
- Files likely touched: `packages/project-generator/src/write-files.js`, tests.
- Functions/APIs: `writeGeneratedFiles`, `confirmGeneration`.
- UI/CLI flow: confirm prompt.
- Tests: traversal, symlink, existing dir, overwrite.
- Docs: safety section.
- Security notes: mandatory P0 control.
- Priority: P0.
- Definition of done: unsafe paths fail before writing.

#### D2P-SEC-2: Fake Demo Data Guard

- User story: As a security owner, generated demo data stays fake.
- Acceptance criteria: guard rejects real-looking plates, card numbers, bank data, provider secrets, production endpoints, and raw PII markers.
- Files likely touched: generator safety helpers, tests.
- Functions/APIs: `generateDemoData`, validation helper.
- UI/CLI flow: validation warnings.
- Tests: fake data positive/negative fixtures.
- Docs: demo data rules.
- Security notes: required for tolling and sales outputs.
- Priority: P0.
- Definition of done: generated tolling fixtures pass fake-data scan.

#### D2P-SEC-3: Secret Scan

- User story: As a maintainer, generated content cannot include secrets.
- Acceptance criteria: manifest and files scanned; redacted warnings shown; generated `.env.example` uses placeholders.
- Files likely touched: generator validation helpers.
- Functions/APIs: `validateGeneratedProject`.
- UI/CLI flow: validation summary.
- Tests: secret fixtures.
- Docs: security guide.
- Security notes: no raw tokens in logs, prompts, manifests.
- Priority: P0.
- Definition of done: secret-like generated content fails validation.

#### D2P-QA-1: Generator Tests

- User story: As a maintainer, generation is deterministic and contract-safe.
- Acceptance criteria: golden tests for docs-only, sales demo, and full starter plan; schema tests for manifests.
- Files likely touched: `tests/domain-to-project-generator.test.js`, generator packages.
- Functions/APIs: core generator functions.
- UI/CLI flow: none.
- Tests: unit/golden.
- Docs: test plan.
- Security notes: include redaction fixture.
- Priority: P0.
- Definition of done: generator tests pass locally.

#### D2P-QA-2: CLI Smoke Tests

- User story: As a maintainer, new generation commands do not break existing CLI/MCP behavior.
- Acceptance criteria: `heart --help`, `heart ide --json`, `heart generate --help`, non-TTY no hang, JSON clean, MCP stdio clean.
- Files likely touched: `tests/cli-contracts.test.js`, `tests/cli-ide.test.js`, new CLI tests.
- Functions/APIs: CLI entry points.
- UI/CLI flow: direct commands.
- Tests: smoke/contract.
- Docs: CLI spec.
- Security notes: no decoration in JSON/MCP output.
- Priority: P0.
- Definition of done: smoke tests pass.

#### D2P-QA-3: Docs Update

- User story: As the next agent, I can understand how domain-to-project generation fits the product.
- Acceptance criteria: README, CLI/MCP spec, architecture, workbench plan, tolling specs, and user guide are updated when implementation lands.
- Files likely touched: docs only.
- Functions/APIs: none.
- UI/CLI flow: docs examples.
- Tests: link check where available.
- Security notes: docs must not overclaim production tolling/payment or ROI.
- Priority: P0.
- Definition of done: docs match implemented command surface.

## 16. Validation Plan

Validation checks for MVP:

- List domain packs.
- Select Tolling Management.
- List stack presets.
- Select `next-fullstack-postgres`.
- Generate docs-only output.
- Generate sales demo kit.
- Generate starter project skeleton.
- Confirm generation plan preview appears before writes.
- Confirm manifest is created.
- Confirm generated files stay inside output dir.
- Confirm no overwrite without confirmation.
- Confirm no secrets generated.
- Confirm no real PII generated.
- Confirm no real-looking plates/card/bank values generated.
- Confirm payment flows are hosted/tokenized placeholders.
- Confirm conflict warnings shown.
- Confirm CLI opens generated project.
- Confirm AI chat sees domain context.
- Confirm tests/build instructions generated.
- Confirm docs match generated code and module names.
- Confirm benchmark scenarios include baseline vs assisted measurement path.
- Confirm generated ROI language is hypothesis unless observed benchmark evidence exists.

Suggested test matrix:

| Layer | Checks |
|---|---|
| Registry | pack list/select/validate; missing pack; invalid pack |
| Compiler | layer merge; conflict severity; effective rules citations |
| Stack presets | schema completeness; invalid stack; tradeoff text |
| Generator | docs-only, sales demo, full starter golden outputs |
| Safety | path traversal, overwrite, secret scan, fake data scan |
| CLI | non-TTY, JSON clean, preview/confirm, open generated project |
| Portal | plan preview, shell denial, confirmation state, artifact viewer |
| Benchmark | scenario manifests, measurement labels, source links |

## 17. Docs Updates

Update when implementation begins or lands:

- `README.md`: add `heart generate` and domain-to-project quickstart.
- `docs/03-technical-architecture.md`: add domain-pack compiler, project generator, template engine, stack presets, generation manifest boundaries.
- `docs/04-mcp-cli-spec.md`: add `heart generate`, stack commands, CLI IDE domain commands, JSON contracts, non-TTY rules.
- `docs/specs/beheart-cli-ide-workbench-plan.md`: update CLI IDE plan with domain-to-project commands and status.
- `docs/specs/beheart-domain-to-project-cli-ide-plan.md`: this plan.
- `docs/specs/tolling-management-domain-pack-plan.md`: update only if pack contract or layering changes.
- User guide for `start project from domain pack`: domain selection, stack selection, preview, generation, validation, continued coding.

Do not update broad docs before implementation unless the doc clearly labels behavior as planned. Implemented command docs must match actual CLI behavior.

## 18. Final Recommendation

Is Domain-to-Project the right direction for CLI IDE?

Yes. It makes the CLI IDE more than a terminal shell: it turns beheart's durable context layer into a daily workflow that starts from domain memory, generates a useful project foundation, and keeps AI grounded while the developer continues coding.

What should be MVP?

- `tolling-management` only.
- Three stack presets: `next-fullstack-postgres`, `react-node-postgres`, `spring-react-postgres`.
- Docs-only, Sales MVP, and Product Starter modes.
- Smart defaults with only stack selection required by default.
- Preview and confirm before write.
- Generation manifest.
- Safe fake demo data.
- CLI IDE open-after-generate.
- Domain context attached to chat.
- Validation command.

What should be first generated domain output?

First: Tolling Sales MVP Demo Kit, because it is valuable, safer than production runtime generation, and already has source-backed pack artifacts. Next: docs-only compiled pack. Then: Next.js full-stack + Postgres product starter skeleton.

How does this help developers focus?

- Removes blank-project setup.
- Gives domain-specific module boundaries, DB/API/UI/test defaults.
- Puts next stories and validation in the workbench.
- Keeps AI context loaded instead of asking the developer to restate the domain.
- Reduces repeated discovery and generic scaffolding.

How does this help sales/demo workflows?

- Produces credible domain-specific demo assets quickly.
- Keeps claims tied to source notes and benchmark hypotheses.
- Creates UI, architecture, DB/API, fake data, proposal, and ROI story from one pack.
- Makes agency/customer customization a visible overlay instead of a hidden promise.

How does this create beheart's moat?

- Domain packs are reusable memory assets.
- Generated projects carry manifest, citations, stories, context packs, and benchmark scenarios.
- CLI IDE keeps generation connected to continued AI coding.
- Docs/spec sync and benchmark evidence make the workflow governable and measurable.
- The differentiator is not code generation alone; it is domain memory plus project generation plus continued coding context plus proof.

What implementation prompt should run next?

Use this next prompt:

```text
Implement the Domain-to-Project MVP foundation for beheart.

Scope:
- Add stack preset contracts for next-fullstack-postgres, react-node-postgres, and spring-react-postgres.
- Add generation mode inference and default generation plan creation for tolling-management.
- Add generation manifest schema and safe preview-only CLI flow.
- Do not write generated project files yet except manifest/preview fixtures under tests.
- Keep existing domain pack functions as wrappers; do not expand portal or production generators yet.
- Add tests for stack presets, mode inference, plan preview, path safety, and manifest redaction.
- Update README, docs/03, docs/04, and this spec only after behavior exists.
```
