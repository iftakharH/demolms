'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { queryOne } from '@/lib/db';
import { notify } from '@/lib/notify';
import { courseCompletion, maybeCompleteCourse, markLessonComplete, unmarkLessonComplete } from '@/lib/progress';
import { issueCertificateIfEligible } from '@/lib/certificates';

interface LessonContext {
  lessonId: number;
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  lessonTitle: string;
}

async function lessonContext(lessonId: number): Promise<LessonContext | null> {
  return (
    queryOne<LessonContext>(
      `SELECT l.id AS lessonId, l.course_id AS courseId, c.slug AS courseSlug, c.title AS courseTitle,
              l.title AS lessonTitle
         FROM lessons l JOIN courses c ON c.id = l.course_id
        WHERE l.id = ?`,
      lessonId,
    ) ?? null
  );
}

/** Mark a lesson complete, then move on (or finish the course). */
export async function completeLessonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const goNext = formData.get('next') === '1';
  const context = await lessonContext(lessonId);
  if (!context) redirect('/dashboard');

  markLessonComplete(user.id, context.courseId, lessonId);
  const outcome = maybeCompleteCourse(user.id, context.courseId);

  if (outcome.completed && !outcome.already) {
    const certificate = issueCertificateIfEligible(user.id, context.courseId);
    notify({
      userId: user.id,
      type: 'course_completed',
      title: `You completed ${context.courseTitle}`,
      body: certificate
        ? `Your certificate ${certificate.certificateId} has been issued.`
        : 'Well done. Your progress is saved.',
      href: certificate ? '/learn/certificates' : `/learn/courses/${context.courseSlug}`,
    });
    logAudit({
      actor: { id: user.id, email: user.email, role: user.role },
      action: 'course.completed',
      entityType: 'course',
      entityId: context.courseId,
      summary: `Course completed: ${context.courseTitle} by ${user.email}`,
      meta: { certificate: certificate?.certificateId ?? null },
    });
  }

  revalidatePath(`/learn/courses/${context.courseSlug}`);
  revalidatePath('/learn/my-learning');
  revalidatePath('/dashboard');

  if (goNext) {
    const completion = courseCompletion(user.id, context.courseId);
    if (completion.nextLessonId) {
      redirect(`/learn/courses/${context.courseSlug}?lesson=${completion.nextLessonId}&flash=completed`);
    }
    redirect(`/learn/courses/${context.courseSlug}?finished=1&flash=completed`);
  }

  redirect(`/learn/courses/${context.courseSlug}?lesson=${lessonId}&flash=completed`);
}

/** Let a learner reopen a lesson they marked done by mistake. */
export async function reopenLessonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const lessonId = Number.parseInt(String(formData.get('lesson_id') ?? ''), 10);
  const context = await lessonContext(lessonId);
  if (!context) redirect('/dashboard');

  unmarkLessonComplete(user.id, lessonId);
  revalidatePath(`/learn/courses/${context.courseSlug}`);
  revalidatePath('/learn/my-learning');
  redirect(`/learn/courses/${context.courseSlug}?lesson=${lessonId}&flash=reopened`);
}
