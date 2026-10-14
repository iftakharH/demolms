'use client';

import { useActionState, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { gradeSubmissionAction } from '@/lib/actions/assessment-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/** Assignment grading form: score + written feedback + optional resubmission request. */
export function AssignmentGradingForm({
  submissionId,
  maxScore,
  defaultScore,
}: {
  submissionId: number;
  maxScore: number;
  defaultScore: number | null;
}) {
  const [state, action] = useActionState(gradeSubmissionAction, EMPTY_FORM_STATE);
  const [resubmission, setResubmission] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="submission_id" value={submissionId} />

      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-success-soft px-3.5 py-2.5 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label className="label" htmlFor="score">
            Score (out of {maxScore})
          </label>
          <input
            id="score"
            name="score"
            type="number"
            min={0}
            max={maxScore}
            step="1"
            defaultValue={defaultScore ?? Math.round(maxScore * 0.7)}
            disabled={resubmission}
            className="input"
            aria-invalid={state.fieldErrors?.score ? true : undefined}
          />
          {state.fieldErrors?.score ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.score}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="feedback">
            Written feedback
          </label>
          <textarea
            id="feedback"
            name="feedback"
            rows={6}
            required
            className="input"
            placeholder="What worked, what to improve, and the next step."
            aria-invalid={state.fieldErrors?.feedback ? true : undefined}
          />
          {state.fieldErrors?.feedback ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.feedback}</p>
          ) : null}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-dashed border-line-strong p-3.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="request_resubmission"
          checked={resubmission}
          onChange={(event) => setResubmission(event.target.checked)}
          className="mt-0.5 size-4 rounded border-line-strong"
        />
        <span>
          <span className="font-medium text-ink-800">Request a resubmission instead of grading</span>
          <span className="block text-xs text-ink-500">
            The learner is asked to submit again; the course does not count this assignment as done
            until a graded submission exists.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton
          className={resubmission ? 'btn-secondary' : 'btn-primary'}
          pendingLabel="Saving..."
        >
          {resubmission ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {resubmission ? 'Request resubmission' : 'Save grade and notify'}
        </SubmitButton>
      </div>
    </form>
  );
}
