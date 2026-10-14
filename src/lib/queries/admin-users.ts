import { query, queryOne } from '../db';

/** Admin user management queries. */

export interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'auditor';
  isActive: boolean;
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  enrolments: number;
  completed: number;
  orders: number;
  spentPence: number;
}

export function adminUsers(filters: { q?: string; role?: string } = {}): AdminUserRow[] {
  const where: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.q) {
    const like = `%${filters.q.trim().toLowerCase()}%`;
    where.push('(LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?)');
    params.push(like, like);
  }
  if (filters.role && ['learner', 'admin', 'auditor'].includes(filters.role)) {
    where.push('u.role = ?');
    params.push(filters.role);
  }

  return query<AdminUserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.is_active AS isActive,
            CASE WHEN u.email_verified_at IS NULL THEN 0 ELSE 1 END AS emailVerified,
            CASE WHEN u.totp_confirmed_at IS NULL THEN 0 ELSE 1 END AS totpEnabled,
            u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
            (SELECT COUNT(*) FROM enrolments e WHERE e.user_id = u.id AND e.access_revoked = 0) AS enrolments,
            (SELECT COUNT(*) FROM enrolments e WHERE e.user_id = u.id AND e.completed_at IS NOT NULL) AS completed,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS orders,
            (SELECT COALESCE(SUM(o.total_pence - o.refunded_pence), 0) FROM orders o
              WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS spentPence
       FROM users u
      WHERE ${where.join(' AND ')}
      ORDER BY u.created_at DESC
      LIMIT 200`,
    ...params,
  ).map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
    emailVerified: Boolean(row.emailVerified),
    totpEnabled: Boolean(row.totpEnabled),
  }));
}

export interface AdminUserDetail {
  id: number;
  email: string;
  name: string;
  role: 'learner' | 'admin' | 'auditor';
  isActive: boolean;
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  emailPrefs: string;
}

export function adminUserDetail(userId: number): AdminUserDetail | null {
  const row = queryOne<{
    id: number;
    email: string;
    name: string;
    role: 'learner' | 'admin' | 'auditor';
    isActives: number;
    emailVerified: number;
    totpEnabled: number;
    createdAt: string;
    lastLoginAt: string | null;
    emailPrefs: string;
  }>(
    `SELECT u.id, u.email, u.name, u.role, u.is_active AS isActives,
            CASE WHEN u.email_verified_at IS NULL THEN 0 ELSE 1 END AS emailVerified,
            CASE WHEN u.totp_confirmed_at IS NULL THEN 0 ELSE 1 END AS totpEnabled,
            u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
            u.email_prefs_json AS emailPrefs
       FROM users u WHERE u.id = ?`,
    userId,
  );
  if (!row) return null;
  return {
    ...row,
    isActive: Boolean(row.isActives),
    emailVerified: Boolean(row.emailVerified),
    totpEnabled: Boolean(row.totpEnabled),
  };
}

export interface UserEnrolment {
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  source: string;
  enrolledAt: string;
  completedAt: string | null;
  accessRevoked: number;
  percent: number;
}

export function userEnrolments(userId: number): UserEnrolment[] {
  return query<UserEnrolment>(
    `SELECT c.id AS courseId, c.title AS courseTitle, c.slug AS courseSlug, e.source,
            e.enrolled_at AS enrolledAt, e.completed_at AS completedAt, e.access_revoked AS accessRevoked,
            CAST(ROUND(100.0 * (SELECT COUNT(*) FROM lesson_progress lp
                                  WHERE lp.course_id = c.id AND lp.user_id = e.user_id
                                    AND lp.completed_at IS NOT NULL)
                        / MAX(1, (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id))) AS INTEGER) AS percent
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ?
      ORDER BY e.enrolled_at DESC`,
    userId,
  );
}

export interface UserOrder {
  id: number;
  publicId: string;
  status: string;
  totalPence: number;
  refundedPence: number;
  paidAt: string | null;
  courseTitle: string;
}

export function userOrders(userId: number): UserOrder[] {
  return query<UserOrder>(
    `SELECT o.id, o.public_id AS publicId, o.status, o.total_pence AS totalPence,
            o.refunded_pence AS refundedPence, o.paid_at AS paidAt, c.title AS courseTitle
       FROM orders o JOIN courses c ON c.id = o.course_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC`,
    userId,
  );
}

export interface UserAuditEntry {
  id: number;
  action: string;
  summary: string;
  createdAt: string;
}

export function userRecentAudit(userId: number, limit = 8): UserAuditEntry[] {
  return query<UserAuditEntry>(
    `SELECT id, action, summary, created_at AS createdAt
       FROM audit_log WHERE actor_user_id = ? OR entity_id = ?
      ORDER BY created_at DESC LIMIT ?`,
    userId,
    String(userId),
    limit,
  );
}
