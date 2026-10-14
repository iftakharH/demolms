'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Award, BookOpen, ClipboardCheck, LayoutDashboard, Receipt, UserRound, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[];
}

export const LEARNER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/learn/my-learning', label: 'My learning', icon: BookOpen, match: ['/learn/courses'] },
  { href: '/learn/grades', label: 'Grades', icon: ClipboardCheck },
  { href: '/learn/certificates', label: 'Certificates', icon: Award },
  { href: '/learn/orders', label: 'Orders', icon: Receipt },
  { href: '/learn/profile', label: 'Profile', icon: UserRound },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  const prefixes = item.match ?? [`${item.href}/`];
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * The learner sidebar links. Client-side only so the active state can follow the
 * route; the layout (server) renders the notification bell next to it.
 */
export function LearnerNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print" aria-label="Learner">
      <ul className="space-y-1">
        {LEARNER_NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                <item.icon className={`size-4 ${active ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
