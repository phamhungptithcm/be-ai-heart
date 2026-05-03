import {
  renderDiagramCards,
  renderHero,
  renderHtmlDocument,
  renderMetricCards,
  renderSection,
  renderSimpleRows,
  renderTwoColumn,
} from "../../../packages/web-render/src/index.js";
import { portalManifest } from "./manifest.js";
import {
  listPortalRepositoryProfiles as listPortalRepositoryProfilesFromStore,
  loadPortalRepositoryProfile as loadPortalRepositoryProfileFromStore,
} from "./profile-store.js";

export { portalManifest } from "./manifest.js";

export async function listPortalRepositoryProfiles(rootDir) {
  return listPortalRepositoryProfilesFromStore(rootDir ? { appRoot: `${rootDir}/apps/portal` } : undefined);
}

export async function loadPortalRepositoryProfile(slug, rootDir) {
  return loadPortalRepositoryProfileFromStore(slug, {
    includeDiagramContents: true,
    appRoot: rootDir ? `${rootDir}/apps/portal` : undefined,
  });
}

export async function renderPortalRepositoryProfilePage(slug, rootDir) {
  const profile = await loadPortalRepositoryProfile(slug, rootDir);
  const hero = renderHero({
    eyebrow: "Customer Portal",
    title: `${profile.repo} repository profile`,
    description:
      "This workspace view is where a customer sees synced repository memory, diagram artifacts, benchmark context, and operational indexing status after using the CLI sync flow.",
    actions: [
      { label: "Open Repository", href: `/portal/repositories/${profile.profile_slug}`, primary: true },
      { label: "Benchmarks", href: `/portal/benchmarks/${profile.profile_slug}` },
      { label: "Settings", href: `/portal/settings/${profile.profile_slug}` },
    ],
    aside: renderMetricCards([
      { label: "Files", value: profile.overview.file_count },
      { label: "Symbols", value: profile.overview.symbol_count },
      { label: "Heart Links", value: profile.heart.relationship_count },
      { label: "Documents", value: profile.documents.document_count },
    ]),
  });

  const repositorySummary = renderTwoColumn(
    renderSection(
      "Repository Summary",
      renderSimpleRows([
        { title: "Parser", body: profile.overview.parser_engine, meta: "scan" },
        { title: "Top-level summary", body: profile.overview.summary, meta: "overview" },
        { title: "Policy warnings", body: `${profile.overview.policy_warnings} flagged warnings`, meta: "policy" },
      ]),
    ),
    renderSection(
      "Sync Snapshot",
      renderSimpleRows([
        { title: "Profile slug", body: profile.profile_slug, meta: "profile" },
        { title: "Generated at", body: profile.generated_at, meta: "timestamp" },
        { title: "Cache status", body: profile.cache.status, meta: "cache" },
      ]),
    ),
  );

  const diagramSection = renderSection("Synced Diagrams", renderDiagramCards(profile.diagrams));
  const contextPackPreviewSection = renderSection(
    "Context Pack Preview",
    renderSimpleRows([
      {
        title: "Sample task",
        body: "add SSO login audit logging",
        meta: "preview",
      },
      {
        title: "Local command",
        body: 'heart pack "add SSO login audit logging"',
        meta: "cli",
      },
      {
        title: "Model preset",
        body: "Balanced coding model, low-cost review model, or deep context model with explicit token budgets.",
        meta: "model selector",
      },
      {
        title: "Command box",
        body: '/pack "add SSO login audit logging" stays a local-first command preview, not hosted repo execution.',
        meta: "workbench",
      },
      {
        title: "Synced inputs",
        body: `${profile.overview.file_count} files, ${profile.overview.symbol_count} symbols, ${profile.documents.document_count} documents`,
        meta: "repo artifact",
      },
      {
        title: "Trust boundary",
        body: "The hosted preview is built from published metadata. Generate the final pack locally so current ignore rules, policies, and graph state apply.",
        meta: "local-first",
      },
    ]),
  );
  const navigationSection = renderSection(
    "Portal Navigation Intent",
    renderSimpleRows([
      { title: "Repositories", body: "Browse all synced repositories and indexing status." },
      { title: "Benchmarks", body: "Review benchmark history and ROI metrics per repository." },
      { title: "Members & Billing", body: "Manage organization access, seats, and workspace plan state." },
    ]),
  );

  return renderHtmlDocument({
    title: `Portal | ${profile.repo}`,
    eyebrow: "Portal",
    nav: [
      { label: "Repositories", href: "/portal/repositories" },
      { label: "Benchmarks", href: "/portal/benchmarks" },
      { label: "Usage", href: "/portal/usage" },
      { label: "Billing", href: "/portal/billing" },
    ],
    body: `<div class="stack">${hero}${repositorySummary}${diagramSection}${contextPackPreviewSection}${navigationSection}</div>`,
    accent: "#0f766e",
  });
}
