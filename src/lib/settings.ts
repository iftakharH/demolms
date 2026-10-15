import { queryOne, run } from './db';

/**
 * Platform settings: a tiny key/value table read on public pages.
 * Missing keys fall back to defaults, so a fresh database needs no seed rows.
 */

export interface PlatformSettings {
  announcementEnabled: boolean;
  announcementText: string;
  enrolmentsPaused: boolean;
}

const DEFAULTS: Record<string, string> = {
  announcement_enabled: '0',
  announcement_text: '',
  enrolments_paused: '0',
};

export function getSetting(key: string): string {
  return queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value ?? DEFAULTS[key] ?? '';
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key,
    value,
  );
}

export function platformSettings(): PlatformSettings {
  return {
    announcementEnabled: getSetting('announcement_enabled') === '1',
    announcementText: getSetting('announcement_text'),
    enrolmentsPaused: getSetting('enrolments_paused') === '1',
  };
}
