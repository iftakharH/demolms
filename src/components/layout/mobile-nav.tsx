'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/courses', label: 'All courses' },
  { href: '/courses?price=free', label: 'Free courses' },
  { href: '/categories', label: 'Categories' },
];

/**
 * Mobile navigation panel for the public site: a frosted card that unfolds from
 * the bar, its links arriving in a short stagger. Closes on Escape, on a link,
 * on navigation, or on a tap anywhere else.
 */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  // Tying the open state to the route closes the panel on any navigation without
  // an effect: a different pathname simply means "not open any more".
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const open = openedPath === pathname;
  const close = () => setOpenedPath(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpenedPath(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenedPath(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenedPath(open ? null : pathname)}
        className="btn-ghost px-2"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        <span className="relative block size-5">
          <Menu
            className={`absolute inset-0 size-5 transition duration-300 ${
              open ? 'rotate-90 scale-75 opacity-0' : 'rotate-0 scale-100 opacity-100'
            }`}
            aria-hidden
          />
          <X
            className={`absolute inset-0 size-5 transition duration-300 ${
              open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-75 opacity-0'
            }`}
            aria-hidden
          />
        </span>
      </button>

      {open ? (
        <div className="glass-panel animate-drop absolute inset-x-3 top-[calc(100%+0.6rem)] z-40 overflow-hidden rounded-2xl p-2">
          <nav className="flex flex-col gap-0.5" aria-label="Site">
            {LINKS.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                style={{ animationDelay: `${40 + index * 45}ms` }}
                className="animate-pop rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-white/80 hover:text-brand-800"
              >
                {link.label}
              </Link>
            ))}

            {signedIn ? (
              <Link
                href="/dashboard"
                onClick={close}
                style={{ animationDelay: `${40 + LINKS.length * 45}ms` }}
                className="animate-pop mt-1 flex items-center justify-between gap-2 rounded-xl bg-brand-50/80 px-3 py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100"
              >
                Go to dashboard
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <div className="mt-1 flex flex-col gap-2 border-t border-line/70 p-1 pt-3">
                <Link
                  href="/login"
                  onClick={close}
                  style={{ animationDelay: `${40 + LINKS.length * 45}ms` }}
                  className="animate-pop btn-secondary w-full"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={close}
                  style={{ animationDelay: `${70 + LINKS.length * 45}ms` }}
                  className="animate-pop btn-primary sheen w-full"
                >
                  Create account
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
