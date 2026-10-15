import { run } from './db';

export interface AuditActor {
  id: number | null;
  email: string;
  role: string;
}

export interface AuditEntry {
  actor: AuditActor | null;
  action: string;
  entityType?: string;
  entityId?: string | number | null;
  summary: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append-only record of every meaningful action: admin writes and auth events.
 * Never throws into the caller - an audit failure must not break a payment.
 */
export function logAudit(entry: AuditEntry): void {
  try {
    run(
      `INSERT INTO audit_log (actor_user_id, actor_email, actor_role, action, entity_type, entity_id, summary, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.actor?.id ?? null,
      entry.actor?.email ?? 'system',
      entry.actor?.role ?? 'system',
      entry.action,
      entry.entityType ?? '',
      entry.entityId === null || entry.entityId === undefined ? '' : String(entry.entityId),
      entry.summary,
      JSON.stringify({ ...(entry.meta ?? {}), ...(entry.ip ? { ip: entry.ip } : {}) }),
    );
  } catch (error) {
    console.error('[audit] failed to write entry', entry.action, error);
  }
}

export const AUDIT_ACTIONS = {
  login: 'auth.login',
  loginFailed: 'auth.login_failed',
  logoutAll: 'auth.logout_all',
  register: 'auth.register',
  emailVerified: 'auth.email_verified',
  passwordReset: 'auth.password_reset',
  mfaEnabled: 'auth.mfa_enabled',
  courseCreated: 'course.created',
  courseUpdated: 'course.updated',
  coursePublished: 'course.published',
  courseArchived: 'course.archived',
  courseDeleted: 'course.deleted',
  sectionCreated: 'course.section_created',
  lessonCreated: 'course.lesson_created',
  lessonUpdated: 'course.lesson_updated',
  lessonDeleted: 'course.lesson_deleted',
  orderRefunded: 'order.refunded',
  orderPaid: 'order.paid',
  orderCreated: 'order.created',
  enrolmentCreated: 'enrolment.created',
  couponCreated: 'coupon.created',
  couponUpdated: 'coupon.updated',
  userRoleChanged: 'user.role_changed',
  userDisabled: 'user.disabled',
  userEnabled: 'user.enabled',
  submissionGraded: 'submission.graded',
  quizReviewed: 'quiz.reviewed',
  certificateIssued: 'certificate.issued',
  certificateRevoked: 'certificate.revoked',
  fileUploaded: 'file.uploaded',
  settingsChanged: 'settings.changed',
  supportEntered: 'support.entered',
  supportExited: 'support.exited',
} as const;
