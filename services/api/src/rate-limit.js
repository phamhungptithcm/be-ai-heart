import { createHash } from "node:crypto";

import { consumeRateLimitWindow, pruneExpiredRateLimits } from "./storage.js";

const PRUNE_INTERVAL_MS = 60 * 1000;
const LAST_PRUNE_BY_STORAGE = new Map();

export async function consumeRequestRateLimit({
  serviceStorageRoot,
  namespace,
  routeKind,
  surface,
  clientKey,
  windowMs,
  max,
} = {}) {
  const now = Date.now();
  const windowStartedAt = new Date(now).toISOString();
  const resetAt = new Date(now + Number(windowMs ?? 0)).toISOString();
  const limiterKey = createHash("sha256")
    .update(
      `${String(namespace ?? "default")}:${String(routeKind ?? "unknown")}:${String(surface ?? "")}:${String(clientKey ?? "")}`,
      "utf8",
    )
    .digest("hex");

  await maybePruneExpiredRateLimits(serviceStorageRoot, now);
  const windowState = await consumeRateLimitWindow({
    serviceStorageRoot,
    limiterKey,
    routeKind,
    surface,
    windowStartedAt,
    resetAt,
  });
  const count = Number(windowState?.count ?? 0);
  const effectiveResetAt = String(windowState?.reset_at ?? resetAt);

  return {
    limited: count > Number(max ?? 0),
    count,
    reset_at: effectiveResetAt,
    retry_after_seconds: Math.max(
      1,
      Math.ceil((new Date(effectiveResetAt).getTime() - now) / 1000),
    ),
  };
}

async function maybePruneExpiredRateLimits(serviceStorageRoot, nowMs) {
  const storageKey = String(serviceStorageRoot ?? "");
  const lastPrunedAt = LAST_PRUNE_BY_STORAGE.get(storageKey) ?? 0;
  if (nowMs - lastPrunedAt < PRUNE_INTERVAL_MS) {
    return;
  }

  LAST_PRUNE_BY_STORAGE.set(storageKey, nowMs);
  await pruneExpiredRateLimits({
    serviceStorageRoot,
    now: new Date(nowMs).toISOString(),
  });
}
