import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { activeEnrolment, saveNote } from '@/lib/progress';

export const dynamic = 'force-dynamic';

/** Lesson notes autosave (one note per lesson, updated in place). */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ saved: false, error: 'Not signed in' }, { status: 401 });

  let payload: { lessonId?: number; body?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ saved: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const lessonId = Number(payload.lessonId);
  const body = typeof payload.body === 'string' ? payload.body : '';
  if (!Number.isFinite(lessonId)) {
    return NextResponse.json({ saved: false, error: 'Missing lessonId' }, { status: 400 });
  }

  const lesson = queryOne<{ courseId: number }>('SELECT course_id AS courseId FROM lessons WHERE id = ?', lessonId);
  if (!lesson) return NextResponse.json({ saved: false, error: 'Unknown lesson' }, { status: 404 });
  if (!activeEnrolment(user.id, lesson.courseId)) {
    return NextResponse.json({ saved: false, error: 'Not enrolled' }, { status: 403 });
  }

  saveNote(user.id, lesson.courseId, lessonId, body);
  return NextResponse.json({ saved: true, savedAt: new Date().toISOString() });
}
