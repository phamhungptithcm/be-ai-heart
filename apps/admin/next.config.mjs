import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appRoot, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    BE_AI_HEART_SERVICE_STORAGE_ROOT: path.join(monorepoRoot, "services", "api", "data"),
    BE_AI_HEART_PORTAL_APP_ROOT: path.join(monorepoRoot, "apps", "portal"),
    BE_AI_HEART_ADMIN_APP_ROOT: path.join(monorepoRoot, "apps", "admin"),
    BE_AI_HEART_DEFAULT_ADMIN_ACTOR: "owner-admin",
    NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL: process.env.BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
    NEXT_PUBLIC_BE_AI_HEART_DEFAULT_ADMIN_SESSION:
      process.env.BE_AI_HEART_DEFAULT_ADMIN_SESSION ?? "admin-owner-session",
  },
};

export default nextConfig;
