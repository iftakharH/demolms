'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/lib/actions/notification-actions';
import { timeAgo } from '@/lib/format';

export interface BellNotification {
  id: number;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Header bell: unread count, recent notifications, mark read / mark all read.
 * Clicking an item marks it read and navigates.
 */
export function NotificationBell({
  unread,
  items,
}: {
  unread: number;
  items: BellNotification[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = (notification: BellNotification) => {
    setOpen(false);
    startTransition(async () => {
      if (!notification.readAt) await markNotificationReadAction(notification.id);
      if (notification.href) router.push(notification.href);
      else router.push('/notifications');
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-xl border border-white/70 bg-white/60 p-2 text-ink-600 backdrop-blur-md transition duration-200 hover:border-brand-200 hover:bg-white/90 hover:text-ink-900 active:scale-95"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      >
        <Bell className="size-4.5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.625rem] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="glass-panel animate-drop fixed inset-x-3 top-[4.4rem] z-40 overflow-hidden rounded-2xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => startTransition(() => markAllNotificationsReadAction())}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-500">
                <Inbox className="size-4" aria-hidden />
                Nothing yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-ink-50"
                    >
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          notification.readAt ? 'bg-ink-200' : 'bg-brand-500'
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            notification.readAt ? 'text-ink-600' : 'font-medium text-ink-900'
                          }`}
                        >
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{notification.body}</span>
                        <span className="mt-0.5 block text-[0.6875rem] text-ink-400">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-line px-4 py-2.5">
            <Link
              href="/notifications"
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
