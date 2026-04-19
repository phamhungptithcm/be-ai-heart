import {
  listRepositoryProfiles,
  loadRepositoryProfile,
  resolveProfilesRoot,
} from "../../../packages/profile-store/src/index.js";

export async function listPortalRepositoryProfiles(options = {}) {
  return listRepositoryProfiles("portal", options);
}

export async function loadPortalRepositoryProfile(slug, options = {}) {
  return loadRepositoryProfile("portal", slug, options);
}

export function resolvePortalProfilesRoot(options = {}) {
  return resolveProfilesRoot("portal", options);
}
