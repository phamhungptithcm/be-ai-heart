import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeWebDocumentSubmission } from "../../../packages/document-sync/src/index.js";
import {
  buildDefaultPortalAuthLinks,
  completeProviderAuthorization,
  createProviderAuthorizationRequest,
  createWebsiteIntakeRequest,
  issueProviderWorkspaceSession,
  issueWorkspaceSession,
  listAccessibleRepositoryProfiles,
  listAccessibleWorkspaces,
  listConfiguredAuthProviders,
  listWebsiteIntakeRequests,
  loadAccessibleBenchmarkIndex,
  loadAccessibleBenchmarkReport,
  loadAccessibleDocumentsView,
  loadAccessibleRepositoryView,
  provisionWorkspaceForActor,
  resolveAllowedReturnTo,
  resolveRequestAuthContext,
  resolveServiceStorageRoot,
  summarizeWebsiteIntakeRequests,
  writeBenchmarkReportForActor,
  writeRepositoryDocumentsForActor,
  writeRepositoryProfileForActor,
} from "./index.js";
import {
  createHostedMcpErrorResponse,
  handleHostedMcpMessage,
} from "./mcp.js";
import {
  buildMcpAuthorizationServerMetadata,
  buildMcpProtectedResourceMetadata,
  completeMcpAuthorization,
  createMcpAuthorizationRequest,
  createMcpUnauthorizedResponse,
  exchangeMcpAuthorizationCode,
} from "./mcp-oauth.js";

