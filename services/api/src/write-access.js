import {
  publishBenchmarksToSurface,
  publishDocumentsToSurface,
  publishProfilesToSurface,
  publishWorkspacesToSurface,
  writeAuditEvent,
  writeBenchmarkArtifactRecord,
  writeRepositoryDocumentArtifactRecord,
  writeRepositoryProfileArtifactRecord,
} from "./storage.js";
import { loadWorkspaceIdentity, upsertWorkspaceIdentity } from "./identity.js";

export async function provisionWorkspaceForActor({
  serviceStorageRoot,
  surface,
  authContext,
  workspace,
} = {}) {
  const targetWorkspaceSlug = sanitizeSlug(
    workspace?.workspace_slug ?? workspace?.profile_slug ?? workspace?.repo ?? "",
  );
  if (!targetWorkspaceSlug) {
    throw new Error("workspace_slug or profile_slug is required.");
  }

  const identity = await resolveWritableWorkspaceIdentity({
    serviceStorageRoot,
    surface,
    authContext,
    workspaceSlug: targetWorkspaceSlug,
    customerSlug: workspace?.customer_slug,
    repo: workspace?.repo,
    displayName: workspace?.display_name,
    plan: workspace?.plan,
    source: workspace?.source ?? `${surface}-workspace-provision`,
    metadata: workspace?.metadata,
  });

  return {
    workspace_identity: identity,
  };
}

export async function writeRepositoryProfileForActor({
  serviceStorageRoot,
  surface,
  authContext,
  profile,
  portalRoot,
  adminRoot,
  workspaceMetadata,
} = {}) {
  if (!profile || typeof profile !== "object") {
    throw new Error("profile payload is required.");
  }

  const targetWorkspaceSlug = sanitizeSlug(
    profile.workspace_slug ?? profile.profile_slug ?? authContext?.workspace_slug ?? "",
  );
  if (!targetWorkspaceSlug) {
    throw new Error("profile_slug or workspace_slug is required.");
  }

  const identity = await resolveWritableWorkspaceIdentity({
    serviceStorageRoot,
    surface,
    authContext,
    workspaceSlug: targetWorkspaceSlug,
    customerSlug: profile.customer_slug,
    repo: profile.repo,
    displayName: profile.display_name,
    plan: profile.plan,
    source: profile.source ?? `${surface}-profile-write`,
    metadata: workspaceMetadata ?? profile.workspace_metadata ?? profile.metadata,
  });
  const safeProfile = {
    ...profile,
    profile_slug: sanitizeSlug(profile.profile_slug ?? identity.profile_slug ?? targetWorkspaceSlug),
    workspace_slug: identity.workspace_slug,
    customer_slug: identity.customer_slug,
    repo: String(profile.repo ?? identity.repo ?? ""),
    generated_at: profile.generated_at ?? new Date().toISOString(),
  };
  const persisted = await writeRepositoryProfileArtifactRecord({
    serviceStorageRoot,
    profile: safeProfile,
  });
  const syncedDestinations = await publishWriteArtifacts({
    serviceStorageRoot,
    portalRoot,
    adminRoot,
    publishKind: "profiles",
  });
  await writeAuditEvent({
    serviceStorageRoot,
    event: {
      action: "repository.profile_written",
      outcome: "success",
      surface,
      actor_slug: authContext?.actor?.actor_slug,
      workspace_slug: identity.workspace_slug,
      customer_slug: identity.customer_slug,
      target_type: "repository_profile",
      target_id: safeProfile.profile_slug,
      metadata: {
        repo: safeProfile.repo,
        destinations: syncedDestinations.map((entry) => entry.kind),
      },
    },
  });

  return {
    workspace_identity: identity,
    profile: safeProfile,
    persisted,
    synced_destinations: syncedDestinations,
  };
}

