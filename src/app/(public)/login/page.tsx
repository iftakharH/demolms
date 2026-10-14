import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { getCurrentUser } from '@/lib/auth';
import { isStaffRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Sign in to your demolms account.',
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(isStaffRole(user.role) ? '/admin' : '/dashboard');

  const next = typeof params.next === 'string' ? params.next : undefined;

  let notice: { tone: 'info' | 'success'; text: string } | null = null;
  if (params.reset === '1') {
    notice = { tone: 'success', text: 'Your password has been reset. Sign in with your new password.' };
  } else if (params.loggedout === 'all') {
    notice = { tone: 'success', text: 'You have been signed out of every device.' };
  } else if (params.registered === '1') {
    notice = { tone: 'info', text: 'Account created. Check the email outbox to verify your address.' };
  }

  return <LoginForm next={next} notice={notice} />;
}
