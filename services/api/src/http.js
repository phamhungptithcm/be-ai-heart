import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleOpenAiCompatibleProxyRoute } from "./llm-proxy.js";
import { writeWebDocumentSubmission } from "../../../packages/document-sync/src/index.js";
import {
  detectPackLayerConflicts,
  getDomainPack,
  getPackBuildOptions,
  listDomainPacks,
  listGeneratedPackArtifacts,
  listPackLayers,
  loadAgencyOverlay,
  readGeneratedPackArtifact,
  syncGeneratedPackArtifact,
  validateDomainPack,
  writePackArtifact,
} from "../../../packages/core/src/index.js";
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
import {
  redactSensitiveString,
  redactUrlSearch,
} from "./redaction.js";
import { buildRepositoryServicesView } from "./repository-services.js";
import {
  buildChatCommandRecord,
  buildContextPackIndexContract,
  buildDiagramContract,
  buildGraphSummaryContract,
  buildRepositorySyncStatusContract,
  containsRawModelSecret,
  addProviderKey,
  createChatSessionRecord,
  createRepositoryContextPack,
  deleteChatSession,
  deleteProviderKey,
  executePortalAgentTool,
  listRepositoryContextPacks,
  listChatAllowedTools,
  listChatSessions,
  loadChatCommandRecord,
  loadChatSession,
  loadModelSettings,
  refreshProviderModels,
  sendPortalChatMessage,
  streamPortalChatMessage,
  testProviderKey,
  updateModelSettings,
  writeChatCommandRecord,
} from "./portal-contracts.js";

