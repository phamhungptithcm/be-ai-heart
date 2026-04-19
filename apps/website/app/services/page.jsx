import Link from "next/link";
import { WebsiteServicesVisual } from "../../components/WebsiteServicesVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../src/metadata.js";
import { listWebsiteServices } from "../../src/services.js";

export const metadata = createWebsiteMetadata({
  title: "Services",
  description: "Explore the six concrete services BeHeart provides for project memory, governed AI delivery, customer operations, and benchmark-backed ROI.",
  path: "/services",
  keywords: ["services", "code graph", "document memory", "policy rails", "benchmark ROI"],
});

export default function ServicesPage() {
  const services = listWebsiteServices();

  return (
    <WebsiteShell
      eyebrow="Services"
      title="Six concrete services. One operating layer for AI delivery."
      description="BeHeart is easier to understand when the offering is broken into distinct services: memory, governance, runtime delivery, web surfaces, and ROI proof."
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "Run Benchmark", href: "/benchmark" },
        { label: "Book Demo", href: "/book-demo" },
      ]}
      nav={["home", "services", "benchmark", "pricing", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={
        <WebsiteServicesVisual
          title="How the operating layer is packaged"
          description="Each service solves a different buyer or engineering job, but they compound best when used together."
        />
      }
    >
      <section className="website-proof-strip" aria-label="Service-level proof">
        <div>
          <span>Memory layer</span>
          <strong>Code + docs + policy</strong>
          <p>Project memory is more useful when structure, intent, and boundaries are retrievable together.</p>
        </div>
        <div>
          <span>Delivery layer</span>
          <strong>CLI + MCP + surfaces</strong>
          <p>BeHeart reaches daily workflows locally first, then publishes web-readable artifacts for customers and operators.</p>
        </div>
        <div>
          <span>Proof layer</span>
          <strong>Benchmark-backed ROI</strong>
          <p>Savings claims are easier to defend when token, cleanup, and trust proof come from repeatable scenarios.</p>
        </div>
      </section>

      <WebsiteSection
        eyebrow="Service catalog"
        title="Every service has a tight job, clear output, and visible business value."
        description="These are not vague feature buckets. Each page should explain what the service does, how teams use it, and why it changes rollout economics."
      >
        <div className="website-services-card-grid">
          {services.map((service) => (
            <article key={service.slug} className="website-service-card">
              <div className="website-service-card-head">
                <span>{service.category}</span>
                <h3>{service.title}</h3>
                <p className="website-service-card-subtitle">{service.subtitle}</p>
                <p>{service.summary}</p>
              </div>
              <ul className="website-service-card-list">
                {service.capabilities.map((capability) => (
                  <li key={capability.title}>{capability.title}</li>
                ))}
              </ul>
              <div className="website-service-card-foot">
                <Link href={`/services/${service.slug}`}>Open service page</Link>
              </div>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Operating path"
        title="The services fit together in three layers."
        description="BeHeart becomes easier to buy and easier to adopt when the story moves from memory, to delivery, to measurable proof."
      >
        <div className="website-split-grid">
          <article>
            <span>Layer 01</span>
            <h3>Build durable memory</h3>
            <p>Code Graph, Document Memory, and Policy Rails create the project understanding and architectural guidance that AI usually lacks.</p>
          </article>
          <article>
            <span>Layer 02</span>
            <h3>Deliver it where work happens</h3>
            <p>CLI + MCP Runtime and Portal + Admin Surfaces move that memory into daily engineering, customer operations, and internal control workflows.</p>
          </article>
          <article>
            <span>Layer 03</span>
            <h3>Prove the economics</h3>
            <p>Benchmark ROI translates cleaner context and governed workflows into token, cleanup, and trust proof that a buyer can act on.</p>
          </article>
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Start with the service that fixes today’s biggest source of AI waste.</h2>
          <p>
            Some teams start with code graph and document memory, others start with benchmark proof. The point is to make
            rollout easier to understand than the waste it removes.
          </p>
        </div>
        <div className="website-actions">
          <Link className="primary" href="/start-trial">
            Start Trial
          </Link>
          <Link href="/book-demo">Book Demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
