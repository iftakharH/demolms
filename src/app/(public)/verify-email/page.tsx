import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgeCheck, MailWarning } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResendVerificationForm } from '@/components/auth/resend-verification-form';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { findUserById, consumeAuthToken } from '@/lib/auth';
import { run } from '@/lib/db';
import { DEV_TOOLS } from '@/lib/env';
import { sendMail } from '@/lib/mailer';
import { notify } from '@/lib/notify';
import { welcomeLearner } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify your email',
  robots: { index: false },
};

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const params = await searchParams;

  if (params.verified === '1') {
    return (
      <AuthCard title="Email verified" subtitle="That address is now confirmed on your account.">
        <div className="flex items-start gap-3 rounded-2xl bg-success-soft p-4 text-sm text-success-strong">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p>Thanks - you are all set. Head to your dashboard to pick up where you left off.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn-primary">
            Go to dashboard
          </Link>
          <Link href="/courses" className="btn-secondary">
            Browse courses
          </Link>
        </div>
      </AuthCard>
    );
  }

  const token = typeof params.token === 'string' ? params.token : '';
  const consumed = token ? consumeAuthToken('verify_email', token) : null;
  const user = consumed ? findUserById(consumed.userId) : undefined;

  if (user) {
    if (!user.email_verified_at) {
      run("UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", user.id);
      logAudit({
        actor: { id: user.id, email: user.email, role: user.role },
        action: AUDIT_ACTIONS.emailVerified,
        entityType: 'user',
        entityId: user.id,
        summary: `Verified email for ${user.email}`,
      });
      sendMail(user.email, welcomeLearner({ name: user.name }));
      notify({
        userId: user.id,
        type: 'welcome',
        title: 'Email verified',
        body: 'Your account is fully active.',
        href: '/courses',
      });
    }
    redirect('/verify-email?verified=1');
  }

  return (
    <AuthCard
      title="This link has expired"
      subtitle="Verification links last 24 hours and can only be used once."
    >
      <div className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning-strong">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p>Request a fresh link below and open it from the email outbox.</p>
      </div>

      <div className="mt-5">
        <ResendVerificationForm />
      </div>

      {DEV_TOOLS ? (
        <p className="mt-4 text-xs text-ink-500">
          Dev mode:{' '}
          <Link href="/dev/outbox" className="link">
            open the email outbox
          </Link>{' '}
          to see the link that was just written.
        </p>
      ) : null}
    </AuthCard>
  );
}
