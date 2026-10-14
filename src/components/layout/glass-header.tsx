'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** How far the page scrolls before the bar has condensed all the way. */
const CONDENSE_DISTANCE = 140;

/**
 * The frosted chrome every page's navigation sits in.
 *
 * As the page scrolls the bar floats clear of the top edge, gains its glass ring and
 * shadow, and - on desktop - narrows to the width of its own content instead of
 * shrinking vertically. The scroll position is written straight to CSS variables
 * (`--condense`, `--progress`), and the content width into `--nav-fit`, so scrolling
 * never re-renders React. The header reserves 4.5rem of space either way, so the bar
 * can float without covering the page below it.
 */
export function GlassHeader({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    // Writing a variable only when it changes matters: a redundant write invalidates
    // every property that depends on it, which restarts their transitions. With the
    // observer below firing while the bar animates, that loop would freeze the bar
    // at its starting size.
    const setVar = (name: string, value: string) => {
      if (bar.style.getPropertyValue(name) !== value) bar.style.setProperty(name, value);
    };

    const measureScroll = () => {
      const y = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const condense = Math.min(1, Math.max(0, y / CONDENSE_DISTANCE));
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;
      setVar('--condense', condense.toFixed(3));
      setVar('--progress', progress.toFixed(3));
    };

    /** Width of the bar's own content: groups + gap + padding + the 1px borders. */
    const measureFit = () => {
      const row = bar.querySelector<HTMLElement>('[data-nav-row]');
      const container = bar.parentElement;
      if (!row || !container || row.children.length < 2) return;
      const styles = getComputedStyle(row);
      const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const gap = (parseFloat(styles.columnGap) || 0) * (row.children.length - 1);
      const content = Array.from(row.children).reduce(
        (total, child) => total + child.getBoundingClientRect().width,
        0,
      );
      const fit = Math.round(content + gap + padding + 2);
      setVar('--nav-fit', `${Math.min(fit, container.clientWidth)}px`);
    };

    const refresh = () => {
      measureScroll();
      measureFit();
    };

    // Written synchronously rather than inside requestAnimationFrame: background tabs
    // suspend rAF, which would leave the bar stale after a programmatic scroll. Scroll
    // events are already coalesced to one per frame, and setVar keeps it cheap.
    const onScroll = () => measureScroll();
    const onResize = () => refresh();
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };

    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    const row = bar.querySelector('[data-nav-row]');
    const observer = new ResizeObserver(onResize);
    if (row) {
      observer.observe(row);
      for (const child of Array.from(row.children)) observer.observe(child);
    }
    // the self-hosted Inter font swaps in after first paint and changes the widths
    document.fonts?.ready.then(onResize).catch(() => undefined);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, []);

  return (
    <header className="no-print sticky top-0 z-30">
      {/* Reserved height: the bar floats inside this box, so the page never jumps. */}
      <div className="relative h-[4.5rem]">
        <div className="glass-nav" ref={barRef}>
          {/* The frost lives in its own layer: a filtered parent would stop the
              menus that drop out of the bar from blurring the page behind them. */}
          <span
            className="absolute inset-0 rounded-[inherit] backdrop-blur-xl backdrop-saturate-150"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
            <span className="nav-aurora -top-24 -left-16 size-56 bg-brand-400/50" />
            <span className="nav-aurora -top-28 right-2 size-52 bg-info/30 [animation-delay:-7s]" />
          </div>

          <div
            data-nav-row
            className={`relative mx-auto flex h-full w-full items-center justify-between gap-4 px-4 sm:px-6 ${
              wide ? 'lg:px-8 2xl:px-10' : 'max-w-6xl'
            }`}
          >
            {children}
          </div>

          <span className="nav-meter" aria-hidden />
        </div>
      </div>
    </header>
  );
}
