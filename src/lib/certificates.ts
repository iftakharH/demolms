import { AUDIT_ACTIONS, logAudit } from './audit';
import { queryOne, run } from './db';
import { newCertificateId } from './ids';
import { courseCompletion } from './progress';
import { sendMailToUser } from './mailer';
import { certificateIssued } from './email-templates';

/**
 * Certificates.
 *
 * Issue rules: the course must have certificates enabled, the learner must have
 * finished everything the course requires (lessons, quiz pass marks, graded
 * assignments), and a certificate must not already exist.
 */

export interface CertificateRow {
  id: number;
  certificateId: string;
  userId: number;
  courseId: number;
  issuedAt: string;
  revokedAt: string | null;
  revokedBy: number | null;
  revokeReason: string | null;
}

export function certificateFor(userId: number, courseId: number): CertificateRow | undefined {
  return queryOne<CertificateRow>(
    `SELECT id, certificate_id AS certificateId, user_id AS userId, course_id AS courseId,
            issued_at AS issuedAt, revoked_at AS revokedAt, revoked_by AS revokedBy,
            revoke_reason AS revokeReason
       FROM certificates WHERE user_id = ? AND course_id = ?`,
    userId,
    courseId,
  );
}

export function certificateByPublicId(certificateId: string) {
  return queryOne<{
    id: number;
    certificateId: string;
    issuedAt: string;
    revokedAt: string | null;
    revokeReason: string | null;
    userId: number;
    userName: string;
    userEmail: string;
    courseId: number;
    courseTitle: string;
    courseSlug: string;
    instructorName: string;
    certificateEnabled: number;
  }>(
    `SELECT cert.id, cert.certificate_id AS certificateId, cert.issued_at AS issuedAt,
            cert.revoked_at AS revokedAt, cert.revoke_reason AS revokeReason,
            u.id AS userId, u.name AS userName, u.email AS userEmail,
            c.id AS courseId, c.title AS courseTitle, c.slug AS courseSlug,
            c.instructor_name AS instructorName, c.certificate_enabled
       FROM certificates cert
       JOIN users u ON u.id = cert.user_id
       JOIN courses c ON c.id = cert.course_id
      WHERE cert.certificate_id = ?`,
    certificateId,
  );
}

/** Idempotent: returns the existing certificate if there is one. */
export function issueCertificateIfEligible(
  userId: number,
  courseId: number,
): CertificateRow | null {
  const course = queryOne<{ certificate_enabled: number; title: string }>(
    'SELECT certificate_enabled, title FROM courses WHERE id = ?',
    courseId,
  );
  if (!course || !course.certificate_enabled) return null;

  const existing = certificateFor(userId, courseId);
  if (existing) return existing;

  const completion = courseCompletion(userId, courseId);
  if (!completion.complete) return null;

  const certificateId = newCertificateId();
  const info = run(
    'INSERT INTO certificates (certificate_id, user_id, course_id) VALUES (?, ?, ?)',
    certificateId,
    userId,
    courseId,
  );

  const certificate: CertificateRow = {
    id: Number(info.lastInsertRowid),
    certificateId,
    userId,
    courseId,
    issuedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
  };

  sendMailToUser(
    userId,
    certificateIssued({
      name: queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', userId)?.name ?? 'Learner',
      courseTitle: course.title,
      certificateId,
      issuedAt: certificate.issuedAt,
    }),
  );

  logAudit({
    actor: null,
    action: AUDIT_ACTIONS.certificateIssued,
    entityType: 'certificate',
    entityId: certificateId,
    summary: `Certificate ${certificateId} issued for "${course.title}"`,
    meta: { userId, courseId },
  });

  return certificate;
}

export function revokedLabel(certificate: { revokedAt: string | null }): 'valid' | 'revoked' {
  return certificate.revokedAt ? 'revoked' : 'valid';
}
