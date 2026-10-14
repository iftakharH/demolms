import { query, queryOne } from '@/lib/db';

export interface AdminKpis {
  netRevenuePence: number;
  paidOrders: number;
  newUsers30d: number;
  totalLearners: number;
  activeEnrolments: number;
  completionRate: number;
  pendingGrading: number;
  validCertificates: number;
}

/** Headline numbers for the admin dashboard. */
export function adminKpis(): AdminKpis {
  const revenue =
    queryOne<{ net: number | null; orders: number }>(
      `SELECT SUM(total_pence - refunded_pence) AS net, COUNT(*) AS orders
         FROM orders WHERE paid_at IS NOT NULL`,
    ) ?? { net: null, orders: 0 };

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
    newUsers30d: newUsers,
    totalLearners: learners,
    activeEnrolments: enrolments.total,
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
