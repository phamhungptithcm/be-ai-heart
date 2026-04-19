"use client";

import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalSettingsClient() {
  const settingsState = usePortalResource("/api/settings");

  if (settingsState.status === "loading" || settingsState.status === "idle") {
    return (
      <PortalStateBlock
        tone="loading"
        eyebrow="Settings"
        title="Loading organization settings"
        description="BeHeart is preparing org profile, auth provider status, retention controls, and integration posture."
      />
    );
  }

  if (settingsState.status === "error") {
    return (
      <PortalStateBlock
        tone="error"
        eyebrow="Settings"
        title="Settings unavailable"
        description={settingsState.error}
      />
    );
  }

  const settings = settingsState.data ?? {};

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Organization</span>
              <h3>Org profile and portal scope</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article><span>Customer slug</span><strong>{settings.organization?.customer_slug ?? "—"}</strong></article>
            <article><span>Display name</span><strong>{settings.organization?.display_name ?? "—"}</strong></article>
            <article><span>Status</span><strong>{settings.organization?.status ?? "active"}</strong></article>
            <article><span>Active workspaces</span><strong>{settings.organization?.active_workspaces ?? 0}</strong></article>
          </div>
        </section>

        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Data controls</span>
              <h3>Retention and export defaults</h3>
            </div>
          </div>
          <div className="portal-summary-list">
            <article><span>Retention days</span><strong>{settings.data_controls?.retention_days ?? 0}</strong></article>
            <article><span>Export mode</span><strong>{settings.data_controls?.export_mode ?? "tenant_scoped"}</strong></article>
            <article><span>PII redaction</span><strong>{settings.data_controls?.pii_redaction_enabled ? "Enabled" : "Disabled"}</strong></article>
            <article><span>Local-first sync</span><strong>{settings.data_controls?.local_first_sync ? "Enabled" : "Disabled"}</strong></article>
          </div>
        </section>
      </div>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Auth</span>
            <h3>Provider and session posture</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Return URL</th>
              </tr>
            </thead>
            <tbody>
              {(settings.auth?.providers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>No hosted provider configured yet. Portal is still in mock auth mode.</td>
                </tr>
              ) : (
                (settings.auth?.providers ?? []).map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.label}</td>
                    <td>{provider.kind}</td>
                    <td>{provider.enabled ? "Enabled" : "Disabled"}</td>
                    <td>{provider.return_to}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Integrations</span>
            <h3>Hosted and local integration posture</h3>
          </div>
        </div>
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Integration</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(settings.integrations ?? {}).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value.status ?? "unknown"}</td>
                  <td>{Object.entries(value).filter(([childKey]) => childKey !== "status").map(([childKey, childValue]) => `${childKey}: ${childValue}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-enterprise-panel">
        <div className="portal-enterprise-panel-head">
          <div>
            <span>Repo policy settings</span>
            <h3>Default repository and governance controls</h3>
          </div>
        </div>
        <div className="portal-summary-list">
          {Object.entries(settings.repo_policy_settings ?? {}).map(([key, value]) => (
            <article key={key}>
              <span>{key}</span>
              <strong>{String(value)}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
