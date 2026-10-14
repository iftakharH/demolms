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
      <SiteHeader />
      {user.role === 'auditor' ? (
        <div className="no-print border-b border-amber-200 bg-warning-soft">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 text-sm text-amber-900 sm:px-6">
            <Eye className="size-4 shrink-0" aria-hidden />
            <p>
              You are signed in as an <strong>auditor</strong>: the whole admin area is visible but
              every write action is disabled - enforced on the server, not just the interface.
            </p>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <AdminNav items={items} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <footer className="no-print border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 text-xs text-ink-500 sm:px-6">
          <span>demolms admin console - local demo</span>
          <Link href="/" className="hover:text-ink-800">
            Back to the shop front
          </Link>
        </div>
      </footer>
    </div>
  );
}
