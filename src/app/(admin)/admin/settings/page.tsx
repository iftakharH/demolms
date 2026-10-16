import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { activeSessionCount, currentSessionTokenHash, requireStaff } from '@/lib/auth';
import { platformSettings } from '@/lib/settings';
import { categoryList } from '@/lib/queries/admin-courses';
import { CategoryManager } from '@/components/admin/category-manager';
import { PlatformSettingsForm } from '@/components/admin/platform-settings-form';
import { ChangePasswordForm, ProfileForm } from '@/components/learner/profile-forms';
import { SessionsCard } from '@/components/account/sessions-card';
import { listSessions } from '@/lib/queries/sessions';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Settings · Admin' };

/**
 * Staff settings: platform controls (admin only), categories, and the signed-in
 * account (profile, password, devices). Auditors see everything read-only.
 */
export default async function AdminSettingsPage({ searchParams }: PageProps<'/admin/settings'>) {
  const user = await requireStaff('/admin/settings');
  const query = await searchParams;
  const canWrite = user.role === 'admin';

  const settings = platformSettings();
  const categories = categoryList();

  const tokenHash = await currentSessionTokenHash();
  const sessions = listSessions(user.id, tokenHash);
  const sessionTotal = activeSessionCount(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Platform controls, the catalogue&apos;s categories, and your staff account.
        </p>
      </div>

      {query.saved === '1' ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-strong">
          Saved.{' '}
          {typeof query.moved === 'string'
            ? `${query.moved} course${query.moved === '1' ? '' : 's'} moved to uncategorised.`
            : ''}
        </p>
      ) : null}
      {typeof query.error === 'string' ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {query.error}
        </p>
      ) : null}

      {canWrite ? (
        <PlatformSettingsForm values={settings} />
      ) : (
        <section className="card p-5 sm:p-6">
          <h2 className="section-title">Platform controls</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Announcement</dt>
              <dd className="mt-1 text-ink-800">
                {settings.announcementEnabled && settings.announcementText
                  ? settings.announcementText
                  : 'off'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Enrolments</dt>
              <dd className="mt-1 text-ink-800">{settings.enrolmentsPaused ? 'paused' : 'open'}</dd>
            </div>
          </dl>
        </section>
      )}

      <CategoryManager categories={categories} canWrite={canWrite} />

      <section className="card p-5 sm:p-6">
        <h2 className="section-title">Your account</h2>
        <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Role</p>
            <Badge tone="info" className="mt-1.5">
              {user.role}
            </Badge>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Email</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800">
              <span className="truncate">{user.email}</span>
              {user.emailVerified ? <Badge tone="success">verified</Badge> : null}
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
      </section>

      <ProfileForm
        name={user.name}
        email={user.email}
        avatarPath={user.avatarPath}
        prefs={user.emailPrefs}
        showPrefs={false}
      />

      <ChangePasswordForm />

      <section className="card p-5 sm:p-6">
        <h2 className="section-title flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-600" aria-hidden />
          Two-factor authentication
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {user.totpConfirmed ? (
            <Badge tone="success">enabled</Badge>
          ) : (
            <Badge tone="warning">not set up</Badge>
          )}
          <p className="text-sm text-ink-500">
            {user.totpConfirmed
              ? 'Signing in asks for a 6-digit code after the password.'
              : 'This demo account has no TOTP secret yet.'}
          </p>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          In this local demo the TOTP secret comes from the seed data and the login screen shows the
          current valid code while dev tools are on.
        </p>
      </section>

      <SessionsCard sessions={sessions} />
    </div>
  );
}
