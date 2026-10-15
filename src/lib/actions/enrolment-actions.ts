'use server';

import { redirect } from 'next/navigation';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { queryOne, run } from '@/lib/db';
import { isStaffRole } from '@/lib/types';
import { platformSettings } from '@/lib/settings';

/**
 * Free one-click enrolment.
 * Paid courses go through the mock checkout (see payment-actions.ts).
 */
export async function enrolFreeAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/courses/${slug}`)}`);
  }

  // Staff accounts never enrol - support access is how they act for a learner.
  if (isStaffRole(user.role)) {
    redirect(`/courses/${slug}?staff=1`);
  }

  // platform pause: no new enrolments while paused
  if (platformSettings().enrolmentsPaused) {
    redirect(`/courses/${slug}?paused=1`);
  }

  const course = queryOne<{ id: number; title: string; price_pence: number; slug: string }>(
    "SELECT id, title, price_pence, slug FROM courses WHERE slug = ? AND status = 'published'",
    slug,
  );
  if (!course || course.price_pence > 0) {
    redirect(`/courses/${slug}`);
  }

  const existing = queryOne<{ id: number; access_revoked: number }>(
    'SELECT id, access_revoked FROM enrolments WHERE user_id = ? AND course_id = ?',
    user.id,
    course.id,
  );

  if (existing && existing.access_revoked === 0) {
    redirect(`/learn/my-learning?already=1`);
  }

  if (existing) {
    run(
      "UPDATE enrolments SET access_revoked = 0, revoked_reason = NULL, enrolled_at = datetime('now') WHERE id = ?",
      existing.id,
    );
  } else {
    run(
      "INSERT INTO enrolments (user_id, course_id, source) VALUES (?, ?, 'free')",
      user.id,
      course.id,
    );
  }

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.enrolmentCreated,
    entityType: 'course',
    entityId: course.id,
    summary: `Free enrolment: ${user.email} joined "${course.title}"`,
    meta: { source: 'free' },
  });

  notify({
    userId: user.id,
    type: 'enrolment_created',
    title: `You are enrolled in ${course.title}`,
    body: 'Your progress and notes are saved automatically.',
    href: `/learn/courses/${course.slug}`,
  });

  redirect(`/learn/courses/${course.slug}?welcome=1`);
}
