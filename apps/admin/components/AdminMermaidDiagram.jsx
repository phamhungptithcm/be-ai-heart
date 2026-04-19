"use client";

import { useEffect, useId } from "react";

export function AdminMermaidDiagram({ chart }) {
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
      mermaid.run({ nodes: [document.getElementById("${id}")] });
    `;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [chart, id]);

  return (
    <div className="admin-diagram-frame">
      <div id={id} className="mermaid">
        {chart}
      </div>
    </div>
  );
}
