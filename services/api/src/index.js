export const apiManifest = {
  service: "api",
  endpoints: [
    "/health",
    "/v1/repositories",
    "/v1/portal/repository-profiles",
    "/v1/portal/repository-profiles/:slug",
    "/v1/portal/benchmarks",
    "/v1/portal/benchmarks/:reportId",
    "/v1/portal/workspaces",
    "/v1/portal/document-submissions",
    "/v1/portal/documents",
    "/v1/portal/documents/:profileSlug",
    "/v1/portal/licenses",
    "/v1/admin/customers",
    "/v1/admin/benchmarks",
    "/v1/admin/workspaces",
    "/v1/admin/revenue",
    "/v1/admin/support-cases",
    "/v1/admin/intake",
    "/v1/admin/document-submissions",
    "/v1/admin/repository-profiles/:slug",
    "/v1/public/intake",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
    "/api/admin/.well-known/oauth-protected-resource",
    "/oauth/authorize",
    "/oauth/callback/mcp",
    "/oauth/token",
    "/api/mcp",
    "/api/admin/mcp",
  ],
};

export {
  listAccessibleRepositoryProfiles,
  listAccessibleWorkspaces,
  loadAccessibleBenchmarkIndex,
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
  getServiceStoragePaths,
  loadWorkspaceCatalog,
  publishDocumentsToSurface,
  listDocumentSubmissionRecords,
  publishProfilesToSurface,
  publishBenchmarksToSurface,
  publishDocumentSubmissionsToSurface,
  publishWorkspacesToSurface,
  resolveServiceDatabasePath,
  resolveServiceStorageRoot,
  writeRepositoryDocumentArtifactRecord,
  writeRepositoryProfileArtifactRecord,
  writeBenchmarkArtifactRecord,
  writeDocumentSubmissionRecord,
} from "./storage.js";

export {
  ensureDefaultSessions,
  issueWorkspaceSession,
  resolveRequestAuthContext,
  resolveWorkspaceSession,
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
  summarizeWebsiteIntakeRequests,
} from "./intake.js";
