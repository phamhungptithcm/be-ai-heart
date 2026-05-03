"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PortalCodeGraphExplorer } from "./PortalCodeGraphExplorer.jsx";
import { PortalDiagramViewer } from "./PortalDiagramViewer.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const SERVICE_TABS = Object.freeze([
  "code_graph",
  "diagrams",
  "document_memory",
  "context_pack_preview",
  "policy_rails",
  "benchmark_roi",
  "runtime_signals",
]);

export function PortalRepositoryServicesWorkspace({
  profile,
  repositoryServices,
  graphMode,
  onGraphModeChange,
  graphRefreshing = false,
  graphError = "",
} = {}) {
  const [activeTab, setActiveTab] = useState("code_graph");
  const [previewTask, setPreviewTask] = useState(
    repositoryServices?.context_pack_preview?.sample_task ?? "add SSO login audit logging",
  );

  useEffect(() => {
    setActiveTab("code_graph");
    setPreviewTask(repositoryServices?.context_pack_preview?.sample_task ?? "add SSO login audit logging");
  }, [profile?.profile_slug]);

  const summary = repositoryServices?.summary ?? {};
  const activeSection = repositoryServices?.[activeTab] ?? repositoryServices?.code_graph ?? null;

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-repo-focus-row">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Next action</span>
              <h3>{summary.action_center?.[0]?.label ?? "Review synced memory"}</h3>
              <p>{summary.action_center?.[0]?.note ?? "Open the graph, docs, diagrams, or benchmark view from the tabs below."}</p>
            </div>
          </div>
          <div className="portal-readiness-list portal-readiness-list-compact">
            {(summary.action_center ?? []).slice(0, 3).map((action) => (
              <article key={action.label} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{action.label}</strong>
                  <span>{action.note}</span>
                </div>
                <div className="portal-readiness-meta">
                  <b>{action.value}</b>
                  <small>{action.progress}%</small>
                </div>
                <div className="portal-mini-track" aria-hidden="true">
                  <i className="portal-mini-fill" style={{ width: `${action.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Repo views</span>
              <h3>Pick one artifact view</h3>
              <p>Each view is generated from the latest synced repo memory.</p>
            </div>
          </div>
          <div className="portal-repository-services-grid">
            {(repositoryServices?.cards ?? []).map((card) => (
              <button
                key={card.key}
                type="button"
                className={activeTab === card.key ? "portal-service-card is-active" : "portal-service-card"}
                onClick={() => setActiveTab(card.key)}
              >
                <div className="portal-service-card-head">
                  <div>
                    <span>{formatSourceLabel(card.source_type)}</span>
                    <strong>{card.title}</strong>
                    <p>{card.subtitle}</p>
                  </div>
                  <i data-state={card.state}>{formatStateLabel(card.state)}</i>
                </div>
                <div className="portal-service-card-metrics">
                  {(card.metrics ?? []).map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel portal-artifact-focus-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>{formatStateLabel(activeSection?.state)}</span>
            <h3>{activeSection?.title}</h3>
            {activeSection?.subtitle ? <p>{activeSection.subtitle}</p> : null}
          </div>
        </div>

        <div className="portal-service-tabs" role="tablist" aria-label="Repository service tabs">
          {SERVICE_TABS.map((tabKey) => {
            const section = repositoryServices?.[tabKey];
            if (!section) {
              return null;
            }

            return (
              <button
                key={tabKey}
                type="button"
                className={activeTab === tabKey ? "portal-service-tab is-active" : "portal-service-tab"}
                onClick={() => setActiveTab(tabKey)}
              >
                <span>{section.title}</span>
                <strong>{formatStateLabel(section.state)}</strong>
              </button>
            );
          })}
        </div>

        {activeSection?.note && activeTab !== "code_graph" && activeTab !== "diagrams" ? (
          <div className="portal-inline-banner">
            <strong>{formatSourceLabel(activeSection.source_type)}</strong>
            <p>{activeSection.note}</p>
          </div>
        ) : null}

        {activeTab === "code_graph" ? (
          <PortalCodeGraphExplorer
            service={repositoryServices?.code_graph}
            requestedMode={graphMode}
            onModeChange={onGraphModeChange}
            loading={graphRefreshing}
            error={graphError}
          />
        ) : null}

        {activeTab === "diagrams" ? (
          <PortalDiagramViewer diagrams={repositoryServices?.diagrams?.items ?? []} emptyActionHref={`/repositories/${profile.profile_slug}/sync`} />
        ) : null}

        {activeTab === "document_memory" ? (
          repositoryServices?.document_memory?.items?.length ? (
            <div className="portal-data-table-shell">
              <table className="portal-data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Summary</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {repositoryServices.document_memory.items.map((document) => (
                    <tr key={document.path}>
                      <td className="portal-table-primary">
                        <strong>{document.title}</strong>
                        <small>{document.restricted ? "restricted preview" : "synced artifact"}</small>
                      </td>
                      <td>
                        <span className="portal-table-badge" data-tone="neutral">
                          {document.category}
                        </span>
                      </td>
                      <td>{document.summary || "No summary available."}</td>
                      <td>{document.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PortalStateBlock
              tone="neutral"
              eyebrow="Document memory"
              title="No repository document artifact synced yet"
              description="Import or sync requirement and design documents from the CLI so this repository profile reflects current intent."
              actions={[{ href: "/documents", label: "Open documents", primary: true }]}
            />
          )
        ) : null}

        {activeTab === "context_pack_preview" ? (
          <ContextPackPreviewPanel
            service={repositoryServices?.context_pack_preview}
            task={previewTask}
            onTaskChange={setPreviewTask}
          />
        ) : null}

        {activeTab === "policy_rails" ? (
          <div className="portal-enterprise-split">
            <div className="portal-summary-list">
              <article>
                <span>Warnings</span>
                <strong>{repositoryServices?.policy_rails?.summary?.warning_count ?? 0}</strong>
                <p>Repository-level policy warnings stay separate from graph counts so customers can judge rollout risk quickly.</p>
              </article>
              <article>
                <span>Cache posture</span>
                <strong>{repositoryServices?.policy_rails?.summary?.cache_status ?? "unknown"}</strong>
                <p>Sync truth matters. Stale memory should trigger a rescan before the team trusts this repository view.</p>
              </article>
              <article>
                <span>Heart links</span>
                <strong>{repositoryServices?.policy_rails?.summary?.relationship_count ?? 0}</strong>
                <p>Local-first repository memory is only useful when it still reflects the architecture relationships that matter.</p>
              </article>
            </div>
            <div className="portal-summary-list">
              <article>
                <span>Boundary lane</span>
                <strong>Architecture-aware reuse</strong>
                <p>Use the graph and diagrams to understand connected modules, then use the tenant policies workspace for cross-repository guardrail review.</p>
              </article>
              <article>
                <span>Next step</span>
                <strong>Review policy posture before scaling</strong>
                <p>When warnings remain, move from this repository view into the broader policies workspace to close them before rollout.</p>
              </article>
              <article>
                <span>Workspace policy lane</span>
                <strong>
                  <Link href="/policies" className="portal-table-link">
                    Open Policies Workspace
                  </Link>
                </strong>
                <p>Repository status is shown here; tenant-wide policy governance remains in the dedicated policies page.</p>
              </article>
            </div>
          </div>
        ) : null}

        {activeTab === "benchmark_roi" ? (
          repositoryServices?.benchmark_roi?.summary?.report_count ? (
            <div className="portal-enterprise-stack">
              <div className="portal-summary-list">
                <article>
                  <span>Token savings</span>
                  <strong>{repositoryServices.benchmark_roi.summary.avg_token_savings_pct}% average token savings</strong>
                  <p>These values are benchmark-derived and should be read as proof, not live metered usage.</p>
                </article>
                <article>
                  <span>Cleanup reduction</span>
                  <strong>{repositoryServices.benchmark_roi.summary.avg_review_cleanup_reduction_pct}% average cleanup reduction</strong>
                  <p>Review cleanup reduction is shown alongside token savings because customers care about engineering time as much as cost.</p>
                </article>
                <article>
                  <span>Memory refresh reduction</span>
                  <strong>{repositoryServices.benchmark_roi.summary.avg_memory_refresh_reduction_pct}% average memory refresh reduction</strong>
                  <p>Lower memory refresh means less repeated context loading and fewer wasted tokens.</p>
                </article>
                <article>
                  <span>Measurement posture</span>
                  <strong>{`${repositoryServices.benchmark_roi.summary.latest_measurement_mode || "estimated"} / ${repositoryServices.benchmark_roi.summary.latest_confidence_label || "low"}`}</strong>
                  <p>Benchmark proof stays labeled by measurement mode and confidence instead of being treated as uniformly proven.</p>
                </article>
              </div>
              <div className="portal-data-table-shell">
                <table className="portal-data-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Scenario</th>
                      <th>Token save</th>
                      <th>Measurement</th>
                      <th>Confidence</th>
                      <th>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(repositoryServices.benchmark_roi.reports ?? []).map((report) => (
                      <tr key={report.report_id}>
                        <td className="portal-table-primary">
                          <strong>{report.repo}</strong>
                          <small>{formatDateTime(report.generated_at)}</small>
                        </td>
                        <td>{report.scenario}</td>
                        <td>{report.metrics?.token_savings_pct ?? 0}%</td>
                        <td>{report.provenance?.summary?.measurement_mode ?? "estimated"}</td>
                        <td>{report.provenance?.summary?.confidence_label ?? "low"}</td>
                        <td className="portal-table-link">
                          <Link href={`/benchmarks/${report.report_id}`}>Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <PortalStateBlock
              tone="neutral"
              eyebrow="Benchmark ROI"
              title="No benchmark report for this repository yet"
              description="Run a benchmark scenario after the next meaningful AI task so the team can judge savings and quality against a baseline."
              actions={[{ href: `/benchmarks?workspace=${profile.workspace_slug}`, label: "Launch benchmark", primary: true }]}
            />
          )
        ) : null}

        {activeTab === "runtime_signals" ? (
          <div className="portal-enterprise-split">
            <div className="portal-summary-list">
              <article>
                <span>Requests</span>
                <strong>{repositoryServices?.runtime_signals?.summary?.requests ?? 0}</strong>
                <p>Live operational activity is repository-scoped here, even though tenant-wide usage stays on the dedicated usage page.</p>
              </article>
              <article>
                <span>Input tokens</span>
                <strong>{repositoryServices?.runtime_signals?.summary?.input_tokens ?? 0}</strong>
                <p>Live usage is separated from benchmark ROI so customers can see reality without over-claiming savings.</p>
              </article>
              <article>
                <span>Estimated live cost</span>
                <strong>${Number(repositoryServices?.runtime_signals?.summary?.estimated_token_cost_usd ?? 0).toFixed(2)}</strong>
                <p>Metered cost stays labeled as live or mixed, never benchmark proof.</p>
              </article>
            </div>
            <div className="portal-summary-list">
              <article>
                <span>Benchmark reports</span>
                <strong>{repositoryServices?.runtime_signals?.summary?.benchmark_report_count ?? 0}</strong>
                <p>Benchmark coverage is shown here for quick context, but detailed savings remain under the Benchmark ROI tab.</p>
              </article>
              <article>
                <span>Benchmark save</span>
                <strong>{repositoryServices?.runtime_signals?.summary?.avg_token_savings_pct ?? 0}%</strong>
                <p>Benchmark-derived savings are adjacent to live telemetry so customers can compare proof versus current demand.</p>
              </article>
              <article>
                <span>Usage workspace</span>
                <strong>{repositoryServices?.runtime_signals?.summary?.workspace_slug || profile.workspace_slug}</strong>
                <p>
                  <Link href="/usage" className="portal-table-link">
                    Open usage analytics
                  </Link>
                </p>
              </article>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ContextPackPreviewPanel({ service, task, onTaskChange }) {
  const preview = service?.preview ?? {};
  const command = `heart pack "${escapeCommandTask(task || service?.sample_task || "your task")}"`;
  const modelPresets = service?.model_presets?.length
    ? service.model_presets
    : [{ id: "balanced", label: "Balanced coding model", token_budget: preview.token_budget ?? 1200 }];
  const [selectedModel, setSelectedModel] = useState(modelPresets[0]?.id ?? "balanced");
  const [commandText, setCommandText] = useState(`/pack "${escapeCommandTask(task || service?.sample_task || "your task")}"`);

  useEffect(() => {
    setSelectedModel(modelPresets[0]?.id ?? "balanced");
  }, [service?.sample_task]);

  useEffect(() => {
    setCommandText(`/pack "${escapeCommandTask(task || service?.sample_task || "your task")}"`);
  }, [task, service?.sample_task]);

  if (!preview.files?.length && !preview.documents?.length) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Context pack preview"
        title="No synced artifacts are ready for a context preview"
        description="Publish a fresh repository profile with graph and document artifacts, then use the local CLI to compile the final task pack."
        actions={[{ href: "/repositories", label: "Open repositories", primary: true }]}
      />
    );
  }

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-graph-toolbar">
        <div>
          <span className="portal-service-toolbar-label">Preview task</span>
          <h4>Context handoff before agent work</h4>
          <p>This hosted view uses synced artifacts only. The final pack should still be generated locally against the current repo state.</p>
        </div>
        <label className="portal-graph-search">
          <span>Task</span>
          <input
            type="text"
            value={task}
            onChange={(event) => onTaskChange?.(event.target.value)}
            placeholder="add SSO login audit logging"
          />
        </label>
      </div>

      <div className="portal-inline-banner">
        <strong>CLI handoff</strong>
        <p><code>{command}</code></p>
      </div>

      <section className="portal-command-panel">
        <header className="portal-command-head">
          <div>
            <span>Agent workbench preview</span>
            <h4>Model handoff</h4>
            <p>This portal command box is a preview surface only. Run commands locally or through the configured MCP client.</p>
          </div>
        </header>
        <div className="portal-command-grid">
          <label className="portal-field">
            <span>Model preset</span>
            <select className="portal-input" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
              {modelPresets.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} · {model.token_budget} tokens
                </option>
              ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Command box</span>
            <textarea
              className="portal-textarea portal-textarea-sm"
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
              rows={3}
              aria-label="Preview local Heart command"
            />
          </label>
        </div>
        <div className="portal-command-actions">
          {(service?.command_examples ?? []).map((example) => (
            <button key={example} type="button" className="portal-button-link" onClick={() => setCommandText(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <div className="portal-summary-list">
        <article>
          <span>Token budget</span>
          <strong>{preview.token_budget ?? 0}</strong>
          <p>{preview.estimated_tokens ?? 0} estimated preview tokens from synced metadata.</p>
        </article>
        <article>
          <span>Files</span>
          <strong>{preview.files?.length ?? 0}</strong>
          <p>Candidate files come from the focused code graph.</p>
        </article>
        <article>
          <span>Documents</span>
          <strong>{preview.documents?.length ?? 0}</strong>
          <p>Restricted documents stay metadata-only in this portal view.</p>
        </article>
        <article>
          <span>Confidence</span>
          <strong>{preview.confidence_label ?? "low"}</strong>
          <p>Preview confidence is not a substitute for running the local pack compiler.</p>
        </article>
      </div>

      <div className="portal-enterprise-split">
        <section className="portal-card">
          <div className="portal-card-head">
            <div>
              <strong>Files and symbols</strong>
              <p>Likely code context for the task, based on published graph artifacts.</p>
            </div>
            <span>{service?.mcp_tool ?? "context_pack"}</span>
          </div>
          <div className="portal-readiness-list">
            {(preview.files ?? []).map((file) => (
              <article key={file.path} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{file.path}</strong>
                  <span>{file.reason}</span>
                </div>
              </article>
            ))}
            {(preview.symbols ?? []).slice(0, 4).map((symbol) => (
              <article key={`${symbol.name}:${symbol.path}`} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{symbol.name}</strong>
                  <span>{symbol.type} in {symbol.path}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card-head">
            <div>
              <strong>Docs, citations, and risks</strong>
              <p>Business and governance context that should travel with the task.</p>
            </div>
            <span>{preview.citations?.length ?? 0} citations</span>
          </div>
          <div className="portal-readiness-list">
            {(preview.documents ?? []).map((document) => (
              <article key={document.path || document.title} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{document.title}</strong>
                  <span>{document.category} · {document.restricted ? "restricted metadata" : document.summary}</span>
                </div>
              </article>
            ))}
            {(preview.risks ?? []).map((risk) => (
              <article key={risk} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>Risk</strong>
                  <span>{risk}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatStateLabel(value) {
  const safeValue = String(value ?? "unknown");
  return safeValue.replace(/[_-]+/g, " ");
}

function formatSourceLabel(value) {
  const safeValue = String(value ?? "unknown");
  if (safeValue === "repo_artifact") {
    return "Repository artifact";
  }
  if (safeValue === "benchmark_artifact") {
    return "Benchmark artifact";
  }
  if (safeValue === "hosted_telemetry") {
    return "Hosted telemetry";
  }
  if (safeValue === "mixed") {
    return "Mixed";
  }
  return safeValue.replace(/[_-]+/g, " ");
}

function formatDateTime(value) {
  return String(value ?? "").slice(0, 16).replace("T", " ");
}

function escapeCommandTask(value) {
  return String(value ?? "").replace(/["\\]/g, "").trim() || "your task";
}
