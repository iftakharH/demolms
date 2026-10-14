import fs from 'node:fs';
import path from 'node:path';
import { run } from './db';
import { slugify } from './ids';
import { fileUrl as importedFileUrl } from './file-url';

/**
 * Server-only file storage. Everything lives under public/uploads so the demo
 * runs with no cloud storage. Videos, captions, posters, thumbnails and avatars
 * are served statically; lesson resources and submission files are streamed
 * through access-checked route handlers instead (their real path is never
 * linked).
 *
 * Client components must import display helpers from `@/lib/file-url` instead,
 * because this module reaches the filesystem and the database.
 */

export const STORAGE_ROOT = path.join(process.cwd(), 'public', 'uploads');

export type UploadPurpose =
  | 'video'
  | 'captions'
  | 'poster'
  | 'thumbnail'
  | 'resource'
  | 'submission'
  | 'avatar';

const PURPOSE_DIR: Record<UploadPurpose, string> = {
  video: 'videos',
  captions: 'captions',
  poster: 'posters',
  thumbnail: 'thumbnails',
  resource: 'resources',
  submission: 'submissions',
  avatar: 'avatars',
};

const ALLOWED_EXTENSIONS: Record<UploadPurpose, string[]> = {
  video: ['mp4', 'webm'],
  captions: ['vtt', 'srt'],
  poster: ['jpg', 'jpeg', 'png', 'webp'],
  thumbnail: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
  resource: ['pdf', 'zip', 'txt', 'md', 'csv', 'docx', 'xlsx'],
  submission: ['pdf', 'zip', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'docx'],
  avatar: ['jpg', 'jpeg', 'png', 'webp'],
};

const MAX_BYTES: Record<UploadPurpose, number> = {
  video: 200 * 1024 * 1024,
  captions: 1 * 1024 * 1024,
  poster: 8 * 1024 * 1024,
  thumbnail: 8 * 1024 * 1024,
  resource: 50 * 1024 * 1024,
  submission: 25 * 1024 * 1024,
  avatar: 4 * 1024 * 1024,
};

export interface StoredFile {
  id: number;
  path: string;
  url: string;
  originalName: string;
  mime: string;
  size: number;
}

export function fileUrl(relPath: string | null | undefined): string {
  return importedFileUrl(relPath);
}

export function absolutePath(relPath: string): string {
  const safe = relPath.replace(/\\/g, '/').replace(/\.\./g, '');
  return path.join(STORAGE_ROOT, safe);
}

export class UploadError extends Error {}

/**
 * Writes an uploaded file to disk and records it in the files table.
 * Returns null when no file was provided (field omitted), so callers can treat
 * uploads as optional.
 */
export async function saveUpload(
  file: File | null,
  purpose: UploadPurpose,
  uploadedBy: number | null,
): Promise<StoredFile | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;

  const originalName = file.name || 'upload';
  const extension = (originalName.split('.').pop() ?? '').toLowerCase();

  if (!ALLOWED_EXTENSIONS[purpose].includes(extension)) {
    throw new UploadError(
      `That file type is not allowed here. Accepted: ${ALLOWED_EXTENSIONS[purpose]
        .map((ext) => `.${ext}`)
        .join(', ')}`,
    );
  }
  if (file.size > MAX_BYTES[purpose]) {
    throw new UploadError(
      `That file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit: ${Math.round(
        MAX_BYTES[purpose] / 1024 / 1024,
      )} MB.`,
    );
  }

  const dir = PURPOSE_DIR[purpose];
  const base = slugify(originalName.replace(/\.[^.]+$/, '')) || 'file';
  const unique = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  const relPath = `${dir}/${unique}`;
  const target = absolutePath(relPath);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(target, buffer);

  const info = run(
    `INSERT INTO files (path, original_name, mime, size_bytes, purpose, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    relPath,
    originalName.slice(0, 200),
    file.type || 'application/octet-stream',
    buffer.length,
    purpose,
    uploadedBy,
  );

  return {
    id: Number(info.lastInsertRowid),
    path: relPath,
    url: fileUrl(relPath),
    originalName,
    mime: file.type || 'application/octet-stream',
    size: buffer.length,
  };
}

/** Delete a stored file (used when an admin removes a resource or thumbnail). */
export function removeUpload(relPath: string | null | undefined): void {
  if (!relPath) return;
  try {
    const target = absolutePath(relPath);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {
    console.error('[uploads] failed to delete', relPath, error);
  }
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