export async function writeRepositoryDocumentsForActor({
  serviceStorageRoot,
  surface,
  authContext,
  artifact,
  portalRoot,
  adminRoot,
  workspaceMetadata,
} = {}) {
  if (!artifact || typeof artifact !== "object") {
    throw new Error("artifact payload is required.");
  }

  const targetWorkspaceSlug = sanitizeSlug(
    artifact.workspace_slug ?? artifact.profile_slug ?? authContext?.workspace_slug ?? "",
  );
  if (!targetWorkspaceSlug) {
    throw new Error("profile_slug or workspace_slug is required.");
  }

  const identity = await resolveWritableWorkspaceIdentity({
    serviceStorageRoot,
    surface,
    authContext,
    workspaceSlug: targetWorkspaceSlug,
    customerSlug: artifact.customer_slug,
    repo: artifact.repo,
    displayName: artifact.display_name,
    plan: artifact.plan,
    source: artifact.source ?? `${surface}-documents-write`,
    metadata: workspaceMetadata ?? artifact.workspace_metadata ?? artifact.metadata,
  });
  const safeArtifact = {
    ...artifact,
    profile_slug: sanitizeSlug(artifact.profile_slug ?? identity.profile_slug ?? targetWorkspaceSlug),
    workspace_slug: identity.workspace_slug,
    customer_slug: identity.customer_slug,
    repo: String(artifact.repo ?? identity.repo ?? ""),
    generated_at: artifact.generated_at ?? new Date().toISOString(),
  };
  const persisted = await writeRepositoryDocumentArtifactRecord({
    serviceStorageRoot,
    artifact: safeArtifact,
  });
  const syncedDestinations = await publishWriteArtifacts({
    serviceStorageRoot,
    portalRoot,
    adminRoot,
    publishKind: "documents",
  });
  await writeAuditEvent({
    serviceStorageRoot,
    event: {
      action: "repository.documents_written",
      outcome: "success",
      surface,
      actor_slug: authContext?.actor?.actor_slug,
      workspace_slug: identity.workspace_slug,
      customer_slug: identity.customer_slug,
      target_type: "repository_documents",
      target_id: safeArtifact.profile_slug,
      metadata: {
        repo: safeArtifact.repo,
        document_count: Number(safeArtifact.totals?.document_count ?? safeArtifact.documents?.length ?? 0),
        destinations: syncedDestinations.map((entry) => entry.kind),
      },
    },
  });

  return {
    workspace_identity: identity,
    artifact: safeArtifact,
    persisted,
    synced_destinations: syncedDestinations,
  };
}

export async function writeBenchmarkReportForActor({
  serviceStorageRoot,
  surface,
  authContext,
  report,
  portalRoot,
  adminRoot,
  workspaceMetadata,
} = {}) {
  if (!report || typeof report !== "object") {
    throw new Error("report payload is required.");
  }

  const targetWorkspaceSlug = sanitizeSlug(
    report.workspace_slug ?? report.profile_slug ?? authContext?.workspace_slug ?? "",
  );
  if (!targetWorkspaceSlug) {
    throw new Error("profile_slug or workspace_slug is required.");
  }

  const identity = await resolveWritableWorkspaceIdentity({
    serviceStorageRoot,
    surface,
    authContext,
    workspaceSlug: targetWorkspaceSlug,
    customerSlug: report.customer_slug,
    repo: report.repo,
    displayName: report.display_name,
    plan: report.plan,
    source: report.source ?? `${surface}-benchmark-write`,
    metadata: workspaceMetadata ?? report.workspace_metadata ?? report.metadata,
  });
  const safeReport = {
    ...report,
    report_id:
      sanitizeSlug(report.report_id) ||
      `${sanitizeSlug(identity.profile_slug)}-${sanitizeSlug(report.scenario ?? "benchmark")}-${Date.now()}`,
    profile_slug: sanitizeSlug(report.profile_slug ?? identity.profile_slug ?? targetWorkspaceSlug),
    workspace_slug: identity.workspace_slug,
    customer_slug: identity.customer_slug,
    repo: String(report.repo ?? identity.repo ?? ""),
    generated_at: report.generated_at ?? new Date().toISOString(),
  };
  const persisted = await writeBenchmarkArtifactRecord({
    serviceStorageRoot,
    report: safeReport,
  });
  const syncedDestinations = await publishWriteArtifacts({
    serviceStorageRoot,
    portalRoot,
    adminRoot,
    publishKind: "benchmarks",
  });
  await writeAuditEvent({
    serviceStorageRoot,
    event: {
      action: "benchmark.report_written",
      outcome: "success",
      surface,
      actor_slug: authContext?.actor?.actor_slug,
      workspace_slug: identity.workspace_slug,
      customer_slug: identity.customer_slug,
      target_type: "benchmark_report",
      target_id: safeReport.report_id,
      metadata: {
        repo: safeReport.repo,
        scenario: safeReport.scenario,
        provider: safeReport.provider,
        model: safeReport.model,
        destinations: syncedDestinations.map((entry) => entry.kind),
      },
    },
  });

  return {
    workspace_identity: identity,
    report: safeReport,
    persisted,
    synced_destinations: syncedDestinations,
  };
}

