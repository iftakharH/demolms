import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Plus, Search } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminCourseList } from '@/lib/queries/admin-courses';
import { CourseStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatPenceShort, formatTotalDuration, timeAgo } from '@/lib/format';
import { fileUrl } from '@/lib/file-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Courses · Admin' };

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

export default async function AdminCoursesPage({ searchParams }: PageProps<'/admin/courses'>) {
  const user = await requireStaff('/admin/courses');
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : '';
  const q = typeof params.q === 'string' ? params.q : '';

  const courses = adminCourseList({ status, q });
  const isWriter = user.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Courses</h1>
          <p className="mt-1 text-sm text-ink-500">
            {courses.length} course{courses.length === 1 ? '' : 's'}
            {status ? ` · ${status}` : ''}
            {q ? ` · matching "${q}"` : ''}
          </p>
        </div>
        {isWriter ? (
          <Link href="/admin/courses/new" className="btn-primary">
            <Plus className="size-4" aria-hidden />
            New course
          </Link>
        ) : null}
      </div>

      {params.deleted === '1' ? (
        <p className="rounded-xl border border-emerald-200 bg-success-soft px-4 py-3 text-sm text-emerald-800">
          Draft course deleted.
        </p>
      ) : null}
      {typeof params.error === 'string' ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-4 py-3 text-sm text-danger">
          {params.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            const query = new URLSearchParams();
            if (tab.value) query.set('status', tab.value);
            if (q) query.set('q', q);
            const href = query.toString() ? `/admin/courses?${query}` : '/admin/courses';
            return (
              <Link
                key={tab.label}
                href={href}
                className={`chip ${active ? 'chip-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/admin/courses" className="ml-auto flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="course-search">
            Search courses
          </label>
          <input
            id="course-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by title or slug"
            className="input w-56"
          />
          <button type="submit" className="btn-secondary px-3" aria-label="Search">
            <Search className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" aria-hidden />}
          title="No courses here"
          description={q ? 'No course matches that search.' : 'Create your first course to get started.'}
        >
          {isWriter ? (
            <Link href="/admin/courses/new" className="btn-primary">
              New course
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Content</th>
                  <th>Price</th>
                  <th>Learners</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                          {course.thumbnailPath ? (
                            // eslint-disable-next-line @next/next/no-img-element -- local static asset
                            <img src={fileUrl(course.thumbnailPath)} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/courses/${course.slug}`}
                            className="block truncate font-medium text-ink-900 hover:text-brand-700"
                          >
                            {course.title}
                          </Link>
                          <span className="block truncate text-xs text-ink-500">
                            {course.categoryName ?? 'Uncategorised'} · {course.level} · {course.slug}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="text-xs whitespace-nowrap text-ink-500">
                      {course.sectionCount} sections · {course.lessonCount} lessons
                      <span className="block">{formatTotalDuration(course.durationMinutes).replace(' of content', '')}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      {course.pricePence > 0 ? formatPenceShort(course.pricePence) : 'Free'}
                    </td>
                    <td>{course.enrolledCount}</td>
                    <td className="text-xs whitespace-nowrap text-ink-500">{timeAgo(course.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.role === 'auditor' ? (
        <p className="text-sm text-ink-500">
          Auditors can browse the builder but every write control is hidden, and the server rejects
          write requests from auditor accounts.
        </p>
      ) : null}
    </div>
  );
}
