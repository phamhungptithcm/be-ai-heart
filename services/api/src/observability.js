import { listAuditEvents, listRequestTraces } from "./storage.js";

const DEFAULT_REQUEST_TRACE_WINDOW_LIMIT = 5000;

export async function summarizeHostedTrafficMetrics({
  serviceStorageRoot,
  since,
} = {}) {
  const traces = await listRequestTraces({
    serviceStorageRoot,
    since,
    limit: DEFAULT_REQUEST_TRACE_WINDOW_LIMIT,
    offset: 0,
  });
  const total = traces.length;
  const durationSum = traces.reduce((sum, trace) => sum + Number(trace.duration_ms ?? 0), 0);
  const routeCounts = new Map();

  for (const trace of traces) {
    const routeKey = `${trace.method} ${trace.route_kind}`;
    routeCounts.set(routeKey, (routeCounts.get(routeKey) ?? 0) + 1);
  }

  return {
    generated_at: new Date().toISOString(),
    window_start: since ?? "",
    total_requests: total,
    status_2xx: traces.filter((trace) => Number(trace.status_code) >= 200 && Number(trace.status_code) < 300).length,
    status_4xx: traces.filter((trace) => Number(trace.status_code) >= 400 && Number(trace.status_code) < 500).length,
    status_5xx: traces.filter((trace) => Number(trace.status_code) >= 500).length,
    rate_limited_requests: traces.filter((trace) => Number(trace.status_code) === 429).length,
    avg_duration_ms: total === 0 ? 0 : Math.round((durationSum / total) * 100) / 100,
    route_breakdown: [...routeCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([route, count]) => ({ route, count })),
  };
}

export async function listOperationalAlerts({
  serviceStorageRoot,
  since,
} = {}) {
  const [traces, auditEvents] = await Promise.all([
    listRequestTraces({
      serviceStorageRoot,
      since,
      limit: DEFAULT_REQUEST_TRACE_WINDOW_LIMIT,
      offset: 0,
    }),
    listAuditEvents({
      serviceStorageRoot,
      searchTerm: "rate_limit",
      limit: DEFAULT_REQUEST_TRACE_WINDOW_LIMIT,
      offset: 0,
    }),
  ]);
  const serverErrors = traces.filter((trace) => Number(trace.status_code) >= 500);
  const rateLimited = traces.filter((trace) => Number(trace.status_code) === 429);
  const authFailures = traces.filter((trace) =>
    ["auth-callback", "auth-authorize", "session-provider"].includes(String(trace.route_kind ?? "")) &&
    Number(trace.status_code) >= 400,
  );
  const alerts = [];

  if (serverErrors.length > 0) {
    alerts.push({
      code: "server_errors_detected",
      severity: "high",
      count: serverErrors.length,
      message: "Hosted traffic includes one or more 5xx responses.",
    });
  }
  if (rateLimited.length > 0 || auditEvents.length > 0) {
    alerts.push({
      code: "rate_limit_pressure",
      severity: "medium",
      count: Math.max(rateLimited.length, auditEvents.length),
      message: "Rate limiting has blocked one or more requests in the current window.",
    });
  }
  if (authFailures.length > 0) {
    alerts.push({
      code: "auth_failures_detected",
      severity: "medium",
      count: authFailures.length,
      message: "Hosted auth routes are returning client or provider failures.",
    });
  }

  return {
    generated_at: new Date().toISOString(),
    window_start: since ?? "",
    alerts,
  };
}

export function renderPrometheusMetrics(summary = {}) {
  const lines = [
    "# HELP be_ai_heart_http_requests_total Total hosted API requests captured in telemetry.",
    "# TYPE be_ai_heart_http_requests_total gauge",
    `be_ai_heart_http_requests_total ${Number(summary.total_requests ?? 0)}`,
    "# HELP be_ai_heart_http_requests_2xx Total successful hosted API requests.",
    "# TYPE be_ai_heart_http_requests_2xx gauge",
    `be_ai_heart_http_requests_2xx ${Number(summary.status_2xx ?? 0)}`,
    "# HELP be_ai_heart_http_requests_4xx Total client-error hosted API requests.",
    "# TYPE be_ai_heart_http_requests_4xx gauge",
    `be_ai_heart_http_requests_4xx ${Number(summary.status_4xx ?? 0)}`,
    "# HELP be_ai_heart_http_requests_5xx Total server-error hosted API requests.",
    "# TYPE be_ai_heart_http_requests_5xx gauge",
    `be_ai_heart_http_requests_5xx ${Number(summary.status_5xx ?? 0)}`,
    "# HELP be_ai_heart_http_requests_rate_limited Total hosted API requests blocked by rate limits.",
    "# TYPE be_ai_heart_http_requests_rate_limited gauge",
    `be_ai_heart_http_requests_rate_limited ${Number(summary.rate_limited_requests ?? 0)}`,
    "# HELP be_ai_heart_http_request_duration_avg_ms Average hosted API request duration in milliseconds.",
    "# TYPE be_ai_heart_http_request_duration_avg_ms gauge",
    `be_ai_heart_http_request_duration_avg_ms ${Number(summary.avg_duration_ms ?? 0)}`,
  ];

  for (const route of summary.route_breakdown ?? []) {
    lines.push(
      `be_ai_heart_http_requests_by_route{route="${escapeMetricLabel(route.route)}"} ${Number(route.count ?? 0)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapeMetricLabel(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