export async function handleServiceHttpRequest(request, options = {}) {
  const config = resolveHttpConfig(options);
  const requestUrl = new URL(request.url);
  const route = matchRoute(requestUrl.pathname);

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), request, config);
  }

  if (route?.kind === "health") {
    return withCors(
      jsonResponse({
        service: "beheart-api",
        status: "ok",
        storage_backend: process.env.BE_AI_HEART_SERVICE_STORAGE_BACKEND ?? "sqlite",
      }),
      request,
      config,
    );
  }

  if (route?.kind === "auth-providers") {
    const surface = requestUrl.searchParams.get("surface") ?? "portal";
    const returnTo = resolveAllowedReturnTo({
      surface,
      returnTo: requestUrl.searchParams.get("return_to"),
    });
    return withCors(
      jsonResponse({
        ...listConfiguredAuthProviders({
          apiBaseUrl: config.apiBaseUrl,
          surface,
          returnTo,
        }),
        ...buildDefaultPortalAuthLinks({
          apiBaseUrl: config.apiBaseUrl,
        }),
      }),
      request,
      config,
    );
  }

  if (route?.kind === "mcp-oauth-authorization-server") {
    if (request.method !== "GET") {
      return withCors(methodNotAllowed(["GET"]), request, config);
    }
    return withCors(
      jsonResponse(buildMcpAuthorizationServerMetadata({ apiBaseUrl: config.apiBaseUrl })),
      request,
      config,
    );
  }

  if (route?.kind === "mcp-oauth-protected-resource") {
    if (request.method !== "GET") {
      return withCors(methodNotAllowed(["GET"]), request, config);
    }
    return withCors(
      jsonResponse(
        buildMcpProtectedResourceMetadata({
          apiBaseUrl: config.apiBaseUrl,
          surface: route.surface,
        }),
      ),
      request,
      config,
    );
  }

  if (route?.kind === "mcp-oauth-authorize") {
    if (request.method !== "GET") {
      return withCors(methodNotAllowed(["GET"]), request, config);
    }
    try {
      const result = await createMcpAuthorizationRequest({
        serviceStorageRoot: config.serviceStorageRoot,
        apiBaseUrl: config.apiBaseUrl,
        providerId: requestUrl.searchParams.get("provider"),
        responseType: requestUrl.searchParams.get("response_type") ?? "code",
        surface: requestUrl.searchParams.get("surface") ?? "portal",
        workspaceSlug: requestUrl.searchParams.get("workspace"),
        customerSlug: requestUrl.searchParams.get("customer"),
        clientId: requestUrl.searchParams.get("client_id"),
        redirectUri: requestUrl.searchParams.get("redirect_uri"),
        state: requestUrl.searchParams.get("state"),
        codeChallenge: requestUrl.searchParams.get("code_challenge"),
        codeChallengeMethod: requestUrl.searchParams.get("code_challenge_method") ?? "S256",
        scope: requestUrl.searchParams.get("scope") ?? "mcp:read",
      });
      return withCors(Response.redirect(result.authorize_url, 302), request, config);
    } catch (error) {
      return withCors(errorResponse(error, "Failed to start MCP OAuth flow."), request, config);
    }
  }

  if (route?.kind === "mcp-oauth-callback") {
    if (request.method !== "GET") {
      return withCors(methodNotAllowed(["GET"]), request, config);
    }
    try {
      const result = await completeMcpAuthorization({
        serviceStorageRoot: config.serviceStorageRoot,
        requestUrl,
      });
      return withCors(Response.redirect(result.redirect_url, 302), request, config);
    } catch (error) {
      return withCors(errorResponse(error, "Failed to complete MCP OAuth flow."), request, config);
    }
  }

  if (route?.kind === "mcp-oauth-token") {
    if (request.method !== "POST") {
      return withCors(methodNotAllowed(["POST"]), request, config);
    }

    try {
      const form = await readForm(request);
      if ((form.get("grant_type") ?? "").trim() !== "authorization_code") {
        return withCors(
          jsonResponse({ error: "grant_type must be authorization_code." }, { status: 400 }),
          request,
          config,
        );
      }
      const result = await exchangeMcpAuthorizationCode({
        serviceStorageRoot: config.serviceStorageRoot,
        code: form.get("code"),
        clientId: form.get("client_id"),
        redirectUri: form.get("redirect_uri"),
        codeVerifier: form.get("code_verifier"),
      });
      return withCors(jsonResponse(result), request, config);
    } catch (error) {
      return withCors(errorResponse(error, "Failed to exchange MCP OAuth code."), request, config);
    }
  }

  if (route?.kind === "auth-authorize") {
    try {
      const result = await createProviderAuthorizationRequest({
        serviceStorageRoot: config.serviceStorageRoot,
        providerId: route.providerId,
        surface: requestUrl.searchParams.get("surface") ?? "portal",
        workspaceSlug: requestUrl.searchParams.get("workspace"),
        customerSlug: requestUrl.searchParams.get("customer"),
        returnTo: requestUrl.searchParams.get("return_to"),
        apiBaseUrl: config.apiBaseUrl,
      });
      return withCors(Response.redirect(result.authorize_url, 302), request, config);
    } catch (error) {
      return withCors(errorResponse(error, "Failed to start provider auth flow."), request, config);
    }
  }

  if (route?.kind === "auth-callback") {
    try {
      const result = await completeProviderAuthorization({
        serviceStorageRoot: config.serviceStorageRoot,
        providerId: route.providerId,
        requestUrl,
        apiBaseUrl: config.apiBaseUrl,
      });
      return withCors(Response.redirect(result.redirect_url, 302), request, config);
    } catch (error) {
      return withCors(errorResponse(error, "Failed to complete provider auth flow."), request, config);
    }
  }

  if (!route) {
    return withCors(jsonResponse({ error: "Route not found." }, { status: 404 }), request, config);
  }

  try {
    switch (route.kind) {
      case "session":
        return withCors(await handleSessionRoute(request, config, route.surface), request, config);
      case "public-intake":
        return withCors(await handlePublicIntakeRoute(request, config), request, config);
      case "admin-intake":
        return withCors(await handleAdminIntakeRoute(request, config), request, config);
      case "session-provider":
        return withCors(await handleProviderSessionRoute(request, config, route.surface), request, config);
      case "workspaces":
        return withCors(await handleWorkspacesRoute(request, config, route.surface), request, config);
      case "repositories":
        return withCors(await handleRepositoriesRoute(request, config, route.surface), request, config);
      case "repository-detail":
        return withCors(
          await handleRepositoryDetailRoute(request, config, route.surface, route.slug),
          request,
          config,
        );
      case "documents":
        return withCors(await handleDocumentsRoute(request, config, route.surface), request, config);
      case "document-submissions":
        return withCors(
          await handleDocumentSubmissionsRoute(request, config, route.surface),
          request,
          config,
        );
      case "benchmarks":
        return withCors(await handleBenchmarksRoute(request, config, route.surface), request, config);
      case "benchmark-detail":
        return withCors(
          await handleBenchmarkDetailRoute(request, config, route.surface, route.reportId),
          request,
          config,
        );
      case "mcp":
        return withCors(await handleMcpRoute(request, config, route.surface), request, config);
      default:
        return withCors(jsonResponse({ error: "Route not implemented." }, { status: 404 }), request, config);
    }
  } catch (error) {
    return withCors(errorResponse(error, "Service request failed."), request, config);
  }
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
  };
}

