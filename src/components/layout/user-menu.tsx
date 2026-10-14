'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { logoutAction, logoutAllAction } from '@/lib/actions/auth-actions';
import { isStaffRole, type Role } from '@/lib/types';

export function UserMenu({
  name,
  email,
  role,
  avatarPath,
}: {
  name: string;
  email: string;
  role: Role;
  avatarPath: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const staff = isStaffRole(role);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/70 bg-white/60 p-1 pr-2.5 text-sm font-medium text-ink-800 backdrop-blur-md transition duration-200 hover:border-brand-200 hover:bg-white/90 active:scale-[0.98]"
      >
        <Avatar name={name} src={avatarPath} size="sm" />
        <span className="hidden max-w-28 truncate sm:block">{name.split(' ')[0]}</span>
        <ChevronDown
          className={`size-4 text-ink-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="glass-panel animate-drop fixed inset-x-3 top-[4.4rem] z-40 overflow-hidden rounded-2xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-64"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
            <p className="truncate text-xs text-ink-500">{email}</p>
            <p className="mt-1 text-[0.6875rem] font-medium tracking-wide text-brand-700 uppercase">
              {role}
            </p>
          </div>

          <div className="p-1.5">
            {staff ? (
              <MenuLink href="/admin" icon={<ShieldCheck className="size-4" />} onClick={() => setOpen(false)}>
                Admin console
              </MenuLink>
            ) : null}
            <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-4" />} onClick={() => setOpen(false)}>
              Dashboard
            </MenuLink>
            <MenuLink href="/learn/my-learning" icon={<BookOpen className="size-4" />} onClick={() => setOpen(false)}>
              My learning
            </MenuLink>
            <MenuLink href="/learn/orders" icon={<Receipt className="size-4" />} onClick={() => setOpen(false)}>
              Orders
            </MenuLink>
            <MenuLink href="/learn/profile" icon={<UserRound className="size-4" />} onClick={() => setOpen(false)}>
              Profile
            </MenuLink>
          </div>

          <div className="border-t border-line p-1.5">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-700 transition hover:bg-ink-100"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </form>
            <form action={logoutAllAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-500 transition hover:bg-ink-100"
              >
                <ShieldCheck className="size-4" aria-hidden />
                Sign out of all devices
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-100"
    >
      <span className="text-ink-500">{icon}</span>
      {children}
    </Link>
  );
}
