import Link from "next/link";

export function PortalStateBlock({ tone = "neutral", eyebrow, title, description, actions = [] }) {
  return (
    <div className={`portal-state-block portal-state-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {eyebrow ? <p className="portal-state-eyebrow">{eyebrow}</p> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actions.length ? (
        <div className="portal-state-actions">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={`portal-button-link ${action.primary ? "portal-button-link-primary" : ""}`}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
