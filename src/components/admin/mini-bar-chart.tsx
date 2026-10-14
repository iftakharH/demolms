import { formatDay } from '@/lib/format';

interface Point {
  label: string;
  value: number;
  caption: string;
}

/**
 * Hand-rolled SVG bar chart - no charting dependency.
 * Bars are rendered as a 30-slot grid with a shared baseline.
 */
export function MiniBarChart({ points, height = 160 }: { points: Point[]; height?: number }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const hasData = points.some((point) => point.value > 0);

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {points.map((point) => {
          const ratio = point.value / max;
          return (
            <div
              key={point.label}
              className="group relative flex h-full flex-1 items-end"
              title={`${formatDay(point.label)} · ${point.caption}`}
            >
              <div
                className={`w-full rounded-t-[3px] transition-colors ${
                  point.value > 0 ? 'bg-brand-500 group-hover:bg-brand-700' : 'bg-ink-200'
                }`}
                style={{ height: `${Math.max(point.value > 0 ? 6 : 2, ratio * 100)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[0.6875rem] text-ink-400">
        <span>{points.length > 0 ? formatDay(points[0].label) : ''}</span>
        <span>{hasData ? `peak ${formatPenceLabel(max)}` : 'no revenue in this window'}</span>
        <span>{points.length > 0 ? formatDay(points[points.length - 1].label) : ''}</span>
      </div>
    </div>
  );
}

function formatPenceLabel(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}
