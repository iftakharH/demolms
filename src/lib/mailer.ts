import { queryOne, run } from './db';
import { emailShell, type RenderedEmail } from './email-templates';

interface UserPrefRow {
  id: number;
  name: string;
  email_prefs_json: string;
}

/**
 * The one and only "email provider": it writes a row to the emails table.
 * Everything else in the app goes through here, so /dev/outbox is complete
 * by construction.
 */
export function sendMail(to: string, email: RenderedEmail): number {
  const user = queryOne<UserPrefRow>(
    'SELECT id, name, email_prefs_json FROM users WHERE email = ?',
    to,
  );

  if (user && email.pref !== 'transactional') {
    try {
      const prefs = JSON.parse(user.email_prefs_json) as Record<string, boolean>;
      if (prefs[email.pref] === false) {
        return -1; // suppressed by the learner's own preference
      }
    } catch {
      // preferences unreadable: send rather than silently drop
    }
  }

  const info = run(
    `INSERT INTO emails (to_email, to_user_id, template, subject, body_html)
     VALUES (?, ?, ?, ?, ?)`,
    to,
    user?.id ?? null,
    email.template,
    email.subject,
    emailShell(email.title, email.bodyHtml),
  );
  return Number(info.lastInsertRowid);
}

export function userEmail(userId: number): string | null {
  const row = queryOne<{ email: string }>('SELECT email FROM users WHERE id = ?', userId);
  return row?.email ?? null;
}

/** Send to a user id, ignoring a missing/inactive address instead of throwing. */
export function sendMailToUser(userId: number, email: RenderedEmail): void {
  const address = userEmail(userId);
  if (!address) return;
  sendMail(address, email);
}

/** Unread count for the dev outbox badge. */
export function outboxCount(): number {
  const row = queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM emails');
  return row?.n ?? 0;
}
