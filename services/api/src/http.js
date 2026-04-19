import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleOpenAiCompatibleProxyRoute } from "./llm-proxy.js";
import { writeWebDocumentSubmission } from "../../../packages/document-sync/src/index.js";
import {
  ADMIN_PERMISSIONS,
  PORTAL_PERMISSIONS,
  actorHasPermission,
  resolveActorAccess,
} from "../../../packages/shared-schema/src/enterprise.js";
import {
  buildDefaultPortalAuthLinks,
  completeProviderAuthorization,
  createProviderAuthorizationRequest,
  createWebsiteIntakeRequest,
  deliverPendingObservabilityExports,
  issueProviderWorkspaceSession,
  issueWorkspaceSession,
  listAccessibleRepositoryProfilesPage,
  listAccessibleWorkspacesPage,
  listAuditEvents,
  listConfiguredAuthProviders,
  loadPortalAccountView,
  loadAdminBillingOpsView,
  loadAdminCustomerInventoryView,
  loadAdminOverviewView,
  loadPortalBillingSnapshot,
  loadPortalMembersView,
  loadPortalOverviewSummary,
  loadPortalPoliciesView,
  loadPortalSecurityView,
  loadPortalSettingsView,
  loadPortalUsageSummary,
  loadWorkspaceBenchmarkLaunchDetail,
  listOperationalAlerts,
  listWorkspaceBenchmarkLaunches,
  listObservabilityExports,
  listRequestTraces,
  listWorkspaceSessions,
  listWebsiteIntakeRequestsPage,
  loadAccessibleBenchmarkIndexPage,
  loadAccessibleBenchmarkReport,
  loadAccessibleDocumentsView,
  loadAccessibleRepositoryView,
  provisionWorkspaceForActor,
  queueObservabilityExport,
  requestWorkspaceBenchmarkLaunch,
  renderPrometheusMetrics,
  resolveAllowedReturnTo,
  resolveHostedAuthProvider,
  resolveRequestAuthContext,
  resolveWorkspaceBenchmarkRunnerCapability,
  resolveServiceStorageRoot,
  revokeWorkspaceSessions,
  rotateWorkspaceSession,
  summarizeWebsiteIntakeRequestsByQuery,
  summarizeHostedTrafficMetrics,
  writeAuditEvent,
  writeRequestTrace,
  writeBenchmarkReportForActor,
  writeRepositoryDocumentsForActor,
  writeRepositoryProfileForActor,
} from "./index.js";
import { consumeRequestRateLimit } from "./rate-limit.js";

const DEFAULT_REQUEST_LIMITS = Object.freeze({
  session: 16 * 1024,
  providerSession: 64 * 1024,
  publicIntake: 32 * 1024,
  workspaceWrite: 64 * 1024,
  profileWrite: 2 * 1024 * 1024,
  documentWrite: 2 * 1024 * 1024,
  documentSubmission: 128 * 1024,
  benchmarkWrite: 2 * 1024 * 1024,
  llmProxy: 8 * 1024 * 1024,
});
const DEFAULT_RATE_LIMITS = Object.freeze({
  "auth-providers": { windowMs: 60 * 1000, max: 60 },
  "auth-authorize": { windowMs: 60 * 1000, max: 30 },
  "auth-callback": { windowMs: 60 * 1000, max: 30 },
  "session-provider": { windowMs: 60 * 1000, max: 20 },
  "public-intake": { windowMs: 10 * 60 * 1000, max: 5 },
  "llm-proxy": { windowMs: 60 * 1000, max: 600 },
});
const DEFAULT_PAGINATION = Object.freeze({
  defaultLimit: 50,
  maxLimit: 100,
});

export async function handleServiceHttpRequest(request, options = {}) {
  const config = resolveHttpConfig(options);
  const requestUrl = new URL(request.url);
  const route = matchRoute(requestUrl.pathname);
  const startedAtMs = Date.now();
  let response;

  try {
    if (request.method === "OPTIONS") {
      response = new Response(null, { status: 204 });
    } else if (!route) {
      response = jsonResponse({ error: "Route not found." }, { status: 404 });
    } else {
      const rateLimitResult = await consumeRateLimitForRoute({
        request,
        route,
        config,
      });
      if (rateLimitResult?.limited) {
        try {
          await writeAuditEvent({
            serviceStorageRoot: config.serviceStorageRoot,
            event: {
              action: "rate_limit.exceeded",
              outcome: "blocked",
              surface: route.surface ?? "public",
              target_type: "http_route",
              target_id: route.kind,
              metadata: {
                method: request.method,
                path: requestUrl.pathname,
              },
            },
          });
        } catch {
          // Do not block the request path if telemetry storage is unavailable.
        }
        response = jsonResponse(
          {
            error: "Rate limit exceeded. Please retry after the current window resets.",
          },
          {
            status: 429,
            headers: rateLimitResult.headers,
          },
        );
      } else {
        switch (route.kind) {
          case "health":
            response = jsonResponse({
              service: "beheart-api",
              status: "ok",
              storage_backend: process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND ?? "sqlite",
            });
            break;
          case "metrics": {
            const summary = await summarizeHostedTrafficMetrics({
              serviceStorageRoot: config.serviceStorageRoot,
              since: resolveObservabilityWindowStart(requestUrl, config),
            });
            response = new Response(renderPrometheusMetrics(summary), {
              status: 200,
              headers: {
                "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
                "X-Content-Type-Options": "nosniff",
              },
            });
            break;
          }
          case "auth-providers":
            response = handleAuthProvidersRoute(requestUrl, config);
            break;
          case "auth-authorize":
            response = await handleAuthorizeRoute(requestUrl, config, route.providerId);
            break;
          case "auth-callback":
            response = await handleAuthCallbackRoute(requestUrl, config, route.providerId, request);
            break;
          case "session":
            response = await handleSessionRoute(request, config, route.surface);
            break;
          case "portal-account":
            response = await handlePortalAccountRoute(request, config);
            break;
          case "portal-overview":
            response = await handlePortalOverviewRoute(request, config);
            break;
          case "portal-usage-summary":
            response = await handlePortalUsageSummaryRoute(request, config);
            break;
          case "portal-billing":
            response = await handlePortalBillingRoute(request, config);
            break;
          case "portal-members":
            response = await handlePortalMembersRoute(request, config);
            break;
          case "portal-policies":
            response = await handlePortalPoliciesRoute(request, config);
            break;
          case "portal-security":
            response = await handlePortalSecurityRoute(request, config);
            break;
          case "portal-settings":
            response = await handlePortalSettingsRoute(request, config);
            break;
          case "portal-sessions":
            response = await handlePortalSessionsRoute(request, config);
            break;
          case "portal-audit-events":
            response = await handlePortalAuditEventsRoute(request, config);
            break;
          case "public-intake":
            response = await handlePublicIntakeRoute(request, config);
            break;
          case "admin-intake":
            response = await handleAdminIntakeRoute(request, config);
            break;
          case "admin-overview":
            response = await handleAdminOverviewRoute(request, config);
            break;
          case "admin-customer-inventory":
            response = await handleAdminCustomerInventoryRoute(request, config);
            break;
          case "admin-billing-ops":
            response = await handleAdminBillingOpsRoute(request, config);
            break;
          case "session-provider":
            response = await handleProviderSessionRoute(request, config, route.surface);
            break;
          case "workspaces":
            response = await handleWorkspacesRoute(request, config, route.surface);
            break;
          case "repositories":
            response = await handleRepositoriesRoute(request, config, route.surface);
            break;
          case "repository-detail":
            response = await handleRepositoryDetailRoute(request, config, route.surface, route.slug);
            break;
          case "documents":
            response = await handleDocumentsRoute(request, config, route.surface);
            break;
          case "document-submissions":
            response = await handleDocumentSubmissionsRoute(request, config, route.surface);
            break;
          case "benchmarks":
            response = await handleBenchmarksRoute(request, config, route.surface);
            break;
          case "benchmark-runs":
            response = await handleBenchmarkRunsRoute(request, config, route.surface);
            break;
          case "benchmark-detail":
            response = await handleBenchmarkDetailRoute(request, config, route.surface, route.reportId);
            break;
          case "benchmark-run-detail":
            response = await handleBenchmarkRunDetailRoute(request, config, route.surface, route.launchId);
            break;
          case "llm-proxy":
            response = await handleOpenAiCompatibleProxyRoute(request, config, route);
            break;
          case "admin-audit-events":
            response = await handleAdminAuditEventsRoute(request, config);
            break;
          case "admin-sessions":
            response = await handleAdminSessionsRoute(request, config);
            break;
          case "admin-observability-requests":
            response = await handleAdminObservabilityRequestsRoute(request, config);
            break;
          case "admin-observability-metrics":
            response = await handleAdminObservabilityMetricsRoute(request, config);
            break;
          case "admin-observability-alerts":
            response = await handleAdminObservabilityAlertsRoute(request, config);
            break;
          case "admin-observability-exports":
            response = await handleAdminObservabilityExportsRoute(request, config);
            break;
          default:
            response = jsonResponse({ error: "Route not implemented." }, { status: 404 });
            break;
        }
      }
    }
  } catch (error) {
    response = errorResponse(error, "Service request failed.");
  }

  const corsResponse = withCors(response, request, config);
  try {
    await writeRequestTraceForResponse({
      config,
      serviceStorageRoot: config.serviceStorageRoot,
      request,
      route,
      response: corsResponse,
      startedAtMs,
    });
  } catch {
    // Keep hosted traffic available even if request telemetry storage is degraded.
  }

  return corsResponse;
}