const DEFAULT_REQUEST_LIMITS = Object.freeze({
  session: 16 * 1024,
  providerSession: 64 * 1024,
  publicIntake: 32 * 1024,
  workspaceWrite: 64 * 1024,
  profileWrite: 2 * 1024 * 1024,
  documentWrite: 2 * 1024 * 1024,
  documentSubmission: 128 * 1024,
  benchmarkWrite: 2 * 1024 * 1024,
  chatCommand: 128 * 1024,
  contextPack: 512 * 1024,
  domainPack: 512 * 1024,
  modelSettings: 128 * 1024,
  apiKey: 16 * 1024,
  llmProxy: 8 * 1024 * 1024,
});
const DEFAULT_RATE_LIMITS = Object.freeze({
  "auth-providers": { windowMs: 60 * 1000, max: 60 },
  "auth-authorize": { windowMs: 60 * 1000, max: 30 },
  "auth-callback": { windowMs: 60 * 1000, max: 30 },
  "session-provider": { windowMs: 60 * 1000, max: 20 },
  "portal-api-keys": { windowMs: 60 * 1000, max: 20 },
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
  const traceId = resolveTraceId(request);
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
          case "portal-api-keys":
            response = await handlePortalApiKeysRoute(request, config);
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
          case "repository-sync":
            response = await handleRepositorySyncRoute(request, config, route.surface, route.slug);
            break;
          case "repository-graph-summary":
            response = await handleRepositoryGraphSummaryRoute(request, config, route.surface, route.slug);
            break;
          case "repository-diagrams":
            response = await handleRepositoryDiagramsRoute(request, config, route.surface, route.slug);
            break;
          case "repository-context-packs":
            response = await handleRepositoryContextPacksRoute(request, config, route.surface, route.slug);
            break;
          case "domain-packs":
            response = await handleDomainPacksRoute(request, config, route.surface);
            break;
          case "domain-pack-detail":
            response = await handleDomainPackDetailRoute(request, config, route.surface, route.packId);
            break;
          case "domain-pack-subroute":
            response = await handleDomainPackSubroute(request, config, route.surface, route.packId, route.subroute, route.artifactId);
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
          case "chat-commands":
            response = await handleChatCommandsRoute(request, config, route.surface);
            break;
          case "chat-command-detail":
            response = await handleChatCommandDetailRoute(request, config, route.surface, route.commandId);
            break;
          case "chat-sessions":
            response = await handleChatSessionsRoute(request, config, route.surface);
            break;
          case "chat-session-detail":
            response = await handleChatSessionDetailRoute(request, config, route.surface, route.sessionId);
            break;
          case "chat-session-messages":
            response = await handleChatSessionMessagesRoute(request, config, route.surface, route.sessionId);
            break;
          case "chat-session-messages-stream":
            response = await handleChatSessionMessagesStreamRoute(request, config, route.surface, route.sessionId);
            break;
          case "chat-tools":
            response = await handleChatToolsRoute(request, config, route.surface);
            break;
          case "models":
            response = await handleModelsRoute(request, config, route.surface);
            break;
          case "model-settings":
            response = await handleModelSettingsRoute(request, config, route.surface);
            break;
          case "model-provider-keys":
            response = await handleModelProviderKeysRoute(request, config, route.surface);
            break;
          case "model-provider-key":
            response = await handleModelProviderKeyRoute(request, config, route.surface, route.providerId);
            break;
          case "model-provider-key-test":
            response = await handleModelProviderKeyTestRoute(request, config, route.surface, route.providerId);
            break;
          case "provider-models-refresh":
            response = await handleProviderModelsRefreshRoute(request, config, route.surface, route.providerId);
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
    response = errorResponse(error, "Service request failed.", { traceId });
  }

  const tracedResponse = withTraceHeader(response, traceId);
  const corsResponse = withCors(tracedResponse, request, config);
  try {
    await writeRequestTraceForResponse({
      config,
      serviceStorageRoot: config.serviceStorageRoot,
      request,
      route,
      response: corsResponse,
      startedAtMs,
      traceId,
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
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    localDemoAuth:
      typeof options.localDemoAuth === "boolean"
        ? options.localDemoAuth
        : ["1", "true", "yes", "on", "enabled"].includes(
            String(process.env.BE_AI_HEART_ENABLE_LOCAL_DEMO_AUTH ?? "")
              .trim()
              .toLowerCase(),
          ),
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
  const configuredAuth = listConfiguredAuthProviders({
    apiBaseUrl: config.apiBaseUrl,
    surface,
    returnTo,
  });
  const providers = [
    ...configuredAuth.providers,
    ...buildLocalDemoAuthProviders({
      enabled: config.localDemoAuth,
      surface,
      returnTo,
    }),
  ];

  return jsonResponse({
    ...configuredAuth,
    providers,
    local_demo_auth_enabled: Boolean(config.localDemoAuth),
    ...buildDefaultPortalAuthLinks({
      apiBaseUrl: config.apiBaseUrl,
    }),
  });
}

function buildLocalDemoAuthProviders({ enabled, surface = "portal", returnTo } = {}) {
  if (!enabled) {
    return [];
  }

  const safeSurface = String(surface ?? "portal").trim() === "admin" ? "admin" : "portal";
  const demoToken =
    safeSurface === "admin"
      ? process.env.BE_AI_HEART_DEFAULT_ADMIN_SESSION || "admin-owner-session"
      : process.env.BE_AI_HEART_DEFAULT_PORTAL_SESSION || "portal-demo-session";
  const authorizeUrl = new URL(returnTo);
  authorizeUrl.searchParams.set("session_token", demoToken);
  authorizeUrl.searchParams.set("auth_provider", "local-demo");
  authorizeUrl.searchParams.set("surface", safeSurface);

  return [
    {
      id: safeSurface === "admin" ? "local-admin-demo" : "local-portal-demo",
      label: safeSurface === "admin" ? "Local admin demo" : "Local portal demo",
      description:
        safeSurface === "admin"
          ? "Open the founder/admin control plane with the local owner dummy session."
          : "Open the customer portal with the local tenant dummy session.",
      kind: "local-demo",
      authorize_url: authorizeUrl.toString(),
      action_label: safeSurface === "admin" ? "Use dummy admin account" : "Use dummy portal account",
    },
  ];
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
    localDemoAuth: config.localDemoAuth,
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
      localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
  });
  return jsonResponse(payload);
}

async function handlePortalApiKeysRoute(request, config) {
  if (request.method === "GET") {
    const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.settingsRead);
    const sessions = await listWorkspaceSessions({
      serviceStorageRoot: config.serviceStorageRoot,
      surface: "portal",
      customerSlug: authContext.customer_slug,
      includeRevoked: false,
      limit: 100,
      offset: 0,
    });
    return jsonResponse({
      schema_version: 1,
      api_keys: sessions
        .filter((session) => session.metadata?.source === "portal-api-key")
        .filter((session) => !session.customer_slug || session.customer_slug === authContext.customer_slug)
        .map(toClientApiKeyRecord),
    });
  }

  if (request.method === "POST") {
    const authContext = await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.settingsWrite);
    if (authContext.session?.metadata?.source === "portal-api-key") {
      throw createHttpError(403, "CLI API keys cannot create additional API keys.");
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });
    const payload = await readJson(request, {
      maxBytes: config.requestLimits.apiKey,
    });
    const label = sanitizeApiKeyLabel(payload.label);
    const expiresAt = resolveApiKeyExpiresAt(payload.expires_in_days);
    const session = await issueWorkspaceSession({
      serviceStorageRoot: config.serviceStorageRoot,
      actorSlug: authContext.actor.actor_slug,
      surface: "portal",
      workspaceSlug: payload.workspace_slug ?? authContext.workspace_slug,
      customerSlug: authContext.customer_slug,
      expiresAt,
      localDemoAuth: config.localDemoAuth,
      metadata: {
        source: "portal-api-key",
        label,
        created_for: "cli",
      },
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "auth.api_key_issued",
        outcome: "success",
        surface: "portal",
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: session.workspace_slug,
        customer_slug: session.customer_slug,
        customer_id: session.customer_id,
        target_type: "api_key",
        target_id: session.session_id,
        metadata: {
          label,
          expires_at: session.expires_at,
        },
      },
    });

    return jsonResponse(
      {
        schema_version: 1,
        api_key: session.session_token,
        key: toClientApiKeyRecord(session),
        command: "heart login --api-key=<api-key>",
        self_hosted_command: `heart login --url ${config.apiBaseUrl} --api-key=<api-key>`,
      },
      { status: 201 },
    );
  }

  return methodNotAllowed(["GET", "POST"]);
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
  });
  return jsonResponse(payload);
}

async function handleWorkspacesRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
    localDemoAuth: config.localDemoAuth,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const workspaces = await listAccessibleWorkspacesPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const profiles = await listAccessibleRepositoryProfilesPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      localDemoAuth: config.localDemoAuth,
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

  const requestUrl = new URL(request.url);
  const payload = await loadRepositoryContractData({
    request,
    config,
    surface,
    slug,
    graphMode: requestUrl.searchParams.get("graph_mode") ?? "focused",
  });
  if (!payload) {
    return jsonResponse({ error: "Repository view not found." }, { status: 404 });
  }

  return jsonResponse({
    ...payload.repositoryView,
    runtime_signals: payload.runtimeSignals,
    repository_services: payload.repositoryServices,
  });
}

