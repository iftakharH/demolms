import type { Metadata } from 'next';
import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Audit log · Admin' };

const PER_PAGE = 40;

const ACTION_GROUPS: { label: string; prefix?: string }[] = [
  { label: 'Everything' },
  { label: 'Courses', prefix: 'course.' },
  { label: 'Orders & payments', prefix: 'order.' },
  { label: 'Users & auth', prefix: 'user.' },
  { label: 'Support access', prefix: 'support.' },
  { label: 'Grading', prefix: 'submission.' },
  { label: 'Quizzes', prefix: 'quiz.' },
  { label: 'Certificates', prefix: 'certificate.' },
  { label: 'Coupons', prefix: 'coupon.' },
];

export default async function AdminAuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  await requireStaff('/admin/audit');
  const params = await searchParams;
  const group = typeof params.group === 'string' ? params.group : '';
  const q = typeof params.q === 'string' ? params.q : '';
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1);

  const where: string[] = ['1=1'];
  const values: unknown[] = [];
  const selected = ACTION_GROUPS.find((entry) => entry.label === group);
  if (selected?.prefix) {
    where.push('action LIKE ?');
    values.push(`${selected.prefix}%`);
  }
  if (q) {
    where.push('(LOWER(summary) LIKE ? OR LOWER(actor_email) LIKE ? OR LOWER(entity_id) LIKE ?)');
    const like = `%${q.toLowerCase()}%`;
    values.push(like, like, like);
  }

  const total =
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM audit_log WHERE ${where.join(' AND ')}`, ...values)?.n ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const entries = query<{
    id: number;
    action: string;
    actorEmail: string;
    actorRole: string;
    entityType: string;
    entityId: string;
    summary: string;
    metaJson: string;
    createdAt: string;
  }>(
    `SELECT id, action, actor_email AS actorEmail, actor_role AS actorRole,
            entity_type AS entityType, entity_id AS entityId, summary, meta_json AS metaJson,
            created_at AS createdAt
       FROM audit_log
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    ...values,
    PER_PAGE,
    (page - 1) * PER_PAGE,
  );

  const href = (target: number) => {
    const query2 = new URLSearchParams();
    if (group) query2.set('group', group);
    if (q) query2.set('q', q);
    if (target > 1) query2.set('page', String(target));
    return query2.toString() ? `/admin/audit?${query2}` : '/admin/audit';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Audit log</h1>
        <p className="mt-1 text-sm text-ink-500">
          {total} entr{total === 1 ? 'y' : 'ies'} · append-only. Every admin write, authentication event
          and automatic action (webhooks, certificate issuance) lands here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ACTION_GROUPS.map((entry) => {
            const active = group === entry.label;
            const url = entry.label === 'Everything' ? '/admin/audit' : `/admin/audit?group=${encodeURIComponent(entry.label)}`;
            return (
              <Link
                key={entry.label}
                href={url}
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {entry.label}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/admin/audit" className="ml-auto flex gap-2">
          {group ? <input type="hidden" name="group" value={group} /> : null}
          <label className="sr-only" htmlFor="audit-search">
            Search the audit log
          </label>
          <input
            id="audit-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Summary, actor or entity"
            className="input w-64"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-8" aria-hidden />}
          title="No audit entries match"
          description="Try another filter or clear the search."
        />
      ) : (
        <>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="card flex flex-wrap items-start gap-3 p-4">
                <Avatar name={entry.actorEmail === 'system' ? 'System' : entry.actorEmail} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-700">
                      {entry.action}
                    </code>
                    <Badge tone={entry.actorRole === 'system' ? 'neutral' : 'brand'}>
                      {entry.actorRole === 'system' ? 'automatic' : entry.actorRole}
                    </Badge>
                    {entry.entityType ? (
                      <span className="text-xs text-ink-400">
                        {entry.entityType} #{entry.entityId}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-ink-800">{entry.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {entry.actorEmail} · {formatDateTime(entry.createdAt)} ({timeAgo(entry.createdAt)})
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.6875rem] text-ink-400">{entry.id}</span>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Link
                href={href(Math.max(1, page - 1))}
                className={`btn-secondary btn-sm ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
              >
                Previous
              </Link>
              <span className="text-sm text-ink-500">
                Page {page} of {totalPages}
              </span>
              <Link
                href={href(Math.min(totalPages, page + 1))}
                className={`btn-secondary btn-sm ${page === totalPages ? 'pointer-events-none opacity-40' : ''}`}
              >
                Next
              </Link>
            </div>
          ) : null}
        </>
      )}

      <p className="text-xs text-ink-500">
        The log is read-only by design: there is no endpoint that edits or deletes entries, including
        for admins.
      </p>
    </div>
  );
}
