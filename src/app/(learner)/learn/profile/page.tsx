import type { Metadata } from 'next';
import Link from 'next/link';
import { Laptop, ShieldCheck, Trash2 } from 'lucide-react';
import { activeSessionCount, currentSessionTokenHash, requireUser } from '@/lib/auth';
import { ChangePasswordForm, ProfileForm } from '@/components/learner/profile-forms';
import { listSessions } from '@/lib/queries/sessions';
import { revokeSessionAction } from '@/lib/actions/session-actions';
import { Badge } from '@/components/ui/badge';
import { FlashToast } from '@/components/ui/flash-toast';
import { formatDate, formatDateTime, timeAgo } from '@/lib/format';
import { logoutAllAction } from '@/lib/actions/auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Profile' };

function deviceLabel(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes('edg')
    ? 'Edge'
    : ua.includes('chrome')
      ? 'Chrome'
      : ua.includes('firefox')
        ? 'Firefox'
        : ua.includes('safari')
          ? 'Safari'
          : 'Browser';
  const platform = ua.includes('windows')
    ? 'Windows'
    : ua.includes('mac os')
      ? 'macOS'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('iphone') || ua.includes('ipad')
          ? 'iOS'
          : ua.includes('linux')
            ? 'Linux'
            : 'Unknown platform';
  return `${browser} on ${platform}`;
}

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

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Laptop className="size-4 text-brand-600" aria-hidden />
              Devices signed in
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Each row is a live session. Signing one out takes effect immediately on that device.
            </p>
          </div>
          <form action={logoutAllAction}>
            <button type="submit" className="btn-secondary btn-sm">
              <ShieldCheck className="size-3.5" aria-hidden />
              Sign out everywhere
            </button>
          </form>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {sessions.map((session) => (
            <li key={session.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <Laptop className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800">
                  {deviceLabel(session.userAgent)}
                  {session.isCurrent ? <Badge tone="success">this device</Badge> : null}
                  {session.supportByEmail ? (
                    <Badge tone="warning">support access · {session.supportByEmail}</Badge>
                  ) : null}
                </p>
                <p className="text-xs text-ink-500">
                  Started {timeAgo(session.createdAt)} · expires {formatDateTime(session.expiresAt)}
                  {session.ip ? ` · ${session.ip}` : ''}
                </p>
              </div>
              {session.isCurrent ? (
                <span className="text-xs text-ink-400">current</span>
              ) : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="session_key" value={session.key} />
                  <button type="submit" className="btn-ghost btn-sm text-danger" aria-label="Sign this device out">
                    <Trash2 className="size-3.5" aria-hidden />
                    Sign out
                  </button>
                </form>
              )}
            </li>
          ))}
          {sessions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-500">No other sessions.</li>
          ) : null}
        </ul>
      </section>

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
