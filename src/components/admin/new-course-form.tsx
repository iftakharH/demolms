'use client';

import { useActionState } from 'react';
import { BookPlus } from 'lucide-react';
import { createCourseAction } from '@/lib/actions/admin-course-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * One field is enough to start: the draft opens straight in the builder, where
 * category, level, price and the rest live alongside the content.
 */
export function NewCourseForm() {
  const [state, action] = useActionState(createCourseAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="title">
          Course title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          className="input"
          placeholder="e.g. Practical Rust for Backend Engineers"
        />
        <p className="mt-1.5 text-xs text-ink-400">
          The URL slug is generated from the title. Everything else - category, level, price,
          settings - is set in the builder this opens next.
        </p>
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
