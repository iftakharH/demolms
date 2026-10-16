import type { ReactNode } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { SiteHeader } from '@/components/layout/site-header';
import { requireStaff } from '@/lib/auth';
import { AdminNav } from '@/components/admin/admin-nav';
import { availableAdminNav } from '@/components/admin/nav-config';

export const dynamic = 'force-dynamic';

/** Admin shell. Both admin and auditor reach it; writes are guarded separately. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const items = availableAdminNav();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader wide showAnnouncement={false} />
      {user.role === 'auditor' ? (
        <div className="no-print border-b border-warning-line bg-warning-soft">
          <div className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-warning-strong sm:px-6 lg:px-8 2xl:px-10">
            <Eye className="size-4 shrink-0" aria-hidden />
            <p>
              You are signed in as an <strong>auditor</strong>: the whole admin area is visible but
              every write action is disabled - enforced on the server, not just the interface.
            </p>
          </div>
        </div>
      ) : null}
      {/*
        Admin console is desktop-first: content spans the full viewport width here,
        unlike the learner shell which stays capped for reading comfort.
      */}
      <div className="flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row lg:gap-8 lg:px-8 2xl:px-10">
        <aside className="lg:w-56 lg:shrink-0 xl:w-60">
          <AdminNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="no-print border-t border-line bg-surface">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 text-xs text-ink-500 sm:px-6 lg:px-8 2xl:px-10">
          <span>demolms admin console - local demo</span>
          <Link href="/" className="hover:text-ink-800">
            Back to the shop front
          </Link>
        </div>
      </footer>
    </div>
  );
}
