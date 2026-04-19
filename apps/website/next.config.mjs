/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BE_AI_HEART_API_BASE_URL: process.env.BE_AI_HEART_API_BASE_URL ?? "http://127.0.0.1:4010",
    NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL: process.env.BE_AI_HEART_PORTAL_BASE_URL ?? "http://127.0.0.1:3001",
    NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL: process.env.BE_AI_HEART_WEBSITE_BASE_URL ?? "http://127.0.0.1:3000",
  },
};

export default nextConfig;
