"use client";

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

  return (
    <>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Repository signals</h2>
            <p>{profile.profile_slug}</p>
          </div>
        </div>
        <div className="portal-stat-grid">
          <div><span>Files</span><strong>{profile.overview.file_count}</strong></div>
          <div><span>Symbols</span><strong>{profile.overview.symbol_count}</strong></div>
          <div><span>Documents</span><strong>{documentCount}</strong></div>
          <div><span>Heart Links</span><strong>{profile.heart.relationship_count}</strong></div>
        </div>
      </section>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Efficiency controls</h2>
            <p>Customers should see whether AI use on this repository is saving cost and context effort, not just shipping more activity.</p>
          </div>
        </div>
        {benchmarkSummary.report_count === 0 ? (
          <PortalStateBlock
            tone="neutral"
            eyebrow="Efficiency controls"
            title="No benchmark report for this repository yet"
            description="Run a benchmark scenario after the next meaningful AI task so the team can judge savings and quality against a baseline."
            actions={[{ href: "/benchmarks", label: "Open benchmark history" }]}
          />
        ) : (
          <div className="portal-stat-grid">
            <div><span>Reports</span><strong>{benchmarkSummary.report_count}</strong></div>
            <div><span>Avg Token Save</span><strong>{benchmarkSummary.avg_token_savings_pct}%</strong></div>
            <div><span>Avg Cost Save</span><strong>${benchmarkSummary.avg_cost_savings_usd}</strong></div>
            <div><span>Avg Memory Save</span><strong>{benchmarkSummary.avg_memory_refresh_reduction_pct}%</strong></div>
          </div>
        )}
      </section>
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Project memory documents</h2>
            <p>Business and requirement documents already published back from the repository live here.</p>
          </div>
        </div>
        {documents?.documents?.length ? (
          <div className="portal-list">
            {documents.documents.slice(0, 6).map((document) => (
              <article key={document.path} className="portal-card">
                <div className="portal-card-head">
                  <div>
                    <strong>{document.title}</strong>
                    <p>{document.summary || "No summary available."}</p>
                  </div>
                  <span>{document.category}</span>
                </div>
                <div className="portal-inline-metrics">
                  <span>{document.path}</span>
                </div>
              </article>
            ))}
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
      <section className="portal-section">
        <div className="portal-section-head">
          <div>
            <h2>Synced diagrams</h2>
            <p>Customer visual review</p>
          </div>
        </div>
        <div className="portal-diagram-grid">
          {profile.diagrams.map((diagram) => (
            <article key={diagram.type} className="portal-card">
              <div className="portal-card-head">
                <div>
                  <strong>{diagram.title}</strong>
                  <p>{diagram.summary}</p>
                </div>
                <span>{diagram.type}</span>
              </div>
              <MermaidDiagram chart={diagram.content} />
            </article>
          ))}
        </div>
      </section>
    </>
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
