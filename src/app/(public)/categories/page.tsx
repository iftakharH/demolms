import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { catalog, categoriesWithCounts } from '@/lib/queries/catalog';
import { fileUrl } from '@/lib/file-url';
import { formatPenceShort } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Categories',
  description:
    'Browse demolms courses by category: software development, data and analytics, design, ' +
    'and business and career skills.',
  alternates: { canonical: '/categories' },
};

export default function CategoriesPage() {
  const categories = categoriesWithCounts();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="page-title">Browse by category</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Four tracks, each with a clear end point: something you can show, ship or say out loud.
        </p>
      </header>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {categories.map((category) => {
          const top = catalog({ category: category.slug, perPage: 3, sort: 'popular' }).courses;
          return (
            <section key={category.id} className="card flex flex-col overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <h2 className="text-base font-semibold text-ink-900">
                    <Link href={`/courses?category=${category.slug}`} className="hover:text-brand-700">
                      {category.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">{category.description}</p>
                </div>
                <span className="badge shrink-0 bg-ink-100 text-ink-600">
                  <Layers className="size-3.5" aria-hidden />
                  {category.courseCount}
                </span>
              </div>

              <ul className="border-t border-line">
                {top.map((course) => (
                  <li key={course.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/courses/${course.slug}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-ink-50"
                    >
                      <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                        {course.thumbnailPath ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local static asset
                          <img src={fileUrl(course.thumbnailPath)} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-800">{course.title}</span>
                        <span className="block text-xs text-ink-500">
                          {course.level} · {course.lessonCount} lessons
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-ink-900">
                        {course.pricePence > 0 ? formatPenceShort(course.pricePence) : 'Free'}
                      </span>
                    </Link>
                  </li>
                ))}
                {top.length === 0 ? (
                  <li className="px-5 py-6 text-sm text-ink-500">No published courses in this category yet.</li>
                ) : null}
              </ul>

              <div className="p-5 pt-4">
                <Link
                  href={`/courses?category=${category.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  See all {category.courseCount} course{category.courseCount === 1 ? '' : 's'}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
