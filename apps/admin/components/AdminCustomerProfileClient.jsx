"use client";

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

  return (
    <>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Support metrics</h2>
            <p>{profile.profile_slug}</p>
          </div>
        </div>
        <div className="admin-stat-grid">
          <div><span>Files</span><strong>{profile.overview.file_count}</strong></div>
          <div><span>Symbols</span><strong>{profile.overview.symbol_count}</strong></div>
          <div><span>Warnings</span><strong>{profile.overview.policy_warnings}</strong></div>
          <div><span>Heart Links</span><strong>{profile.heart.relationship_count}</strong></div>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Benchmark signals</h2>
            <p>Internal view of whether this customer repository is actually seeing ROI from heart-assisted AI work.</p>
          </div>
        </div>
        {benchmarkSummary.report_count === 0 ? (
          <AdminStateBlock
            tone="neutral"
            eyebrow="Benchmark signals"
            title="No benchmark report published for this repository yet"
            description="Commercial proof is still missing for this repo. Support should encourage a measured before/after benchmark on the next meaningful AI-assisted task."
          />
        ) : (
          <div className="admin-stat-grid">
            <div><span>Reports</span><strong>{benchmarkSummary.report_count}</strong></div>
            <div><span>Avg Token Save</span><strong>{benchmarkSummary.avg_token_savings_pct}%</strong></div>
            <div><span>Avg Cost Save</span><strong>${benchmarkSummary.avg_cost_savings_usd}</strong></div>
            <div><span>Avg Memory Save</span><strong>{benchmarkSummary.avg_memory_refresh_reduction_pct}%</strong></div>
          </div>
        )}
      </section>
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Customer document memory</h2>
            <p>These are the documents currently visible to the synced repository profile.</p>
          </div>
        </div>
        {documents?.documents?.length ? (
          <div className="admin-list">
            {documents.documents.slice(0, 6).map((document) => (
              <article key={document.path} className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <strong>{document.title}</strong>
                    <p>{document.summary || "No summary available."}</p>
                  </div>
                  <span>{document.category}</span>
                </div>
                <div className="admin-inline-metrics">
                  <span>{document.path}</span>
                </div>
              </article>
            ))}
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
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Synced diagrams</h2>
            <p>Internal support visibility</p>
          </div>
        </div>
        <div className="admin-diagram-grid">
          {profile.diagrams.map((diagram) => (
            <article key={diagram.type} className="admin-card">
              <div className="admin-card-head">
                <div>
                  <strong>{diagram.title}</strong>
                  <p>{diagram.summary}</p>
                </div>
                <span>{diagram.type}</span>
              </div>
              <AdminMermaidDiagram chart={diagram.content} />
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
