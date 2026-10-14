'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { query, run } from '@/lib/db';
import { sessionKey } from '@/lib/queries/sessions';

/**
 * End a single session (by its opaque key). The current session is intentionally
 * not revocable here - "sign out everywhere" covers that case.
 * Every export in this file must be async (server action rules).
 */
export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireUser('/learn/profile');
  const key = String(formData.get('session_key') ?? '');
  if (!key) return;

  const rows = query<{ token_hash: string }>('SELECT token_hash FROM sessions WHERE user_id = ?', user.id);
  const match = rows.find((row) => sessionKey(row.token_hash) === key);
  if (match) {
    run('DELETE FROM sessions WHERE token_hash = ?', match.token_hash);
  }
  revalidatePath('/learn/profile');
}
