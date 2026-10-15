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
  /** set when an admin opened this session through support access */
  supportByEmail: string | null;
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
    supportByEmail: string | null;
  }>(
    `SELECT s.token_hash, s.user_agent, s.ip, s.created_at, s.expires_at,
            a.email AS supportByEmail
       FROM sessions s
       LEFT JOIN users a ON a.id = s.impersonated_by
      WHERE s.user_id = ? AND s.expires_at > datetime('now')
      ORDER BY s.created_at DESC`,
    userId,
  ).map((row) => ({
    key: sessionKey(row.token_hash),
    userAgent: row.user_agent ?? 'Unknown device',
    ip: row.ip,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isCurrent: currentTokenHash !== null && row.token_hash === currentTokenHash,
    supportByEmail: row.supportByEmail,
  }));
}
