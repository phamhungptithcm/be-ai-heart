import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { withServiceDatabase } from "./database.js";
import {
  isPostgresStorageEnabled,
  loadObservabilityExportsFromPostgres,
  upsertObservabilityExportInPostgres,
} from "./postgres-repository.js";

const DEFAULT_EXPORT_TIMEOUT_MS = Number(
  process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_TIMEOUT_MS ?? 5000,
);
const DEFAULT_EXPORT_BATCH_SIZE = Number(
  process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_BATCH_SIZE ?? 50,
);

export function resolveObservabilityExportConfig(overrides = {}) {
  return {
    destination:
      String(
        overrides.destination ??
          process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_URL ??
          "",
      ).trim(),
    authHeader:
      String(
        overrides.authHeader ??
          process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_AUTH_HEADER ??
          "Authorization",
      ).trim() || "Authorization",
    authToken: String(
      overrides.authToken ?? process.env.BE_AI_HEART_OBSERVABILITY_EXPORT_AUTH_TOKEN ?? "",
    ).trim(),
    timeoutMs: Number(overrides.timeoutMs ?? DEFAULT_EXPORT_TIMEOUT_MS),
    batchSize: Number(overrides.batchSize ?? DEFAULT_EXPORT_BATCH_SIZE),
  };
}

export function isObservabilityExportEnabled(overrides = {}) {
  return Boolean(resolveObservabilityExportConfig(overrides).destination);
}

export async function queueObservabilityExport({
  serviceStorageRoot,
  category,
  payload,
  destination,
  createdAt,
  exportId,
} = {}) {
  const config = resolveObservabilityExportConfig({ destination });
  if (!config.destination) {
    return null;
  }

  const now = String(createdAt ?? new Date().toISOString());
  const entry = {
    export_id: String(exportId ?? randomUUID()),
    category: String(category ?? "unknown"),
    destination: config.destination,
    status: "pending",
    attempt_count: 0,
    next_attempt_at: now,
    last_attempt_at: "",
    delivered_at: "",
    last_error: "",
    created_at: now,
    updated_at: now,
    payload: payload ?? {},
  };
  await upsertObservabilityExport({
    serviceStorageRoot,
    exportEntry: entry,
  });
  await appendExportMirror(serviceStorageRoot, entry);
  return entry;
}

export async function listObservabilityExports({
  serviceStorageRoot,
  status,
  category,
  limit = 100,
  offset = 0,
  dueBefore,
} = {}) {
  if (isPostgresStorageEnabled()) {
    return loadObservabilityExportsFromPostgres({
      status,
      category,
      limit,
      offset,
      dueBefore,
    });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const clauses = [];
    const values = [];
    if (status) {
      clauses.push("status = ?");
      values.push(String(status));
    }
    if (category) {
      clauses.push("category = ?");
      values.push(String(category));
    }
    if (dueBefore) {
      clauses.push("next_attempt_at <= ?");
      values.push(String(dueBefore));
    }
    const statement = database.prepare(`
      SELECT payload_json
      FROM observability_exports
      ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY created_at ASC, export_id ASC
      LIMIT ?
      OFFSET ?
    `);

    return statement
      .all(...values, Number(limit), Number(offset))
      .map((row) => parsePayload(row.payload_json, null))
      .filter(Boolean);
  });
}

