/**
 * Admin navigation configuration.
 *
 * Deliberately NOT a client module: the admin layout (server component) filters
 * this list, and icons are referenced by key so nothing has to cross the
 * server/client boundary.
 */

export type AdminIconKey =
  | 'dashboard'
  | 'courses'
  | 'grading'
  | 'users'
  | 'orders'
  | 'coupons'
  | 'certificates'
  | 'audit';

export interface AdminNavEntry {
  href: string;
  label: string;
  icon: AdminIconKey;
  /** extra path prefixes that keep this item highlighted */
  match?: string[];
  /** hidden from auditors (admin-only sections) */
  adminOnly?: boolean;
}

export const ADMIN_NAV: AdminNavEntry[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/courses', label: 'Courses', icon: 'courses', match: ['/admin/courses'] },
  { href: '/admin/grading', label: 'Grading queue', icon: 'grading' },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/orders', label: 'Orders', icon: 'orders' },
  { href: '/admin/coupons', label: 'Coupons', icon: 'coupons' },
  { href: '/admin/certificates', label: 'Certificates', icon: 'certificates' },
  { href: '/admin/audit', label: 'Audit log', icon: 'audit' },
];

/** Sections that exist at this point in the build (grows as phases land). */
const IMPLEMENTED = new Set<string>([
  '/admin',
  '/admin/courses',
  '/admin/grading',
  '/admin/certificates',
  '/admin/users',
  '/admin/coupons',
  '/admin/audit',
]);

export function availableAdminNav(extra: string[] = []): AdminNavEntry[] {
  const allowed = new Set([...IMPLEMENTED, ...extra]);
  return ADMIN_NAV.filter((entry) => allowed.has(entry.href));
}
