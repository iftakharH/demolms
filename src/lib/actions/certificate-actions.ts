'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminWriter } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { certificateByPublicId } from '@/lib/certificates';
import { run } from '@/lib/db';
import { notify } from '@/lib/notify';
import type { FormState } from '@/lib/action-state';

/** Admin revokes a certificate (with a reason shown on the public verify page). */
export async function revokeCertificateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminWriter();
  const certificateId = String(formData.get('certificate_id') ?? '').trim();
  const reason = z
    .string()
    .trim()
    .min(4, 'Give a short reason - it is shown publicly on the verification page.')
    .max(300)
    .safeParse(formData.get('reason'));

  if (!reason.success) {
    return { error: reason.error.issues[0].message, fieldErrors: { reason: reason.error.issues[0].message } };
  }

  const certificate = certificateByPublicId(certificateId);
  if (!certificate) return { error: 'Certificate not found.' };
  if (certificate.revokedAt) return { error: 'That certificate is already revoked.' };

  run(
    `UPDATE certificates SET revoked_at = datetime('now'), revoked_by = ?, revoke_reason = ?
      WHERE certificate_id = ?`,
    admin.id,
    reason.data,
    certificateId,
  );

  notify({
    userId: certificate.userId,
    type: 'certificate_revoked',
    title: 'Certificate revoked',
    body: `${certificate.courseTitle}: ${reason.data}`,
    href: '/learn/certificates',
  });

  logAudit({
    actor: { id: admin.id, email: admin.email, role: admin.role },
    action: AUDIT_ACTIONS.certificateRevoked,
    entityType: 'certificate',
    entityId: certificateId,
    summary: `Revoked certificate ${certificateId} (${certificate.userEmail}) - ${reason.data}`,
    meta: { course: certificate.courseSlug },
  });

  revalidatePath('/admin/certificates');
  revalidatePath(`/verify/${certificateId}`);
  revalidatePath('/learn/certificates');
  return { ok: true, message: `Revoked ${certificateId}. The verification page now shows it as revoked.` };
}