async function handleSessionRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
  });

  if (request.method === "GET") {
    return jsonResponse({
      actor: authContext.actor,
      session: authContext.session,
      workspace: authContext.workspace,
      workspace_identity: authContext.workspace_identity,
      workspace_count: authContext.workspaces.length,
    });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }

    const payload = await readJson(request);
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

    return jsonResponse({ session }, { status: 201 });
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function handleProviderSessionRoute(request, config, surface) {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const payload = await readJson(request);
  const result = await issueProviderWorkspaceSession({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    idToken: payload?.id_token ?? payload?.token,
    workspaceSlug: payload?.workspace_slug,
    customerSlug: payload?.customer_slug,
    providerConfig: payload?.provider_config,
  });

  return jsonResponse(result, { status: 201 });
}

async function handlePublicIntakeRoute(request, config) {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    const payload = await readJson(request);
    const intakeRequest = await createWebsiteIntakeRequest({
      serviceStorageRoot: config.serviceStorageRoot,
      request: payload,
    });
    return jsonResponse(intakeRequest, { status: 201 });
  } catch (error) {
    return jsonResponse(
      {
        error: error?.message || "Invalid intake request.",
      },
      { status: 400 },
    );
  }
}

async function handleAdminIntakeRoute(request, config) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface: "admin",
    request,
  });

  if (!authContext.actor || authContext.actor.surface !== "admin") {
    return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
  }

  const intakeKind = new URL(request.url).searchParams.get("kind") ?? undefined;
  const requests = await listWebsiteIntakeRequests({
    serviceStorageRoot: config.serviceStorageRoot,
    intakeKind,
  });

  return jsonResponse({
    requests,
    summary: summarizeWebsiteIntakeRequests(requests),
  });
}

async function handleWorkspacesRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
  });

  if (request.method === "GET") {
    const workspaces = await listAccessibleWorkspaces({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
    });
    return jsonResponse({ workspaces });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }

    const payload = await readJson(request);
    const result = await provisionWorkspaceForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      workspace: payload,
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
  });

  if (request.method === "GET") {
    const profiles = await listAccessibleRepositoryProfiles({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      actorSlug: authContext.actor_slug,
    });
    return jsonResponse({ profiles });
  }

  if (request.method === "POST") {
    if (!authContext.actor) {
      return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
    }

    const payload = await readJson(request);
    const result = await writeRepositoryProfileForActor({
      serviceStorageRoot: config.serviceStorageRoot,
      surface,
      authContext,
      profile: payload?.profile ?? payload,
      portalRoot: config.portalRoot,
      adminRoot: config.adminRoot,
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

    const payload = await readJson(request);
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

  const payload = await readJson(request);
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
  });
  if (!authContext.actor || !authContext.session) {
    return jsonResponse({ error: "Unauthenticated request." }, { status: 401 });
  }

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

  return jsonResponse(submission, { status: 201 });
}

