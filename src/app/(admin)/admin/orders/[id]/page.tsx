import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, ShieldCheck, Webhook } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminOrderDetail, orderWebhookEvents } from '@/lib/queries/admin-orders';
import { RefundForm } from '@/components/admin/refund-form';
import { Badge, OrderStatusBadge } from '@/components/ui/badge';
import { formatDateTime, formatPence, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Order detail · Admin' };

export default async function AdminOrderDetailPage({ params }: PageProps<'/admin/orders/[id]'>) {
  const user = await requireStaff('/admin/orders');
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);
  if (!Number.isFinite(orderId)) notFound();

  const order = adminOrderDetail(orderId);
  if (!order) notFound();

  const events = orderWebhookEvents(order.publicId);
  const outstanding = order.totalPence - order.refundedPence;

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {order.enrolmentRevoked ? <Badge tone="danger">access revoked</Badge> : null}
            {order.couponCode ? <Badge tone="brand">coupon {order.couponCode}</Badge> : null}
          </div>
          <h1 className="page-title mt-2 font-mono text-2xl">{order.publicId}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {order.userName} · {order.userEmail} ·{' '}
            <Link href={`/courses/${order.courseSlug}`} className="link" target="_blank">
              {order.courseTitle}
              <ExternalLink className="ml-1 inline size-3" aria-hidden />
            </Link>
          </p>
        </div>
        <p className="text-right">
          <span className="block text-2xl font-semibold text-ink-900">{formatPence(order.totalPence)}</span>
          {order.refundedPence > 0 ? (
            <span className="block text-sm text-info">-{formatPence(order.refundedPence)} refunded</span>
          ) : null}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="section-title">Order lines</h2>
            <table className="table-base mt-3">
              <tbody>
                <tr>
                  <td>{order.courseTitle}</td>
                  <td className="text-right">{formatPence(order.subtotalPence)}</td>
                </tr>
                {order.discountPence > 0 ? (
                  <tr>
                    <td className="text-emerald-700">Discount {order.couponCode}</td>
                    <td className="text-right text-emerald-700">-{formatPence(order.discountPence)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="font-semibold">Total</td>
                  <td className="text-right font-semibold">{formatPence(order.totalPence)}</td>
                </tr>
                {order.refundedPence > 0 ? (
                  <tr>
                    <td className="text-info">Refunded</td>
                    <td className="text-right text-info">-{formatPence(order.refundedPence)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-500">Created</dt>
                <dd className="text-ink-800">{formatDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Paid</dt>
                <dd className="text-ink-800">{order.paidAt ? formatDateTime(order.paidAt) : 'not paid'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Card</dt>
                <dd className="text-ink-800">
                  {order.cardBrand ? `${order.cardBrand} ending ${order.cardLast4}` : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-ink-500">Payment ref</dt>
                <dd className="font-mono text-xs text-ink-700">{order.paymentRef ?? '-'}</dd>
              </div>
              {order.refundedAt ? (
                <>
                  <div>
                    <dt className="text-ink-500">Refunded</dt>
                    <dd className="text-ink-800">{formatDateTime(order.refundedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Refunded by</dt>
                    <dd className="text-ink-800">{order.refundedByEmail ?? '-'}</dd>
                  </div>
                </>
              ) : null}
            </dl>

            {order.refundReason ? (
              <p className="mt-4 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-ink-700">
                <span className="font-medium">Refund reason:</span> {order.refundReason}
              </p>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <Webhook className="size-4 text-brand-600" aria-hidden />
              Webhook events for this order
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Every delivery is stored with its verification result - including rejected signatures.
            </p>
            <ul className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">{event.id}</code>
                    <Badge tone={event.type === 'payment.succeeded' ? 'success' : 'neutral'}>
                      {event.type}
                    </Badge>
                    <Badge tone={event.signatureValid ? 'info' : 'danger'}>
                      <ShieldCheck className="size-3" aria-hidden />
                      {event.signatureValid ? 'signature valid' : 'signature rejected'}
                    </Badge>
                    <span className="text-xs text-ink-500">{timeAgo(event.receivedAt)}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-600">{event.note}</p>
                </li>
              ))}
              {events.length === 0 ? (
                <li className="text-sm text-ink-500">No webhook events recorded for this order yet.</li>
              ) : null}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="section-title">Refund</h2>
            <p className="mt-1 mb-4 text-sm text-ink-500">
              {outstanding > 0
                ? `${formatPence(outstanding)} still refundable.`
                : 'Nothing left to refund.'}
            </p>
            <RefundForm
              orderId={order.id}
              outstandingPence={outstanding}
              accessRevoked={Boolean(order.enrolmentRevoked)}
              canWrite={user.role === 'admin'}
            />
          </section>

          <section className="card p-5">
            <h2 className="section-title">Learner</h2>
            <p className="mt-2 text-sm text-ink-800">{order.userName}</p>
            <p className="text-xs text-ink-500">{order.userEmail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/admin/users?q=${encodeURIComponent(order.userEmail)}`} className="btn-secondary btn-sm">
                Open user
              </Link>
              <Link href={`/learn/orders/${order.id}`} className="btn-ghost btn-sm" target="_blank">
                Learner receipt
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
