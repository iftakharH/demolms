import Link from 'next/link';
import { ArrowRight, Award, BadgeCheck, Layers, Mail, Sparkles, Users } from 'lucide-react';
import { catalog, categoriesWithCounts, featuredCourses, newestCourses } from '@/lib/queries/catalog';
import { CourseCard } from '@/components/course/course-card';
import { queryOne } from '@/lib/db';
import { formatPenceShort, formatTotalDuration, timeAgo } from '@/lib/format';
import { getCurrentUser } from '@/lib/auth';
import { isStaffRole } from '@/lib/types';
import { enrolledCourseProgress, type EnrolledCourseProgress } from '@/lib/progress';
import { enrolledCourses } from '@/lib/queries/learner';
import { ProgressBar } from '@/components/ui/progress';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const viewer = await getCurrentUser();
  const staffView = Boolean(viewer && isStaffRole(viewer.role));
  const featured = featuredCourses(3);
  const newest = newestCourses(3);
  const categories = categoriesWithCounts();
  const free = catalog({ price: 'free', perPage: 3, sort: 'popular' }).courses;
  const progress = viewer ? enrolledCourseProgress(viewer.id) : new Map<number, EnrolledCourseProgress>();

  // for a returning learner the hero points at the course they were last in
  const activeCourse = viewer
    ? enrolledCourses(viewer.id).find((course) => course.percent > 0 && course.percent < 100) ?? null
    : null;

  const stats = queryOne<{ courses: number; learners: number; certificates: number }>(
    `SELECT
       (SELECT COUNT(*) FROM courses WHERE status = 'published') AS courses,
       (SELECT COUNT(*) FROM users WHERE role = 'learner') AS learners,
       (SELECT COUNT(*) FROM certificates WHERE revoked_at IS NULL) AS certificates`,
  ) ?? { courses: 0, learners: 0, certificates: 0 };

  return (
    <div>
      {/* ---------------------------------------------------------------- hero */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="badge bg-brand-100 text-brand-800">
              <Sparkles className="size-3.5" aria-hidden />
              {stats.courses} published courses · {stats.learners} learners
            </span>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-ink-900 sm:text-5xl">
              Learn the things you keep meaning to learn.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
              Practical courses in software, data, design and career skills. Watch, read, take the
              quiz, submit the assignment - and finish with a certificate anyone can verify.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {activeCourse ? (
                <Link href={`/learn/courses/${activeCourse.slug}`} className="btn-primary btn-lg">
                  Continue learning
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : (
                <Link href="/courses" className="btn-primary btn-lg">
                  Browse courses
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
              <Link href="/courses?price=free" className="btn-secondary btn-lg">
                Start with a free one
              </Link>
            </div>

            {activeCourse ? (
              <div className="mt-8 max-w-md rounded-2xl border border-line bg-surface p-4">
                <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                  Pick up where you left off
                </p>
                <p className="mt-1 truncate text-sm font-medium text-ink-900">{activeCourse.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {activeCourse.completedLessons}/{activeCourse.totalLessons} lessons
                  {activeCourse.lastActivityAt ? ` · last activity ${timeAgo(activeCourse.lastActivityAt)}` : ''}
                  {activeCourse.remainingMinutes > 0
                    ? ` · ${formatTotalDuration(activeCourse.remainingMinutes)} left`
                    : ''}
                </p>
                <div className="mt-2.5">
                  <ProgressBar value={activeCourse.percent} size="sm" label={activeCourse.title} />
                </div>
              </div>
            ) : null}
            <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-ink-500">Courses</dt>
                <dd className="text-lg font-semibold text-ink-900">{stats.courses}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Learners</dt>
                <dd className="text-lg font-semibold text-ink-900">{stats.learners}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Certificates issued</dt>
                <dd className="text-lg font-semibold text-ink-900">{stats.certificates}</dd>
              </div>
            </dl>
          </div>

          {featured[0] ? (
            <Link
              href={`/courses/${featured[0].slug}`}
              className="card card-hover group relative overflow-hidden"
            >
              {featured[0].thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static asset
                <img
                  src={`/uploads/${featured[0].thumbnailPath}`}
                  alt=""
                  className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              ) : null}
              <div className="p-5">
                <span className="badge bg-brand-100 text-brand-800">Featured course</span>
                <h2 className="mt-3 text-lg font-semibold text-ink-900">{featured[0].title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-ink-500">{featured[0].subtitle}</p>
                <p className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink-900">
                    {featured[0].pricePence > 0 ? formatPenceShort(featured[0].pricePence) : 'Free'}
                  </span>
                  <span className="font-medium text-brand-700 group-hover:underline">View course →</span>
                </p>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* ------------------------------------------------------------ featured */}
        {featured.length > 0 ? (
          <section className="py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink-900">Featured courses</h2>
                <p className="mt-1 text-sm text-ink-500">Hand-picked starts, kept deliberately short.</p>
              </div>
              <Link href="/courses" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
                All courses →
              </Link>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  priority={index === 0}
                  enrolment={progress.get(course.id)}
                  staffView={staffView}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------------- categories */}
        <section className="border-t border-line py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink-900">Browse by category</h2>
              <p className="mt-1 text-sm text-ink-500">Four tracks, each with a clear end point.</p>
            </div>
            <Link href="/categories" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
              All categories →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/courses?category=${category.slug}`}
                className="card card-hover p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Layers className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{category.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">{category.description}</p>
                <p className="mt-3 text-xs font-medium text-brand-700">
                  {category.courseCount} course{category.courseCount === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------------- free */}
        {free.length > 0 ? (
          <section className="border-t border-line py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink-900">Free to start today</h2>
                <p className="mt-1 text-sm text-ink-500">No card, no trial - just enrol and learn.</p>
              </div>
              <Link href="/courses?price=free" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
                All free courses →
              </Link>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {free.map((course) => (
                <CourseCard key={course.id} course={course} enrolment={progress.get(course.id)} staffView={staffView} />
              ))}
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------------- how it works */}
        <section className="border-t border-line py-12">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">How this platform works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Feature
              icon={<BadgeCheck className="size-5" aria-hidden />}
              title="Learn at your own pace"
              body="Video and article lessons, saved playback position, private notes and downloadable resources."
            />
            <Feature
              icon={<Award className="size-5" aria-hidden />}
              title="Prove what you learned"
              body="Quizzes marked instantly, written answers and assignments graded by an instructor with feedback."
            />
            <Feature
              icon={<Mail className="size-5" aria-hidden />}
              title="Nothing leaves this machine"
              body="Payments and email are simulated locally. The outbox shows every message the app writes."
            />
          </div>
        </section>

        {/* -------------------------------------------------------------- newest */}
        {newest.length > 0 ? (
          <section className="border-t border-line py-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink-900">Newest courses</h2>
                <p className="mt-1 text-sm text-ink-500">Fresh off the course builder.</p>
              </div>
              <Link href="/courses?sort=newest" className="hidden text-sm font-medium text-brand-700 hover:underline sm:block">
                See all →
              </Link>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {newest.map((course) => (
                <CourseCard key={course.id} course={course} enrolment={progress.get(course.id)} staffView={staffView} />
              ))}
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------------------------- CTA */}
        <section className="py-12">
          <div className="card flex flex-col items-start justify-between gap-6 bg-ink-950 p-8 text-white sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Users className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Create a free account</h2>
                <p className="mt-1 max-w-xl text-sm text-white/70">
                  Track progress across courses, keep notes, and get a verifiable certificate when you
                  finish. Demo accounts are listed in the footer.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/register" className="btn bg-white text-ink-900 hover:bg-white/90">
                Create account
              </Link>
              <Link href="/login" className="btn border border-white/25 text-white hover:bg-white/10">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h3 className="mt-4 text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-500">{body}</p>
    </div>
  );
}
