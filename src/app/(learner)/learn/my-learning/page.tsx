import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Check, GraduationCap, PlayCircle, Search, SearchX } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { enrolledCourses } from '@/lib/queries/learner';
import { learnerCourseSummary } from '@/lib/progress';
import { ProgressRing } from '@/components/ui/progress';
import { SortSelect } from '@/components/ui/sort-select';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { fileUrl } from '@/lib/file-url';
import { formatDuration, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'My learning' };

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not-started', label: 'Not started' },
] as const;

const SORTS = [
  { value: 'recent', label: 'Recently studied' },
  { value: 'progress', label: 'Furthest along' },
  { value: 'title', label: 'Title A-Z' },
] as const;

export default async function MyLearningPage({ searchParams }: PageProps<'/learn/my-learning'>) {
  const user = await requireUser('/learn/my-learning');
  const params = await searchParams;

  const filter = typeof params.filter === 'string' ? params.filter : 'all';
  const sort = typeof params.sort === 'string' ? params.sort : 'recent';
  const search = typeof params.q === 'string' ? params.q.trim() : '';

  const all = enrolledCourses(user.id);

  const counts = {
    all: all.length,
    progress: all.filter((course) => course.percent > 0 && course.percent < 100).length,
    completed: all.filter((course) => course.percent >= 100).length,
    'not-started': all.filter((course) => course.percent === 0).length,
  };

  const filtered = all
    .filter((course) => {
      if (filter === 'progress') return course.percent > 0 && course.percent < 100;
      if (filter === 'completed') return course.percent >= 100;
      if (filter === 'not-started') return course.percent === 0;
      return true;
    })
    .filter((course) => (search ? course.title.toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => {
      if (sort === 'progress') return b.percent - a.percent;
      if (sort === 'title') return a.title.localeCompare(b.title);
      const aTime = a.lastActivityAt ?? a.enrolledAt;
      const bTime = b.lastActivityAt ?? b.enrolledAt;
      return bTime.localeCompare(aTime);
    });

  const inProgressSummary = all
    .filter((course) => course.percent > 0 && course.percent < 100)
    .reduce((sum, course) => sum + course.remainingMinutes, 0);

  const href = (next: Partial<{ filter: string; sort: string; q: string }>) => {
    const query = new URLSearchParams();
    const merged = { filter, sort, q: search, ...next };
    if (merged.filter && merged.filter !== 'all') query.set('filter', merged.filter);
    if (merged.sort && merged.sort !== 'recent') query.set('sort', merged.sort);
    if (merged.q) query.set('q', merged.q);
    return query.toString() ? `/learn/my-learning?${query}` : '/learn/my-learning';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">My learning</h1>
          <p className="mt-1 text-sm text-ink-500">
            {counts.all} course{counts.all === 1 ? '' : 's'} · {counts.progress} in progress ·{' '}
            {counts.completed} completed
            {inProgressSummary > 0 ? ` · ${formatDuration(inProgressSummary)} of material left` : ''}
          </p>
        </div>
        <Link href="/courses" className="btn-secondary btn-sm">
          Add another course
        </Link>
      </div>

      {(all.length > 0) ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const active = filter === tab.value;
              const count = counts[tab.value];
              return (
                <Link
                  key={tab.value}
                  href={href({ filter: tab.value })}
                  className={`chip ${active ? 'chip-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.label}
                  <span className={active ? 'text-white/70' : 'text-ink-400'}>{count}</span>
                </Link>
              );
            })}
          </div>

          <form method="get" action="/learn/my-learning" className="ml-auto flex flex-wrap gap-2">
            {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
            {sort !== 'recent' ? <input type="hidden" name="sort" value={sort} /> : null}
            <label className="sr-only" htmlFor="learning-search">
              Search your courses
            </label>
            <div className="relative">
              <input
                id="learning-search"
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Search my courses"
                className="input w-56 pl-9"
              />
              <Search className="absolute top-3 left-3 size-4 text-ink-400" aria-hidden />
            </div>
            <SortSelect
              name="sort"
              defaultValue={sort}
              id="learning-sort"
              label="Sort my courses"
              options={SORTS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </form>
        </div>
      ) : null}

      {all.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" aria-hidden />}
          title="No enrolments yet"
          description="Two courses are free forever - start with JavaScript Fundamentals or SQL for Analysts."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/courses?price=free" className="btn-primary">
              Browse free courses
            </Link>
            <Link href="/courses" className="btn-secondary">
              See everything
            </Link>
          </div>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-8" aria-hidden />}
          title={search ? `No course matches "${search}"` : 'Nothing in this tab yet'}
          description={search ? 'Try a shorter search term.' : 'Switch tabs to see your other courses.'}
        >
          <Link href="/learn/my-learning" className="btn-secondary">
            Clear filters
          </Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => {
            const summary = learnerCourseSummary(user.id, course.courseId);
            const completed = course.percent >= 100;
            return (
              <article key={course.courseId} className="card card-hover animate-rise flex flex-col overflow-hidden">
                <div className="relative">
                  <Link href={`/learn/courses/${course.slug}`} className="block aspect-[16/9] overflow-hidden bg-ink-100">
                    {course.thumbnailPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local static asset
                      <img src={fileUrl(course.thumbnailPath)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </Link>
                  <div className="absolute right-3 bottom-3 rounded-full bg-surface/95 p-1 shadow-sm">
                    <ProgressRing percent={course.percent} size={46} stroke={4} />
                  </div>
                  {completed ? (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-semibold text-white shadow-sm">
                      <Check className="size-3" aria-hidden />
                      Completed
                    </span>
                  ) : course.percent === 0 ? (
                    <span className="absolute top-3 left-3">
                      <Badge tone="neutral">Not started</Badge>
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-[0.9375rem] leading-snug font-semibold text-ink-900">
                    <Link href={`/learn/courses/${course.slug}`} className="hover:text-brand-700">
                      {course.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    {course.instructorName} · {course.level}
                  </p>

                  <p className="mt-3 text-xs text-ink-500">
                    {course.completedLessons}/{course.totalLessons} lessons
                    {course.remainingMinutes > 0 ? ` · ${formatDuration(course.remainingMinutes)} left` : ''}
                  </p>
                  {summary.nextLesson && !completed ? (
                    <p className="mt-1 truncate text-xs text-ink-500">
                      Up next: <span className="font-medium text-ink-700">{summary.nextLesson.title}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-400">
                      {course.lastActivityAt ? `Last studied ${timeAgo(course.lastActivityAt)}` : 'Ready when you are'}
                    </p>
                  )}

                  <div className="mt-auto space-y-2 pt-4">
                    <Link href={`/learn/courses/${course.slug}`} className="btn-primary btn-sm w-full">
                      <PlayCircle className="size-3.5" aria-hidden />
                      {completed ? 'Revisit course' : course.percent > 0 ? 'Continue learning' : 'Start learning'}
                    </Link>
                    <div className="flex gap-2">
                      <Link href={`/courses/${course.slug}`} className="btn-secondary btn-sm flex-1 justify-center">
                        Details
                      </Link>
                      {summary.certificateId ? (
                        <Link
                          href={`/learn/certificates/${summary.certificateId}`}
                          className="btn-secondary btn-sm flex-1 justify-center"
                        >
                          <Award className="size-3.5" aria-hidden />
                          Certificate
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