async function handleRepositorySyncRoute(request, config, surface, slug) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const payload = await loadRepositoryContractData({
    request,
    config,
    surface,
    slug,
    graphMode: "focused",
  });
  if (!payload) {
    return jsonResponse({ error: "Repository sync status not found." }, { status: 404 });
  }

  const contextPacks = await listRepositoryContextPacks({
    serviceStorageRoot: config.serviceStorageRoot,
    profileSlug: payload.repositoryView.profile?.profile_slug ?? slug,
  });

  return jsonResponse(
    buildRepositorySyncStatusContract({
      profile: payload.repositoryView.profile,
      documents: payload.repositoryView.documents,
      benchmarkHistory: payload.repositoryView.benchmark_history,
      workspace: payload.repositoryView.workspace,
      repositoryServices: payload.repositoryServices,
      contextPacks,
    }),
  );
}

async function handleRepositoryGraphSummaryRoute(request, config, surface, slug) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const requestUrl = new URL(request.url);
  const payload = await loadRepositoryContractData({
    request,
    config,
    surface,
    slug,
    graphMode: requestUrl.searchParams.get("graph_mode") ?? "focused",
  });
  if (!payload) {
    return jsonResponse({ error: "Repository graph summary not found." }, { status: 404 });
  }

  return jsonResponse(
    buildGraphSummaryContract({
      repositoryView: payload.repositoryView,
      repositoryServices: payload.repositoryServices,
    }),
  );
}

async function handleRepositoryDiagramsRoute(request, config, surface, slug) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const payload = await loadRepositoryContractData({
    request,
    config,
    surface,
    slug,
    graphMode: "focused",
  });
  if (!payload) {
    return jsonResponse({ error: "Repository diagrams not found." }, { status: 404 });
  }

  return jsonResponse(
    buildDiagramContract({
      repositoryView: payload.repositoryView,
      repositoryServices: payload.repositoryServices,
    }),
  );
}

async function handleRepositoryContextPacksRoute(request, config, surface, slug) {
  const payload = await loadRepositoryContractData({
    request,
    config,
    surface,
    slug,
    graphMode: "focused",
  });
  if (!payload) {
    return jsonResponse({ error: "Repository context packs not found." }, { status: 404 });
  }

  if (request.method === "GET") {
    const packs = await listRepositoryContextPacks({
      serviceStorageRoot: config.serviceStorageRoot,
      profileSlug: payload.repositoryView.profile?.profile_slug ?? slug,
    });
    return jsonResponse(
      buildContextPackIndexContract({
        profile: payload.repositoryView.profile,
        repositoryServices: payload.repositoryServices,
        packs,
      }),
    );
  }

  if (request.method === "POST") {
    if (!payload.authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }
    enforceStateChangingRequestSecurity({
      request,
      authContext: payload.authContext,
      config,
    });
    const body = await readJson(request, {
      maxBytes: config.requestLimits.contextPack,
    });
    const pack = await createRepositoryContextPack({
      serviceStorageRoot: config.serviceStorageRoot,
      profile: payload.repositoryView.profile,
      repositoryServices: payload.repositoryServices,
      request: body,
      actor: payload.authContext.actor,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "context_pack.created",
        outcome: "success",
        surface,
        actor_slug: payload.authContext.actor.actor_slug,
        workspace_slug: pack.workspace_slug,
        customer_slug: pack.customer_slug,
        customer_id: payload.authContext.customer_id,
        target_type: "context_pack",
        target_id: pack.pack_id,
        metadata: {
          profile_slug: pack.profile_slug,
          token_budget: pack.token_budget,
          estimated_tokens: pack.estimated_tokens,
        },
      },
    });
    return jsonResponse(pack, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleDomainPacksRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Domain packs are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.contextPacksRead);
  const packs = await listDomainPacks({ repoRoot: config.monorepoRoot });
  return jsonResponse({
    schema_version: 1,
    packs,
    next_actions: [
      "Select Tolling Management.",
      "Choose an output type and overlay.",
      "Generate a demo-safe artifact.",
    ],
  });
}

async function handleDomainPackDetailRoute(request, config, surface, packId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Domain packs are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.contextPacksRead);
  return jsonResponse(await getDomainPack(packId, { repoRoot: config.monorepoRoot }));
}

