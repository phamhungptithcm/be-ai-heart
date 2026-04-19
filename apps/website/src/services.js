export const WEBSITE_SERVICES = Object.freeze([
  {
    slug: "code-graph",
    title: "Code Graph",
    subtitle: "Symbols, dependencies, impact paths",
    descriptor: "Maps repository structure, dependencies, and likely impact",
    trustTag: "Core memory",
    category: "Core memory",
    summary:
      "Map the repository into typed symbols, dependency edges, and impact paths so AI starts from structure instead of search noise.",
    hero_eyebrow: "Services / Code Graph",
    hero_title: "Map the repo into a code graph agents can actually use.",
    hero_description:
      "BeHeart indexes symbols, modules, dependencies, and impact paths so AI stops wandering through the codebase blind and starts from reusable structure.",
    proof: [
      { label: "Typed symbols", value: "6.5k+", note: "Functions, methods, classes, routes, and tests stay queryable." },
      { label: "Impact paths", value: "< 10s", note: "Surface likely touch points before implementation starts." },
      { label: "Reuse signal", value: "High", note: "Existing modules are easier to find before AI writes net-new code." },
    ],
    metrics: [
      { label: "Primary job", value: "Repo structure", detail: "Turn file sprawl into symbols, modules, and callable edges." },
      { label: "Best used when", value: "Tasks touch many files", detail: "Especially useful for edits that cross boundaries or require reuse." },
      { label: "Trust hook", value: "Impact visibility", detail: "Reviewers can see why a file or symbol is relevant before patching." },
    ],
    bars: [
      { label: "Symbol lookup confidence", value: 88, caption: "High-signal retrieval from typed graph evidence", tone: "brand" },
      { label: "Dependency explainability", value: 82, caption: "Imports, calls, inheritance, and test links stay connected", tone: "teal" },
      { label: "Impact path usefulness", value: 79, caption: "Best on multi-file changes where sequence matters", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "Blind exploration burns tokens and usually misses reusable paths that already exist." },
      { label: "What this avoids", detail: "Agents repeatedly rediscovering repo structure on every medium-sized task." },
    ],
    capabilities: [
      {
        title: "Typed symbol inventory",
        body: "Capture functions, methods, classes, interfaces, tests, and routes as first-class graph nodes instead of treating every file as flat text.",
      },
      {
        title: "Dependency explanation",
        body: "Trace imports, calls, inheritance, and test relationships so agents can explain why a file or symbol matters to the task.",
      },
      {
        title: "Impact analysis",
        body: "Predict likely blast radius before the patch lands so teams can scope edits, reviews, and follow-up work more responsibly.",
      },
    ],
    workflow: [
      { step: "01", title: "Scan and parse", body: "Local scan turns source files into a typed graph instead of a raw file list." },
      { step: "02", title: "Rank relevant structure", body: "Context compiler promotes symbols, modules, and tests closest to the task." },
      { step: "03", title: "Explain blast radius", body: "Impact and dependency views make it easier to review multi-file changes." },
      { step: "04", title: "Reuse what already exists", body: "AI is pushed toward existing modules and functions before inventing new ones." },
    ],
    outcomes: [
      { title: "Less blind exploration", body: "Agents spend less time opening random files just to reconstruct the system shape." },
      { title: "Cleaner reuse", body: "Existing modules are surfaced earlier, so duplicate implementation drops before review." },
      { title: "Better reviews", body: "Reviewers can see why a patch touched a file and what else is likely affected." },
    ],
  },
  {
    slug: "document-memory",
    title: "Document Memory",
    subtitle: "Requirements, ADRs, design context",
    descriptor: "Keeps requirements, ADRs, and design context retrievable",
    trustTag: "Citable",
    category: "Core memory",
    summary:
      "Pull requirements, design docs, ADRs, and operational notes into the same memory layer as code so intent travels with implementation.",
    hero_eyebrow: "Services / Document Memory",
    hero_title: "Bring requirements and design intent into the same memory model as code.",
    hero_description:
      "BeHeart ingests product requirements, architecture docs, ADRs, and uploaded notes so AI can work from why the system exists, not only how the files are laid out.",
    proof: [
      { label: "Context depth", value: "Code + docs", note: "Business and technical memory stay queryable together." },
      { label: "Freshness view", value: "Latest-first", note: "Lineage and recency keep stale documents from dominating context." },
      { label: "Prompt waste", value: "Down", note: "Less manual re-explaining of system goals and constraints." },
    ],
    metrics: [
      { label: "Primary job", value: "Intent retrieval", detail: "Bring design, requirements, and decision history into task context." },
      { label: "Best used when", value: "Why matters", detail: "Most valuable when the task is constrained by product or architecture intent." },
      { label: "Trust hook", value: "Citable memory", detail: "Context can point back to source docs instead of inventing rationale." },
    ],
    bars: [
      { label: "Requirement coverage", value: 84, caption: "Requirements and briefs stay visible next to repository memory", tone: "brand" },
      { label: "Decision recall", value: 78, caption: "ADRs and system design notes reduce contradictory implementation", tone: "teal" },
      { label: "Freshness awareness", value: 74, caption: "Latest lineage and summaries keep old docs from overwhelming tasks", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "Code-only memory misses the business and architectural reasons that reviewers still care about." },
      { label: "What this avoids", detail: "AI making locally-correct changes that ignore the approved design or rollout plan." },
    ],
    capabilities: [
      {
        title: "Requirements ingestion",
        body: "Index business requirements, acceptance criteria, tickets, and planning notes alongside code-level memory.",
      },
      {
        title: "Design and ADR recall",
        body: "Keep technical design, system design, and ADRs retrievable so implementation choices stay closer to approved intent.",
      },
      {
        title: "Freshness and lineage",
        body: "Prefer recent versions and summaries so teams see the most current explanation without dumping full documents into prompts.",
      },
    ],
    workflow: [
      { step: "01", title: "Import docs", body: "Sync markdown, uploaded docs, and curated notes into the same project memory lane." },
      { step: "02", title: "Link docs to code", body: "Connect document memory to modules, symbols, and domain areas where possible." },
      { step: "03", title: "Rank by task", body: "Context pack pulls only the documents and headings most relevant to the change." },
      { step: "04", title: "Keep reviewers aligned", body: "Portal and CLI views show which requirements or ADRs informed the work." },
    ],
    outcomes: [
      { title: "Less re-explaining", body: "Developers stop restating the same context every time an AI task touches the same domain." },
      { title: "Fewer intent regressions", body: "Changes stay closer to approved design because the rationale is visible, not tribal." },
      { title: "Stronger buyer trust", body: "The product feels like durable project memory, not just code search with better branding." },
    ],
  },
  {
    slug: "policy-rails",
    title: "Policy Rails",
    subtitle: "Reuse paths, boundaries, exclusions",
    descriptor: "Applies governed boundaries, exclusions, and reuse paths",
    trustTag: "Governed",
    category: "Governance",
    summary:
      "Guide AI toward preferred reuse paths, boundary-safe changes, and excluded areas so speed does not come at the cost of architecture drift.",
    hero_eyebrow: "Services / Policy Rails",
    hero_title: "Steer AI with boundaries and reuse rules before code is generated.",
    hero_description:
      "BeHeart turns architecture expectations into explicit policy rails so agents know what to reuse, what not to cross, and which paths should stay out of context entirely.",
    proof: [
      { label: "Boundary safety", value: "Explicit", note: "Module and package rules can be surfaced before the patch starts." },
      { label: "Reuse pressure", value: "Built-in", note: "Preferred implementation paths are easier to follow than ad hoc reinvention." },
      { label: "Context hygiene", value: "Selective", note: "Sensitive or noisy paths can stay out of prompts and retrieval." },
    ],
    metrics: [
      { label: "Primary job", value: "Governed AI", detail: "Translate architectural expectations into reusable rails for context and review." },
      { label: "Best used when", value: "Scale begins", detail: "Most valuable when multiple engineers or agents can touch the same domain." },
      { label: "Trust hook", value: "Least surprise", detail: "The product helps teams preserve boundaries instead of clean up after violations." },
    ],
    bars: [
      { label: "Reuse alignment", value: 86, caption: "Preferred modules and paths are easier to find before net-new code appears", tone: "brand" },
      { label: "Boundary clarity", value: 81, caption: "Policy checks make crossing app and package seams visible early", tone: "teal" },
      { label: "Context hygiene", value: 76, caption: "Excluded paths reduce secret leakage and low-signal prompt noise", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "Faster AI is not enough if it erodes architecture confidence and increases review cleanup." },
      { label: "What this avoids", detail: "Agents crossing boundaries, reviving deprecated paths, or ignoring the preferred reuse lane." },
    ],
    capabilities: [
      {
        title: "Boundary rules",
        body: "Flag package and module boundaries that should not be crossed casually during AI-assisted implementation.",
      },
      {
        title: "Preferred reuse paths",
        body: "Bias context and reviews toward the modules, helpers, or packages teams want reused instead of duplicated.",
      },
      {
        title: "Exclusions and redaction",
        body: "Keep sensitive, noisy, or irrelevant paths out of memory retrieval so context stays cleaner and safer.",
      },
    ],
    workflow: [
      { step: "01", title: "Define the rail", body: "Encode preferred paths, deprecated areas, and exclusions in policy config." },
      { step: "02", title: "Apply during retrieval", body: "Context ranking and checks surface these rails before implementation begins." },
      { step: "03", title: "Validate during review", body: "Policy checks make architecture drift or risky imports visible to reviewers." },
      { step: "04", title: "Keep trust compounding", body: "Teams get faster AI work without silently weakening the codebase." },
    ],
    outcomes: [
      { title: "Lower architecture drift", body: "AI changes are less likely to take the fastest but least maintainable path." },
      { title: "More reusable code", body: "Preferred modules are surfaced before duplication takes root in the patch." },
      { title: "Safer context delivery", body: "Sensitive or low-value paths stop polluting prompts and web-facing memory views." },
    ],
  },
  {
    slug: "cli-mcp-runtime",
    title: "CLI + MCP Runtime",
    subtitle: "Local-first delivery into agent workflows",
    descriptor: "Delivers local-first memory into agent workflows",
    trustTag: "Deterministic",
    category: "Runtime",
    summary:
      "Deliver project memory where engineers already work: local CLI for scans and benchmarks, MCP tools for structured agent access.",
    hero_eyebrow: "Services / CLI + MCP Runtime",
    hero_title: "Deliver BeHeart where real AI-assisted coding already happens.",
    hero_description:
      "BeHeart stays local-first through the CLI and serves structured memory into AI agents through MCP, so teams do not need to choose between speed, trust, and workflow fit.",
    proof: [
      { label: "Deployment mode", value: "Local-first", note: "Engineers can start without waiting on heavy hosted setup." },
      { label: "Agent delivery", value: "MCP tools", note: "Symbol lookup, impact, documents, and context packs become structured calls." },
      { label: "Operational fit", value: "Daily use", note: "The workflow lives where engineers already scan, inspect, and benchmark." },
    ],
    metrics: [
      { label: "Primary job", value: "Workflow delivery", detail: "Put memory, checks, and benchmarks directly into daily engineering tools." },
      { label: "Best used when", value: "Hands-on rollout", detail: "Ideal for design partners and teams proving value before wider platform work." },
      { label: "Trust hook", value: "Deterministic tools", detail: "CLI and MCP contracts stay narrower and easier to test than vague chat behavior." },
    ],
    bars: [
      { label: "Local workflow fit", value: 89, caption: "Engineers can scan, inspect, and benchmark from the repository itself", tone: "brand" },
      { label: "Agent interoperability", value: 83, caption: "Structured MCP calls make memory accessible across AI tools", tone: "teal" },
      { label: "Operational clarity", value: 77, caption: "Deterministic commands are easier to trust than improvisational prompts", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "The fastest rollout path starts where engineers already work instead of forcing a new control plane first." },
      { label: "What this avoids", detail: "Overbuilding hosted complexity before daily engineering value is proven on real repos." },
    ],
    capabilities: [
      {
        title: "CLI workflows",
        body: "Run scans, inspect graph state, search documents, sync profiles, and execute benchmarks directly from the repo.",
      },
      {
        title: "MCP tool delivery",
        body: "Expose context packs, symbol lookup, impact analysis, and document search as structured tools for agent clients.",
      },
      {
        title: "Deterministic contracts",
        body: "Keep command and tool outputs explicit, schema-like, and easier to validate than free-form assistant behavior.",
      },
    ],
    workflow: [
      { step: "01", title: "Scan locally", body: "Build project memory from code and documents without requiring a hosted dependency first." },
      { step: "02", title: "Serve memory to agents", body: "MCP exposes the same memory layer to coding tools through narrow, structured calls." },
      { step: "03", title: "Publish web artifacts", body: "Profiles, docs, and benchmark outputs can then move into portal and admin surfaces." },
      { step: "04", title: "Repeat with proof", body: "The team can benchmark and iterate without abandoning the local engineering loop." },
    ],
    outcomes: [
      { title: "Lower rollout friction", body: "Teams can start with one repo and one engineer instead of a full platform procurement motion." },
      { title: "Better tool fit", body: "Memory reaches agents through MCP without forcing a one-vendor workflow." },
      { title: "More testable behavior", body: "CLI and MCP contracts are easier to verify, compare, and support over time." },
    ],
  },
  {
    slug: "portal-admin-surfaces",
    title: "Portal + Admin Surfaces",
    subtitle: "Customer workspace plus internal control plane",
    descriptor: "Separates tenant workspace from internal control plane",
    trustTag: "Tenant-safe",
    category: "Surfaces",
    summary:
      "Give customers a tenant-safe workspace for memory and ROI, while internal teams get a separate control plane for support, revenue, billing, audit, and observability.",
    hero_eyebrow: "Services / Portal + Admin Surfaces",
    hero_title: "Keep customer workspace and internal control plane separate on purpose.",
    hero_description:
      "BeHeart exposes a tenant-scoped portal for customers and a separate admin surface for internal operators so trust, governance, and day-to-day operations stay clear instead of blending into one confused interface.",
    proof: [
      { label: "Surface split", value: "3 lanes", note: "Website, portal, and admin each serve a different job cleanly." },
      { label: "Tenant safety", value: "Explicit", note: "Customer actors do not see internal sessions, observability, or control-plane actions." },
      { label: "Operational clarity", value: "Readable", note: "Metrics are labeled by source and role-aware by default." },
    ],
    metrics: [
      { label: "Primary job", value: "Readable operations", detail: "Turn synced artifacts, billing posture, and operational risk into understandable web surfaces." },
      { label: "Best used when", value: "Team adoption begins", detail: "Most useful once one repo becomes an org rollout, not just a local experiment." },
      { label: "Trust hook", value: "Role-aware views", detail: "Customers and internal staff see only the controls and metrics meant for them." },
    ],
    bars: [
      { label: "Tenant readability", value: 84, caption: "Portal keeps readiness, usage, billing, and audit posture easy to scan", tone: "brand" },
      { label: "Internal control clarity", value: 80, caption: "Admin separates support, observability, billing ops, and revenue posture", tone: "teal" },
      { label: "Security confidence", value: 78, caption: "Separate surfaces reduce accidental leakage of internal-only controls", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "A trustworthy product surface should not force customers to interpret internal admin concepts." },
      { label: "What this avoids", detail: "One blended dashboard trying to be acquisition site, customer portal, and back office at the same time." },
    ],
    capabilities: [
      {
        title: "Tenant portal",
        body: "Customers can review repositories, documents, benchmarks, usage, billing posture, team access, audit history, and settings in one tenant-safe workspace.",
      },
      {
        title: "Internal admin control plane",
        body: "Internal teams can monitor customer health, support queues, sessions, observability, billing ops, and revenue posture without exposing these controls to customers.",
      },
      {
        title: "Role-aware visibility",
        body: "Navigation, pages, and actions are gated by portal and admin roles so the UI matches real responsibilities instead of demo personas.",
      },
    ],
    workflow: [
      { step: "01", title: "Publish memory artifacts", body: "Profiles, docs, and benchmark outputs land in a customer-readable portal lane." },
      { step: "02", title: "Operate the tenant", body: "Customers review readiness, ROI, billing posture, sessions, and settings by role." },
      { step: "03", title: "Support internally", body: "BeHeart staff use admin for health, support, observability, and billing operations." },
      { step: "04", title: "Keep boundaries clean", body: "Customer and internal actors stay in separate surfaces with separate responsibilities." },
    ],
    outcomes: [
      { title: "Cleaner trust boundary", body: "Customers get a real workspace instead of an internal-facing or demo-shaped dashboard." },
      { title: "More useful operations", body: "Internal teams can act on support, billing, and risk signals without overbuilding a CRM." },
      { title: "Stronger enterprise narrative", body: "The product reads like a real system of record for AI rollout, not a single mock-heavy app." },
    ],
  },
  {
    slug: "benchmark-roi",
    title: "Benchmark ROI",
    subtitle: "Token, cleanup, and trust proof",
    descriptor: "Turns savings and cleanup claims into measurable proof",
    trustTag: "Measured",
    category: "Proof",
    summary:
      "Quantify whether BeHeart actually reduced token waste, review cleanup, and duplicate work instead of relying on demo language or anecdotal wins.",
    hero_eyebrow: "Services / Benchmark ROI",
    hero_title: "Prove that AI work got cheaper, cleaner, and easier to trust.",
    hero_description:
      "BeHeart benchmarks compare baseline and assisted runs on repeatable scenarios so teams can see whether project memory and policy rails changed the economics of real delivery work.",
    proof: [
      { label: "Savings lens", value: "Token + time", note: "Measure token reduction and time-to-acceptable patch, not only final output." },
      { label: "Cleanup lens", value: "Review edits", note: "Track whether assistance reduced reviewer cleanup and duplicate work." },
      { label: "Trust lens", value: "Repeatable", note: "Use the same scenario and evidence shape to make claims easier to defend." },
    ],
    metrics: [
      { label: "Primary job", value: "Visible ROI", detail: "Turn AI quality and cost changes into something buyers and engineering leads can read." },
      { label: "Best used when", value: "Proof matters", detail: "Most useful in pilots, expansion reviews, and budget conversations." },
      { label: "Trust hook", value: "Same-scenario comparison", detail: "Claims are grounded in repeatable tasks instead of vague impressions." },
    ],
    bars: [
      { label: "Token savings clarity", value: 87, caption: "Savings read best when baseline and assisted runs use the same scenario", tone: "brand" },
      { label: "Cleanup visibility", value: 79, caption: "Reviewer effort becomes part of the ROI conversation instead of hidden labor", tone: "teal" },
      { label: "Buyer readability", value: 82, caption: "Benchmark artifacts translate engineering change into decision-friendly proof", tone: "cyan" },
    ],
    notes: [
      { label: "Why buyers care", detail: "Most AI tools promise speed, but few show whether the speed was cheaper, cleaner, or safer." },
      { label: "What this avoids", detail: "Selling an enterprise rollout on anecdotal demos that cannot survive procurement scrutiny." },
    ],
    capabilities: [
      {
        title: "Scenario-based comparison",
        body: "Run repeatable task scenarios across baseline and assisted workflows so the comparison stays grounded in the same job.",
      },
      {
        title: "Cost and quality signals",
        body: "Track token savings, cleanup reduction, duplicate work avoidance, and manager-readable summaries from the same evidence base.",
      },
      {
        title: "Portal and admin visibility",
        body: "Publish results into customer and internal surfaces so ROI is visible where expansion and support decisions actually happen.",
      },
    ],
    workflow: [
      { step: "01", title: "Choose the scenario", body: "Pick a representative workflow where AI cost, cleanup, or reuse quality already matters." },
      { step: "02", title: "Run baseline and assisted", body: "Compare the same scenario with and without BeHeart-backed context and rails." },
      { step: "03", title: "Publish the artifact", body: "Generate manager- and engineer-readable outputs from the same underlying evidence." },
      { step: "04", title: "Use it in decisions", body: "Bring the report into pilot, expansion, and retention conversations with less hand-waving." },
    ],
    outcomes: [
      { title: "More defensible spend", body: "Leaders can justify rollout with evidence instead of belief that better context probably helped." },
      { title: "Cleaner expansion path", body: "Portal and admin can distinguish benchmark-derived ROI from real metered usage posture." },
      { title: "Stronger product moat", body: "The product becomes harder to dismiss as another AI wrapper when the savings story is measurable." },
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
