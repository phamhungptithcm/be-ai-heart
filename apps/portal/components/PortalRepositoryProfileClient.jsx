"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MermaidDiagram } from "./MermaidDiagram.jsx";
import { fetchPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalRepositoryProfileClient({ slug }) {
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
        const payload = await fetchPortalJson(`/api/repositories/${slug}`);

        if (!payload?.profile?.profile_slug) {
          throw new Error("Repository profile not found.");
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
      <PortalStateBlock
        tone="loading"
        eyebrow="Repository"
        title="Loading repository profile"
        description="The portal is assembling the latest project memory, diagrams, documents, and benchmark evidence."
      />
    );
  }

  if (state.status === "error" || !state.profile) {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Repository"
        title="Repository profile not found"
        description={state.error || "This repository has not been published into the portal yet, or your session is scoped to a different workspace."}
        actions={[{ href: "/repositories", label: "Back to repositories", primary: true }, { href: "/sign-in", label: "Review access" }]}
      />
    );
  }

  const { profile, documents, benchmarkHistory } = state;
  const benchmarkSummary = summarizeBenchmarkHistory(benchmarkHistory?.reports ?? []);
  const documentCount = documents?.totals?.document_count ?? profile.documents.document_count;
  const readinessScore = computeRepositoryReadiness(profile, documentCount, benchmarkSummary.report_count);
  const actions = buildRepositoryActions({
    profile,
    documentCount,
    benchmarkReportCount: benchmarkSummary.report_count,
  });
  const topDocuments = documents?.documents?.slice(0, 6) ?? [];
  const diagrams = Array.isArray(profile.diagrams) ? profile.diagrams : [];

  return (
    <div className="portal-enterprise-stack">
      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repository profile</span>
            <h3>{profile.repo}</h3>
            <p>{profile.overview.summary}</p>
          </div>
          <div className="portal-enterprise-panel-actions">
            <Link href="/repositories" className="portal-button-link">
              All repositories
            </Link>
            <Link href={`/benchmarks?workspace=${encodeURIComponent(profile.workspace_slug ?? "")}`} className="portal-button-link portal-button-link-primary">
              Run benchmark
            </Link>
          </div>
        </div>
        <div className="portal-kpi-grid">
          <article className="portal-kpi-card"><span>Readiness</span><strong>{readinessScore}%</strong></article>
          <article className="portal-kpi-card"><span>Files</span><strong>{profile.overview.file_count}</strong></article>
          <article className="portal-kpi-card"><span>Symbols</span><strong>{profile.overview.symbol_count}</strong></article>
          <article className="portal-kpi-card"><span>Documents</span><strong>{documentCount}</strong></article>
          <article className="portal-kpi-card"><span>Heart links</span><strong>{profile.heart.relationship_count}</strong></article>
          <article className="portal-kpi-card"><span>Benchmarks</span><strong>{benchmarkSummary.report_count}</strong></article>
          <article className="portal-kpi-card"><span>Warnings</span><strong>{profile.overview.policy_warnings}</strong></article>
          <article className="portal-kpi-card"><span>Cache status</span><strong>{profile.cache?.status ?? "unknown"}</strong></article>
        </div>
      </section>

      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Action center</span>
              <h3>What this repository still needs before broader rollout</h3>
            </div>
          </div>
          <div className="portal-readiness-list">
            {actions.map((action) => (
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
              <span>Efficiency controls</span>
              <h3>How much benchmark proof is already attached</h3>
              <p>Customers should see whether AI use on this repository is saving cost and context effort, not just generating activity.</p>
            </div>
          </div>
          {benchmarkSummary.report_count === 0 ? (
            <PortalStateBlock
              tone="neutral"
              eyebrow="Efficiency controls"
              title="No benchmark report for this repository yet"
              description="Run a benchmark scenario after the next meaningful AI task so the team can judge savings and quality against a baseline."
              actions={[{ href: `/benchmarks?workspace=${profile.workspace_slug}`, label: "Launch benchmark", primary: true }]}
            />
          ) : (
            <div className="portal-summary-list">
              <article>
                <span>Reports</span>
                <strong>{benchmarkSummary.report_count} published benchmark report(s)</strong>
                <p>Benchmark-backed repositories are easier to expand because the value story is already measurable.</p>
              </article>
              <article>
                <span>Average efficiency</span>
                <strong>{benchmarkSummary.avg_token_savings_pct}% token save with ${benchmarkSummary.avg_cost_savings_usd} average cost delta</strong>
                <p>{benchmarkSummary.avg_memory_refresh_reduction_pct}% average memory refresh reduction across this repository’s benchmark history.</p>
              </article>
            </div>
          )}
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Project memory documents</span>
            <h3>Business, requirement, and design memory currently attached to this repository</h3>
          </div>
        </div>
        {topDocuments.length ? (
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
                {topDocuments.map((document) => (
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
            eyebrow="Project memory"
            title="No repository document artifact synced yet"
            description="Import or sync business and requirement documents from the CLI so this repository profile reflects current intent."
            actions={[{ href: "/documents", label: "Open documents", primary: true }]}
          />
        )}
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Synced diagrams</span>
            <h3>Customer visual review of the current repository heart</h3>
          </div>
        </div>
        <div className="portal-diagram-grid">
          {diagrams.map((diagram) => (
            <article key={diagram.type} className="portal-card">
              <div className="portal-card-head">
                <div>
                  <strong>{diagram.title}</strong>
                  <p>{diagram.summary}</p>
                  <p>{`Inference: ${diagram.inference_mode} | Confidence: ${diagram.confidence} | Scope: ${diagram.scope?.focus ?? "unknown"}`}</p>
                </div>
                <span>{diagram.type}</span>
              </div>
              <MermaidDiagram chart={diagram.content} />
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
    };
  }

  return {
    report_count: reports.length,
    avg_token_savings_pct: average(reports.map((report) => report.metrics?.token_savings_pct ?? 0)),
    avg_cost_savings_usd: average(reports.map((report) => report.metrics?.token_cost_savings_usd ?? 0)),
    avg_memory_refresh_reduction_pct: average(
      reports.map((report) => report.metrics?.memory_refresh_reduction_pct ?? 0),
    ),
  };
}

function average(values) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round((total / Math.max(values.length, 1)) * 10) / 10;
}

function computeRepositoryReadiness(profile, documentCount, benchmarkCount) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const relationshipCount = Number(profile?.heart?.relationship_count ?? 0);
  const cacheStatus = String(profile?.cache?.status ?? "").toLowerCase();
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (documentCount > 0 ? 34 : 16) +
          Math.min(24, benchmarkCount * 18) +
          Math.min(24, relationshipCount / 35) -
          Math.min(22, warningCount * 10) -
          (cacheStatus === "stale" || cacheStatus === "rebuild" ? 16 : 0),
      ),
    ),
  );
}

function buildRepositoryActions({ profile, documentCount, benchmarkReportCount }) {
  const warningCount = Number(profile?.overview?.policy_warnings ?? 0);
  const cacheStatus = String(profile?.cache?.status ?? "unknown");
  const isStale = ["stale", "rebuild"].includes(cacheStatus);
  return [
    {
      label: "Sync freshness",
      value: isStale ? "Resync needed" : "Fresh",
      note: isStale
        ? "Cache status suggests the repository should be rescanned before trusting current diagrams or memory coverage."
        : "Current cache status is healthy enough for review and follow-through.",
      progress: isStale ? 28 : 92,
    },
    {
      label: "Document memory",
      value: documentCount > 0 ? `${documentCount} docs` : "Missing",
      note:
        documentCount > 0
          ? "Repository intent already includes synced business or technical documents."
          : "This repository still lacks synced requirement or business context.",
      progress: documentCount > 0 ? 100 : 22,
    },
    {
      label: "Benchmark proof",
      value: benchmarkReportCount > 0 ? `${benchmarkReportCount} report(s)` : "Missing",
      note:
        benchmarkReportCount > 0
          ? "Benchmark proof already exists for this repository and can support rollout decisions."
          : "Publish at least one benchmark before treating this repository as financially proven.",
      progress: benchmarkReportCount > 0 ? Math.min(100, 40 + benchmarkReportCount * 20) : 18,
    },
    {
      label: "Policy posture",
      value: warningCount > 0 ? `${warningCount} warning(s)` : "Clean",
      note:
        warningCount > 0
          ? "Architecture or policy warnings still need attention before this repo is rollout-ready."
          : "No active policy warnings are attached to this repository profile.",
      progress: warningCount > 0 ? Math.max(12, 100 - warningCount * 20) : 94,
    },
  ];
}
