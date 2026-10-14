/**
 * Email "templates" for the mock mailer. Every email is rendered to HTML and
 * written to the emails table - nothing is ever sent over the network.
 * Links are app-relative on purpose: the outbox viewer opens them in place.
 */
import { formatDate, formatPence, timeAgo } from './format';

export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f7f7fb;font-family:Segoe UI,Arial,sans-serif;color:#2e2c3a">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #e8e7f0;border-radius:16px;overflow:hidden">
    <div style="background:#171631;padding:20px 28px">
      <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:.2px">demo<span style="color:#a99bf7">lms</span></span>
      <span style="float:right;color:#a99bf7;font-size:11px;text-transform:uppercase;letter-spacing:.12em;padding-top:4px">Demo outbox</span>
    </div>
    <div style="padding:28px">
      <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#f8f8fb;border-top:1px solid #e8e7f0;color:#7c7a8c;font-size:12px">
      This email was written to the local outbox by the demo LMS. No real email is ever sent.
    </div>
  </div>
</body></html>`;
}

export function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${text}</p>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#6c4cf1;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600;font-size:14px">${label}</a></p>`;
}

export function small(text: string): string {
  return `<p style="margin:0 0 14px;color:#7c7a8c;font-size:12px;line-height:1.5">${text}</p>`;
}

export function infoBox(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row) =>
        `<tr><td style="padding:7px 0;color:#7c7a8c;font-size:13px">${row.label}</td>` +
        `<td style="padding:7px 0;text-align:right;font-size:13px;font-weight:600">${row.value}</td></tr>`,
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e8e7f0;border-bottom:1px solid #e8e7f0;margin:0 0 18px">${cells}</table>`;
}

export type EmailPref = 'transactional' | 'receipts' | 'grades' | 'certificates' | 'marketing';

export interface RenderedEmail {
  template: string;
  subject: string;
  title: string;
  bodyHtml: string;
  pref: EmailPref;
}

/* ------------------------------------------------------------------ builders */

export function verifyEmail(opts: { name: string; url: string }): RenderedEmail {
  return {
    template: 'verify_email',
    pref: 'transactional',
    subject: 'Confirm your email address',
    title: `Welcome to demolms, ${opts.name.split(' ')[0]}`,
    bodyHtml:
      p('One click and your account is ready. This link is valid for 24 hours.') +
      button(opts.url, 'Verify my email') +
      small('If you did not create an account, you can safely ignore this email.'),
  };
}

export function welcomeLearner(opts: { name: string }): RenderedEmail {
  return {
    template: 'welcome',
    pref: 'transactional',
    subject: 'Welcome to demolms',
    title: `Welcome to demolms, ${opts.name.split(' ')[0]}`,
    bodyHtml:
      p('Your account is verified and ready. Two suggestions to get started:') +
      p(
        'Start with <strong>JavaScript Fundamentals</strong> - it is free, forever. ' +
          'Or browse the catalogue and use coupon <strong>WELCOME10</strong> for 10% off your first paid course.',
      ) +
      button('/courses', 'Browse courses'),
  };
}

export function resetPassword(opts: { name: string; url: string }): RenderedEmail {
  return {
    template: 'reset_password',
    pref: 'transactional',
    subject: 'Reset your password',
    title: 'Reset your password',
    bodyHtml:
      p(`We received a request to reset the password for ${opts.name}'s demolms account.`) +
      button(opts.url, 'Choose a new password') +
      small('This link expires in 1 hour. If you did not ask for it, no action is needed.'),
  };
}

export function passwordChanged(opts: { name: string }): RenderedEmail {
  return {
    template: 'password_changed',
    pref: 'transactional',
    subject: 'Your password was changed',
    title: 'Your password was changed',
    bodyHtml:
      p(`Hi ${opts.name.split(' ')[0]}, your demolms password was just changed.`) +
      small('If this was not you, use the forgot-password flow immediately to reset it again.'),
  };
}

export function receipt(opts: {
  name: string;
  orderPublicId: string;
  courseTitle: string;
  subtotalPence: number;
  discountPence: number;
  totalPence: number;
  couponCode: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  paidAt: string | null;
}): RenderedEmail {
  const rows = [{ label: 'Course', value: opts.courseTitle }];
  if (opts.couponCode) {
    rows.push({ label: `Coupon (${opts.couponCode})`, value: `-${formatPence(opts.discountPence)}` });
  }
  rows.push({ label: 'Total paid', value: formatPence(opts.totalPence) });
  if (opts.cardLast4) {
    rows.push({ label: 'Card', value: `${opts.cardBrand ?? 'Card'} ending ${opts.cardLast4}` });
  }
  rows.push({ label: 'Order', value: opts.orderPublicId });
  return {
    template: 'receipt',
    pref: 'receipts',
    subject: `Your receipt for ${opts.courseTitle}`,
    title: `Receipt: ${opts.courseTitle}`,
    bodyHtml:
      p(`Thank you, ${opts.name.split(' ')[0]}. Your payment went through and your course is unlocked.`) +
      infoBox(rows) +
      button('/learn/orders', 'View orders and receipts'),
  };
}

