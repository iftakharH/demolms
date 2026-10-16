import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/layout/brand';

/** Centred card used by every auth screen. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  devHint,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  devHint?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="mb-6 flex justify-center">
        <Brand />
      </div>

      <div className="card p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>

      {devHint ? (
        <div className="mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-4 text-sm text-brand-950">
          {devHint}
        </div>
      ) : null}

      {footer ? <div className="mt-5 text-center text-sm text-ink-500">{footer}</div> : null}

      <p className="mt-8 text-center text-xs text-ink-400">
        <Link href="/" className="hover:text-ink-600">
          &larr; Back to the classroom
        </Link>
      </p>
    </div>
  );
}

/** Inline form status message. */
export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`rounded-xl px-3.5 py-2.5 text-sm ${
        error
          ? 'border border-danger-line bg-danger-soft text-danger'
          : 'border border-success-line bg-success-soft text-success-strong'
      }`}
    >
      {error ?? message}
    </p>
  );
}
