import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { queryOne, run } from '@/lib/db';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email (dev outbox)',
  robots: { index: false },
};

interface EmailRow {
  id: number;
  to_email: string;
  subject: string;
  template: string;
  body_html: string;
  created_at: string;
  read_at: string | null;
}

export default async function OutboxEmailPage({ params }: PageProps<'/dev/outbox/[id]'>) {
  const { id } = await params;
  const emailId = Number.parseInt(id, 10);
  if (!Number.isFinite(emailId)) notFound();

  const email = queryOne<EmailRow>('SELECT * FROM emails WHERE id = ?', emailId);
  if (!email) notFound();

  if (!email.read_at) {
    run("UPDATE emails SET read_at = datetime('now') WHERE id = ?", email.id);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link href="/dev/outbox" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the outbox
        </Link>
        <span className="badge bg-ink-100 text-ink-600">
          <Clock className="size-3.5" aria-hidden />
          {formatDateTime(email.created_at)}
        </span>
      </div>

      <div className="card mb-4 px-5 py-4">
        <dl className="grid gap-1 text-sm sm:grid-cols-[7rem_1fr]">
          <dt className="font-medium text-ink-500">To</dt>
          <dd className="text-ink-800">{email.to_email}</dd>
          <dt className="font-medium text-ink-500">Subject</dt>
          <dd className="text-ink-800">{email.subject}</dd>
          <dt className="font-medium text-ink-500">Template</dt>
          <dd className="font-mono text-xs text-ink-600">{email.template}</dd>
        </dl>
      </div>

      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
      </div>

      <p className="mt-4 text-xs text-ink-500">
        Links inside this email are live: clicking one performs the real action (verifying an
        address, resetting a password, opening a receipt).
      </p>
    </div>
  );
}
