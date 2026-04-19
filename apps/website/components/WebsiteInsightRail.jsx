export function WebsiteInsightRail({
  eyebrow,
  title,
  description,
  metrics = [],
  bars = [],
  notes = [],
}) {
  return (
    <div className="website-insight-rail">
      <div className="website-insight-head">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      {metrics.length > 0 ? (
        <div className="website-insight-metrics">
          {metrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          ))}
        </div>
      ) : null}

      {bars.length > 0 ? (
        <div className="website-insight-bars">
          {bars.map((bar) => {
            const width = Math.max(0, Math.min(100, Number(bar.value ?? 0)));
            return (
              <div key={bar.label} className="website-insight-bar">
                <div className="website-insight-bar-copy">
                  <strong>{bar.label}</strong>
                  <span>{bar.caption}</span>
                </div>
                <b>{bar.value}%</b>
                <div className="website-insight-track" aria-hidden="true">
                  <i style={{ width: `${width}%` }} data-tone={bar.tone ?? "brand"} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="website-insight-notes">
          {notes.map((note) => (
            <article key={note.label}>
              <span>{note.label}</span>
              <p>{note.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
