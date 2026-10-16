'use client';

import { useActionState } from 'react';
import { Check } from 'lucide-react';
import { gradeQuizAttemptAction } from '@/lib/actions/assessment-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/** Manual marking form for the written answers on a quiz attempt. */
export function QuizMarkingForm({
  attemptId,
  answers,
}: {
  attemptId: number;
  answers: {
    questionId: number;
    prompt: string;
    text: string;
    points: number;
    feedback: string;
    options: string[];
    correct: (number | string)[];
  }[];
}) {
  const [state, action] = useActionState(gradeQuizAttemptAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="attempt_id" value={attemptId} />

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
          {state.message}
        </p>
      ) : null}

      {answers.map((answer, index) => (
        <div key={answer.questionId} className="card p-5">
          <p className="text-sm font-medium text-ink-900">
            <span className="mr-2 text-ink-400">{index + 1}.</span>
            {answer.prompt}
          </p>

          <div className="mt-3 rounded-xl border border-line bg-ink-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Learner answer</p>
            <p className="mt-2 text-sm whitespace-pre-wrap text-ink-800">{answer.text || '(blank)'}</p>
          </div>

          {answer.options.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-ink-500">
              {answer.options.map((option, optionIndex) => (
                <li key={optionIndex} className={answer.correct.includes(optionIndex) ? 'text-success' : ''}>
                  {answer.correct.includes(optionIndex) ? '✓ ' : '· '}
                  {option}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
              <label className="label" htmlFor={`points_${answer.questionId}`}>
                Points (max {answer.points})
              </label>
              <input
                id={`points_${answer.questionId}`}
                name={`points_${answer.questionId}`}
                type="number"
                min={0}
                max={answer.points}
                step="0.5"
                defaultValue={(answer.points * 0.6).toFixed(1)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor={`feedback_${answer.questionId}`}>
                Feedback on this answer
              </label>
              <textarea
                id={`feedback_${answer.questionId}`}
                name={`feedback_${answer.questionId}`}
                rows={2}
                className="input"
                defaultValue={answer.feedback && !answer.feedback.startsWith('Your instructor') ? answer.feedback : ''}
                placeholder="What was good, what to fix next time"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Saving marks...">
          <Check className="size-4" aria-hidden />
          Save marks and notify the learner
        </SubmitButton>
      </div>
    </form>
  );
}
