"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchPortalJson, postPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const OUTPUT_LABELS = Object.freeze({
  "domain-pack": "Domain Pack",
  "sales-demo-kit": "Sales Demo Kit",
  website: "Website/Microsite",
  "ui-prototype": "UI Prototype Spec",
  proposal: "Proposal/RFP Starter",
  benchmarks: "Benchmark Scenarios",
  "context-pack": "AI Context Pack",
});

export function DomainPacksBrowserClient() {
  const state = usePortalResource("/api/domain-packs");

  if (state.status !== "ready") {
    return <ResourceState state={state} noun="domain packs" />;
  }

  const packs = state.payload.packs ?? [];
  if (packs.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Domain Packs"
        title="No domain packs are available"
        description="Pack registry is empty. Add a pack under packs/ and rerun the API."
      />
    );
  }

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-inline-banner">
        <strong>Domain Packs</strong>
        <p>Browse source-backed domain memory, overlays, artifacts, and benchmark scenarios.</p>
      </div>
      <div className="portal-repository-services-grid">
        {packs.map((pack) => (
          <DomainPackCard key={pack.pack_id} pack={pack} />
        ))}
      </div>
    </div>
  );
}

export function DomainPackCard({ pack }) {
  return (
    <Link href={`/domain-packs/${pack.pack_id}`} className="portal-service-card">
      <div className="portal-service-card-head">
        <div>
          <span>{pack.category}</span>
          <strong>{pack.name}</strong>
          <p>{pack.description}</p>
        </div>
        <i data-state={pack.status === "draft" ? "warning" : "ready"}>{pack.status}</i>
      </div>
      <div className="portal-service-card-metrics">
        <div><span>Layers</span><strong>{pack.layers_available?.length ?? 0}</strong></div>
        <div><span>Outputs</span><strong>{pack.artifacts_available?.length ?? 0}</strong></div>
        <div><span>Benchmarks</span><strong>{pack.benchmark_scenario_count ?? 0}</strong></div>
      </div>
      <code>heart packs show {pack.pack_id}</code>
    </Link>
  );
}

export function DomainPackDetailClient({ packId }) {
  const detail = usePortalResource(`/api/domain-packs/${packId}`);
  const artifacts = usePortalResource(`/api/domain-packs/${packId}/artifacts`);
  const [builder, setBuilder] = useState({
    output: "sales-demo-kit",
    regional_layer: "texas",
    agency_overlay: "hctra-example",
    customer_requirements: "",
  });
  const [conflicts, setConflicts] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const pack = detail.payload;
  const artifactItems = artifacts.payload?.artifacts ?? [];

  async function reviewConflicts() {
    setStatus("checking");
    setError("");
    try {
      const payload = await postPortalJson(`/api/domain-packs/${packId}/conflicts`, builder);
      setConflicts(payload);
      setStatus("ready");
    } catch (reviewError) {
      setStatus("error");
      setError(reviewError.message);
    }
  }

  async function generateArtifact() {
    setStatus("generating");
    setError("");
    try {
      const payload = await postPortalJson(`/api/domain-packs/${packId}/generate`, builder);
      setResult(payload);
      setStatus("ready");
      artifacts.reload?.();
    } catch (generateError) {
      setStatus("error");
      setError(generateError.message);
    }
  }

  if (detail.status !== "ready") {
    return <ResourceState state={detail} noun="domain pack" />;
  }

  return (
    <div className="portal-enterprise-stack">
      <DomainPackDetail pack={pack} />
      <SecurityWarningPanel warnings={pack.security_warnings ?? []} />

      <div className="portal-command-grid">
        <section className="portal-command-panel">
          <header className="portal-command-head">
            <div>
              <span>Builder</span>
              <h4>Generate source-backed artifact</h4>
              <p>Generated outputs are MVP/demo artifacts until customer-approved docs replace assumptions.</p>
            </div>
          </header>
          <PackBuildOptions pack={pack} builder={builder} setBuilder={setBuilder} />
          <div className="portal-command-actions">
            <button type="button" className="portal-button-link" onClick={reviewConflicts} disabled={status === "checking"}>
              {status === "checking" ? "Checking..." : "Review conflicts"}
            </button>
            <button type="button" className="portal-button-link portal-button-link-primary" onClick={generateArtifact} disabled={status === "generating"}>
              {status === "generating" ? "Generating..." : "Generate"}
            </button>
          </div>
          {error ? <p className="portal-form-note">{error}</p> : null}
        </section>

        <section className="portal-command-panel">
          <PackChatBox packId={packId} output={builder.output} />
        </section>
      </div>

      <PackBuildProgress status={status} />
      {conflicts ? <PackConflictPanel conflicts={conflicts.conflicts ?? []} status={conflicts.status} /> : null}
      {result ? <PackBuildResult result={result} /> : null}

      <div className="portal-command-grid">
        <section className="portal-enterprise-panel">
          <PackArtifactList packId={packId} artifacts={artifactItems} />
        </section>
        <section className="portal-enterprise-panel">
          <PackArtifactViewer packId={packId} artifacts={artifactItems} latestArtifactId={result?.artifact_id} />
        </section>
      </div>

      <div className="portal-command-grid">
        <PackSourceNotesPanel sourceNotes={pack.source_notes ?? []} />
        <PackBenchmarkList scenarios={pack.benchmark_scenarios ?? []} />
      </div>
    </div>
  );
}

