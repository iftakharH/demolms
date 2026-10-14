import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CirclePlay,
  Clock,
  GraduationCap,
  HelpCircle,
  MailWarning,
  PenLine,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { enrolledCourses, learnerStats } from '@/lib/queries/learner';
import { courseCompletion, learnerCourseSummary, pendingWork, playerLessons } from '@/lib/progress';
import { query } from '@/lib/db';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDuration, formatPercent, timeAgo } from '@/lib/format';
import { fileUrl } from '@/lib/file-url';
import { recentNotifications, unreadCount } from '@/lib/notify';
import { FlashToast } from '@/components/ui/flash-toast';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

const LESSON_ICON = {
  video: CirclePlay,
  text: BookOpen,
  quiz: HelpCircle,
  assignment: PenLine,
} as const;

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }).format(
      new Date(),
    ),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage({
  searchParams,
}: PageProps<'/dashboard'>) {
  const user = await requireUser('/dashboard');
  const params = await searchParams;

  const courses = enrolledCourses(user.id);
  const stats = learnerStats(user.id);
  const pending = pendingWork(user.id, 4);
  const notifications = recentNotifications(user.id, 4);
  const unread = unreadCount(user.id);

  const active =
    courses.find((course) => course.percent > 0 && course.percent < 100) ?? courses.find((course) => course.percent === 0) ?? null;
  const activeSummary = active ? learnerCourseSummary(user.id, active.courseId) : null;
  const activeLessons = active ? playerLessons(user.id, active.courseId) : [];
  const upNext = activeLessons.filter((lesson) => !lesson.completedAt).slice(0, 3);
  const completion = active ? courseCompletion(user.id, active.courseId) : null;

  const latestCertificate = query<{
    certificateId: string;
    courseTitle: string;
    issuedAt: string;
    revokedAt: string | null;
  }>(
    `SELECT cert.certificate_id AS certificateId, c.title AS courseTitle, cert.issued_at AS issuedAt,
            cert.revoked_at AS revokedAt
       FROM certificates cert JOIN courses c ON c.id = cert.course_id
      WHERE cert.user_id = ? AND cert.revoked_at IS NULL
      ORDER BY cert.issued_at DESC LIMIT 1`,
    user.id,
  )[0];

  return (
    <div className="space-y-6">
      <FlashToast code={typeof params.flash === 'string' ? params.flash : null} />

      {/* --------------------------------------------------------------- header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">{formatDate(new Date())}</p>
          <h1 className="page-title mt-1">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {active
              ? `You are ${active.percent}% through ${active.title}.`
              : stats.enrolled > 0
                ? 'Everything you are enrolled on is complete. Time for something new?'
                : 'Nothing enrolled yet - pick something from the catalogue.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/courses" className="btn-secondary btn-sm">
            Browse catalogue
          </Link>
          {latestCertificate ? (
            <Link href="/learn/certificates" className="btn-secondary btn-sm">
              <Award className="size-3.5" aria-hidden />
              Certificates
            </Link>
          ) : null}
        </div>
      </div>

      {!user.emailVerified ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          <MailWarning className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1">
            Verify your email address to unlock everything. The link is in the{' '}
            <Link href="/dev/outbox" className="font-medium underline">
              email outbox
            </Link>
            .
          </p>
          <Link href="/verify-email/notice" className="btn-secondary btn-sm border-amber-300 bg-white">
            Verify now
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* -------------------------------------------------------- continue hero */}
        {active && activeSummary ? (
          <section className="card animate-rise overflow-hidden lg:col-span-1">
            <div className="relative">
              {active.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static asset
                <img
                  src={fileUrl(active.thumbnailPath)}
                  alt=""
                  className="h-40 w-full object-cover sm:h-48"
                />
              ) : (
                <div className="h-40 w-full bg-ink-100 sm:h-48" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
                  {active.percent > 0 ? 'Continue watching' : 'Start learning'}
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold text-white">{active.title}</h2>
                <p className="mt-0.5 truncate text-sm text-white/75">
                  {activeSummary.nextLesson
                    ? `Up next: ${activeSummary.nextLesson.title}`
                    : 'Everything is complete'}
                </p>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <ProgressRing percent={active.percent} size={56} stroke={5} />
                <div className="min-w-0 flex-1 space-y-1 text-sm text-ink-600">
                  <p>
                    <span className="font-medium text-ink-800">
                      {active.completedLessons} of {active.totalLessons} lessons
                    </span>{' '}
                    · {active.percent}%
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                    {active.remainingMinutes > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" aria-hidden />
                        {formatDuration(active.remainingMinutes)} left
                      </span>
                    ) : null}
                    {active.lastActivityAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <TrendingUp className="size-3.5" aria-hidden />
                        Last studied {timeAgo(active.lastActivityAt)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={
                    activeSummary.nextLesson
                      ? `/learn/courses/${active.slug}?lesson=${activeSummary.nextLesson.id}`
                      : `/learn/courses/${active.slug}`
                  }
                  className="btn-primary"
                >
                  <CirclePlay className="size-4" aria-hidden />
                  {active.percent > 0 ? 'Resume lesson' : 'Start lesson one'}
                </Link>
                <Link href={`/courses/${active.slug}`} className="btn-ghost">
                  Course details
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <EmptyState
            icon={<GraduationCap className="size-8" aria-hidden />}
            title={courses.length === 0 ? 'Start your first course' : 'All caught up'}
            description={
              courses.length === 0
                ? 'JavaScript Fundamentals and SQL for Analysts are free forever - no card needed.'
                : 'Every course you are enrolled on is complete. Your certificates are waiting.'
            }
          >
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/courses?price=free" className="btn-primary">
                Browse free courses
              </Link>
              {stats.certificates > 0 ? (
                <Link href="/learn/certificates" className="btn-secondary">
                  View certificates
                </Link>
              ) : null}
            </div>
          </EmptyState>
        )}

        {/* ------------------------------------------------------------- snapshot */}
        <section className="space-y-5">
          <div className="card animate-rise p-5">
            <h2 className="section-title">Your snapshot</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Enrolled</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">{stats.enrolled}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Lessons done</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">{stats.lessonsDone}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Completed</dt>
                <dd className="mt-1 text-2xl font-semibold text-ink-900">{stats.completed}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">Certificates</dt>
                <dd className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink-900">
                  {stats.certificates}
                  {stats.certificates > 0 ? <Award className="size-5 text-brand-600" aria-hidden /> : null}
                </dd>
              </div>
            </dl>
            {completion ? (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
                Course requirements:{' '}
                <span className="font-medium text-ink-700">
                  {completion.lessonsDone ? 'lessons done' : 'lessons remaining'}
                </span>
                {completion.quizRequirementMet ? ' · quizzes passed' : ''}
                {completion.assignmentRequirementMet ? ' · assignments graded' : ''}
              </p>
            ) : null}
          </div>

          {latestCertificate ? (
            <div className="card animate-rise flex items-start gap-4 p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Award className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Latest award</p>
                <p className="mt-1 truncate text-sm font-medium text-ink-900">{latestCertificate.courseTitle}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Issued {timeAgo(latestCertificate.issuedAt)} · {latestCertificate.certificateId}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/learn/certificates/${latestCertificate.certificateId}`} className="btn-secondary btn-sm">
                    View
                  </Link>
                  <a
                    href={`/api/certificates/${latestCertificate.certificateId}/pdf`}
                    className="btn-ghost btn-sm"
                  >
                    PDF
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------------- up next */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Up next</h2>
            {active ? (
              <Link
                href={`/learn/courses/${active.slug}`}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Open course
              </Link>
            ) : null}
          </div>

          {upNext.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              Nothing queued. {courses.length > 0 ? 'Pick a course from My learning.' : 'Enrol to get started.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {upNext.map((lesson, index) => {
                const Icon = LESSON_ICON[lesson.type];
                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/learn/courses/${active!.slug}?lesson=${lesson.id}`}
                      className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-800">{lesson.title}</span>
                        <span className="block text-xs text-ink-500">
                          {index === 0 ? 'Next up · ' : ''}
                          {lesson.sectionTitle}
                          {lesson.durationMinutes > 0 ? ` · ${formatDuration(lesson.durationMinutes)}` : ''}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink-400" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------- needs your attention */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Needs your attention</h2>
            {pending.length > 0 ? (
              <Badge tone="warning">{pending.length} item{pending.length === 1 ? '' : 's'}</Badge>
            ) : null}
          </div>
          {pending.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              Nothing waiting on you. Quizzes are marked instantly; essays and assignments come back with
              written feedback.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pending.map((item) => (
                <li key={`${item.kind}-${item.lessonId}`} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                    {item.kind === 'quiz' ? (
                      <HelpCircle className="size-4" aria-hidden />
                    ) : (
                      <PenLine className="size-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{item.lessonTitle}</p>
                    <p className="truncate text-xs text-ink-500">
                      {item.courseTitle} · {item.detail}
                    </p>
                  </div>
                  <Link
                    href={`/learn/courses/${item.courseSlug}?lesson=${item.lessonId}`}
                    className="btn-ghost btn-sm"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* --------------------------------------------------------- my learning */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">My learning</h2>
            <Link href="/learn/my-learning" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-4">
            {courses.slice(0, 3).map((course) => (
              <li key={course.courseId} className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/learn/courses/${course.slug}`}
                    className="min-w-0 truncate text-sm font-medium text-ink-800 hover:text-brand-700"
                  >
                    {course.title}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-500">
                    {course.percent >= 100 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="size-3.5" aria-hidden />
                        Complete
                      </span>
                    ) : (
                      `${course.percent}%`
                    )}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar
                    value={course.percent}
                    size="sm"
                    label={course.title}
                  />
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  {course.completedLessons}/{course.totalLessons} lessons
                  {course.remainingMinutes > 0 ? ` · ${formatDuration(course.remainingMinutes)} left` : ''}
                </p>
              </li>
            ))}
            {courses.length === 0 ? (
              <li className="text-sm text-ink-500">Nothing enrolled yet.</li>
            ) : null}
          </ul>
        </section>

        {/* -------------------------------------------------------- notifications */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">
              Notifications
              {unread > 0 ? <span className="ml-2 badge bg-brand-100 text-brand-800">{unread} new</span> : null}
            </h2>
            <Link href="/notifications" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex min-w-0 gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    notification.read_at ? 'bg-ink-200' : 'bg-brand-500'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{notification.title}</p>
                  <p className="truncate text-xs text-ink-500">
                    {notification.body} · {timeAgo(notification.created_at)}
                  </p>
                </div>
              </li>
            ))}
            {notifications.length === 0 ? (
              <li className="text-sm text-ink-500">No notifications yet.</li>
            ) : null}
          </ul>
          {stats.completed > 0 ? (
            <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-500">
              <Sparkles className="size-3.5 text-brand-500" aria-hidden />
              You have completed {stats.completed} course{stats.completed === 1 ? '' : 's'} ·{' '}
              {formatPercent(
                stats.enrolled > 0 ? Math.round((stats.completed / stats.enrolled) * 100) : 0,
              )}{' '}
              of everything you started
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
