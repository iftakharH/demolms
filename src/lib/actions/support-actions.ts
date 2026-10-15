'use server';

import { redirect } from 'next/navigation';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import {
  createSupportSession,
  endSupportSession,
  findUserById,
  requireAdminWriter,
} from '@/lib/auth';
import { queryOne } from '@/lib/db';

/**
 * Support access ("Enter as learner").
 *
 * The admin lands directly in the learner's account without signing out: a
 * separate session row for the learner is created and stored in its own signed
 * cookie, so the admin's session cookie is never touched. Both the entry and
 * the exit are written to the audit log.
 */

interface TargetUser {
  id: number;
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'auditor';
  is_active: number;
}

export async function enterLearnerAccountAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const userId = Number.parseInt(String(formData.get('user_id') ?? ''), 10);
  const back = Number.isFinite(userId) ? `/admin/users/${userId}` : '/admin/users';

  const target = queryOne<TargetUser>(
    'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
    userId,
  );
  if (!target) {
    redirect(`/admin/users?error=${encodeURIComponent('User not found.')}`);
  }
  if (target.role !== 'learner') {
    redirect(
      `${back}?error=${encodeURIComponent(
        'Support access only works for learner accounts - staff accounts are never impersonable.',
      )}`,
    );
  }
  if (!target.is_active) {
    redirect(
      `${back}?error=${encodeURIComponent(
        'That account is disabled. Enable it before entering.',
      )}`,
    );
  }

  await createSupportSession(target.id, admin.id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.supportEntered,
    entityType: 'user',
    entityId: target.id,
    summary: `Entered ${target.email}'s account (support access)`,
    meta: { learner: target.email },
  });

  redirect('/dashboard');
}

/** "Return to admin": ends support access and lands back on the learner's admin page. */
export async function exitSupportSessionAction(): Promise<void> {
  const ended = await endSupportSession();
  if (!ended) redirect('/admin/users');

  const admin = ended.adminId ? findUserById(ended.adminId) : undefined;
  logAudit({
    actor: admin ? { id: admin.id, email: admin.email, role: admin.role } : null,
    action: AUDIT_ACTIONS.supportExited,
    entityType: 'user',
    entityId: ended.learner.id,
    summary: `Returned to admin from ${ended.learner.email}'s account`,
    meta: { learner: ended.learner.email },
  });

  redirect(`/admin/users/${ended.learner.id}?returned=1`);
}
