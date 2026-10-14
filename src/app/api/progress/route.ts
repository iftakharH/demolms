import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { activeEnrolment, saveVideoPosition } from '@/lib/progress';

export const dynamic = 'force-dynamic';

/**
 * Playback position autosave. Called by the player every few seconds.
 * Enrolment and course ownership are both checked server-side.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ saved: false, error: 'Not signed in' }, { status: 401 });

  let payload: { lessonId?: number; positionSeconds?: number };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ saved: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const lessonId = Number(payload.lessonId);
  const position = Number(payload.positionSeconds);
  if (!Number.isFinite(lessonId) || !Number.isFinite(position)) {
    return NextResponse.json({ saved: false, error: 'Missing lessonId or positionSeconds' }, { status: 400 });
  }

  const lesson = queryOne<{ courseId: number; type: string }>(
    'SELECT course_id AS courseId, type FROM lessons WHERE id = ?',
    lessonId,
  );
  if (!lesson) return NextResponse.json({ saved: false, error: 'Unknown lesson' }, { status: 404 });
  if (lesson.type !== 'video') {
    return NextResponse.json({ saved: false, error: 'Not a video lesson' }, { status: 400 });
  }

  const enrolment = activeEnrolment(user.id, lesson.courseId);
  if (!enrolment) {
    return NextResponse.json({ saved: false, error: 'Not enrolled' }, { status: 403 });
  }

  saveVideoPosition(user.id, lesson.courseId, lessonId, position);
  return NextResponse.json({ saved: true, lessonId, positionSeconds: Math.round(position) });
}
