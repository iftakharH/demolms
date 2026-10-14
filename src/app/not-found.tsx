import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="size-7" aria-hidden />
      </span>
      <p className="mt-6 text-sm font-semibold tracking-wide text-brand-700 uppercase">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
        We could not find that page
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        The link may be out of date, or the page may belong to an account you are not signed in to.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/courses" className="btn-primary">
          Browse courses
        </Link>
        <Link href="/dashboard" className="btn-secondary">
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
