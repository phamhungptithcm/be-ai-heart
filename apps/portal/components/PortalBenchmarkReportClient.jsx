"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { buildPortalBenchmarkEvidenceSummary } from "../src/dashboard-visuals.js";
import { PortalRunComparisonBars } from "./PortalBenchmarkVisuals.jsx";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalBenchmarkReportClient({ reportId }) {
  const [state, setState] = useState({
    status: "loading",
    report: null,
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchPortalJson(`/api/benchmarks/${reportId}`);

        if (!payload.report_id) {
          throw new Error("Benchmark report not found.");
        }

        if (active) {
          setState({
            status: "ready",
            report: payload,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            report: null,
            error: error.message,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reportId]);

  if (state.status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Benchmark"
        title="Loading benchmark report"
        description="The portal is pulling the detailed ROI view from the service host."
      />
    );
  }

  if (state.status === "error" || !state.report) {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Benchmark"
        title="Benchmark report unavailable"
        description={state.error || "Benchmark report not found."}
      />
    );
  }

  const { report } = state;
  const evidenceSummary = buildPortalBenchmarkEvidenceSummary(report);
  const evidenceManifest = report.evidence_manifest ?? {};
  const evidenceFiles = Array.isArray(evidenceManifest.artifact_list)
    ? evidenceManifest.artifact_list
    : Array.isArray(evidenceManifest.files)
      ? evidenceManifest.files
      : [];
  const topCitations = evidenceManifest.assisted?.context_pack?.top_citations ?? [];
  const evidenceRows = [
    {
      label: "Bundle status",
      value: evidenceSummary.bundle_available ? "Available" : "Missing",
      note:
        evidenceSummary.bundle_available
          ? `${evidenceSummary.bundle_file_count} sanitized artifact file(s) are attached to this benchmark.`
          : "Published benchmark detail exists, but no evidence bundle is available yet.",
      progress: evidenceSummary.bundle_available ? 92 : 16,
    },
    {
      label: "Task coverage",
      value: `${evidenceSummary.context_task_coverage_pct}%`,
      note: "Coverage indicates how much of the task-relevant context was present in the assisted run’s evidence pack.",
      progress: evidenceSummary.context_task_coverage_pct,
    },
    {
      label: "Evidence score",
      value: evidenceSummary.context_evidence_score,
      note: `${evidenceSummary.prompt_count} prompt trace(s), ${evidenceSummary.tool_output_count} tool output(s), ${evidenceSummary.output_artifact_count} output artifact(s).`,
      progress: Math.min(100, Number(evidenceSummary.context_evidence_score ?? 0)),
    },
    {
      label: "Measurement provenance",
      value: `${evidenceSummary.measurement_mode} / ${evidenceSummary.confidence_label}`,
      note: `${evidenceSummary.sample_size} observed run(s) with ${evidenceSummary.observed_coverage_pct}% observed coverage.`,
      progress: evidenceSummary.observed_coverage_pct,
    },
  ];

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Benchmark detail</span>
            <h3>{report.repo}</h3>
            <p>{formatScenarioLabel(report.scenario)} · {report.provider}/{report.model}</p>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/benchmarks" className="portal-button-link">
              All benchmarks
            </Link>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Token save</span><strong>{report.metrics.token_savings_pct}%</strong></article>
          <article className="portal-kpi-card"><span>Cost save</span><strong>${report.metrics.token_cost_savings_usd}</strong></article>
          <article className="portal-kpi-card"><span>Memory save</span><strong>{report.metrics.memory_refresh_reduction_pct}%</strong></article>
          <article className="portal-kpi-card"><span>Time save</span><strong>{report.metrics.time_savings_pct}%</strong></article>
          <article className="portal-kpi-card"><span>Cleanup reduction</span><strong>{report.metrics.review_edit_reduction_pct}%</strong></article>
          <article className="portal-kpi-card"><span>ROI</span><strong>{report.metrics.composite_roi_score}</strong></article>
          <article className="portal-kpi-card"><span>Generated</span><strong>{formatDateTime(report.generated_at)}</strong></article>
          <article className="portal-kpi-card"><span>Scenario</span><strong>{formatScenarioLabel(report.scenario)}</strong></article>
          <article className="portal-kpi-card"><span>Measurement</span><strong>{evidenceSummary.measurement_mode}</strong></article>
          <article className="portal-kpi-card"><span>Confidence</span><strong>{evidenceSummary.confidence_label}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Decision summary</span>
              <h3>Rollout reason</h3>
              <p>{report.manager_summary}</p>
            </div>
          </div>
          <PortalRunComparisonBars report={report} />
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Evidence readiness</span>
              <h3>Evidence trust</h3>
            </div>
          </div>
          <div className="portal-readiness-list">
            {evidenceRows.map((row) => (
              <article key={row.label} className="portal-readiness-row">
                <div className="portal-readiness-copy">
                  <strong>{row.label}</strong>
                  <span>{row.note}</span>
                </div>
                <div className="portal-readiness-meta">
                  <b>{row.value}</b>
                  <small>{row.progress}%</small>
                </div>
                <div className="portal-mini-track" aria-hidden="true">
                  <i className="portal-mini-fill" style={{ width: `${row.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Evidence bundle</span>
            <h3>ROI evidence</h3>
            <p>Published benchmark proof stays sanitized on the portal while still showing whether the assisted run carried enough retrieval evidence.</p>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Evidence item</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="portal-table-primary">
                  <strong>Bundle identity</strong>
                  <small>artifact bundle</small>
                </td>
                <td>{evidenceSummary.bundle_id || "No bundle id published."}</td>
                <td>{evidenceSummary.bundle_file_count} file(s)</td>
              </tr>
              <tr>
                <td className="portal-table-primary">
                  <strong>Measurement mode</strong>
                  <small>provenance</small>
                </td>
                <td>{evidenceSummary.measurement_mode}</td>
                <td>{`${evidenceSummary.sample_size} observed run(s) | ${evidenceSummary.observed_coverage_pct}% observed coverage | ${evidenceSummary.confidence_label} confidence`}</td>
              </tr>
              <tr>
                <td className="portal-table-primary">
                  <strong>Run IDs</strong>
                  <small>baseline / assisted</small>
                </td>
                <td>{evidenceSummary.baseline_run_id || "estimated baseline"}</td>
                <td>{evidenceSummary.assisted_run_id || "estimated assisted"}</td>
              </tr>
              <tr>
                <td className="portal-table-primary">
                  <strong>Repo snapshot</strong>
                  <small>config and policy hashes</small>
                </td>
                <td>{evidenceSummary.repo_snapshot_available ? "snapshot recorded" : "snapshot unavailable"}</td>
                <td>{`config hash ${evidenceSummary.config_hash_present ? "present" : "missing"} | policy hash ${evidenceSummary.policy_hash_present ? "present" : "missing"} | ${evidenceSummary.ignore_path_count} ignores | ${evidenceSummary.document_root_count} document roots`}</td>
              </tr>
              <tr>
                <td className="portal-table-primary">
                  <strong>Prompt traces</strong>
                  <small>assisted run</small>
                </td>
                <td>{evidenceSummary.prompt_count}</td>
                <td>{evidenceSummary.tool_output_count} tool output(s) · {evidenceSummary.output_artifact_count} output artifact(s)</td>
              </tr>
              <tr>
                <td className="portal-table-primary">
                  <strong>Top evidence anchor</strong>
                  <small>ranked citation</small>
                </td>
                <td>{topCitations[0] ? topCitations[0].type : "None"}</td>
                <td>{topCitations[0] ? topCitations[0].reason : "No ranked citation was published with this bundle."}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="portal-summary-list">
          <article>
            <span>Bundle inventory</span>
            <strong>{evidenceFiles.length > 0 ? "Published artifact map available" : "Artifact map unavailable"}</strong>
            <p>
              {evidenceFiles.length > 0
                ? evidenceFiles.map((entry) => `${entry.role}: ${entry.file}`).join(" | ")
                : "Published bundle inventory is not available yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Run narrative</span>
            <h3>Baseline vs assisted</h3>
            <p>{report.technical_summary}</p>
          </div>
        </div>
        <div className="portal-enterprise-split">
          <div className="portal-summary-list">
            <article>
              <span>Baseline</span>
              <strong>Without heart</strong>
              <p>{formatRun(report.baseline)}</p>
            </article>
            <article>
              <span>Assisted</span>
              <strong>With heart</strong>
              <p>{formatRun(report.assisted)}</p>
            </article>
          </div>
          <div className="portal-summary-list">
            <article>
              <span>Technical note</span>
              <strong>Review summary</strong>
              <p>{report.technical_summary}</p>
            </article>
            <article>
              <span>Manager note</span>
              <strong>Decision-ready narrative</strong>
              <p>{report.manager_summary}</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatRun(run) {
  return `${run.tokens} tokens, ${run.minutes} min, ${run.duplicates} duplicates, ${run.policy_violations} policy violations, ${run.review_edits} review edits, ${run.memory_refreshes} memory refreshes, $${run.token_cost_usd.toFixed(2)} token cost.`;
}

function formatScenarioLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
