export const STACK_PRESET_SCHEMA_VERSION = 1;

const STACK_PRESETS = Object.freeze([
  preset({
    stack_id: "next-fullstack-postgres",
    display_name: "Next.js full-stack + Postgres",
    frontend_framework: "Next.js App Router",
    backend_framework: "Next.js route handlers/server actions",
    database: "Postgres",
    orm: "Prisma or Drizzle placeholder",
    auth_approach: "Provider-backed auth placeholder with app-owned RBAC notes",
    test_framework: "Vitest or node --test plus Playwright later",
    package_manager: "npm",
    dev_command: "npm run dev",
    build_command: "npm run build",
    deploy_target: "Vercel or Node host with managed Postgres",
    folder_structure: ["app", "components", "lib", "db", "tests", "fixtures", "docs"],
    supported_modules: ["frontend", "backend", "database", "fixtures", "tests", "benchmarks", "docs"],
    limitations: [
      "Backend boundaries need discipline because UI and API live in one app.",
      "Production auth, payments, email, OCR, and object storage remain placeholders.",
    ],
    security_notes: [
      "Never generate raw card fields; use hosted/tokenized payment placeholders.",
      "Generated env files must contain placeholders only.",
    ],
    pros: [
      "Fastest full-stack starter.",
      "One app for UI, route handlers, docs, fixtures, and demos.",
      "Good default for sales MVP and product starter modes.",
    ],
    cons: [
      "Can blur API/service boundaries.",
      "Long-running backend jobs need separate workers later.",
    ],
    best_use: "Product starter, sales MVP, customer portal, and back-office prototype.",
  }),
  preset({
    stack_id: "react-node-postgres",
    display_name: "React + Node API + Postgres",
    frontend_framework: "React/Vite",
    backend_framework: "Node API service",
    database: "Postgres",
    orm: "Prisma or Drizzle placeholder",
    auth_approach: "API-issued session placeholder with provider handoff notes",
    test_framework: "Vitest/node --test plus Playwright later",
    package_manager: "npm workspaces",
    dev_command: "npm run dev",
    build_command: "npm run build",
    deploy_target: "Static/web host plus Node service and managed Postgres",
    folder_structure: ["apps/web", "services/api", "packages/contracts", "db", "tests", "fixtures", "docs"],
    supported_modules: ["frontend", "backend", "database", "contracts", "fixtures", "tests", "benchmarks", "docs"],
    limitations: [
      "More folders and local orchestration than the Next.js preset.",
      "Requires API contract discipline from the start.",
    ],
    security_notes: [
      "Keep domain logic and RBAC checks server-side.",
      "Do not expose payment provider or object-storage secrets to the web app.",
    ],
    pros: [
      "Clear frontend/backend split.",
      "Good service boundary for complex back-office flows.",
      "Easy to grow into workers and separate deployments.",
    ],
    cons: [
      "More setup weight than one Next.js app.",
      "Requires shared contracts to avoid drift.",
    ],
    best_use: "Back-office plus API service starter.",
  }),
  preset({
    stack_id: "spring-react-postgres",
    display_name: "Java Spring Boot + React + Postgres",
    frontend_framework: "React/Vite",
    backend_framework: "Spring Boot",
    database: "Postgres",
    orm: "JPA/Flyway placeholder",
    auth_approach: "OIDC provider placeholder with app-owned RBAC/ABAC notes",
    test_framework: "JUnit plus frontend unit tests",
    package_manager: "Maven and npm",
    dev_command: "./mvnw spring-boot:run and npm run dev",
    build_command: "./mvnw test package and npm run build",
    deploy_target: "Containerized Spring service, static/web host, managed Postgres",
    folder_structure: ["services/api-spring", "apps/web", "db/migrations", "tests", "fixtures", "docs"],
    supported_modules: ["backend", "frontend", "database", "fixtures", "tests", "benchmarks", "docs"],
    limitations: [
      "Heavier local setup.",
      "Java is not the default beheart implementation stack, so shared logic should stay language-neutral.",
    ],
    security_notes: [
      "Use OIDC and short-lived credentials for production.",
      "Payment, OCR, notification, and object storage integrations remain placeholders.",
    ],
    pros: [
      "Enterprise-friendly backend shape.",
      "Strong typing and common agency/vendor fit.",
      "Good for API/service-heavy starters.",
    ],
    cons: [
      "More operational and dependency weight.",
      "Generated Java skeleton should stay isolated from Node package logic.",
    ],
    best_use: "Agency/backend-heavy starter and enterprise demo path.",
  }),
]);

const PRESET_BY_ID = new Map(STACK_PRESETS.map((entry) => [entry.stack_id, entry]));

export function listStackPresets() {
  return STACK_PRESETS.map(clonePreset);
}

export function selectStackPreset(stackId) {
  const normalized = normalizeStackId(stackId);
  const presetEntry = PRESET_BY_ID.get(normalized);
  if (!presetEntry) {
    throw new Error(`Unknown stack preset "${stackId}". Next action: run heart generate stacks.`);
  }
  return clonePreset(presetEntry);
}

export function validateStackPreset(stackId) {
  const errors = [];
  let selected;
  try {
    selected = selectStackPreset(stackId);
  } catch (error) {
    return {
      schema_version: STACK_PRESET_SCHEMA_VERSION,
      stack_id: String(stackId ?? ""),
      status: "invalid",
      errors: [error.message],
      warnings: [],
    };
  }

  const required = [
    "stack_id",
    "display_name",
    "frontend_framework",
    "backend_framework",
    "database",
    "orm",
    "auth_approach",
    "test_framework",
    "package_manager",
    "dev_command",
    "build_command",
    "deploy_target",
  ];
  for (const field of required) {
    if (!String(selected[field] ?? "").trim()) {
      errors.push(`Missing stack preset field: ${field}`);
    }
  }
  for (const field of ["folder_structure", "supported_modules", "limitations", "security_notes"]) {
    if (!Array.isArray(selected[field]) || selected[field].length === 0) {
      errors.push(`Stack preset ${field} must be a non-empty array.`);
    }
  }

  return {
    schema_version: STACK_PRESET_SCHEMA_VERSION,
    stack_id: selected.stack_id,
    status: errors.length > 0 ? "invalid" : "valid",
    errors,
    warnings: selected.limitations ?? [],
  };
}

export function explainStackTradeoffs(stackId) {
  const selected = selectStackPreset(stackId);
  return {
    schema_version: STACK_PRESET_SCHEMA_VERSION,
    stack_id: selected.stack_id,
    display_name: selected.display_name,
    best_use: selected.best_use,
    pros: [...selected.pros],
    cons: [...selected.cons],
    limitations: [...selected.limitations],
    security_notes: [...selected.security_notes],
    deployment_path: selected.deploy_target,
    commands: {
      dev: selected.dev_command,
      build: selected.build_command,
    },
  };
}

export function normalizeStackId(stackId) {
  return String(stackId ?? "").trim().toLowerCase().replace(/_/g, "-");
}

function preset(input) {
  return Object.freeze({
    schema_version: STACK_PRESET_SCHEMA_VERSION,
    ...input,
  });
}

function clonePreset(input) {
  return {
    ...input,
    folder_structure: [...input.folder_structure],
    supported_modules: [...input.supported_modules],
    limitations: [...input.limitations],
    security_notes: [...input.security_notes],
    pros: [...input.pros],
    cons: [...input.cons],
  };
}
