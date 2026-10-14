import { query, queryOne, run } from './db';

/**
 * Coupon rules: percentage or fixed amount, optional single-course scope,
 * optional expiry, optional usage limit.
 */

export interface CouponRow {
  id: number;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  course_id: number | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: number;
  created_at: string;
}

export interface CouponCheck {
  ok: boolean;
  message: string;
  discountPence: number;
  coupon?: CouponRow;
}

export function findCoupon(code: string): CouponRow | undefined {
  return queryOne<CouponRow>('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE', code.trim());
}

/** Validate a coupon against a specific course and price. */
export function evaluateCoupon(code: string, courseId: number, pricePence: number): CouponCheck {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, message: 'Enter a coupon code.', discountPence: 0 };

  const coupon = findCoupon(trimmed);
  if (!coupon) {
    return { ok: false, message: `"${trimmed}" is not a valid coupon code.`, discountPence: 0 };
  }
  if (!coupon.is_active) {
    return { ok: false, message: 'That coupon has been disabled.', discountPence: 0 };
  }
  if (coupon.course_id !== null && coupon.course_id !== courseId) {
    return { ok: false, message: 'That coupon is not valid for this course.', discountPence: 0 };
  }
  if (coupon.expires_at && new Date(coupon.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    return { ok: false, message: 'That coupon has expired.', discountPence: 0 };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, message: 'That coupon has reached its usage limit.', discountPence: 0 };
  }

  const discount =
    coupon.kind === 'percent'
      ? Math.min(pricePence, Math.round((pricePence * coupon.value) / 100))
      : Math.min(pricePence, coupon.value);

  if (coupon.kind === 'fixed' && coupon.value > pricePence) {
    // cap at the price: never pay the learner
    return { ok: true, message: `Coupon applied: ${coupon.code}`, discountPence: pricePence, coupon };
  }

  const label =
    coupon.kind === 'percent' ? `${coupon.value}% off` : `£${(coupon.value / 100).toFixed(2)} off`;
  return { ok: true, message: `Coupon applied: ${coupon.code} (${label})`, discountPence: discount, coupon };
}

/** Record a redemption (called by the webhook once an order is actually paid). */
export function recordCouponUse(couponId: number | null): void {
  if (!couponId) return;
  run('UPDATE coupons SET used_count = used_count + 1, updated_at = datetime(\'now\') WHERE id = ?', couponId);
}

export interface CouponAdminRow extends CouponRow {
  course_title: string | null;
  created_by_email: string | null;
}

export function listCoupons(): CouponAdminRow[] {
  return query<CouponAdminRow>(
    `SELECT c.*, co.title AS course_title, u.email AS created_by_email
       FROM coupons c
       LEFT JOIN courses co ON co.id = c.course_id
       LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.is_active DESC, c.created_at DESC`,
  );
}

export function couponUsageLabel(coupon: CouponRow): string {
  const limit = coupon.max_uses === null ? 'unlimited' : `${coupon.max_uses}`;
  return `${coupon.used_count} / ${limit} used`;
}
