import Link from "next/link";
import { WebsiteServicesVisual } from "../../components/WebsiteServicesVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";
import { listWebsiteServices } from "../../src/services.js";

export const metadata = createWebsiteMetadata({
  title: "Services",
  description:
    "Explore the BeHeart service map for durable project memory, CLI AI agent workflows, portal chat, MCP runtime, domain packs, benchmark proof, and enterprise readiness.",
  path: "/services",
  keywords: ["services", "CLI AI agent", "portal chat", "MCP runtime", "domain packs", "benchmark ROI"],
});

export default function ServicesPage() {
  const services = listWebsiteServices();
  const servicesBySlug = new Map(services.map((service) => [service.slug, service]));
  const serviceLanes = [
    {
      title: "Developer adoption",
      body: "Start with local repo memory, agent chat, workbench flow, and MCP integration.",
      slugs: ["durable-project-memory", "cli-ai-agent", "coding-workbench", "mcp-runtime"],
    },
    {
      title: "Team operation",
      body: "Move into portal chat, context packs, docs/spec sync, usage posture, and benchmark proof.",
      slugs: ["web-portal-chat", "repo-graph-context-packs", "docs-spec-sync", "benchmark-roi"],
    },
    {
      title: "Domain and enterprise",
      body: "Use source-backed packs, tolling demo assets, security governance, billing readiness, and deployment evaluation.",
      slugs: ["domain-packs", "tolling-demo-kit", "governance-enterprise-readiness"],
    },
  ];

  return (
    <WebsiteShell
      eyebrow="Services"
      title="Services for teams adopting AI with memory, control, and proof."
      description="BeHeart packages durable repo memory into developer tools, team portal workflows, domain packs, benchmark evidence, and enterprise-ready operating paths."
      actions={[
        { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
        { label: "Tolling kit", href: "/domain-demo-kits/tolling-management" },
        { label: "Book demo", href: "/book-demo" },
      ]}
      nav={["home", "product", "services", "cli-mcp", "benchmark", "pricing", "security", "docs", "sign-in", "book-demo"]}
      accent="teal"
      aside={
        <WebsiteServicesVisual
          title="Service map"
          description="Latest services cover local AI workflows, team portal visibility, domain packs, proof, and enterprise evaluation."
        />
      }
    >
      <section className="website-proof-strip" aria-label="Service-level proof">
        <div>
          <span>Developers</span>
          <strong>Local AI workflow</strong>
          <p>CLI agent, CLI IDE workbench, MCP tools, and repo memory start in one repository.</p>
        </div>
        <div>
          <span>Teams</span>
          <strong>Portal visibility</strong>
          <p>Portal chat, model selection, context previews, docs/spec sync, usage, and access stay inspectable.</p>
        </div>
        <div>
          <span>Buyers</span>
          <strong>Proof and readiness</strong>
          <p>Benchmark ROI, governance, billing posture, and deployment path are clearly labeled.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Service map"
        title="Choose the service by the job the user needs done."
        description="Each service points to one adoption question: developer value, team workflow, domain proof, or enterprise readiness."
      >
        <div className="website-service-map">
          {services.map((service) => (
            <Link key={service.slug} href={`/services/${service.slug}`} className="website-service-row">
              <div>
                <span>{service.category}</span>
                <h3>{service.title}</h3>
                <p>{service.descriptor}</p>
                <small className="website-service-status">{service.status}</small>
              </div>
              <ul>
                {service.capabilities.slice(0, 2).map((capability) => (
                  <li key={capability.title}>{capability.title}</li>
                ))}
              </ul>
              <strong>Open</strong>
            </Link>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Adoption lanes"
        title="Start narrow, then connect the operating layer."
        description="The recommended path is developer adoption first, team visibility second, domain or enterprise expansion third."
      >
        <div className="website-service-lanes">
          {serviceLanes.map((lane) => (
            <article key={lane.title}>
              <span>{lane.title}</span>
              <p>{lane.body}</p>
              <ul>
                {lane.slugs.map((slug) => {
                  const service = servicesBySlug.get(slug);
                  return service ? <li key={slug}>{service.title}</li> : null;
                })}
              </ul>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Start with one repo and one service lane.</h2>
          <p>Use the CLI to prove memory quality, then move into portal chat, domain packs, and benchmark evidence when needed.</p>
        </div>
        <div className="website-cta-grid">
          <Link className="primary" href="/docs/v1/getting-started">
            Try CLI
          </Link>
          <Link href="/domain-demo-kits/tolling-management">Tolling kit</Link>
          <Link href="/book-demo">Book demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
