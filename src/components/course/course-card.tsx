import Link from 'next/link';
import { Check, Clock, PlayCircle, SquarePen, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fileUrl } from '@/lib/file-url';
import { formatPenceShort, formatTotalDuration } from '@/lib/format';
import type { CourseCard as CourseCardData } from '@/lib/queries/catalog';
import type { EnrolledCourseProgress } from '@/lib/progress';

const LEVEL_TONE = {
  beginner: 'success',
  intermediate: 'brand',
  advanced: 'warning',
} as const;

const LEVEL_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const;

/**
 * Catalogue card. When `enrolment` is passed the card stops selling: the price
 * is replaced by progress and the call to action becomes "Continue".
 */
export function CourseCard({
  course,
  priority = false,
  enrolment,
  staffView = false,
}: {
  course: CourseCardData;
  priority?: boolean;
  enrolment?: EnrolledCourseProgress;
  /** staff browse the catalogue for management, not purchase */
  staffView?: boolean;
}) {
  const owned = Boolean(enrolment);

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link
        href={owned ? `/learn/courses/${course.slug}` : `/courses/${course.slug}`}
        className="relative block aspect-[16/9] overflow-hidden bg-ink-100"
      >
        {course.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- local SVG/JPG in public/uploads
          <img
            src={fileUrl(course.thumbnailPath)}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : null}

        <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {owned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[0.6875rem] font-semibold text-white shadow-sm">
              <Check className="size-3" aria-hidden />
              {enrolment?.completed ? 'Completed' : 'Enrolled'}
            </span>
          ) : null}
          {course.featured && !owned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[0.6875rem] font-semibold text-brand-800 shadow-sm">
              <Star className="size-3 fill-brand-500 text-brand-500" aria-hidden />
              Featured
            </span>
          ) : null}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {course.categoryName ? (
            <Link
              href={`/courses?category=${course.categorySlug}`}
              className="min-w-0 truncate font-medium text-brand-700 hover:underline"
            >
              {course.categoryName}
            </Link>
          ) : (
            <span className="truncate">Uncategorised</span>
          )}
          <span className="shrink-0" aria-hidden>
            ·
          </span>
          <Badge tone={LEVEL_TONE[course.level]} className="shrink-0">
            {LEVEL_LABEL[course.level]}
          </Badge>
        </div>

        <h3 className="mt-2.5 text-[0.9375rem] leading-snug font-semibold text-ink-900">
          <Link href={owned ? `/learn/courses/${course.slug}` : `/courses/${course.slug}`} className="hover:text-brand-700">
            {course.title}
          </Link>
        </h3>
        {course.subtitle ? <p className="mt-1 line-clamp-2 text-sm text-ink-500">{course.subtitle}</p> : null}

        <p className="mt-2 text-xs text-ink-500">by {course.instructorName}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle className="size-3.5 text-ink-400" aria-hidden />
            {course.lessonCount} lesson{course.lessonCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-ink-400" aria-hidden />
            {course.durationMinutes > 0
              ? formatTotalDuration(course.durationMinutes).replace(' of content', '')
              : 'Self-paced'}
          </span>
          {course.enrolledCount > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-ink-400" aria-hidden />
              {course.enrolledCount} enrolled
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          {owned && enrolment ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-600">
                  {enrolment.completedLessons}/{enrolment.totalLessons} lessons
                </span>
                <span className="font-semibold text-ink-800">{enrolment.percent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    enrolment.completed ? 'bg-emerald-500' : 'bg-brand-600'
                  }`}
                  style={{ width: `${enrolment.percent}%` }}
                />
              </div>
              <Link href={`/learn/courses/${course.slug}`} className="btn-primary btn-sm mt-3 w-full">
                {enrolment.completed ? 'Revisit course' : enrolment.percent > 0 ? 'Continue learning' : 'Start learning'}
              </Link>
            </>
          ) : staffView ? (
            <Link
              href={`/admin/courses/${course.slug}`}
              className="btn-secondary btn-sm w-full justify-center"
            >
              <SquarePen className="size-3.5" aria-hidden />
              Manage in admin
            </Link>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-ink-900">
                {course.pricePence > 0 ? formatPenceShort(course.pricePence) : 'Free'}
              </span>
              <span className="text-sm font-medium text-brand-700 group-hover:underline">
                View course
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
