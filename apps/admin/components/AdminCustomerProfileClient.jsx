"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AdminMermaidDiagram } from "./AdminMermaidDiagram.jsx";
import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

export function AdminCustomerProfileClient({ slug }) {
  const [state, setState] = useState({
    status: "loading",
    profile: null,
    documents: null,
    benchmarkHistory: null,
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson(`/api/repositories/${slug}`);

        if (!payload?.profile?.profile_slug) {
          throw new Error("Customer repository profile not found.");
        }

        if (active) {
          setState({
            status: "ready",
            profile: payload.profile,
            documents: payload.documents,
            benchmarkHistory: payload.benchmark_history,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            profile: null,
            documents: null,
            benchmarkHistory: null,
            error: error.message,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Customer repository"
        title="Loading customer repository profile"
        description="The admin plane is assembling support metrics, mirrored documents, and benchmark evidence for this repository."
      />
    );
  }

  if (state.status === "error" || !state.profile) {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Customer repository"
        title="Customer repository profile not found"
        description={
          state.error ||
          "This repository is not mirrored into admin yet, or it belongs to a workspace outside the current support scope."
        }
        actions={[{ href: "/customers", label: "Back to customers", primary: true }, { href: "/support", label: "Open support" }]}
      />
    );
  }

  const { profile, documents, benchmarkHistory } = state;
  const benchmarkSummary = summarizeBenchmarkHistory(benchmarkHistory?.reports ?? []);
  const documentCount = documents?.totals?.document_count ?? profile.documents?.document_count ?? 0;
  const readinessScore = computeSupportReadiness(profile, documentCount, benchmarkSummary.report_count);
  const diagrams = Array.isArray(profile.diagrams) ? profile.diagrams : [];
  const topDocuments = documents?.documents?.slice(0, 6) ?? [];
  const actions = buildSupportActions({
    profile,
    documentCount,
    benchmarkReportCount: benchmarkSummary.report_count,
  });

  return (
    <div className="admin-stack-block">
      <section className="admin-command-panel">
        <div className="admin-command-head">
          <div>
            <span>Support profile</span>
            <h3>{profile.repo}</h3>
            <p>{profile.overview.summary}</p>
          </div>
          <div className="admin-command-actions">
            <Link href="/customers" className="admin-button-link">
              All customers
            </Link>
            <Link href="/support" className="admin-button-link admin-button-link-primary">
              Support queue
            </Link>
          </div>
        </div>
        <div className="admin-command-metrics">
          <div className="admin-command-metric">
            <span>Readiness</span>
            <strong>{readinessScore}%</strong>
            <p>Support confidence in the current mirrored profile and evidence set.</p>
          </div>
          <div className="admin-command-metric">
            <span>Files</span>
            <strong>{profile.overview.file_count}</strong>
            <p>Repository footprint currently mirrored into the control plane.</p>
          </div>
          <div className="admin-command-metric">
            <span>Documents</span>
            <strong>{documentCount}</strong>
            <p>Business and requirement memory currently attached to this repo.</p>
          </div>
          <div className="admin-command-metric">
            <span>Warnings</span>
            <strong>{profile.overview.policy_warnings}</strong>
            <p>Architecture or policy issues visible in the latest profile build.</p>
          </div>
          <div className="admin-command-metric">
            <span>Heart links</span>
            <strong>{profile.heart.relationship_count}</strong>
            <p>Cross-code and document relationships available for support reasoning.</p>
          </div>
        </div>
      </section>

      <div className="admin-command-grid">
        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Support actions</span>
              <h3>What support should resolve next on this repository</h3>
            </div>
          </header>
          <div className="admin-risk-list">
            {actions.map((action) => (
              <article key={action.label} className="admin-risk-row">
                <div className="admin-risk-copy">
                  <strong>{action.label}</strong>
                  <span>{action.note}</span>
                </div>
                <div className="admin-risk-meta">
                  <b>{action.value}</b>
                  <small>{action.progress}%</small>
                </div>
                <div className="admin-mini-track" aria-hidden="true">
                  <i className="admin-mini-fill" style={{ width: `${action.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-command-panel">
          <header className="admin-command-head">
            <div>
              <span>Benchmark signals</span>
              <h3>How much ROI proof is already attached</h3>
              <p>Support should be able to tell if this repository already has benchmark evidence before escalation reaches sales or engineering.</p>
            </div>
          </header>
          {benchmarkSummary.report_count === 0 ? (
            <AdminStateBlock
              tone="neutral"
              eyebrow="Benchmark signals"
              title="No benchmark report published for this repository yet"
              description="Commercial proof is still missing for this repo. Support should encourage a measured before/after benchmark on the next meaningful AI-assisted task."
            />
          ) : (
            <div className="admin-pill-grid">
              <ValuePill label="Reports" value={benchmarkSummary.report_count} progress={Math.min(100, benchmarkSummary.report_count * 25)} />
              <ValuePill label="Avg token save" value={`${benchmarkSummary.avg_token_savings_pct}%`} progress={benchmarkSummary.avg_token_savings_pct} />
              <ValuePill label="Avg cost save" value={`$${benchmarkSummary.avg_cost_savings_usd}`} progress={Math.min(100, benchmarkSummary.avg_token_savings_pct)} />
              <ValuePill label="Avg memory save" value={`${benchmarkSummary.avg_memory_refresh_reduction_pct}%`} progress={benchmarkSummary.avg_memory_refresh_reduction_pct} />
              <ValuePill label="Measurement" value={benchmarkSummary.latest_measurement_mode || "estimated"} progress={benchmarkSummary.latest_measurement_mode === "observed" ? 100 : benchmarkSummary.latest_measurement_mode === "mixed" ? 66 : 34} />
              <ValuePill label="Confidence" value={benchmarkSummary.latest_confidence_label || "low"} progress={benchmarkSummary.latest_confidence_label === "high" ? 100 : benchmarkSummary.latest_confidence_label === "medium" ? 66 : 34} />
            </div>
          )}
        </section>
      </div>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Customer document memory</span>
            <h3>Which business and requirement documents support already sees</h3>
          </div>
        </header>
        {topDocuments.length ? (
          <div className="admin-data-table-shell">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Summary</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {topDocuments.map((document) => (
                  <tr key={document.path}>
                    <td className="admin-table-primary">
                      <strong>{document.title}</strong>
                      <small>{document.restricted ? "restricted preview" : "mirrored document"}</small>
                    </td>
                    <td>{document.category}</td>
                    <td>{document.summary || "No summary available."}</td>
                    <td>{document.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminStateBlock
            tone="neutral"
            eyebrow="Document memory"
            title="No document artifact synced for this repository yet"
            description="Support should confirm that CLI-side document import or sync has run before treating missing business context as a UI issue."
          />
        )}
      </section>

      <section className="admin-command-panel">
        <header className="admin-command-head">
          <div>
            <span>Synced diagrams</span>
            <h3>Internal support visibility into the current heart model</h3>
          </div>
        </header>
        <div className="admin-diagram-grid">
          {diagrams.map((diagram) => (
            <article key={diagram.type} className="admin-card">
              <div className="admin-card-head">
                <div>
                  <strong>{diagram.title}</strong>
                  <p>{diagram.summary}</p>
                  <p>{`Inference: ${diagram.inference_mode} | Confidence: ${diagram.confidence} | Trust: ${diagram.trust?.label ?? "n/a"} | Scope: ${diagram.scope?.focus ?? "unknown"}`}</p>
                  <p>{diagram.validation?.warning_count ? `${diagram.validation.warning_count} validation warning(s)` : "Validation passed."}</p>
                </div>
                <span>{diagram.type}</span>
              </div>
              <AdminMermaidDiagram chart={diagram.content} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function summarizeBenchmarkHistory(reports) {
  if (reports.length === 0) {
    return {
      report_count: 0,
      avg_token_savings_pct: 0,
      avg_cost_savings_usd: 0,
      avg_memory_refresh_reduction_pct: 0,
      latest_measurement_mode: "",
      latest_confidence_label: "",
    };
  }

  const latestReport = [...reports].sort(
    (left, right) => String(right.generated_at ?? "").localeCompare(String(left.generated_at ?? "")),
  )[0];

  return {
    report_count: reports.length,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
    latest_measurement_mode: latestReport?.provenance?.summary?.measurement_mode ?? "",
    latest_confidence_label: latestReport?.provenance?.summary?.confidence_label ?? "",
  };
}

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
}

function computeSupportReadiness(profile, documentCount, benchmarkReportCount) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const heartLinks = Number(profile?.heart?.relationship_count ?? 0);
  const syncStatus = String(profile?.cache?.status ?? "").toLowerCase();
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (documentCount > 0 ? 30 : 15) +
          Math.min(24, benchmarkReportCount * 18) +
          Math.min(26, heartLinks / 32) -
          Math.min(20, warningCount * 10) -
          (syncStatus === "stale" || syncStatus === "rebuild" ? 18 : 0),
      ),
    ),
  );
}

function buildSupportActions({ profile, documentCount, benchmarkReportCount }) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const syncStatus = String(profile?.cache?.status ?? "unknown");
  const isStale = ["stale", "rebuild"].includes(syncStatus);
  return [
    {
      label: "Sync freshness",
      value: isStale ? "Review" : "Healthy",
      note: isStale
        ? "This mirrored repository may need a rescan or republish before support relies on it."
        : "Current sync posture looks stable for support review.",
      progress: isStale ? 24 : 90,
    },
    {
      label: "Document memory",
      value: documentCount > 0 ? `${documentCount} docs` : "Missing",
      note:
        documentCount > 0
          ? "Business or technical memory is already available to support."
          : "Missing document memory can make support look like a platform issue when it is really a sync gap.",
      progress: documentCount > 0 ? 100 : 20,
    },
    {
      label: "Benchmark proof",
      value: benchmarkReportCount > 0 ? `${benchmarkReportCount} report(s)` : "Missing",
      note:
        benchmarkReportCount > 0
          ? "Benchmark history already exists for commercial or rollout conversations."
          : "No benchmark proof exists yet for this repository.",
      progress: benchmarkReportCount > 0 ? Math.min(100, 40 + benchmarkReportCount * 20) : 16,
    },
    {
      label: "Policy posture",
      value: warningCount > 0 ? `${warningCount} warning(s)` : "Clean",
      note:
        warningCount > 0
          ? "Warnings should be part of the support narrative before recommending broader rollout."
          : "No active policy warnings are attached to the current mirrored profile.",
      progress: warningCount > 0 ? Math.max(12, 100 - warningCount * 20) : 94,
    },
  ];
}

function ValuePill({ label, value, progress }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress ?? 0)));
  return (
    <article className="admin-value-pill">
      <span>{label}</span>
      <strong>{value}</strong>
      <div className="admin-mini-track" aria-hidden="true">
        <i className="admin-mini-fill" style={{ width: `${safeProgress}%` }} />
      </div>
    </article>
  );
}
