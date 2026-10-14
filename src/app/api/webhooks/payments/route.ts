import { NextResponse, type NextRequest } from 'next/server';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { recordCouponUse } from '@/lib/coupons';
import { queryOne, run } from '@/lib/db';
import { notify } from '@/lib/notify';
import { sendMailToUser } from '@/lib/mailer';
import { receipt } from '@/lib/email-templates';
import { verifySignature, type MockPaymentEvent } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/**
 * Payment webhook. This is the only place an order becomes paid.
 *
 * Guards, in order:
 *   1. HMAC-SHA256 signature over the raw body (with a timestamp tolerance)
 *   2. idempotency: the event id is inserted into webhook_events first, and a
 *      duplicate delivery is acknowledged without side effects
 *   3. the order must still be pending
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-mockpay-signature');
  const check = verifySignature(rawBody, signatureHeader);

  if (!check.valid) {
    // Record the rejected attempt so the demo can show it, then refuse.
    try {
      run(
        `INSERT INTO webhook_events (id, type, signature_valid, payload, note)
         VALUES (?, ?, 0, ?, ?)`,
        `rejected_${Math.random().toString(36).slice(2, 12)}`,
        'unknown',
        rawBody.slice(0, 4000),
        `Signature rejected: ${check.reason ?? 'invalid signature'}`,
      );
    } catch {
      /* recording is best-effort */
    }
    return NextResponse.json(
      { received: false, error: check.reason ?? 'Invalid signature' },
      { status: 400 },
    );
  }

  let event: MockPaymentEvent;
  try {
    event = JSON.parse(rawBody) as MockPaymentEvent;
  } catch {
    return NextResponse.json({ received: false, error: 'Body is not valid JSON' }, { status: 400 });
  }

  if (!event?.id || !event.type) {
    return NextResponse.json({ received: false, error: 'Event is missing id or type' }, { status: 400 });
  }

  // ---- idempotency: claim the event id first
  const existing = queryOne<{ id: string; processed_at: string | null; note: string }>(
    'SELECT id, processed_at, note FROM webhook_events WHERE id = ?',
    event.id,
  );

  if (existing) {
    return NextResponse.json({
      received: true,
      duplicate: true,
      eventId: event.id,
      message: 'Event already processed - no side effects applied.',
    });
  }

  run(
    `INSERT INTO webhook_events (id, type, signature_valid, payload, note, processed_at)
     VALUES (?, ?, 1, ?, ?, datetime('now'))`,
    event.id,
    event.type,
    rawBody.slice(0, 8000),
    'Processed',
  );

  // ---- handle the event type
  if (event.type === 'payment.failed') {
    run(
      `UPDATE orders SET status = 'failed', updated_at = datetime('now')
        WHERE public_id = ? AND status = 'pending'`,
      event.data.orderPublicId,
    );
    run(
      "UPDATE webhook_events SET note = ? WHERE id = ?",
      `Payment failed: ${event.data.failureReason ?? 'declined'}`,
      event.id,
    );
    return NextResponse.json({ received: true, handled: 'payment.failed' });
  }

  if (event.type !== 'payment.succeeded') {
    run("UPDATE webhook_events SET note = 'Ignored: unhandled event type' WHERE id = ?", event.id);
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const order = queryOne<{
    id: number;
    public_id: string;
    user_id: number;
    course_id: number;
    status: string;
    subtotal_pence: number;
    discount_pence: number;
    total_pence: number;
    coupon_id: number | null;
    coupon_code: string | null;
    paid_at: string | null;
    course_title: string;
    course_slug: string;
    user_email: string;
    user_name: string;
  }>(
    `SELECT o.id, o.public_id, o.user_id, o.course_id, o.status, o.subtotal_pence, o.discount_pence,
            o.total_pence, o.coupon_id, o.coupon_code, o.paid_at,
            c.title AS course_title, c.slug AS course_slug,
            u.email AS user_email, u.name AS user_name
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       JOIN users u ON u.id = o.user_id
      WHERE o.public_id = ?`,
    event.data.orderPublicId,
  );

  if (!order) {
    run("UPDATE webhook_events SET note = 'Order not found' WHERE id = ?", event.id);
    return NextResponse.json({ received: false, error: 'Unknown order' }, { status: 404 });
  }

  if (order.status === 'paid' || order.status === 'refunded' || order.status === 'partially_refunded') {
    run("UPDATE webhook_events SET note = 'Order already paid - no change' WHERE id = ?", event.id);
    return NextResponse.json({ received: true, duplicate: true, orderStatus: order.status });
  }

  // ---- mark paid
  run(
    `UPDATE orders
        SET status = 'paid', paid_at = datetime('now'), payment_ref = ?, card_brand = ?, card_last4 = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    event.id,
    event.data.cardBrand ?? 'Visa',
    event.data.cardLast4 ?? '4242',
    order.id,
  );

  // ---- enrolment (single-course checkout: no cart to reason about)
  const existingEnrolment = queryOne<{ id: number; access_revoked: number }>(
    'SELECT id, access_revoked FROM enrolments WHERE user_id = ? AND course_id = ?',
    order.user_id,
    order.course_id,
  );
  if (existingEnrolment) {
    run(
      `UPDATE enrolments SET access_revoked = 0, revoked_reason = NULL, enrolled_at = datetime('now')
        WHERE id = ?`,
      existingEnrolment.id,
    );
  } else {
    run(
      "INSERT INTO enrolments (user_id, course_id, source) VALUES (?, ?, 'purchase')",
      order.user_id,
      order.course_id,
    );
  }

  recordCouponUse(order.coupon_id);

  // ---- receipts, notifications, audit
  sendMailToUser(
    order.user_id,
    receipt({
      name: order.user_name,
      orderPublicId: order.public_id,
      courseTitle: order.course_title,
      subtotalPence: order.subtotal_pence,
      discountPence: order.discount_pence,
      totalPence: order.total_pence,
      couponCode: order.coupon_code,
      cardBrand: event.data.cardBrand ?? 'Visa',
      cardLast4: event.data.cardLast4 ?? '4242',
      paidAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }),
  );

  notify({
    userId: order.user_id,
    type: 'order_paid',
    title: `Payment received: ${order.course_title}`,
    body: 'Your receipt is ready and the course is unlocked.',
    href: `/learn/orders/${order.id}`,
  });

  logAudit({
    actor: null,
    action: AUDIT_ACTIONS.orderPaid,
    entityType: 'order',
    entityId: order.id,
    summary: `Webhook ${event.id}: ${order.public_id} paid (£${(order.total_pence / 100).toFixed(2)}) - enrolment created for ${order.user_email}`,
    meta: { eventType: event.type, amount: order.total_pence, course: order.course_slug },
  });

  return NextResponse.json({
    received: true,
    orderStatus: 'paid',
    enrolment: 'created',
    eventId: event.id,
  });
}
