import fs from 'node:fs';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { activeEnrolment } from '@/lib/progress';
import { absolutePath } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/**
 * Access-checked lesson resource download.
 *
 * Lesson files live under public/uploads, but resources are never linked
 * directly: this route checks that the signed-in learner is enrolled on the
 * course (and has not been refunded) before streaming the file.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resourceId = Number.parseInt(id, 10);
  if (!Number.isFinite(resourceId)) {
    return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to download course resources.' }, { status: 401 });
  }

  const resource = queryOne<{
    resourceId: number;
    courseId: number;
    title: string;
    path: string;
    originalName: string;
    mime: string;
  }>(
    `SELECT r.id AS resourceId, r.course_id AS courseId, r.title,
            f.path, f.original_name AS originalName, f.mime
       FROM lesson_resources r
       JOIN files f ON f.id = r.file_id
      WHERE r.id = ?`,
    resourceId,
  );
  if (!resource) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });

  const isStaff = user.role === 'admin' || user.role === 'auditor';
  if (!isStaff && !activeEnrolment(user.id, resource.courseId)) {
    return NextResponse.json(
      { error: 'This download is for enrolled learners. Enrol to get access.' },
      { status: 403 },
    );
  }

  const absolute = absolutePath(resource.path);
  if (!fs.existsSync(absolute)) {
    return NextResponse.json({ error: 'That file is missing from storage.' }, { status: 404 });
  }

  const bytes = fs.readFileSync(absolute);
  const extension = (resource.originalName.split('.').pop() ?? '').toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension] ?? resource.mime ?? 'application/octet-stream';
  const safeName = resource.originalName.replace(/[^\w.\- ]+/g, '_');

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
    },
  });
}
