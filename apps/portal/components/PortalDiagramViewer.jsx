"use client";

import { useEffect, useMemo, useState } from "react";

import { MermaidDiagram } from "./MermaidDiagram.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const MIN_DIAGRAM_ZOOM = 0.55;
const MAX_DIAGRAM_ZOOM = 2.2;

export function PortalDiagramViewer({ diagrams = [], emptyActionHref = "" }) {
  const normalizedDiagrams = useMemo(
    () => normalizeDiagrams(diagrams),
    [diagrams],
  );
  const [activeId, setActiveId] = useState("");
  const [diagramZoom, setDiagramZoom] = useState(1);
  const [diagramPan, setDiagramPan] = useState({ x: 0, y: 0 });
  const [diagramDrag, setDiagramDrag] = useState(null);

  useEffect(() => {
    const preferredDiagram =
      normalizedDiagrams.find((diagram) => diagram.type === "high level") ??
      normalizedDiagrams.find((diagram) => diagram.type === "sequence") ??
      normalizedDiagrams[0];
    setActiveId((current) =>
      normalizedDiagrams.some((diagram) => diagram.id === current)
        ? current
        : preferredDiagram?.id ?? "",
    );
  }, [normalizedDiagrams]);

  useEffect(() => {
    setDiagramZoom(1);
    setDiagramPan({ x: 0, y: 0 });
    setDiagramDrag(null);
  }, [activeId]);

  if (normalizedDiagrams.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Diagrams"
        title="No synced diagrams yet"
        description="Generate diagrams locally, then sync the repo profile."
        actions={emptyActionHref ? [{ href: emptyActionHref, label: "Open sync status", primary: true }] : []}
      />
    );
  }

  const activeDiagram =
    normalizedDiagrams.find((diagram) => diagram.id === activeId) ??
    normalizedDiagrams[0];

  function handleDiagramPointerDown(event) {
    if (event.target.closest("button, a, input, select, textarea, [data-mermaid-node='true']")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDiagramDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: diagramPan.x,
      originY: diagramPan.y,
    });
  }

  function handleDiagramPointerMove(event) {
    if (!diagramDrag || diagramDrag.pointerId !== event.pointerId) {
      return;
    }

    setDiagramPan({
      x: diagramDrag.originX + event.clientX - diagramDrag.startX,
      y: diagramDrag.originY + event.clientY - diagramDrag.startY,
    });
  }

  function handleDiagramPointerUp(event) {
    if (diagramDrag?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setDiagramDrag(null);
    }
  }

  function handleDiagramWheel(event) {
    event.preventDefault();
    const nextZoom = clamp(
      diagramZoom + (event.deltaY < 0 ? 0.1 : -0.1),
      MIN_DIAGRAM_ZOOM,
      MAX_DIAGRAM_ZOOM,
    );
    setDiagramZoom(round(nextZoom, 2));
  }

  function resetDiagramView() {
    setDiagramZoom(1);
    setDiagramPan({ x: 0, y: 0 });
  }

  return (
    <div className="portal-live-diagram">
      <section className="portal-live-diagram-stage">
        <header className="portal-live-diagram-head">
          <div>
            <span>{activeDiagram.type}</span>
            <h3>{activeDiagram.title}</h3>
            {activeDiagram.summary ? <p>{activeDiagram.summary}</p> : null}
          </div>
          <div className="portal-live-diagram-badges" aria-label="Diagram trust labels">
            <span>{activeDiagram.inferenceMode}</span>
            <span>{activeDiagram.confidence}</span>
            <span>{activeDiagram.trust}</span>
          </div>
        </header>

        <div className="portal-diagram-toolbar" aria-label="Diagram controls">
          <span>Drag canvas or Mermaid nodes</span>
          <div className="portal-diagram-zoom-group">
            <button type="button" onClick={() => setDiagramZoom((value) => round(clamp(value - 0.1, MIN_DIAGRAM_ZOOM, MAX_DIAGRAM_ZOOM), 2))}>−</button>
            <button type="button" onClick={resetDiagramView}>Reset</button>
            <button type="button" onClick={() => setDiagramZoom((value) => round(clamp(value + 0.1, MIN_DIAGRAM_ZOOM, MAX_DIAGRAM_ZOOM), 2))}>+</button>
          </div>
        </div>

        {activeDiagram.chart ? (
          <div
            className="portal-diagram-pan-stage"
            data-dragging={diagramDrag ? "true" : "false"}
            onWheel={handleDiagramWheel}
            onPointerDown={handleDiagramPointerDown}
            onPointerMove={handleDiagramPointerMove}
            onPointerUp={handleDiagramPointerUp}
            onPointerCancel={handleDiagramPointerUp}
            onPointerLeave={handleDiagramPointerUp}
          >
            <div
              className="portal-diagram-transform"
              style={{
                transform: `translate(${diagramPan.x}px, ${diagramPan.y}px) scale(${diagramZoom})`,
              }}
            >
              <MermaidDiagram chart={activeDiagram.chart} />
            </div>
          </div>
        ) : (
          <PortalStateBlock
            tone="neutral"
            eyebrow="Diagram"
            title="This diagram has no Mermaid source"
            description="Sync a generated Mermaid artifact to render it here."
          />
        )}

        <div className="portal-live-diagram-sources">
          {(activeDiagram.sources.length > 0
            ? activeDiagram.sources
            : ["No source citation published"]
          ).map((source) => (
            <code key={source}>{source}</code>
          ))}
        </div>
      </section>

      <aside className="portal-live-diagram-list" aria-label="Generated diagrams">
        {normalizedDiagrams.map((diagram) => (
          <button
            key={diagram.id}
            type="button"
            className={diagram.id === activeDiagram.id ? "is-active" : ""}
            onClick={() => setActiveId(diagram.id)}
          >
            <span>{diagram.type}</span>
            <strong>{diagram.title}</strong>
            <small>{diagram.confidence}</small>
          </button>
        ))}
      </aside>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeDiagrams(diagrams) {
  return (Array.isArray(diagrams) ? diagrams : [])
    .filter((diagram) => diagram && typeof diagram === "object")
    .map((diagram, index) => {
      const id = String(diagram.id ?? diagram.type ?? diagram.title ?? `diagram-${index}`);
      return {
        id,
        title: String(diagram.title ?? diagram.type ?? "Generated diagram"),
        type: String(diagram.type ?? "diagram").replace(/[_-]+/g, " "),
        summary: String(diagram.summary ?? diagram.description ?? ""),
        chart: String(diagram.mermaid ?? diagram.content ?? ""),
        inferenceMode: String(diagram.inference_mode ?? diagram.inferenceMode ?? "generated"),
        confidence: String(diagram.confidence_label ?? diagram.confidence ?? "confidence unknown"),
        trust: String(diagram.trust_label ?? diagram.trust?.label ?? diagram.state ?? "generated"),
        sources: normalizeSources(diagram.source_files ?? diagram.sources ?? diagram.citations),
      };
    });
}

function normalizeSources(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      return entry?.path ?? entry?.ref ?? entry?.label ?? "";
    })
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 8);
}
