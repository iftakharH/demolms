import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, LifeBuoy, LogIn, ScrollText } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminUserDetail, userEnrolments, userOrders, userRecentAudit } from '@/lib/queries/admin-users';
import { UserAdminControls } from '@/components/admin/user-admin-controls';
import { enterLearnerAccountAction } from '@/lib/actions/support-actions';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { formatDate, formatPence, timeAgo } from '@/lib/format';
import { OrderStatusBadge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'User · Admin' };

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: PageProps<'/admin/users/[id]'>) {
  const admin = await requireStaff('/admin/users');
  const { id } = await params;
  const query = await searchParams;
  const userId = Number.parseInt(id, 10);
  if (!Number.isFinite(userId)) notFound();

  const user = adminUserDetail(userId);
  if (!user) notFound();

  const enrolments = userEnrolments(userId);
  const orders = userOrders(userId);
  const audit = userRecentAudit(userId);
  const spent = orders.reduce((sum, order) => sum + (order.paidAt ? order.totalPence - order.refundedPence : 0), 0);

  let prefs: Record<string, boolean> = {};
  try {
    prefs = JSON.parse(user.emailPrefs) as Record<string, boolean>;
  } catch {
    /* ignore */
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>

      {query.returned === '1' ? (
        <p className="rounded-xl border border-emerald-200 bg-success-soft px-4 py-3 text-sm text-emerald-800">
          Support session ended - you are back in the admin console.
        </p>
      ) : null}
      {typeof query.error === 'string' ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-4 py-3 text-sm text-danger">
          {query.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={user.role === 'learner' ? 'brand' : 'info'}>{user.role}</Badge>
              {user.isActive ? <Badge tone="success">active</Badge> : <Badge tone="danger">disabled</Badge>}
              {user.emailVerified ? <Badge tone="outline">verified</Badge> : <Badge tone="warning">unverified</Badge>}
              {user.totpEnabled ? <Badge tone="outline">TOTP enabled</Badge> : null}
            </div>
            <h1 className="page-title mt-2">{user.name}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {user.email} · joined {formatDate(user.createdAt)} ·{' '}
              {user.lastLoginAt ? `last seen ${timeAgo(user.lastLoginAt)}` : 'never signed in'}
            </p>
          </div>
        </div>
        <p className="text-right">
          <span className="block text-2xl font-semibold text-ink-900">{formatPence(spent)}</span>
          <span className="text-xs text-ink-500">net spend after refunds</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="section-title">Enrolments</h2>
            {enrolments.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">Not enrolled in anything yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {enrolments.map((enrolment) => (
                  <li key={enrolment.courseId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/admin/courses/${enrolment.courseSlug}`}
                        className="text-sm font-medium text-ink-800 hover:text-brand-700"
                      >
                        {enrolment.courseTitle}
                      </Link>
                      <div className="flex items-center gap-2">
                        {enrolment.accessRevoked ? <Badge tone="danger">access revoked</Badge> : null}
                        {enrolment.completedAt ? <Badge tone="success">completed</Badge> : null}
                        <Badge tone="outline">{enrolment.source}</Badge>
                      </div>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={enrolment.percent} size="sm" label={enrolment.courseTitle} />
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {enrolment.percent}% · enrolled {timeAgo(enrolment.enrolledAt)}
                      {enrolment.completedAt ? ` · completed ${timeAgo(enrolment.completedAt)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title">Orders</h2>
            {orders.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">No orders.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Course</th>
                      <th className="text-right">Total</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="font-mono text-xs text-ink-600">{order.publicId}</td>
                        <td className="max-w-48 truncate text-sm">{order.courseTitle}</td>
                        <td className="text-right">
                          {formatPence(order.totalPence)}
                          {order.refundedPence > 0 ? (
                            <span className="block text-xs text-info">-{formatPence(order.refundedPence)}</span>
                          ) : null}
                        </td>
                        <td>
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="text-right">
                          <Link href={`/admin/orders/${order.id}`} className="link text-sm">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <ScrollText className="size-4 text-brand-600" aria-hidden />
              Recent activity
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3">
                  <span className="text-ink-700">{entry.summary}</span>
                  <span className="shrink-0 text-xs text-ink-400">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
              {audit.length === 0 ? <li className="text-ink-500">No recorded activity.</li> : null}
            </ul>
            <Link href={`/admin/audit?q=${encodeURIComponent(user.email)}`} className="link mt-3 inline-block text-sm">
              Filter the full audit log
            </Link>
          </section>
        </div>

        <aside className="space-y-4">
          {user.role === 'learner' && user.isActive && admin.role === 'admin' ? (
            <section className="card border-brand-200 p-5">
              <h2 className="section-title flex items-center gap-2">
                <LifeBuoy className="size-4 text-brand-600" aria-hidden />
                Support access
              </h2>
              <p className="mt-1.5 text-sm text-ink-500">
                Land directly in {user.name}&apos;s account to help them - no password needed. You
                stay signed in as admin, and the session is audited.
              </p>
              <form action={enterLearnerAccountAction} className="mt-4">
                <input type="hidden" name="user_id" value={user.id} />
                <button type="submit" className="btn-primary">
                  <LogIn className="size-4" aria-hidden />
                  Enter as learner
                </button>
              </form>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="section-title">Account controls</h2>
            <div className="mt-4">
              <UserAdminControls
                userId={user.id}
                role={user.role}
                isActive={user.isActive}
                canWrite={admin.role === 'admin'}
              />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="section-title">Email preferences</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {Object.entries(prefs).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-ink-600 capitalize">{key}</span>
                  <Badge tone={value ? 'success' : 'neutral'}>{value ? 'on' : 'off'}</Badge>
                </li>
              ))}
              {Object.keys(prefs).length === 0 ? <li className="text-ink-500">No preferences stored.</li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