export function refundProcessed(opts: {
  name: string;
  orderPublicId: string;
  courseTitle: string;
  amountPence: number;
  partial: boolean;
  accessRevoked: boolean;
}): RenderedEmail {
  return {
    template: 'refund_processed',
    pref: 'receipts',
    subject: `Refund processed: ${formatPence(opts.amountPence)}`,
    title: 'Refund processed',
    bodyHtml:
      p(
        `We have refunded <strong>${formatPence(opts.amountPence)}</strong> for ${opts.courseTitle} ` +
          `(order ${opts.orderPublicId}).${opts.partial ? ' This was a partial refund.' : ''}`,
      ) +
      p('Card refunds usually arrive within 5 working days.') +
      (opts.accessRevoked
        ? p('Access to the refunded course has been removed, as shown in your orders.')
        : small('Your access to the course is unchanged, because the instructor allowed it to continue.')) +
      button('/learn/orders', 'View orders'),
  };
}

export function assignmentGraded(opts: {
  name: string;
  courseTitle: string;
  assignmentTitle: string;
  score: number;
  maxScore: number;
  feedback: string;
  resubmissionRequested: boolean;
}): RenderedEmail {
  return {
    template: 'assignment_graded',
    pref: 'grades',
    subject: `Your assignment was graded: ${opts.score}/${opts.maxScore}`,
    title: opts.resubmissionRequested
      ? `Resubmission requested: ${opts.assignmentTitle}`
      : `Assignment graded: ${opts.score}/${opts.maxScore}`,
    bodyHtml:
      p(
        `Your submission for <strong>${opts.assignmentTitle}</strong> in ${opts.courseTitle} has been reviewed.`,
      ) +
      (opts.feedback ? p(`<em>${opts.feedback}</em>`) : '') +
      (opts.resubmissionRequested
        ? p('Your instructor has asked for a resubmission. Open the lesson to submit an updated version.')
        : p(`You scored <strong>${opts.score} / ${opts.maxScore}</strong>.`)) +
      button('/learn/grades', 'See your feedback'),
  };
}

export function assignmentReceived(opts: {
  courseTitle: string;
  assignmentTitle: string;
}): RenderedEmail {
  return {
    template: 'assignment_received',
    pref: 'grades',
    subject: 'We received your assignment',
    title: 'Submission received',
    bodyHtml:
      p(
        `Your assignment <strong>${opts.assignmentTitle}</strong> for ${opts.courseTitle} is in the grading queue. ` +
          'You will get an email as soon as it has been reviewed.',
      ) + button('/learn/grades', 'Track your grades'),
  };
}

export function quizPendingReview(opts: { courseTitle: string; lessonTitle: string }): RenderedEmail {
  return {
    template: 'quiz_pending_review',
    pref: 'grades',
    subject: 'Your quiz is awaiting manual review',
    title: 'Quiz submitted - one answer needs a human',
    bodyHtml:
      p(
        `Thanks for submitting <strong>${opts.lessonTitle}</strong>. Your automatically marked answers ` +
          'have been scored instantly. The written answer needs a human, and your instructor will review it shortly.',
      ) + button('/learn/grades', 'View your attempt'),
  };
}

export function quizReviewed(opts: {
  courseTitle: string;
  lessonTitle: string;
  scorePercent: number;
  passed: boolean;
}): RenderedEmail {
  return {
    template: 'quiz_reviewed',
    pref: 'grades',
    subject: `Quiz reviewed: ${opts.scorePercent}%`,
    title: `Quiz reviewed: ${opts.scorePercent}%`,
    bodyHtml:
      p(
        `Your instructor has finished reviewing <strong>${opts.lessonTitle}</strong> in ${opts.courseTitle}.`,
      ) +
      (opts.passed
        ? p('Outcome: <strong style="color:#0f9d6e">passed</strong>. Well done.')
        : p('Outcome: <strong style="color:#dc2626">not passed</strong>. You can review the attempt and try again.')) +
      button('/learn/grades', 'Review your answers'),
  };
}

export function certificateIssued(opts: {
  name: string;
  courseTitle: string;
  certificateId: string;
  issuedAt: string;
}): RenderedEmail {
  return {
    template: 'certificate_issued',
    pref: 'certificates',
    subject: `Your certificate for ${opts.courseTitle}`,
    title: 'Certificate issued',
    bodyHtml:
      p(
        `Congratulations ${opts.name.split(' ')[0]} - you completed <strong>${opts.courseTitle}</strong>. ` +
          `Your certificate (${opts.certificateId}) was issued on ${formatDate(opts.issuedAt)}.`,
      ) +
      button(`/verify/${opts.certificateId}`, 'View and download') +
      small('Anyone can verify this certificate at the public verification page linked above.'),
  };
}

export function coursePublishedAnnouncement(opts: {
  name: string;
  courseTitle: string;
  courseSlug: string;
  summary: string;
}): RenderedEmail {
  return {
    template: 'course_announcement',
    pref: 'marketing',
    subject: `New course: ${opts.courseTitle}`,
    title: `New course: ${opts.courseTitle}`,
    bodyHtml:
      p(`Hi ${opts.name.split(' ')[0]}, a new course was just published:`) +
      p(`<strong>${opts.courseTitle}</strong><br/>${opts.summary}`) +
      button(`/courses/${opts.courseSlug}`, 'Take a look'),
  };
}

export function mfaEnabled(opts: { name: string; enabledAt: string }): RenderedEmail {
  return {
    template: 'mfa_enabled',
    pref: 'transactional',
    subject: 'Two-factor authentication is on',
    title: 'Two-factor authentication enabled',
    bodyHtml:
      p(
        `Two-factor authentication was enabled for your account (${opts.name}) on ` +
          `${timeAgo(opts.enabledAt)}. You will now be asked for a code when you sign in.`,
      ) + small('If this was not you, reset your password immediately.'),
  };
}
