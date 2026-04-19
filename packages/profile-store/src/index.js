import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export async function listRepositoryProfiles(surface, options = {}) {
  const profilesRoot = resolveProfilesRoot(surface, options);

  try {
    const entries = await fs.readdir(profilesRoot, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      profiles.push(
        await loadRepositoryProfile(surface, entry.name, {
          includeDiagramContents: false,
          profilesRoot,
        }),
      );
    }

    return profiles.sort((left, right) => left.profile_slug.localeCompare(right.profile_slug));
  } catch {
    return [];
  }
}

export async function loadRepositoryProfile(surface, slug, options = {}) {
  const profileRoot = path.join(resolveProfilesRoot(surface, options), sanitizeSlug(slug));
  const profileRaw = await fs.readFile(path.join(profileRoot, "repository-profile.json"), "utf8");
  const profile = JSON.parse(profileRaw);

  if (!options.includeDiagramContents) {
    return profile;
  }

  const diagrams = [];
  for (const diagram of profile.diagrams ?? []) {
    const content = await fs.readFile(path.join(profileRoot, "diagrams", diagram.artifact_file), "utf8");
    diagrams.push({
      ...diagram,
      content,
    });
  }

  return {
    ...profile,
    diagrams,
  };
}

export function resolveProfilesRoot(surface, options = {}) {
  if (options.profilesRoot) {
    return options.profilesRoot;
  }

  if (typeof options === "string") {
    return path.join(options, "profiles");
  }

  if (options.appRoot) {
    return path.join(options.appRoot, "profiles");
  }

  const envRoot = resolveProfilesEnvRoot(surface);
  if (envRoot) {
    return envRoot;
  }

  const workspaceProfilesRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "profiles");
  if (existsSync(workspaceProfilesRoot)) {
    return workspaceProfilesRoot;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "apps", surface, "profiles");
}

export function sanitizeSlug(value) {
  return String(value ?? "profile")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile";
}

function resolveProfilesEnvRoot(surface) {
  const scopedKey = `BE_AI_HEART_${String(surface).toUpperCase()}_PROFILES_ROOT`;
  if (process.env[scopedKey]) {
    return path.resolve(process.env[scopedKey]);
  }

  if (process.env.BE_AI_HEART_PROFILES_ROOT) {
    return path.resolve(process.env.BE_AI_HEART_PROFILES_ROOT, surface);
  }

  return "";
}