export function DomainPackDetail({ pack }) {
  const useCases = pack.primary_use_cases ?? [];
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>{pack.category}</span>
          <h3>{pack.name}</h3>
          <p>{pack.description}</p>
        </div>
        <StatusBadge tone={pack.status === "draft" ? "neutral" : "positive"}>{pack.status}</StatusBadge>
      </div>
      <div className="portal-service-card-metrics">
        <div><span>Version</span><strong>{pack.version}</strong></div>
        <div><span>Last updated</span><strong>{pack.last_updated}</strong></div>
        <div><span>Outputs</span><strong>{pack.artifacts_available?.length ?? 0}</strong></div>
        <div><span>Source notes</span><strong>{pack.source_notes?.length ?? 0}</strong></div>
      </div>
      <div className="portal-summary-list">
        <article>
          <span>Use cases</span>
          <strong>{useCases.length > 0 ? useCases.join(", ") : "Tolling implementation and sales demo work"}</strong>
          <p>Labels distinguish generated demo material from source-backed domain rules.</p>
        </article>
        <article>
          <span>CLI</span>
          <strong><code>heart packs build {pack.pack_id} --output sales-demo-kit</code></strong>
          <p>Direct commands stay scriptable and JSON mode stays clean.</p>
        </article>
      </div>
    </section>
  );
}

export function PackLayerSelector({ pack, builder, setBuilder }) {
  const regionalLayers = (pack.build_options?.regional_layers ?? []).map((layer) => [
    layer.region_id ?? layer.id.replace("regional:", ""),
    layer.label,
  ]);
  return (
    <SelectField
      label="Regional layer"
      value={builder.regional_layer}
      onChange={(value) => setBuilder({ ...builder, regional_layer: value })}
      options={[["", "None"], ...regionalLayers]}
    />
  );
}

export function AgencyOverlaySelector({ pack, builder, setBuilder }) {
  const overlays = (pack.build_options?.agency_overlays ?? []).map((overlay) => [
    overlay.overlay_id,
    overlay.name,
  ]);
  return (
    <SelectField
      label="Agency overlay"
      value={builder.agency_overlay}
      onChange={(value) => setBuilder({ ...builder, agency_overlay: value })}
      options={[["", "None"], ...overlays]}
    />
  );
}

export function CustomerOverlayEditor({ builder, setBuilder }) {
  return (
    <label className="portal-field portal-field-wide">
      <span>Customer requirements</span>
      <textarea
        className="portal-textarea"
        rows={5}
        value={builder.customer_requirements}
        onChange={(event) => setBuilder({ ...builder, customer_requirements: event.target.value })}
        placeholder="Use fake demo data. Add customer-specific rules, source labels, and unresolved assumptions."
      />
    </label>
  );
}

export function PackBuildOptions({ pack, builder, setBuilder }) {
  const outputs = (pack.build_options?.outputs ?? pack.artifacts_available ?? []).map((output) => [
    output.id,
    output.label ?? OUTPUT_LABELS[output.id] ?? output.id,
  ]);
  return (
    <div className="portal-command-grid">
      <SelectField
        label="Output type"
        value={builder.output}
        onChange={(value) => setBuilder({ ...builder, output: value })}
        options={outputs}
      />
      <PackLayerSelector pack={pack} builder={builder} setBuilder={setBuilder} />
      <AgencyOverlaySelector pack={pack} builder={builder} setBuilder={setBuilder} />
      <CustomerOverlayEditor builder={builder} setBuilder={setBuilder} />
    </div>
  );
}

