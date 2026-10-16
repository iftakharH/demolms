'use client';

import { useActionState, useState } from 'react';
import { Eye, Save } from 'lucide-react';
import { updateLessonAction } from '@/lib/actions/admin-course-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { renderMarkdown } from '@/lib/markdown';

export interface LessonEditorValues {
  id: number;
  slug: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  title: string;
  durationMinutes: number;
  isPreview: boolean;
  bodyMd: string;
  videoPath: string | null;
  captionsPath: string | null;
  posterPath: string | null;
  quizPassPercent: number;
  quizMaxAttempts: number;
  quizShowAnswers: boolean;
  assignmentBriefMd: string;
  assignmentMaxScore: number;
  assignmentAllowFiles: boolean;
}

/** Common lesson fields plus the block for this lesson type. */
export function LessonEditor({
  values,
  canWrite,
}: {
  values: LessonEditorValues;
  canWrite: boolean;
}) {
  const [state, action] = useActionState(updateLessonAction, EMPTY_FORM_STATE);
  const [body, setBody] = useState(values.bodyMd);
  const [brief, setBrief] = useState(values.assignmentBriefMd);
  const [previewBody, setPreviewBody] = useState(false);
  const [previewBrief, setPreviewBrief] = useState(false);

  return (
    <form action={action} className="card space-y-6 p-5 sm:p-6">
      <input type="hidden" name="lesson_id" value={values.id} />
      <input type="hidden" name="slug" value={values.slug} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Lesson details</h2>
        {state.ok ? <span className="badge bg-success-soft text-success">{state.message}</span> : null}
      </div>

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className="label" htmlFor="title">
            Lesson title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={values.title}
            required
            minLength={2}
            className="input"
            aria-invalid={state.fieldErrors?.title ? true : undefined}
          />
          {state.fieldErrors?.title ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.title}</p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="duration">
            Minutes
          </label>
          <input
            id="duration"
            name="duration"
            type="number"
            min={0}
            max={600}
            defaultValue={values.durationMinutes}
            className="input"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="is_preview"
          defaultChecked={values.isPreview}
          className="mt-0.5 size-4 rounded border-line-strong"
        />
        <span>
          <span className="font-medium text-ink-800">Free preview</span>
          <span className="block text-xs text-ink-500">
            Anyone (signed in or not) can open this lesson from the course page.
          </span>
        </span>
      </label>

      {/* ------------------------------------------------------------ text */}
      {values.type === 'text' ? (
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="body_md">
              Article content (markdown)
            </label>
            <button type="button" onClick={() => setPreviewBody((value) => !value)} className="btn-ghost btn-sm mb-1.5">
              <Eye className="size-3.5" aria-hidden />
              {previewBody ? 'Edit' : 'Preview'}
            </button>
          </div>
          {previewBody ? (
            <div
              className="prose-lms min-h-40 rounded-xl border border-line bg-ink-50 p-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
            />
          ) : (
            <textarea
              id="body_md"
              name="body_md"
              rows={16}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="input font-mono text-[0.8125rem]"
              placeholder={'## Heading\n\nWrite the lesson here. Code blocks use triple backticks.'}
            />
          )}
          {previewBody ? <input type="hidden" name="body_md" value={body} /> : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ quiz */}
      {values.type === 'quiz' ? (
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="pass_percent">
              Pass mark (%)
            </label>
            <input
              id="pass_percent"
              name="pass_percent"
              type="number"
              min={0}
              max={100}
              defaultValue={values.quizPassPercent}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="max_attempts">
              Attempts allowed
            </label>
            <input
              id="max_attempts"
              name="max_attempts"
              type="number"
              min={1}
              max={20}
              defaultValue={values.quizMaxAttempts}
              className="input"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 pt-6 text-sm text-ink-700">
            <input
              type="checkbox"
              name="show_answers"
              defaultChecked={values.quizShowAnswers}
              className="mt-0.5 size-4 rounded border-line-strong"
            />
            <span>
              <span className="font-medium text-ink-800">Show correct answers</span>
              <span className="block text-xs text-ink-500">After submitting an attempt.</span>
            </span>
          </label>
          <p className="text-xs text-ink-500 sm:col-span-3">
            Add and edit the questions below the lesson form.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------------ assignment */}
      {values.type === 'assignment' ? (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="brief_md">
                Assignment brief (markdown)
              </label>
              <button type="button" onClick={() => setPreviewBrief((value) => !value)} className="btn-ghost btn-sm mb-1.5">
                <Eye className="size-3.5" aria-hidden />
                {previewBrief ? 'Edit' : 'Preview'}
              </button>
            </div>
            {previewBrief ? (
              <div
                className="prose-lms min-h-32 rounded-xl border border-line bg-ink-50 p-4"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(brief) }}
              />
            ) : (
              <textarea
                id="brief_md"
                name="brief_md"
                rows={10}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                className="input font-mono text-[0.8125rem]"
                placeholder="Explain what to submit and how it will be marked."
              />
            )}
            {previewBrief ? <input type="hidden" name="brief_md" value={brief} /> : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="max_score">
                Maximum score
              </label>
              <input
                id="max_score"
                name="max_score"
                type="number"
                min={1}
                max={1000}
                defaultValue={values.assignmentMaxScore}
                className="input"
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 pt-6 text-sm text-ink-700">
              <input
                type="checkbox"
                name="allow_files"
                defaultChecked={values.assignmentAllowFiles}
                className="mt-0.5 size-4 rounded border-line-strong"
              />
              <span>
                <span className="font-medium text-ink-800">Allow file uploads</span>
                <span className="block text-xs text-ink-500">Learners can also submit text alone.</span>
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------------- video */}
      {values.type === 'video' ? (
        <fieldset className="space-y-4 rounded-xl border border-line bg-ink-50 p-4">
          <legend className="px-1.5 text-sm font-semibold text-ink-800">Video files</legend>
          <p className="text-xs text-ink-500">
            MP4 (H.264) plays everywhere; WebVTT adds the captions toggle in the player. Files are
            written to <code className="rounded bg-surface px-1">public/uploads</code> when you save.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <UploadField
              name="video"
              label="Video (mp4 / webm, up to 200 MB)"
              accept="video/mp4,video/webm"
              current={values.videoPath}
            />
            <UploadField
              name="captions"
              label="Captions (.vtt / .srt)"
              accept=".vtt,.srt"
              current={values.captionsPath}
            />
            <UploadField
              name="poster"
              label="Poster image"
              accept="image/png,image/jpeg,image/webp"
              current={values.posterPath}
            />
          </div>
        </fieldset>
      ) : null}

      {canWrite ? (
        <div className="flex justify-end">
          <SubmitButton className="btn-primary" pendingLabel="Saving...">
            <Save className="size-4" aria-hidden />
            Save lesson
          </SubmitButton>
        </div>
      ) : (
        <p className="text-sm text-ink-500">Auditor accounts are read-only.</p>
      )}
    </form>
  );
}

function UploadField({
  name,
  label,
  accept,
  current,
}: {
  name: string;
  label: string;
  accept: string;
  current: string | null;
}) {
  return (
    <div>
      <label className="label" htmlFor={`upload-${name}`}>
        {label}
      </label>
      <input id={`upload-${name}`} name={name} type="file" accept={accept} className="input py-2 text-xs" />
      <p className={`mt-1.5 truncate text-xs ${current ? 'text-success' : 'text-warning'}`} title={current ?? ''}>
        {current ? `current: ${current}` : 'nothing uploaded yet'}
      </p>
    </div>
  );
}