export function resolveHttpConfig(options = {}) {
  const defaultMonorepoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  );
  const monorepoRoot =
    options.monorepoRoot ??
    process.env.BE_AI_HEART_MONOREPO_ROOT ??
    defaultMonorepoRoot;

  return {
    monorepoRoot,
    serviceStorageRoot: resolveServiceStorageRoot({
      serviceStorageRoot:
        options.serviceStorageRoot ?? process.env.BE_AI_HEART_SERVICE_STORAGE_ROOT,
      monorepoRoot,
    }),
    portalRoot:
      options.portalRoot ??
      process.env.BE_AI_HEART_PORTAL_APP_ROOT ??
      path.join(monorepoRoot, "apps", "portal"),
    adminRoot:
      options.adminRoot ??
      process.env.BE_AI_HEART_ADMIN_APP_ROOT ??
      path.join(monorepoRoot, "apps", "admin"),
    apiBaseUrl:
      options.apiBaseUrl ??
      process.env.BE_AI_HEART_API_BASE_URL ??
      `http://127.0.0.1:${Number(process.env.PORT ?? process.env.BE_AI_HEART_API_PORT ?? 4010)}`,
    requestLimits: {
      ...DEFAULT_REQUEST_LIMITS,
      ...(options.requestLimits ?? {}),
    },
    maxRequestBodyBytes:
      options.maxRequestBodyBytes ??
      Math.max(...Object.values({ ...DEFAULT_REQUEST_LIMITS, ...(options.requestLimits ?? {}) })),
    rateLimits: {
      ...DEFAULT_RATE_LIMITS,
      ...(options.rateLimits ?? {}),
      namespace: String(
        options.rateLimits?.namespace ??
          process.env.BE_AI_HEART_RATE_LIMIT_NAMESPACE ??
          "default",
      ),
    },
    pagination: {
      defaultLimit: normalizePaginationLimit(
        options.pagination?.defaultLimit ??
          process.env.BE_AI_HEART_API_DEFAULT_PAGE_LIMIT ??
          DEFAULT_PAGINATION.defaultLimit,
        DEFAULT_PAGINATION.defaultLimit,
      ),
      maxLimit: normalizePaginationLimit(
        options.pagination?.maxLimit ??
          process.env.BE_AI_HEART_API_MAX_PAGE_LIMIT ??
          DEFAULT_PAGINATION.maxLimit,
          DEFAULT_PAGINATION.maxLimit,
      ),
    },
    observability: {
      defaultWindowMinutes: Number(
        options.observability?.defaultWindowMinutes ??
          process.env.BE_AI_HEART_OBSERVABILITY_WINDOW_MINUTES ??
          60,
      ),
    },
    sessionSecurity: {
      cookieName: String(
        options.sessionSecurity?.cookieName ??
          process.env.BE_AI_HEART_SESSION_COOKIE_NAME ??
          "be_ai_heart_session",
      ),
      sameSite: String(
        options.sessionSecurity?.sameSite ??
          process.env.BE_AI_HEART_SESSION_COOKIE_SAME_SITE ??
          "Lax",
      ),
      rotationMinutes: Number(
        options.sessionSecurity?.rotationMinutes ??
          process.env.BE_AI_HEART_SESSION_ROTATION_MINUTES ??
          30,
      ),
      csrfHeaderName: String(
        options.sessionSecurity?.csrfHeaderName ??
          process.env.BE_AI_HEART_CSRF_HEADER_NAME ??
          "x-be-ai-heart-csrf",
      ),
    },
  };
}

function handleAuthProvidersRoute(requestUrl, config) {
  const surface = requestUrl.searchParams.get("surface") ?? "portal";
  const returnTo = resolveAllowedReturnTo({
    surface,
    returnTo: requestUrl.searchParams.get("return_to"),
  });

  return jsonResponse({
    ...listConfiguredAuthProviders({
      apiBaseUrl: config.apiBaseUrl,
      surface,
      returnTo,
    }),
    ...buildDefaultPortalAuthLinks({
      apiBaseUrl: config.apiBaseUrl,
    }),
  });
}

async function handleAuthorizeRoute(requestUrl, config, providerId) {
  const result = await createProviderAuthorizationRequest({
    serviceStorageRoot: config.serviceStorageRoot,
    providerId,
    surface: requestUrl.searchParams.get("surface") ?? "portal",
    workspaceSlug: requestUrl.searchParams.get("workspace"),
    customerSlug: requestUrl.searchParams.get("customer"),
    returnTo: requestUrl.searchParams.get("return_to"),
    apiBaseUrl: config.apiBaseUrl,
  });

  return Response.redirect(result.authorize_url, 302);
}

async function handleAuthCallbackRoute(requestUrl, config, providerId, request) {
  const result = await completeProviderAuthorization({
    serviceStorageRoot: config.serviceStorageRoot,
    providerId,
    requestUrl,
    apiBaseUrl: config.apiBaseUrl,
  });
  let response = Response.redirect(result.redirect_url, 302);
  if (result.session) {
    response = withSessionCookies(response, {
      session: result.session,
      request,
      config,
    });
  }

  return response;
}

