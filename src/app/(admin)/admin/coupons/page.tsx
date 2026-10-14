import type { Metadata } from 'next';
import { BadgePercent } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { couponUsageLabel, listCoupons } from '@/lib/coupons';
import { categoryOptions } from '@/lib/queries/admin-courses';
import { query } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CouponForm } from '@/components/admin/coupon-form';
import { formatDate, timeAgo } from '@/lib/format';
import { toggleCouponAction } from '@/lib/actions/admin-coupon-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Coupons · Admin' };

export default async function AdminCouponsPage() {
  const user = await requireStaff('/admin/coupons');
  const coupons = listCoupons();
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
