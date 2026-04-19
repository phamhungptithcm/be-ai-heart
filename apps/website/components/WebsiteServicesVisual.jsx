import Link from "next/link";
import { listWebsiteServices } from "../src/services.js";

export function WebsiteServicesVisual({ activeSlug = "", title = "Service map", description = "Six concrete services turn project memory into a usable AI operating layer." }) {
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
          >
            <small>{service.category}</small>
            <strong>{service.title}</strong>
            <p>{service.subtitle}</p>
          </Link>
        ))}
      </div>

      <div className="website-services-visual-foot">
        <Link href="/services">Browse all services</Link>
      </div>
    </div>
  );
}
