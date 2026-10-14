import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, CreditCard, GraduationCap, TrendingUp, UserPlus, UsersRound } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminKpis, revenueSeries } from '@/lib/queries/admin';
import { formatPence } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { MiniBarChart } from '@/components/admin/mini-bar-chart';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin dashboard' };

export default async function AdminDashboardPage() {
  const user = await requireStaff('/admin');
  const kpis = adminKpis();
  const series = revenueSeries(30);
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Net revenue"
          value={formatPence(kpis.netRevenuePence)}
          hint={`${kpis.paidOrders} paid order${kpis.paidOrders === 1 ? '' : 's'}, refunds deducted`}
          icon={<CreditCard className="size-4" aria-hidden />}
          href="/admin/orders"
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
          hint="Active, refunded access excluded"
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
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Revenue, last 30 days</h2>
            <p className="mt-1 text-sm text-ink-500">
              {bestDay && bestDay.revenuePence > 0
                ? `Best day: ${formatPence(bestDay.revenuePence)} on ${bestDay.day}`
                : 'No revenue recorded in this window'}
            </p>
          </div>
          <p className="text-sm text-ink-500">
            Valid certificates: <strong className="text-ink-800">{kpis.validCertificates}</strong>
          </p>
        </div>
        <div className="mt-5">
          <MiniBarChart
            points={series.map((point) => ({
              label: point.day,
              value: point.revenuePence,
              caption: formatPence(point.revenuePence),
            }))}
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickCard
          title="Course builder"
          body="Create courses, sections and lessons, upload video and captions, and build quizzes."
          href="/admin/courses"
          cta="Open the builder"
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <QuickCard
          title="Grading queue"
          body={`${kpis.pendingGrading} item(s) waiting for a human: essays and assignments.`}
          href="/admin/grading"
          cta="Start grading"
          icon={<ClipboardCheck className="size-5" aria-hidden />}
        />
      </div>
    </div>
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

function QuickCard({
  title,
  body,
  href,
  cta,
  icon,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col p-5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-ink-500">{body}</p>
      <div className="mt-4">
        <Link href={href} className="btn-secondary btn-sm">
          {cta}
        </Link>
      </div>
    </div>
  );
}
