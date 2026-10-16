import type { Metadata } from 'next';
import { BadgePercent } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { couponAnalytics, couponUsageLabel, listCoupons } from '@/lib/coupons';
import { categoryOptions } from '@/lib/queries/admin-courses';
import { query } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CouponForm } from '@/components/admin/coupon-form';
import { formatDate, formatPence, timeAgo } from '@/lib/format';
import { toggleCouponAction } from '@/lib/actions/admin-coupon-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Coupons · Admin' };

export default async function AdminCouponsPage() {
  const user = await requireStaff('/admin/coupons');
  const coupons = listCoupons();
  const usage = couponAnalytics();
  const courses = query<{ id: number; title: string; slug: string }>(
    'SELECT id, title, slug FROM courses ORDER BY title',
  );
  void categoryOptions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Coupons</h1>
        <p className="mt-1 text-sm text-ink-500">
          Percentage or fixed discounts, optionally limited to one course, with an expiry date and a
          usage limit. Checkout validates every rule before an order is created.
        </p>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Coupon usage</h2>
            <p className="mt-1 text-sm text-ink-500">
              Redemptions and money, computed from paid orders - a refunded order still counts as a
              redemption, and net revenue deducts it.
            </p>
          </div>
          {usage.rows[0] ? <Badge tone="brand">Most used: {usage.rows[0].code}</Badge> : null}
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <UsageStat label="Redemptions" value={String(usage.totalUses)} />
          <UsageStat label="Discount given" value={formatPence(usage.totalDiscountPence)} />
          <UsageStat label="Net revenue with coupons" value={formatPence(usage.netRevenuePence)} />
        </dl>

        {usage.rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">No coupon has been redeemed yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Code</th>
                  <th className="text-right">Redemptions</th>
                  <th className="text-right">Discount given</th>
                  <th className="text-right">Net revenue</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((row) => {
                  const share = usage.rows[0].uses > 0 ? row.uses / usage.rows[0].uses : 0;
                  return (
                    <tr key={row.code}>
                      <td>
                        <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                          {row.code}
                        </code>
                      </td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ink-100 sm:inline-block">
                            <span
                              className="block h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.max(6, share * 100)}%` }}
                            />
                          </span>
                          {row.uses}
                        </span>
                      </td>
                      <td className="text-right">{formatPence(row.discountPence)}</td>
                      <td className="text-right">{formatPence(row.netRevenuePence)}</td>
                      <td className="text-xs text-ink-500">
                        {row.lastUsedAt ? timeAgo(row.lastUsedAt) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-4">
          {coupons.length === 0 ? (
            <EmptyState
              icon={<BadgePercent className="size-8" aria-hidden />}
              title="No coupons yet"
              description="Create your first discount code on the right."
            />
          ) : (
            coupons.map((coupon) => {
              const expired =
                coupon.expires_at !== null &&
                new Date(coupon.expires_at.replace(' ', 'T') + 'Z') < new Date();
              return (
                <article key={coupon.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-sm font-semibold">
                          {coupon.code}
                        </code>
                        <Badge tone={coupon.is_active ? 'success' : 'neutral'}>
                          {coupon.is_active ? 'active' : 'disabled'}
                        </Badge>
                        {expired ? <Badge tone="danger">expired</Badge> : null}
                        <Badge tone="brand">
                          {coupon.kind === 'percent' ? `${coupon.value}% off` : `£${(coupon.value / 100).toFixed(2)} off`}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-ink-500">
                        {coupon.course_title ? `Only for ${coupon.course_title}` : 'Valid on every course'} ·{' '}
                        {couponUsageLabel(coupon)}
                        {coupon.expires_at ? ` · expires ${formatDate(coupon.expires_at)}` : ' · no expiry'}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        Created {timeAgo(coupon.created_at)}
                        {coupon.created_by_email ? ` by ${coupon.created_by_email}` : ''}
                      </p>
                    </div>

                    {user.role === 'admin' ? (
                      <form action={toggleCouponAction}>
                        <input type="hidden" name="coupon_id" value={coupon.id} />
                        <button type="submit" className="btn-secondary btn-sm">
                          {coupon.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside className="space-y-4">
          {user.role === 'admin' ? (
            <CouponForm courses={courses} />
          ) : (
            <p className="card p-5 text-sm text-ink-600">
              Auditor accounts are read-only, so creating coupons is disabled here and rejected by the
              server.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="stat-value mt-1">{value}</dd>
    </div>
  );
}
