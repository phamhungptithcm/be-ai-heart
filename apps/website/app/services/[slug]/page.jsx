import Link from "next/link";
import { notFound } from "next/navigation";
import { WebsiteInsightRail } from "../../../components/WebsiteInsightRail.jsx";
import { WebsiteServicesVisual } from "../../../components/WebsiteServicesVisual.jsx";
import { WebsiteShell, WebsiteSection } from "../../../components/WebsiteShell.jsx";
import { createWebsiteMetadata } from "../../../src/metadata.js";
import { getWebsiteServiceBySlug, listWebsiteServices } from "../../../src/services.js";

export async function generateStaticParams() {
  return listWebsiteServices().map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const service = getWebsiteServiceBySlug(resolvedParams?.slug);

  if (!service) {
    return createWebsiteMetadata({
      title: "Service",
      description: "BeHeart service detail page.",
      path: "/services",
    });
  }

  return createWebsiteMetadata({
    title: service.title,
    description: `${service.subtitle}. ${service.summary}`,
    path: `/services/${service.slug}`,
    keywords: [service.title, service.subtitle, "BeHeart services"],
  });
}

export default async function ServiceDetailPage({ params }) {
  const resolvedParams = await params;
  const service = getWebsiteServiceBySlug(resolvedParams?.slug);

  if (!service) {
    notFound();
  }

  return (
    <WebsiteShell
      eyebrow={service.hero_eyebrow}
      title={service.hero_title}
      description={service.hero_description}
      actions={[
        { label: "Start Trial", href: "/start-trial", primary: true },
        { label: "All Services", href: "/services" },
        { label: "Run Benchmark", href: "/benchmark" },
      ]}
      nav={["home", "services", "benchmark", "pricing", "docs", "customers", "sign-in", "start-trial", "book-demo"]}
      accent="teal"
      aside={
        <WebsiteServicesVisual
          activeSlug={service.slug}
          title={service.title}
          description={service.subtitle}
        />
      }
    >
      <section className="website-proof-strip" aria-label={`${service.title} proof`}>
        {service.proof.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
          </div>
        ))}
      </section>

      <WebsiteSection
        eyebrow="What it does"
        title={`${service.title} turns one painful AI failure mode into a readable operating capability.`}
        description={service.summary}
      >
        <div className="website-detail-grid">
          {service.capabilities.map((capability) => (
            <div key={capability.title}>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </div>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Operating path"
        title={`How teams use ${service.title} in practice.`}
        description="The strongest service pages should read like a workflow, not a list of abstract benefits."
      >
        <div className="website-signal-lane">
          {service.workflow.map((step) => (
            <article key={step.step}>
              <span>{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Buyer and team impact"
        title="Why this service changes rollout quality."
        description="Engineering value and buyer readability should both improve when the service is doing its job."
      >
        <div className="website-split-grid">
          {service.outcomes.map((outcome) => (
            <article key={outcome.title}>
              <span>{service.category}</span>
              <h3>{outcome.title}</h3>
              <p>{outcome.body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Service lens"
        title={`How ${service.title} reads to operators, buyers, and reviewers.`}
        description="The service should feel concrete enough for engineers and clear enough for the buyer conversation."
      >
        <WebsiteInsightRail
          eyebrow={service.category}
          title={`${service.title} at a glance`}
          description={service.subtitle}
          metrics={service.metrics}
          bars={service.bars}
          notes={service.notes}
        />
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>See how this service fits into the full BeHeart operating layer.</h2>
          <p>
            The service pages are intentionally narrow. The value compounds when code, docs, policy, delivery surfaces,
            and benchmark proof reinforce each other.
          </p>
        </div>
        <div className="website-actions">
          <Link className="primary" href="/services">
            All Services
          </Link>
          <Link href="/book-demo">Book Demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
