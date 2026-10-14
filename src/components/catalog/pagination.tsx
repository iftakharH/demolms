import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Pagination that preserves the current query string. */
export function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') query.set(key, value);
    }
    if (target > 1) query.set('page', String(target));
    const search = query.toString();
    return search ? `/courses?${search}` : '/courses';
  };

  const pages: (number | 'gap')[] = [];
  for (let index = 1; index <= totalPages; index += 1) {
    if (index === 1 || index === totalPages || Math.abs(index - page) <= 1) {
      pages.push(index);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="Pagination">
      <Link
        href={href(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`btn-secondary btn-sm ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </Link>

      {pages.map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={`btn btn-sm min-w-9 ${
              entry === page ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-100'
            }`}
          >
            {entry}
          </Link>
        ),
      )}

      <Link
        href={href(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={`btn-secondary btn-sm ${page === totalPages ? 'pointer-events-none opacity-40' : ''}`}
      >
        Next
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}
