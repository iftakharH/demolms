import { ArrowDown, ArrowUp, FolderPlus, Plus, Trash2 } from 'lucide-react';
import type { CategoryRow } from '@/lib/queries/admin-courses';
import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  updateCategoryAction,
} from '@/lib/actions/admin-settings-actions';

/**
 * Category management: rename/re-slug/re-describe inline, reorder, delete.
 * Deleting moves any courses to "uncategorised" (the FK nulls the reference).
 */
export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: CategoryRow[];
  canWrite: boolean;
}) {
  return (
    <section id="categories" className="card p-5 sm:p-6">
      <div>
        <h2 className="section-title">Categories</h2>
        <p className="mt-1 text-sm text-ink-500">
          Categories drive the catalogue filters and the home page. Deleting one leaves its courses
          uncategorised - nothing is deleted with it.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {categories.map((category, index) => (
          <li key={category.id} className="rounded-xl border border-line p-3.5">
            {canWrite ? (
              <form action={updateCategoryAction} className="grid gap-2.5 sm:grid-cols-[1.2fr_1fr_1.6fr_auto] sm:items-center">
                <input type="hidden" name="category_id" value={category.id} />
                <input
                  name="name"
                  defaultValue={category.name}
                  required
                  minLength={2}
                  className="input h-9 py-1 text-sm"
                  aria-label={`${category.name} name`}
                />
                <input
                  name="slug"
                  defaultValue={category.slug}
                  className="input h-9 py-1 font-mono text-xs"
                  aria-label={`${category.name} slug`}
                />
                <input
                  name="description"
                  defaultValue={category.description}
                  className="input h-9 py-1 text-sm"
                  placeholder="Description (shown on the categories page)"
                  aria-label={`${category.name} description`}
                />
                <div className="flex items-center gap-1.5">
                  <button type="submit" className="btn-secondary btn-sm">
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm">
                <span className="font-medium text-ink-900">{category.name}</span>{' '}
                <span className="font-mono text-xs text-ink-500">/{category.slug}</span>
                {category.description ? <span className="text-ink-500"> · {category.description}</span> : null}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-ink-500">
                {category.courseCount} course{category.courseCount === 1 ? '' : 's'} ·{' '}
                {category.slug}
              </span>
              {canWrite ? (
                <div className="flex items-center gap-1.5">
                  <form action={moveCategoryAction}>
                    <input type="hidden" name="category_id" value={category.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="btn-ghost btn-sm px-2" aria-label="Move category up" disabled={index === 0}>
                      <ArrowUp className="size-4" aria-hidden />
                    </button>
                  </form>
                  <form action={moveCategoryAction}>
                    <input type="hidden" name="category_id" value={category.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      className="btn-ghost btn-sm px-2"
                      aria-label="Move category down"
                      disabled={index === categories.length - 1}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </button>
                  </form>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="category_id" value={category.id} />
                    <button type="submit" className="btn-ghost btn-sm px-2 text-danger" aria-label="Delete category">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </li>
        ))}
        {categories.length === 0 ? (
          <li className="rounded-xl border border-line p-3.5 text-sm text-ink-500">No categories yet.</li>
        ) : null}
      </ul>

      {canWrite ? (
        <form action={createCategoryAction} className="mt-4 grid gap-2.5 border-t border-line pt-4 sm:grid-cols-[1.2fr_1fr_1.6fr_auto] sm:items-center">
          <input name="name" placeholder="New category name" required minLength={2} className="input h-9 py-1 text-sm" />
          <input name="slug" placeholder="slug (optional)" className="input h-9 py-1 font-mono text-xs" />
          <input name="description" placeholder="Description (optional)" className="input h-9 py-1 text-sm" />
          <button type="submit" className="btn-secondary btn-sm">
            <Plus className="size-3.5" aria-hidden />
            Add category
          </button>
          <p className="flex items-center gap-1.5 text-xs text-ink-400 sm:col-span-4">
            <FolderPlus className="size-3.5" aria-hidden />
            The slug is generated from the name unless you set one.
          </p>
        </form>
      ) : null}
    </section>
  );
}
