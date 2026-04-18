export function createSessionToken(username: string) {
  return `session-${username}`;
}

export function recordLoginAudit(username: string) {
  return {
    event: "login",
    username,
  };
}
