import { LifeBuoy, Undo2 } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { exitSupportSessionAction } from '@/lib/actions/support-actions';

/**
 * Floating "support access" bar, shown on every page while an admin is inside a
 * learner's account. One click returns to the admin console (the admin's own
 * session is still signed in - no password needed).
 */
export async function SupportBanner() {
  const current = await getSession();
  if (!current?.support) return null;

  return (
    <div className="no-print fixed right-4 bottom-24 left-4 z-50 sm:left-auto sm:max-w-md lg:right-6 lg:bottom-6">
      <div className="popover flex items-center gap-3 rounded-2xl px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-strong">
          <LifeBuoy className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Support access</p>
          <p className="truncate text-xs text-ink-500">
            Viewing as {current.user.name} ({current.user.email})
            {current.support.adminEmail ? ` · entered by ${current.support.adminEmail}` : ''}
          </p>
        </div>
        <form action={exitSupportSessionAction}>
          <button type="submit" className="btn-primary btn-sm whitespace-nowrap">
            <Undo2 className="size-4" aria-hidden />
            Return to admin
          </button>
        </form>
      </div>
    </div>
  );
}
