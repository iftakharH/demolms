import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { ResendVerificationForm } from '@/components/auth/resend-verification-form';
import { getCurrentUser } from '@/lib/auth';
import { DEV_TOOLS } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Check your email',
  robots: { index: false },
};

export default async function VerifyNoticePage({ searchParams }: PageProps<'/verify-email/notice'>) {
  const params = await searchParams;
  const emailParam = typeof params.email === 'string' ? params.email : undefined;
  const user = await getCurrentUser();
  const email = emailParam ?? user?.email;

  return (
    <AuthCard
      title="One more step"
      subtitle={email ? `We wrote a verification link for ${email}.` : 'We wrote a verification link.'}
      footer={
        <Link href="/dashboard" className="link">
          Skip for now - go to the dashboard
        </Link>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-ink-50 p-4 text-sm text-ink-700">
        <Mail className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
        <p>
          In this demo emails are never sent. Open the{' '}
          <Link href="/dev/outbox" className="link">
            email outbox
          </Link>{' '}
          and click the verification link there - it works exactly like a real one.
        </p>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
          Did not arrive? Send another
        </p>
        <ResendVerificationForm email={email} />
      </div>

      {DEV_TOOLS ? (
        <div className="mt-5 flex gap-2">
          <Link href="/dev/outbox" className="btn-primary w-full">
            Open the email outbox
          </Link>
        </div>
      ) : null}
    </AuthCard>
  );
}
