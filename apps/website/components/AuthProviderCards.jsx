"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getApiBaseUrl() {
  const raw = String(process.env.NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010").trim();
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function getPortalReturnTo() {
  return new URL(
    "/auth/complete",
    String(process.env.NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001"),
  ).toString();
}

function getAdminReturnTo() {
  return new URL(
    "/auth/complete",
    String(process.env.NEXT_PUBLIC_BE_AI_HEART_ADMIN_BASE_URL ?? "http://127.0.0.1:3002"),
  ).toString();
}

export function AuthProviderCards({ surface = "portal" }) {
  const [state, setState] = useState({
    status: "loading",
    providers: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const url = new URL("/api/auth/providers", getApiBaseUrl());
        url.searchParams.set("surface", surface);
        url.searchParams.set(
          "return_to",
          surface === "admin" ? getAdminReturnTo() : getPortalReturnTo(),
        );
        const response = await fetch(url, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load auth providers.");
        }

        if (active) {
          setState({
            status: "ready",
            providers: payload.providers ?? [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            status: "error",
            providers: [],
            error: error.message,
          });
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [surface]);

  if (state.status !== "ready") {
    return (
      <div className="provider-grid">
        <div className={`provider-card ${state.status === "loading" ? "provider-card-loading" : ""}`} aria-busy={state.status === "loading"}>
          <h3>{state.status === "error" ? "Auth unavailable" : "Loading providers"}</h3>
          <p>{state.status === "error" ? state.error : "Checking which hosted login providers are configured."}</p>
        </div>
      </div>
    );
  }

  if (state.providers.length === 0) {
    return (
      <div className="provider-grid">
        <div className="provider-card">
          <h3>No provider configured yet</h3>
          <p>Set Auth0 or Clerk OIDC environment variables on the API host to enable hosted sign-in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="provider-grid">
      {state.providers.map((provider) => (
        <div key={provider.id} className="provider-card">
          <span className="provider-chip">{provider.kind}</span>
          <h3>{provider.label}</h3>
          <p>{provider.description}</p>
          <Link href={provider.authorize_url} className="provider-link">
            {provider.action_label ?? `Continue with ${provider.id}`}
          </Link>
        </div>
      ))}
    </div>
  );
}
