import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Receipt, RotateCcw, ShoppingBag } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { EmptyState } from '@/components/ui/empty-state';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { fileUrl } from '@/lib/file-url';
import { CourseArt } from '@/components/course/course-art';
import { formatDate, formatPence, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Orders' };

interface OrderRow {
  id: number;
  public_id: string;
  status: string;
  course_title: string;
  course_slug: string;
  course_thumbnail: string | null;
  subtotal_pence: number;
  discount_pence: number;
  total_pence: number;
  refunded_pence: number;
  coupon_code: string | null;
  card_last4: string | null;
  card_brand: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  created_at: string;
}

export default async function OrdersPage() {
  const user = await requireUser('/learn/orders');

  const orders = query<OrderRow>(
    `SELECT o.id, o.public_id, o.status, o.subtotal_pence, o.discount_pence, o.total_pence,
            o.refunded_pence, o.coupon_code, o.card_last4, o.card_brand, o.paid_at, o.refunded_at,
            o.refund_reason, o.created_at,
            c.title AS course_title, c.slug AS course_slug, c.thumbnail_path AS course_thumbnail
       FROM orders o
       JOIN courses c ON c.id = o.course_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC`,
    user.id,
  );

  const totalSpent = orders
    .filter((order) => order.paid_at)
    .reduce((sum, order) => sum + order.total_pence - order.refunded_pence, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Orders and receipts</h1>
          <p className="mt-1 text-sm text-ink-500">
            {orders.length} order{orders.length === 1 ? '' : 's'} · {formatPence(totalSpent)} spent after refunds
          </p>
        </div>
        <Link href="/courses?price=paid" className="btn-secondary btn-sm">
          <ShoppingBag className="size-3.5" aria-hidden />
          Browse paid courses
        </Link>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-8" aria-hidden />}
          title="No orders yet"
          description="When you buy a paid course, the order and its printable receipt show up here."
        >
          <Link href="/courses?price=paid" className="btn-primary">
            Browse paid courses
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const refunded = order.refunded_pence > 0;
            return (
              <li key={order.id} className="card animate-rise min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-start gap-4 p-5">
                  <span className="h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                    {order.course_thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local static asset
                      <img src={fileUrl(order.course_thumbnail)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CourseArt title={order.course_title} slug={order.course_slug} className="h-full w-full" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={order.status} />
                      {order.coupon_code ? <Badge tone="brand">coupon {order.coupon_code}</Badge> : null}
                      {order.card_last4 ? (
                        <Badge tone="outline">
                          {order.card_brand ?? 'Card'} ·· {order.card_last4}
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="mt-2 truncate text-sm font-semibold text-ink-900">{order.course_title}</h2>
                    <p className="mt-0.5 font-mono text-xs text-ink-500">{order.public_id}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-semibold text-ink-900">{formatPence(order.total_pence)}</p>
                    {refunded ? (
                      <p className="text-xs text-info">-{formatPence(order.refunded_pence)} refunded</p>
                    ) : null}
                  </div>
                </div>

                {/* status timeline */}
                <ol className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line bg-ink-50 px-5 py-3 text-xs">
                  <TimelineStep done label="Order created" at={order.created_at} />
                  <TimelineStep done={Boolean(order.paid_at)} label="Paid" at={order.paid_at} />
                  <TimelineStep
                    done={refunded}
                    tone={refunded ? 'info' : 'muted'}
                    label={refunded ? 'Refunded' : 'Not refunded'}
                    at={refunded ? order.refunded_at : null}
                    icon={refunded ? RotateCcw : undefined}
                  />
                </ol>

                {order.refund_reason ? (
                  <p className="border-t border-line px-5 py-3 text-xs text-ink-600">
                    <span className="font-medium text-ink-700">Refund reason:</span> {order.refund_reason}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
                  {order.paid_at ? (
                    <Link href={`/learn/orders/${order.id}`} className="btn-secondary btn-sm">
                      <Receipt className="size-3.5" aria-hidden />
                      Receipt
                    </Link>
                  ) : null}
                  <Link href={`/courses/${order.course_slug}`} className="btn-ghost btn-sm">
                    Course page
                  </Link>
                  <span className="ml-auto text-xs text-ink-400">
                    {order.paid_at ? `Paid ${timeAgo(order.paid_at)}` : `Created ${timeAgo(order.created_at)}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TimelineStep({
  done,
  label,
  at,
  tone = 'brand',
  icon,
}: {
  done: boolean;
  label: string;
  at: string | null;
  tone?: 'brand' | 'info' | 'muted';
  icon?: typeof Check;
}) {
  const Icon = icon ?? Check;
  const tint =
    tone === 'info' ? 'text-info' : tone === 'muted' ? 'text-ink-400' : 'text-success';

  return (
    <li className="flex items-center gap-2">
      <span
        className={`flex size-5 items-center justify-center rounded-full ${
          done ? 'bg-surface shadow-sm' : 'bg-ink-200'
        }`}
        aria-hidden
      >
        {done ? <Icon className={`size-3 ${tint}`} /> : <span className="size-1.5 rounded-full bg-ink-400" />}
      </span>
      <span className={done ? 'font-medium text-ink-700' : 'text-ink-400'}>{label}</span>
      {at ? <span className="text-ink-400">· {formatDate(at)}</span> : null}
    </li>
  );
}
