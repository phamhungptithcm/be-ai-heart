"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchPortalJson } from "../src/api-client.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

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
        const payload = await fetchPortalJson("/api/repositories");

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

export function PortalProfilesClient() {
  const { status, profiles, error } = useProfiles();

  if (status === "loading") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Profiles"
        title="Loading synced repository profiles"
        description="The portal is checking tenant-scoped repository memory and mirrored diagram artifacts."
      />
    );
  }

  if (status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Profiles"
        title="Repository profiles could not be loaded"
        description={error}
        actions={[{ href: "/documents", label: "Check documents" }, { href: "/sign-in", label: "Review session" }]}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <PortalStateBlock
        tone="neutral"
        eyebrow="Profiles"
        title="No repository profile has been synced yet"
        description="Run heart scan and heart diagram sync from the CLI, then come back here to inspect diagrams, docs, and efficiency signals."
        actions={[{ href: "/documents", label: "Review document flow" }, { href: "/usage", label: "Open usage" }]}
      />
    );
  }

  return (
    <div className="portal-data-table-shell">
      <table className="portal-data-table">
        <thead>
          <tr>
            <th>Repository</th>
            <th>Files</th>
            <th>Symbols</th>
            <th>Docs</th>
            <th>Heart links</th>
            <th>Warnings</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.profile_slug}>
              <td className="portal-table-primary">
                <strong>{profile.repo}</strong>
                <small>{profile.overview.summary}</small>
              </td>
              <td>{profile.overview.file_count}</td>
              <td>{profile.overview.symbol_count}</td>
              <td>{profile.documents?.document_count ?? 0}</td>
              <td>{profile.heart?.relationship_count ?? 0}</td>
              <td>{profile.overview.policy_warnings ?? 0}</td>
              <td>
                <span className="portal-table-badge" data-tone={profile.cache?.status === "updated" ? "positive" : "neutral"}>
                  {profile.cache?.status ?? "synced"}
                </span>
              </td>
              <td className="portal-table-link">
                <Link href={`/repositories/${profile.profile_slug}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalBenchmarkSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="portal-empty">{status === "error" ? error : "Loading benchmark summary..."}</p>;
  }

  const documentCount = profiles.reduce((total, profile) => total + (profile.documents?.document_count ?? 0), 0);
  const symbolCount = profiles.reduce((total, profile) => total + (profile.overview?.symbol_count ?? 0), 0);

  return (
    <div className="portal-metric-strip">
      <div className="portal-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="portal-metric-cell"><span>Documents</span><strong>{documentCount}</strong></div>
      <div className="portal-metric-cell"><span>Symbols</span><strong>{symbolCount}</strong></div>
      <div className="portal-metric-cell"><span>Status</span><strong>{profiles.length > 0 ? "Synced" : "Waiting"}</strong></div>
    </div>
  );
}

export function PortalUsageSummaryClient() {
  const { status, profiles, error } = useProfiles();

  if (status !== "ready") {
    return <p className="portal-empty">{status === "error" ? error : "Loading usage summary..."}</p>;
  }

  const relationshipCount = profiles.reduce((total, profile) => total + (profile.heart?.relationship_count ?? 0), 0);
  const domainCount = profiles.reduce((total, profile) => total + (profile.heart?.domain_count ?? 0), 0);

  return (
    <div className="portal-metric-strip">
      <div className="portal-metric-cell"><span>Profiles</span><strong>{profiles.length}</strong></div>
      <div className="portal-metric-cell"><span>Heart links</span><strong>{relationshipCount}</strong></div>
      <div className="portal-metric-cell"><span>Domains</span><strong>{domainCount}</strong></div>
      <div className="portal-metric-cell"><span>Workspace</span><strong>Tenant-scoped</strong></div>
    </div>
  );
}
