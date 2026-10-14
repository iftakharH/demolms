import { query } from '../db';

/** Live sessions for the profile page's "devices signed in" list. */

export interface SessionView {
  /** opaque key derived from the stored session hash - safe to put in a form */
  key: string;
  userAgent: string;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/** Stable, non-secret key for a session row (the raw token is the credential). */
export function sessionKey(tokenHash: string): string {
  return tokenHash.slice(0, 16);
}

export function listSessions(userId: number, currentTokenHash: string | null): SessionView[] {
  return query<{
    token_hash: string;
    user_agent: string | null;
    ip: string | null;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT token_hash, user_agent, ip, created_at, expires_at
       FROM sessions
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC`,
    userId,
  ).map((row) => ({
    key: sessionKey(row.token_hash),
    userAgent: row.user_agent ?? 'Unknown device',
    ip: row.ip,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isCurrent: currentTokenHash !== null && row.token_hash === currentTokenHash,
  }));
}
