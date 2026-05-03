import {
  renderDiagramCards,
  renderHero,
  renderHtmlDocument,
  renderMetricCards,
  renderSection,
  renderSimpleRows,
  renderTwoColumn,
} from "../../../packages/web-render/src/index.js";
import { adminManifest } from "./manifest.js";
import {
  listAdminRepositoryProfiles as listAdminRepositoryProfilesFromStore,
  loadAdminRepositoryProfile as loadAdminRepositoryProfileFromStore,
} from "./profile-store.js";

export { adminManifest } from "./manifest.js";

export async function listAdminRepositoryProfiles(rootDir) {
  return listAdminRepositoryProfilesFromStore(rootDir ? { appRoot: `${rootDir}/apps/admin` } : undefined);
}

export async function loadAdminRepositoryProfile(slug, rootDir) {
  return loadAdminRepositoryProfileFromStore(slug, {
    includeDiagramContents: true,
    appRoot: rootDir ? `${rootDir}/apps/admin` : undefined,
  });
}

export async function renderAdminRepositorySupportPage(slug, rootDir) {
  const profile = await loadAdminRepositoryProfile(slug, rootDir);
  const hero = renderHero({
    eyebrow: "Internal Admin",
    title: `Support view for ${profile.repo}`,
    description:
      "This page is for the be-ai-heart owner and internal operators to inspect a customer-synced repository profile, support the account, and understand indexing, diagram, and benchmark readiness.",
    actions: [
      { label: "Customer Record", href: `/admin/customers/${profile.profile_slug}`, primary: true },
      { label: "Revenue", href: "/admin/revenue" },
      { label: "Support Queue", href: "/admin/support" },
    ],
    aside: renderMetricCards([
      { label: "Profiles", value: 1, note: "Focused support view" },
      { label: "Heart Links", value: profile.heart.relationship_count, note: "Project memory depth" },
      { label: "Warnings", value: profile.overview.policy_warnings, note: "Architecture risk count" },
      { label: "Docs", value: profile.documents.document_count, note: "Customer project documents" },
    ]),
  });

  const supportLayout = renderTwoColumn(
    renderSection(
      "Customer Support Snapshot",
      renderSimpleRows([
        { title: "Repository", body: profile.repo },
        { title: "Portal profile", body: profile.profile_slug, meta: "customer" },
        { title: "Generated at", body: profile.generated_at, meta: "sync" },
      ]),
    ),
    renderSection(
      "Operational Signals",
      renderSimpleRows([
        { title: "Cache lifecycle", body: profile.cache.status, meta: "cache" },
        { title: "Policy warnings", body: `${profile.overview.policy_warnings}`, meta: "risk" },
        { title: "Diagram artifacts", body: `${profile.diagrams.length} synced artifacts`, meta: "visualization" },
      ]),
    ),
  );

  const diagramSection = renderSection("Customer-Synced Diagrams", renderDiagramCards(profile.diagrams));
  const contextPackSupportSection = renderSection(
    "Context Pack Support Signals",
    renderSimpleRows([
      { title: "Preview command", body: 'heart pack "add SSO login audit logging"', meta: "local-first" },
      {
        title: "Published inputs",
        body: `${profile.overview.file_count} files, ${profile.overview.symbol_count} symbols, ${profile.documents.document_count} documents`,
        meta: "profile",
      },
      {
        title: "Support boundary",
        body: "Admin can inspect whether enough metadata exists for a preview, but the final pack should be compiled in the customer repository.",
        meta: "trust",
      },
    ]),
  );
  const adminActions = renderSection(
    "Admin Responsibilities",
    renderSimpleRows([
      { title: "Customers and licenses", body: "Track who has access and which plan or pilot state they are on." },
      { title: "Revenue and conversion", body: "Review trial conversion, licensing, and support-driven expansion." },
      { title: "Operational support", body: "Inspect failed syncs, profile freshness, and repository health when helping customers." },
    ]),
  );

  return renderHtmlDocument({
    title: `Admin | ${profile.repo}`,
    eyebrow: "Admin",
    nav: [
      { label: "Customers", href: "/admin/customers" },
      { label: "Support", href: "/admin/support" },
      { label: "Revenue", href: "/admin/revenue" },
      { label: "Ops Health", href: "/admin/ops-health" },
    ],
    body: `<div class="stack">${hero}${supportLayout}${diagramSection}${contextPackSupportSection}${adminActions}</div>`,
    accent: "#9a3412",
  });
}
