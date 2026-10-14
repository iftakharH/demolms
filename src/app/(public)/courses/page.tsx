import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, Sparkles } from 'lucide-react';
import { catalog, categoriesWithCounts, popularTags, type CatalogFilters as Filters } from '@/lib/queries/catalog';
import { getCurrentUser } from '@/lib/auth';
import { enrolledCourseProgress, type EnrolledCourseProgress } from '@/lib/progress';
import { CourseCard } from '@/components/course/course-card';
import { CatalogFilters, CatalogSort, type FilterOption } from '@/components/catalog/filters';
import { Pagination } from '@/components/catalog/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { APP_URL } from '@/lib/env';

export const dynamic = 'force-dynamic';

const PER_PAGE = 6;

export const metadata: Metadata = {
  title: 'All courses',
  description:
    'Browse every published demolms course: software, data, design and career skills. ' +
    'Filter by category, level, price and duration.',
  openGraph: {
    title: 'All courses · demolms',
    description: 'Browse every published course - filter by category, level, price and duration.',
    url: `${APP_URL}/courses`,
    type: 'website',
  },
};

const SORT_OPTIONS: FilterOption[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'title', label: 'Title A-Z' },
];

const LEVEL_OPTIONS: FilterOption[] = [
  { value: '', label: 'Any level' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const PRICE_OPTIONS: FilterOption[] = [
  { value: '', label: 'Free and paid' },
  { value: 'free', label: 'Free only' },
  { value: 'paid', label: 'Paid only' },
];

const DURATION_OPTIONS: FilterOption[] = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Under 1 hour' },
  { value: 'long', label: '1 hour and over' },
];

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function CoursesPage({ searchParams }: PageProps<'/courses'>) {
  const params = await searchParams;
  const viewer = await getCurrentUser();

  const active = {
    q: first(params.q),
    category: first(params.category),
    level: first(params.level),
    price: first(params.price),
    duration: first(params.duration),
    sort: first(params.sort) || 'newest',
  };
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const filters: Filters = {
    q: active.q || undefined,
    category: active.category || undefined,
    level: active.level || undefined,
    price: (active.price === 'free' || active.price === 'paid' ? active.price : undefined) as
      | 'free'
      | 'paid'
      | undefined,
    duration: (['short', 'long'].includes(active.duration)
      ? active.duration
      : undefined) as 'short' | 'long' | undefined,
    sort: active.sort as Filters['sort'],
    page,
    perPage: PER_PAGE,
  };

  const result = catalog(filters);
  const categories = categoriesWithCounts();
  const tags = popularTags(10);
  const selectedCategory = categories.find((category) => category.slug === active.category);
  const progress = viewer ? enrolledCourseProgress(viewer.id) : new Map<number, EnrolledCourseProgress>();
  const enrolledVisible = result.courses.filter((course) => progress.has(course.id)).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <nav className="text-sm text-ink-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="px-1.5" aria-hidden>
          /
        </span>
        <span className="text-ink-800">All courses</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {selectedCategory ? selectedCategory.name : 'All courses'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            {selectedCategory?.description ||
              'Practical, project-based courses with real grading and verifiable certificates.'}
          </p>
        </div>
        <CatalogSort options={SORT_OPTIONS} active={active} />
      </header>

      <div className="mt-8 flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="card sticky top-24 p-4">
            <CatalogFilters
              categories={[
                { value: '', label: 'All categories' },
                ...categories.map((category) => ({
                  value: category.slug,
                  label: category.name,
                  count: category.courseCount,
                })),
              ]}
              levels={LEVEL_OPTIONS}
              prices={PRICE_OPTIONS}
              durations={DURATION_OPTIONS}
              sortOptions={SORT_OPTIONS}
              active={active}
              total={result.total}
            />
            {tags.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="label mb-2.5">Popular tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Link key={tag.tag} href={`/courses?q=${encodeURIComponent(tag.tag)}`} className="chip px-2.5 py-1 text-xs">
                      {tag.tag}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <details className="card mb-4 p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-ink-800">
              Filters and search
            </summary>
            <div className="mt-4">
              <CatalogFilters
                categories={[
                  { value: '', label: 'All categories' },
                  ...categories.map((category) => ({
                    value: category.slug,
                    label: category.name,
                  })),
                ]}
                levels={LEVEL_OPTIONS}
                prices={PRICE_OPTIONS}
                durations={DURATION_OPTIONS}
                sortOptions={SORT_OPTIONS}
                active={active}
                total={result.total}
              />
            </div>
          </details>

          {result.courses.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-8" aria-hidden />}
              title="No courses match those filters"
              description="Try a different search term, or clear the filters to see everything."
            >
              <Link href="/courses" className="btn-primary">
                Clear filters
              </Link>
            </EmptyState>
          ) : (
            <>
              <div className="hidden items-center gap-2 text-sm text-ink-500 lg:flex">
                <Sparkles className="size-3.5 text-brand-500" aria-hidden />
                Showing {result.courses.length} of {result.total} course
                {result.total === 1 ? '' : 's'}
                {active.q ? (
                  <>
                    {' '}
                    for <span className="font-medium text-ink-800">&ldquo;{active.q}&rdquo;</span>
                  </>
                ) : null}
                {enrolledVisible > 0 ? (
                  <span className="text-ink-400">
                    · {enrolledVisible} you are enrolled on
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.courses.map((course, index) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    priority={index < 3}
                    enrolment={progress.get(course.id)}
                  />
                ))}
              </div>

              <div className="mt-8">
                <Pagination page={result.page} totalPages={result.totalPages} params={active} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
