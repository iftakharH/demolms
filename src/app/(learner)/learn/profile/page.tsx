import type { Metadata } from 'next';
import Link from 'next/link';
import { activeSessionCount, currentSessionTokenHash, requireUser } from '@/lib/auth';
import { ChangePasswordForm, ProfileForm } from '@/components/learner/profile-forms';
import { SessionsCard } from '@/components/account/sessions-card';
import { listSessions } from '@/lib/queries/sessions';
import { Badge } from '@/components/ui/badge';
import { FlashToast } from '@/components/ui/flash-toast';
import { formatDate } from '@/lib/format';
import { logoutAllAction } from '@/lib/actions/auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage({ searchParams }: PageProps<'/learn/profile'>) {
  const user = await requireUser('/learn/profile');
  const params = await searchParams;

  const tokenHash = await currentSessionTokenHash();
  const sessions = listSessions(user.id, tokenHash);
  const sessionTotal = activeSessionCount(user.id);

  return (
    <div className="space-y-6">
      <FlashToast code={typeof params.flash === 'string' ? params.flash : null} />

      <div>
        <h1 className="page-title">Profile and settings</h1>
        <p className="mt-1 text-sm text-ink-500">Your details, how we contact you, and account security.</p>
      </div>

      <div className="card grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Role</p>
          <Badge tone={user.role === 'learner' ? 'brand' : 'info'} className="mt-1.5">
            {user.role}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Email</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800">
            <span className="truncate">{user.email}</span>
            {user.emailVerified ? <Badge tone="success">verified</Badge> : <Badge tone="warning">unverified</Badge>}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Member since</p>
          <p className="mt-1.5 text-sm font-medium text-ink-800">{formatDate(user.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Active sessions</p>
          <p className="mt-1.5 text-sm font-medium text-ink-800">
            {sessionTotal} device{sessionTotal === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <ProfileForm
        name={user.name}
        email={user.email}
        avatarPath={user.avatarPath}
        prefs={user.emailPrefs}
      />

      <SessionsCard sessions={sessions} />

      <ChangePasswordForm />

      <section className="card flex flex-wrap items-center justify-between gap-4 border-danger/30 p-5">
        <div>
          <h2 className="section-title">Sign out of all devices</h2>
          <p className="mt-1 text-sm text-ink-500">
            Ends every session, including this one. Useful after a password reset or on a shared computer.
          </p>
        </div>
        <form action={logoutAllAction}>
          <button type="submit" className="btn-danger">
            Sign out everywhere
          </button>
        </form>
      </section>

      <p className="text-xs text-ink-500">
        Looking for your receipts?{' '}
        <Link href="/learn/orders" className="link">
          Orders and receipts
        </Link>
        .
      </p>
    </div>
  );
}