async function handleDomainPackSubroute(request, config, surface, packId, subroute, artifactId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Domain packs are only available in the customer portal." }, { status: 404 });
  }

  const readOnly = ["layers", "overlays", "build-options", "artifacts"].includes(subroute);
  const permission = readOnly ? PORTAL_PERMISSIONS.contextPacksRead : PORTAL_PERMISSIONS.contextPacksWrite;
  const authContext = await requirePortalAuthContext(request, config, permission);
  const artifactRoot = resolveDomainPackArtifactRoot(config, authContext);

  if (subroute === "layers") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    return jsonResponse({
      schema_version: 1,
      pack_id: packId,
      layers: await listPackLayers(packId, { repoRoot: config.monorepoRoot }),
    });
  }

  if (subroute === "overlays") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    const options = getPackBuildOptions(packId);
    return jsonResponse({
      schema_version: 1,
      pack_id: packId,
      overlays: options.agency_overlays,
      customer_overlay: options.customer_overlay,
    });
  }

  if (subroute === "build-options") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    return jsonResponse(getPackBuildOptions(packId));
  }

  if (subroute === "validate") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    enforceStateChangingRequestSecurity({ request, authContext, config });
    return jsonResponse(await validateDomainPack(packId, { repoRoot: config.monorepoRoot }));
  }

  if (subroute === "conflicts") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const body = await readJson(request, { maxBytes: config.requestLimits.domainPack });
    const conflicts = await detectPackLayerConflicts({
      pack_id: packId,
      regional_layer: body.regional_layer,
      agency_overlay: body.agency_overlay,
      customer_requirements: body.customer_requirements,
      customer_overlay: body.customer_overlay,
    }, { repoRoot: config.monorepoRoot });
    return jsonResponse({
      schema_version: 1,
      pack_id: packId,
      status: conflicts.length > 0 ? "conflicts_found" : "clear",
      conflicts,
    });
  }

  if (subroute === "generate") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const body = await readJson(request, { maxBytes: config.requestLimits.domainPack });
    const result = await writePackArtifact({
      repoRoot: artifactRoot,
      sourceRepoRoot: config.monorepoRoot,
      packId,
      outputType: body.output ?? body.output_type ?? "domain-pack",
      regionalLayer: body.regional_layer,
      agencyOverlay: body.agency_overlay,
      customerRequirements: body.customer_requirements ?? "",
      customerOverlay: body.customer_overlay,
      tokenBudget: body.token_budget,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "domain_pack_artifact.generated",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: resolveAuthWorkspaceSlug(authContext),
        customer_slug: authContext.customer_slug,
        customer_id: authContext.customer_id,
        target_type: "domain_pack_artifact",
        target_id: result.artifact_id,
        metadata: {
          pack_id: packId,
          output_type: result.manifest.output_type,
          regional_layer: body.regional_layer ?? "",
          agency_overlay: body.agency_overlay ?? "",
        },
      },
    });
    return jsonResponse(result, { status: 201 });
  }

  if (subroute === "artifacts") {
    if (artifactId) {
      if (request.method !== "GET") {
        return methodNotAllowed(["GET"]);
      }
      const artifact = await readGeneratedPackArtifact({
        repoRoot: artifactRoot,
        packId,
        artifactId,
      });
      if (!artifact) {
        return jsonResponse({ error: "Pack artifact not found." }, { status: 404 });
      }
      return jsonResponse(artifact);
    }
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    return jsonResponse({
      schema_version: 1,
      pack_id: packId,
      artifacts: await listGeneratedPackArtifacts({ repoRoot: artifactRoot, packId }),
    });
  }

  if (subroute === "sync") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const body = await readJson(request, { maxBytes: config.requestLimits.domainPack });
    return jsonResponse(await syncGeneratedPackArtifact({
      repoRoot: artifactRoot,
      packId,
      artifactId: body.artifact_id,
    }));
  }

  return jsonResponse({ error: "Domain pack route not found." }, { status: 404 });
}

function resolveDomainPackArtifactRoot(config, authContext) {
  const workspaceSlug = sanitizeSlug(resolveAuthWorkspaceSlug(authContext) || "workspace");
  return path.join(config.serviceStorageRoot, "domain-packs", workspaceSlug);
}

function resolveAuthWorkspaceSlug(authContext) {
  return authContext?.workspace_slug ?? authContext?.workspaces?.[0]?.workspace_slug ?? "";
}

function isSessionInAuthScope(session, authContext) {
  if (authContext?.actor?.access_mode === "all") {
    return true;
  }
  const allowedWorkspaceSlugs = new Set(
    (authContext.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );
  const sessionWorkspaceSlug = sanitizeSlug(resolveAuthWorkspaceSlug(authContext));
  if (sessionWorkspaceSlug) {
    allowedWorkspaceSlugs.add(sessionWorkspaceSlug);
  }
  return !session.workspace_slug || allowedWorkspaceSlugs.has(sanitizeSlug(session.workspace_slug));
}

async function loadRepositoryContractData({
  request,
  config,
  surface,
  slug,
  graphMode = "focused",
} = {}) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
    localDemoAuth: config.localDemoAuth,
  });
  const payload = await loadAccessibleRepositoryView({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    actorSlug: authContext.actor_slug,
    localDemoAuth: config.localDemoAuth,
    profileSlug: slug,
    graphMode,
  });
  if (!payload) {
    return null;
  }

  const runtimeSignals =
    surface === "portal"
      ? await loadRepositoryRuntimeSignals({
          serviceStorageRoot: config.serviceStorageRoot,
          authContext,
          apiBaseUrl: config.apiBaseUrl,
          localDemoAuth: config.localDemoAuth,
          profile: payload.profile,
        })
      : null;
  const repositoryServices = buildRepositoryServicesView({
    profile: payload.profile,
    documents: payload.documents,
    benchmarkHistory: payload.benchmark_history,
    workspace: payload.workspace,
    codeGraph: payload.code_graph,
    runtimeSignals,
  });

  return {
    authContext,
    repositoryView: payload,
    runtimeSignals,
    repositoryServices,
  };
}

