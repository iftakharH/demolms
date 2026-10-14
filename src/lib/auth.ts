import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from './db';
import { hmacHex, safeEqual, sha256, token } from './ids';
import { SESSION_COOKIE, SESSION_DAYS, SESSION_SECRET } from './env';import { isStaffRole, toSessionUser, type DbUser, type Role, type SessionRow, type SessionUser } from './types';

/* ------------------------------------------------------------------ passwords */

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ cookie signing */

function sign(raw: string): string {
  return `${raw}.${hmacHex(SESSION_SECRET, raw)}`;
}

function unsign(signed: string): string | null {
  const index = signed.lastIndexOf('.');
  if (index <= 0) return null;
  const raw = signed.slice(0, index);
  const signature = signed.slice(index + 1);
  if (!safeEqual(signature, hmacHex(SESSION_SECRET, raw))) return null;
  return raw;
}

/* ------------------------------------------------------------------ sessions */

export interface CreatedSession {
  raw: string;
  expiresAt: string;
}

function futureIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString().slice(0, 19).replace('T', ' ');
}

/** Creates a session row and writes the signed cookie. Server actions / route handlers only. */
export async function createSession(
  userId: number,
  options: { needsMfa?: boolean } = {},
): Promise<CreatedSession> {
  const raw = token(32);
  const expiresAt = futureIso(SESSION_DAYS * 24 * 60);
  const headerList = await headers();

  run(
    `INSERT INTO sessions (token_hash, user_id, needs_mfa, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    sha256(raw),
    userId,
    options.needsMfa ? 1 : 0,
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1',
    headerList.get('user-agent')?.slice(0, 250) ?? '',
    expiresAt,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sign(raw), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // localhost demo over http
    path: '/',
    expires: new Date(expiresAt.replace(' ', 'T') + 'Z'),
  });

  return { raw, expiresAt };
}

export interface CurrentSession {
  user: SessionUser;
  session: SessionRow;
}

/**
 * Reads and validates the session cookie against the sessions table.
 * Memoised per request so a page can call it freely.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signed) return null;

  const raw = unsign(signed);
  if (!raw) return null;

  const row = queryOne<SessionRow & DbUser & { session_id: number }>(
    `SELECT s.token_hash, s.user_id, s.needs_mfa, s.ip, s.user_agent, s.created_at, s.expires_at,
            u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
    sha256(raw),
  );
  if (!row) return null;
  if (!row.is_active) return null;

  const session: SessionRow = {
    token_hash: row.token_hash,
    user_id: row.user_id,
    needs_mfa: row.needs_mfa,
    ip: row.ip,
    user_agent: row.user_agent,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
  const user = toSessionUser(row as unknown as DbUser);
  return { user, session };
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const current = await getSession();
  if (!current) return null;
  if (current.session.needs_mfa) return null; // not fully signed in yet
  return current.user;
});

/** Half-authenticated admin waiting for the TOTP step. */
export const getMfaPendingUser = cache(async (): Promise<SessionUser | null> => {
  const current = await getSession();
  if (!current || !current.session.needs_mfa) return null;
  return current.user;
});

export async function completeMfaStep(): Promise<void> {
  const current = await getSession();
  if (!current) return;
  run('UPDATE sessions SET needs_mfa = 0 WHERE token_hash = ?', current.session.token_hash);
  run('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?', current.user.id);
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (signed) {
    const raw = unsign(signed);
    if (raw) run('DELETE FROM sessions WHERE token_hash = ?', sha256(raw));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Delete every session row for a user (no cookie changes). */
export function destroyAllSessionsForUser(userId: number): number {
  const info = run('DELETE FROM sessions WHERE user_id = ?', userId);
  return info.changes;
}

/** The stored hash of the current request's session, if any (used by the sessions list). */
export async function currentSessionTokenHash(): Promise<string | null> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!signed) return null;
  const raw = unsign(signed);
  return raw ? sha256(raw) : null;
}

/** "Log out of all devices": every session row for the user is removed. */
export async function destroyAllSessions(userId: number): Promise<number> {
  const removed = destroyAllSessionsForUser(userId);
  await destroyCurrentSession();
  return removed;
}

export function activeSessionCount(userId: number): number {
  const row = queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > datetime('now')",
    userId,
  );
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ tokens */

export function createAuthToken(
  userId: number,
  kind: 'verify_email' | 'reset_password',
  ttlMinutes: number,
): string {
  const raw = token(24);
  run(
    `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    userId,
    kind,
    sha256(raw),
    futureIso(ttlMinutes),
  );
  return raw;
}

export interface ConsumedToken {
  userId: number;
}

export function consumeAuthToken(kind: 'verify_email' | 'reset_password', raw: string): ConsumedToken | null {
  const row = queryOne<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM auth_tokens
      WHERE kind = ? AND token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
    kind,
    sha256(raw),
  );
  if (!row) return null;
  run("UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?", row.id);
  return { userId: row.user_id };
}

/* ------------------------------------------------------------------ users */

export function findUserByEmail(email: string): DbUser | undefined {
  return queryOne<DbUser>('SELECT * FROM users WHERE email = ? COLLATE NOCASE', email.trim());
}

export function findUserById(id: number): DbUser | undefined {
  return queryOne<DbUser>('SELECT * FROM users WHERE id = ?', id);
}

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}): number {
  const info = run(
    `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`,
    input.email.trim().toLowerCase(),
    input.name.trim(),
    hashPassword(input.password),
    input.role ?? 'learner',
  );
  return Number(info.lastInsertRowid);
}

/* ------------------------------------------------------------------ guards */

/** Throws a redirect to /login (preserving the intended destination) when signed out. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    redirect(target);
  }
  return user;
}

/**
 * Staff guard. Admin and auditor both reach /admin; write actions re-check the
 * role separately (auditor is read-only).
 */
export async function requireStaff(nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!isStaffRole(user.role)) redirect('/dashboard');
  return user;
}

/** Write guard: auditors are rejected server-side, not just hidden in the UI. */
export async function requireAdminWriter(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN: auditor accounts are read-only');
  }
  return user;
}

export async function requireVerified(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.emailVerified) redirect('/verify-email/notice');
  return user;
}

/** Users who opted into (or out of) a category of email. */
export function usersWithPreference(pref: 'receipts' | 'grades' | 'certificates' | 'marketing'): { id: number; email: string; name: string }[] {
  return query<{ id: number; email: string; name: string }>(
    `SELECT id, email, name FROM users
      WHERE role = 'learner' AND is_active = 1
        AND json_extract(email_prefs_json, '$.' || ?) IS NOT 0`,
    pref,
  );
}
