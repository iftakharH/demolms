'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgePercent,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { AdminIconKey, AdminNavEntry } from './nav-config';

const ICONS: Record<AdminIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  courses: BookOpen,
  grading: ClipboardCheck,
  users: UsersRound,
  orders: Receipt,
  coupons: BadgePercent,
  certificates: GraduationCap,
  audit: ScrollText,
  settings: Settings,
};

/** Sidebar on desktop, scrollable row on mobile. Entries arrive from the server. */
export function AdminNav({ items }: { items: AdminNavEntry[] }) {
  const pathname = usePathname();

  return (
    <nav className="no-print" aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.match ?? [`${item.href}/`]).some((prefix) => pathname.startsWith(prefix));
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                <Icon className={`size-4 ${active ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
