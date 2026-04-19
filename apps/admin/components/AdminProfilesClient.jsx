"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAdminJson } from "../src/api-client.js";
import { AdminStateBlock } from "./AdminStateBlock.jsx";

function useProfiles() {
  const [state, setState] = useState({
    status: "loading",
    profiles: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await fetchAdminJson("/api/repositories");

        if (active) {
          setState({
            status: "ready",
            profiles: payload.profiles ?? [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            profiles: [],
            error: error.message,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function AdminProfilesClient() {
  const { status, profiles, error } = useProfiles();

  if (status === "loading") {
    return (
      <AdminStateBlock
        tone="loading"
        eyebrow="Customers"
        title="Loading mirrored customer profiles"
        description="The admin plane is pulling the current support inventory across tenant-scoped repository profiles."
      />
    );
  }

  if (status === "error") {
    return (
      <AdminStateBlock
        tone="error"
        eyebrow="Customers"
        title="Customer profiles could not be loaded"
        description={error}
        actions={[{ href: "/support", label: "Open support" }, { href: "/ops-health", label: "Check ops health" }]}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <AdminStateBlock
        tone="neutral"
        eyebrow="Customers"
        title="No customer profile has been mirrored yet"
        description="Support inventory will appear here after the first repository profile is published through the hosted service layer."
        actions={[{ href: "/documents", label: "Review document lane" }]}
      />
    );
  }

  return (
    <div className="admin-data-table-shell">
      <table className="admin-data-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Customer</th>
            <th>Files</th>
            <th>Symbols</th>
            <th>Docs</th>
            <th>Warnings</th>
            <th>Heart links</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.profile_slug}>
              <td className="admin-table-primary">
                <strong>{profile.repo}</strong>
                <small>{profile.overview.summary}</small>
              </td>
              <td>{profile.customer_slug ?? "unknown"}</td>
              <td>{profile.overview.file_count}</td>
              <td>{profile.overview.symbol_count}</td>
              <td>{profile.documents?.document_count ?? 0}</td>
              <td>{profile.overview.policy_warnings ?? 0}</td>
              <td>{profile.heart?.relationship_count ?? 0}</td>
              <td className="admin-table-link">
                <Link href={`/customers/${profile.profile_slug}`}>Inspect</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSupportSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return (
      <AdminStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Support"
        title={status === "error" ? "Support summary unavailable" : "Loading support summary"}
        description={
          status === "error"
            ? error
            : "Admin is aggregating profile warnings and support-critical sync inventory."
        }
      />
    );
  }

  const warningCount = profiles.reduce((total, profile) => total + (profile.overview?.policy_warnings ?? 0), 0);

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Warnings</span><strong>{warningCount}</strong></div>
      <div className="admin-metric-cell"><span>Sync health</span><strong>{profiles.length > 0 ? "Observed" : "Waiting"}</strong></div>
      <div className="admin-metric-cell"><span>Priority</span><strong>Customer-facing</strong></div>
    </div>
  );
}

export function AdminRevenueSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="admin-empty">{status === "error" ? error : "Loading revenue summary..."}</p>;
  }

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Mirrored profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Commercial stage</span><strong>Design partner</strong></div>
      <div className="admin-metric-cell"><span>Expansion model</span><strong>Usage + value</strong></div>
      <div className="admin-metric-cell"><span>Owner surface</span><strong>Internal</strong></div>
    </div>
  );
}

export function AdminOpsHealthSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return (
      <AdminStateBlock
        tone={status === "error" ? "error" : "loading"}
        eyebrow="Operations"
        title={status === "error" ? "Ops summary unavailable" : "Loading ops summary"}
        description={
          status === "error"
            ? error
            : "The admin plane is checking mirrored heart-link depth and overall supportability."
        }
      />
    );
  }

  const relationshipCount = profiles.reduce((total, profile) => total + (profile.heart?.relationship_count ?? 0), 0);

  return (
    <div className="admin-metric-strip">
      <div className="admin-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="admin-metric-cell"><span>Heart links</span><strong>{relationshipCount}</strong></div>
      <div className="admin-metric-cell"><span>Environment</span><strong>Local-first</strong></div>
      <div className="admin-metric-cell"><span>Readiness</span><strong>Hosted pilot</strong></div>
    </div>
  );
}