export function PackConflictPanel({ conflicts, status }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Conflict review</span>
          <h3>{status === "clear" ? "No conflicts detected" : "Conflicts require review"}</h3>
          <p>Conflicts are surfaced before generation or implementation policy use.</p>
        </div>
        <StatusBadge tone={status === "clear" ? "positive" : "warning"}>{status}</StatusBadge>
      </div>
      <div className="portal-summary-list">
        {conflicts.length === 0 ? (
          <article><span>Clear</span><strong>No layer conflicts</strong><p>Still review source notes and customer assumptions.</p></article>
        ) : conflicts.map((conflict) => (
          <article key={conflict.conflict_id}>
            <span>{conflict.severity}</span>
            <strong>{conflict.rule_id}</strong>
            <p>{conflict.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PackSourceNotesPanel({ sourceNotes }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Source notes</span>
          <h3>Claims stay cited</h3>
          <p>Use these as source anchors. Do not treat generated text as customer policy.</p>
        </div>
      </div>
      <div className="portal-summary-list">
        {sourceNotes.slice(0, 8).map((source) => (
          <article key={source.source_ref}>
            <span>{source.source_ref}</span>
            <strong>{source.label}</strong>
            <p>{source.use}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PackArtifactList({ packId, artifacts }) {
  return (
    <>
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Generated artifacts</span>
          <h3>Artifact history</h3>
          <p>Artifacts are stored with manifests, citations, warnings, and selected layers.</p>
        </div>
      </div>
      <div className="portal-summary-list">
        {artifacts.length === 0 ? (
          <article>
            <span>Empty</span>
            <strong>No generated artifacts yet</strong>
            <p>Use the builder to create the first {packId} artifact.</p>
          </article>
        ) : artifacts.map((artifact) => (
          <article key={artifact.artifact_id}>
            <span>{artifact.output_type}</span>
            <strong>{artifact.artifact_id}</strong>
            <p>{artifact.created_at}</p>
          </article>
        ))}
      </div>
    </>
  );
}

export function PackArtifactViewer({ packId, artifacts, latestArtifactId }) {
  const initialArtifactId = latestArtifactId ?? artifacts[0]?.artifact_id ?? "";
  const [artifactId, setArtifactId] = useState(initialArtifactId);
  const [state, setState] = useState({ status: initialArtifactId ? "loading" : "idle", payload: null, error: "" });

  useEffect(() => {
    const nextArtifactId = latestArtifactId ?? artifacts[0]?.artifact_id ?? "";
    setArtifactId((current) => current || nextArtifactId);
  }, [latestArtifactId, artifacts.length]);

  useEffect(() => {
    if (!artifactId) {
      setState({ status: "idle", payload: null, error: "" });
      return;
    }
    let active = true;
    setState({ status: "loading", payload: null, error: "" });
    fetchPortalJson(`/api/domain-packs/${packId}/artifacts/${artifactId}`)
      .then((payload) => {
        if (active) setState({ status: "ready", payload, error: "" });
      })
      .catch((error) => {
        if (active) setState({ status: "error", payload: null, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [packId, artifactId]);

  const files = state.payload?.files ?? [];
  return (
    <>
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Artifact viewer</span>
          <h3>{artifactId || "No artifact selected"}</h3>
          <p>Review generated content, warnings, and citations before syncing or reuse.</p>
        </div>
      </div>
      {artifacts.length > 0 ? (
        <SelectField
          label="Artifact"
          value={artifactId}
          onChange={setArtifactId}
          options={artifacts.map((artifact) => [artifact.artifact_id, `${artifact.output_type} ${artifact.created_at}`])}
        />
      ) : null}
      {state.status === "error" ? <p className="portal-form-note">{state.error}</p> : null}
      {files.length > 0 ? files.map((file) => (
        <article key={file.path} className="portal-service-card">
          <div className="portal-service-card-head">
            <div>
              <span>Generated</span>
              <strong>{file.path}</strong>
              <p>Source-backed generated artifact.</p>
            </div>
          </div>
          <pre className="portal-state-pre">{file.content.slice(0, 3000)}</pre>
        </article>
      )) : (
        <PortalStateBlock
          tone="neutral"
          eyebrow="Artifact"
          title={artifactId ? "Loading artifact content" : "No artifact selected"}
          description="Generate an artifact to inspect its files here."
        />
      )}
    </>
  );
}

export function PackBenchmarkList({ scenarios }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Benchmark scenarios</span>
          <h3>ROI proof path</h3>
          <p>Scenarios define what can be measured. They are not ROI claims until runs exist.</p>
        </div>
      </div>
      <div className="portal-summary-list">
        {scenarios.map((scenario) => (
          <article key={scenario.id}>
            <span>{scenario.id}</span>
            <strong>{scenario.title}</strong>
            <p>{scenario.task_prompt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PackChatBox({ packId, output }) {
  const [input, setInput] = useState("Build a sales demo kit for tolling");
  const [state, setState] = useState({ status: "idle", payload: null, error: "" });

  async function submitCommand(event) {
    event.preventDefault();
    setState({ status: "submitting", payload: null, error: "" });
    try {
      const payload = await postPortalJson("/api/chat/commands", {
        input,
        selected_pack_id: packId,
        output,
        context_budget: {
          preset: "standard",
          max_input_tokens: 8000,
          max_output_tokens: 2000,
        },
      });
      setState({ status: "ready", payload, error: "" });
    } catch (error) {
      setState({ status: "error", payload: null, error: error.message });
    }
  }

  const card = state.payload?.result_cards?.[0];
  return (
    <>
      <header className="portal-command-head">
        <div>
          <span>Pack chat</span>
          <h4>Allowlisted commands only</h4>
          <p>Chat can prepare pack actions, not run shell commands.</p>
        </div>
      </header>
      <form className="portal-command-grid" onSubmit={submitCommand}>
        <label className="portal-field portal-field-wide">
          <span>Command</span>
          <textarea className="portal-textarea" rows={4} value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <button type="submit" className="portal-button-link portal-button-link-primary" disabled={state.status === "submitting"}>
          {state.status === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </form>
      {state.error ? <p className="portal-form-note">{state.error}</p> : null}
      {card ? (
        <article className="portal-service-card">
          <div className="portal-service-card-head">
            <div>
              <span>{state.payload.intent}</span>
              <strong>{card.title}</strong>
              <p>{card.summary}</p>
            </div>
            <i data-state={card.status === "ready" ? "ready" : "warning"}>{state.payload.status}</i>
          </div>
        </article>
      ) : null}
    </>
  );
}

export function PackBuildProgress({ status }) {
  if (status === "idle") {
    return null;
  }
  return (
    <div className="portal-inline-banner">
      <strong>Build state</strong>
      <p>{status}</p>
    </div>
  );
}

export function PackBuildResult({ result }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Generated</span>
          <h3>{result.artifact_id}</h3>
          <p>{result.manifest.output_type} generated with citations, warnings, and a manifest.</p>
        </div>
        <StatusBadge tone="positive">{result.status}</StatusBadge>
      </div>
      <div className="portal-summary-list">
        {(result.manifest.source_citations ?? []).slice(0, 4).map((citation) => (
          <article key={`${citation.rule_id}:${citation.source_ref}`}>
            <span>{citation.layer}</span>
            <strong>{citation.label}</strong>
            <p>{citation.source_ref}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SecurityWarningPanel({ warnings }) {
  return (
    <section className="portal-enterprise-panel">
      <div className="portal-enterprise-panel-head">
        <div>
          <span>Security warnings</span>
          <h3>Bounded domain data</h3>
          <p>Generated artifacts use safe demo data only and must not include customer secrets.</p>
        </div>
        <StatusBadge tone="warning">Required</StatusBadge>
      </div>
      <div className="portal-summary-list">
        {warnings.map((warning) => (
          <article key={warning}>
            <span>Guardrail</span>
            <strong>{warning}</strong>
            <p>Review before generation, sync, or customer-facing reuse.</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  const resolvedOptions = useMemo(() => options.filter((option) => option[0] !== undefined), [options]);
  return (
    <label className="portal-field">
      <span>{label}</span>
      <select className="portal-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {resolvedOptions.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "none"} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className="portal-table-badge" data-tone={tone === "warning" ? "neutral" : tone}>{children}</span>;
}

function ResourceState({ state, noun }) {
  if (state.status === "error") {
    return (
      <PortalStateBlock
        tone="warning"
        eyebrow={noun}
        title={`Could not load ${noun}`}
        description={state.error}
      />
    );
  }

  return (
    <PortalStateBlock
      tone="loading"
      eyebrow={noun}
      title={`Loading ${noun}`}
      description="Fetching tenant-scoped pack data from the BeHeart API."
    />
  );
}

function usePortalResource(pathname) {
  const [state, setState] = useState({ status: "loading", payload: null, error: "" });

  async function load() {
    setState((current) => ({ ...current, status: current.payload ? "ready" : "loading", error: "" }));
    try {
      const payload = await fetchPortalJson(pathname);
      setState({ status: "ready", payload, error: "" });
    } catch (error) {
      setState({ status: "error", payload: null, error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, [pathname]);

  return { ...state, reload: load };
}
