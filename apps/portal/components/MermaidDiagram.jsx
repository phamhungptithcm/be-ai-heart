"use client";

import { useEffect, useId } from "react";

export function MermaidDiagram({ chart }) {
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    const target = document.getElementById(id);
    let cleanupDrag = () => {};

    function handleReady() {
      cleanupDrag();
      cleanupDrag = enableMermaidNodeDrag(target);
    }

    target?.addEventListener("beheart:mermaid-ready", handleReady);
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      const target = document.getElementById("${id}");
      if (target) {
        target.removeAttribute("data-processed");
        target.textContent = ${JSON.stringify(chart)};
        await mermaid.run({ nodes: [target] });
        target.dispatchEvent(new CustomEvent("beheart:mermaid-ready", { bubbles: true }));
      }
    `;
    document.body.appendChild(script);

    return () => {
      target?.removeEventListener("beheart:mermaid-ready", handleReady);
      cleanupDrag();
      script.remove();
    };
  }, [chart, id]);

  return (
    <div className="portal-diagram-frame">
      <div id={id} className="mermaid">
        {chart}
      </div>
    </div>
  );
}

function enableMermaidNodeDrag(target) {
  const svg = target?.querySelector("svg");
  if (!svg) {
    return () => {};
  }

  const nodeGroups = Array.from(svg.querySelectorAll("g")).filter(
    (group) =>
      group.classList.contains("node") &&
      !group.classList.contains("edgePath") &&
      !group.classList.contains("edgeLabel"),
  );
  const cleanups = [];

  for (const group of nodeGroups) {
    let dragState = null;
    let offset = { x: 0, y: 0 };
    group.setAttribute("data-mermaid-node", "true");
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", `Move diagram node ${group.textContent?.trim() || "node"}`);
    group.style.cursor = "grab";
    group.style.transformBox = "fill-box";
    group.style.transformOrigin = "center";

    const applyOffset = () => {
      group.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
    };
    const handlePointerDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      group.setPointerCapture?.(event.pointerId);
      group.classList.add("is-dragging");
      group.style.cursor = "grabbing";
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    };
    const handlePointerMove = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      offset = {
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      };
      applyOffset();
    };
    const finishDrag = (event) => {
      if (dragState?.pointerId === event.pointerId) {
        group.releasePointerCapture?.(event.pointerId);
      }
      dragState = null;
      group.classList.remove("is-dragging");
      group.style.cursor = "grab";
    };
    const handleKeyDown = (event) => {
      const deltas = {
        ArrowUp: { x: 0, y: -12 },
        ArrowDown: { x: 0, y: 12 },
        ArrowLeft: { x: -12, y: 0 },
        ArrowRight: { x: 12, y: 0 },
      };
      const delta = deltas[event.key];
      if (!delta) {
        return;
      }

      event.preventDefault();
      offset = { x: offset.x + delta.x, y: offset.y + delta.y };
      applyOffset();
    };

    group.addEventListener("pointerdown", handlePointerDown);
    group.addEventListener("pointermove", handlePointerMove);
    group.addEventListener("pointerup", finishDrag);
    group.addEventListener("pointercancel", finishDrag);
    group.addEventListener("pointerleave", finishDrag);
    group.addEventListener("lostpointercapture", finishDrag);
    group.addEventListener("keydown", handleKeyDown);

    cleanups.push(() => {
      group.removeEventListener("pointerdown", handlePointerDown);
      group.removeEventListener("pointermove", handlePointerMove);
      group.removeEventListener("pointerup", finishDrag);
      group.removeEventListener("pointercancel", finishDrag);
      group.removeEventListener("pointerleave", finishDrag);
      group.removeEventListener("lostpointercapture", finishDrag);
      group.removeEventListener("keydown", handleKeyDown);
    });
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
