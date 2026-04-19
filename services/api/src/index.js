export const apiManifest = {
  service: "api",
  endpoints: [
    "/health",
    "/metrics",
    "/api/auth/providers",
    "/auth/authorize/:providerId",
    "/auth/callback/:providerId",
    "/api/session",
    "/api/session/provider",
    "/api/account",
    "/api/overview",
    "/api/usage/summary",
    "/api/members",
    "/api/policies",
    "/api/security",
    "/api/settings",
    "/api/sessions",
    "/api/audit/events",
    "/api/workspaces",
    "/api/repositories",
    "/api/repositories/:slug",
    "/api/documents",
    "/api/documents/submissions",
    "/api/benchmarks",
    "/api/benchmarks/:reportId",
    "/api/benchmarks/runs",
    "/api/benchmarks/runs/:launchId",
    "/proxy/openai/runs/:runId/v1/*",
    "/api/public/intake",
    "/api/admin/intake",
    "/api/admin/overview",
    "/api/admin/customers/inventory",
    "/api/admin/billing-ops",
    "/api/admin/session",
    "/api/admin/session/provider",
    "/api/admin/workspaces",
    "/api/admin/repositories",
    "/api/admin/repositories/:slug",
    "/api/admin/documents",
    "/api/admin/documents/submissions",
    "/api/admin/benchmarks",
    "/api/admin/benchmarks/:reportId",
    "/api/admin/audit/events",
    "/api/admin/sessions",
    "/api/admin/observability/requests",
    "/api/admin/observability/metrics",
    "/api/admin/observability/alerts",
    "/api/admin/observability/exports",
  ],
};

export {
  listAccessibleRepositoryProfiles,
  listAccessibleRepositoryProfilesPage,
  listAccessibleWorkspaces,
  listAccessibleWorkspacesPage,
  loadAccessibleBenchmarkIndex,
  loadAccessibleBenchmarkIndexPage,
  loadAccessibleBenchmarkReport,
  loadAccessibleDocumentsView,
  loadAccessibleRepositoryView,
  loadAccessRegistry,
  replaceActorMemberships,
  resolveActor,
  upsertActor,
} from "./access.js";

export {
  listWorkspaceIdentities,
  loadWorkspaceIdentity,
  upsertWorkspaceIdentity,
} from "./identity.js";

export {
  ensureCustomer,
  listCustomers,
  loadCustomer,
} from "./customer-registry.js";

export {
  getServiceStoragePaths,
  consumeRateLimitWindow,
  loadAgentRunCapture,
  loadAgentRunRecord,
  loadBenchmarkLaunchRecord,
  listAuditEvents,
  listBenchmarkLaunchRecords,
  listLlmCallRecords,
  listRequestTraces,
  loadWorkspaceCatalog,
  publishDocumentsToSurface,
  listDocumentSubmissionRecords,
  publishProfilesToSurface,
  publishBenchmarksToSurface,
  publishDocumentSubmissionsToSurface,
  publishWorkspacesToSurface,
  pruneExpiredRateLimits,
  resolveServiceDatabasePath,
  resolveServiceStorageRoot,
  writeAgentRunRecord,
  writeAuditEvent,
  writeLlmCallRecord,
  writeBenchmarkLaunchRecord,
  writeRequestTrace,
  writeRepositoryDocumentArtifactRecord,
  writeRepositoryProfileArtifactRecord,
  writeBenchmarkArtifactRecord,
  writeDocumentSubmissionRecord,
} from "./storage.js";

export {
  deliverPendingObservabilityExports,
  isObservabilityExportEnabled,
  listObservabilityExports,
  queueObservabilityExport,
  resolveObservabilityExportConfig,
} from "./observability-export.js";

export {
  listWorkspaceBenchmarkLaunches,
  loadWorkspaceBenchmarkLaunchDetail,
  requestWorkspaceBenchmarkLaunch,
  resolveWorkspaceBenchmarkRunnerCapability,
} from "./benchmark-launcher.js";

export {
  ensureDefaultSessions,
  issueWorkspaceSession,
  revokeWorkspaceSession,
  revokeWorkspaceSessions,
  listWorkspaceSessions,
  resolveRequestAuthContext,
  resolveWorkspaceSession,
  rotateWorkspaceSession,
} from "./session.js";

export {
  consumeAuthTransaction,
  createAuthTransaction,
  loadAuthTransaction,
} from "./auth-transactions.js";

export {
  issueProviderWorkspaceSession,
  resolveProviderConfig,
  verifyProviderToken,
} from "./auth-provider.js";

export {
  buildDefaultPortalAuthLinks,
  completeProviderAuthorization,
  createProviderAuthorizationRequest,
} from "./oidc-auth.js";

export { runHostedAuthSmoke } from "./hosted-auth-smoke.js";
export { startMockOidcProvider } from "./mock-oidc-provider.js";
export { startServiceHost } from "./server.js";
export {
  listOperationalAlerts,
  renderPrometheusMetrics,
  summarizeHostedTrafficMetrics,
} from "./observability.js";

export {
  listConfiguredAuthProviders,
  normalizeBaseUrl,
  resolveAllowedReturnTo,
  resolveHostedAuthProvider,
  resolveSurfaceBaseUrls,
} from "./provider-config.js";

export {
  provisionWorkspaceForActor,
  writeBenchmarkReportForActor,
  writeRepositoryDocumentsForActor,
  writeRepositoryProfileForActor,
} from "./write-access.js";

export {
  createWebsiteIntakeRequest,
  listWebsiteIntakeRequests,
  listWebsiteIntakeRequestsPage,
  summarizeWebsiteIntakeRequestsByQuery,
  summarizeWebsiteIntakeRequests,
} from "./intake.js";

export {
  loadPortalAccountView,
  loadPortalOverviewSummary,
  loadPortalUsageSummary,
  loadPortalMembersView,
  loadPortalPoliciesView,
  loadPortalSecurityView,
  loadPortalBillingSnapshot,
  loadPortalSettingsView,
} from "./customer-portal.js";

export {
  loadAdminBillingOpsView,
  loadAdminCustomerInventoryView,
  loadAdminOverviewView,
} from "./admin-control-plane.js";

export {
  resolveAuthProviderAdapter,
  resolveBillingProviderAdapter,
} from "./provider-adapters.js";
