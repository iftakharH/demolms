'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { run } from '@/lib/db';

/**
 * Notification state changes. Every action is scoped to the signed-in user, so
 * one learner can never mark another learner's notifications as read.
 */

export async function markNotificationReadAction(notificationId: number): Promise<void> {
  const user = await requireUser();
  run(
    "UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL",
    notificationId,
    user.id,
  );
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  run("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", user.id);
  revalidatePath('/notifications');
  revalidatePath('/dashboard');
}
