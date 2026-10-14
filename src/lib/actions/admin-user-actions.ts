'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminWriter } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { queryOne, run } from '@/lib/db';
import { destroyAllSessionsForUser } from '@/lib/auth';
import type { FormState } from '@/lib/action-state';

/** Admin user management actions. All writer-guarded and audited. */

interface TargetUser {
  id: number;
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'auditor';
  is_active: number;
}

function targetUser(userId: number): TargetUser | undefined {
  return queryOne<TargetUser>('SELECT id, email, name, role, is_active FROM users WHERE id = ?', userId);
}

export async function changeUserRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const userId = Number.parseInt(String(formData.get('user_id') ?? ''), 10);
  const role = z.enum(['learner', 'admin', 'auditor']).safeParse(formData.get('role'));

  if (!role.success) return { error: 'Choose a role.' };

  const target = targetUser(userId);
  if (!target) return { error: 'User not found.' };
  if (target.id === admin.id) return { error: 'You cannot change your own role.' };
  if (target.role === role.data) return { error: `That account is already ${role.data}.` };

  // never let the last admin be demoted - that would lock the demo out
  if (target.role === 'admin') {
    const admins =
      queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1")?.n ?? 0;
    if (admins <= 1) return { error: 'This is the only active admin. Promote another admin first.' };
  }

  run("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", role.data, target.id);
  // sessions carry the old role until the next request; end them so the change bites
  destroyAllSessionsForUser(target.id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.userRoleChanged,
    entityType: 'user',
    entityId: target.id,
    summary: `Changed role for ${target.email} from ${target.role} to ${role.data}`,
    meta: { from: target.role, to: role.data },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${target.id}`);
  return { ok: true, message: `${target.email} is now ${role.data}. Their sessions were ended.` };
}

export async function setUserActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const userId = Number.parseInt(String(formData.get('user_id') ?? ''), 10);
  const active = String(formData.get('active') ?? '1') === '1';
  const reason = String(formData.get('reason') ?? '').trim();

  const target = targetUser(userId);
  if (!target) return { error: 'User not found.' };
  if (target.id === admin.id) return { error: 'You cannot disable your own account.' };
  if (target.role === 'admin' && !active) {
    const admins =
      queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1")?.n ?? 0;
    if (admins <= 1) return { error: 'This is the only active admin. Promote another admin first.' };
  }

  run("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?", active ? 1 : 0, target.id);
  if (!active) destroyAllSessionsForUser(target.id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: active ? AUDIT_ACTIONS.userEnabled : AUDIT_ACTIONS.userDisabled,
    entityType: 'user',
    entityId: target.id,
    summary: `${active ? 'Enabled' : 'Disabled'} account ${target.email}${reason ? ` - ${reason}` : ''}`,
    meta: { reason },
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${target.id}`);
  return {
    ok: true,
    message: active ? `${target.email} can sign in again.` : `${target.email} has been disabled and signed out.`,
  };
}
