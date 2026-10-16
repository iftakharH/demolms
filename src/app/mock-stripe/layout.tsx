import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

/**
 * Deliberately isolated layout: the mock payment provider is styled like a
 * separate hosted checkout (its own header, no app navigation), the way Stripe
 * Checkout looks when you redirect to it.
 */
export default function MockStripeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-ink-100">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-900">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-[0.625rem] font-bold text-primary-fg">
              mp
            </span>
            mockpay
          </span>
          <span className="flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="size-3.5" aria-hidden />
            Simulated checkout · localhost only
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-500 sm:px-6">
          <p>
            This is a local simulation of a hosted payment provider. No network calls, no real cards.
          </p>
          <Link href="/dev/outbox" className="hover:text-ink-800">
            Email outbox
          </Link>
        </div>
      </footer>
    </div>
  );
}
