import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  LogIn,
  Mail,
  Megaphone,
  PauseCircle,
  Plus,
  Receipt,
  ScrollText,
  TrendingUp,
  Undo2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import {
  adminKpis,
  newestLearners,
  recentAuditEntries,
  revenueSeries,
  topCoursesByEnrolment,
} from '@/lib/queries/admin';
import { adminOrders } from '@/lib/queries/admin-orders';
import { gradingQueue } from '@/lib/queries/assessment';
import { enterLearnerAccountAction } from '@/lib/actions/support-actions';
import { toggleAnnouncementAction } from '@/lib/actions/admin-settings-actions';
import { platformSettings } from '@/lib/settings';
import { formatPence, timeAgo } from '@/lib/format';
import { Avatar } from '@/components/ui/avatar';
import { Badge, CourseStatusBadge, OrderStatusBadge } from '@/components/ui/badge';
import { MiniBarChart } from '@/components/admin/mini-bar-chart';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminDashboardPage({ searchParams }: PageProps<'/admin'>) {
  const user = await requireStaff('/admin');
  const query = await searchParams;
  const kpis = adminKpis();
  const series = revenueSeries(30);
  const orders = adminOrders({ limit: 7 });
  const grading = gradingQueue();
  const learners = newestLearners(6);
  const courses = topCoursesByEnrolment(5);
  const audit = recentAuditEntries(6);
  const settings = platformSettings();

  const windowRevenue = series.reduce((sum, point) => sum + point.revenuePence, 0);
  const windowOrders = series.reduce((sum, point) => sum + point.orders, 0);
  const avgOrderPence = windowOrders > 0 ? Math.round(windowRevenue / windowOrders) : 0;
  const bestDay = series.reduce(
    (best, point) => (point.revenuePence > best.revenuePence ? point : best),
    series[0],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Admin dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">
            Signed in as {user.name} · {user.role}
          </p>
        </div>
        <Badge tone="brand">Last 30 days</Badge>
      </div>

      {query.staff === '1' ? (
        <p className="rounded-xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          Staff accounts have no learner area. To see the platform as a learner, open someone from{' '}
          <Link href="/admin/users" className="font-semibold underline">
            Users
          </Link>{' '}
          and choose <strong>Enter as learner</strong>.
        </p>
      ) : null}

      {/* ------------------------------------------------------------- KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        <KpiCard
          label="Net revenue"
          value={formatPence(kpis.netRevenuePence)}
          hint={`${kpis.paidOrders} paid order${kpis.paidOrders === 1 ? '' : 's'}, refunds deducted`}
          icon={<CreditCard className="size-4" aria-hidden />}
          href="/admin/orders"
        />
        <KpiCard
          label="Refunded"
          value={formatPence(kpis.refundedPence)}
          hint={`${kpis.refundedOrders} order${kpis.refundedOrders === 1 ? '' : 's'} with a refund`}
          icon={<Undo2 className="size-4" aria-hidden />}
          href="/admin/orders?status=refunded"
        />
        <KpiCard
          label="Paid orders"
          value={String(kpis.paidOrders)}
          hint="All time"
          icon={<Receipt className="size-4" aria-hidden />}
          href="/admin/orders?status=paid"
        />
        <KpiCard
          label="New users (30d)"
          value={String(kpis.newUsers30d)}
          hint={`${kpis.totalLearners} learners in total`}
          icon={<UserPlus className="size-4" aria-hidden />}
          href="/admin/users"
        />
        <KpiCard
          label="Enrolments"
          value={String(kpis.activeEnrolments)}
          hint={`${kpis.enrolments30d} joined in the last 30 days`}
          icon={<UsersRound className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Completion rate"
          value={`${kpis.completionRate}%`}
          hint="Across active enrolments"
          icon={<TrendingUp className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Needs attention"
          value={String(kpis.pendingGrading)}
          hint="Quizzes and submissions waiting"
          icon={<ClipboardCheck className="size-4" aria-hidden />}
          href="/admin/grading"
        />
        <KpiCard
          label="Certificates"
          value={String(kpis.validCertificates)}
          hint="Valid, not revoked"
          icon={<GraduationCap className="size-4" aria-hidden />}
          href="/admin/certificates"
        />
      </div>

      {/* ------------------------------------------------------------ chart */}
      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Revenue, last 30 days</h2>
            <p className="mt-1 text-sm text-ink-500">
              {bestDay && bestDay.revenuePence > 0
                ? `Best day: ${formatPence(bestDay.revenuePence)} on ${bestDay.day}`
                : 'No revenue recorded in this window'}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <WindowStat label="Revenue" value={formatPence(windowRevenue)} />
            <WindowStat label="Orders" value={String(windowOrders)} />
            <WindowStat label="Avg order" value={formatPence(avgOrderPence)} />
            <WindowStat label="Enrolments" value={String(kpis.enrolments30d)} />
          </dl>
        </div>
        <div className="mt-5">
          <MiniBarChart
            height={180}
            points={series.map((point) => ({
              label: point.day,
              value: point.revenuePence,
              caption: formatPence(point.revenuePence),
            }))}
          />
        </div>
      </section>

      {/* ------------------------------------------ orders + queue/actions */}
      <div className="grid gap-4 2xl:grid-cols-3">
        <section className="card overflow-hidden 2xl:col-span-2">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="section-title">Recent orders</h2>
            <Link href="/admin/orders" className="link inline-flex items-center gap-1 text-sm">
              All orders
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Course</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="whitespace-nowrap font-mono text-xs text-ink-600">{order.publicId}</td>
                      <td className="max-w-44">
                        <span className="block truncate text-sm font-medium text-ink-800">{order.userName}</span>
                        <span className="block truncate text-xs text-ink-500">{order.userEmail}</span>
                      </td>
                      <td className="max-w-56 truncate text-sm">{order.courseTitle}</td>
                      <td className="whitespace-nowrap text-right">
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

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="section-title flex items-center gap-2">
                <Megaphone className="size-4 text-brand-600" aria-hidden />
                Announcement
              </h2>
              <Badge tone={settings.announcementEnabled ? 'success' : 'neutral'}>
                {settings.announcementEnabled ? 'live' : 'off'}
              </Badge>
            </div>

            {settings.announcementEnabled && settings.announcementText ? (
              <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm text-brand-950">
                {settings.announcementText}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-500">
                No banner is showing on the site right now.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {user.role === 'admin' && settings.announcementText ? (
                <form action={toggleAnnouncementAction}>
                  <input type="hidden" name="back" value="/admin" />
                  <button type="submit" className="btn-secondary btn-sm">
                    {settings.announcementEnabled ? 'Turn off' : 'Turn on'}
                  </button>
                </form>
              ) : null}
              <Link href="/admin/settings" className="link text-sm">
                Edit in settings
              </Link>
            </div>

            {settings.enrolmentsPaused ? (
              <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-amber-800">
                <PauseCircle className="size-3.5 shrink-0" aria-hidden />
                New enrolments are paused.
                <Link href="/admin/settings" className="link">
                  Manage
                </Link>
              </p>
            ) : null}
          </section>

          <section className="card overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="section-title">Grading queue</h2>
              <Link href="/admin/grading" className="link inline-flex items-center gap-1 text-sm">
                {grading.length > 0 ? `${grading.length} waiting` : 'Open'}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </header>
            {grading.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-500">Nothing waiting for a human. All caught up.</p>
            ) : (
              <ul className="divide-y divide-line">
                {grading.slice(0, 5).map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-3">
                    <Badge tone={item.kind === 'quiz' ? 'brand' : 'info'}>
                      {item.kind === 'quiz' ? 'Quiz' : 'Assignment'}
                    </Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-800">{item.userName}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {item.lessonTitle} · {item.courseTitle}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(item.submittedAt)}</span>
                    <Link
                      href={`/admin/grading/${item.kind === 'quiz' ? 'quiz' : 'assignment'}/${item.id}`}
                      className="link shrink-0 text-sm"
                    >
                      Grade
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <ActionLink href="/admin/courses/new" icon={<Plus className="size-4" aria-hidden />}>
                New course
              </ActionLink>
              <ActionLink href="/admin/coupons" icon={<BadgePercent className="size-4" aria-hidden />}>
                New coupon
              </ActionLink>
              <ActionLink href="/admin/grading" icon={<ClipboardCheck className="size-4" aria-hidden />}>
                Review grading
              </ActionLink>
              <ActionLink href="/dev/outbox" icon={<Mail className="size-4" aria-hidden />}>
                Email outbox
              </ActionLink>
            </div>
          </section>
        </div>
      </div>

      {/* ---------------------------------------- people / catalogue / audit */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="section-title">Newest learners</h2>
            <Link href="/admin/users" className="link inline-flex items-center gap-1 text-sm">
              All users
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {learners.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">No learners yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {learners.map((learner) => (
                <li key={learner.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={learner.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-800">{learner.name}</span>
                    <span className="block truncate text-xs text-ink-500">{learner.email}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-500">
                    {learner.enrolments} enrolled
                    <span className="block text-ink-400">
                      {learner.lastLoginAt ? `seen ${timeAgo(learner.lastLoginAt)}` : 'never signed in'}
                    </span>
                  </span>
                  {user.role === 'admin' ? (
                    <form action={enterLearnerAccountAction} className="shrink-0">
                      <input type="hidden" name="user_id" value={learner.id} />
                      <button
                        type="submit"
                        className="btn-ghost btn-sm"
                        title={`Enter ${learner.name}'s account (support access)`}
                      >
                        <LogIn className="size-3.5" aria-hidden />
                        Enter
                      </button>
                    </form>
                  ) : null}
                  <Link href={`/admin/users/${learner.id}`} className="link shrink-0 text-sm">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="section-title">Top courses</h2>
            <Link href="/admin/courses" className="link inline-flex items-center gap-1 text-sm">
              All courses
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {courses.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">No courses yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {courses.map((course) => (
                <li key={course.id} className="flex items-center gap-3 px-5 py-3">
                  <BookOpen className="size-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-800">{course.title}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <CourseStatusBadge status={course.status} />
                      <span className="text-xs text-ink-500">
                        {course.enrolments} enrolled · {formatPence(course.revenuePence)} sold
                      </span>
                    </span>
                  </span>
                  <Link href={`/admin/courses/${course.slug}`} className="link shrink-0 text-sm">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="section-title flex items-center gap-2">
              <ScrollText className="size-4 text-brand-600" aria-hidden />
              Latest activity
            </h2>
            <Link href="/admin/audit" className="link inline-flex items-center gap-1 text-sm">
              Full log
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </header>
          {audit.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">No recorded activity.</p>
          ) : (
            <ul className="divide-y divide-line">
              {audit.map((entry) => (
                <li key={entry.id} className="px-5 py-3">
                  <p className="truncate text-sm text-ink-700">{entry.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {entry.actorEmail} · {timeAgo(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function WindowStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="text-base font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function ActionLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
    >
      <span className="text-brand-600">{icon}</span>
      {children}
    </Link>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2 text-ink-500">
        <span className="text-brand-600">{icon}</span>
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className="stat-value mt-2">{value}</p>
      <p className="mt-1 text-xs text-ink-500">{hint}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card card-hover p-4">
      {content}
    </Link>
  ) : (
    <div className="card p-4">{content}</div>
  );
}