async function loadRepositoryRuntimeSignals({
  serviceStorageRoot,
  authContext,
  apiBaseUrl,
  localDemoAuth,
  profile,
} = {}) {
  const usage = await loadPortalUsageSummary({
    serviceStorageRoot,
    authContext,
    apiBaseUrl,
    windowDays: 30,
    localDemoAuth,
  });
  const workspaceSlug = String(profile?.workspace_slug ?? profile?.profile_slug ?? "");
  const repo = String(profile?.repo ?? "");
  const workspaceRow = (usage?.breakdowns?.workspaces ?? []).find(
    (entry) => String(entry.workspace_slug ?? "") === workspaceSlug,
  );
  const repositoryRow = (usage?.breakdowns?.repositories ?? []).find(
    (entry) => String(entry.repo ?? "") === repo,
  );
  const sourceType =
    resolveMergedMetricSourceType(workspaceRow?.source_type, repositoryRow?.source_type) ??
    usage?.summary?.metric_sources?.live_operational ??
    "hosted_telemetry";

  return {
    source_type: sourceType,
    summary: {
      workspace_slug: workspaceSlug,
      repo,
      requests: Number(workspaceRow?.requests ?? repositoryRow?.requests ?? 0),
      input_tokens: Number(workspaceRow?.input_tokens ?? repositoryRow?.input_tokens ?? 0),
      output_tokens: Number(workspaceRow?.output_tokens ?? repositoryRow?.output_tokens ?? 0),
      estimated_token_cost_usd: Number(
        workspaceRow?.estimated_token_cost_usd ?? repositoryRow?.estimated_token_cost_usd ?? 0,
      ),
      avg_token_savings_pct: Number(
        workspaceRow?.avg_token_savings_pct ?? repositoryRow?.avg_token_savings_pct ?? 0,
      ),
      benchmark_report_count: Number(
        workspaceRow?.benchmark_report_count ?? repositoryRow?.benchmark_report_count ?? 0,
      ),
      estimated_cost_savings_usd: Number(
        workspaceRow?.estimated_cost_savings_usd ?? repositoryRow?.estimated_cost_savings_usd ?? 0,
      ),
    },
  };
}

function resolveMergedMetricSourceType(primary, secondary) {
  if (primary && secondary && primary !== secondary) {
    return "mixed";
  }

  return primary ?? secondary ?? null;
}

async function handleDocumentsRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
    sessionCookieName: config.sessionSecurity.cookieName,
    localDemoAuth: config.localDemoAuth,
  });

  if (request.method === "GET") {
    const payload = await loadAccessibleDocumentsView({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
  });

  if (request.method === "GET") {
    const requestUrl = new URL(request.url);
    const pagination = resolvePagination(requestUrl, config.pagination);
    const payload = await loadAccessibleBenchmarkIndexPage({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
      localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
  });
  const report = await loadAccessibleBenchmarkReport({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    actorSlug: authContext.actor_slug,
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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

async function handleChatCommandsRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat commands are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  enforceStateChangingRequestSecurity({
    request,
    authContext,
    config,
  });
  const body = await readJson(request, {
    maxBytes: config.requestLimits.chatCommand,
  });
  const command = buildChatCommandRecord({
    request: body,
    actor: authContext.actor,
    workspaces: authContext.workspaces,
  });
  const allowedWorkspaceSlugs = new Set(
    (authContext.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );
  const sessionWorkspaceSlug = sanitizeSlug(resolveAuthWorkspaceSlug(authContext));
  if (sessionWorkspaceSlug) {
    allowedWorkspaceSlugs.add(sessionWorkspaceSlug);
  }
  if (command.workspace_slug && !allowedWorkspaceSlugs.has(command.workspace_slug)) {
    return jsonResponse({ error: "Workspace is outside the current session scope." }, { status: 403 });
  }

  await writeChatCommandRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    command,
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "chat.command_submitted",
      outcome: command.status === "denied" ? "blocked" : "success",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: command.workspace_slug,
      customer_slug: authContext.customer_slug,
      customer_id: authContext.customer_id,
      target_type: "chat_command",
      target_id: command.command_id,
      metadata: {
        intent: command.intent,
        safety_level: command.safety.level,
        status: command.status,
      },
    },
  });

  return jsonResponse(command, { status: command.status === "denied" ? 202 : 201 });
}

async function handleChatCommandDetailRoute(request, config, surface, commandId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat commands are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  const command = await loadChatCommandRecord({
    serviceStorageRoot: config.serviceStorageRoot,
    commandId,
  });
  if (!command) {
    return jsonResponse({ error: "Chat command not found." }, { status: 404 });
  }
  const allowedWorkspaceSlugs = new Set(
    (authContext.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );
  const sessionWorkspaceSlug = sanitizeSlug(resolveAuthWorkspaceSlug(authContext));
  if (sessionWorkspaceSlug) {
    allowedWorkspaceSlugs.add(sessionWorkspaceSlug);
  }
  if (command.workspace_slug && !allowedWorkspaceSlugs.has(command.workspace_slug)) {
    return jsonResponse({ error: "Chat command not found." }, { status: 404 });
  }

  return jsonResponse(command);
}

async function handleModelsRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model settings are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.settingsRead);
  return jsonResponse(await loadModelSettings({ serviceStorageRoot: config.serviceStorageRoot }));
}

async function handleModelSettingsRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model settings are only available in the customer portal." }, { status: 404 });
  }

  if (request.method === "GET") {
    await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.settingsRead);
    return jsonResponse(await loadModelSettings({ serviceStorageRoot: config.serviceStorageRoot }));
  }

  if (request.method === "POST") {
    const authContext = await requirePortalAuthContext(
      request,
      config,
      PORTAL_PERMISSIONS.settingsWrite,
    );
    enforceStateChangingRequestSecurity({
      request,
      authContext,
      config,
    });
    const body = await readJson(request, {
      maxBytes: config.requestLimits.modelSettings,
    });
    if (containsRawModelSecret(body)) {
      return jsonResponse(
        {
          error:
            "Raw model provider secrets are not accepted by this endpoint. Configure secrets server-side and store only masked provider state.",
        },
        { status: 400 },
      );
    }
    const settings = await updateModelSettings({
      serviceStorageRoot: config.serviceStorageRoot,
      payload: body,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "model_settings.updated",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: authContext.workspace_slug,
        customer_slug: authContext.customer_slug,
        customer_id: authContext.customer_id,
        target_type: "model_settings",
        target_id: authContext.workspace_slug || "workspace",
        metadata: {
          provider_count: settings.providers.length,
          preset_count: settings.presets.length,
        },
      },
    });
    return jsonResponse(settings);
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleModelProviderKeyRoute(request, config, surface, providerId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model provider keys are only available in the customer portal." }, { status: 404 });
  }

  if (request.method === "DELETE") {
    const authContext = await requirePortalAuthContext(
      request,
      config,
      PORTAL_PERMISSIONS.settingsWrite,
    );
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const result = await deleteProviderKey({
      serviceStorageRoot: config.serviceStorageRoot,
      providerId,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "model_provider_key.deleted",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: authContext.workspace_slug,
        customer_slug: authContext.customer_slug,
        customer_id: authContext.customer_id,
        target_type: "model_provider",
        target_id: result.provider_id,
      },
    });
    return jsonResponse(result);
  }

  return methodNotAllowed(["DELETE"]);
}

