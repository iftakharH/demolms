import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MfaForm } from '@/components/auth/mfa-form';
import { getMfaPendingUser } from '@/lib/auth';
import { findUserById } from '@/lib/auth';
import { currentTotp, secondsUntilNextCode } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Two-factor authentication',
  robots: { index: false },
};

export default async function MfaPage({ searchParams }: PageProps<'/login/mfa'>) {
  const params = await searchParams;
  const pending = await getMfaPendingUser();
  if (!pending) redirect('/login');

  const next = typeof params.next === 'string' ? params.next : undefined;
  const user = findUserById(pending.id);
  const devCode = user?.totp_secret ? currentTotp(user.totp_secret) : null;

  return (
    <MfaForm next={next} devCode={devCode} secondsLeft={secondsUntilNextCode()} />
  );
}
