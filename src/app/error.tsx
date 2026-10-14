'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/** Next 16: the retry prop replaced reset for re-fetching in error boundaries. */
export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink-900">
        Something went wrong on this page
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        The error was caught by an error boundary, so the rest of the app still works. Try again, or
        head somewhere safe.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink-400">ref: {error.digest}</p>
      ) : null}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className="btn-primary">
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go home
        </Link>
      </div>
    </div>
  );
}