async function handleSessionRoute(request, config, surface) {
  let authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (request.method === "GET") {
    let session = authContext.session;
    if (shouldRotateSession(authContext.session, config)) {
      session = (await rotateCurrentSession(authContext, config)) ?? session;
      authContext = {
        ...authContext,
        session,
        session_token: session?.session_token ?? authContext.session_token,
      };
    }

    return withSessionCookies(
      jsonResponse({
        actor: authContext.actor,
        session: toClientSession(session, {
          includeToken: authContext.session_source !== "cookie",
        }),
        workspace: authContext.workspace,
        workspace_identity: authContext.workspace_identity,
        workspace_count: authContext.workspaces.length,
      }),
      {
        session,
        request,
        config,
      },
    );
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.session,
    });
    const session = await issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: authContext.actor.actor_slug,
      surface,
      workspaceSlug: payload.workspace_slug ?? authContext.workspace_slug,
      customerSlug: payload.customer_slug ?? authContext.customer_slug,
      sessionToken: payload.session_token,
      metadata: {
        source: `${surface}-api-session`,
      },
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "auth.session_issued",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: session.workspace_slug,
        customer_slug: session.customer_slug,
        customer_id: session.customer_id,
        target_type: "session",
        target_id: session.session_id,
        metadata: {
          source: "http-session-route",
          session_family_id: session.session_family_id,
        },
      },
    });

    return withSessionCookies(
      jsonResponse(
        {
          session: toClientSession(session, {
            includeToken: authContext.session_source !== "cookie",
          }),
        },
        { status: 201 },
      ),
      {
        session,
        request,
        config,
      },
    );
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handlePortalAccountRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.overviewRead);
  const payload = await loadPortalAccountView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalOverviewRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.overviewRead);
  const payload = await loadPortalOverviewSummary({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalUsageSummaryRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.usageRead);
  const requestUrl = new URL(request.url);
  const payload = await loadPortalUsageSummary({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
    windowDays: Number(requestUrl.searchParams.get("window_days") ?? 30),
  });
  return jsonResponse(payload);
}

async function handlePortalBillingRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.billingRead);
  const payload = await loadPortalBillingSnapshot({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalMembersRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.membersRead);
  const payload = await loadPortalMembersView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalPoliciesRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.policiesRead);
  const payload = await loadPortalPoliciesView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalSecurityRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.securityRead);
  const payload = await loadPortalSecurityView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalSettingsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.settingsRead);
  const payload = await loadPortalSettingsView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
    apiBaseUrl: config.apiBaseUrl,
  });
  return jsonResponse(payload);
}

async function handlePortalSessionsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.sessionsRead);
  const requestUrl = new URL(request.url);
  const pagination = resolvePagination(requestUrl, config.pagination);
  const sessions = await listWorkspaceSessions({
      serviceStorageRoot: config.serviceStorageRoot,
      surface: "portal",
      workspaceSlug: requestUrl.searchParams.get("workspace_slug") ?? undefined,
      customerSlug: authContext.customer_slug,
    includeRevoked: requestUrl.searchParams.get("include_revoked") === "1",
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return jsonResponse({
    schema_version: 1,
    sessions: sessions
      .filter((session) => !session.customer_slug || session.customer_slug === authContext.customer_slug)
      .map((session) => ({
        ...session,
        session_token: "",
        csrf_token: "",
      })),
    page_info: buildUnboundedPageInfo({
      page: pagination.page,
      limit: pagination.limit,
      returnedCount: sessions.length,
    }),
  });
}

async function handlePortalAuditEventsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.securityRead);
  const requestUrl = new URL(request.url);
  const pagination = resolvePagination(requestUrl, config.pagination);
  const events = (await listAuditEvents({
    serviceStorageRoot: config.serviceStorageRoot,
    action: requestUrl.searchParams.get("action") ?? undefined,
    actorSlug: requestUrl.searchParams.get("actor_slug") ?? undefined,
    workspaceSlug: requestUrl.searchParams.get("workspace_slug") ?? undefined,
    customerSlug: authContext.customer_slug,
    customerId: authContext.customer_id,
    surface: requestUrl.searchParams.get("surface") ?? undefined,
    outcome: requestUrl.searchParams.get("outcome") ?? undefined,
    searchTerm: requestUrl.searchParams.get("q") ?? undefined,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  }))
    .filter(
      (event) =>
        (!event.customer_slug || event.customer_slug === authContext.customer_slug) &&
        (!event.workspace_slug || !authContext.workspaces.length || authContext.workspaces.some(
          (workspace) => workspace.workspace_slug === event.workspace_slug,
        )),
    );

  return jsonResponse({
    schema_version: 1,
    events,
    page_info: buildUnboundedPageInfo({
      page: pagination.page,
      limit: pagination.limit,
      returnedCount: events.length,
    }),
  });
}

async function handleProviderSessionRoute(request, config, surface) {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  enforceStateChangingRequestSecurity({
    request,
    authContext: null,
    config,
    allowCookieSession: false,
  });

  const payload = await readJson(request, {
    maxBytes: config.requestLimits.providerSession,
  });
  if (payload?.provider_config) {
    throw createHttpError(
      400,
      "provider_config overrides are not allowed over HTTP. Configure providers on the service and send provider_id instead.",
    );
  }

  const trustedProvider = payload?.provider_id
    ? resolveHostedAuthProvider(payload.provider_id, {
        apiBaseUrl: config.apiBaseUrl,
        surface,
      })
    : null;
  const result = await issueProviderWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    idToken: payload?.id_token ?? payload?.token,
    workspaceSlug: payload?.workspace_slug,
    customerSlug: payload?.customer_slug,
    providerConfig: trustedProvider?.provider_config,
  });

  return withSessionCookies(
    jsonResponse(result, { status: 201 }),
    {
      session: result.session,
      request,
      config,
    },
  );
}

async function handlePublicIntakeRoute(request, config) {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  enforceStateChangingRequestSecurity({
    request,
    authContext: null,
    config,
    allowCookieSession: false,
  });

  try {
    const payload = await readJson(request, {
      maxBytes: config.requestLimits.publicIntake,
    });
    const intakeRequest = await createWebsiteIntakeRequest({
      serviceStorageRoot: config.serviceStorageRoot,
      request: payload,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "intake.request_created",
        outcome: "success",
        surface: "website",
        target_type: "intake_request",
        target_id: intakeRequest.request_id,
        metadata: {
          intake_kind: intakeRequest.intake_kind,
          source_page: intakeRequest.source_page,
          team_size: intakeRequest.team_size,
          repo_count: intakeRequest.repo_count,
        },
      },
    });
    return jsonResponse(intakeRequest, { status: 201 });
  } catch (error) {
    return jsonResponse(
      {
        error: error?.message || "Invalid intake request.",
      },
      { status: Number(error?.statusCode ?? 400) },
    );
  }
}

async function handleAdminIntakeRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requireAdminAuthContext(
    request,
    config,
    ADMIN_PERMISSIONS.revenueRead,
  );

  const intakeKind = new URL(request.url).searchParams.get("kind") ?? undefined;
  const searchTerm = new URL(request.url).searchParams.get("q") ?? undefined;
  const pagination = resolvePagination(new URL(request.url), config.pagination);
  const pagedResult = await listWebsiteIntakeRequestsPage({
    serviceStorageRoot: config.serviceStorageRoot,
    intakeKind,
    searchTerm,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });
  const pageInfo = buildPageInfo({
    page: pagination.page,
    limit: pagination.limit,
    totalCount: pagedResult.total_count,
    returnedCount: pagedResult.requests.length,
  });

  return jsonResponse({
    requests: pagedResult.requests,
    summary: await summarizeWebsiteIntakeRequestsByQuery({
      serviceStorageRoot: config.serviceStorageRoot,
      intakeKind,
      searchTerm,
    }),
    page_info: pageInfo,
  });
}

