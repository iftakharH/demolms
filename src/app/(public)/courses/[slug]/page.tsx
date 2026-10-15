import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Award,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Heart,
  PlayCircle,
  RefreshCw,
  SquarePen,
  Users,
} from 'lucide-react';
import { courseBySlug, relatedCourses } from '@/lib/queries/catalog';
import { getCurrentUser } from '@/lib/auth';
import { isStaffRole } from '@/lib/types';
import { enrolledCourseProgress, learnerCourseSummary, type EnrolledCourseProgress } from '@/lib/progress';
import { Curriculum } from '@/components/course/curriculum';
import { CourseCard } from '@/components/course/course-card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { renderMarkdown } from '@/lib/markdown';
import { fileUrl } from '@/lib/file-url';
import { formatDuration, formatPenceShort, formatTotalDuration, timeAgo } from '@/lib/format';
import { APP_URL, DEV_TOOLS } from '@/lib/env';
import { enrolFreeAction } from '@/lib/actions/enrolment-actions';

export const dynamic = 'force-dynamic';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export async function generateMetadata({ params }: PageProps<'/courses/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const course = courseBySlug(slug);
  if (!course) return { title: 'Course not found' };

  const description = course.subtitle || course.description.slice(0, 155);
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      title: `${course.title} · demolms`,
      description,
      url: `${APP_URL}/courses/${course.slug}`,
      type: 'website',
      images: course.thumbnailPath ? [{ url: fileUrl(course.thumbnailPath), width: 800, height: 450 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: course.title,
      description,
    },
  };
}

