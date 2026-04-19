"use client";

import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
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

  return (
    <>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>{report.repo}</h2>
            <p>{report.scenario}</p>
          </div>
        </div>
        <div className="portal-stat-grid">
          <div><span>Token Save</span><strong>{report.metrics.token_savings_pct}%</strong></div>
          <div><span>Cost Save</span><strong>${report.metrics.token_cost_savings_usd}</strong></div>
          <div><span>Memory Save</span><strong>{report.metrics.memory_refresh_reduction_pct}%</strong></div>
          <div><span>ROI</span><strong>{report.metrics.composite_roi_score}</strong></div>
        </div>
      </section>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Decision summary</h2>
            <p>{report.manager_summary}</p>
          </div>
        </div>
        <PortalRunComparisonBars report={report} />
      </section>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Run narrative</h2>
            <p>{report.technical_summary}</p>
          </div>
        </div>
        <div className="portal-list">
          <article className="portal-card">
            <div className="portal-card-head">
              <div>
                <strong>Baseline</strong>
                <p>{formatRun(report.baseline)}</p>
              </div>
              <span>without heart</span>
            </div>
          </article>
          <article className="portal-card">
            <div className="portal-card-head">
              <div>
                <strong>Assisted</strong>
                <p>{formatRun(report.assisted)}</p>
              </div>
              <span>with heart</span>
            </div>
          </article>
          <article className="portal-card">
            <div className="portal-card-head">
              <div>
                <strong>Technical note</strong>
                <p>{report.technical_summary}</p>
              </div>
              <span>review</span>
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