async function handleAdminOverviewRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requireAdminAuthContext(
    request,
    config,
    ADMIN_PERMISSIONS.overviewRead,
  );
  const payload = await loadAdminOverviewView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
  });
  return jsonResponse(payload);
}

async function handleAdminCustomerInventoryRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requireAdminAuthContext(
    request,
    config,
    ADMIN_PERMISSIONS.customersRead,
  );
  const payload = await loadAdminCustomerInventoryView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
  });
  return jsonResponse(payload);
}

async function handleAdminBillingOpsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requireAdminAuthContext(
    request,
    config,
    ADMIN_PERMISSIONS.billingOpsRead,
  );
  const payload = await loadAdminBillingOpsView({
    serviceStorageRoot: config.serviceStorageRoot,
    authContext,
  });
  return jsonResponse(payload);
}

async function handleWorkspacesRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const workspaces = await listAccessibleWorkspacesPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      repo: requestUrl.searchParams.get("repo") ?? undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });
    return jsonResponse({
      workspaces: workspaces.items,
      page_info: buildPageInfo({
        page: pagination.page,
        limit: pagination.limit,
        totalCount: workspaces.total_count,
        returnedCount: workspaces.items.length,
      }),
    });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.workspaceWrite,
    });
    const result = await provisionWorkspaceForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      workspace: payload,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "workspace.provisioned",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: result.workspace_identity?.workspace_slug,
        customer_slug: result.workspace_identity?.customer_slug,
        customer_id: result.workspace_identity?.customer_id,
        target_type: "workspace",
        target_id: result.workspace_identity?.workspace_slug,
        metadata: {
          repo: result.workspace_identity?.repo,
          plan: result.workspace_identity?.plan,
          status: result.workspace_identity?.status,
        },
      },
    });
    return jsonResponse(result, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleRepositoriesRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const profiles = await listAccessibleRepositoryProfilesPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      repo: requestUrl.searchParams.get("repo") ?? undefined,
      profileSlug: requestUrl.searchParams.get("profile_slug") ?? undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });
    return jsonResponse({
      profiles: profiles.items,
      page_info: buildPageInfo({
        page: pagination.page,
        limit: pagination.limit,
        totalCount: profiles.total_count,
        returnedCount: profiles.items.length,
      }),
    });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.profileWrite,
    });
    const result = await writeRepositoryProfileForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      profile: payload?.profile ?? payload,
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
      workspaceMetadata: payload?.workspace_metadata,
    });
    return jsonResponse(result, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleRepositoryDetailRoute(request, config, surface, slug) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  const payload = await loadAccessibleRepositoryView({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    actorSlug: authContext.actor_slug,
    profileSlug: slug,
  });
  if (!payload) {
    return jsonResponse({ error: "Repository view not found." }, { status: 404 });
  }

  return jsonResponse(payload);
}

