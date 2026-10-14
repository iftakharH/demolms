'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface SiteNavItem {
  href: string;
  label: string;
  /** Extra path prefixes that should light this link up. */
  match?: string[];
}

function matches(pathname: string, item: SiteNavItem): boolean {
  const base = item.href.split('?')[0];
  if (pathname === base) return true;
  const prefixes = item.match ?? (base === '/' ? [] : [base]);
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Desktop navigation links with a highlight that follows the pointer: one pill is
 * measured against the link under the cursor (or the current route) and slides
 * between them, instead of every link flipping its own background.
 */
export function NavLinks({ items }: { items: SiteNavItem[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const activeIndex = items.findIndex((item) => matches(pathname, item));
  const target = hovered ?? (activeIndex >= 0 ? activeIndex : null);

  const reposition = useCallback(() => {
    const list = listRef.current;
    const link = target === null ? null : linkRefs.current[target];
    if (!list || !link) {
      setPill(null);
      return;
    }
    const listBox = list.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    if (linkBox.width === 0) {
      setPill(null);
      return;
    }
    setPill({ left: linkBox.left - listBox.left, width: linkBox.width });
  }, [target]);

  useEffect(() => {
    reposition();

    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(reposition);
    observer.observe(list);
    window.addEventListener('resize', reposition);
    // the self-hosted Inter font swaps in after first paint and changes the widths
    document.fonts?.ready.then(reposition).catch(() => undefined);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  return (
    <div className="relative hidden items-center md:flex" onMouseLeave={() => setHovered(null)}>
      <span
        className={`nav-pill ${pill ? 'opacity-100' : 'opacity-0'}`}
        style={pill ? { transform: `translateX(${pill.left}px)`, width: pill.width } : undefined}
        aria-hidden
      />
      <ul ref={listRef} className="relative flex items-center gap-1">
        {items.map((item, index) => (
          <li key={item.href}>
            <Link
              href={item.href}
              ref={(element) => {
                linkRefs.current[index] = element;
              }}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              aria-current={index === activeIndex ? 'page' : undefined}
              className={`block rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                index === activeIndex ? 'text-brand-800' : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
