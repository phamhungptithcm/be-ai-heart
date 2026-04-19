const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

export function createWebsiteMetadata({
  title,
  description,
  path = "/",
  keywords = [],
} = {}) {
  const baseUrl = resolveBaseUrl(process.env.NEXT_PUBLIC_BE_AI_HEART_WEBSITE_BASE_URL, DEFAULT_BASE_URL);
  const resolvedTitle = title ? `${title} | BeHeart` : "BeHeart";
  const safeDescription =
    description ?? "Project memory, benchmark proof, and governed AI-assisted software delivery.";

  return {
    title: resolvedTitle,
    description: safeDescription,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: path,
    },
    keywords,
    openGraph: {
      title: resolvedTitle,
      description: safeDescription,
      type: "website",
      url: path,
      siteName: "BeHeart",
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: safeDescription,
    },
  };
}

function resolveBaseUrl(value, fallback) {
  const raw = String(value ?? fallback).trim();
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}