async function handleDocumentsRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (request.method === "GET") {
    const payload = await loadAccessibleDocumentsView({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
    });
    return jsonResponse(payload);
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.documentWrite,
    });
    const result = await writeRepositoryDocumentsForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      artifact: payload?.artifact ?? payload,
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
    });
    return jsonResponse(result, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleDocumentSubmissionsRoute(request, config, surface) {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const payload = await readJson(request, {
    maxBytes: config.requestLimits.documentSubmission,
  });
  const title = String(payload?.title ?? "").trim();
  const body = String(payload?.body ?? "").trim();
  const profileSlug = String(payload?.profile_slug ?? "").trim();
  if (!title || !body || !profileSlug) {
    return jsonResponse(
      {
        error: "profile_slug, title, and body are required.",
      },
      { status: 400 },
    );
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  if (!authContext.actor) {
    return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
  }
  enforceStateChangingRequestSecurity({
    request,
    authContext,
    config,
  });

  const provisioned = await provisionWorkspaceForActor({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    authContext,
    workspace: {
      workspace_slug: payload.profile_slug,
      customer_slug: payload.customer_slug,
      repo: payload.repo ?? payload.profile_slug,
      display_name: payload.profile_slug,
      source: `${surface}-document-submission`,
    },
  });
  const submission = await writeWebDocumentSubmission({
    portalRoot: config.portalRoot,
    adminRoot: config.adminRoot,
    serviceStorageRoot: config.serviceStorageRoot,
    submission: {
      ...payload,
      workspace_slug: provisioned.workspace_identity.workspace_slug,
      customer_slug: provisioned.workspace_identity.customer_slug,
    },
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "document.submission_created",
      outcome: "success",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: provisioned.workspace_identity.workspace_slug,
      customer_slug: provisioned.workspace_identity.customer_slug,
      customer_id: provisioned.workspace_identity.customer_id,
      target_type: "document_submission",
      target_id: submission.submission_id,
      metadata: {
        category: submission.category,
        profile_slug: submission.profile_slug,
        repo: submission.repo,
      },
    },
  });

  return jsonResponse(submission, { status: 201 });
}

async function handleBenchmarksRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const payload = await loadAccessibleBenchmarkIndexPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      repo: requestUrl.searchParams.get("repo") ?? undefined,
      profileSlug: requestUrl.searchParams.get("profile_slug") ?? undefined,
      scenario: requestUrl.searchParams.get("scenario") ?? undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });
    return jsonResponse({
      reports: payload.reports,
      page_info: buildPageInfo({
        page: pagination.page,
        limit: pagination.limit,
        totalCount: payload.total_count,
        returnedCount: payload.reports.length,
      }),
    });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.benchmarkWrite,
    });
    const result = await writeBenchmarkReportForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      report: payload?.report ?? payload,
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
    });
    return jsonResponse(result, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleBenchmarkRunsRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });

  if (!authContext.actor) {
    return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
  }
  if (!actorHasPermission(authContext.actor, PORTAL_PERMISSIONS.benchmarksRead)) {
    return jsonResponse({ error: "Benchmark launch access is not allowed for this role." }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const requestedWorkspaceSlug = sanitizeSlug(
    requestUrl.searchParams.get("workspace") ??
      requestUrl.searchParams.get("workspace_slug") ??
      authContext.workspace_slug,
  );
  const allowedWorkspaceSlugs = new Set(
    (authContext.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );

  if (requestedWorkspaceSlug && !allowedWorkspaceSlugs.has(requestedWorkspaceSlug)) {
    return jsonResponse({ error: "Workspace is outside the current session scope." }, { status: 403 });
  }

  if (request.method === "GET") {
    const workspaceIdentity =
      requestedWorkspaceSlug && authContext.workspace_identity?.workspace_slug === requestedWorkspaceSlug
        ? authContext.workspace_identity
        : !requestedWorkspaceSlug
          ? authContext.workspace_identity
          : null;
    const capability =
      requestedWorkspaceSlug && workspaceIdentity
        ? await resolveWorkspaceBenchmarkRunnerCapability({
            serviceStorageRoot: config.serviceStorageRoot,
            workspaceIdentity,
          })
        : null;
    const launches = await listWorkspaceBenchmarkLaunches({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: requestedWorkspaceSlug || undefined,
      customerSlug: authContext.customer_slug || undefined,
      limit: Number(requestUrl.searchParams.get("limit") ?? 20),
    });
    return jsonResponse({
      workspace_slug: requestedWorkspaceSlug,
      capability,
      launches,
    });
  }

  if (request.method === "POST") {
    if (!actorHasPermission(authContext.actor, PORTAL_PERMISSIONS.benchmarksWrite)) {
      return jsonResponse({ error: "This role cannot start benchmark runs." }, { status: 403 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });

    const payload = await readJson(request, {
      maxBytes: config.requestLimits.benchmarkWrite,
    });
    const result = await requestWorkspaceBenchmarkLaunch({
      serviceStorageRoot: config.serviceStorageRoot,
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
      apiBaseUrl: config.apiBaseUrl,
      surface,
      authContext,
      workspaceSlug: requestedWorkspaceSlug,
      payload,
    });
    return jsonResponse(result, { status: 202 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleBenchmarkDetailRoute(request, config, surface, reportId) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  const report = await loadAccessibleBenchmarkReport({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    actorSlug: authContext.actor_slug,
    reportId,
  });
  if (!report) {
    return jsonResponse({ error: "Benchmark report not found." }, { status: 404 });
  }

  return jsonResponse(report);
}

async function handleBenchmarkRunDetailRoute(request, config, surface, launchId) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  if (!authContext.actor) {
    return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
  }
  if (!actorHasPermission(authContext.actor, PORTAL_PERMISSIONS.benchmarksRead)) {
    return jsonResponse({ error: "Benchmark launch access is not allowed for this role." }, { status: 403 });
  }

  const detail = await loadWorkspaceBenchmarkLaunchDetail({
    serviceStorageRoot: config.serviceStorageRoot,
    launchId,
  });
  if (!detail?.launch) {
    return jsonResponse({ error: "Benchmark launch not found." }, { status: 404 });
  }

  const allowedWorkspaceSlugs = new Set(
    (authContext.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );
  if (!allowedWorkspaceSlugs.has(sanitizeSlug(detail.launch.workspace_slug))) {
    return jsonResponse({ error: "Benchmark launch not found." }, { status: 404 });
  }

  return jsonResponse(detail);
}

async function handleAdminAuditEventsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requireAdminAuthContext(request, config, ADMIN_PERMISSIONS.sessionsAuditRead);
  const requestUrl = new URL(request.url);
  const pagination = resolvePagination(requestUrl, config.pagination);
  const events = await listAuditEvents({
    serviceStorageRoot: config.serviceStorageRoot,
    action: requestUrl.searchParams.get("action") ?? undefined,
    actorSlug: requestUrl.searchParams.get("actor_slug") ?? undefined,
    workspaceSlug: requestUrl.searchParams.get("workspace_slug") ?? undefined,
    surface: requestUrl.searchParams.get("surface") ?? undefined,
    outcome: requestUrl.searchParams.get("outcome") ?? undefined,
    searchTerm: requestUrl.searchParams.get("q") ?? undefined,
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  if (requestUrl.searchParams.get("format") === "ndjson") {
    return new Response(
      events.map((event) => JSON.stringify(event)).join("\n") + (events.length > 0 ? "\n" : ""),
      {
        status: 200,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  return jsonResponse({
    events,
    page_info: buildUnboundedPageInfo({
      page: pagination.page,
      limit: pagination.limit,
      returnedCount: events.length,
    }),
  });
}

async function handleAdminSessionsRoute(request, config) {
  const authContext = await requireAdminAuthContext(request, config, ADMIN_PERMISSIONS.sessionsAuditRead);
  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const sessions = await listWorkspaceSessions({
      serviceStorageRoot: config.serviceStorageRoot,
      sessionToken: requestUrl.searchParams.get("session_token") ?? undefined,
      sessionId: requestUrl.searchParams.get("session_id") ?? undefined,
      sessionFamilyId: requestUrl.searchParams.get("session_family_id") ?? undefined,
      actorSlug: requestUrl.searchParams.get("actor_slug") ?? undefined,
      surface: requestUrl.searchParams.get("surface") ?? undefined,
      workspaceSlug: requestUrl.searchParams.get("workspace_slug") ?? undefined,
      customerSlug: requestUrl.searchParams.get("customer_slug") ?? undefined,
      customerId: requestUrl.searchParams.get("customer_id") ?? undefined,
      includeRevoked: requestUrl.searchParams.get("include_revoked") === "1",
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
    });

    return jsonResponse({
      sessions: sessions.map((session) => toAdminSessionRecord(session)),
      page_info: buildUnboundedPageInfo({
        page: pagination.page,
        limit: pagination.limit,
        returnedCount: sessions.length,
      }),
      actor: authContext.actor,
    });
  }

  if (request.method === "POST") {
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });
    const payload = await readJson(request, {
      maxBytes: config.requestLimits.session,
    });
    const revokedCount = await revokeWorkspaceSessions({
      serviceStorageRoot: config.serviceStorageRoot,
      sessionToken: payload.session_token,
      sessionId: payload.session_id,
      sessionFamilyId: payload.session_family_id,
      actorSlug: payload.actor_slug,
      customerSlug: payload.customer_slug,
      customerId: payload.customer_id,
      reason: payload.reason ?? "admin-revoked",
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "auth.sessions_revoked",
        outcome: revokedCount > 0 ? "success" : "noop",
        surface: "admin",
        actor_slug: authContext.actor.actor_slug,
        customer_id: authContext.customer_id,
        target_type: "session_registry",
        target_id:
          String(
            payload.session_id ??
              payload.session_family_id ??
              payload.actor_slug ??
              payload.customer_id ??
              payload.customer_slug ??
              "unknown",
          ),
        metadata: {
          revoked_count: revokedCount,
          reason: payload.reason ?? "admin-revoked",
        },
      },
    });

    return jsonResponse({
      revoked_count: revokedCount,
    });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleAdminObservabilityRequestsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requireAdminAuthContext(request, config, ADMIN_PERMISSIONS.observabilityRead);
  const requestUrl = new URL(request.url);
  const pagination = resolvePagination(requestUrl, config.pagination);
  const traces = await listRequestTraces({
    serviceStorageRoot: config.serviceStorageRoot,
    routeKind: requestUrl.searchParams.get("route_kind") ?? undefined,
    method: requestUrl.searchParams.get("method") ?? undefined,
    surface: requestUrl.searchParams.get("surface") ?? undefined,
    minStatusCode: requestUrl.searchParams.get("min_status_code") ?? undefined,
    maxStatusCode: requestUrl.searchParams.get("max_status_code") ?? undefined,
    since: resolveObservabilityWindowStart(requestUrl, config),
    limit: pagination.limit,
    offset: (pagination.page - 1) * pagination.limit,
  });

  return jsonResponse({
    requests: traces,
    page_info: buildUnboundedPageInfo({
      page: pagination.page,
      limit: pagination.limit,
      returnedCount: traces.length,
    }),
  });
}

async function handleAdminObservabilityMetricsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requireAdminAuthContext(request, config, ADMIN_PERMISSIONS.observabilityRead);
  const requestUrl = new URL(request.url);
  const summary = await summarizeHostedTrafficMetrics({
    serviceStorageRoot: config.serviceStorageRoot,
    since: resolveObservabilityWindowStart(requestUrl, config),
  });

  return jsonResponse(summary);
}

async function handleAdminObservabilityAlertsRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requireAdminAuthContext(request, config, ADMIN_PERMISSIONS.observabilityRead);
  const requestUrl = new URL(request.url);
  const alerts = await listOperationalAlerts({
    serviceStorageRoot: config.serviceStorageRoot,
    since: resolveObservabilityWindowStart(requestUrl, config),
  });

  return jsonResponse(alerts);
}

async function handleAdminObservabilityExportsRoute(request, config) {
  const authContext = await requireAdminAuthContext(
    request,
    config,
    ADMIN_PERMISSIONS.observabilityRead,
  );
  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const exports = await listObservabilityExports({
      serviceStorageRoot: config.serviceStorageRoot,
      status: requestUrl.searchParams.get("status") ?? undefined,
      category: requestUrl.searchParams.get("category") ?? undefined,
      limit: pagination.limit,
      offset: (pagination.page - 1) * pagination.limit,
      dueBefore: requestUrl.searchParams.get("due_before") ?? undefined,
    });

    return jsonResponse({
      exports,
      page_info: buildUnboundedPageInfo({
        page: pagination.page,
        limit: pagination.limit,
        returnedCount: exports.length,
      }),
    });
  }

  if (request.method === "POST") {
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });
    const payload = await readJson(request, {
      maxBytes: config.requestLimits.publicIntake,
    });
    const windowStart = resolveObservabilityWindowStart(new URL(request.url), config);
    if (payload.include_snapshots !== false) {
      const [summary, alerts] = await Promise.all([
        summarizeHostedTrafficMetrics({
          serviceStorageRoot: config.serviceStorageRoot,
          since: windowStart,
        }),
        listOperationalAlerts({
          serviceStorageRoot: config.serviceStorageRoot,
          since: windowStart,
        }),
      ]);
      await Promise.all([
        queueObservabilityExport({
          serviceStorageRoot: config.serviceStorageRoot,
          category: "traffic_summary",
          payload: summary,
        }),
        queueObservabilityExport({
          serviceStorageRoot: config.serviceStorageRoot,
          category: "alerts_snapshot",
          payload: alerts,
        }),
      ]);
    }

    const delivery = await deliverPendingObservabilityExports({
      serviceStorageRoot: config.serviceStorageRoot,
      limit: payload.limit,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "observability.exports_flushed",
        outcome: delivery.failed > 0 ? "partial" : "success",
        surface: "admin",
        actor_slug: authContext.actor.actor_slug,
        customer_id: authContext.customer_id,
        target_type: "observability_export",
        target_id: "flush",
        metadata: delivery,
      },
    });

    return jsonResponse({
      delivery,
    });
  }

  return methodNotAllowed(["GET", "POST"]);
}

function matchRoute(pathname) {
  if (pathname === "/health") {
    return { kind: "health" };
  }
  if (pathname === "/metrics") {
    return { kind: "metrics" };
  }
  const llmProxyMatch = pathname.match(/^\/proxy\/openai\/runs\/([^/]+)\/v1(?:\/(.*))?$/);
  if (llmProxyMatch) {
    return {
      kind: "llm-proxy",
      provider: "openai",
      runId: llmProxyMatch[1],
      upstreamPath: `/${llmProxyMatch[2] ?? ""}`.replace(/\/+$/, "") || "/",
      requestKind: resolveProxyRequestKind(llmProxyMatch[2] ?? ""),
    };
  }
  if (pathname === "/api/public/intake") {
    return { kind: "public-intake" };
  }
  if (pathname === "/api/auth/providers") {
    return { kind: "auth-providers" };
  }

  const authorizeMatch = pathname.match(/^\/auth\/authorize\/([^/]+)$/);
  if (authorizeMatch) {
    return {
      kind: "auth-authorize",
      providerId: authorizeMatch[1],
    };
  }

  const callbackMatch = pathname.match(/^\/auth\/callback\/([^/]+)$/);
  if (callbackMatch) {
    return {
      kind: "auth-callback",
      providerId: callbackMatch[1],
    };
  }

  const adminPrefixed = pathname.startsWith("/api/admin/");
  const surface = adminPrefixed ? "admin" : "portal";
  const effectivePath = adminPrefixed ? pathname.replace(/^\/api\/admin/, "/api") : pathname;

  if (effectivePath === "/api/session/provider") {
    return { kind: "session-provider", surface };
  }
  if (effectivePath === "/api/account" && surface === "portal") {
    return { kind: "portal-account", surface };
  }
  if (effectivePath === "/api/overview" && surface === "portal") {
    return { kind: "portal-overview", surface };
  }
  if (effectivePath === "/api/usage/summary" && surface === "portal") {
    return { kind: "portal-usage-summary", surface };
  }
  if (effectivePath === "/api/billing" && surface === "portal") {
    return { kind: "portal-billing", surface };
  }
  if (effectivePath === "/api/members" && surface === "portal") {
    return { kind: "portal-members", surface };
  }
  if (effectivePath === "/api/policies" && surface === "portal") {
    return { kind: "portal-policies", surface };
  }
  if (effectivePath === "/api/security" && surface === "portal") {
    return { kind: "portal-security", surface };
  }
  if (effectivePath === "/api/settings" && surface === "portal") {
    return { kind: "portal-settings", surface };
  }
  if (effectivePath === "/api/sessions" && surface === "portal") {
    return { kind: "portal-sessions", surface };
  }
  if (effectivePath === "/api/audit/events" && surface === "portal") {
    return { kind: "portal-audit-events", surface };
  }
  if (effectivePath === "/api/intake" && surface === "admin") {
    return { kind: "admin-intake", surface };
  }
  if (effectivePath === "/api/overview" && surface === "admin") {
    return { kind: "admin-overview", surface };
  }
  if (effectivePath === "/api/customers/inventory" && surface === "admin") {
    return { kind: "admin-customer-inventory", surface };
  }
  if (effectivePath === "/api/billing-ops" && surface === "admin") {
    return { kind: "admin-billing-ops", surface };
  }
  if (effectivePath === "/api/audit/events" && surface === "admin") {
    return { kind: "admin-audit-events", surface };
  }
  if (effectivePath === "/api/sessions" && surface === "admin") {
    return { kind: "admin-sessions", surface };
  }
  if (effectivePath === "/api/observability/requests" && surface === "admin") {
    return { kind: "admin-observability-requests", surface };
  }
  if (effectivePath === "/api/observability/metrics" && surface === "admin") {
    return { kind: "admin-observability-metrics", surface };
  }
  if (effectivePath === "/api/observability/alerts" && surface === "admin") {
    return { kind: "admin-observability-alerts", surface };
  }
  if (effectivePath === "/api/observability/exports" && surface === "admin") {
    return { kind: "admin-observability-exports", surface };
  }
  if (effectivePath === "/api/session") {
    return { kind: "session", surface };
  }
  if (effectivePath === "/api/workspaces") {
    return { kind: "workspaces", surface };
  }
  if (effectivePath === "/api/repositories") {
    return { kind: "repositories", surface };
  }
  if (effectivePath === "/api/documents") {
    return { kind: "documents", surface };
  }
  if (effectivePath === "/api/documents/submissions") {
    return { kind: "document-submissions", surface };
  }
  if (effectivePath === "/api/benchmarks") {
    return { kind: "benchmarks", surface };
  }
  if (effectivePath === "/api/benchmarks/runs") {
    return { kind: "benchmark-runs", surface };
  }

  const repositoryMatch = effectivePath.match(/^\/api\/repositories\/([^/]+)$/);
  if (repositoryMatch) {
    return {
      kind: "repository-detail",
      surface,
      slug: repositoryMatch[1],
    };
  }

  const benchmarkMatch = effectivePath.match(/^\/api\/benchmarks\/([^/]+)$/);
  if (benchmarkMatch) {
    return {
      kind: "benchmark-detail",
      surface,
      reportId: benchmarkMatch[1],
    };
  }
  const benchmarkRunMatch = effectivePath.match(/^\/api\/benchmarks\/runs\/([^/]+)$/);
  if (benchmarkRunMatch) {
    return {
      kind: "benchmark-run-detail",
      surface,
      launchId: benchmarkRunMatch[1],
    };
  }

  return null;
}

function resolveProxyRequestKind(pathname = "") {
  const normalized = String(pathname ?? "").replace(/^\/+/, "");
  if (normalized === "chat/completions") {
    return "chat_completions";
  }
  if (normalized === "responses") {
    return "responses";
  }
  if (normalized === "models") {
    return "models";
  }

  return normalized.replace(/[^\w]+/g, "_") || "unknown";
}

async function readJson(request, { maxBytes } = {}) {
  try {
    const raw = await request.text();
    if (!raw) {
      return {};
    }

    if (maxBytes && Buffer.byteLength(raw, "utf8") > maxBytes) {
      throw createHttpError(413, `Request body is too large. Limit is ${maxBytes} bytes.`);
    }

    return JSON.parse(raw);
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw createHttpError(400, "Request body must be valid JSON.");
  }
}

async function consumeRateLimitForRoute({ request, route, config } = {}) {
  const policy = config.rateLimits?.[route.kind];
  if (
    !policy ||
    !Number.isFinite(policy.max) ||
    policy.max <= 0 ||
    !Number.isFinite(policy.windowMs) ||
    policy.windowMs <= 0
  ) {
    return null;
  }

  const clientKey = resolveRateLimitClientKey(request, config);
  const result = await consumeRequestRateLimit({
    serviceStorageRoot: config.serviceStorageRoot,
    namespace: config.rateLimits?.namespace,
    routeKind: route.kind,
    surface: resolveTraceSurface(route, new URL(request.url)),
    clientKey,
    windowMs: policy.windowMs,
    max: policy.max,
  });
  return {
    limited: result.limited,
    headers: {
      "Retry-After": String(Math.max(1, Number(result.retry_after_seconds ?? 1))),
      "X-RateLimit-Limit": String(policy.max),
      "X-RateLimit-Remaining": String(
        Math.max(0, Number(policy.max) - Number(result.count ?? 0)),
      ),
      "X-RateLimit-Reset": String(result.reset_at ?? ""),
    },
  };
}

function resolveRateLimitClientKey(request, config) {
  const forwardedFor =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .find(Boolean);
    if (firstHop) {
      return `ip:${firstHop}`;
    }
  }

  const sessionToken = request.headers.get("x-be-ai-heart-session");
  if (sessionToken) {
    return `session:${sessionToken.trim()}`;
  }

  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const cookieName = String(config?.sessionSecurity?.cookieName ?? "be_ai_heart_session");
  if (cookies[cookieName]) {
    return `session:${cookies[cookieName]}`;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return `origin:${origin}`;
  }

  return `host:${new URL(request.url).host}`;
}

