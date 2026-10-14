'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, BookOpen, ClipboardCheck, LayoutDashboard, UserRound } from 'lucide-react';

const TABS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/learn/my-learning', label: 'Learning', icon: BookOpen, match: ['/learn/courses'] },
  { href: '/learn/grades', label: 'Grades', icon: ClipboardCheck },
  { href: '/learn/certificates', label: 'Awards', icon: Award },
  { href: '/learn/profile', label: 'Profile', icon: UserRound },
] as const;

/**
 * Mobile bottom tab bar for the learner area: a floating frosted dock with one
 * highlight that slides sideways to the active tab. Five destinations keep it in
 * thumb reach (notifications stay on the header bell, which is visible at every size).
 */
export function LearnerTabBar() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const activeIndex = Math.max(
    0,
    TABS.findIndex((tab) => {
      const prefixes = 'match' in tab && tab.match ? tab.match : [`${tab.href}/`];
      return pathname === tab.href || prefixes.some((prefix) => pathname.startsWith(prefix));
    }),
  );

  const reposition = useCallback(() => {
    const list = listRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!list || !tab) {
      setPill(null);
      return;
    }
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.width === 0) {
      setPill(null);
      return;
    }
    setPill({ left: tabBox.left - listBox.left, width: tabBox.width });
  }, [activeIndex]);

  useEffect(() => {
    reposition();

    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(reposition);
    observer.observe(list);
    window.addEventListener('resize', reposition);
    document.fonts?.ready.then(reposition).catch(() => undefined);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  return (
    <nav
      className="no-print fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 lg:hidden"
      aria-label="Learner sections"
    >
      <div className="glass-panel mx-auto max-w-lg rounded-2xl p-1">
        <div className="relative">
          <span
            className={`dock-pill ${pill ? 'opacity-100' : 'opacity-0'}`}
            style={pill ? { transform: `translateX(${pill.left}px)`, width: pill.width } : undefined}
            aria-hidden
          />
          <ul ref={listRef} className="relative flex items-stretch">
            {TABS.map((tab, index) => {
              const prefixes = 'match' in tab && tab.match ? tab.match : [`${tab.href}/`];
              const active = pathname === tab.href || prefixes.some((prefix) => pathname.startsWith(prefix));
              return (
                <li key={tab.href} className="flex-1" ref={(element) => { tabRefs.current[index] = element; }}>
                  <Link
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex flex-col items-center gap-1 rounded-[0.875rem] px-1 py-2 text-[0.6875rem] font-medium transition-colors ${
                      active ? 'text-brand-800' : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center transition-transform duration-300 ease-out ${
                        active ? 'scale-110 -translate-y-px' : 'group-hover:scale-105'
                      }`}
                    >
                      <tab.icon className={`size-5 ${active ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden />
                    </span>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
