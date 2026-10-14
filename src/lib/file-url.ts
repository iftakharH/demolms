/**
 * Browser-safe helpers for displaying stored files.
 * Keep this module free of Node built-ins and database imports so client
 * components can use it (uploads.ts is server-only).
 */

export function fileUrl(relPath: string | null | undefined): string {
  if (!relPath) return '';
  if (relPath.startsWith('http')) return relPath;
  const encoded = relPath.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `/uploads/${encoded}`;
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