function resolvePagination(requestUrl, pagination = {}) {
  const defaultLimit = normalizePaginationLimit(
    pagination.defaultLimit,
    DEFAULT_PAGINATION.defaultLimit,
  );
  const maxLimit = Math.max(
    defaultLimit,
    normalizePaginationLimit(pagination.maxLimit, DEFAULT_PAGINATION.maxLimit),
  );
  const pageParam = requestUrl.searchParams.get("page");
  const limitParam = requestUrl.searchParams.get("limit");

  return {
    page: pageParam === null ? 1 : parsePositiveInteger(pageParam, "page"),
    limit:
      limitParam === null
        ? defaultLimit
        : Math.min(parsePositiveInteger(limitParam, "limit"), maxLimit),
  };
}

function normalizePaginationLimit(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function parsePositiveInteger(value, field) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw createHttpError(400, `${field} must be a positive integer.`);
  }

  return numeric;
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      ...(init.headers ?? {}),
    },
  });
}

function methodNotAllowed(methods) {
  return jsonResponse(
    {
      error: `Method not allowed. Expected: ${methods.join(", ")}`,
    },
    {
      status: 405,
      headers: {
        Allow: methods.join(", "),
      },
    },
  );
}

function errorResponse(error, fallbackMessage) {
  return jsonResponse(
    {
      error: error?.message || fallbackMessage,
    },
    { status: Number(error?.statusCode ?? 500) },
  );
}

