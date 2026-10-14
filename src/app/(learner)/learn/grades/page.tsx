import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, ClipboardCheck, FileCheck2, MessageSquareQuote } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { learnerGrades, type GradeItem } from '@/lib/queries/assessment';
import { Badge, SubmissionStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressRing } from '@/components/ui/progress';
import { formatPercent, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Grades and feedback' };

const TABS = [
  { value: 'all', label: 'Everything' },
  { value: 'graded', label: 'Graded' },
  { value: 'pending', label: 'Awaiting review' },
] as const;

function statusOf(item: GradeItem): 'graded' | 'pending' {
  return item.status === 'graded' ? 'graded' : 'pending';
}

export default async function GradesPage({ searchParams }: PageProps<'/learn/grades'>) {
  const user = await requireUser('/learn/grades');
  const params = await searchParams;
  const filter = typeof params.filter === 'string' ? params.filter : 'all';

  const items = learnerGrades(user.id);
  const graded = items.filter((item) => statusOf(item) === 'graded');
  const pending = items.filter((item) => statusOf(item) === 'pending');

  const shown = filter === 'graded' ? graded : filter === 'pending' ? pending : items;

  const averageScore =
    graded.length > 0
      ? Math.round((graded.reduce((sum, item) => sum + (item.percent ?? 0), 0) / graded.length) * 10) / 10
      : null;

  // group by course so the page reads like a report card
  const byCourse = new Map<string, { courseTitle: string; courseSlug: string; items: GradeItem[] }>();
  for (const item of shown) {
    const group = byCourse.get(item.courseSlug) ?? {
      courseTitle: item.courseTitle,
      courseSlug: item.courseSlug,
      items: [],
    };
    group.items.push(item);
    byCourse.set(item.courseSlug, group);
  }

  const href = (value: string) => (value === 'all' ? '/learn/grades' : `/learn/grades?filter=${value}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Grades and feedback</h1>
          <p className="mt-1 text-sm text-ink-500">
            {graded.length} graded · {pending.length} awaiting review
            {averageScore !== null ? ` · average ${formatPercent(averageScore, 1)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {averageScore !== null ? (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2">
              <ProgressRing percent={averageScore} size={44} stroke={4} />
              <div>
                <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Average</p>
                <p className="text-sm font-semibold text-ink-900">{formatPercent(averageScore, 1)}</p>
              </div>
            </div>
          ) : null}
          <Link href="/learn/certificates" className="btn-secondary btn-sm">
            <Award className="size-4" aria-hidden />
            Certificates
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-8" aria-hidden />}
          title="Nothing graded yet"
          description="Quizzes are marked the moment you submit them. Written answers and assignments come back with feedback."
        >
          <Link href="/learn/my-learning" className="btn-primary">
            Go to my courses
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const count = tab.value === 'graded' ? graded.length : tab.value === 'pending' ? pending.length : items.length;
              const active = filter === tab.value;
              return (
                <Link key={tab.value} href={href(tab.value)} className={`chip ${active ? 'chip-active' : ''}`} aria-current={active ? 'page' : undefined}>
                  {tab.label}
                  <span className={active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
                </Link>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="size-8" aria-hidden />}
              title={filter === 'pending' ? 'Nothing awaiting review' : 'Nothing graded yet'}
              description={
                filter === 'pending'
                  ? 'Your instructor has marked everything you have submitted.'
                  : 'Take a quiz or submit an assignment to see results here.'
              }
            >
              <Link href={href('all')} className="btn-secondary">
                Show everything
              </Link>
            </EmptyState>
          ) : (
            [...byCourse.values()].map((group) => (
              <section key={group.courseSlug} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="section-title truncate">{group.courseTitle}</h2>
                  <Link href={`/learn/courses/${group.courseSlug}`} className="link text-sm">
                    Go to course
                  </Link>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <article key={`${item.kind}-${item.id}`} className="card min-w-0 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="outline">{item.kind === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                            {item.status === 'graded' ? (
                              item.passed === true ? (
                                <Badge tone="success">passed</Badge>
                              ) : item.passed === false ? (
                                <Badge tone="danger">not passed</Badge>
                              ) : (
                                <Badge tone="success">graded</Badge>
                              )
                            ) : (
                              <SubmissionStatusBadge status={item.status} />
                            )}
                            <span className="text-xs text-ink-500">{timeAgo(item.at)}</span>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-ink-900">{item.title}</h3>
                        </div>

                        {item.status === 'graded' ? (
                          <div className="flex items-center gap-3">
                            <ProgressRing
                              percent={item.kind === 'quiz' ? (item.percent ?? 0) : (item.percent ?? 0)}
                              size={54}
                              stroke={5}
                            />
                            <div className="text-right">
                              <p className="text-sm font-semibold text-ink-900">
                                {item.kind === 'quiz'
                                  ? formatPercent(item.score, 1)
                                  : `${item.score} / ${item.maxScore}`}
                              </p>
                              {item.kind === 'assignment' && item.percent !== null ? (
                                <p className="text-xs text-ink-500">{formatPercent(item.percent, 1)}</p>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <Badge tone="warning">with your instructor</Badge>
                        )}
                      </div>

                      {item.feedback ? (
                        <div className="mt-4 flex gap-3 rounded-xl border border-line bg-ink-50 p-4">
                          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                          <div>
                            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                              Instructor feedback
                            </p>
                            <p className="mt-1 text-sm whitespace-pre-wrap text-ink-700">{item.feedback}</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={
                            item.kind === 'quiz'
                              ? `/learn/courses/${item.courseSlug}/quiz/${item.lessonId}${item.status === 'graded' ? `?attempt=${item.id}` : ''}`
                              : `/learn/courses/${item.courseSlug}/assignment/${item.lessonId}`
                          }
                          className="btn-secondary btn-sm"
                        >
                          <FileCheck2 className="size-3.5" aria-hidden />
                          {item.kind === 'quiz'
                            ? item.status === 'graded'
                              ? 'Review answers'
                              : 'View attempt'
                            : 'View submission'}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