async function handleBenchmarksRoute(request, config, surface) {
  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
  });

  if (request.method === "GET") {
    const payload = await loadAccessibleBenchmarkIndex({
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

    const payload = await readJson(request);
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

async function handleBenchmarkDetailRoute(request, config, surface, reportId) {
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
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

async function handleMcpRoute(request, config, surface) {
  if (!hasValidMcpOrigin(request, config)) {
    return jsonResponse({ error: "Origin is not allowed for MCP requests." }, { status: 403 });
  }

  if (request.method === "GET") {
    return methodNotAllowed(["POST"]);
  }

  if (request.method !== "POST") {
    return methodNotAllowed(["GET", "POST"]);
  }

  const authContext = await resolveRequestAuthContext({
    serviceStorageRoot: config.serviceStorageRoot,
    surface,
    request,
  });
  if (!authContext.actor || !authContext.session) {
    return createMcpUnauthorizedResponse({
      apiBaseUrl: config.apiBaseUrl,
      surface,
    });
  }

  const payload = await readJson(request);
  if (isJsonRpcNotificationOrResponse(payload)) {
    return new Response(null, { status: 202 });
  }

  if (Array.isArray(payload)) {
    const responses = await Promise.all(
      payload.map((message) =>
        isJsonRpcNotificationOrResponse(message)
          ? Promise.resolve(null)
          : handleHostedMcpMessage({
              message,
              serviceStorageRoot: config.serviceStorageRoot,
              surface,
              actorSlug: authContext.actor_slug,
              defaultProfileSlug: authContext.workspace_identity?.profile_slug ?? authContext.workspace_slug,
            }),
      ),
    );
    const filteredResponses = responses.filter(Boolean);
    if (filteredResponses.length === 0) {
      return new Response(null, { status: 202 });
    }
    return jsonResponse(filteredResponses);
  }

  const response = payload && typeof payload === "object"
    ? await handleHostedMcpMessage({
        message: payload,
        serviceStorageRoot: config.serviceStorageRoot,
        surface,
        actorSlug: authContext.actor_slug,
        defaultProfileSlug: authContext.workspace_identity?.profile_slug ?? authContext.workspace_slug,
      })
    : createHostedMcpErrorResponse(null, -32600, "Invalid Request");

  if (!response) {
    return new Response(null, { status: 202 });
  }

  return jsonResponse(response);
}

function matchRoute(pathname) {
  if (pathname === "/health") {
    return { kind: "health" };
  }
  if (pathname === "/.well-known/oauth-authorization-server") {
    return { kind: "mcp-oauth-authorization-server" };
  }
  if (pathname === "/.well-known/oauth-protected-resource") {
    return { kind: "mcp-oauth-protected-resource", surface: "portal" };
  }
  if (pathname === "/api/admin/.well-known/oauth-protected-resource") {
    return { kind: "mcp-oauth-protected-resource", surface: "admin" };
  }
  if (pathname === "/oauth/authorize") {
    return { kind: "mcp-oauth-authorize" };
  }
  if (pathname === "/oauth/callback/mcp") {
    return { kind: "mcp-oauth-callback" };
  }
  if (pathname === "/oauth/token") {
    return { kind: "mcp-oauth-token" };
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
  if (effectivePath === "/api/intake" && surface === "admin") {
    return { kind: "admin-intake", surface };
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
  if (effectivePath === "/api/mcp") {
    return { kind: "mcp", surface };
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

  return null;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readForm(request) {
  try {
    const raw = await request.text();
    return new URLSearchParams(raw);
  } catch {
    return new URLSearchParams();
  }
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
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
    {
      status:
        error?.message && /required|invalid|expired|not configured|unsupported/i.test(error.message)
          ? 400
          : 500,
    },
  );
}

function withCors(response, request, config) {
  const origin = request.headers.get("origin");
  const allowedOrigin = resolveAllowedOrigin(origin, config);
  const nextHeaders = new Headers(response.headers);
  nextHeaders.set("Vary", "Origin");
  nextHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
  nextHeaders.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  nextHeaders.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Be-AI-Heart-Session, X-Be-AI-Heart-Actor, X-Be-AI-Heart-Workspace",
  );

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

  const parsedOrigin = safeParseUrl(origin);
  if (parsedOrigin && isLocalLoopbackOrigin(parsedOrigin)) {
    return origin;
  }

  const allowedOrigins = new Set([
    new URL(config.apiBaseUrl).origin,
    new URL(process.env.BE_AI_HEART_WEBSITE_BASE_URL ?? "http://127.0.0.1:3000").origin,
    new URL(process.env.BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001").origin,
    new URL(process.env.BE_AI_HEART_ADMIN_BASE_URL ?? "http://127.0.0.1:3002").origin,
  ]);
  return allowedOrigins.has(origin) ? origin : "null";
}

function hasValidMcpOrigin(request, config) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  return resolveAllowedOrigin(origin, config) !== "null";
}

function isJsonRpcNotificationOrResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  if (typeof value.method === "string" && !("id" in value)) {
    return true;
  }

  return !("method" in value) && ("result" in value || "error" in value);
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
