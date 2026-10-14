'use client';

import { useActionState } from 'react';
import { BookPlus } from 'lucide-react';
import { createCourseAction } from '@/lib/actions/admin-course-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import type { CategoryOption } from '@/lib/queries/admin-courses';

export function NewCourseForm({ categories }: { categories: CategoryOption[] }) {
  const [state, action] = useActionState(createCourseAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="title">
          Course title
        </label>
        <input id="title" name="title" required minLength={3} className="input" placeholder="e.g. Practical Rust for Backend Engineers" />
        <p className="mt-1.5 text-xs text-ink-400">
          The URL slug is generated from the title and can be changed later.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="category_id">
            Category
          </label>
          <select id="category_id" name="category_id" className="input" defaultValue="">
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="level">
            Level
          </label>
          <select id="level" name="level" className="input" defaultValue="beginner">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">
            Price (GBP)
          </label>
          <input id="price" name="price" className="input" placeholder="0.00" defaultValue="0.00" inputMode="decimal" />
          <p className="mt-1.5 text-xs text-ink-400">0 makes it a free course.</p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Creating...">
          <BookPlus className="size-4" aria-hidden />
          Create draft course
        </SubmitButton>
      </div>
    </form>
  );
}