async function resolveWritableWorkspaceIdentity({
  serviceStorageRoot,
  surface,
  authContext,
  workspaceSlug,
  customerSlug,
  repo,
  displayName,
  plan,
  source,
  metadata,
} = {}) {
  const actor = authContext?.actor;
  if (!actor) {
    throw new Error(`No authenticated actor for ${surface}.`);
  }

  const safeWorkspaceSlug = sanitizeSlug(workspaceSlug ?? "");
  if (!safeWorkspaceSlug) {
    throw new Error("workspace_slug is required.");
  }

  const existingIdentity = await loadWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: safeWorkspaceSlug,
  });
  const allowedWorkspaceSlugs = new Set(
    (authContext?.workspaces ?? []).map((workspace) => sanitizeSlug(workspace.workspace_slug)),
  );

  if (existingIdentity) {
    if (!allowedWorkspaceSlugs.has(existingIdentity.workspace_slug) && !canManageWorkspace(actor, existingIdentity)) {
      throw new Error(`Actor ${actor.actor_slug} cannot write workspace ${safeWorkspaceSlug}.`);
    }

    return upsertWorkspaceIdentity({
      serviceStorageRoot,
      workspaceSlug: existingIdentity.workspace_slug,
      customerSlug:
        customerSlug ??
        authContext?.actor?.customer_slug ??
        authContext?.customer_slug ??
        existingIdentity.customer_slug,
      profileSlug: existingIdentity.profile_slug,
      repo: repo ?? existingIdentity.repo,
      displayName: displayName ?? existingIdentity.display_name,
      plan: plan ?? existingIdentity.plan,
      status: existingIdentity.status,
      ownerActorSlug: existingIdentity.owner_actor_slug || actor.actor_slug,
      source,
      lastSyncAt: new Date().toISOString(),
      metadata: {
        ...(existingIdentity.metadata ?? {}),
        ...(metadata ?? {}),
        last_write_surface: surface,
      },
    });
  }

  if (!canCreateWorkspace(actor, customerSlug)) {
    throw new Error(`Actor ${actor.actor_slug} cannot create workspace ${safeWorkspaceSlug}.`);
  }

  return upsertWorkspaceIdentity({
    serviceStorageRoot,
    workspaceSlug: safeWorkspaceSlug,
    customerSlug:
      customerSlug ??
      authContext?.actor?.customer_slug ??
      authContext?.customer_slug ??
      actor.customer_slug ??
      safeWorkspaceSlug,
    profileSlug: safeWorkspaceSlug,
    repo: repo ?? safeWorkspaceSlug,
    displayName: displayName ?? safeWorkspaceSlug,
    plan,
    ownerActorSlug: actor.actor_slug,
    source,
    metadata: {
      ...(metadata ?? {}),
      created_by_surface: surface,
    },
  });
}

async function publishWriteArtifacts({ serviceStorageRoot, portalRoot, adminRoot, publishKind } = {}) {
  const syncedDestinations = [];
  const destinations = [
    portalRoot ? { kind: "portal", root: portalRoot } : null,
    adminRoot ? { kind: "admin", root: adminRoot } : null,
  ].filter(Boolean);

  for (const destination of destinations) {
    if (publishKind === "profiles") {
      await publishProfilesToSurface({
        serviceStorageRoot,
        surfaceRoot: destination.root,
      });
    } else if (publishKind === "documents") {
      await publishDocumentsToSurface({
        serviceStorageRoot,
        surfaceRoot: destination.root,
      });
    } else if (publishKind === "benchmarks") {
      await publishBenchmarksToSurface({
        serviceStorageRoot,
        surfaceRoot: destination.root,
      });
    }

    await publishWorkspacesToSurface({
      serviceStorageRoot,
      surfaceRoot: destination.root,
    });
    syncedDestinations.push(destination);
  }

  return syncedDestinations;
}

function canManageWorkspace(actor, identity) {
  if (!actor) {
    return false;
  }

  if (actor.role === "owner" || actor.access_mode === "all") {
    return true;
  }

  if (actor.customer_slug && sanitizeSlug(actor.customer_slug) === sanitizeSlug(identity.customer_slug)) {
    return true;
  }

  return false;
}

function canCreateWorkspace(actor, customerSlug) {
  if (!actor) {
    return false;
  }

  if (actor.role === "owner" || actor.access_mode === "all") {
    return true;
  }

  return Boolean(
    actor.customer_slug && sanitizeSlug(actor.customer_slug) === sanitizeSlug(customerSlug ?? actor.customer_slug),
  );
}

function sanitizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
