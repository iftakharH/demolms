import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { LearnerNav } from '@/components/learner/learner-nav';
import { LearnerTabBar } from '@/components/learner/learner-tab-bar';
import { requireUser } from '@/lib/auth';
import { unreadCount } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export default async function LearnerLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const unread = unreadCount(user.id);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">
        <div className="flex gap-8">
          <aside className="no-print hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24 space-y-1">
              <LearnerNav />
              <div className="pt-3">
                <Link
                  href="/notifications"
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="size-4 text-ink-400" aria-hidden />
                    Notifications
                  </span>
                  {unread > 0 ? (
                    <span className="badge bg-brand-100 text-brand-800">{unread > 9 ? '9+' : unread}</span>
                  ) : null}
                </Link>
              </div>
            </div>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <SiteFooter />
      <LearnerTabBar />
    </div>
  );
}
