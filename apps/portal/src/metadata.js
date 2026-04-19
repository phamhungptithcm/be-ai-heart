const DEFAULT_BASE_URL = "http://127.0.0.1:3001";

export function createPortalMetadata({
  title,
  description,
  path = "/",
  keywords = [],
} = {}) {
  const baseUrl = resolveBaseUrl(process.env.NEXT_PUBLIC_BE_AI_HEART_PORTAL_BASE_URL, DEFAULT_BASE_URL);
  const resolvedTitle = title ? `${title} | BeHeart Portal` : "BeHeart Portal";
  const safeDescription =
    description ?? "Customer portal for project memory, diagrams, documents, benchmarks, and usage visibility.";

  return {
    title: resolvedTitle,
    description: safeDescription,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: path,
    },
    keywords,
    robots: {
      index: false,
      follow: false,
    },
  };
}

function resolveBaseUrl(value, fallback) {
  const raw = String(value ?? fallback).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
