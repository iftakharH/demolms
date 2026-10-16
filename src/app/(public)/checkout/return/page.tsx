import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Receipt, XCircle } from 'lucide-react';
import { queryOne } from '@/lib/db';
import { formatPence, timeAgo } from '@/lib/format';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payment result',
  robots: { index: false },
};

export default async function CheckoutReturnPage({ searchParams }: PageProps<'/checkout/return'>) {
  const user = await requireUser('/learn/orders');
  const params = await searchParams;
  const publicId = typeof params.order === 'string' ? params.order : '';
  const status = params.status === 'declined' ? 'declined' : params.status === 'paid' ? 'paid' : 'unknown';

  const order = queryOne<{
    id: number;
    public_id: string;
    status: string;
    total_pence: number;
    discount_pence: number;
    coupon_code: string | null;
    card_brand: string | null;
    card_last4: string | null;
    paid_at: string | null;
    course_title: string;
    course_slug: string;
  }>(
    `SELECT o.id, o.public_id, o.status, o.total_pence, o.discount_pence, o.coupon_code,
            o.card_brand, o.card_last4, o.paid_at, c.title AS course_title, c.slug AS course_slug
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.public_id = ? AND o.user_id = ?`,
    publicId,
    user.id,
  );

  if (!order) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 text-center sm:px-6">
        <h1 className="page-title">Order not found</h1>
        <p className="mt-2 text-sm text-ink-500">
          We could not find that order on your account. Check your orders page.
        </p>
        <Link href="/learn/orders" className="btn-primary mt-6">
          View orders
        </Link>
      </div>
    );
  }

  const paid = order.status === 'paid' || order.status === 'refunded' || order.status === 'partially_refunded';

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-14 sm:px-6">
      <div className={`card p-6 ${paid ? 'border-success-line' : 'border-danger-line'}`}>
        <div className="flex items-start gap-3">
          {paid ? (
            <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-success" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-7 shrink-0 text-danger" aria-hidden />
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              {paid ? 'You are enrolled' : status === 'declined' ? 'Payment declined' : 'Payment incomplete'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-600">
              {paid ? (
                <>
                  Payment for <strong>{order.course_title}</strong> went through and your enrolment is
                  active.
                </>
              ) : (
                <>
                  The card was declined, so no money moved and nothing was enrolled. You can try again
                  with card 4242 4242 4242 4242.
                </>
              )}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">Order</dt>
            <dd className="font-mono text-xs text-ink-700">{order.public_id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Course</dt>
            <dd className="text-ink-800">{order.course_title}</dd>
          </div>
          {order.coupon_code ? (
            <div className="flex justify-between">
              <dt className="text-ink-500">Coupon</dt>
              <dd className="text-ink-800">
                {order.coupon_code} (-{formatPence(order.discount_pence)})
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatPence(order.total_pence)}</dd>
          </div>
          {order.card_last4 ? (
            <div className="flex justify-between">
              <dt className="text-ink-500">Card</dt>
              <dd className="text-ink-800">
                {order.card_brand ?? 'Card'} ending {order.card_last4}
              </dd>
            </div>
          ) : null}
          {order.paid_at ? (
            <div className="flex justify-between">
              <dt className="text-ink-500">Paid</dt>
              <dd className="text-ink-800">{timeAgo(order.paid_at)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {paid ? (
            <>
              <Link href={`/learn/courses/${order.course_slug}`} className="btn-primary">
                Start learning
              </Link>
              <Link href={`/learn/orders/${order.id}`} className="btn-secondary">
                <Receipt className="size-4" aria-hidden />
                View receipt
              </Link>
            </>
          ) : (
            <>
              <Link href={`/checkout/${order.course_slug}`} className="btn-primary">
                Try again
              </Link>
              <Link href={`/courses/${order.course_slug}`} className="btn-secondary">
                Back to the course
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-ink-500">
        The receipt email is in the{' '}
        <Link href="/dev/outbox" className="link">
          email outbox
        </Link>
        .
      </p>
    </div>
  );
}
