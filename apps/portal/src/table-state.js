function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    sensitivity: "base",
  });
}

function compareNumber(left, right) {
  return Number(left ?? 0) - Number(right ?? 0);
}

function compareTimestamp(left, right) {
  return Number(new Date(left ?? 0).getTime() || 0) - Number(new Date(right ?? 0).getTime() || 0);
}

function sortRows(rows, direction, getter, comparator = compareText) {
  const multiplier = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => multiplier * comparator(getter(left), getter(right)));
}

function formatScenarioLabel(value) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function repositoryReadinessLabel(score) {
  if (score >= 78) {
    return "Ready";
  }

  if (score >= 55) {
    return "Watch";
  }

  return "Needs work";
}

function benchmarkRoiLabel(score) {
  if (score >= 60) {
    return "Strong";
  }

  if (score >= 40) {
    return "Watch";
  }

  return "Weak";
}

export function buildPortalRepositoryTableRows(profiles = []) {
  return profiles.map((profile) => {
    const documentCount = Number(profile.documents?.document_count ?? 0);
    const warningCount = Number(profile.overview?.policy_warnings ?? 0);
    const benchmarkCount = Number(profile.benchmark_report_count ?? 0);
    const memoryReady = documentCount > 0;
    const syncStatus = String(profile.cache?.status ?? "unknown");
    const readinessScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (memoryReady ? 42 : 16) +
            Math.min(20, benchmarkCount * 18) +
            Math.min(24, Number(profile.heart?.relationship_count ?? 0) / 35) -
            Math.min(22, warningCount * 11) -
            (syncStatus === "stale" || syncStatus === "rebuild" ? 18 : 0),
        ),
      ),
    );

    return {
      ...profile,
      documentCount,
      warningCount,
      benchmarkCount,
      memoryReady,
      syncStatus,
      readinessScore,
      readinessLabel: repositoryReadinessLabel(readinessScore),
      searchText: normalizeText(
        [profile.repo, profile.profile_slug, profile.overview?.summary, syncStatus].join(" "),
      ),
    };
  });
}

export function queryPortalRepositoryRows(rows = [], state = {}) {
  const query = normalizeText(state.query);
  const readiness = normalizeText(state.readiness || "all");
  const sync = normalizeText(state.sync || "all");
  const benchmark = normalizeText(state.benchmark || "all");

  const filtered = rows.filter((row) => {
    if (query && !row.searchText.includes(query)) {
      return false;
    }

    if (readiness !== "all" && normalizeText(row.readinessLabel).replace(/\s+/g, "-") !== readiness) {
      return false;
    }

    if (sync === "fresh" && ["stale", "rebuild"].includes(normalizeText(row.syncStatus))) {
      return false;
    }

    if (sync === "needs-resync" && !["stale", "rebuild"].includes(normalizeText(row.syncStatus))) {
      return false;
    }

    if (benchmark === "backed" && row.benchmarkCount <= 0) {
      return false;
    }

    if (benchmark === "missing" && row.benchmarkCount > 0) {
      return false;
    }

    return true;
  });

  const sortKey = normalizeText(state.sortKey || "readiness");
  const sortDirection = normalizeText(state.sortDirection || "desc");

  switch (sortKey) {
    case "repo":
      return sortRows(filtered, sortDirection, (row) => row.repo, compareText);
    case "sync":
      return sortRows(filtered, sortDirection, (row) => row.syncStatus, compareText);
    case "documents":
      return sortRows(filtered, sortDirection, (row) => row.documentCount, compareNumber);
    case "links":
      return sortRows(filtered, sortDirection, (row) => row.heart?.relationship_count ?? 0, compareNumber);
    case "benchmarks":
      return sortRows(filtered, sortDirection, (row) => row.benchmarkCount, compareNumber);
    case "warnings":
      return sortRows(filtered, sortDirection, (row) => row.warningCount, compareNumber);
    case "last-sync":
      return sortRows(filtered, sortDirection, (row) => row.generated_at, compareTimestamp);
    case "readiness":
    default:
      return sortRows(filtered, sortDirection, (row) => row.readinessScore, compareNumber);
  }
}

export function buildPortalBenchmarkTableRows(reports = []) {
  return reports.map((report) => {
    const roiScore = Number(report.metrics?.composite_roi_score ?? 0);

    return {
      ...report,
      scenarioLabel: formatScenarioLabel(report.scenario),
      tokenSavingsPct: Number(report.metrics?.token_savings_pct ?? 0),
      tokenCostSavingsUsd: Number(report.metrics?.token_cost_savings_usd ?? 0),
      memoryRefreshReductionPct: Number(report.metrics?.memory_refresh_reduction_pct ?? 0),
      roiScore,
      roiLabel: benchmarkRoiLabel(roiScore),
      searchText: normalizeText(
        [
          report.scenario,
          formatScenarioLabel(report.scenario),
          report.repo,
          report.model,
          report.provider,
          report.manager_summary,
        ].join(" "),
      ),
    };
  });
}

export function queryPortalBenchmarkRows(rows = [], state = {}) {
  const query = normalizeText(state.query);
  const roi = normalizeText(state.roi || "all");
  const filtered = rows.filter((row) => {
    if (query && !row.searchText.includes(query)) {
      return false;
    }

    if (roi !== "all" && normalizeText(row.roiLabel) !== roi) {
      return false;
    }

    return true;
  });

  const sortKey = normalizeText(state.sortKey || "runtime");
  const sortDirection = normalizeText(state.sortDirection || "desc");

  switch (sortKey) {
    case "scenario":
      return sortRows(filtered, sortDirection, (row) => row.scenarioLabel, compareText);
    case "repository":
      return sortRows(filtered, sortDirection, (row) => row.repo, compareText);
    case "model":
      return sortRows(filtered, sortDirection, (row) => `${row.provider}/${row.model}`, compareText);
    case "token-save":
      return sortRows(filtered, sortDirection, (row) => row.tokenSavingsPct, compareNumber);
    case "money-save":
      return sortRows(filtered, sortDirection, (row) => row.tokenCostSavingsUsd, compareNumber);
    case "memory-save":
      return sortRows(filtered, sortDirection, (row) => row.memoryRefreshReductionPct, compareNumber);
    case "roi":
      return sortRows(filtered, sortDirection, (row) => row.roiScore, compareNumber);
    case "runtime":
    default:
      return sortRows(filtered, sortDirection, (row) => row.generated_at, compareTimestamp);
  }
}
