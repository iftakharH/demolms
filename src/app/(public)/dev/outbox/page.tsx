import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Inbox } from 'lucide-react';
import { query } from '@/lib/db';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email outbox (dev)',
  robots: { index: false },
};

interface EmailRow {
  id: number;
  to_email: string;
  subject: string;
  template: string;
  read_at: string | null;
  created_at: string;
}

export default async function OutboxPage() {
  const emails = query<EmailRow>(
    'SELECT id, to_email, subject, template, read_at, created_at FROM emails ORDER BY created_at DESC, id DESC LIMIT 200',
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the site
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">Email outbox</h1>
        <p className="mt-1 text-sm text-ink-500">
          Every email the app would have sent. Nothing leaves this machine - links inside the emails
          work exactly like the real thing.
        </p>
      </div>

      {emails.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-8" aria-hidden />}
          title="No emails yet"
          description="Register an account, buy a course or request a password reset and the emails will appear here."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {emails.map((email) => (
            <Link
              key={email.id}
              href={`/dev/outbox/${email.id}`}
              className="flex items-start justify-between gap-4 px-4 py-3.5 transition hover:bg-ink-50 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{email.subject}</p>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  To {email.to_email} · {email.template}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-ink-500">{timeAgo(email.created_at)}</p>
                {!email.read_at ? (
                  <span className="mt-1 inline-block size-2 rounded-full bg-brand-500" aria-label="unread" />
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
