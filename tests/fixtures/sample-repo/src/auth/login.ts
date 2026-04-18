import { createSessionToken, recordLoginAudit } from "./session";

export async function loginUser(username: string) {
  const normalizedUsername = normalizeUsername(username);
  const token = createSessionToken(normalizedUsername);
  return {
    username: normalizedUsername,
    token,
    audit: recordLoginAudit(normalizedUsername),
  };
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
