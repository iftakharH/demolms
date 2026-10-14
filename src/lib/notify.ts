import { query, queryOne, run } from './db';

export interface NotifyInput {
  userId: number;
  type: string;
  title: string;
  body?: string;
  href?: string | null;
}

/** In-app notification. Fire-and-forget: never breaks the caller. */
export function notify({ userId, type, title, body = '', href = null }: NotifyInput): void {
  try {
    run(
      'INSERT INTO notifications (user_id, type, title, body, href) VALUES (?, ?, ?, ?, ?)',
      userId,
      type,
      title,
      body,
      href,
    );
  } catch (error) {
    console.error('[notify] failed', type, error);
  }
}

export interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export function unreadCount(userId: number): number {
  const row = queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL',
    userId,
  );
  return row?.n ?? 0;
}

export function recentNotifications(userId: number, limit = 8): NotificationRow[] {
  return query<NotificationRow>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    userId,
    limit,
  );
}

/** Admin-facing fan-out helper (course announcements). */
export function notifyAllLearners(input: Omit<NotifyInput, 'userId'>): number {
  const learners = query<{ id: number }>("SELECT id FROM users WHERE role = 'learner'");
  for (const learner of learners) notify({ ...input, userId: learner.id });
  return learners.length;
}
