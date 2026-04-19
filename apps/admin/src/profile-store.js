import {
  listRepositoryProfiles,
  loadRepositoryProfile,
  resolveProfilesRoot,
} from "../../../packages/profile-store/src/index.js";

export async function listAdminRepositoryProfiles(options = {}) {
  return listRepositoryProfiles("admin", options);
}

export async function loadAdminRepositoryProfile(slug, options = {}) {
  return loadRepositoryProfile("admin", slug, options);
}

export function resolveAdminProfilesRoot(options = {}) {
  return resolveProfilesRoot("admin", options);
}
