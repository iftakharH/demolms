import { Laptop, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, timeAgo } from '@/lib/format';
import { revokeSessionAction } from '@/lib/actions/session-actions';
import { logoutAllAction } from '@/lib/actions/auth-actions';
import type { SessionView } from '@/lib/queries/sessions';

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

/**
 * "Devices signed in" card: one row per live session, with per-device sign-out.
 * Shared by the learner profile and the admin account settings page.
 */
export function SessionsCard({ sessions }: { sessions: SessionView[] }) {
  return (
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
        {sessions.length === 0 ? <li className="px-4 py-3 text-sm text-ink-500">No other sessions.</li> : null}
      </ul>
    </section>
  );
}