export default async function CoursePage({
  params,
  searchParams,
}: PageProps<'/courses/[slug]'>) {
  const { slug } = await params;
  const query = await searchParams;

  const viewer = await getCurrentUser();
  const staffPreview = query.preview === '1' && Boolean(viewer && isStaffRole(viewer.role));
  const staffViewer = Boolean(viewer && isStaffRole(viewer.role));

  const course = courseBySlug(slug, { includeUnpublished: staffPreview });
  if (!course) notFound();
  if (course.status !== 'published' && !staffPreview) notFound();

  const user = viewer;
  const summary = user ? learnerCourseSummary(user.id, course.id) : null;
  const isEnrolled = Boolean(summary?.enrolled);
  const related = relatedCourses(course, 3);
  const relatedProgress = user ? enrolledCourseProgress(user.id) : new Map<number, EnrolledCourseProgress>();
  const totalLessons = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);

  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.subtitle || course.description.slice(0, 200),
    url: `${APP_URL}/courses/${course.slug}`,
    provider: { '@type': 'Organization', name: 'demolms', sameAs: APP_URL },
    instructor: { '@type': 'Person', name: course.instructorName },
    educationalLevel: course.level,
    teaches: course.outcomes.slice(0, 6),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: course.durationMinutes > 0 ? `PT${Math.max(1, Math.round(course.durationMinutes / 60))}H` : undefined,
    },
    offers: {
      '@type': 'Offer',
      price: (course.pricePence / 100).toFixed(2),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${APP_URL}/courses/${course.slug}`,
      category: course.pricePence > 0 ? 'paid' : 'free',
    },
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
      />

      <nav className="text-sm text-ink-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="px-1.5" aria-hidden>
          /
        </span>
        <Link href="/courses" className="hover:text-brand-700">
          All courses
        </Link>
        {course.categorySlug ? (
          <>
            <span className="px-1.5" aria-hidden>
              /
            </span>
            <Link href={`/courses?category=${course.categorySlug}`} className="hover:text-brand-700">
              {course.categoryName}
            </Link>
          </>
        ) : null}
      </nav>

      {query.welcome === '1' ? (
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-success-soft px-4 py-3 text-sm text-emerald-900">
          <BadgeCheck className="size-5 shrink-0 text-emerald-600" aria-hidden />
          You are enrolled. Open the course from <strong>My learning</strong> to start lesson one.
        </div>
      ) : null}

      {query.staff === '1' && staffViewer ? (
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-warning-soft px-4 py-3 text-sm text-amber-900">
          <BadgeCheck className="size-5 shrink-0 text-amber-600" aria-hidden />
          Staff accounts cannot enrol in courses. Enter a learner&apos;s account from{' '}
          <Link href="/admin/users" className="font-semibold underline">
            Users
          </Link>{' '}
          to act on their behalf.
        </div>
      ) : null}

      {staffPreview && course.status !== 'published' ? (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
          <span className="badge bg-brand-600 text-white">Staff preview</span>
          <span>
            This course is <strong>{course.status}</strong> and is not visible to learners. You are
            seeing exactly what they would see if it were published.
          </span>
          <Link href={`/admin/courses/${course.slug}`} className="font-medium underline">
            Back to the builder
          </Link>
        </div>
      ) : null}

      <div className="mt-5 flex gap-10">
        {/* ---------------------------------------------------------- main column */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {course.categoryName ? (
              <Link href={`/courses?category=${course.categorySlug}`} className="badge bg-brand-100 text-brand-800">
                {course.categoryName}
              </Link>
            ) : null}
            <Badge tone="outline">{LEVEL_LABEL[course.level]}</Badge>
            {course.featured ? <Badge tone="warning">Featured</Badge> : null}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            {course.title}
          </h1>
          {course.subtitle ? <p className="mt-3 text-lg text-ink-600">{course.subtitle}</p> : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
            <span className="inline-flex items-center gap-2">
              <Avatar name={course.instructorName} size="xs" />
              {course.instructorName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-4 text-ink-400" aria-hidden />
              {totalLessons} lessons
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4 text-ink-400" aria-hidden />
              {course.durationMinutes > 0 ? formatTotalDuration(course.durationMinutes) : 'Self-paced'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-ink-400" aria-hidden />
              {course.enrolledCount} enrolled
            </span>
            {course.certificateEnabled ? (
              <span className="inline-flex items-center gap-1.5">
                <Award className="size-4 text-ink-400" aria-hidden />
                Certificate included
              </span>
            ) : null}
          </div>

          {course.outcomes.length > 0 ? (
            <section className="mt-9">
              <h2 className="text-lg font-semibold text-ink-900">What you will learn</h2>
              <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {course.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-2.5 text-sm text-ink-700">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-9">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">Course content</h2>
              <p className="text-sm text-ink-500">
                {course.sections.length} section{course.sections.length === 1 ? '' : 's'} · {totalLessons} lessons
                {course.previewLessonCount > 0 ? ` · ${course.previewLessonCount} free previews` : ''}
              </p>
            </div>
            <div className="mt-4">
              <Curriculum courseSlug={course.slug} sections={course.sections} enrolled={isEnrolled} />
            </div>
          </section>

          {course.descriptionMd ? (
            <section className="mt-9">
              <h2 className="text-lg font-semibold text-ink-900">About this course</h2>
              <div
                className="prose-lms mt-4 max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(course.descriptionMd) }}
              />
            </section>
          ) : null}

          {course.requirements ? (
            <section className="mt-9">
              <h2 className="text-lg font-semibold text-ink-900">Requirements</h2>
              <p className="mt-3 text-sm text-ink-700">{course.requirements}</p>
            </section>
          ) : null}

          <section className="mt-9">
            <h2 className="text-lg font-semibold text-ink-900">Your instructor</h2>
            <div className="card mt-4 flex gap-4 p-5">
              <Avatar name={course.instructorName} size="lg" />
              <div>
                <p className="text-sm font-semibold text-ink-900">{course.instructorName}</p>
                <p className="mt-1.5 text-sm text-ink-600">{course.instructorBio}</p>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------- sticky card */}
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="card overflow-hidden">
              {course.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static asset
                <img src={fileUrl(course.thumbnailPath)} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : null}
              <div className="p-5">
                {isEnrolled && summary ? (
                  /* ------------------------------------------------ ownership panel */
                  <div>
                    <span className="badge bg-emerald-50 text-emerald-700">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      {summary.completedAt ? 'Completed' : 'You are enrolled'}
                    </span>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-700">
                        {summary.completedLessons} of {summary.totalLessons} lessons
                      </span>
                      <span className="font-semibold text-ink-900">{summary.percent}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-200">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${
                          summary.completedAt ? 'bg-emerald-500' : 'bg-brand-600'
                        }`}
                        style={{ width: `${summary.percent}%` }}
                      />
                    </div>

                    {summary.nextLesson && !summary.completedAt ? (
                      <p className="mt-3 text-xs text-ink-500">
                        Up next:{' '}
                        <span className="font-medium text-ink-700">{summary.nextLesson.title}</span>
                        {summary.nextLesson.durationMinutes > 0
                          ? ` · ${formatDuration(summary.nextLesson.durationMinutes)}`
                          : ''}
                      </p>
                    ) : summary.completedAt && course.certificateEnabled ? (
                      <p className="mt-3 text-xs text-ink-500">
                        {summary.certificateId
                          ? `Certificate ${summary.certificateId} is ready.`
                          : 'Finish the remaining requirements to earn your certificate.'}
                      </p>
                    ) : null}

                    <div className="mt-5 space-y-2">
                      <Link href={`/learn/courses/${course.slug}`} className="btn-primary btn-lg w-full">
                        {summary.completedAt ? 'Revisit course' : summary.percent > 0 ? 'Continue learning' : 'Start learning'}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/learn/my-learning" className="btn-secondary btn-sm flex-1 justify-center">
                          My learning
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

                    <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-xs text-ink-500">
                      <li className="flex gap-2.5">
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        {totalLessons} lessons unlocked · progress saved as you go
                      </li>
                      {summary.lastActivityAt ? (
                        <li className="flex gap-2.5">
                          <RefreshCw className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          Last activity {timeAgo(summary.lastActivityAt)}
                        </li>
                      ) : null}
                      {summary.source ? (
                        <li className="flex gap-2.5">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          Access via {summary.source === 'purchase' ? 'your purchase' : 'free enrolment'}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : staffViewer ? (
                  /* --------------------------------------------------- staff panel */
                  <div>
                    <span className="badge bg-info-soft text-info">Platform staff view</span>
                    <p className="mt-3 text-sm text-ink-600">
                      Enrolment and learning are disabled for staff accounts. Enter a learner&apos;s
                      account to see this course exactly as they do.
                    </p>
                    <div className="mt-5 space-y-2">
                      <Link href={`/admin/courses/${course.slug}`} className="btn-primary btn-lg w-full">
                        <SquarePen className="size-4" aria-hidden />
                        Edit this course
                      </Link>
                      <Link href="/admin/users" className="btn-secondary w-full justify-center">
                        Enter as learner
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* -------------------------------------------------- sales panel */
                  <>
                    <p className="text-2xl font-semibold tracking-tight text-ink-900">
                      {course.pricePence > 0 ? formatPenceShort(course.pricePence) : 'Free'}
                    </p>
                    {course.pricePence > 0 ? (
                      <p className="mt-1 text-xs text-ink-500">One-off payment · lifetime access</p>
                    ) : (
                      <p className="mt-1 text-xs text-ink-500">Free forever · no card needed</p>
                    )}

                    <div className="mt-5 space-y-2">
                      {course.pricePence === 0 ? (
                        <form action={enrolFreeAction}>
                          <input type="hidden" name="slug" value={course.slug} />
                          <button type="submit" className="btn-primary btn-lg w-full">
                            {user ? 'Enrol for free' : 'Sign in to enrol free'}
                          </button>
                        </form>
                      ) : (
                        <Link href={`/checkout/${course.slug}`} className="btn-primary btn-lg w-full">
                          Buy course
                        </Link>
                      )}
                      {course.previewLessonCount > 0 ? (
                        <p className="text-center text-xs text-ink-500">
                          Try {course.previewLessonCount} free preview lesson
                          {course.previewLessonCount === 1 ? '' : 's'} first
                        </p>
                      ) : null}
                    </div>

                    <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-ink-600">
                      <li className="flex gap-2.5">
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        {totalLessons} lessons · {course.durationMinutes > 0 ? formatDuration(course.durationMinutes) : 'self-paced'}
                      </li>
                      <li className="flex gap-2.5">
                        <RefreshCw className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        Resume playback and notes on any device
                      </li>
                      {course.certificateEnabled ? (
                        <li className="flex gap-2.5">
                          <GraduationCap className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          Verifiable certificate on completion
                        </li>
                      ) : null}
                      {course.requiresQuizPass ? (
                        <li className="flex gap-2.5">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                          Pass mark required on quizzes
                        </li>
                      ) : null}
                      <li className="flex gap-2.5">
                        <Heart className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
                        Graded feedback from your instructor
                      </li>
                    </ul>
                  </>
                )}
              </div>
            </div>

            {DEV_TOOLS && !isEnrolled ? (
              <p className="px-1 text-xs text-ink-400">
                Demo tip: paid checkouts use the local mock provider - card 4242 4242 4242 4242 succeeds.
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {/* mobile CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          {isEnrolled && summary ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">
                  {summary.completedLessons}/{summary.totalLessons} lessons · {summary.percent}%
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                  <div
                    className={`h-full rounded-full ${summary.completedAt ? 'bg-emerald-500' : 'bg-brand-600'}`}
                    style={{ width: `${summary.percent}%` }}
                  />
                </div>
              </div>
              <Link href={`/learn/courses/${course.slug}`} className="btn-primary shrink-0">
                {summary.percent > 0 ? 'Continue' : 'Start'}
              </Link>
            </>
          ) : staffViewer ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">Platform staff</p>
                <p className="text-[0.6875rem] text-ink-500">Enrolment disabled for staff accounts</p>
              </div>
              <Link href={`/admin/courses/${course.slug}`} className="btn-primary shrink-0">
                Edit course
              </Link>
            </>
          ) : (
            <>
              <div>
                <p className="text-base font-semibold text-ink-900">
                  {course.pricePence > 0 ? formatPenceShort(course.pricePence) : 'Free'}
                </p>
                <p className="text-[0.6875rem] text-ink-500">
                  {course.pricePence > 0 ? 'lifetime access' : 'no card needed'}
                </p>
              </div>
              {course.pricePence === 0 ? (
                <form action={enrolFreeAction} className="flex-1">
                  <input type="hidden" name="slug" value={course.slug} />
                  <button type="submit" className="btn-primary w-full">
                    {user ? 'Enrol for free' : 'Sign in to enrol'}
                  </button>
                </form>
              ) : (
                <Link href={`/checkout/${course.slug}`} className="btn-primary flex-1">
                  Buy course
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-14 pb-16 lg:pb-0">
          <h2 className="section-title">Students also viewed</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <CourseCard
                key={item.id}
                course={item}
                enrolment={relatedProgress.get(item.id)}
                staffView={staffViewer}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
