export function buildDocumentStatusSummary(repositories = [], submissions = []) {
  const safeRepositories = Array.isArray(repositories) ? repositories : [];
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];
  const documents = safeRepositories.flatMap((repository) =>
    (repository.documents ?? []).map((document) => ({
      ...document,
      profile_slug: repository.profile_slug,
      repo: repository.repo,
    })),
  );
  const categoryCounts = countBy(documents, (document) => normalizeCategory(document.category));
  const queuedProfiles = [...new Set(safeSubmissions.map((submission) => String(submission.profile_slug ?? "")).filter(Boolean))].sort();
  const latestSyncedAt = latestTimestamp(safeRepositories.map((repository) => repository.generated_at));
  const latestSubmissionAt = latestTimestamp(safeSubmissions.map((submission) => submission.updated_at));
  const staleDocuments = documents.filter((document) => isStaleDocument(document));
  const restrictedDocuments = documents.filter((document) => document.sensitivity?.level === "restricted" || document.restricted);
  const requirementDocuments = documents.filter((document) =>
    ["business", "requirements", "prd", "spec"].includes(normalizeCategory(document.category)),
  );
  const linkedDocuments = documents.filter((document) =>
    (document.citations ?? []).length > 0 ||
    (document.linked_modules ?? []).length > 0 ||
    (document.lineage?.previous_version_ref || document.version_ref?.hash),
  );
  const status = resolveDocumentStatus({
    documentCount: documents.length,
    queuedCount: safeSubmissions.length,
    staleCount: staleDocuments.length,
    requirementCount: requirementDocuments.length,
  });

  return {
    schema_version: 1,
    status,
    repository_count: safeRepositories.length,
    document_count: documents.length,
    requirement_document_count: requirementDocuments.length,
    stale_document_count: staleDocuments.length,
    restricted_document_count: restrictedDocuments.length,
    linked_document_count: linkedDocuments.length,
    queued_submission_count: safeSubmissions.length,
    queued_profile_slugs: queuedProfiles,
    latest_synced_at: latestSyncedAt,
    latest_submission_at: latestSubmissionAt,
    category_counts: categoryCounts,
    next_actions: buildDocumentNextActions({
      status,
      queuedProfiles,
      documentCount: documents.length,
      staleCount: staleDocuments.length,
      requirementCount: requirementDocuments.length,
    }),
  };
}

function resolveDocumentStatus({
  documentCount,
  queuedCount,
  staleCount,
  requirementCount,
}) {
  if (documentCount === 0 && queuedCount === 0) {
    return "missing";
  }
  if (queuedCount > 0) {
    return "queued_updates";
  }
  if (staleCount > 0) {
    return "stale";
  }
  if (requirementCount === 0) {
    return "needs_requirements";
  }
  return "ready";
}

function buildDocumentNextActions({
  status,
  queuedProfiles,
  documentCount,
  staleCount,
  requirementCount,
}) {
  if (status === "missing") {
    return [
      "Run heart docs import for core requirements or architecture documents.",
      "Run heart diagram sync after importing docs so portal status reflects the repository.",
    ];
  }
  if (status === "queued_updates") {
    const slug = queuedProfiles[0] || "your-profile";
    return [
      `Run heart docs sync-web --slug ${slug} in the matching repository.`,
      "Run heart scan after importing queued web updates.",
      "Run heart diagram sync to publish the refreshed document memory.",
    ];
  }
  if (status === "stale") {
    return [
      `${staleCount} synced document(s) are stale; refresh source docs and resync.`,
      "Run heart scan before generating new context packs.",
    ];
  }
  if (status === "needs_requirements") {
    return [
      `${documentCount} document(s) are synced, but no business or requirement doc is categorized yet.`,
      "Add a PRD, business brief, or requirement note before relying on context packs for product intent.",
    ];
  }
  return [
    `${requirementCount} business/requirement document(s) are synced and ready for context packs.`,
    "Run heart pack for the next task to verify citations and linked modules.",
  ];
}

function isStaleDocument(document = {}) {
  const freshness = document.freshness ?? {};
  return Boolean(freshness.is_stale) || ["stale", "outdated", "expired"].includes(String(freshness.status ?? "").toLowerCase());
}

function normalizeCategory(value) {
  const category = String(value ?? "general").trim().toLowerCase();
  if (category === "requirement") {
    return "requirements";
  }
  return category || "general";
}

function countBy(items, resolveKey) {
  return items.reduce((counts, item) => {
    const key = resolveKey(item);
    counts[key] = Number(counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function latestTimestamp(values = []) {
  return values
    .map((value) => String(value ?? ""))
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}
