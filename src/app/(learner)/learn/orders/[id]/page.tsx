import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { formatDate, formatPence, formatDateTime } from '@/lib/format';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { PrintButton } from '@/components/ui/print-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Receipt',
  robots: { index: false },
};

export default async function ReceiptPage({ params }: PageProps<'/learn/orders/[id]'>) {
  const user = await requireUser('/learn/orders');
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) notFound();

  const order = queryOne<{
    id: number;
    public_id: string;
    status: string;
    currency: string;
    subtotal_pence: number;
    discount_pence: number;
    total_pence: number;
    refunded_pence: number;
    coupon_code: string | null;
    payment_ref: string | null;
    card_brand: string | null;
    card_last4: string | null;
    paid_at: string | null;
    refund_reason: string | null;
    refunded_at: string | null;
    created_at: string;
    course_title: string;
    course_slug: string;
    instructor_name: string;
  }>(
    `SELECT o.*, c.title AS course_title, c.slug AS course_slug, c.instructor_name
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.id = ? AND o.user_id = ?`,
    orderId,
    user.id,
  );

  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/learn/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          Back to orders
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <article className="card print-page p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink-900">
              demo<span className="text-brand-700">lms</span>
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Local demo learning platform · London, United Kingdom
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-lg font-semibold text-ink-900">Receipt</h1>
            <p className="mt-1 font-mono text-xs text-ink-600">{order.public_id}</p>
            <div className="mt-2">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Billed to</p>
            <p className="mt-2 text-sm font-medium text-ink-900">{user.name}</p>
            <p className="text-sm text-ink-600">{user.email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Payment date</p>
            <p className="mt-2 text-sm text-ink-800">{formatDate(order.paid_at ?? order.created_at)}</p>
            <p className="text-xs text-ink-500">{formatDateTime(order.paid_at ?? order.created_at)}</p>
          </div>
        </section>

        <section>
          <table className="table-base">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="font-medium text-ink-900">{order.course_title}</span>
                  <span className="block text-xs text-ink-500">
                    Online course · instructor {order.instructor_name}
                  </span>
                </td>
                <td className="text-right">{formatPence(order.subtotal_pence)}</td>
              </tr>
              {order.discount_pence > 0 ? (
                <tr>
                  <td className="text-emerald-700">
                    Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}
                  </td>
                  <td className="text-right text-emerald-700">-{formatPence(order.discount_pence)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="font-semibold">Total charged</td>
                <td className="text-right font-semibold">{formatPence(order.total_pence)}</td>
              </tr>
              {order.refunded_pence > 0 ? (
                <tr>
                  <td className="text-info">Refunded {order.refunded_at ? `on ${formatDate(order.refunded_at)}` : ''}</td>
                  <td className="text-right text-info">-{formatPence(order.refunded_pence)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Payment method</p>
            <p className="mt-2 text-sm text-ink-800">
              {order.card_brand ?? 'Card'} ending {order.card_last4 ?? '----'}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Simulated by mockpay. Reference <span className="font-mono">{order.payment_ref ?? '-'}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Currency</p>
            <p className="mt-2 text-sm text-ink-800">{order.currency} (GBP)</p>
            {order.status === 'paid' ? <Badge tone="success" className="mt-2">Paid in full</Badge> : null}
          </div>
        </section>

        {order.refund_reason ? (
          <section className="mt-6 rounded-xl border border-info/30 bg-info-soft p-4">
            <p className="text-xs font-semibold tracking-wide text-info uppercase">Refund</p>
            <p className="mt-1.5 text-sm text-ink-700">{order.refund_reason}</p>
            <p className="mt-1 text-xs text-ink-500">
              Refunded {formatPence(order.refunded_pence)} ·{' '}
              {order.refunded_at ? formatDate(order.refunded_at) : ''}
            </p>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-line pt-4 text-xs text-ink-500">
          <p>
            This is a demo receipt produced by a local mock payment provider. No money moved and no
            card network was contacted.
          </p>
          <p className="mt-1">
            Questions? Reply to the receipt email in the local outbox or contact the course
            instructor.
          </p>
        </footer>
      </article>

      <p className="no-print mt-4 text-center text-xs text-ink-500">
        Looking for the emailed copy?{' '}
        <Link href="/dev/outbox" className="link">
          Open the outbox
        </Link>
        .
      </p>
    </div>
  );
}
