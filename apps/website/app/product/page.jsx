import Link from "next/link";
import { WebsiteProductMotionVisual } from "../../components/WebsiteProductMotionVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";
import { listWebsiteServices } from "../../src/services.js";

export const metadata = createWebsiteMetadata({
  title: "Product",
  description:
    "See how BeHeart connects durable repo memory, CLI AI agent workflows, a CLI IDE workbench, portal chat, MCP, domain packs, and benchmark evidence.",
  path: "/product",
  keywords: ["CLI AI agent", "AI coding workbench", "portal chat", "MCP", "domain packs", "benchmark ROI"],
});

const moduleGroups = [
  {
    label: "Developer loop",
    title: "CLI AI agent and CLI IDE workbench",
    body: "Developers can run heart locally, inspect readiness, choose a model, attach repo context, build packs, connect MCP, and benchmark the result.",
  },
  {
    label: "Team loop",
    title: "Web portal, portal chat, and model setup",
    body: "Teams can review synced repo memory, use portal chat with model selection, manage provider/API key posture, and inspect usage and billing readiness.",
  },
  {
    label: "Memory loop",
    title: "Repo graph, context packs, docs/spec sync",
    body: "The context compiler links code, project documents, business requirements, decisions, policies, risks, and citations into compact packs.",
  },
  {
    label: "Domain loop",
    title: "Domain packs and Tolling Management",
    body: "Domain packs add source-backed industry memory, overlays, conflict reporting, benchmark scenarios, and generated demo-safe artifacts.",
  },
  {
    label: "Proof loop",
    title: "Benchmark and ROI evidence",
    body: "Scenario reports separate observed, estimated, and mixed evidence before token savings or cleanup claims are shared.",
  },
  {
    label: "Enterprise loop",
    title: "Governance, billing readiness, deployment path",
    body: "Security boundaries, admin/founder dashboards, payment posture, audit, SSO, retention, and private deployment are handled as rollout gates.",
  },
];

const currentStatus = [
  ["Available for pilots", "Local CLI, interactive workbench, MCP runtime, graph memory, context packs, benchmark framework, portal/admin surfaces, and Tolling pack artifacts."],
  ["In active connection", "Portal chat flows, model selector, provider key settings, generated artifact cards, workbench refinements, and billing posture."],
  ["Enterprise evaluation", "SSO/SAML, advanced retention, shared graph storage, private deployment, and deeper billing automation need customer-specific implementation and review."],
];

export default function ProductPage() {
  const services = listWebsiteServices();

  return (
    <WebsiteShell
      eyebrow="Product"
      title="A context operating layer for AI-assisted software teams."
      description="BeHeart gives AI tools durable project memory, developer workflows, team visibility, domain intelligence, and benchmark evidence without pretending to be another generic coding assistant."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "CLI and MCP", href: "/cli-mcp" },
        { label: "Tolling kit", href: "/domain-demo-kits/tolling-management" },
      ]}
      nav={["home", "product", "services", "how-it-works", "cli-mcp", "benchmark", "pricing", "security", "docs", "book-demo"]}
      accent="teal"
      aside={<WebsiteProductMotionVisual variant="product" />}
    >
      <section className="website-proof-strip" aria-label="Product value">
        <div>
          <span>Memory</span>
          <strong>Repo plus intent</strong>
          <p>Code graph, docs/spec sync, decisions, policies, and domain packs travel together.</p>
        </div>
        <div>
          <span>Workflow</span>
          <strong>CLI plus portal</strong>
          <p>Developers work locally while teams inspect shared artifacts, chat context, and model setup.</p>
        </div>
        <div>
          <span>Evidence</span>
          <strong>Proof gated</strong>
          <p>Benchmark ROI, billing posture, and enterprise claims stay labeled by source and readiness.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="System"
        title="BeHeart connects memory, agents, portal, MCP, and models."
        description="The product is organized as a set of narrow modules that compound into a safer AI coding workflow."
      >
        <div className="website-product-module-grid">
          {moduleGroups.map((module) => (
            <article key={module.title}>
              <span>{module.label}</span>
              <h3>{module.title}</h3>
              <p>{module.body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Service model"
        title="The services map matches the latest product surface."
        description="Each service has a clear adoption job so buyers can evaluate the part they need first."
      >
        <div className="website-service-chip-grid">
          {services.map((service) => (
            <Link key={service.slug} href={`/services/${service.slug}`}>
              <span>{service.category}</span>
              <strong>{service.title}</strong>
              <small>{service.descriptor}</small>
              <em>{service.status}</em>
            </Link>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Tolling domain"
        title="Domain packs turn vertical knowledge into usable demos and delivery context."
        description="Tolling Management is the first pack. It stays careful about source-backed rules, demo data, and customer-specific policy."
      >
        <div className="website-detail-grid">
          <div>
            <h3>Tolling Management Domain Pack</h3>
            <p>Back office, roadside, trip posting, image review, support, security/privacy, UI patterns, and benchmark scenarios.</p>
          </div>
          <div>
            <h3>Tolling Sales MVP Demo Kit</h3>
            <p>Account 360, customer portal preview, architecture story, safe demo data, proposal starter, and ROI hypothesis.</p>
          </div>
          <div>
            <h3>Layered source model</h3>
            <p>Core, regional, agency, and customer overlays stay separate with citations and conflict reporting.</p>
          </div>
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Readiness"
        title="Current, staged, and enterprise work are labeled."
        description="This keeps the website useful for users now and credible for enterprise buyers."
      >
        <div className="website-detail-grid">
          {currentStatus.map(([title, body]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Choose path</p>
          <h2>Try the developer loop or review a design partner demo.</h2>
          <p>
            Start with the CLI for one repo. Use the portal, domain pack, and benchmark paths when the team needs shared proof.
          </p>
        </div>
        <div className="website-cta-grid">
          <Link className="primary" href="/docs/v1/getting-started">
            Try CLI
          </Link>
          <Link href="/book-demo">Book demo</Link>
          <Link href="/domain-demo-kits/tolling-management">Tolling kit</Link>
          <Link href="/docs">Read docs</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