export async function deliverPendingObservabilityExports({
  serviceStorageRoot,
  limit,
  now,
  destination,
  authHeader,
  authToken,
  timeoutMs,
} = {}) {
  const config = resolveObservabilityExportConfig({
    destination,
    authHeader,
    authToken,
    timeoutMs,
  });
  if (!config.destination) {
    return {
      attempted: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const dueBefore = String(now ?? new Date().toISOString());
  const exports = await listObservabilityExports({
    serviceStorageRoot,
    status: "pending",
    dueBefore,
    limit: Number(limit ?? config.batchSize),
    offset: 0,
  });
  let delivered = 0;
  let failed = 0;

  for (const entry of exports) {
    const attemptStartedAt = new Date().toISOString();
    try {
      const response = await fetch(config.destination, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(config.authToken ? { [config.authHeader]: config.authToken } : {}),
        },
        body: JSON.stringify({
          category: entry.category,
          export_id: entry.export_id,
          created_at: entry.created_at,
          payload: entry.payload ?? {},
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Observability export failed with status ${response.status}.`);
      }

      delivered += 1;
      await upsertObservabilityExport({
        serviceStorageRoot,
        exportEntry: {
          ...entry,
          status: "delivered",
          attempt_count: Number(entry.attempt_count ?? 0) + 1,
          last_attempt_at: attemptStartedAt,
          delivered_at: attemptStartedAt,
          last_error: "",
          updated_at: attemptStartedAt,
        },
      });
    } catch (error) {
      failed += 1;
      await upsertObservabilityExport({
        serviceStorageRoot,
        exportEntry: {
          ...entry,
          status: "pending",
          attempt_count: Number(entry.attempt_count ?? 0) + 1,
          last_attempt_at: attemptStartedAt,
          delivered_at: "",
          last_error: error?.message || "Observability export failed.",
          next_attempt_at: computeNextAttemptAt(attemptStartedAt, Number(entry.attempt_count ?? 0) + 1),
          updated_at: attemptStartedAt,
        },
      });
    }
  }

  return {
    attempted: exports.length,
    delivered,
    failed,
    skipped: 0,
  };
}

async function upsertObservabilityExport({ serviceStorageRoot, exportEntry } = {}) {
  const normalized = {
    export_id: String(exportEntry.export_id ?? randomUUID()),
    category: String(exportEntry.category ?? "unknown"),
    destination: String(exportEntry.destination ?? ""),
    status: String(exportEntry.status ?? "pending"),
    attempt_count: Number(exportEntry.attempt_count ?? 0),
    next_attempt_at: String(exportEntry.next_attempt_at ?? new Date().toISOString()),
    last_attempt_at: String(exportEntry.last_attempt_at ?? ""),
    delivered_at: String(exportEntry.delivered_at ?? ""),
    last_error: String(exportEntry.last_error ?? ""),
    created_at: String(exportEntry.created_at ?? new Date().toISOString()),
    updated_at: String(exportEntry.updated_at ?? new Date().toISOString()),
    payload: exportEntry.payload ?? {},
  };

  if (isPostgresStorageEnabled()) {
    await upsertObservabilityExportInPostgres({
      exportEntry: normalized,
    });
    return normalized;
  }

  withServiceDatabase(serviceStorageRoot, (database) => {
    database
      .prepare(`
        INSERT INTO observability_exports (
          export_id,
          category,
          destination,
          status,
          attempt_count,
          next_attempt_at,
          last_attempt_at,
          delivered_at,
          last_error,
          created_at,
          updated_at,
          payload_json
        )
        VALUES (
          :export_id,
          :category,
          :destination,
          :status,
          :attempt_count,
          :next_attempt_at,
          :last_attempt_at,
          :delivered_at,
          :last_error,
          :created_at,
          :updated_at,
          :payload_json
        )
        ON CONFLICT(export_id) DO UPDATE SET
          category = excluded.category,
          destination = excluded.destination,
          status = excluded.status,
          attempt_count = excluded.attempt_count,
          next_attempt_at = excluded.next_attempt_at,
          last_attempt_at = excluded.last_attempt_at,
          delivered_at = excluded.delivered_at,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at,
          payload_json = excluded.payload_json
      `)
      .run({
        export_id: normalized.export_id,
        category: normalized.category,
        destination: normalized.destination,
        status: normalized.status,
        attempt_count: normalized.attempt_count,
        next_attempt_at: normalized.next_attempt_at,
        last_attempt_at: normalized.last_attempt_at || null,
        delivered_at: normalized.delivered_at || null,
        last_error: normalized.last_error || null,
        created_at: normalized.created_at,
        updated_at: normalized.updated_at,
        payload_json: JSON.stringify(normalized),
      });
  });

  return normalized;
}

async function appendExportMirror(serviceStorageRoot, exportEntry) {
  const telemetryRoot = path.join(path.resolve(serviceStorageRoot), "telemetry");
  await fs.mkdir(telemetryRoot, { recursive: true });
  await fs.appendFile(
    path.join(telemetryRoot, "exports.ndjson"),
    `${JSON.stringify(exportEntry)}\n`,
    "utf8",
  );
}

function computeNextAttemptAt(now, attemptCount) {
  const nextDate = new Date(now);
  nextDate.setSeconds(
    nextDate.getSeconds() + Math.min(300, Math.max(5, 5 * 2 ** Math.max(0, attemptCount - 1))),
  );
  return nextDate.toISOString();
}

function parsePayload(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
