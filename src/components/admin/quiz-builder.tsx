'use client';

import { useActionState, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { deleteQuestionAction, saveQuestionAction } from '@/lib/actions/admin-course-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { Badge } from '@/components/ui/badge';
import type { AdminQuestion } from '@/lib/queries/admin-courses';

const TYPE_LABEL: Record<AdminQuestion['type'], string> = {
  single: 'Single choice',
  multiple: 'Multiple choice',
  truefalse: 'True / false',
  short: 'Short answer (auto-marked)',
  essay: 'Essay (manually marked)',
};

const TYPE_OPTIONS: AdminQuestion['type'][] = ['single', 'multiple', 'truefalse', 'short', 'essay'];

/**
 * Quiz builder: one form that adapts to the five question types, plus the list
 * of existing questions with delete actions.
 */
export function QuizBuilder({
  slug,
  lessonId,
  questions,
  canWrite,
}: {
  slug: string;
  lessonId: number;
  questions: AdminQuestion[];
  canWrite: boolean;
}) {
  const [state, action] = useActionState(saveQuestionAction, EMPTY_FORM_STATE);
  const [type, setType] = useState<AdminQuestion['type']>('single');
  const [options, setOptions] = useState<string[]>(['', '']);

  return (
    <section id="questions" className="space-y-4">
      <div>
        <h2 className="section-title">Quiz questions</h2>
        <p className="mt-1 text-sm text-ink-500">
          {questions.length} question{questions.length === 1 ? '' : 's'}. Single, multiple,
          true/false and short-answer questions are marked instantly; essays are marked by an admin.
        </p>
      </div>

      <ul className="space-y-3">
        {questions.map((question, index) => (
          <li key={question.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">Question {index + 1}</span>
                  <Badge tone="outline">{TYPE_LABEL[question.type]}</Badge>
                  <span>
                    {question.points} point{question.points === 1 ? '' : 's'}
                  </span>
                </p>
                <p className="mt-2 text-sm font-medium text-ink-900">{question.prompt}</p>

                {question.options.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-ink-600">
                    {question.options.map((option, optionIndex) => {
                      const isCorrect = question.correct.includes(optionIndex);
                      return (
                        <li key={optionIndex} className="flex items-center gap-2">
                          <span
                            className={`flex size-4 items-center justify-center rounded-full ${
                              isCorrect ? 'bg-success-soft text-success' : 'bg-ink-100 text-transparent'
                            }`}
                            aria-hidden
                          >
                            <Check className="size-3" />
                          </span>
                          {option}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {question.type === 'short' ? (
                  <p className="mt-2 text-xs text-ink-500">
                    Accepted:{' '}
                    {question.correct.map((value) => (
                      <code key={String(value)} className="mr-1 rounded bg-ink-100 px-1.5 py-0.5">
                        {String(value)}
                      </code>
                    ))}
                  </p>
                ) : null}

                {question.explanation ? (
                  <p className="mt-2 text-xs text-ink-500">Explanation: {question.explanation}</p>
                ) : null}
              </div>

              {canWrite ? (
                <form action={deleteQuestionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="lesson_id" value={lessonId} />
                  <input type="hidden" name="question_id" value={question.id} />
                  <button type="submit" className="btn-ghost btn-sm px-2 text-danger" aria-label="Delete question">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
        {questions.length === 0 ? (
          <li className="empty-state text-sm text-ink-500">No questions yet - add the first one below.</li>
        ) : null}
      </ul>

      {canWrite ? (
        <form action={action} className="card space-y-5 p-5">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="type" value={type} />

          <h3 className="text-sm font-semibold text-ink-900">Add a question</h3>

          {state.error ? (
            <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
            <div>
              <label className="label" htmlFor="question-type">
                Type
              </label>
              <select
                id="question-type"
                value={type}
                onChange={(event) => {
                  const next = event.target.value as AdminQuestion['type'];
                  setType(next);
                  setOptions(next === 'truefalse' ? ['True', 'False'] : ['', '']);
                }}
                className="input"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {TYPE_LABEL[option]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="prompt">
                Question
              </label>
              <textarea id="prompt" name="prompt" rows={2} required className="input" />
            </div>
          </div>

          {/* options */}
          {type === 'single' || type === 'multiple' ? (
            <fieldset>
              <legend className="label">
                Options {type === 'single' ? '(select the one correct answer)' : '(select all correct answers)'}
              </legend>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type={type === 'single' ? 'radio' : 'checkbox'}
                      name="correct_index"
                      value={index}
                      className="size-4"
                      aria-label={`Mark option ${index + 1} correct`}
                    />
                    <input
                      name="options"
                      value={option}
                      onChange={(event) => {
                        const next = [...options];
                        next[index] = event.target.value;
                        setOptions(next);
                      }}
                      placeholder={`Option ${index + 1}`}
                      className="input"
                    />
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                      className="btn-ghost btn-sm px-2 text-ink-500"
                      aria-label={`Remove option ${index + 1}`}
                      disabled={options.length <= 2}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setOptions([...options, ''])} className="btn-secondary btn-sm mt-2">
                <Plus className="size-3.5" aria-hidden />
                Add option
              </button>
              <p className="mt-2 text-xs text-ink-500">
                Correct answers are the radio/checkbox selections above.
              </p>
            </fieldset>
          ) : null}

          {type === 'truefalse' ? (
            <div>
              <label className="label" htmlFor="truefalse_correct">
                Correct answer
              </label>
              <select id="truefalse_correct" name="truefalse_correct" className="input w-auto" defaultValue="0">
                <option value="0">True</option>
                <option value="1">False</option>
              </select>
            </div>
          ) : null}

          {type === 'short' ? (
            <div>
              <label className="label" htmlFor="accepted">
                Accepted answers (one per line, case-insensitive)
              </label>
              <textarea
                id="accepted"
                name="accepted"
                rows={3}
                className="input font-mono text-[0.8125rem]"
                placeholder={'map\narray map'}
              />
            </div>
          ) : null}

          {type === 'essay' ? (
            <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Essay answers are queued for manual marking: they appear in the grading queue with the
              learner&rsquo;s name and the attempt.
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <div>
              <label className="label" htmlFor="explanation">
                Explanation shown after submission (optional)
              </label>
              <input id="explanation" name="explanation" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="points">
                Points
              </label>
              <input id="points" name="points" type="number" min={1} max={50} defaultValue={1} className="input" />
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton className="btn-primary" pendingLabel="Saving...">
              <Plus className="size-4" aria-hidden />
              Add question
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
