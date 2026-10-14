import { NotificationBell } from './notification-bell';
import { getCurrentUser } from '@/lib/auth';
import { recentNotifications, unreadCount } from '@/lib/notify';

/**
 * Self-contained bell for places that are not the site header (the learner
 * sidebar, for example): loads its own data and renders nothing when signed out.
 */
export async function NotificationBellServer() {
  const user = await getCurrentUser();
  if (!user) return null;

  const notifications = recentNotifications(user.id, 8);
  return (
    <NotificationBell
      unread={unreadCount(user.id)}
      items={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        readAt: notification.read_at,
        createdAt: notification.created_at,
      }))}
    />
  );
}
