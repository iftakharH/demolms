'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { evaluateCoupon } from '@/lib/coupons';
import { queryOne, run } from '@/lib/db';
import { newOrderPublicId } from '@/lib/ids';
import { buildEvent, chargeCard, deliverEvent } from '@/lib/payments';
import { notify } from '@/lib/notify';
import { sendMailToUser } from '@/lib/mailer';
import { refundProcessed } from '@/lib/email-templates';
import { requireAdminWriter } from '@/lib/auth';
import { isStaffRole } from '@/lib/types';
import type { FormState } from '@/lib/action-state';

interface CourseRow {
  id: number;
  slug: string;
  title: string;
  price_pence: number;
  status: string;
}

function publishedCourse(slug: string): CourseRow | undefined {
  return queryOne<CourseRow>(
    "SELECT id, slug, title, price_pence, status FROM courses WHERE slug = ? AND status = 'published'",
    slug,
  );
}

function enrolmentFor(userId: number, courseId: number) {
  return queryOne<{ id: number; access_revoked: number }>(
    'SELECT id, access_revoked FROM enrolments WHERE user_id = ? AND course_id = ?',
    userId,
    courseId,
  );
}

/**
 * Step 1 of checkout: create (or reuse) a pending order with the coupon applied,
 * then send the learner to the mock provider's hosted page.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const couponInput = String(formData.get('coupon') ?? '').trim();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  }

  // Staff accounts never buy courses - support access is how they act for a learner.
  if (isStaffRole(user.role)) {
    redirect(`/courses/${slug}?staff=1`);
  }

  const course = publishedCourse(slug);
  if (!course) redirect('/courses');
  if (course.price_pence === 0) {
    redirect(`/courses/${slug}`);
  }

  const existing = enrolmentFor(user.id, course.id);
  if (existing && existing.access_revoked === 0) {
    redirect(`/learn/my-learning?already=1`);
  }

  let discountPence = 0;
  let couponId: number | null = null;
  let couponCode: string | null = null;

  if (couponInput) {
    const check = evaluateCoupon(couponInput, course.id, course.price_pence);
    if (!check.ok) {
      redirect(
        `/checkout/${slug}?coupon=${encodeURIComponent(couponInput)}&error=${encodeURIComponent(check.message)}`,
      );
    }
    discountPence = check.discountPence;
    couponId = check.coupon?.id ?? null;
    couponCode = check.coupon?.code ?? couponInput.toUpperCase();
  }

  const total = Math.max(0, course.price_pence - discountPence);
  const publicId = newOrderPublicId();

  const info = run(
    `INSERT INTO orders (public_id, user_id, course_id, status, subtotal_pence, discount_pence,
                         total_pence, coupon_id, coupon_code)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    publicId,
    user.id,
    course.id,
    course.price_pence,
    discountPence,
    total,
    couponId,
    couponCode,
  );

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: 'order.created',
    entityType: 'order',
    entityId: Number(info.lastInsertRowid),
    summary: `Started checkout for "${course.title}" (${publicId})`,
    meta: { subtotal: course.price_pence, discount: discountPence, total, coupon: couponCode },
  });

  redirect(`/mock-stripe/checkout?order=${publicId}`);
}

/* ------------------------------------------------------------------ mock provider */

const paySchema = z.object({
  order: z.string().min(4).max(40),
  card: z.string().min(8).max(30),
  expiry: z.string().min(3).max(10),
  cvc: z.string().min(3).max(4),
  name: z.string().min(2).max(120),
});

export interface PayResult {
  status: 'paid' | 'declined' | 'error';
  message: string;
  redirectTo?: string;
  delivery?: { ok: boolean; status: number; body: string; eventId: string };
  badSignatureDelivery?: { ok: boolean; status: number; body: string };
}

/**
 * Called by the hosted mock checkout page. Charges the (fake) card, then
 * delivers a signed webhook event over HTTP - the order is only marked paid by
 * the webhook handler, never here.
 */
