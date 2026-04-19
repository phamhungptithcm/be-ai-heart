export function renderHtmlDocument({ title, eyebrow = "", body, nav = [], accent = "#0f766e" }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f5f1e8;
        --surface: rgba(255, 252, 245, 0.9);
        --ink: #1d261f;
        --muted: #5b655e;
        --line: rgba(29, 38, 31, 0.12);
        --accent: ${accent};
        --accent-soft: rgba(15, 118, 110, 0.12);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Avenir Next", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.15), transparent 32rem),
          linear-gradient(180deg, #f8f4ec 0%, #efe7da 100%);
      }

      a { color: inherit; text-decoration: none; }

      .shell {
        max-width: 1240px;
        margin: 0 auto;
        padding: 24px;
      }

      .topbar {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      }

      .brand { display: grid; gap: 4px; }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 12px;
        color: var(--accent);
        font-weight: 700;
      }

      h1, h2, h3 { margin: 0; font-family: "Space Grotesk", "Avenir Next Condensed", sans-serif; }
      h1 { font-size: clamp(36px, 5vw, 64px); line-height: 0.95; max-width: 11ch; }
      h2 { font-size: clamp(24px, 3vw, 34px); margin-bottom: 12px; }
      h3 { font-size: 18px; margin-bottom: 8px; }
      p { margin: 0; line-height: 1.6; color: var(--muted); }

      .nav {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .nav a,
      .button {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 10px 16px;
        background: rgba(255,255,255,0.72);
      }

      .button.primary {
        background: var(--accent);
        color: white;
        border-color: transparent;
      }

      .panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 22px;
        box-shadow: 0 18px 50px rgba(29, 38, 31, 0.08);
        backdrop-filter: blur(10px);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
        gap: 20px;
        align-items: stretch;
        margin-bottom: 24px;
      }

      .stack { display: grid; gap: 20px; }

      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
      }

      .metric {
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: white;
      }

      .metric strong {
        display: block;
        font-size: 28px;
        margin-top: 6px;
        color: var(--ink);
      }

      .label {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .two-column {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 20px;
      }

      .grid {
        display: grid;
        gap: 18px;
      }

      .list {
        display: grid;
        gap: 10px;
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 12px 0;
        border-top: 1px solid var(--line);
      }

      .row:first-child { border-top: none; padding-top: 0; }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
      }

      .diagram {
        overflow: auto;
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,242,236,0.92));
      }

      .diagram .mermaid {
        min-width: 320px;
      }

      .code {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "IBM Plex Mono", monospace;
        font-size: 13px;
        line-height: 1.6;
      }

      @media (max-width: 880px) {
        .hero,
        .two-column {
          grid-template-columns: 1fr;
        }
      }
    </style>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
          <div class="nav">
            ${nav.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
          </div>
        </div>
      </header>
      ${body}
    </main>
  </body>
</html>`;
}

export function renderMetricCards(metrics) {
  return `<section class="metrics">
    ${metrics
      .map(
        (metric) => `<article class="metric">
          <div class="label">${escapeHtml(metric.label)}</div>
          <strong>${escapeHtml(String(metric.value))}</strong>
          ${metric.note ? `<p>${escapeHtml(metric.note)}</p>` : ""}
        </article>`,
      )
      .join("")}
  </section>`;
}

export function renderDiagramCards(diagrams) {
  return `<section class="grid">
    ${diagrams
      .map(
        (diagram) => `<article class="panel">
          <div class="stack">
            <div>
              <div class="pill">${escapeHtml(diagram.type)}</div>
              <h3>${escapeHtml(diagram.title)}</h3>
              <p>${escapeHtml(diagram.summary ?? "")}</p>
              <p>${escapeHtml(`Inference: ${diagram.inference_mode ?? "unknown"} · Confidence: ${diagram.confidence ?? "unknown"} · Scope: ${diagram.scope?.focus ?? "unknown"}`)}</p>
            </div>
            <div class="diagram">
              <div class="mermaid">${escapeHtml(diagram.content)}</div>
            </div>
          </div>
        </article>`,
      )
      .join("")}
  </section>`;
}

export function renderSimpleRows(items) {
  return `<div class="list">
    ${items
      .map(
        (item) => `<div class="row">
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          </div>
          ${item.meta ? `<div class="pill">${escapeHtml(item.meta)}</div>` : ""}
        </div>`,
      )
      .join("")}
  </div>`;
}

export function renderHero({ eyebrow, title, description, actions = [], aside = "" }) {
  return `<section class="hero">
    <article class="panel stack">
      ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="nav">
        ${actions
          .map(
            (action) =>
              `<a class="button ${action.primary ? "primary" : ""}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`,
          )
          .join("")}
      </div>
    </article>
    <aside class="panel stack">
      ${aside}
    </aside>
  </section>`;
}

export function renderSection(title, content) {
  return `<section class="panel stack"><div><h2>${escapeHtml(title)}</h2></div>${content}</section>`;
}

export function renderTwoColumn(left, right) {
  return `<section class="two-column">
    <div class="stack">${left}</div>
    <div class="stack">${right}</div>
  </section>`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
