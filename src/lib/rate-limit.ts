import { queryOne, run } from './db';

/**
 * DB-backed rate limiter. Survives dev-mode reloads and server restarts.
 * Keys look like 'login:ip:127.0.0.1' or 'login:email:someone@example.com'.
 */

interface LimitRow {
  key: string;
  count: number;
  window_started_at: string;
  blocked_until: string | null;
}

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function secondsBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso.replace(' ', 'T') + 'Z').getTime();
  return Math.max(0, Math.round((toDate.getTime() - from) / 1000));
}

/** Check without recording an attempt. */
export function checkLimit(
  key: string,
  options: { max: number; windowMinutes: number; blockMinutes: number },
): LimitResult {
  const row = queryOne<LimitRow>('SELECT * FROM rate_limits WHERE key = ?', key);
  if (!row) return { allowed: true, retryAfterSeconds: 0, remaining: options.max };

  const now = new Date();

  if (row.blocked_until) {
    const until = new Date(row.blocked_until.replace(' ', 'T') + 'Z');
    if (until > now) {
      return {
        allowed: false,
        retryAfterSeconds: secondsBetween(row.blocked_until, now) === 0 ? 1 : Math.max(1, Math.round((until.getTime() - now.getTime()) / 1000)),
        remaining: 0,
      };
    }
  }

  const windowAgeSeconds = secondsBetween(row.window_started_at, now);
  if (windowAgeSeconds > options.windowMinutes * 60) {
    // window expired
    return { allowed: true, retryAfterSeconds: 0, remaining: options.max };
  }

  const remaining = Math.max(0, options.max - row.count);
  return { allowed: remaining > 0, retryAfterSeconds: 0, remaining };
}

/** Record a failed attempt; blocks the key once the window limit is exceeded. */
export function recordFailure(
  key: string,
  options: { max: number; windowMinutes: number; blockMinutes: number },
): LimitResult {
  const row = queryOne<LimitRow>('SELECT * FROM rate_limits WHERE key = ?', key);
  const now = new Date();

  if (!row) {
    run(
      'INSERT INTO rate_limits (key, count, window_started_at) VALUES (?, 1, ?)',
      key,
      nowIso(),
    );
    return { allowed: options.max > 1, retryAfterSeconds: 0, remaining: Math.max(0, options.max - 1) };
  }

  const windowAgeSeconds = secondsBetween(row.window_started_at, now);
  const windowExpired = windowAgeSeconds > options.windowMinutes * 60;
  const count = windowExpired ? 1 : row.count + 1;
  const windowStart = windowExpired ? nowIso() : row.window_started_at;

  if (count >= options.max) {
    const blockedUntil = new Date(now.getTime() + options.blockMinutes * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    run(
      'UPDATE rate_limits SET count = ?, window_started_at = ?, blocked_until = ? WHERE key = ?',
      count,
      windowStart,
      blockedUntil,
      key,
    );
    return { allowed: false, retryAfterSeconds: options.blockMinutes * 60, remaining: 0 };
  }

  run(
    'UPDATE rate_limits SET count = ?, window_started_at = ?, blocked_until = NULL WHERE key = ?',
    count,
    windowStart,
    key,
  );
  return { allowed: true, retryAfterSeconds: 0, remaining: options.max - count };
}

/** Clear a key after a successful login. */
export function clearLimit(key: string): void {
  run('DELETE FROM rate_limits WHERE key = ?', key);
}

export const LIMITS = {
  /** Per account: a handful of wrong passwords and that account is locked briefly. */
  login: { max: 6, windowMinutes: 10, blockMinutes: 5 },
  /**
   * Per IP: deliberately generous. Locking a whole address after six wrong
   * passwords would take the rest of the office (or, in this demo, the next
   * reviewer at the same localhost) down with it. This only catches floods.
   */
  loginIp: { max: 30, windowMinutes: 10, blockMinutes: 5 },
  register: { max: 5, windowMinutes: 60, blockMinutes: 30 },
  reset: { max: 5, windowMinutes: 60, blockMinutes: 30 },
} as const;
