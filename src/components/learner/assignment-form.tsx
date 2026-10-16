'use client';

import { useActionState, useState } from 'react';
import { Upload, Send } from 'lucide-react';
import { submitAssignmentAction } from '@/lib/actions/assessment-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/** Assignment submission: text, file, or both. */
export function AssignmentForm({
  lessonId,
  allowFiles,
  defaultText,
  resubmission = false,
}: {
  lessonId: number;
  allowFiles: boolean;
  defaultText?: string;
  resubmission?: boolean;
}) {
  const [state, action] = useActionState(submitAssignmentAction, EMPTY_FORM_STATE);
  const [fileName, setFileName] = useState('');

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="lesson_id" value={lessonId} />

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="body_text">
          {resubmission ? 'Updated answer' : 'Your answer'}
        </label>
        <textarea
          id="body_text"
          name="body_text"
          rows={10}
          defaultValue={defaultText}
          className="input"
          placeholder="Explain what you did, the decisions you made and anything you would change."
          aria-invalid={state.fieldErrors?.body_text ? true : undefined}
        />
        {state.fieldErrors?.body_text ? (
          <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.body_text}</p>
        ) : null}
      </div>

      {allowFiles ? (
        <div>
          <label className="label" htmlFor="file">
            Attachment (optional)
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-600 transition hover:border-brand-300">
            <Upload className="size-4 text-ink-400" aria-hidden />
            <span className="flex-1">{fileName || 'Choose a file (pdf, zip, txt, md, csv, image, docx)'}</span>
            <input
              id="file"
              name="file"
              type="file"
              className="sr-only"
              accept=".pdf,.zip,.txt,.md,.csv,.png,.jpg,.jpeg,.docx"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
            />
          </label>
          <p className="mt-1.5 text-xs text-ink-400">
            Files are stored locally and are only ever served to you and your instructor.
          </p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Submitting...">
          <Send className="size-4" aria-hidden />
          {resubmission ? 'Submit updated work' : 'Submit assignment'}
        </SubmitButton>
      </div>
    </form>
  );
}
