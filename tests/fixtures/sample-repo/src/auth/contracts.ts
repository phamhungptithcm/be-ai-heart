export interface SessionRecord {
  username: string;
  token: string;
}

export const buildAuditMessage = (username: string) => `audit:${username}`;
