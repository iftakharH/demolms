import type { Metadata } from 'next';
import Link from 'next/link';
import { Search, UsersRound } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminUsers } from '@/lib/queries/admin-users';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPence, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Users · Admin' };

const ROLE_TABS = [
  { value: '', label: 'All roles' },
  { value: 'learner', label: 'Learners' },
  { value: 'admin', label: 'Admins' },
  { value: 'auditor', label: 'Auditors' },
];

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  await requireStaff('/admin/users');
  const params = await searchParams;
  const role = typeof params.role === 'string' ? params.role : '';
  const q = typeof params.q === 'string' ? params.q : '';

  const users = adminUsers({ role, q });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="mt-1 text-sm text-ink-500">
            {users.length} account{users.length === 1 ? '' : 's'}
            {role ? ` · ${role}` : ''}
            {q ? ` · matching "${q}"` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ROLE_TABS.map((tab) => {
            const query = new URLSearchParams();
            if (tab.value) query.set('role', tab.value);
            if (q) query.set('q', q);
            const href = query.toString() ? `/admin/users?${query}` : '/admin/users';
            return (
              <Link key={tab.label} href={href} className={`chip ${role === tab.value ? 'chip-active' : ''}`}>
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/admin/users" className="ml-auto flex gap-2">
          {role ? <input type="hidden" name="role" value={role} /> : null}
          <label className="sr-only" htmlFor="user-search">
            Search users
          </label>
          <input
            id="user-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name or email"
            className="input w-56"
          />
          <button type="submit" className="btn-secondary px-3" aria-label="Search">
            <Search className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-8" aria-hidden />}
          title="No users match"
          description="Try a different search or clear the role filter."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Learning</th>
                  <th className="text-right">Spent</th>
                  <th>Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-900">{user.name}</span>
                          <span className="block truncate text-xs text-ink-500">{user.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={user.role === 'learner' ? 'brand' : 'info'}>{user.role}</Badge>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {user.isActive ? <Badge tone="success">active</Badge> : <Badge tone="danger">disabled</Badge>}
                        {user.emailVerified ? null : <Badge tone="warning">unverified</Badge>}
                        {user.totpEnabled ? <Badge tone="outline">2FA</Badge> : null}
                      </div>
                    </td>
                    <td className="text-xs text-ink-500">
                      {user.enrolments} enrolled · {user.completed} completed
                      <span className="block">{user.orders} paid order(s)</span>
                    </td>
                    <td className="text-right whitespace-nowrap">{formatPence(user.spentPence)}</td>
                    <td className="text-xs whitespace-nowrap text-ink-500">
                      {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'never'}
                    </td>
                    <td className="text-right">
                      <Link href={`/admin/users/${user.id}`} className="link text-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
