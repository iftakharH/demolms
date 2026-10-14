import fs from 'node:fs';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { absolutePath } from '@/lib/uploads';
import { isStaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Assignment attachment download: only the learner who submitted it, or staff,
 * can fetch the file. Nothing in /public is linked directly.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const submissionId = Number.parseInt(id, 10);
  if (!Number.isFinite(submissionId)) {
    return NextResponse.json({ error: 'Unknown submission' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to download submissions.' }, { status: 401 });

  const submission = queryOne<{
    userId: number;
    path: string;
    originalName: string;
    mime: string;
  }>(
    `SELECT s.user_id AS userId, f.path, f.original_name AS originalName, f.mime
       FROM assignment_submissions s
       JOIN files f ON f.id = s.file_id
      WHERE s.id = ?`,
    submissionId,
  );
  if (!submission) return NextResponse.json({ error: 'No file on that submission' }, { status: 404 });

  if (submission.userId !== user.id && !isStaffRole(user.role)) {
    return NextResponse.json({ error: 'That file is not yours.' }, { status: 403 });
  }

  const absolute = absolutePath(submission.path);
  if (!fs.existsSync(absolute)) {
    return NextResponse.json({ error: 'File missing from storage' }, { status: 404 });
  }

  const bytes = fs.readFileSync(absolute);
  const safeName = submission.originalName.replace(/[^\w.\- ]+/g, '_');

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': submission.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
    },
  });
}
