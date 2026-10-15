import Link from 'next/link';
import { Brand } from './brand';
import { GlassHeader } from './glass-header';
import { SupportBanner } from './support-banner';
import { NavLinks, type SiteNavItem } from './nav-links';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { NotificationBellServer } from '@/components/notifications/notification-bell-server';
import { getCurrentUser } from '@/lib/auth';

const NAV: SiteNavItem[] = [
  { href: '/courses', label: 'All courses' },
  { href: '/courses?price=free', label: 'Free' },
  { href: '/categories', label: 'Categories' },
];

/** Public site header. Server component: reads the session for the account menu. */
export async function SiteHeader({ wide = false }: { wide?: boolean } = {}) {
  const user = await getCurrentUser();

  return (
    <>
      <GlassHeader wide={wide}>
        <div className="flex items-center gap-8">
          <Brand />
          <NavLinks items={NAV} />
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                Dashboard
              </Link>
              <NotificationBellServer />
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
              <Link href="/register" className="btn-primary sheen">
                Create account
              </Link>
            </div>
          )}
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </GlassHeader>
      <SupportBanner />
    </>
  );
}
