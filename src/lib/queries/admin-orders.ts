import { query, queryOne } from '../db';

/** Admin order queries (list, filters, detail). */

export interface AdminOrderRow {
  id: number;
  publicId: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  totalPence: number;
  refundedPence: number;
  couponCode: string | null;
  courseTitle: string;
  courseSlug: string;
  userEmail: string;
  userName: string;
  userId: number;
}

export interface AdminOrderFilters {
  status?: string;
  q?: string;
  limit?: number;
}

export function adminOrders(filters: AdminOrderFilters = {}): AdminOrderRow[] {
  const where: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.status && ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled'].includes(filters.status)) {
    where.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    where.push(
      '(LOWER(o.public_id) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ? OR LOWER(c.title) LIKE ?)',
    );
    params.push(like, like, like, like);
  }

  return query<AdminOrderRow>(
    `SELECT o.id, o.public_id AS publicId, o.status, o.created_at AS createdAt, o.paid_at AS paidAt,
            o.total_pence AS totalPence, o.refunded_pence AS refundedPence, o.coupon_code AS couponCode,
            c.title AS courseTitle, c.slug AS courseSlug,
            u.email AS userEmail, u.name AS userName, u.id AS userId
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       JOIN users u ON u.id = o.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT ?`,
    ...params,
    filters.limit ?? 100,
  );
}

export interface AdminOrderDetail extends AdminOrderRow {
  subtotalPence: number;
  discountPence: number;
  cardBrand: string | null;
  cardLast4: string | null;
  paymentRef: string | null;
  refundReason: string | null;
  refundedAt: string | null;
  refundedByEmail: string | null;
  courseId: number;
  enrolmentRevoked: number;
  enrolmentId: number | null;
}

export function adminOrderDetail(orderId: number): AdminOrderDetail | null {
  return (
    queryOne<AdminOrderDetail>(
      `SELECT o.id, o.public_id AS publicId, o.status, o.created_at AS createdAt, o.paid_at AS paidAt,
              o.total_pence AS totalPence, o.refunded_pence AS refundedPence, o.coupon_code AS couponCode,
              o.subtotal_pence AS subtotalPence, o.discount_pence AS discountPence,
              o.card_brand AS cardBrand, o.card_last4 AS cardLast4, o.payment_ref AS paymentRef,
              o.refund_reason AS refundReason, o.refunded_at AS refundedAt,
              o.course_id AS courseId,
              ru.email AS refundedByEmail,
              c.title AS courseTitle, c.slug AS courseSlug,
              u.email AS userEmail, u.name AS userName, u.id AS userId,
              COALESCE(e.access_revoked, 0) AS enrolmentRevoked, e.id AS enrolmentId
         FROM orders o
         JOIN courses c ON c.id = o.course_id
         JOIN users u ON u.id = o.user_id
         LEFT JOIN users ru ON ru.id = o.refunded_by
         LEFT JOIN enrolments e ON e.user_id = o.user_id AND e.course_id = o.course_id
        WHERE o.id = ?`,
      orderId,
    ) ?? null
  );
}

export interface OrderWebhookRow {
  id: string;
  type: string;
  signatureValid: number;
  note: string;
  receivedAt: string;
}

export function orderWebhookEvents(orderPublicId: string, limit = 8): OrderWebhookRow[] {
  return query<OrderWebhookRow>(
    `SELECT id, type, signature_valid AS signatureValid, note, received_at AS receivedAt
       FROM webhook_events
      WHERE payload LIKE ? OR note LIKE ?
      ORDER BY received_at DESC
      LIMIT ?`,
    `%${orderPublicId}%`,
    `%${orderPublicId}%`,
    limit,
  );
}

export interface OrderStats {
  paidCount: number;
  netRevenuePence: number;
  refundedCount: number;
  refundedPence: number;
  failedCount: number;
}

export function orderStats(): OrderStats {
  const row = queryOne<{
    paidCount: number;
    netRevenuePence: number;
    refundedCount: number;
    refundedPence: number;
    failedCount: number;
  }>(
    `SELECT
       SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END) AS paidCount,
       COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN total_pence - refunded_pence ELSE 0 END), 0) AS netRevenuePence,
       SUM(CASE WHEN refunded_pence > 0 THEN 1 ELSE 0 END) AS refundedCount,
       COALESCE(SUM(refunded_pence), 0) AS refundedPence,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failedCount
     FROM orders`,
  );
  return row ?? { paidCount: 0, netRevenuePence: 0, refundedCount: 0, refundedPence: 0, failedCount: 0 };
}
