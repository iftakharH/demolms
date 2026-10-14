/** Simple accessible progress bar. */
export function ProgressBar({
  value,
  max = 100,
  label,
  size = 'md',
}: {
  value: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label ?? 'Progress'}
    >
      <div className={`w-full overflow-hidden rounded-full bg-ink-200 ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 64,
  stroke = 6,
  children,
  label = 'Progress',
}: {
  percent: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-ink-200" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-brand-600 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink-800">
        {children ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