export async function submitMockPayment(formData: FormData): Promise<PayResult> {
  const parsed = paySchema.safeParse({
    order: formData.get('order'),
    card: formData.get('card'),
    expiry: formData.get('expiry'),
    cvc: formData.get('cvc'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Please fill in every card field.' };
  }

  const order = queryOne<{
    id: number;
    public_id: string;
    status: string;
    total_pence: number;
    course_id: number;
    course_title: string;
    course_slug: string;
  }>(
    `SELECT o.id, o.public_id, o.status, o.total_pence, o.course_id,
            c.title AS course_title, c.slug AS course_slug
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.public_id = ?`,
    parsed.data.order,
  );
  if (!order) return { status: 'error', message: 'That order could not be found.' };
  if (order.status === 'paid') {
    return {
      status: 'paid',
      message: 'This order was already paid.',
      redirectTo: `/checkout/return?order=${order.public_id}&status=paid`,
    };
  }

  const attempt = chargeCard(parsed.data.card);

  if (!attempt.ok) {
    const failureEvent = buildEvent('payment.failed', {
      orderPublicId: order.public_id,
      amountPence: order.total_pence,
      failureReason: attempt.reason,
      cardBrand: attempt.brand,
      cardLast4: attempt.last4,
    });
    const delivery = await deliverEvent(failureEvent);
    run(
      `UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ?`,
      order.id,
    );
    return {
      status: 'declined',
      message: attempt.reason ?? 'Card declined.',
      redirectTo: `/checkout/return?order=${order.public_id}&status=declined`,
      delivery: { ok: delivery.ok, status: delivery.status, body: delivery.body, eventId: delivery.eventId },
    };
  }

  const successEvent = buildEvent('payment.succeeded', {
    orderPublicId: order.public_id,
    amountPence: order.total_pence,
    cardBrand: attempt.brand,
    cardLast4: attempt.last4,
  });

  // dev buttons: prove the webhook rejects a bad signature and ignores duplicates
  let badSignatureDelivery: PayResult['badSignatureDelivery'];
  if (formData.get('simulate_bad_signature') === 'on') {
    const bad = await deliverEvent(
      buildEvent('payment.succeeded', {
        orderPublicId: order.public_id,
        amountPence: order.total_pence,
        note: 'tampered signature demo',
      }),
      { tamper: true },
    );
    badSignatureDelivery = { ok: bad.ok, status: bad.status, body: bad.body };
  }

  const delivery = await deliverEvent(successEvent);

  return {
    status: 'paid',
    message:
      'Card approved by mockpay. The order is only marked paid once the signed webhook below is verified.',
    redirectTo: `/checkout/return?order=${order.public_id}&status=paid`,
    delivery: { ok: delivery.ok, status: delivery.status, body: delivery.body, eventId: delivery.eventId },
    badSignatureDelivery,
  };
}

/** Dev-only: deliver the same event id twice to prove webhook idempotency. */
export async function replayLastEvent(eventId: string, orderPublicId: string, amountPence: number): Promise<PayResult> {
  const event = { ...buildEvent('payment.succeeded', { orderPublicId, amountPence }), id: eventId };
  const delivery = await deliverEvent(event);
  return {
    status: 'paid',
    message: 'Duplicate event delivered.',
    delivery: { ok: delivery.ok, status: delivery.status, body: delivery.body, eventId: delivery.eventId },
  };
}

/* ------------------------------------------------------------------ refunds (admin) */

export async function refundOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const orderId = Number.parseInt(String(formData.get('order_id') ?? ''), 10);
  const amountRaw = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');
  const reason = z.string().trim().min(4, 'Give a short reason for the refund').max(400).safeParse(
    formData.get('reason'),
  );
  const revokeAccess = formData.get('revoke_access') !== 'off';
  const fullRefund = formData.get('full') === 'on';

  if (!reason.success) {
    return { error: reason.error.issues[0].message, fieldErrors: { reason: reason.error.issues[0].message } };
  }

  const order = queryOne<{
    id: number;
    public_id: string;
    user_id: number;
    course_id: number;
    status: string;
    total_pence: number;
    refunded_pence: number;
    course_title: string;
    course_slug: string;
    user_email: string;
    user_name: string;
  }>(
    `SELECT o.id, o.public_id, o.user_id, o.course_id, o.status, o.total_pence, o.refunded_pence,
            c.title AS course_title, c.slug AS course_slug,
            u.email AS user_email, u.name AS user_name
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       JOIN users u ON u.id = o.user_id
      WHERE o.id = ?`,
    orderId,
  );
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'pending' || order.status === 'failed') {
    return { error: 'That order was never paid, so there is nothing to refund.' };
  }

  const outstanding = order.total_pence - order.refunded_pence;
  if (outstanding <= 0) return { error: 'This order has already been fully refunded.' };

  const requestedPence = fullRefund ? outstanding : Math.round(Number.parseFloat(amountRaw) * 100);
  if (!Number.isFinite(requestedPence) || requestedPence <= 0) {
    return { error: 'Enter a refund amount greater than zero.', fieldErrors: { amount: 'Invalid amount' } };
  }
  if (requestedPence > outstanding) {
    return {
      error: `You can refund at most £${(outstanding / 100).toFixed(2)} on this order.`,
      fieldErrors: { amount: 'Too much' },
    };
  }

  const newRefunded = order.refunded_pence + requestedPence;
  const status = newRefunded >= order.total_pence ? 'refunded' : 'partially_refunded';

  run(
    `UPDATE orders
        SET status = ?, refunded_pence = ?, refund_reason = ?, refunded_at = datetime('now'),
            refunded_by = ?, updated_at = datetime('now')
      WHERE id = ?`,
    status,
    newRefunded,
    reason.data,
    admin.id,
    order.id,
  );

  if (revokeAccess) {
    run(
      `UPDATE enrolments
          SET access_revoked = 1, revoked_reason = ?
        WHERE user_id = ? AND course_id = ?`,
      `Refunded: ${reason.data}`,
      order.user_id,
      order.course_id,
    );
  }

  const partial = newRefunded < order.total_pence;
  sendMailToUser(
    order.user_id,
    refundProcessed({
      name: order.user_name,
      orderPublicId: order.public_id,
      courseTitle: order.course_title,
      amountPence: requestedPence,
      partial,
      accessRevoked: revokeAccess,
    }),
  );

  notify({
    userId: order.user_id,
    type: 'refund_processed',
    title: `Refund processed: £${(requestedPence / 100).toFixed(2)}`,
    body: revokeAccess
      ? `Access to ${order.course_title} has been removed.`
      : `Your access to ${order.course_title} continues.`,
    href: '/learn/orders',
  });

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.orderRefunded,
    entityType: 'order',
    entityId: order.id,
    summary: `Refunded £${(requestedPence / 100).toFixed(2)} on ${order.public_id} (${order.user_email}) - ${reason.data}`,
    meta: {
      amount: requestedPence,
      status,
      accessRevoked: revokeAccess,
      course: order.course_slug,
    },
  });

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath('/admin/orders');
  revalidatePath('/learn/orders');
  return { ok: true, message: `Refunded £${(requestedPence / 100).toFixed(2)}.` };
}
