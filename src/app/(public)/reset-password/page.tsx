import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthCard } from '@/components/auth/auth-card';
import { queryOne } from '@/lib/db';
import { sha256 } from '@/lib/ids';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
};

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';

  const valid = token
    ? queryOne<{ id: number }>(
        `SELECT id FROM auth_tokens
          WHERE kind = 'reset_password' AND token_hash = ? AND used_at IS NULL
            AND expires_at > datetime('now')`,
        sha256(token),
      )
    : undefined;

  if (!valid) {
    return (
      <AuthCard
        title="That link is not valid"
        subtitle="Reset links expire after an hour and can only be used once."
        footer={
          <Link href="/forgot-password" className="link">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-ink-600">
          Open the most recent reset email from the outbox, or request a fresh link.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/forgot-password" className="btn-primary">
            Request a new link
          </Link>
          <Link href="/login" className="btn-secondary">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={token} />;
}