function withCors(response, request, config) {
  const origin = request.headers.get("origin");
  const allowedOrigin = resolveAllowedOrigin(origin, config);
  const nextHeaders = new Headers(response.headers);
  appendVaryHeader(nextHeaders, "Origin");
  nextHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
  nextHeaders.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  nextHeaders.set(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "X-Be-AI-Heart-Session",
      "X-Be-AI-Heart-Actor",
      "X-Be-AI-Heart-Workspace",
      config.sessionSecurity.csrfHeaderName,
    ].join(", "),
  );
  nextHeaders.set(
    "Access-Control-Expose-Headers",
    "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
  );
  if (allowedOrigin !== "*") {
    nextHeaders.set("Access-Control-Allow-Credentials", "true");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

function resolveAllowedOrigin(origin, config) {
  if (!origin) {
    return "*";
  }

  return isAllowedOrigin(origin, config) ? origin : "null";
}

function safeParseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalLoopbackOrigin(url) {
  return url.protocol.startsWith("http") && ["127.0.0.1", "localhost"].includes(url.hostname);
}

function isAllowedOrigin(origin, config) {
  const parsedOrigin = safeParseUrl(origin);
  if (parsedOrigin && isLocalLoopbackOrigin(parsedOrigin)) {
    return true;
  }

  const allowedOrigins = new Set([
    new URL(config.apiBaseUrl).origin,
    new URL(process.env.BE_AI_HEART_WEBSITE_BASE_URL ?? "http://127.0.0.1:3000").origin,
    new URL(process.env.BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001").origin,
    new URL(process.env.BE_AI_HEART_ADMIN_BASE_URL ?? "http://127.0.0.1:3002").origin,
  ]);
  return allowedOrigins.has(origin);
}

function buildPageInfo({ page, limit, totalCount, returnedCount } = {}) {
  const safePage = Number(page ?? 1);
  const safeLimit = Number(limit ?? DEFAULT_PAGINATION.defaultLimit);
  const safeTotalCount = Math.max(0, Number(totalCount ?? 0));
  const totalPages = safeTotalCount === 0 ? 1 : Math.ceil(safeTotalCount / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    total_count: safeTotalCount,
    total_pages: totalPages,
    returned_count: Math.max(0, Number(returnedCount ?? 0)),
    has_previous_page: safePage > 1,
    has_next_page: safePage < totalPages,
  };
}

function buildUnboundedPageInfo({ page, limit, returnedCount } = {}) {
  return {
    page: Number(page ?? 1),
    limit: Number(limit ?? DEFAULT_PAGINATION.defaultLimit),
    returned_count: Math.max(0, Number(returnedCount ?? 0)),
    has_previous_page: Number(page ?? 1) > 1,
    has_next_page: Number(returnedCount ?? 0) === Number(limit ?? DEFAULT_PAGINATION.defaultLimit),
  };
}

function resolveObservabilityWindowStart(requestUrl, config) {
  const explicitSince = requestUrl.searchParams.get("since");
  if (explicitSince) {
    const parsed = new Date(explicitSince);
    if (Number.isNaN(parsed.getTime())) {
      throw createHttpError(400, "since must be a valid ISO-8601 timestamp.");
    }

    return parsed.toISOString();
  }

  const rawWindowMinutes = requestUrl.searchParams.get("window_minutes");
  const windowMinutes =
    rawWindowMinutes === null
      ? Number(config.observability.defaultWindowMinutes ?? 60)
      : parsePositiveInteger(rawWindowMinutes, "window_minutes");
  const clampedWindowMinutes = Math.min(Math.max(windowMinutes, 1), 7 * 24 * 60);
  return new Date(Date.now() - clampedWindowMinutes * 60 * 1000).toISOString();
}

function enforceStateChangingRequestSecurity({
  request,
  authContext,
  config,
  allowCookieSession = true,
} = {}) {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin, config)) {
    throw createHttpError(403, "Origin is not allowed for this request.");
  }

  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const usesCookieSession =
    authContext?.session_source === "cookie" ||
    Boolean(cookies[config.sessionSecurity.cookieName]);
  if (!usesCookieSession) {
    return;
  }

  if (!allowCookieSession) {
    throw createHttpError(403, "Cookie-backed sessions are not allowed for this route.");
  }
  if (!origin) {
    throw createHttpError(403, "Origin header is required for cookie-backed write requests.");
  }

  const csrfToken = String(authContext?.session?.csrf_token ?? "").trim();
  const presentedToken = String(
    request.headers.get(config.sessionSecurity.csrfHeaderName) ?? "",
  ).trim();
  if (!csrfToken || !presentedToken || presentedToken !== csrfToken) {
    throw createHttpError(403, "CSRF validation failed for the current session.");
  }
}

