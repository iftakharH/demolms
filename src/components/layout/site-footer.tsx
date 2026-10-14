import Link from 'next/link';
import { DEV_TOOLS, DEMO_ACCOUNTS } from '@/lib/env';

/** Public site footer, including the dev-tools strip in the demo build. */
export function SiteFooter() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-sm font-semibold text-ink-900">demolms</p>
          <p className="mt-2 max-w-sm text-sm text-ink-500">
            A local demo learning platform. Every payment, email and certificate in this app is
            simulated on this machine - nothing leaves localhost.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Learn</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/courses" className="text-ink-600 hover:text-brand-700">All courses</Link></li>
            <li><Link href="/courses?price=free" className="text-ink-600 hover:text-brand-700">Free courses</Link></li>
            <li><Link href="/categories" className="text-ink-600 hover:text-brand-700">Categories</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Account</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/login" className="text-ink-600 hover:text-brand-700">Log in</Link></li>
            <li><Link href="/register" className="text-ink-600 hover:text-brand-700">Create account</Link></li>
            <li><Link href="/dashboard" className="text-ink-600 hover:text-brand-700">Dashboard</Link></li>
          </ul>
        </div>
      </div>

      {DEV_TOOLS ? (
        <div className="border-t border-line bg-ink-50">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 text-xs text-ink-500 sm:px-6">
            <span className="font-semibold tracking-wide text-ink-700 uppercase">Dev tools</span>
            <Link href="/dev/outbox" className="link">
              Email outbox
            </Link>
            <span className="hidden sm:inline">·</span>
            <span>
              Demo accounts:{' '}
              {DEMO_ACCOUNTS.map((account, index) => (
                <span key={account.email}>
                  {index > 0 ? ' · ' : ''}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-[0.6875rem] text-ink-700">
                    {account.email}
                  </code>
                </span>
              ))}
              {' '}(password <code className="rounded bg-surface px-1.5 py-0.5 text-[0.6875rem] text-ink-700">Demo1234!</code>)
            </span>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
