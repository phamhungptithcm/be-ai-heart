import Link from "next/link";
import { notFound } from "next/navigation";
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

  const actions =
    service.slug === "tolling-demo-kit"
      ? [
          { label: "Tolling kit", href: "/domain-demo-kits/tolling-management", primary: true },
          { label: "All Services", href: "/services" },
          { label: "Book demo", href: "/book-demo" },
        ]
      : [
          { label: "Try CLI", href: "/docs/v1/getting-started", primary: true },
          { label: "All Services", href: "/services" },
          { label: "Book demo", href: "/book-demo" },
        ];

  return (
    <WebsiteShell
      eyebrow={service.hero_eyebrow}
      title={service.hero_title}
      description={service.hero_description}
      actions={actions}
      nav={["home", "product", "services", "cli-mcp", "benchmark", "pricing", "security", "docs", "sign-in", "book-demo"]}
      accent="teal"
      aside={<WebsiteServicesVisual activeSlug={service.slug} title={service.title} description={service.subtitle} />}
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
        eyebrow="Outputs"
        title={`What teams get from ${service.title}.`}
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
        eyebrow="Workflow"
        title="How it fits into daily delivery."
        description="Start from the repo, then sync safe summaries and evidence when the team needs visibility."
      >
        <div className="website-signal-lane">
          {service.workflow.slice(0, 3).map((step) => (
            <article key={step.step}>
              <span>{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <WebsiteSection
        eyebrow="Enterprise fit"
        title="Why this belongs in the rollout."
        description="Use this lens for buyer conversations, design partner pilots, and internal prioritization."
      >
        <div className="website-split-grid">
          {service.metrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <h3>{metric.value}</h3>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
      </WebsiteSection>

      <section className="website-cta-band">
        <div>
          <p className="website-section-eyebrow">Next step</p>
          <h2>Fit this service into one repo pilot.</h2>
          <p>Start with local artifacts, then sync only the summaries, context previews, and evidence the team can trust.</p>
        </div>
        <div className="website-cta-grid">
          <Link className="primary" href="/docs/v1/getting-started">
            Try CLI
          </Link>
          {service.slug === "tolling-demo-kit" ? (
            <Link href="/domain-demo-kits/tolling-management">Tolling kit</Link>
          ) : null}
          <Link href="/services">All Services</Link>
          <Link href="/book-demo">Book demo</Link>
        </div>
      </section>
    </WebsiteShell>
  );
}