async function handleModelProviderKeysRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model provider keys are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.settingsWrite,
  );
  enforceStateChangingRequestSecurity({ request, authContext, config });
  const body = await readJson(request, { maxBytes: config.requestLimits.apiKey });
  const result = await addProviderKey({
    serviceStorageRoot: config.serviceStorageRoot,
    payload: body,
    actor: authContext.actor,
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "model_provider_key.added",
      outcome: "success",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: authContext.workspace_slug,
      customer_slug: authContext.customer_slug,
      customer_id: authContext.customer_id,
      target_type: "model_provider",
      target_id: result.provider_id,
      metadata: {
        key_status: result.key_status,
      },
    },
  });
  return jsonResponse(result, { status: 201 });
}

async function handleModelProviderKeyTestRoute(request, config, surface, providerId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model provider keys are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.settingsRead,
  );
  enforceStateChangingRequestSecurity({ request, authContext, config });
  const result = await testProviderKey({
    serviceStorageRoot: config.serviceStorageRoot,
    providerId,
    fetchImpl: config.fetchImpl,
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "model_provider_key.tested",
      outcome: result.ok ? "success" : "blocked",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: authContext.workspace_slug,
      customer_slug: authContext.customer_slug,
      customer_id: authContext.customer_id,
      target_type: "model_provider",
      target_id: result.provider_id,
      metadata: {
        status: result.status,
      },
    },
  });
  return jsonResponse(result, { status: result.ok ? 200 : 400 });
}

async function handleProviderModelsRefreshRoute(request, config, surface, providerId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Model refresh is only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.settingsRead,
  );
  enforceStateChangingRequestSecurity({ request, authContext, config });
  const result = await refreshProviderModels({
    serviceStorageRoot: config.serviceStorageRoot,
    providerId,
    fetchImpl: config.fetchImpl,
  });
  return jsonResponse(result);
}

async function handleChatSessionsRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat sessions are only available in the customer portal." }, { status: 404 });
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  if (request.method === "GET") {
    return jsonResponse(await listChatSessions({
      serviceStorageRoot: config.serviceStorageRoot,
      workspaceSlug: resolveAuthWorkspaceSlug(authContext),
    }));
  }
  if (request.method === "POST") {
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const body = await readJson(request, { maxBytes: config.requestLimits.chatCommand });
    const session = await createChatSessionRecord({
      serviceStorageRoot: config.serviceStorageRoot,
      request: body,
      actor: authContext.actor,
      workspaces: authContext.workspaces,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "chat.session_created",
        outcome: "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: session.workspace_slug,
        customer_slug: authContext.customer_slug,
        customer_id: authContext.customer_id,
        target_type: "chat_session",
        target_id: session.session_id,
      },
    });
    return jsonResponse(session, { status: 201 });
  }
  return methodNotAllowed(["GET", "POST"]);
}

async function handleChatSessionDetailRoute(request, config, surface, sessionId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat sessions are only available in the customer portal." }, { status: 404 });
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  if (request.method === "GET") {
    const session = await loadChatSession({ serviceStorageRoot: config.serviceStorageRoot, sessionId });
    if (!session || !isSessionInAuthScope(session, authContext)) {
      return jsonResponse({ error: "Chat session not found." }, { status: 404 });
    }
    return jsonResponse(session);
  }
  if (request.method === "DELETE") {
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const session = await loadChatSession({ serviceStorageRoot: config.serviceStorageRoot, sessionId });
    if (!session || !isSessionInAuthScope(session, authContext)) {
      return jsonResponse({ error: "Chat session not found." }, { status: 404 });
    }
    return jsonResponse(await deleteChatSession({ serviceStorageRoot: config.serviceStorageRoot, sessionId }));
  }
  return methodNotAllowed(["GET", "DELETE"]);
}

async function handleChatSessionMessagesRoute(request, config, surface, sessionId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat sessions are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  enforceStateChangingRequestSecurity({ request, authContext, config });
  const session = await loadChatSession({ serviceStorageRoot: config.serviceStorageRoot, sessionId });
  if (!session || !isSessionInAuthScope(session, authContext)) {
    return jsonResponse({ error: "Chat session not found." }, { status: 404 });
  }
  const body = await readJson(request, { maxBytes: config.requestLimits.chatCommand });
  const result = await sendPortalChatMessage({
    serviceStorageRoot: config.serviceStorageRoot,
    sessionId,
    request: body,
    actor: authContext.actor,
    fetchImpl: config.fetchImpl,
  });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "chat.message_sent",
      outcome: "success",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: result.session.workspace_slug,
      customer_slug: authContext.customer_slug,
      customer_id: authContext.customer_id,
      target_type: "chat_session",
      target_id: result.session.session_id,
      metadata: {
        provider_id: result.session.provider_id,
        model_id: result.session.model_id,
      },
    },
  });
  return jsonResponse(result, { status: 201 });
}

