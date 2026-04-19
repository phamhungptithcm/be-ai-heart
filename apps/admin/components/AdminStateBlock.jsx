import Link from "next/link";

export function AdminStateBlock({ tone = "neutral", eyebrow, title, description, actions = [] }) {
  return (
    <div className={`admin-state-block admin-state-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {eyebrow ? <p className="admin-state-eyebrow">{eyebrow}</p> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {actions.length ? (
        <div className="admin-state-actions">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={`admin-button-link ${action.primary ? "admin-button-link-primary" : ""}`}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