function withSessionCookies(response, { session, request, config } = {}) {
  const nextHeaders = new Headers(response.headers);
  nextHeaders.set("Cache-Control", "no-store");
  nextHeaders.set("Pragma", "no-cache");
  if (session?.session_token) {
    nextHeaders.append(
      "Set-Cookie",
      serializeCookie(config.sessionSecurity.cookieName, session.session_token, {
        expiresAt: session.expires_at,
        secure: isSecureRequest(request),
        sameSite: config.sessionSecurity.sameSite,
      }),
    );
    appendVaryHeader(nextHeaders, "Cookie");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
}

function serializeCookie(name, value, { expiresAt, secure, sameSite } = {}) {
  const parts = [
    `${encodeURIComponent(String(name ?? ""))}=${encodeURIComponent(String(value ?? ""))}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${String(sameSite ?? "Lax")}`,
  ];
  if (expiresAt) {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }
  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader ?? "")
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...rest] = entry.split("=");
        return [key, decodeURIComponent(rest.join("=") || "")];
      }),
  );
}

function appendVaryHeader(headers, value) {
  const existing = headers.get("Vary");
  const values = new Set(
    String(existing ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  values.add(String(value));
  headers.set("Vary", [...values].join(", "));
}

function shouldRotateSession(session, config) {
  if (!session?.issued_at) {
    return false;
  }

  const rotationMinutes = Number(config.sessionSecurity.rotationMinutes ?? 0);
  if (!Number.isFinite(rotationMinutes) || rotationMinutes <= 0) {
    return false;
  }

  const issuedAtMs = new Date(session.issued_at).getTime();
  return Number.isFinite(issuedAtMs) && Date.now() - issuedAtMs >= rotationMinutes * 60 * 1000;
}

async function rotateCurrentSession(authContext, config) {
  if (!authContext?.session?.session_token) {
    return null;
  }

  return rotateWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    sessionToken: authContext.session.session_token,
    expiresAt: authContext.session.expires_at,
    metadata: {
      ...(authContext.session.metadata ?? {}),
      source: `${authContext.session.surface ?? "portal"}-session-rotation`,
    },
  });
}

function toClientSession(session, { includeToken = true } = {}) {
  if (!session) {
    return null;
  }

  return includeToken
    ? session
    : {
        ...session,
        session_token: "",
      };
}

function toAdminSessionRecord(session) {
  if (!session) {
    return null;
  }

  return {
    ...session,
    session_token: "",
    csrf_token: "",
  };
}

async function writeRequestTraceForResponse({
  config,
  serviceStorageRoot,
  request,
  route,
  response,
  startedAtMs,
} = {}) {
  if (!serviceStorageRoot || !request || !response) {
    return;
  }

  const requestUrl = new URL(request.url);
  const surface = resolveTraceSurface(route, requestUrl);
  const shouldResolveAuth = surface === "portal" || surface === "admin";
  const authContext = shouldResolveAuth
    ? await resolveRequestAuthContext({
        serviceStorageRoot,
        surface,
        request,
        sessionCookieName: config?.sessionSecurity?.cookieName,
      })
    : null;

  await writeRequestTrace({
    serviceStorageRoot,
    trace: {
      method: request.method,
      route_kind: route?.kind ?? "unknown",
      path: requestUrl.pathname,
      surface,
      status_code: response.status,
      duration_ms: Math.max(0, Date.now() - Number(startedAtMs ?? Date.now())),
      actor_slug: authContext?.actor_slug ?? "",
      workspace_slug: authContext?.workspace_slug ?? "",
      customer_slug: authContext?.customer_slug ?? "",
      customer_id: authContext?.customer_id ?? "",
      client_key_hash: createHash("sha256")
        .update(resolveRateLimitClientKey(request, config), "utf8")
        .digest("hex"),
      metadata: {
        query: requestUrl.search,
      },
    },
  });
}

function resolveTraceSurface(route, requestUrl) {
  if (route?.surface) {
    return route.surface;
  }

  switch (route?.kind) {
    case "public-intake":
      return "website";
    case "auth-providers":
    case "auth-authorize":
    case "auth-callback":
      return requestUrl.searchParams.get("surface") ?? "portal";
    case "metrics":
    case "health":
      return "internal";
    case "llm-proxy":
      return "proxy";
    default:
      return "public";
  }
}

async function requirePortalAuthContext(request, config, requiredPermission) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "portal",
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  if (!authContext.actor || authContext.actor.surface !== "portal") {
    throw createHttpError(401, "Unauthenticated request.");
  }

  ensureSurfacePermission(authContext.actor, requiredPermission);
  return authContext;
}

async function requireAdminAuthContext(request, config, requiredPermission) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "admin",
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
  });
  if (!authContext.actor || authContext.actor.surface !== "admin") {
    throw createHttpError(401, "Unauthenticated request.");
  }

  ensureSurfacePermission(authContext.actor, requiredPermission);
  return authContext;
}

function ensureSurfacePermission(actor, permission) {
  if (!permission) {
    return;
  }

  const resolved = resolveActorAccess(actor);
  if (!actorHasPermission(resolved, permission)) {
    throw createHttpError(403, "Actor does not have permission for this route.");
  }
}

function isSecureRequest(request) {
  const forwardedProto = String(request.headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return safeParseUrl(request.url)?.protocol === "https:";
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
