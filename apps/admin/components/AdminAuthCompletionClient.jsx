"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  clearAdminSessionToken,
  establishAdminCookieSession,
  getAdminApiBaseUrl,
  setAdminSessionToken,
} from "../src/api-client.js";

export function AdminAuthCompletionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Finishing internal sign-in...");

  useEffect(() => {
    const sessionToken = searchParams.get("session_token");
    const sessionEstablished = searchParams.get("session_established");
    const authError = searchParams.get("auth_error");
    const authErrorDescription = searchParams.get("auth_error_description");

    if (authError) {
      clearAdminSessionToken();
      setStatus(authErrorDescription || authError);
      return;
    }

    let cancelled = false;
    let timer;

    const finalize = async () => {
      if (sessionEstablished === "1") {
        try {
          const response = await fetch(new URL("/api/admin/session", getAdminApiBaseUrl()), {
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
            credentials: "include",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.session) {
            throw new Error(payload?.error || "Admin session could not be resolved from the API cookie.");
          }

          if (cancelled) {
            return;
          }

          establishAdminCookieSession(payload.session);
          setStatus("Internal session established. Redirecting to admin...");
        } catch (error) {
          if (cancelled) {
            return;
          }

          clearAdminSessionToken();
          setStatus(error.message || "Internal session could not be established.");
          return;
        }
      } else if (sessionToken) {
        setAdminSessionToken(sessionToken);
        setStatus("Internal session established. Redirecting to admin...");
      } else {
        setStatus("Session was not established by the API host.");
        return;
      }

      timer = window.setTimeout(() => {
        router.replace("/");
      }, 400);
    };

    finalize();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [router, searchParams]);

  return <p className="admin-empty">{status}</p>;
}

