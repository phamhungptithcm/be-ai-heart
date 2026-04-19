"use client";

import { useEffect, useState } from "react";
import { fetchPortalJson } from "./api-client.js";

export function usePortalResource(resourcePath, options = {}) {
  const {
    pollMs = 30_000,
    allowMissing = false,
    enabled = true,
  } = options;
  const [state, setState] = useState({
    status: enabled ? "loading" : "idle",
    data: null,
    error: "",
    lastLoadedAt: "",
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        status: "idle",
        data: null,
        error: "",
        lastLoadedAt: "",
      });
      return undefined;
    }

    let active = true;

    async function load() {
      try {
        const payload = await fetchPortalJson(resourcePath, { allowMissing });
        if (!active) {
          return;
        }
        setState({
          status: "ready",
          data: payload,
          error: "",
          lastLoadedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setState({
          status: "error",
          data: null,
          error: error.message,
          lastLoadedAt: "",
        });
      }
    }

    load();
    const timer = pollMs > 0 ? setInterval(load, pollMs) : null;

    return () => {
      active = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [allowMissing, enabled, pollMs, resourcePath]);

  return state;
}
