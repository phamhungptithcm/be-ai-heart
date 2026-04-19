import { randomUUID } from "node:crypto";

import { withServiceDatabase } from "./database.js";
import {
  isPostgresStorageEnabled,
  loadWebsiteIntakeRequestsFromPostgres,
  upsertWebsiteIntakeRequestInPostgres,
} from "./postgres-repository.js";

const ALLOWED_INTAKE_KINDS = new Set(["demo", "trial"]);

export async function createWebsiteIntakeRequest({ serviceStorageRoot, request } = {}) {
  const normalized = normalizeIntakeRequest(request);

  if (isPostgresStorageEnabled()) {
    await upsertWebsiteIntakeRequestInPostgres({ intakeRequest: normalized });
  } else {
    withServiceDatabase(serviceStorageRoot, (database) => {
      database
        .prepare(`
          INSERT INTO website_intake_requests (
            request_id,
            intake_kind,
            full_name,
            work_email,
            company,
            role,
            team_size,
            repo_count,
            primary_goal,
            message,
            source_page,
            status,
            created_at,
            payload_json
          )
          VALUES (
            :request_id,
            :intake_kind,
            :full_name,
            :work_email,
            :company,
            :role,
            :team_size,
            :repo_count,
            :primary_goal,
            :message,
            :source_page,
            :status,
            :created_at,
            :payload_json
          )
        `)
        .run({
          request_id: normalized.request_id,
          intake_kind: normalized.intake_kind,
          full_name: normalized.full_name,
          work_email: normalized.work_email,
          company: normalized.company,
          role: normalized.role,
          team_size: normalized.team_size,
          repo_count: normalized.repo_count,
          primary_goal: normalized.primary_goal,
          message: normalized.message,
          source_page: normalized.source_page,
          status: normalized.status,
          created_at: normalized.created_at,
          payload_json: JSON.stringify(normalized),
        });
    });
  }

  return normalized;
}

export async function listWebsiteIntakeRequests({ serviceStorageRoot, intakeKind } = {}) {
  if (isPostgresStorageEnabled()) {
    return loadWebsiteIntakeRequestsFromPostgres({ intakeKind });
  }

  return withServiceDatabase(serviceStorageRoot, (database) => {
    const statement = intakeKind && ALLOWED_INTAKE_KINDS.has(intakeKind)
      ? database.prepare(`
          SELECT payload_json
          FROM website_intake_requests
          WHERE intake_kind = ?
          ORDER BY created_at DESC
        `)
      : database.prepare(`
          SELECT payload_json
          FROM website_intake_requests
          ORDER BY created_at DESC
        `);

    const rows = intakeKind && ALLOWED_INTAKE_KINDS.has(intakeKind)
      ? statement.all(intakeKind)
      : statement.all();

    return rows.map((row) => JSON.parse(row.payload_json));
  });
}

export function summarizeWebsiteIntakeRequests(intakeRequests = []) {
  const demoCount = intakeRequests.filter((entry) => entry.intake_kind === "demo").length;
  const trialCount = intakeRequests.filter((entry) => entry.intake_kind === "trial").length;
  const avgTeamSize = average(intakeRequests.map((entry) => entry.team_size ?? 0));
  const avgRepoCount = average(intakeRequests.map((entry) => entry.repo_count ?? 0));

  return {
    total_count: intakeRequests.length,
    demo_count: demoCount,
    trial_count: trialCount,
    avg_team_size: avgTeamSize,
    avg_repo_count: avgRepoCount,
  };
}

function normalizeIntakeRequest(input = {}) {
  const intakeKind = normalizeIntakeKind(input.intake_kind ?? input.kind);
  const fullName = requireText(input.full_name ?? input.name, "full_name", 120);
  const workEmail = normalizeEmail(input.work_email ?? input.email);
  const company = requireText(input.company, "company", 160);
  const role = requireText(input.role, "role", 120);
  const primaryGoal = requireText(input.primary_goal ?? input.goal, "primary_goal", 240);
  const message = requireText(input.message, "message", 5000);
  const sourcePage = normalizeSourcePage(input.source_page);

  return {
    request_id: `intake-${intakeKind}-${randomUUID()}`,
    intake_kind: intakeKind,
    full_name: fullName,
    work_email: workEmail,
    company,
    role,
    team_size: normalizeCount(input.team_size, "team_size"),
    repo_count: normalizeCount(input.repo_count, "repo_count"),
    primary_goal: primaryGoal,
    message,
    source_page: sourcePage,
    status: "new",
    created_at: new Date().toISOString(),
  };
}

function normalizeIntakeKind(value) {
  const safeKind = String(value ?? "").trim().toLowerCase();
  if (!ALLOWED_INTAKE_KINDS.has(safeKind)) {
    throw new Error("intake_kind must be either demo or trial.");
  }

  return safeKind;
}

function normalizeEmail(value) {
  const safeValue = String(value ?? "").trim().toLowerCase();
  if (!safeValue || safeValue.length > 240 || !safeValue.includes("@") || !safeValue.includes(".")) {
    throw new Error("work_email must be a valid email address.");
  }

  return safeValue;
}

function normalizeSourcePage(value) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue || safeValue.length > 160 || !safeValue.startsWith("/")) {
    throw new Error("source_page must be a valid relative path.");
  }

  return safeValue;
}

function normalizeCount(value, field) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${field} must be a non-negative number.`);
  }

  return Math.min(Math.round(numeric), 100000);
}

function requireText(value, field, maxLength) {
  const safeValue = String(value ?? "").trim();
  if (!safeValue) {
    throw new Error(`${field} is required.`);
  }

  if (safeValue.length > maxLength) {
    throw new Error(`${field} exceeds the allowed length.`);
  }

  return safeValue;
}

function average(values) {
  const numericValues = values.map((value) => Number(value || 0));
  if (numericValues.length === 0) {
    return 0;
  }

  return Math.round((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length) * 10) / 10;
}
