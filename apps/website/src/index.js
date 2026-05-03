import {
  renderHero,
  renderHtmlDocument,
  renderMetricCards,
  renderSection,
  renderSimpleRows,
  renderTwoColumn,
} from "../../../packages/web-render/src/index.js";

export const siteManifest = {
  name: "BeHeart website",
  audience: "public",
  primary_message: "Durable project memory for AI-assisted teams.",
  sections: [
    "home",
    "services",
    "product",
    "how-it-works",
    "cli-mcp",
    "benchmark",
    "pricing",
    "security",
    "docs",
    "customers",
    "sign-in",
    "start-trial",
    "book-demo",
    "domain-demo-kits/tolling-management",
  ],
};

export function renderWebsiteHomePage(options = {}) {
  const portalUrl = options.portalUrl ?? "/portal";
  const signInUrl = options.signInUrl ?? "/sign-in";
  const trialUrl = options.trialUrl ?? "/start-trial";
  const demoUrl = options.demoUrl ?? "/book-demo";

  const hero = renderHero({
    eyebrow: "Public Website",
    title: "Durable project memory for teams adopting AI coding.",
    description:
      "BeHeart connects repo memory, CLI AI agent workflows, portal chat, MCP tools, domain packs, and benchmark evidence so AI work starts with context the team can inspect.",
    actions: [
      { label: "Start Trial", href: trialUrl, primary: true },
      { label: "Sign In", href: signInUrl },
      { label: "Book Demo", href: demoUrl },
      { label: "Open Portal", href: portalUrl },
      { label: "Tolling Demo Kit", href: "/domain-demo-kits/tolling-management" },
    ],
    aside: `
      ${renderMetricCards([
        { label: "CLI AI Agent", value: "Local first", note: "Developers can start with repo memory before hosted sync" },
        { label: "Portal Chat", value: "Model aware", note: "Team-safe chat shows context, provider, and selected model" },
        { label: "Benchmark ROI", value: "Evidence-led", note: "Savings stay scenario-specific until observed evidence repeats" },
      ])}
    `,
  });

  const product = renderSection(
    "How The Product Surfaces Work",
    renderSimpleRows([
      {
        title: "Website",
        body: "Public acquisition surface for positioning, services, security, docs, trials, demos, and domain demo kits.",
        meta: "public",
      },
      {
        title: "Portal",
        body: "Customer workspace for repositories, portal chat, model setup, context previews, benchmarks, usage, billing posture, and team access.",
        meta: "customer",
      },
      {
        title: "Admin",
        body: "Internal control plane for customers, support, revenue posture, billing operations, observability, audit, and platform operations.",
        meta: "internal",
      },
    ]),
  );

  const value = renderTwoColumn(
    renderSection(
      "Why Teams Buy",
      renderSimpleRows([
        { title: "Stable project memory", body: "Code, docs, and decisions stay loadable without reprompting every session." },
        { title: "CLI and MCP workflow", body: "Developers can use local repo memory through the CLI AI agent and MCP runtime." },
        { title: "Safer rollout", body: "Policy-aware context, provider-key posture, and portal controls keep AI workflows governable." },
      ]),
    ),
    renderSection(
      "Primary Calls To Action",
      renderSimpleRows([
        { title: "Try CLI", body: "Install the CLI, run the AI agent, scan one repo, build one pack, and connect MCP." },
        { title: "Open Tolling Kit", body: "Review the Tolling Sales MVP Demo Kit for a demo-safe Account 360 and proposal story." },
        { title: "Book demo", body: "Plan a pilot around your team, workspace, benchmark, and governance requirements." },
      ]),
    ),
  );

  const localStart = renderSection(
    "Local-First Start",
    `<div class="card"><strong>Copyable setup path</strong><pre>heart
heart models add-key --provider openai --api-key-stdin
heart init
heart doctor
heart scan
heart pack "add SSO login audit logging"
heart mcp tools
heart benchmark run --all</pre></div>`,
  );

  const latestServices = renderSection(
    "Latest Product Services",
    renderSimpleRows([
      { title: "CLI AI Agent", body: "Interactive local workbench, model selection, provider key setup, context attachments, and benchmark commands.", meta: "developer" },
      { title: "Portal Chat", body: "Team-safe chat with model selection, context previews, provider posture, citations, and allowed BeHeart actions.", meta: "team" },
      { title: "Domain Packs", body: "Tolling Management and future packs add source-backed vertical memory, overlays, conflicts, and generated artifacts.", meta: "domain" },
      { title: "Enterprise Readiness", body: "Governance, security, admin/founder dashboard, billing readiness, and deployment evaluation stay clearly labeled.", meta: "enterprise" },
    ]),
  );

  const designPartner = renderSection(
    "Design Partner Pilot",
    renderSimpleRows([
      {
        title: "Scope one active repo",
        body: "Pick real tasks that require code, docs, review, and architecture context.",
        meta: "scope",
      },
      {
        title: "Run local proof",
        body: "Use heart doctor, heart scan, heart pack, and heart benchmark run --all before syncing summaries.",
        meta: "local-first",
      },
      {
        title: "Review measured evidence",
        body: "Separate observed, estimated, and mixed benchmark results before discussing ROI.",
        meta: "evidence",
      },
    ]),
  );

  return renderHtmlDocument({
    title: "BeHeart | Public Website",
    eyebrow: "Website",
    nav: [
      { label: "Product", href: "/product" },
      { label: "How it works", href: "/how-it-works" },
      { label: "CLI/MCP", href: "/cli-mcp" },
      { label: "Services", href: "/services" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Docs", href: "/docs" },
      { label: "Portal", href: portalUrl },
    ],
    body: `<div class="stack">${hero}${product}${value}${localStart}${latestServices}${designPartner}</div>`,
    accent: "#0f766e",
  });
}
