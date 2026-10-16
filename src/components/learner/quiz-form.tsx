'use client';

import { useActionState, useEffect, useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { submitQuizAction } from '@/lib/actions/assessment-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import type { QuizQuestion } from '@/lib/quiz';

const DRAFT_KEY = 'demolms-quiz-draft';

/**
 * Quiz attempt form. Answers are kept in a local draft so a refresh does not
 * lose work (the demo take is long enough that this matters), and submission is
 * a server action that marks everything it can automatically.
 */
export function QuizForm({
  lessonId,
  questions,
  attemptsUsed,
  maxAttempts,
}: {
  lessonId: number;
  questions: QuizQuestion[];
  attemptsUsed: number;
  maxAttempts: number;
}) {
  const [state, action] = useActionState(submitQuizAction, EMPTY_FORM_STATE);
  const [restored, setRestored] = useState(false);
  const draftKey = `${DRAFT_KEY}:${lessonId}`;

  // restore a draft on mount (deferred a tick so it does not set state during
  // the effect body - React's lint rules and render behaviour both prefer this)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (!raw) return;
        const draft = JSON.parse(raw) as Record<string, string | string[]>;
        for (const [key, value] of Object.entries(draft)) {
          const elements = document.getElementsByName(key);
          for (const element of Array.from(elements)) {
            const input = element as HTMLInputElement;
            if (input.type === 'radio') {
              input.checked = input.value === value;
            } else if (input.type === 'checkbox') {
              input.checked = Array.isArray(value) && value.includes(input.value);
            } else {
              // textarea and text inputs both expose .value
              input.value = String(value);
            }
          }
        }
        setRestored(true);
      } catch {
        /* ignore a corrupt draft */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  // save the draft as the learner types
  useEffect(() => {
    const onChange = () => {
      const draft: Record<string, string | string[]> = {};
      const form = document.querySelector<HTMLFormElement>(`form[data-quiz-form="${lessonId}"]`);
      if (!form) return;
      const data = new FormData(form);
      for (const [key, value] of data.entries()) {
        if (key === 'lesson_id') continue;
        const existing = draft[key];
        if (existing === undefined) {
          draft[key] = typeof value === 'string' ? value : '';
        } else if (Array.isArray(existing)) {
          existing.push(String(value));
        } else {
          draft[key] = [existing, String(value)];
        }
      }
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        /* storage full or blocked - drafting is a convenience, not a requirement */
      }
    };
    const form = document.querySelector<HTMLFormElement>(`form[data-quiz-form="${lessonId}"]`);
    form?.addEventListener('change', onChange);
    form?.addEventListener('input', onChange);
    return () => {
      form?.removeEventListener('change', onChange);
      form?.removeEventListener('input', onChange);
    };
  }, [draftKey, lessonId]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  return (
    <form action={action} data-quiz-form={lessonId} className="space-y-5" onReset={clearDraft}>
      <input type="hidden" name="lesson_id" value={lessonId} />

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {restored ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
          We restored your unsaved answers from this browser.
        </p>
      ) : null}

      <ol className="space-y-5">
        {questions.map((question, index) => (
          <li key={question.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="flex-1 text-sm font-medium text-ink-900">
                <span className="mr-2 text-ink-400">{index + 1}.</span>
                {question.prompt}
              </p>
              <span className="text-xs whitespace-nowrap text-ink-500">
                {question.points} point{question.points === 1 ? '' : 's'}
                {question.type === 'essay' ? ' · marked by hand' : ''}
              </span>
            </div>

            <div className="mt-4">
              {question.type === 'single' || question.type === 'truefalse' ? (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink-700 transition hover:border-brand-300"
                    >
                      <input
                        type="radio"
                        name={`q_${question.id}`}
                        value={optionIndex}
                        className="size-4"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : null}

              {question.type === 'multiple' ? (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink-700 transition hover:border-brand-300"
                    >
                      <input type="checkbox" name={`q_${question.id}`} value={optionIndex} className="size-4" />
                      {option}
                    </label>
                  ))}
                  <p className="text-xs text-ink-500">Select every answer that applies.</p>
                </div>
              ) : null}

              {question.type === 'short' ? (
                <input
                  name={`q_${question.id}`}
                  className="input"
                  placeholder="Your answer"
                  autoComplete="off"
                />
              ) : null}

              {question.type === 'essay' ? (
                <textarea
                  name={`q_${question.id}`}
                  rows={6}
                  className="input"
                  placeholder="Write your answer. Your instructor marks this one by hand, so explain your reasoning."
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="flex items-start gap-2 text-sm text-ink-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          Attempt {attemptsUsed + 1} of {maxAttempts}. Submitting uses one attempt.
        </p>
        <SubmitButton className="btn-primary" pendingLabel="Marking...">
          <Send className="size-4" aria-hidden />
          Submit attempt
        </SubmitButton>
      </div>
    </form>
  );
}
