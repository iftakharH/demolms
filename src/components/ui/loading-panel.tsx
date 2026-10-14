/** Shared skeleton used by the loading.tsx files. */
export function LoadingPanel({
  title = 'Loading',
  lines = 4,
  cards = 0,
}: {
  title?: string;
  lines?: number;
  cards?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" role="status" aria-label={title}>
      <div className="skeleton h-8 w-64" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="skeleton h-4" style={{ width: `${90 - index * 12}%` }} />
        ))}
      </div>

      {cards > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="card overflow-hidden">
              <div className="skeleton aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-4">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      )}

      <span className="sr-only">Loading content</span>
    </div>
  );
}
