import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, FileText, HelpCircle } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { gradingQueue } from '@/lib/queries/assessment';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Grading queue · Admin' };

export default async function GradingQueuePage() {
  await requireStaff('/admin/grading');
  const queue = gradingQueue();

  const quizzes = queue.filter((item) => item.kind === 'quiz');
  const assignments = queue.filter((item) => item.kind === 'assignment');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Grading queue</h1>
        <p className="mt-1 text-sm text-ink-500">
          {queue.length} item{queue.length === 1 ? '' : 's'} waiting for a human: written quiz answers
          and assignment submissions. Grading sends the learner an in-app notification and an email.
        </p>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-8" aria-hidden />}
          title="Queue is empty"
          description="Everything submitted has been marked. New submissions appear here the moment a learner sends them."
        />
      ) : (
        <>
          <QueueSection
            title="Written quiz answers"
            icon={<HelpCircle className="size-4" aria-hidden />}
            items={quizzes}
            hrefFor={(item) => `/admin/grading/quiz/${item.id}`}
          />
          <QueueSection
            title="Assignment submissions"
            icon={<FileText className="size-4" aria-hidden />}
            items={assignments}
            hrefFor={(item) => `/admin/grading/assignment/${item.id}`}
          />
        </>
      )}
    </div>
  );
}

function QueueSection({
  title,
  icon,
  items,
  hrefFor,
}: {
  title: string;
  icon: React.ReactNode;
  items: Awaited<ReturnType<typeof gradingQueue>>;
  hrefFor: (item: Awaited<ReturnType<typeof gradingQueue>>[number]) => string;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="section-title mb-3 flex items-center gap-2">
        <span className="text-brand-600">{icon}</span>
        {title}
        <span className="badge bg-ink-100 text-ink-600">{items.length}</span>
      </h2>
      <ul className="card divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{item.lessonTitle}</p>
              <p className="truncate text-xs text-ink-500">
                {item.courseTitle} · {item.userName} ({item.userEmail})
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {item.detail} · submitted {timeAgo(item.submittedAt)}
              </p>
            </div>
            <Badge tone="warning">waiting</Badge>
            <Link href={hrefFor(item)} className="btn-primary btn-sm">
              Grade
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
