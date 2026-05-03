"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { postPortalJson } from "../src/api-client.js";
import { usePortalResource } from "../src/use-portal-resource.js";
import { PortalStateBlock } from "./PortalStateBlock.jsx";

export function PortalSettingsClient() {
  const settingsState = usePortalResource("/api/settings");
  const [apiKeyState, setApiKeyState] = useState({
    status: "idle",
    payload: null,
    error: "",
  });
  const [cliLoginRequest, setCliLoginRequest] = useState(null);
  const cliLoginStartedRef = useRef(false);
  const settings = settingsState.data ?? {};

  const createCliApiKey = useCallback(async ({ request } = {}) => {
    setApiKeyState({
      status: "creating",
      payload: null,
      error: "",
    });
    try {
      const payload = await postPortalJson("/api/api-keys", {
        label: request ? "CLI browser login key" : "CLI sync key",
        expires_in_days: 90,
      });
      setApiKeyState({
        status: "ready",
        payload,
        error: "",
      });

      if (request) {
        submitCliLoginCallback({
          callbackUrl: request.callbackUrl,
          state: request.state,
          apiKey: payload.api_key,
          apiUrl: request.apiUrl,
        });
      }
    } catch (error) {
      setApiKeyState({
        status: "error",
        payload: null,
        error: error.message,
      });
    }
  }, []);

  useEffect(() => {
    setCliLoginRequest(readCliLoginRequest());
  }, []);

  useEffect(() => {
    if (settingsState.status !== "ready" || !cliLoginRequest?.valid || cliLoginStartedRef.current) {
      return;
    }

    if (!markCliLoginStarted(cliLoginRequest.state)) {
      return;
    }

    cliLoginStartedRef.current = true;
    createCliApiKey({ request: cliLoginRequest });
  }, [cliLoginRequest, createCliApiKey, settingsState.status]);

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

  const hostedApiBaseUrl = settings.integrations?.hosted_api?.base_url ?? "";
  const cliApiKey = apiKeyState.payload?.api_key ?? "";
  const manualLoginCommand = cliApiKey
    ? formatApiKeyCommand(apiKeyState.payload.command, cliApiKey)
    : "";
  const selfHostedLoginCommand = cliApiKey
    ? formatApiKeyCommand(apiKeyState.payload.self_hosted_command, cliApiKey)
    : "";

  return (
    <div className="portal-enterprise-stack">
      <div className="portal-enterprise-split">
        <section className="portal-enterprise-panel">
          <div className="portal-enterprise-panel-head">
            <div>
              <span>Organization</span>
              <h3>Org profile</h3>
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
              <h3>Retention</h3>
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
            <h3>Auth providers</h3>
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
            <span>CLI access</span>
            <h3>API keys for local sync</h3>
          </div>
          <button className="portal-button" type="button" onClick={() => createCliApiKey()} disabled={apiKeyState.status === "creating"}>
            {apiKeyState.status === "creating" ? "Creating..." : "Create API key"}
          </button>
        </div>
        {cliLoginRequest?.valid ? (
          <p className="portal-empty">
            Completing BeHeart CLI login. Keep this tab open until the terminal reports authentication.
          </p>
        ) : null}
        {cliLoginRequest && !cliLoginRequest.valid ? (
          <p className="portal-empty">CLI login callback was not accepted: {cliLoginRequest.error}</p>
        ) : null}
        <div className="portal-summary-list">
          <article>
            <span>Install</span>
            <strong>npm install -g beheart</strong>
          </article>
          <article>
            <span>Login</span>
            <strong>heart login</strong>
          </article>
          <article>
            <span>Manual key</span>
            <strong>heart login --api-key={"<key>"}</strong>
          </article>
        </div>
        {apiKeyState.status === "error" ? (
          <p className="portal-empty">API key could not be created: {apiKeyState.error}</p>
        ) : null}
        {apiKeyState.payload?.api_key ? (
          <div className="portal-command-panel">
            <span>One-time API key</span>
            <pre>{apiKeyState.payload.api_key}</pre>
            <span>CLI command</span>
            <pre>{manualLoginCommand}</pre>
            {hostedApiBaseUrl && selfHostedLoginCommand && selfHostedLoginCommand !== manualLoginCommand ? (
              <>
                <span>Local or self-hosted API override</span>
                <pre>{selfHostedLoginCommand}</pre>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="portal-data-table-shell">
          <table className="portal-data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Workspace</th>
                <th>Status</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {(settings.auth?.cli_api_keys ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4}>No CLI API keys are visible yet.</td>
                </tr>
              ) : (
                (settings.auth?.cli_api_keys ?? []).map((key) => (
                  <tr key={key.key_id}>
                    <td>{key.label}</td>
                    <td>{key.workspace_slug || "tenant"}</td>
                    <td>{key.status}</td>
                    <td>{formatTimestamp(key.expires_at)}</td>
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
            <h3>Integrations</h3>
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
            <h3>Defaults</h3>
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

function readCliLoginRequest() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const callbackUrl = String(params.get("cli_callback") ?? "").trim();
  const state = String(params.get("cli_state") ?? "").trim();
  const apiUrl = String(params.get("cli_api_url") ?? "").trim();

  if (!callbackUrl && !state) {
    return null;
  }

  if (!isSafeLoopbackCallback(callbackUrl)) {
    return {
      valid: false,
      error: "callback must use http://127.0.0.1, http://localhost, or http://[::1]",
    };
  }

  if (state.length < 8) {
    return {
      valid: false,
      error: "missing CLI state token",
    };
  }

  return {
    valid: true,
    callbackUrl,
    state,
    apiUrl,
  };
}

function isSafeLoopbackCallback(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.pathname === "/callback"
    );
  } catch {
    return false;
  }
}

function submitCliLoginCallback({ callbackUrl, state, apiKey, apiUrl }) {
  if (typeof document === "undefined") {
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = callbackUrl;
  form.style.display = "none";
  appendHiddenInput(form, "state", state);
  appendHiddenInput(form, "api_key", apiKey);
  appendHiddenInput(form, "api_url", apiUrl);
  document.body.appendChild(form);
  form.submit();
}

function markCliLoginStarted(state) {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const key = `beheart-cli-login-${state}`;
    if (window.sessionStorage.getItem(key) === "started") {
      return false;
    }
    window.sessionStorage.setItem(key, "started");
  } catch {
    return true;
  }
  return true;
}

function appendHiddenInput(form, name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

function formatApiKeyCommand(template, apiKey) {
  const command = template || "heart login --api-key=<api-key>";
  return command.replace("<api-key>", apiKey);
}

function formatTimestamp(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}
