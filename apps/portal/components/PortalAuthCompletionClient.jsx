"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  clearPortalSessionToken,
  establishPortalCookieSession,
  getPortalApiBaseUrl,
  setPortalSessionToken,
} from "../src/api-client.js";

export function PortalAuthCompletionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in...");

  useEffect(() => {
    const sessionToken = searchParams.get("session_token");
    const sessionEstablished = searchParams.get("session_established");
    const authError = searchParams.get("auth_error");
    const authErrorDescription = searchParams.get("auth_error_description");

    if (authError) {
      clearPortalSessionToken();
      setStatus(authErrorDescription || authError);
      return;
    }

    let cancelled = false;
    let timer;

    const finalize = async () => {
      if (sessionEstablished === "1") {
        try {
          const response = await fetch(new URL("/api/session", getPortalApiBaseUrl()), {
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
            credentials: "include",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.session) {
            throw new Error(payload?.error || "Hosted session could not be resolved from the API cookie.");
          }

          if (cancelled) {
            return;
          }

          establishPortalCookieSession(payload.session);
          setStatus("Session established. Redirecting to portal...");
        } catch (error) {
          if (cancelled) {
            return;
          }

          clearPortalSessionToken();
          setStatus(error.message || "Hosted session could not be established.");
          return;
        }
      } else if (sessionToken) {
        setPortalSessionToken(sessionToken);
        setStatus("Session established. Redirecting to portal...");
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

  return <p className="portal-empty">{status}</p>;
}
