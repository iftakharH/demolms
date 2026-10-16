/**
 * Generative course covers - the signature element from DESIGN.md.
 *
 * Every course draws its own cover from its own data: a signal of one bar per
 * "lesson", grouped along a hairline baseline, with the tallest bar carrying the
 * accent, and the category's initial ghosted behind it. It is deterministic (the
 * same course always produces the same art, everywhere in the product), drawn as
 * inline SVG so it answers to the theme, and needs no image files at all.
 *
 * Admin-uploaded thumbnails still win: call sites render an <img> when
 * `thumbnailPath` is set, and this only when it is not.
 */

const VIEW_W = 800;
const VIEW_H = 450;
const MARGIN_X = 64;
const BASELINE_Y = 356;
const BAR_W = 6;
const MAX_BAR_H = 92;
const MIN_BAR_H = 26;
const SPREAD = MAX_BAR_H - MIN_BAR_H;

/** FNV-1a: small, fast, and stable across runs - the art must never flicker. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Shape = { heights: number[]; gap: number; accent: number };

function shape(seed: string): Shape {
  const h = hash(seed);
  const count = 14 + (h % 10); // 14-23 bars: enough to read as a signal, few enough to stay airy
  const phaseA = (((h >>> 5) % 997) / 997) * Math.PI * 2;
  const phaseB = (((h >>> 15) % 991) / 991) * Math.PI * 2;

  const heights = Array.from({ length: count }, (_, i) => {
    const a = Math.abs(Math.sin(i * 0.62 + phaseA));
    const b = Math.abs(Math.sin(i * 1.71 + phaseB));
    return Math.round(MIN_BAR_H + a * SPREAD * 0.7 + b * SPREAD * 0.3);
  });

  const inner = VIEW_W - MARGIN_X * 2;
  const gap = (inner - BAR_W * count) / (count - 1);
  const tallest = heights.reduce((best, value, index) => (value > heights[best] ? index : best), 0);

  return { heights, gap, accent: tallest };
}

export function CourseArt({
  title,
  slug,
  className = '',
}: {
  title: string;
  slug: string;
  className?: string;
}) {
  const { heights, gap, accent } = shape(`${slug}|${title}`);
  const glyph = (title.trim()[0] ?? 'd').toUpperCase();

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width={VIEW_W} height={VIEW_H} className="fill-ink-50" />

      {/* the category's initial, ghosted into the panel */}
      <text
        x={VIEW_W - 34}
        y={VIEW_H - 26}
        textAnchor="end"
        className="fill-ink-200 dark:fill-ink-800"
        style={{ fontFamily: 'var(--font-ui)', fontSize: 252, fontWeight: 600, letterSpacing: '-0.05em' }}
      >
        {glyph}
      </text>

      {/* the signal: one bar per lesson */}
      {heights.map((height, index) => {
        const x = MARGIN_X + index * (BAR_W + gap);
        const isAccent = index === accent;
        return (
          <rect
            key={index}
            x={x}
            y={BASELINE_Y - height}
            width={BAR_W}
            height={height}
            rx={3}
            className={isAccent ? 'fill-brand-600 dark:fill-brand-500' : 'fill-ink-300 dark:fill-ink-500'}
          />
        );
      })}

      {/* baseline and origin mark */}
      <line
        x1={MARGIN_X}
        y1={BASELINE_Y + 10}
        x2={VIEW_W - MARGIN_X}
        y2={BASELINE_Y + 10}
        className="stroke-ink-200 dark:stroke-ink-600"
        strokeWidth={1}
      />
      <line
        x1={MARGIN_X}
        y1={BASELINE_Y + 10}
        x2={MARGIN_X + 30}
        y2={BASELINE_Y + 10}
        className="stroke-brand-600 dark:stroke-brand-500"
        strokeWidth={2}
      />
    </svg>
  );
}
