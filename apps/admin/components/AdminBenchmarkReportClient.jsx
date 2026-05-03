"use client";

import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { buildAdminBenchmarkEvidenceSummary } from "../src/dashboard-visuals.js";
import { AdminRunComparisonBars } from "./AdminBenchmarkVisuals.jsx";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminBenchmarkReportClient({ reportId }) {
  const [state, setState] = useState({
    status: "loading",
    report: null,
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson(`/api/benchmarks/${reportId}`);

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
      <AdminStateBlock
        tone="loading"
        eyebrow="Benchmark"
        title="Loading benchmark report"
        description="The admin surface is loading the detailed benchmark record for support and revenue review."
      />
    );
  }

  if (state.status === "error" || !state.report) {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Benchmark"
        title="Benchmark report unavailable"
        description={state.error || "Benchmark report not found."}
      />
    );
  }

  const { report } = state;
  const evidenceSummary = buildAdminBenchmarkEvidenceSummary(report);
  const evidenceManifest = report.evidence_manifest ?? {};
  const evidenceFiles = Array.isArray(evidenceManifest.artifact_list)
    ? evidenceManifest.artifact_list
    : Array.isArray(evidenceManifest.files)
      ? evidenceManifest.files
      : [];
  const topCitations = evidenceManifest.assisted?.context_pack?.top_citations ?? [];

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>{report.repo}</h2>
            <p>{report.scenario}</p>
          </div>
        </div>
        <div className="admin-stat-grid">
          <div><span>Token Save</span><strong>{report.metrics.token_savings_pct}%</strong></div>
          <div><span>Cost Save</span><strong>${report.metrics.token_cost_savings_usd}</strong></div>
          <div><span>Memory Save</span><strong>{report.metrics.memory_refresh_reduction_pct}%</strong></div>
          <div><span>ROI</span><strong>{report.metrics.composite_roi_score}</strong></div>
          <div><span>Measurement</span><strong>{evidenceSummary.measurement_mode}</strong></div>
          <div><span>Confidence</span><strong>{evidenceSummary.confidence_label}</strong></div>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Benchmark narrative</h2>
            <p>{report.manager_summary}</p>
          </div>
        </div>
        <AdminRunComparisonBars report={report} />
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Evidence bundle</h2>
            <p>Internal detail should confirm that the published ROI claim is anchored to a bounded run bundle without exposing local-only raw paths.</p>
          </div>
        </div>
        <div className="admin-stat-grid">
          <div><span>Bundle</span><strong>{evidenceSummary.bundle_available ? "available" : "missing"}</strong></div>
          <div><span>Manifest files</span><strong>{evidenceSummary.bundle_file_count}</strong></div>
          <div><span>Prompt traces</span><strong>{evidenceSummary.prompt_count}</strong></div>
          <div><span>Tool outputs</span><strong>{evidenceSummary.tool_output_count}</strong></div>
          <div><span>Artifacts</span><strong>{evidenceSummary.output_artifact_count}</strong></div>
          <div><span>Observed runs</span><strong>{evidenceSummary.sample_size}</strong></div>
          <div><span>Observed coverage</span><strong>{evidenceSummary.observed_coverage_pct}%</strong></div>
        </div>
        <div className="admin-list">
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Bundle identity</strong>
                <p>{evidenceSummary.bundle_id || "No evidence bundle published."}</p>
              </div>
              <span>{evidenceSummary.bundle_available ? "traceable" : "missing"}</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Measurement provenance</strong>
                <p>{`${evidenceSummary.measurement_mode} measurement | ${evidenceSummary.sample_size} observed run(s) | ${evidenceSummary.observed_coverage_pct}% observed coverage`}</p>
              </div>
              <span>{evidenceSummary.confidence_label}</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Run trace</strong>
                <p>{`Task ${evidenceSummary.task || report.scenario} | ${evidenceSummary.provider || report.provider}/${evidenceSummary.model || report.model} | baseline ${evidenceSummary.baseline_run_id || "estimated"} | assisted ${evidenceSummary.assisted_run_id || "estimated"}`}</p>
              </div>
              <span>v2 manifest</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Repo snapshot</strong>
                <p>{`Config hash ${evidenceSummary.config_hash_present ? "present" : "missing"} | policy hash ${evidenceSummary.policy_hash_present ? "present" : "missing"} | ${evidenceSummary.ignore_path_count} ignored paths | ${evidenceSummary.document_root_count} document roots`}</p>
              </div>
              <span>{evidenceSummary.repo_snapshot_available ? "recorded" : "missing"}</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Context evidence quality</strong>
                <p>{`Coverage ${evidenceSummary.context_task_coverage_pct}% | compactness ${evidenceSummary.context_compactness_score} | evidence ${evidenceSummary.context_evidence_score}`}</p>
              </div>
              <span>{evidenceSummary.citation_mix}</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Bundle inventory</strong>
                <p>
                  {evidenceFiles.length > 0
                    ? evidenceFiles.map((entry) => `${entry.role}: ${entry.file}`).join(" | ")
                    : "No published inventory found for this evidence bundle."}
                </p>
              </div>
              <span>public manifest</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Top evidence anchor</strong>
                <p>
                  {topCitations[0]
                    ? `${topCitations[0].type} evidence: ${topCitations[0].reason}`
                    : "No ranked citation is attached to this hosted manifest."}
                </p>
              </div>
              <span>{topCitations.length} citation(s)</span>
            </div>
          </article>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Operational reading</h2>
            <p>{report.technical_summary}</p>
          </div>
        </div>
        <div className="admin-list">
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Technical summary</strong>
                <p>{report.technical_summary}</p>
              </div>
              <span>analysis</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Baseline</strong>
                <p>{formatRun(report.baseline)}</p>
              </div>
              <span>without heart</span>
            </div>
          </article>
          <article className="admin-card">
            <div className="admin-card-head">
              <div>
                <strong>Assisted</strong>
                <p>{formatRun(report.assisted)}</p>
              </div>
              <span>with heart</span>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

function formatRun(run) {
  return `${run.tokens} tokens, ${run.minutes} min, ${run.duplicates} duplicates, ${run.policy_violations} policy violations, ${run.review_edits} review edits, ${run.memory_refreshes} memory refreshes, $${run.token_cost_usd.toFixed(2)} token cost.`;
}
