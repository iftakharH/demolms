'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminWriter } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { queryOne, run } from '@/lib/db';
import type { FormState } from '@/lib/action-state';

/** Coupon management (admin only). */

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Codes need at least 3 characters')
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes and underscores only'),
  kind: z.enum(['percent', 'fixed']),
  value: z.string(),
  courseId: z.string().optional().default(''),
  expiresAt: z.string().optional().default(''),
  maxUses: z.string().optional().default(''),
});

function parseExpiry(value: string): string | null {
  if (!value) return null;
  // <input type="date"> gives YYYY-MM-DD; store the end of that day
  const date = new Date(`${value}T23:59:59Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function createCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();

  const parsed = couponSchema.safeParse({
    code: formData.get('code'),
    kind: formData.get('kind'),
    value: formData.get('value'),
    courseId: formData.get('course_id') ?? '',
    expiresAt: formData.get('expires_at') ?? '',
    maxUses: formData.get('max_uses') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  const data = parsed.data;
  const code = data.code.toUpperCase();

  if (queryOne<{ id: number }>('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE', code)) {
    return { error: `${code} already exists.`, fieldErrors: { code: 'Duplicate code' } };
  }

  let value: number;
  if (data.kind === 'percent') {
    const percent = Number.parseInt(data.value, 10);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      return { error: 'Percentage discounts run from 1 to 100.', fieldErrors: { value: '1-100' } };
    }
    value = percent;
  } else {
    const pounds = Number.parseFloat(data.value.replace(/[£,\s]/g, ''));
    if (!Number.isFinite(pounds) || pounds <= 0) {
      return { error: 'Enter a discount amount in pounds.', fieldErrors: { value: 'Required' } };
    }
    value = Math.round(pounds * 100);
  }

  const maxUses = data.maxUses ? Number.parseInt(data.maxUses, 10) : null;
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return { error: 'Usage limit must be 1 or more (or blank for unlimited).', fieldErrors: { maxUses: 'Invalid' } };
  }

  const courseId = data.courseId ? Number.parseInt(data.courseId, 10) : null;

  const info = run(
    `INSERT INTO coupons (code, kind, value, course_id, expires_at, max_uses, is_active, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    code,
    data.kind,
    value,
    Number.isFinite(courseId as number) ? courseId : null,
    parseExpiry(data.expiresAt),
    maxUses,
    admin.id,
  );

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.couponCreated,
    entityType: 'coupon',
    entityId: Number(info.lastInsertRowid),
    summary: `Created coupon ${code} (${data.kind === 'percent' ? `${value}% off` : `£${(value / 100).toFixed(2)} off`}${courseId ? ', single course' : ', all courses'})`,
    meta: { code, kind: data.kind, value, courseId, maxUses },
  });

  revalidatePath('/admin/coupons');
  return { ok: true, message: `Coupon ${code} created.` };
}

export async function toggleCouponAction(formData: FormData): Promise<void> {
  const admin = await requireAdminWriter();
  const couponId = Number.parseInt(String(formData.get('coupon_id') ?? ''), 10);
  const coupon = queryOne<{ id: number; code: string; is_active: number }>(
    'SELECT id, code, is_active FROM coupons WHERE id = ?',
    couponId,
  );
  if (!coupon) return;

  const nextActive = coupon.is_active ? 0 : 1;
  run("UPDATE coupons SET is_active = ?, updated_at = datetime('now') WHERE id = ?", nextActive, coupon.id);

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.couponUpdated,
    entityType: 'coupon',
    entityId: coupon.id,
    summary: `${nextActive ? 'Enabled' : 'Disabled'} coupon ${coupon.code}`,
  });

  revalidatePath('/admin/coupons');
}
