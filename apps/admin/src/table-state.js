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

function benchmarkRoiLabel(score) {
  if (score >= 60) {
    return "Strong";
  }

  if (score >= 40) {
    return "Watch";
  }

  return "Weak";
}

function customerRiskLabel(customer, readinessScore) {
  if (String(customer.risk_level ?? "") === "high" || readinessScore < 45) {
    return "High risk";
  }

  if (String(customer.risk_level ?? "") === "medium" || readinessScore < 70) {
    return "Watch";
  }

  return "Healthy";
}

function supportSeverityLabel(score) {
  if (score < 45) {
    return "Critical";
  }

  if (score < 70) {
    return "Watch";
  }

  return "Healthy";
}

export function buildAdminCustomerTableRows(customers = []) {
  return customers.map((customer) => {
    const readinessScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          20 +
            Math.min(28, Number(customer.memory_ready_repositories ?? 0) * 12) +
            Math.min(24, Number(customer.benchmark_backed_repositories ?? 0) * 14) -
            Math.min(18, Number(customer.failed_syncs ?? 0) * 10) -
            Math.min(12, Number(customer.stale_repositories ?? 0) * 4),
        ),
      ),
    );
    const seatsUsed = Number(customer.seats_used ?? 0);
    const seatsTotal = Number(customer.seats_total ?? 0);
    const seatUsagePct = seatsTotal > 0 ? Math.round((seatsUsed / seatsTotal) * 100) : 0;

    return {
      ...customer,
      readinessScore,
      seatUsagePct,
      riskLabel: customerRiskLabel(customer, readinessScore),
      searchText: normalizeText(
        [
          customer.display_name,
          customer.customer_slug,
          customer.plan_code,
          customer.status,
          customer.entitlement_status,
          customer.expansion_readiness,
        ].join(" "),
      ),
    };
  });
}

export function queryAdminCustomerRows(rows = [], state = {}) {
  const query = normalizeText(state.query);
  const posture = normalizeText(state.posture || "all");
  const expansion = normalizeText(state.expansion || "all");

  const filtered = rows.filter((row) => {
    if (query && !row.searchText.includes(query)) {
      return false;
    }

    if (posture === "active" && normalizeText(row.status) !== "active") {
      return false;
    }

    if (posture === "trial" && normalizeText(row.status) !== "trial") {
      return false;
    }

    if (posture === "high-risk" && normalizeText(row.riskLabel).replace(/\s+/g, "-") !== "high-risk") {
      return false;
    }

    if (expansion !== "all" && normalizeText(row.expansion_readiness) !== expansion) {
      return false;
    }

    return true;
  });

  const sortKey = normalizeText(state.sortKey || "readiness");
  const sortDirection = normalizeText(state.sortDirection || "desc");

  switch (sortKey) {
    case "org":
      return sortRows(filtered, sortDirection, (row) => row.display_name, compareText);
    case "status":
      return sortRows(filtered, sortDirection, (row) => row.status, compareText);
    case "plan":
      return sortRows(filtered, sortDirection, (row) => row.plan_code, compareText);
    case "memory-ready":
      return sortRows(filtered, sortDirection, (row) => row.memory_ready_repositories, compareNumber);
    case "benchmark-backed":
      return sortRows(filtered, sortDirection, (row) => row.benchmark_backed_repositories, compareNumber);
    case "seat-usage":
      return sortRows(filtered, sortDirection, (row) => row.seatUsagePct, compareNumber);
    case "queued":
      return sortRows(filtered, sortDirection, (row) => row.queued_submissions, compareNumber);
    case "risk":
      return sortRows(filtered, sortDirection, (row) => row.riskLabel, compareText);
    case "motion":
      return sortRows(filtered, sortDirection, (row) => row.expansion_readiness, compareText);
    case "renewal":
      return sortRows(filtered, sortDirection, (row) => row.renewal_date, compareTimestamp);
    case "readiness":
    default:
      return sortRows(filtered, sortDirection, (row) => row.readinessScore, compareNumber);
  }
}

export function buildAdminSupportTableRows(profiles = []) {
  return profiles.map((profile) => {
    const syncStatus = String(profile.cache?.status ?? "unknown").toLowerCase();
    const warningCount = Number(profile.overview?.policy_warnings ?? 0);
    const documentCount = Number(profile.documents?.document_count ?? 0);
    const benchmarkCount = Number(profile.benchmark_report_count ?? 0);
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          66 +
            Math.min(10, benchmarkCount * 8) +
            Math.min(10, documentCount * 3) -
            Math.min(18, warningCount * 8) -
            (syncStatus === "stale" || syncStatus === "rebuild" ? 34 : 0) -
            (documentCount === 0 ? 18 : 0),
        ),
      ),
    );

    return {
      profile_slug: profile.profile_slug,
      repo: profile.repo,
      customer_slug: profile.customer_slug ?? "unknown",
      sync_status: syncStatus,
      warning_count: warningCount,
      document_count: documentCount,
      benchmark_count: benchmarkCount,
      score,
      severityLabel: supportSeverityLabel(score),
      searchText: normalizeText(
        [profile.repo, profile.profile_slug, profile.customer_slug, syncStatus].join(" "),
      ),
    };
  });
}

export function queryAdminSupportRows(rows = [], state = {}) {
  const query = normalizeText(state.query);
  const severity = normalizeText(state.severity || "all");
  const sync = normalizeText(state.sync || "all");

  const filtered = rows.filter((row) => {
    if (query && !row.searchText.includes(query)) {
      return false;
    }

    if (severity !== "all" && normalizeText(row.severityLabel) !== severity) {
      return false;
    }

    if (sync === "stale" && !["stale", "rebuild"].includes(row.sync_status)) {
      return false;
    }

    if (sync === "fresh" && ["stale", "rebuild"].includes(row.sync_status)) {
      return false;
    }

    return true;
  });

  const sortKey = normalizeText(state.sortKey || "support-score");
  const sortDirection = normalizeText(state.sortDirection || "asc");

  switch (sortKey) {
    case "repository":
      return sortRows(filtered, sortDirection, (row) => row.repo, compareText);
    case "customer":
      return sortRows(filtered, sortDirection, (row) => row.customer_slug, compareText);
    case "sync":
      return sortRows(filtered, sortDirection, (row) => row.sync_status, compareText);
    case "docs":
      return sortRows(filtered, sortDirection, (row) => row.document_count, compareNumber);
    case "benchmarks":
      return sortRows(filtered, sortDirection, (row) => row.benchmark_count, compareNumber);
    case "warnings":
      return sortRows(filtered, sortDirection, (row) => row.warning_count, compareNumber);
    case "support-score":
    default:
      return sortRows(filtered, sortDirection, (row) => row.score, compareNumber);
  }
}

export function buildAdminBenchmarkTableRows(reports = []) {
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
          report.profile_slug,
          report.model,
          report.provider,
          report.manager_summary,
        ].join(" "),
      ),
    };
  });
}

export function queryAdminBenchmarkRows(rows = [], state = {}) {
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
    case "profile":
      return sortRows(filtered, sortDirection, (row) => row.profile_slug, compareText);
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
