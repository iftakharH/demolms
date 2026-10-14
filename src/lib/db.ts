import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Single better-sqlite3 connection for the whole process.
 * Next.js dev mode reloads modules on change, so the handle is cached on globalThis.
 */

const globalForDb = globalThis as unknown as { __demolmsDb?: Database.Database };

export function dbPath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  return path.join(process.cwd(), 'data', 'demolms.db');
}

export function getDb(): Database.Database {
  if (globalForDb.__demolmsDb) return globalForDb.__demolmsDb;

  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  globalForDb.__demolmsDb = db;
  return db;
}

/** SELECT returning many rows. */
export function query<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

/** SELECT returning the first row (or undefined). */
export function queryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

/** INSERT / UPDATE / DELETE. Returns info about the change. */
export function run(sql: string, ...params: unknown[]): Database.RunResult {
  return getDb().prepare(sql).run(...params);
}

/** Wrap a function in a transaction. */
export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

/** Count helper. */
export function count(sql: string, ...params: unknown[]): number {
  const row = queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM (${sql})`, ...params);
  return row?.n ?? 0;
}