async function handleChatSessionMessagesStreamRoute(request, config, surface, sessionId) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat sessions are only available in the customer portal." }, { status: 404 });
  }
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }
  const authContext = await requirePortalAuthContext(
    request,
    config,
    PORTAL_PERMISSIONS.repositoriesRead,
  );
  enforceStateChangingRequestSecurity({ request, authContext, config });
  const session = await loadChatSession({ serviceStorageRoot: config.serviceStorageRoot, sessionId });
  if (!session || !isSessionInAuthScope(session, authContext)) {
    return jsonResponse({ error: "Chat session not found." }, { status: 404 });
  }
  const body = await readJson(request, { maxBytes: config.requestLimits.chatCommand });
  await writeAuditEvent({
    serviceStorageRoot: config.serviceStorageRoot,
    event: {
      action: "chat.message_stream_started",
      outcome: "success",
      surface,
      actor_slug: authContext.actor.actor_slug,
      workspace_slug: session.workspace_slug,
      customer_slug: authContext.customer_slug,
      customer_id: authContext.customer_id,
      target_type: "chat_session",
      target_id: session.session_id,
      metadata: {
        provider_id: body.provider_id ?? session.provider_id,
        model_id: body.model_id ?? session.model_id,
      },
    },
  });
  return sseResponse(streamPortalChatMessage({
    serviceStorageRoot: config.serviceStorageRoot,
    sessionId,
    request: body,
    actor: authContext.actor,
    fetchImpl: config.fetchImpl,
  }));
}

function sseResponse(events) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(sseEvent(event.event ?? "message", event)));
        }
      } catch (error) {
        controller.enqueue(encoder.encode(sseEvent("run_failed", {
          schema_version: 1,
          event: "run_failed",
          error: {
            message: error?.message ?? "Chat stream failed.",
            status: error?.status ?? 500,
          },
        })));
      } finally {
        controller.close();
      }
    },
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      Connection: "keep-alive",
    },
  });
}

