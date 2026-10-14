/**
 * Display formatting. All money is integer pence, all dates ISO strings in UTC
 * (as written by SQLite's datetime('now')). Formatters are server-side only so
 * there is no hydration mismatch.
 */

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
});

/** 8900 -> "£89.00" */
export function formatPence(pence: number): string {
  return GBP.format((pence ?? 0) / 100);
}

/** 8900 -> "£89", 3950 -> "£39.50" (whole pounds drop the decimals, like a shop) */
export function formatPenceShort(pence: number): string {
  const amount = pence ?? 0;
  if (amount % 100 === 0) {
    return `£${(amount / 100).toLocaleString('en-GB')}`;
  }
  return GBP.format(amount / 100);
}

/** Free or a price. */
export function priceLabel(pence: number): string {
  return pence > 0 ? formatPenceShort(pence) : 'Free';
}

function parseUtc(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value.replace(' ', 'T') + 'Z') : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 March 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date);
}

/** "12 March 2026, 14:05" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(date);
}

/** "3 days ago", "2 hours ago", "just now" */
export function timeAgo(value: string | Date | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** 95 -> "1h 35m", 45 -> "45m", 0 -> "-" */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** Course total duration, e.g. "3h 40m of content" */
export function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return 'No video content yet';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min of content`;
  if (rest === 0) return `${hours} hours of content`;
  return `${hours}h ${rest}m of content`;
}

/** "1h 35m" style upgrades for the admin chart axis. */
export function formatDay(value: string): string {
  const date = parseUtc(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(date);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '-';
  return `${value.toFixed(digits)}%`;
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "512 KB" / "1.4 MB" - display helper for file sizes. */
export function humanFileSizeShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  const honorifics = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'prof', 'professor', 'sir', 'dame']);
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !honorifics.has(part.toLowerCase().replace(/\.$/, '')));
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic avatar tint from a name, so avatars look intentional. */
export function avatarTint(name: string): string {
  const palette = [
    'bg-brand-100 text-brand-800',
    'bg-emerald-100 text-emerald-800',
    'bg-amber-100 text-amber-900',
    'bg-sky-100 text-sky-900',
    'bg-rose-100 text-rose-900',
    'bg-indigo-100 text-indigo-900',
  ];
  let sum = 0;
  for (const char of name) sum += char.charCodeAt(0);
  return palette[sum % palette.length];
}
