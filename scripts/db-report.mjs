import Database from 'better-sqlite3';

const db = new Database('data/demolms.db', { readonly: true });
const all = (sql, ...params) => db.prepare(sql).all(...params);
const one = (sql, ...params) => db.prepare(sql).get(...params);

const arthur = all("SELECT email, name, role, is_active, email_verified_at, totp_confirmed_at, email_prefs_json, created_at, last_login_at FROM users ORDER BY id");
console.log('=== USERS');
for (const user of arthur) {
  console.log(`${user.email} | ${user.name} | ${user.role} | active=${user.is_active} | verified=${user.email_verified_at ? 'yes' : 'no'} | totp=${user.totp_confirmed_at ? 'yes' : 'no'} | joined=${user.created_at.slice(0, 10)}`);
  console.log(`    prefs ${user.email_prefs_json}`);
}

console.log('\n=== ENROLMENTS (per learner)');
for (const row of all(
  `SELECT u.email, c.slug, c.title, e.source, e.access_revoked, e.completed_at,
          (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.course_id = c.id AND lp.user_id = u.id AND lp.completed_at IS NOT NULL) AS done,
          (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total
     FROM enrolments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
    ORDER BY u.email, c.id`,
)) {
  console.log(`${row.email} -> ${row.slug} (${row.source}) ${row.done}/${row.total} done revoked=${row.access_revoked} completed=${row.completed_at ? 'yes' : 'no'}`);
}

console.log('\n=== VIDEO POSITIONS');
for (const row of all(
  `SELECT u.email, l.title, lp.video_position_seconds AS pos
     FROM lesson_progress lp JOIN users u ON u.id = lp.user_id JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.video_position_seconds > 0 ORDER BY u.email`,
)) {
  console.log(`${row.email} | ${row.title} @ ${row.pos}s`);
}

console.log('\n=== ORDERS');
for (const row of all(
  `SELECT o.public_id, u.email, o.status, o.subtotal_pence, o.discount_pence, o.total_pence, o.refunded_pence, o.coupon_code, c.title
     FROM orders o JOIN users u ON u.id = o.user_id JOIN courses c ON c.id = o.course_id ORDER BY o.id`,
)) {
  console.log(`${row.public_id} | ${row.email} | ${row.status} | ${row.title} | sub ${row.subtotal_pence} disc ${row.discount_pence} total ${row.total_pence} refunded ${row.refunded_pence} coupon ${row.coupon_code}`);
}

console.log('\n=== COUPONS');
for (const row of all('SELECT code, kind, value, course_id, expires_at, max_uses, used_count, is_active FROM coupons ORDER BY id')) {
  console.log(`${row.code} ${row.kind} ${row.value} course=${row.course_id ?? 'all'} expires=${row.expires_at} uses=${row.used_count}/${row.max_uses ?? '∞'} active=${row.is_active}`);
}

console.log('\n=== CERTIFICATES');
for (const row of all('SELECT cert.certificate_id, u.email, c.slug, cert.issued_at, cert.revoked_at FROM certificates cert JOIN users u ON u.id = cert.user_id JOIN courses c ON c.id = cert.course_id ORDER BY cert.id')) {
  console.log(`${row.certificate_id} | ${row.email} | ${row.slug} | issued ${row.issued_at} | revoked ${row.revoked_at ?? 'no'}`);
}

console.log('\n=== QUIZ ATTEMPTS');
for (const row of all(
  `SELECT u.email, l.title, qa.attempt_no, qa.status, qa.score_percent, qa.passed
     FROM quiz_attempts qa JOIN users u ON u.id = qa.user_id JOIN lessons l ON l.id = qa.lesson_id ORDER BY qa.id`,
)) {
  console.log(`${row.email} | ${row.title} | attempt ${row.attempt_no} | ${row.status} | ${row.score_percent ?? 'pending'} | passed=${row.passed}`);
}

console.log('\n=== ASSIGNMENT SUBMISSIONS');
for (const row of all(
  `SELECT u.email, l.title, s.status, s.score, s.max_score FROM assignment_submissions s JOIN users u ON u.id = s.user_id JOIN lessons l ON l.id = s.lesson_id ORDER BY s.id`,
)) {
  console.log(`${row.email} | ${row.title} | ${row.status} | ${row.score ?? '-'}/${row.max_score}`);
}

console.log('\n=== NOTIFICATIONS (unread counts)');
for (const row of all(
  `SELECT u.email, COUNT(*) AS total, SUM(CASE WHEN n.read_at IS NULL THEN 1 ELSE 0 END) AS unread
     FROM notifications n JOIN users u ON u.id = n.user_id GROUP BY u.email`,
)) {
  console.log(`${row.email} | ${row.total} total | ${row.unread} unread`);
}

console.log('\n=== EMAILS IN OUTBOX');
for (const row of all('SELECT id, to_email, subject, template FROM emails ORDER BY id')) {
  console.log(`#${row.id} ${row.subject} -> ${row.to_email} (${row.template})`);
}

console.log('\n=== AUDIT ACTIONS');
for (const row of all('SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action ORDER BY n DESC')) {
  console.log(`${row.action} x${row.n}`);
}

console.log('\n=== GRADING QUEUE SIZE');
console.log(
  one(`SELECT (SELECT COUNT(*) FROM quiz_attempts WHERE status='pending_review') AS quizzes,
               (SELECT COUNT(*) FROM assignment_submissions WHERE status='submitted') AS assignments`),
);
