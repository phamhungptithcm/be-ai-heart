import {
  renderHero,
  renderHtmlDocument,
  renderMetricCards,
  renderSection,
  renderSimpleRows,
  renderTwoColumn,
} from "../../../packages/web-render/src/index.js";

export const siteManifest = {
  name: "be-ai-heart website",
  audience: "public",
  primary_message: "Stop paying AI to relearn your codebase.",
  sections: [
    "home",
    "services",
    "product",
    "benchmark",
    "pricing",
    "security",
    "docs",
    "customers",
    "sign-in",
    "start-trial",
    "book-demo",
  ],
};

export function renderWebsiteHomePage(options = {}) {
  const portalUrl = options.portalUrl ?? "/portal";
  const signInUrl = options.signInUrl ?? "/sign-in";
  const trialUrl = options.trialUrl ?? "/start-trial";
  const demoUrl = options.demoUrl ?? "/book-demo";

  const hero = renderHero({
    eyebrow: "Public Website",
    title: "Project memory for teams that want AI speed without AI waste.",
    description:
      "be-ai-heart helps individuals and organizations onboard AI into real software delivery by keeping repo context, project documents, diagrams, and policy signals durable across sessions.",
    actions: [
      { label: "Start Trial", href: trialUrl, primary: true },
      { label: "Sign In", href: signInUrl },
      { label: "Book Demo", href: demoUrl },
      { label: "Open Portal", href: portalUrl },
    ],
    aside: `
      ${renderMetricCards([
        { label: "Token Goal", value: "30%+", note: "Lower prompt waste on repeated workflows" },
        { label: "Patch Speed", value: "20%+", note: "Faster time to acceptable change" },
        { label: "Duplicate Cut", value: "40%+", note: "Less duplicated implementation work" },
      ])}
    `,
  });

  const product = renderSection(
    "How The Product Surfaces Work",
    renderSimpleRows([
      {
        title: "Website",
        body: "Public acquisition surface for positioning, pricing, security, docs, sign-in, and self-serve trial flow.",
        meta: "public",
      },
      {
        title: "Portal",
        body: "Customer workspace where repositories, synced diagrams, benchmarks, usage, and billing are viewed after signup or purchase.",
        meta: "customer",
      },
      {
        title: "Admin",
        body: "Internal control plane for the be-ai-heart owner to manage customers, support, revenue, licenses, and platform operations.",
        meta: "internal",
      },
    ]),
  );

  const value = renderTwoColumn(
    renderSection(
      "Why Teams Buy",
      renderSimpleRows([
        { title: "Stable project memory", body: "Code, docs, and decisions stay loadable without reprompting every session." },
        { title: "Cheaper AI delivery", body: "The system reduces wasted exploration and improves reuse visibility." },
        { title: "Safer rollout", body: "Policy-aware context keeps agents closer to architecture intent." },
      ]),
    ),
    renderSection(
      "Primary Calls To Action",
      renderSimpleRows([
        { title: "Start free locally", body: "Install the CLI and run a benchmark on one repository." },
        { title: "Upgrade to portal access", body: "Sync repositories and view diagrams, profiles, and benchmark history on the web." },
        { title: "Request enterprise support", body: "Book a pilot and involve your team, workspace, and governance requirements." },
      ]),
    ),
  );

  return renderHtmlDocument({
    title: "be-ai-heart | Public Website",
    eyebrow: "Website",
    nav: [
      { label: "Services", href: "/services" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Docs", href: "/docs" },
      { label: "Portal", href: portalUrl },
    ],
    body: `<div class="stack">${hero}${product}${value}</div>`,
    accent: "#0f766e",
  });
}
