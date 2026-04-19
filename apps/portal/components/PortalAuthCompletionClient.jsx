"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { clearPortalSessionToken, setPortalSessionToken } from "../src/api-client.js";

export function PortalAuthCompletionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Finishing sign-in...");

  useEffect(() => {
    const sessionToken = searchParams.get("session_token");
    const authError = searchParams.get("auth_error");
    const authErrorDescription = searchParams.get("auth_error_description");

    if (authError) {
      clearPortalSessionToken();
      setStatus(authErrorDescription || authError);
      return;
    }

    if (!sessionToken) {
      setStatus("Session token was not provided by the API host.");
      return;
    }

    setPortalSessionToken(sessionToken);
    setStatus("Session established. Redirecting to portal...");
    const timer = window.setTimeout(() => {
      router.replace("/");
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, searchParams]);

  return <p className="portal-empty">{status}</p>;
}
