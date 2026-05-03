export const WEBSITE_SERVICE_DESCRIPTOR_MAX_LENGTH = 72;
export const WEBSITE_SERVICE_TRUST_TAG_MAX_LENGTH = 16;

const SHARED_DETAIL =
  "Use this in a design partner pilot when the team needs concrete proof before a broader rollout.";

export const WEBSITE_SERVICES = Object.freeze([
  {
    slug: "durable-project-memory",
    title: "Durable Project Memory",
    subtitle: "Code, docs, policy, and benchmark memory",
    descriptor: "Keeps project context reusable across AI coding sessions",
    trustTag: "Core memory",
    category: "Memory",
    status: "Available for pilots",
    summary:
      "Turn a repository into durable project memory so AI work starts from current code, documents, decisions, policies, and evidence instead of a cold prompt.",
    hero_eyebrow: "Services / Durable Project Memory",
    hero_title: "Give AI-assisted teams a project memory that survives the session.",
    hero_description:
      "BeHeart keeps repository structure, product intent, architecture rules, and benchmark history in one reusable layer for developers, teams, and evaluators.",
    proof: [
      { label: "Primary job", value: "Remember", note: "Preserve reusable repo understanding across repeated AI coding tasks." },
      { label: "Data posture", value: "Local first", note: "Teams can scan and inspect locally before syncing reviewed summaries." },
      { label: "Buyer fit", value: "Pilot ready", note: "Start with one repo, one workflow, and one evidence review." },
    ],
    metrics: [
      { label: "Best used when", value: "Context repeats", detail: "Teams keep re-explaining the same architecture, requirements, and reuse paths." },
      { label: "Trust hook", value: "Citable memory", detail: "Context points back to code, docs, policies, and benchmark artifacts." },
      { label: "Rollout note", value: "Local to shared", detail: "Local memory can later feed portal views without making the portal the source repo." },
    ],
    capabilities: [
      {
        title: "Stable project memory",
        body: "Code graph, document memory, rules, benchmark history, and domain notes stay queryable after the AI chat or coding session ends.",
      },
      {
        title: "Reuse-first guidance",
        body: "Context packs can surface existing modules, known decisions, and likely reuse paths before an agent writes new code.",
      },
      {
        title: "Freshness and citations",
        body: "Memory outputs show when they were generated, which sources shaped them, and where confidence is limited.",
      },
    ],
    workflow: [
      { step: "01", title: "Scan the repo", body: "Build memory from code, project docs, policies, and benchmark artifacts." },
      { step: "02", title: "Ask for context", body: "Use CLI, MCP, or portal-safe previews to retrieve the task-specific memory." },
      { step: "03", title: "Review evidence", body: "Check citations, risks, stale areas, and source labels before scaling usage." },
    ],
  },
  {
    slug: "cli-ai-agent",
    title: "CLI AI Agent",
    subtitle: "Interactive agent, model setup, local context",
    descriptor: "Runs the daily AI agent loop from the repository",
    trustTag: "Local first",
    category: "Developer",
    status: "Available for pilots",
    summary:
      "Use the heart CLI as the developer entry point for repo readiness, model setup, context attachments, chat, packs, MCP, and benchmarks.",
    hero_eyebrow: "Services / CLI AI Agent",
    hero_title: "Run the BeHeart AI agent beside the repository.",
    hero_description:
      "The CLI AI agent combines local repo memory, provider-neutral model selection, context pack attachments, and narrow product actions without turning the portal into a raw shell.",
    proof: [
      { label: "Entry point", value: "heart", note: "The interactive CLI is the fastest path for developers to start locally." },
      { label: "Provider model", value: "BYOK", note: "Keys stay local for CLI use or come from configured provider environment variables." },
      { label: "Action posture", value: "Allowlisted", note: "Agent actions map to BeHeart product commands, not arbitrary shell input." },
    ],
    metrics: [
      { label: "Best used when", value: "Developer starts", detail: "A developer wants repo-aware chat, pack generation, or setup guidance from the terminal." },
      { label: "Trust hook", value: "Local credentials", detail: "CLI model keys are stored locally with masked output and user-only file permissions." },
      { label: "Rollout note", value: "Portal later", detail: "Team visibility can follow once local memory and benchmark artifacts are useful." },
    ],
    capabilities: [
      {
        title: "CLI AI agent",
        body: "Open the interactive workbench, inspect readiness, select a provider/model, attach context, and ask repo-grounded questions.",
      },
      {
        title: "Provider and API key setup",
        body: "Configure provider keys through CLI commands, test discovery, choose a default model, and keep raw secrets out of output.",
      },
      {
        title: "Context-aware chat",
        body: "Use repo memory, docs, graph, benchmark reports, and domain packs as explicit context attachments for agent responses.",
      },
    ],
    workflow: [
      { step: "01", title: "Run heart", body: "Open the interactive agent workbench from the repository root." },
      { step: "02", title: "Select model", body: "Add or test provider credentials, then choose a model suited to the task." },
      { step: "03", title: "Attach memory", body: "Use repo, graph, docs, context packs, benchmark evidence, or domain packs before asking." },
    ],
  },
  {
    slug: "coding-workbench",
    title: "CLI IDE Workbench",
    subtitle: "CLI IDE, coding workbench, action cards",
    descriptor: "Frames a focused AI coding workbench around repo memory",
    trustTag: "Workbench",
    category: "Developer",
    status: "MVP available",
    summary:
      "Bring IDE-like focus to the CLI and portal workbench path: readiness, tasks, context, model choice, artifacts, citations, and confirmations in one guided flow.",
    hero_eyebrow: "Services / CLI IDE Workbench",
    hero_title: "Make AI coding feel like a grounded workbench, not a blank chat box.",
    hero_description:
      "The CLI IDE and AI Coding Workbench path gives developers a structured place to see repo memory, choose context, review artifacts, and confirm risky actions.",
    proof: [
      { label: "Current path", value: "CLI first", note: "The interactive CLI is available today as the first workbench surface." },
      { label: "Portal path", value: "Staged", note: "Richer team workbench views are surfaced as shared artifacts and contracts mature." },
      { label: "User need", value: "Focused", note: "Developers need state, context, and actions visible before code generation." },
    ],
    metrics: [
      { label: "Best used when", value: "Flow matters", detail: "Teams want an AI coding lane with visible readiness, citations, and next actions." },
      { label: "Trust hook", value: "No hidden shell", detail: "Workbench actions remain product actions with confirmation paths where needed." },
      { label: "Rollout note", value: "Label staged work", detail: "Future workbench depth stays marked until implemented and tested." },
    ],
    capabilities: [
      {
        title: "CLI IDE workbench",
        body: "Show repo status, scan health, docs/spec status, MCP readiness, benchmark posture, selected model, and suggested next actions.",
      },
      {
        title: "Artifact cards",
        body: "Present context packs, citations, risks, domain pack outputs, and benchmark summaries as reviewable cards instead of hidden prompt text.",
      },
      {
        title: "Confirmation flow",
        body: "Keep risky or side-effecting work behind explicit approval so the workbench remains governed and auditable.",
      },
    ],
    workflow: [
      { step: "01", title: "Open workbench", body: "Start from repo readiness, current model, and memory status." },
      { step: "02", title: "Choose task mode", body: "Attach the right context source before the agent answers or builds." },
      { step: "03", title: "Review output", body: "Inspect artifact cards, citations, confirmations, and next commands." },
    ],
  },
  {
    slug: "web-portal-chat",
    title: "Web Portal And Chat",
    subtitle: "Portal chat, model selection, provider keys",
    descriptor: "Shows team-safe portal memory, chat, models, and setup",
    trustTag: "Team view",
    category: "Portal",
    status: "Guided pilot",
    summary:
      "Give teams a web portal for repository profiles, context pack previews, portal chat, model selection, provider/API key setup, usage posture, and billing readiness.",
    hero_eyebrow: "Services / Web Portal And Chat",
    hero_title: "Give teams a portal where AI memory is visible and controllable.",
    hero_description:
      "The portal is the shared workspace for synced repository truth, model settings, portal AI chat, context previews, artifacts, security posture, and design partner evidence.",
    proof: [
      { label: "Portal role", value: "Shared view", note: "The portal shows reviewed memory and status without replacing local repo truth." },
      { label: "Chat status", value: "Contracted", note: "Chat uses shared contracts and allowlisted product actions as implementation expands." },
      { label: "Model setup", value: "BYOK ready", note: "Provider keys stay masked and encrypted when server storage is configured." },
    ],
    metrics: [
      { label: "Best used when", value: "Team visibility", detail: "Managers, leads, and design partners need to inspect memory and evidence outside the terminal." },
      { label: "Trust hook", value: "Tenant-scoped", detail: "Portal views must stay customer-safe and separate from internal admin controls." },
      { label: "Rollout note", value: "No raw shell", detail: "Portal chat requests product actions, not arbitrary local commands." },
    ],
    capabilities: [
      {
        title: "Web portal",
        body: "Show repositories, document memory, diagrams, context pack previews, benchmarks, usage, team access, billing posture, and settings.",
      },
      {
        title: "Portal chat and model selection",
        body: "Let users select provider/model, attach context sources, view citations, and understand provider data exposure before sending prompts.",
      },
      {
        title: "Provider/API key setup",
        body: "Expose key presence and provider status without returning raw key material; encrypted storage is required for hosted portal keys.",
      },
    ],
    workflow: [
      { step: "01", title: "Sync reviewed artifacts", body: "Publish safe repo summaries, docs status, diagrams, context previews, and benchmark reports." },
      { step: "02", title: "Choose context and model", body: "Use model selection, provider setup, and context source controls before chatting." },
      { step: "03", title: "Share team proof", body: "Review citations, artifacts, usage posture, and benchmark evidence in the portal." },
    ],
  },
  {
    slug: "mcp-runtime",
    title: "MCP Runtime",
    subtitle: "Structured tools for AI agents",
    descriptor: "Exposes project memory through narrow MCP tools",
    trustTag: "Runtime",
    category: "Runtime",
    status: "Available for pilots",
    summary:
      "Use the MCP runtime to expose BeHeart memory to compatible AI tools through structured calls for overview, context packs, docs search, policies, and benchmarks.",
    hero_eyebrow: "Services / MCP Runtime",
    hero_title: "Let AI agents query project memory through narrow tools.",
    hero_description:
      "BeHeart MCP gives agents structured access to repo memory without handing them broad shell authority or forcing every integration into one editor.",
    proof: [
      { label: "Integration mode", value: "MCP", note: "Compatible agents can call tools instead of receiving a giant prompt dump." },
      { label: "Safety posture", value: "Narrow tools", note: "Tools expose product contracts such as context pack, symbol lookup, and policy check." },
      { label: "Workflow fit", value: "Editor neutral", note: "MCP can serve multiple AI clients through the same memory layer." },
    ],
    metrics: [
      { label: "Best used when", value: "Agents need memory", detail: "A compatible client queries project truth before suggesting or changing code." },
      { label: "Trust hook", value: "Tool contracts", detail: "Structured results are easier to test, audit, and keep compact." },
      { label: "Rollout note", value: "Verify install", detail: "Client setup is detected, installed, and verified before readiness is claimed." },
    ],
    capabilities: [
      {
        title: "MCP runtime",
        body: "Serve project overview, context packs, symbol lookup, impact analysis, docs search, policy checks, benchmark summaries, and domain pack tools.",
      },
      {
        title: "Agent client setup",
        body: "Detect supported local clients, install safe MCP entries, and verify the handshake before teams trust the integration.",
      },
      {
        title: "Tool-safe outputs",
        body: "Keep responses concise, schema-like, redacted where needed, and grounded in local or synced evidence.",
      },
    ],
    workflow: [
      { step: "01", title: "Detect clients", body: "Find supported AI tools and local model runtimes without mutating config." },
      { step: "02", title: "Install and verify", body: "Wire the client to heart mcp serve, then run a real tool handshake." },
      { step: "03", title: "Query memory", body: "Use structured tools for context, graph, docs, policies, benchmarks, and domain packs." },
    ],
  },
  {
    slug: "repo-graph-context-packs",
    title: "Repo Graph And Context Packs",
    subtitle: "Repo graph, context packs, citations",
    descriptor: "Builds graph-backed context packs from repo memory",
    trustTag: "Core memory",
    category: "Memory",
    status: "Available for pilots",
    summary:
      "Compile task-specific context packs from repository graph, symbols, dependencies, documents, policies, citations, risks, and next actions.",
    hero_eyebrow: "Services / Repo Graph And Context Packs",
    hero_title: "Turn repo structure into compact context packs agents can use.",
    hero_description:
      "BeHeart maps code and project documents into a graph, then compiles focused packs that tell AI what exists, what to reuse, what to avoid, and what remains unknown.",
    proof: [
      { label: "Primary output", value: "Context pack", note: "A compact bundle with files, symbols, docs, citations, risks, and next actions." },
      { label: "Memory source", value: "Repo graph", note: "Code, docs, policies, and decisions are linked before retrieval." },
      { label: "Review posture", value: "Cited", note: "Packs show why each source is included." },
    ],
    metrics: [
      { label: "Best used when", value: "Task is specific", detail: "Feature work, fixes, refactors, and document-required changes need focused context." },
      { label: "Trust hook", value: "Reuse before new", detail: "Context packs point agents toward existing modules before creation." },
      { label: "Rollout note", value: "Budget aware", detail: "Token budgets keep context useful without turning into a full repo dump." },
    ],
    capabilities: [
      {
        title: "Repo graph",
        body: "Model packages, files, symbols, imports, calls, tests, documents, decisions, and policies as project memory.",
      },
      {
        title: "Context packs and repo memory",
        body: "Generate focused packs with relevant files, symbols, requirements, architecture rules, reuse candidates, risks, and citations.",
      },
      {
        title: "Context pack preview",
        body: "Show task, token budget, estimated tokens, selected files, docs, citations, risks, and local command examples in the portal.",
      },
    ],
    workflow: [
      { step: "01", title: "Index sources", body: "Scan code and docs into local memory with policy and freshness metadata." },
      { step: "02", title: "Rank relevance", body: "Use task intent to choose the smallest useful files, symbols, documents, and warnings." },
      { step: "03", title: "Deliver pack", body: "Return context through CLI, MCP, or portal-safe previews with citations and next actions." },
    ],
  },
  {
    slug: "docs-spec-sync",
    title: "Docs And Spec Sync",
    subtitle: "Docs, specs, business requirement sync",
    descriptor: "Keeps product intent linked to code memory",
    trustTag: "Citable",
    category: "Documents",
    status: "Available for pilots",
    summary:
      "Keep product docs, specs, business requirements, decisions, and technical architecture aligned with code memory so agents do not ignore why the system exists.",
    hero_eyebrow: "Services / Docs And Spec Sync",
    hero_title: "Keep requirements and code memory moving together.",
    hero_description:
      "BeHeart pulls docs, specs, business requirements, architecture notes, and decisions into the same retrieval layer as code so AI work can cite intent, not just files.",
    proof: [
      { label: "Memory source", value: "Docs plus code", note: "Business and technical documents stay available beside graph memory." },
      { label: "Sync posture", value: "Latest-first", note: "Freshness and lineage help reduce stale requirement drift." },
      { label: "Buyer value", value: "Traceable", note: "Design partners can see which docs shaped a recommendation." },
    ],
    metrics: [
      { label: "Best used when", value: "Intent matters", detail: "A task depends on requirements, roadmap, architecture, or accepted decisions." },
      { label: "Trust hook", value: "Source labels", detail: "Agents cite docs and distinguish current sources from old planning notes." },
      { label: "Rollout note", value: "Docs aligned", detail: "Behavior or architecture changes update docs instead of creating silent drift." },
    ],
    capabilities: [
      {
        title: "Docs/spec/business requirement sync",
        body: "Ingest and surface PRDs, specs, technical design, implementation notes, decisions, and business requirements.",
      },
      {
        title: "Document-aware context",
        body: "Attach the right documents and headings to context packs when a change depends on product or architecture intent.",
      },
      {
        title: "Lineage and freshness",
        body: "Prefer current sources, preserve older lineage, and label missing or stale requirements before implementation starts.",
      },
    ],
    workflow: [
      { step: "01", title: "Classify documents", body: "Identify product, technical, business, architecture, and execution documents." },
      { step: "02", title: "Link intent to work", body: "Connect requirements and decisions to domains, modules, and context packs." },
      { step: "03", title: "Keep docs current", body: "Update website, docs, specs, or runbooks when behavior or claims change." },
    ],
  },
  {
    slug: "domain-packs",
    title: "Domain Packs",
    subtitle: "Industry memory, overlays, source-backed rules",
    descriptor: "Adds reusable industry context to repo memory",
    trustTag: "Domain",
    category: "Domain",
    status: "Phase 1 available",
    summary:
      "Use domain packs to give AI agents source-backed industry memory, layer-aware rules, benchmark scenarios, and generated artifacts without blending generic truth with customer policy.",
    hero_eyebrow: "Services / Domain Packs",
    hero_title: "Give AI agents domain memory before they design vertical software.",
    hero_description:
      "Domain packs add reusable industry context, regional and customer overlays, source notes, security warnings, benchmark scenarios, and demo-safe artifact generation.",
    proof: [
      { label: "Pack model", value: "Layered", note: "Core, regional, agency, and customer overlays stay separate and cited." },
      { label: "First pack", value: "Tolling Management", note: "The first source-backed pack focuses on tolling operations and AI agent support." },
      { label: "Risk posture", value: "Conflict-aware", note: "Unknown or conflicting customer policy is surfaced, not silently merged." },
    ],
    metrics: [
      { label: "Best used when", value: "Domain is heavy", detail: "Teams repeat industry basics, policy caveats, workflow maps, and buyer context." },
      { label: "Trust hook", value: "Source notes", detail: "Claims, rules, and exclusions point to pack sources or customer overlays." },
      { label: "Rollout note", value: "Customer wins", detail: "Customer-specific sources override base pack defaults when accepted." },
    ],
    capabilities: [
      {
        title: "Domain packs",
        body: "Package industry concepts, workflows, entities, business rules, security notes, UI patterns, and benchmark scenarios.",
      },
      {
        title: "Tolling Management Domain Pack",
        body: "Help agents reason about tolling back office, roadside events, trip posting, image review, customer support, cloud cost, and AI agent support.",
      },
      {
        title: "Layered overlays",
        body: "Keep core patterns, regional constraints, agency policies, and customer-specific requirements distinct with citations and conflict reporting.",
      },
    ],
    workflow: [
      { step: "01", title: "Select pack", body: "Choose the industry pack and any regional, agency, or customer overlay sources." },
      { step: "02", title: "Merge carefully", body: "Detect conflicts and cite which layer owns each rule or assumption." },
      { step: "03", title: "Use in delivery", body: "Attach pack context to CLI, MCP, portal chat, benchmark, or demo-kit workflows." },
    ],
  },
  {
    slug: "tolling-demo-kit",
    title: "Tolling Demo Kit",
    subtitle: "Tolling Sales MVP Demo Kit",
    descriptor: "Generates demo-safe tolling sales assets",
    trustTag: "Demo safe",
    category: "Domain",
    status: "Demo safe",
    summary:
      "Generate and show a Tolling Sales MVP Demo Kit with safe demo data, Account 360, customer portal preview, architecture story, proposal starter, and ROI hypothesis.",
    hero_eyebrow: "Services / Tolling Demo Kit",
    hero_title: "Turn tolling domain memory into a buyer-ready sales demo kit.",
    hero_description:
      "The Tolling Sales MVP Demo Kit helps design partners and software vendors show credible tolling workflows before a full runtime exists, with demo-only data and careful ROI language.",
    proof: [
      { label: "CTA fit", value: "Generate kit", note: "Use pack artifacts to prepare a tolling demo, proposal starter, and workflow story." },
      { label: "Data posture", value: "Demo only", note: "No real PII, plates, payment data, trip history, or agency production data." },
      { label: "ROI posture", value: "Hypothesis", note: "ROI language stays designed-to-measure until a benchmark produces evidence." },
    ],
    metrics: [
      { label: "Best used when", value: "Sales needs proof", detail: "A vendor or design partner needs a credible domain demo before the product is funded." },
      { label: "Trust hook", value: "Clear boundary", detail: "The kit marks static demo assets versus future runtime work." },
      { label: "Rollout note", value: "Customize overlay", detail: "Agency policy, rates, legal language, and integrations require customer sources." },
    ],
    capabilities: [
      {
        title: "Tolling Sales MVP Demo Kit",
        body: "Create sales-ready narrative, buyer personas, website copy, UI prototype specs, architecture and DB drafts, demo scripts, and proposal starter content.",
      },
      {
        title: "Account 360 and portal preview",
        body: "Show support cockpit, trips, invoices, disputes, payments, tags, notifications, and customer self-service using safe fake records.",
      },
      {
        title: "Tolling Demo Kit CTA",
        body: "Route users to the tolling microsite and pack workflow where generated artifacts remain source-cited and demo-labeled.",
      },
    ],
    workflow: [
      { step: "01", title: "Choose tolling pack", body: "Start from the Tolling Management pack and selected overlay assumptions." },
      { step: "02", title: "Generate kit", body: "Build demo-safe assets with manifest, citations, warnings, and runtime boundaries." },
      { step: "03", title: "Run buyer demo", body: "Show Account 360 first, then workflow, security, roadmap, and benchmark hypothesis." },
    ],
  },
  {
    slug: "benchmark-roi",
    title: "Benchmark ROI",
    subtitle: "Token, cleanup, reuse, and evidence",
    descriptor: "Turns savings and cleanup claims into measured proof",
    trustTag: "Measured",
    category: "Proof",
    status: "Evidence-led",
    summary:
      "Compare baseline and BeHeart-assisted workflows on repeatable scenarios so token spend, cleanup, reuse, context retention, and quality claims stay evidence-led.",
    hero_eyebrow: "Services / Benchmark ROI",
    hero_title: "Prove whether AI work got cheaper, cleaner, and easier to trust.",
    hero_description:
      "BeHeart benchmarks keep observed, estimated, and mixed evidence separate so teams can evaluate ROI without unsupported savings claims.",
    proof: [
      { label: "Comparison", value: "Same scenario", note: "Baseline and assisted runs use the same task and repo snapshot." },
      { label: "Evidence mode", value: "Labeled", note: "Reports separate observed telemetry from estimates and incomplete captures." },
      { label: "Buyer use", value: "Decision gate", note: "Use benchmark evidence to continue, pause, or expand a pilot." },
    ],
    metrics: [
      { label: "Best used when", value: "ROI matters", detail: "Managers and enterprise buyers need proof beyond a polished demo." },
      { label: "Trust hook", value: "Evidence quality", detail: "Every shared claim cites scenario, measurement mode, and confidence label." },
      { label: "Rollout note", value: "Evidence first", detail: "Public ROI numbers appear only when evidence exists for that claim." },
    ],
    capabilities: [
      {
        title: "Benchmark/ROI evidence",
        body: "Measure token use, time, context retention, duplicate-work avoidance, review cleanup, policy alignment, and task outcomes.",
      },
      {
        title: "Pilot report",
        body: "Produce engineer-readable and buyer-readable reports that explain evidence mode, source artifacts, risks, and next decision.",
      },
      {
        title: "ROI trend digest",
        body: "Summarize benchmark history for portal, admin, repository detail, and agent-facing evidence surfaces.",
      },
    ],
    workflow: [
      { step: "01", title: "Choose scenario", body: "Pick a representative bug fix, feature, refactor, cross-module task, or document-required task." },
      { step: "02", title: "Run comparison", body: "Capture baseline and assisted evidence with the same task constraints." },
      { step: "03", title: "Review report", body: "Use evidence mode and confidence labels before making rollout claims." },
    ],
  },
  {
    slug: "governance-enterprise-readiness",
    title: "Governance And Enterprise Readiness",
    subtitle: "Security, admin, billing, deployment path",
    descriptor: "Frames governed rollout, billing readiness, and deployment",
    trustTag: "Governed",
    category: "Enterprise",
    status: "Evaluation path",
    summary:
      "Prepare design partners and enterprise buyers with governance/security boundaries, admin/founder dashboard posture, payment and billing readiness, and deployment paths.",
    hero_eyebrow: "Services / Governance And Enterprise Readiness",
    hero_title: "Show enterprise buyers the control path without overclaiming it.",
    hero_description:
      "BeHeart separates website, portal, and admin, labels security boundaries, prepares billing and entitlement posture, and supports enterprise deployment reviews as the product matures.",
    proof: [
      { label: "Governance", value: "Boundary-led", note: "Website, portal, and admin stay separate for trust and least-privilege operation." },
      { label: "Billing", value: "Readiness", note: "Payment and billing readiness is framed through adapter-safe posture, not fake revenue claims." },
      { label: "Deployment", value: "Evaluation path", note: "Private deployment, SSO, and retention needs are reviewed before enterprise rollout." },
    ],
    metrics: [
      { label: "Best used when", value: "Buyer asks control", detail: "Security, finance, and platform leaders need to understand trust boundaries." },
      { label: "Trust hook", value: "No certifications claimed", detail: "Security copy avoids compliance claims that have not been achieved." },
      { label: "Rollout note", value: "Future labeled", detail: "SSO/SAML, advanced retention, and private deployment remain customer-specific until implemented." },
    ],
    capabilities: [
      {
        title: "Governance/security",
        body: "Surface tenant boundaries, secret handling, context redaction, allowlisted actions, audit posture, and policy controls in plain language.",
      },
      {
        title: "Admin/founder dashboard",
        body: "Track design partner pipeline, customer health, support, benchmark-backed accounts, revenue posture, billing operations, and observability internally.",
      },
      {
        title: "Payment and billing readiness",
        body: "Prepare pricing, plan posture, entitlement state, invoices, and billing-provider adapter seams without exposing secrets or claiming booked revenue.",
      },
    ],
    workflow: [
      { step: "01", title: "Review boundaries", body: "Clarify local-first data, synced artifacts, portal roles, admin access, and provider exposure." },
      { step: "02", title: "Plan commercial path", body: "Use design partner, team pilot, and enterprise packaging only when evidence supports the next step." },
      { step: "03", title: "Choose deployment path", body: "Evaluate hosted, private, VPC, or on-prem needs with SSO, retention, audit, and support requirements." },
    ],
  },
]);

export function getWebsiteServiceBySlug(slug) {
  const safeSlug = String(slug ?? "").trim().toLowerCase();
  return WEBSITE_SERVICES.find((service) => service.slug === safeSlug) ?? null;
}

export function listWebsiteServices() {
  return [...WEBSITE_SERVICES];
}

export function getWebsiteServicePilotNote() {
  return SHARED_DETAIL;
}
