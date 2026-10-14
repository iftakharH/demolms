import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { activeEnrolment } from '@/lib/progress';
import { attemptAnswers, attemptsFor, quizLesson, quizQuestions } from '@/lib/queries/assessment';
import { QuizForm } from '@/components/learner/quiz-form';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { formatDateTime, formatPercent, timeAgo } from '@/lib/format';
import { MarkComplete } from '@/components/learner/mark-complete';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Quiz',
  robots: { index: false },
};

export default async function QuizPage({
  params,
  searchParams,
}: PageProps<'/learn/courses/[slug]/quiz/[lessonId]'>) {
  const { slug, lessonId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/learn/courses/${slug}`);

  const lesson = quizLesson(Number.parseInt(lessonId, 10));
  if (!lesson || lesson.courseSlug !== slug) notFound();

  const enrolment = activeEnrolment(user.id, lesson.courseId);
  if (!enrolment) redirect(`/courses/${slug}?access=needed`);

  const questions = quizQuestions(lesson.id);
  const attempts = attemptsFor(lesson.id, user.id);
  const attemptsUsed = attempts.length;
  const attemptsLeft = Math.max(0, lesson.maxAttempts - attemptsUsed);
  const best = attempts.reduce<number | null>(
    (max, attempt) => (attempt.scorePercent !== null && (max === null || attempt.scorePercent > max) ? attempt.scorePercent : max),
    null,
  );
  const pendingAttempt = attempts.find((attempt) => attempt.status === 'pending_review');

  const requestedAttemptId = Number.parseInt(String(query.attempt ?? ''), 10);
  const viewing =
    attempts.find((attempt) => attempt.id === requestedAttemptId) ??
    (query.submitted === '1' ? attempts[0] : pendingAttempt) ??
    (best !== null ? attempts.find((attempt) => attempt.scorePercent === best) : undefined);

  const answers = viewing ? attemptAnswers(viewing.id) : [];
  const canRetry = attemptsLeft > 0 && (!viewing || viewing.status === 'graded');

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={`/learn/courses/${slug}?lesson=${lesson.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {lesson.courseTitle}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Quiz</Badge>
          <Badge tone="outline">Pass mark {lesson.passPercent}%</Badge>
          <Badge tone="outline">
            {attemptsLeft > 0 ? `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left` : 'No attempts left'}
          </Badge>
          {lesson.showAnswers ? <Badge tone="info">Answers shown after submit</Badge> : null}
        </div>
        <h1 className="page-title mt-3">{lesson.title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {questions.length} question{questions.length === 1 ? '' : 's'} ·{' '}
          {questions.filter((question) => question.type === 'essay').length > 0
            ? 'includes a written answer marked by your instructor'
            : 'all answers are marked instantly'}
        </p>
      </div>

      {viewing ? (
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {viewing.status === 'graded' ? (
                viewing.passed ? (
                  <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 size-7 shrink-0 text-danger" aria-hidden />
                )
              ) : (
                <Clock className="mt-0.5 size-7 shrink-0 text-warning" aria-hidden />
              )}
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {viewing.status === 'graded'
                    ? viewing.passed
                      ? `Passed with ${formatPercent(viewing.scorePercent, 1)}`
                      : `Not passed - ${formatPercent(viewing.scorePercent, 1)}`
                    : 'Submitted - waiting for your instructor'}
                </h2>
                <p className="mt-1 text-sm text-ink-600">
                  {viewing.status === 'graded'
                    ? `Attempt ${viewing.attemptNo}: ${viewing.totalPoints} of ${viewing.maxPoints} points. Pass mark ${lesson.passPercent}%.`
                    : `Attempt ${viewing.attemptNo}: auto-marked ${viewing.autoPoints} of ${viewing.maxPoints} points so far. The written answer is with your instructor.`}
                </p>
              </div>
            </div>
            <div className="w-40">
              <ProgressBar
                value={viewing.scorePercent ?? viewing.autoPoints}
                max={viewing.scorePercent === null ? viewing.maxPoints : 100}
                label="Attempt score"
              />
              <p className="mt-1.5 text-right text-xs text-ink-500">
                {viewing.status === 'graded' ? formatPercent(viewing.scorePercent, 1) : 'pending'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canRetry && query.retry !== '1' ? (
              <Link href={`/learn/courses/${slug}/quiz/${lesson.id}?retry=1`} className="btn-primary">
                <RefreshCw className="size-4" aria-hidden />
                {attemptsUsed === 0 ? 'Start the quiz' : `Try again (${attemptsLeft} left)`}
              </Link>
            ) : null}
            <Link href={`/learn/courses/${slug}?lesson=${lesson.id}`} className="btn-ghost">
              Back to the lesson
            </Link>
          </div>
        </div>
      ) : null}

      {viewing && viewing.status === 'graded' && lesson.showAnswers ? (
        <section className="space-y-4">
          <h2 className="section-title">Your answers</h2>
          {answers.map((answer, index) => (
            <div key={answer.questionId} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="flex-1 text-sm font-medium text-ink-900">
                  <span className="mr-2 text-ink-400">{index + 1}.</span>
                  {answer.prompt}
                </p>
                {answer.isCorrect === null ? (
                  <Badge tone="brand">Manually marked</Badge>
                ) : answer.isCorrect ? (
                  <Badge tone="success">Correct</Badge>
                ) : (
                  <Badge tone="danger">Incorrect</Badge>
                )}
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                {answer.options.length > 0 ? (
                  answer.options.map((option, optionIndex) => {
                    const chosen = answer.choices.includes(optionIndex);
                    const correct = answer.correct.includes(optionIndex);
                    return (
                      <p
                        key={optionIndex}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                          correct
                            ? 'bg-success-soft text-emerald-900'
                            : chosen
                              ? 'bg-danger-soft text-danger'
                              : 'text-ink-600'
                        }`}
                      >
                        {correct ? '✓' : chosen ? '✗' : '·'} {option}
                        {chosen ? <span className="text-xs opacity-70">(your answer)</span> : null}
                      </p>
                    );
                  })
                ) : (
                  <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-700 whitespace-pre-wrap">
                    {answer.text || '(no answer)'}
                  </p>
                )}
              </div>

              <p className="mt-3 text-xs text-ink-500">
                {answer.awardedPoints ?? 0} / {answer.points} points · {answer.feedback}
              </p>
              {answer.explanation ? (
                <p className="mt-2 rounded-lg border border-line bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  {answer.explanation}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {viewing ? (
        <section className="card p-5">
          <h2 className="section-title">Attempt history</h2>
          <ul className="mt-3 divide-y divide-line">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">
                    Attempt {attempt.attemptNo}
                    {attempt.status === 'pending_review' ? ' · awaiting review' : ''}
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatDateTime(attempt.submittedAt)} ({timeAgo(attempt.submittedAt)})
                    {attempt.reviewedAt ? ` · reviewed ${timeAgo(attempt.reviewedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {attempt.status === 'graded' ? (
                    <Badge tone={attempt.passed ? 'success' : 'danger'}>
                      {formatPercent(attempt.scorePercent, 1)}
                    </Badge>
                  ) : (
                    <Badge tone="warning">pending</Badge>
                  )}
                  <Link
                    href={`/learn/courses/${slug}/quiz/${lesson.id}?attempt=${attempt.id}`}
                    className="link text-sm"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!viewing || query.retry === '1' ? (
        attemptsLeft > 0 ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-title">Attempt the quiz</h2>
              {best !== null ? (
                <p className="text-sm text-ink-500">
                  Best so far: <strong className="text-ink-800">{formatPercent(best, 1)}</strong>
                </p>
              ) : null}
            </div>
            <QuizForm
              lessonId={lesson.id}
              questions={questions}
              attemptsUsed={attemptsUsed}
              maxAttempts={lesson.maxAttempts}
            />
          </section>
        ) : (
          <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
            You have used all {lesson.maxAttempts} attempts. Your best score is{' '}
            {formatPercent(best, 1)}.
          </p>
        )
      ) : null}

      <div className="card p-5">
        <MarkComplete
          lessonId={lesson.id}
          completed={Boolean(pendingAttempt || (best !== null && best >= lesson.passPercent))}
          nextLabel="Next lesson"
        />
      </div>
    </div>
  );
}
