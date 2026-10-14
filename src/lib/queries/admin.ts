import { query, queryOne } from '@/lib/db';

export interface AdminKpis {
  netRevenuePence: number;
  paidOrders: number;
  refundedPence: number;
  refundedOrders: number;
  newUsers30d: number;
  totalLearners: number;
  activeEnrolments: number;
  enrolments30d: number;
  completionRate: number;
  pendingGrading: number;
  validCertificates: number;
}

/** Headline numbers for the admin dashboard. */
export function adminKpis(): AdminKpis {
  const revenue =
    queryOne<{ net: number | null; orders: number; refunded: number | null; refundedOrders: number }>(
      `SELECT SUM(total_pence - refunded_pence) AS net, COUNT(*) AS orders,
              SUM(refunded_pence) AS refunded,
              SUM(CASE WHEN refunded_pence > 0 THEN 1 ELSE 0 END) AS refundedOrders
         FROM orders WHERE paid_at IS NOT NULL`,
    ) ?? { net: null, orders: 0, refunded: null, refundedOrders: 0 };

  const newUsers =
    queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'learner' AND created_at >= datetime('now', '-30 days')",
    )?.n ?? 0;

  const learners = queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'learner'")?.n ?? 0;

  const enrolments =
    queryOne<{ total: number; done: number }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS done
         FROM enrolments WHERE access_revoked = 0`,
    ) ?? { total: 0, done: 0 };

  const enrolments30d =
    queryOne<{ n: number }>(
      "SELECT COUNT(*) AS n FROM enrolments WHERE enrolled_at >= datetime('now', '-30 days')",
    )?.n ?? 0;

  const pending =
    queryOne<{ n: number }>(
      `SELECT
         (SELECT COUNT(*) FROM assignment_submissions WHERE status = 'submitted')
       + (SELECT COUNT(*) FROM quiz_attempts WHERE status = 'pending_review') AS n`,
    )?.n ?? 0;

  const certificates =
    queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM certificates WHERE revoked_at IS NULL')?.n ?? 0;

  return {
    netRevenuePence: revenue.net ?? 0,
    paidOrders: revenue.orders,
    refundedPence: revenue.refunded ?? 0,
    refundedOrders: revenue.refundedOrders,
    newUsers30d: newUsers,
    totalLearners: learners,
    activeEnrolments: enrolments.total,
    enrolments30d,
    completionRate: enrolments.total > 0 ? Math.round(((enrolments.done ?? 0) / enrolments.total) * 100) : 0,
    pendingGrading: pending,
    validCertificates: certificates,
  };
}

export interface DailyPoint {
  day: string;
  revenuePence: number;
  orders: number;
}

/** Last `days` calendar days of paid revenue (gaps filled with zeros). */
export function revenueSeries(days = 30): DailyPoint[] {
  const rows = query<{ day: string; revenue: number | null; orders: number }>(
    `SELECT date(paid_at) AS day,
            SUM(total_pence - refunded_pence) AS revenue,
            COUNT(*) AS orders
       FROM orders
      WHERE paid_at IS NOT NULL AND paid_at >= datetime('now', ?)
      GROUP BY date(paid_at)`,
    `-${days} days`,
  );
  const byDay = new Map(rows.map((row) => [row.day, row]));

  const series: DailyPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    series.push({
      day: key,
      revenuePence: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    });
  }
  return series;
}

/* ------------------------------------------------------ dashboard widgets */

export interface DashboardLearner {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  enrolments: number;
  orders: number;
}

/** Newest learner accounts, for the dashboard's "people" widget. */
export function newestLearners(limit = 6): DashboardLearner[] {
  return query<DashboardLearner>(
    `SELECT u.id, u.name, u.email, u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
            (SELECT COUNT(*) FROM enrolments e WHERE e.user_id = u.id AND e.access_revoked = 0) AS enrolments,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS orders
       FROM users u
      WHERE u.role = 'learner'
      ORDER BY u.created_at DESC
      LIMIT ?`,
    limit,
  );
}

export interface DashboardCourse {
  id: number;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  enrolments: number;
  revenuePence: number;
}

/** Courses ordered by live enrolments, for the dashboard's catalogue widget. */
export function topCoursesByEnrolment(limit = 5): DashboardCourse[] {
  return query<DashboardCourse>(
    `SELECT c.id, c.slug, c.title, c.status, c.updated_at AS updatedAt,
            (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id AND e.access_revoked = 0) AS enrolments,
            (SELECT COALESCE(SUM(o.total_pence - o.refunded_pence), 0) FROM orders o
              WHERE o.course_id = c.id AND o.paid_at IS NOT NULL) AS revenuePence
       FROM courses c
      ORDER BY enrolments DESC, c.updated_at DESC
      LIMIT ?`,
    limit,
  );
}

export interface DashboardAuditEntry {
  id: number;
  action: string;
  actorEmail: string;
  actorRole: string;
  summary: string;
  createdAt: string;
}

/** Latest audit entries, for the dashboard's activity widget. */
export function recentAuditEntries(limit = 6): DashboardAuditEntry[] {
  return query<DashboardAuditEntry>(
    `SELECT id, action, actor_email AS actorEmail, actor_role AS actorRole, summary, created_at AS createdAt
       FROM audit_log
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    limit,
  );
}
