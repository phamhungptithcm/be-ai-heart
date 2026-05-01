"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MermaidDiagram } from "./MermaidDiagram.jsx";
import { PortalCodeGraphExplorer } from "./PortalCodeGraphExplorer.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

const SERVICE_TABS = Object.freeze([
  "code_graph",
  "diagrams",
  "document_memory",
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

  useEffect(() => {
    setActiveTab("code_graph");
  }, [profile?.profile_slug]);

  const summary = repositoryServices?.summary ?? {};
  const activeSection = repositoryServices?.[activeTab] ?? repositoryServices?.code_graph ?? null;

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Action center</span>
              <h3>What this repository still needs before broader rollout</h3>
              <p>BeHeart should make it obvious whether this repository is ready for broader AI usage, not just visually impressive.</p>
            </div>
          </div>
          <div className="portal-readiness-list">
            {(summary.action_center ?? []).map((action) => (
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
              <span>Services lane</span>
              <h3>Every imported repository exposes the BeHeart services it is actually using</h3>
              <p>These cards stay repository-scoped so customers can inspect code graph, diagrams, policy rails, documents, runtime, and ROI from one place.</p>
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

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repository services</span>
            <h3>{activeSection?.title}</h3>
            <p>{activeSection?.subtitle}</p>
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

        {activeSection?.note ? (
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
          <div className="portal-diagram-grid">
            {(repositoryServices?.diagrams?.items ?? []).map((diagram) => (
              <article key={diagram.type} className="portal-card">
                <div className="portal-card-head">
                  <div>
                    <strong>{diagram.title}</strong>
                    <p>{diagram.summary}</p>
                    <p>{`Inference: ${diagram.inference_mode} | Confidence: ${diagram.confidence} | Trust: ${diagram.trust?.label ?? "n/a"} | Scope: ${diagram.scope?.focus ?? "unknown"}`}</p>
                    <p>{diagram.validation?.warning_count ? `${diagram.validation.warning_count} validation warning(s)` : "Validation passed."}</p>
                  </div>
                  <span>{diagram.type}</span>
                </div>
                <MermaidDiagram chart={diagram.content} />
              </article>
            ))}
          </div>
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