async function handleChatToolsRoute(request, config, surface) {
  if (surface !== "portal") {
    return jsonResponse({ error: "Chat tools are only available in the customer portal." }, { status: 404 });
  }
  await requirePortalAuthContext(request, config, PORTAL_PERMISSIONS.repositoriesRead);
  if (request.method === "GET") {
    return jsonResponse(listChatAllowedTools());
  }
  if (request.method === "POST") {
    const authContext = await requirePortalAuthContext(
      request,
      config,
      PORTAL_PERMISSIONS.repositoriesRead,
    );
    enforceStateChangingRequestSecurity({ request, authContext, config });
    const body = await readJson(request, { maxBytes: config.requestLimits.chatCommand });
    const result = await executePortalAgentTool({
      serviceStorageRoot: config.serviceStorageRoot,
      monorepoRoot: config.monorepoRoot,
      actor: authContext.actor,
      toolId: body.tool_id,
      input: body.input,
      confirmed: body.confirmed,
    });
    await writeAuditEvent({
      serviceStorageRoot: config.serviceStorageRoot,
      event: {
        action: "chat.tool_requested",
        outcome: result.status === "denied" ? "blocked" : "success",
        surface,
        actor_slug: authContext.actor.actor_slug,
        workspace_slug: authContext.workspace_slug,
        customer_slug: authContext.customer_slug,
        customer_id: authContext.customer_id,
        target_type: "agent_tool",
        target_id: result.tool_id,
        metadata: {
          status: result.status,
          safety_level: result.safety_level,
        },
      },
    });
    return jsonResponse(result, { status: result.status === "denied" ? 403 : 200 });
  }
  return methodNotAllowed(["GET", "POST"]);
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
  if (effectivePath === "/api/api-keys" && surface === "portal") {
    return { kind: "portal-api-keys", surface };
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
  if (effectivePath === "/api/chat/commands") {
    return { kind: "chat-commands", surface };
  }
  if (effectivePath === "/api/chat/sessions") {
    return { kind: "chat-sessions", surface };
  }
  if (effectivePath === "/api/chat/tools") {
    return { kind: "chat-tools", surface };
  }
  if (effectivePath === "/api/domain-packs") {
    return { kind: "domain-packs", surface };
  }
  if (effectivePath === "/api/models") {
    return { kind: "models", surface };
  }
  if (effectivePath === "/api/model-settings") {
    return { kind: "model-settings", surface };
  }
  if (effectivePath === "/api/model-provider-keys") {
    return { kind: "model-provider-keys", surface };
  }

  const repositorySyncMatch = effectivePath.match(/^\/api\/repositories\/([^/]+)\/sync$/);
  if (repositorySyncMatch) {
    return {
      kind: "repository-sync",
      surface,
      slug: repositorySyncMatch[1],
    };
  }
  const repositoryGraphSummaryMatch = effectivePath.match(/^\/api\/repositories\/([^/]+)\/graph\/summary$/);
  if (repositoryGraphSummaryMatch) {
    return {
      kind: "repository-graph-summary",
      surface,
      slug: repositoryGraphSummaryMatch[1],
    };
  }
  const repositoryDiagramsMatch = effectivePath.match(/^\/api\/repositories\/([^/]+)\/diagrams$/);
  if (repositoryDiagramsMatch) {
    return {
      kind: "repository-diagrams",
      surface,
      slug: repositoryDiagramsMatch[1],
    };
  }
  const repositoryContextPacksMatch = effectivePath.match(/^\/api\/repositories\/([^/]+)\/context-packs$/);
  if (repositoryContextPacksMatch) {
    return {
      kind: "repository-context-packs",
      surface,
      slug: repositoryContextPacksMatch[1],
    };
  }
  const chatCommandMatch = effectivePath.match(/^\/api\/chat\/commands\/([^/]+)$/);
  if (chatCommandMatch) {
    return {
      kind: "chat-command-detail",
      surface,
      commandId: chatCommandMatch[1],
    };
  }
  const chatSessionMessagesMatch = effectivePath.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/);
  if (chatSessionMessagesMatch) {
    return {
      kind: "chat-session-messages",
      surface,
      sessionId: chatSessionMessagesMatch[1],
    };
  }
  const chatSessionMessagesStreamMatch = effectivePath.match(/^\/api\/chat\/sessions\/([^/]+)\/messages\/stream$/);
  if (chatSessionMessagesStreamMatch) {
    return {
      kind: "chat-session-messages-stream",
      surface,
      sessionId: chatSessionMessagesStreamMatch[1],
    };
  }
  const chatSessionMatch = effectivePath.match(/^\/api\/chat\/sessions\/([^/]+)$/);
  if (chatSessionMatch) {
    return {
      kind: "chat-session-detail",
      surface,
      sessionId: chatSessionMatch[1],
    };
  }
  const providerModelsRefreshMatch = effectivePath.match(/^\/api\/models\/providers\/([^/]+)\/refresh$/);
  if (providerModelsRefreshMatch) {
    return {
      kind: "provider-models-refresh",
      surface,
      providerId: providerModelsRefreshMatch[1],
    };
  }
  const providerKeyTestMatch = effectivePath.match(/^\/api\/model-provider-keys\/([^/]+)\/test$/);
  if (providerKeyTestMatch) {
    return {
      kind: "model-provider-key-test",
      surface,
      providerId: providerKeyTestMatch[1],
    };
  }
  const providerKeyMatch = effectivePath.match(/^\/api\/model-provider-keys\/([^/]+)$/);
  if (providerKeyMatch) {
    return {
      kind: "model-provider-key",
      surface,
      providerId: providerKeyMatch[1],
    };
  }

  const domainPackArtifactMatch = effectivePath.match(/^\/api\/domain-packs\/([^/]+)\/artifacts\/([^/]+)$/);
  if (domainPackArtifactMatch) {
    return {
      kind: "domain-pack-subroute",
      surface,
      packId: domainPackArtifactMatch[1],
      subroute: "artifacts",
      artifactId: domainPackArtifactMatch[2],
    };
  }
  const domainPackSubrouteMatch = effectivePath.match(/^\/api\/domain-packs\/([^/]+)\/([^/]+)$/);
  if (domainPackSubrouteMatch) {
    return {
      kind: "domain-pack-subroute",
      surface,
      packId: domainPackSubrouteMatch[1],
      subroute: domainPackSubrouteMatch[2],
    };
  }
  const domainPackDetailMatch = effectivePath.match(/^\/api\/domain-packs\/([^/]+)$/);
  if (domainPackDetailMatch) {
    return {
      kind: "domain-pack-detail",
      surface,
      packId: domainPackDetailMatch[1],
    };
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

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

function errorResponse(error, fallbackMessage, { traceId } = {}) {
  const status = Number(error?.statusCode ?? 500);
  const safeMessage = status >= 500
    ? fallbackMessage
    : redactSensitiveString(error?.message || fallbackMessage);
  return jsonResponse(
    {
      error: safeMessage,
      error_code: String(error?.errorCode ?? error?.code ?? `HTTP_${status}`),
      trace_id: traceId,
    },
    { status },
  );
}

function withTraceHeader(response, traceId) {
  const nextHeaders = new Headers(response.headers);
  nextHeaders.set("X-Be-AI-Heart-Trace-Id", traceId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: nextHeaders,
  });
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
    "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Be-AI-Heart-Trace-Id",
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

function toClientApiKeyRecord(session) {
  return {
    key_id: session.session_id,
    session_family_id: session.session_family_id,
    label: session.metadata?.label ?? "CLI API key",
    actor_slug: session.actor_slug,
    workspace_slug: session.workspace_slug,
    customer_slug: session.customer_slug,
    issued_at: session.issued_at,
    expires_at: session.expires_at,
    last_seen_at: session.last_seen_at,
    status: session.revoked_at
      ? "revoked"
      : session.expires_at && session.expires_at < new Date().toISOString()
        ? "expired"
        : "active",
    api_key: "",
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

function sanitizeApiKeyLabel(value) {
  const label = String(value ?? "CLI API key")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return label || "CLI API key";
}

function resolveApiKeyExpiresAt(value) {
  const requestedDays = value === undefined || value === null || value === ""
    ? 90
    : Number(value);
  if (!Number.isFinite(requestedDays) || requestedDays <= 0) {
    throw createHttpError(400, "expires_in_days must be a positive number.");
  }
  const days = Math.min(Math.floor(requestedDays), 365);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function writeRequestTraceForResponse({
  config,
  serviceStorageRoot,
  request,
  route,
  response,
  startedAtMs,
  traceId,
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
      trace_id: traceId,
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
        query: redactUrlSearch(requestUrl.search),
      },
    },
  });
}

function resolveTraceId(request) {
  const provided = String(request.headers.get("x-be-ai-heart-trace-id") ?? "").trim();
  return /^[a-zA-Z0-9._:-]{8,120}$/.test(provided) ? provided : randomUUID();
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
    localDemoAuth: config.localDemoAuth,
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
    localDemoAuth: config.localDemoAuth,
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
