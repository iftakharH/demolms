import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Award,
  BadgeCheck,
  BellOff,
  CheckCheck,
  Inbox,
  Info,
  Receipt,
  ShieldCheck,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/actions/notification-actions';
import { unreadCount } from '@/lib/notify';
import { query } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Notifications' };

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_STYLE: Record<string, { icon: typeof Info; tint: string; label: string }> = {
  welcome: { icon: Sparkles, tint: 'bg-brand-50 text-brand-700', label: 'Welcome' },
  certificate_issued: { icon: Award, tint: 'bg-success-soft text-success-strong', label: 'Certificate' },
  certificate_revoked: { icon: ShieldCheck, tint: 'bg-danger-soft text-danger', label: 'Certificate' },
  order_paid: { icon: Receipt, tint: 'bg-info-soft text-info', label: 'Payment' },
  refund_processed: { icon: Undo2, tint: 'bg-info-soft text-info', label: 'Refund' },
  assignment_graded: { icon: BadgeCheck, tint: 'bg-success-soft text-success-strong', label: 'Grading' },
  quiz_reviewed: { icon: BadgeCheck, tint: 'bg-success-soft text-success-strong', label: 'Grading' },
  quiz_submitted: { icon: Info, tint: 'bg-warning-soft text-warning', label: 'Quiz' },
  assignment_submitted: { icon: Info, tint: 'bg-warning-soft text-warning', label: 'Assignment' },
  enrolment_created: { icon: Sparkles, tint: 'bg-brand-50 text-brand-700', label: 'Enrolment' },
  course_completed: { icon: Award, tint: 'bg-success-soft text-success-strong', label: 'Completed' },
  security: { icon: ShieldCheck, tint: 'bg-warning-soft text-warning', label: 'Security' },
};

function dayLabel(iso: string): string {
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const sameDay = (a: Date, b: Date) =>
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(date);
}

export default async function NotificationsPage({ searchParams }: PageProps<'/notifications'>) {
  const user = await requireUser('/notifications');
  const params = await searchParams;
  const unreadOnly = params.filter === 'unread';

  const rows = query<NotificationRow>(
    `SELECT id, type, title, body, href, read_at AS readAt, created_at AS createdAt
       FROM notifications
      WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    user.id,
  );
  const unread = unreadCount(user.id);

  const groups = new Map<string, NotificationRow[]>();
  for (const row of rows) {
    const label = dayLabel(row.createdAt);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="mt-1 text-sm text-ink-500">
            {unread} unread · {rows.length} shown{unreadOnly ? ' (unread only)' : ''}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button type="submit" className="btn-secondary">
              <CheckCheck className="size-4" aria-hidden />
              Mark all as read
            </button>
          </form>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/notifications" className={`chip ${unreadOnly ? '' : 'chip-active'}`}>
          All
        </Link>
        <Link href="/notifications?filter=unread" className={`chip ${unreadOnly ? 'chip-active' : ''}`}>
          Unread{unread > 0 ? ` (${unread})` : ''}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={unreadOnly ? <BellOff className="size-8" aria-hidden /> : <Inbox className="size-8" aria-hidden />}
          title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
          description={
            unreadOnly ? 'You are all caught up.' : 'Enrolments, grading, receipts and certificates all show up here.'
          }
        >
          <Link href="/learn/my-learning" className="btn-secondary">
            Back to my learning
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</h2>
              <ul className="space-y-2">
                {items.map((notification) => {
                  const style = TYPE_STYLE[notification.type] ?? {
                    icon: Info,
                    tint: 'bg-ink-100 text-ink-600',
                    label: 'Update',
                  };
                  const Icon = style.icon;
                  return (
                    <li
                      key={notification.id}
                      className={`card flex min-w-0 flex-wrap items-start gap-3 p-4 ${
                        notification.readAt ? '' : 'border-brand-200 bg-brand-50/40'
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.tint}`}
                        aria-hidden
                      >
                        <Icon className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`truncate text-sm ${notification.readAt ? 'text-ink-700' : 'font-semibold text-ink-900'}`}>
                            {notification.title}
                          </p>
                          <Badge tone="outline">{style.label}</Badge>
                          {!notification.readAt ? (
                            <span className="size-2 rounded-full bg-brand-500" aria-label="unread" />
                          ) : null}
                        </div>
                        {notification.body ? (
                          <p className="mt-1 text-sm text-ink-600">{notification.body}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-400">{timeAgo(notification.createdAt)}</p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {notification.href ? (
                          <Link href={notification.href} className="btn-secondary btn-sm">
                            Open
                          </Link>
                        ) : null}
                        {!notification.readAt ? (
                          <form
                            action={async () => {
                              'use server';
                              await markNotificationReadAction(notification.id);
                            }}
                          >
                            <button type="submit" className="btn-ghost btn-sm">
                              Mark read
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500">
        Email notification preferences live on your{' '}
        <Link href="/learn/profile" className="link">
          profile page
        </Link>
        . Transactional emails (verification, password resets) are always sent; the toggles control
        receipts, grading, certificates and announcements.
      </p>
    </div>
  );
}
