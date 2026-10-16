'use client';

import { useActionState, useState } from 'react';
import { Eye, Save, Upload } from 'lucide-react';
import { updateCourseSettingsAction } from '@/lib/actions/admin-course-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { renderMarkdown } from '@/lib/markdown';
import { fileUrl } from '@/lib/file-url';
import type { CategoryOption } from '@/lib/queries/admin-courses';

export interface CourseSettingsValues {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  level: string;
  price: string;
  instructorName: string;
  instructorBio: string;
  tags: string;
  outcomes: string;
  requirements: string;
  thumbnailPath: string | null;
  certificateEnabled: boolean;
  requiresQuizPass: boolean;
  requiresAssignments: boolean;
  featured: boolean;
}

export function CourseSettingsForm({
  values,
  categories,
  canWrite = true,
}: {
  values: CourseSettingsValues;
  categories: CategoryOption[];
  canWrite?: boolean;
}) {
  const [state, action] = useActionState(updateCourseSettingsAction, EMPTY_FORM_STATE);
  const [description, setDescription] = useState(values.description);
  const [previewDescription, setPreviewDescription] = useState(false);
  const readOnly = !canWrite;

  return (
    <form action={action} className="card space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Course settings</h2>
        {state.ok ? <span className="badge bg-success-soft text-success">{state.message}</span> : null}
      </div>

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="slug" value={values.slug} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={values.title}
            required
            minLength={3}
            className="input"
            aria-invalid={state.fieldErrors?.title ? true : undefined}
          />
          {state.fieldErrors?.title ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.title}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="subtitle">
            Subtitle
          </label>
          <input id="subtitle" name="subtitle" defaultValue={values.subtitle} className="input" />
        </div>

        <div>
          <label className="label" htmlFor="new_slug">
            URL slug
          </label>
          <input id="new_slug" name="new_slug" defaultValue={values.slug} className="input font-mono text-xs" />
          <p className="mt-1.5 text-xs text-ink-400">
            Changing this changes the public URL. Existing links to the old slug will 404.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="category_id">
            Category
          </label>
          <select id="category_id" name="category_id" defaultValue={values.categoryId} className="input">
            <option value="">Uncategorised</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="level">
              Level
            </label>
            <select id="level" name="level" defaultValue={values.level} className="input">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="price">
              Price (GBP)
            </label>
            <input id="price" name="price" defaultValue={values.price} className="input" inputMode="decimal" />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="description">
            Description (markdown)
          </label>
          <button
            type="button"
            onClick={() => setPreviewDescription((value) => !value)}
            className="btn-ghost btn-sm mb-1.5"
          >
            <Eye className="size-3.5" aria-hidden />
            {previewDescription ? 'Edit' : 'Preview'}
          </button>
        </div>
        {previewDescription ? (
          <div
            className="prose-lms min-h-32 rounded-xl border border-line bg-ink-50 p-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
          />
        ) : (
          <textarea
            id="description"
            name="description"
            rows={8}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="input font-mono text-[0.8125rem]"
            placeholder="## What this course is about"
          />
        )}
        {previewDescription ? <input type="hidden" name="description" value={description} /> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="outcomes">
            What you will learn (one per line)
          </label>
          <textarea id="outcomes" name="outcomes" rows={6} defaultValue={values.outcomes} className="input font-mono text-[0.8125rem]" />
        </div>
        <div>
          <label className="label" htmlFor="requirements">
            Requirements
          </label>
          <textarea id="requirements" name="requirements" rows={6} defaultValue={values.requirements} className="input" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="instructor_name">
            Instructor name
          </label>
          <input id="instructor_name" name="instructor_name" defaultValue={values.instructorName} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="tags">
            Tags (comma separated)
          </label>
          <input id="tags" name="tags" defaultValue={values.tags} className="input" placeholder="typescript, testing" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="instructor_bio">
            Instructor bio
          </label>
          <textarea id="instructor_bio" name="instructor_bio" rows={3} defaultValue={values.instructorBio} className="input" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <span className="label">Thumbnail</span>
          <div className="flex items-center gap-3">
            <span className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-100">
              {values.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static asset
                <img src={fileUrl(values.thumbnailPath)} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <label className="btn-secondary btn-sm cursor-pointer">
              <Upload className="size-4" aria-hidden />
              Replace
              <input type="file" name="thumbnail" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-ink-400">PNG, JPG, WebP or SVG up to 8 MB. 16:9 works best.</p>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="label">Completion rules</legend>
          <Checkbox name="certificate_enabled" defaultChecked={values.certificateEnabled} label="Issue a certificate on completion" />
          <Checkbox name="requires_quiz_pass" defaultChecked={values.requiresQuizPass} label="Require quiz pass marks for completion" />
          <Checkbox
            name="requires_assignments"
            defaultChecked={values.requiresAssignments}
            label="Require assignments to be graded for completion"
          />
          <Checkbox
            name="featured"
            defaultChecked={values.featured}
            label="Feature on the home page (published courses only)"
          />
        </fieldset>
      </div>

      <div className="flex justify-end">
        {readOnly ? (
          <p className="text-sm text-ink-500">Auditor accounts are read-only.</p>
        ) : (
          <SubmitButton className="btn-primary" pendingLabel="Saving...">
            <Save className="size-4" aria-hidden />
            Save settings
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 rounded border-line-strong" />
      {label}
    </label>
  );
}
