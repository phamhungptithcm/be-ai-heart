import Link from "next/link";
import { listWebsiteServices } from "../src/services.js";

export function WebsiteServicesVisual({
  activeSlug = "",
  title = "Service map",
  description = "Latest BeHeart services connect project memory, agent workflows, portal visibility, domain packs, proof, and enterprise readiness.",
}) {
  const services = listWebsiteServices();

  return (
    <div className="website-services-visual">
      <div className="website-services-visual-head">
        <span>Services</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <div className="website-services-visual-grid">
        {services.map((service) => (
          <Link
            key={service.slug}
            href={`/services/${service.slug}`}
            className="website-services-visual-card"
            data-active={service.slug === activeSlug}
            aria-current={service.slug === activeSlug ? "page" : undefined}
          >
            <div className="website-services-visual-card-top">
              <strong>{service.title}</strong>
              <span className="website-services-visual-tag">
                {service.slug === activeSlug ? "Current" : service.trustTag}
              </span>
            </div>
            <p className="website-services-visual-descriptor">{service.descriptor}</p>
            <div className="website-services-visual-card-meta">
              <small>{service.category}</small>
              <small>{service.status}</small>
            </div>
            <span className="website-services-visual-card-link" aria-hidden="true">
              Open service
            </span>
          </Link>
        ))}
      </div>

      <div className="website-services-visual-foot">
        <Link href="/services">Browse all services</Link>
      </div>
    </div>
  );
}
