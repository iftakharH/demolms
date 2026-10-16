import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  HelpCircle,
  Paperclip,
  Rocket,
  Trash2,
  Video,
} from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminCourseStats, adminSections, categoryOptions } from '@/lib/queries/admin-courses';
import { CourseSettingsForm } from '@/components/admin/course-settings-form';
import { SectionManager } from '@/components/admin/section-manager';
import { CourseStatusBadge } from '@/components/ui/badge';
import {
  deleteCourseAction,
  duplicateCourseAction,
  setCourseStatusAction,
} from '@/lib/actions/admin-course-actions';
import { queryOne } from '@/lib/db';
import { timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Course builder · Admin' };

interface BuilderCourse {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description_md: string;
  category_id: number | null;
  instructor_name: string;
  instructor_bio_md: string;
  level: string;
  price_pence: number;
  tags: string;
  outcomes_md: string;
  requirements_md: string;
  status: 'draft' | 'published' | 'archived';
  thumbnail_path: string | null;
  featured: number;
  certificate_enabled: number;
  requires_quiz_pass: number;
  requires_assignments: number;
  updated_at: string;
  published_at: string | null;
  enrolled: number;
}

export default async function CourseBuilderPage({
  params,
  searchParams,
}: PageProps<'/admin/courses/[slug]'>) {
  const { slug } = await params;
  const user = await requireStaff(`/admin/courses/${slug}`);
  const query = await searchParams;

  const course = queryOne<BuilderCourse>(
    `SELECT c.*, (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id AND e.access_revoked = 0) AS enrolled
       FROM courses c WHERE c.slug = ?`,
    slug,
  );
  if (!course) notFound();

  const sections = adminSections(course.id);
  const stats = adminCourseStats(course.id);
  const categories = categoryOptions();
  const canWrite = user.role === 'admin';

  const error = typeof query.error === 'string' ? query.error : null;
  const saved = query.saved === '1';
  const copied = query.copied === '1';

  return (
    <div className="space-y-6">
      <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        All courses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CourseStatusBadge status={course.status} />
            <span className="text-xs text-ink-500">Updated {timeAgo(course.updated_at)}</span>
            {course.published_at ? (
              <span className="text-xs text-ink-500">· published {timeAgo(course.published_at)}</span>
            ) : null}
          </div>
          <h1 className="page-title mt-2">{course.title}</h1>
          <p className="mt-1 text-sm text-ink-500">
            /{course.slug} · {course.enrolled} enrolled · {stats.lessons} lessons · {stats.questions}{' '}
            questions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/courses/${course.slug}?preview=1`} className="btn-secondary" target="_blank">
            <Eye className="size-4" aria-hidden />
            Preview as learner
          </Link>

          {canWrite ? (
            <>
              <form action={duplicateCourseAction}>
                <input type="hidden" name="slug" value={course.slug} />
                <button type="submit" className="btn-secondary">
                  <Copy className="size-4" aria-hidden />
                  Duplicate
                </button>
              </form>

              {course.status !== 'published' ? (
                <form action={setCourseStatusAction}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="btn-primary">
                    <Rocket className="size-4" aria-hidden />
                    {course.status === 'archived' ? 'Restore and publish' : 'Publish'}
                  </button>
                </form>
              ) : (
                <form action={setCourseStatusAction}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="btn-secondary">
                    <EyeOff className="size-4" aria-hidden />
                    Unpublish
                  </button>
                </form>
              )}

              {course.status !== 'archived' ? (
                <form action={setCourseStatusAction}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className="btn-secondary">
                    <Archive className="size-4" aria-hidden />
                    Archive
                  </button>
                </form>
              ) : null}

              {course.status === 'draft' ? (
                <form action={deleteCourseAction}>
                  <input type="hidden" name="slug" value={course.slug} />
                  <button type="submit" className="btn-ghost text-danger">
                    <Trash2 className="size-4" aria-hidden />
                    Delete draft
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}
      {saved && !error ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-strong">
          Saved.
        </p>
      ) : null}
      {copied && !error ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-strong">
          Duplicated as a fresh draft - edit the copy freely, the original is untouched.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sections" value={String(sections.length)} />
        <Stat label="Video lessons" value={String(stats.videos)} icon={<Video className="size-4" aria-hidden />} />
        <Stat label="Quizzes / assignments" value={`${stats.quizzes} / ${stats.assignments}`} icon={<HelpCircle className="size-4" aria-hidden />} />
        <Stat label="Resources" value={String(stats.resources)} icon={<Paperclip className="size-4" aria-hidden />} />
      </div>

      <CourseSettingsForm
        canWrite={canWrite}
        categories={categories}
        values={{
          slug: course.slug,
          title: course.title,
          subtitle: course.subtitle,
          description: course.description_md,
          categoryId: course.category_id ? String(course.category_id) : '',
          level: course.level,
          price: (course.price_pence / 100).toFixed(2),
          instructorName: course.instructor_name,
          instructorBio: course.instructor_bio_md,
          tags: course.tags,
          outcomes: course.outcomes_md,
          requirements: course.requirements_md,
          thumbnailPath: course.thumbnail_path,
          certificateEnabled: Boolean(course.certificate_enabled),
          requiresQuizPass: Boolean(course.requires_quiz_pass),
          requiresAssignments: Boolean(course.requires_assignments),
          featured: Boolean(course.featured),
        }}
      />

      {sections.length === 0 ? (
        <div className="card border-brand-200 bg-brand-50/60 p-5">
          <h2 className="section-title">Get started</h2>
          <p className="mt-1 text-sm text-ink-600">
            This course has no content yet. Add your first section below, then quick-add lessons
            inside it - a title and a type now, the details later.
          </p>
        </div>
      ) : null}

      <SectionManager slug={course.slug} sections={sections} canWrite={canWrite} />

      <div className="card p-5">
        <h2 className="section-title">Publishing checklist</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <Check done={sections.length > 0} label="At least one section" />
          <Check done={stats.lessons > 0} label="At least one lesson" />
          <Check done={stats.questions > 0} label="At least one quiz question" />
          <Check done={Boolean(course.thumbnail_path)} label="Thumbnail uploaded" optional />
          <Check
            done={stats.videos === 0 || sections.some((section) => section.lessons.some((lesson) => lesson.type === 'video' && lesson.videoPath))}
            label="Every video lesson has a file"
          />
        </ul>
        <p className="mt-4 text-xs text-ink-500">
          The first three are required to publish. Everything else is a recommendation.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-500 uppercase">
        {icon ? <span className="text-brand-600">{icon}</span> : null}
        {label}
      </p>
      <p className="stat-value mt-1.5">{value}</p>
    </div>
  );
}

function Check({ done, label, optional = false }: { done: boolean; label: string; optional?: boolean }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold ${
          done ? 'bg-success-soft text-success' : 'bg-ink-100 text-ink-500'
        }`}
        aria-hidden
      >
        {done ? '✓' : '•'}
      </span>
      <span className={done ? 'text-ink-700' : 'text-ink-500'}>
        {label}
        {optional ? <span className="text-ink-400"> (optional)</span> : null}
      </span>
    </li>
  );
}
