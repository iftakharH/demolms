import Link from 'next/link';
import { Brand } from './brand';
import { AnnouncementBanner } from './announcement-banner';
import { NavShell } from './nav-shell';
import { SupportBanner } from './support-banner';
import { NavLinks, type SiteNavItem } from './nav-links';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationBellServer } from '@/components/notifications/notification-bell-server';
import { getCurrentUser } from '@/lib/auth';
import { isStaffRole } from '@/lib/types';

const NAV: SiteNavItem[] = [
  { href: '/courses', label: 'All courses' },
  { href: '/courses?price=free', label: 'Free' },
  { href: '/categories', label: 'Categories' },
];

/** Public site header. Server component: reads the session for the account menu. */
export async function SiteHeader({
  wide = false,
  showAnnouncement = true,
}: {
  wide?: boolean;
  showAnnouncement?: boolean;
} = {}) {
  const user = await getCurrentUser();
  const staff = Boolean(user && isStaffRole(user.role));

  return (
    <>
      <NavShell wide={wide}>
        <div className="flex items-center gap-8">
          <Brand />
          <NavLinks items={NAV} />
        </div>

        <div className="flex items-center gap-2">
          {/* the phone sheet carries a labelled theme row, so the compact control
              only appears once there is room for it */}
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          {user ? (
            <>
              {staff ? (
                <Link href="/admin" className="btn-ghost hidden sm:inline-flex">
                  Admin console
                </Link>
              ) : (
                <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                  Dashboard
                </Link>
              )}
              {staff ? null : <NotificationBellServer />}
              <UserMenu
                name={user.name}
                email={user.email}
                role={user.role}
                avatarPath={user.avatarPath}
              />
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/register" className="btn-primary">
                Create account
              </Link>
            </div>
          )}
          <MobileNav signedIn={Boolean(user)} staff={staff} />
        </div>
      </NavShell>
      {showAnnouncement ? <AnnouncementBanner /> : null}
      <SupportBanner />
    </>
  );
}
