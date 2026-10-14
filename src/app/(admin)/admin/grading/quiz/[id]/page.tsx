import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { attemptAnswers, attemptById } from '@/lib/queries/assessment';
import { QuizMarkingForm } from '@/components/admin/quiz-marking-form';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Mark a quiz · Admin' };

export default async function MarkQuizPage({ params }: PageProps<'/admin/grading/quiz/[id]'>) {
  const user = await requireStaff('/admin/grading');
  const { id } = await params;
  const attemptId = Number.parseInt(id, 10);
  if (!Number.isFinite(attemptId)) notFound();

  const attempt = attemptById(attemptId);
  if (!attempt) notFound();

  const answers = attemptAnswers(attemptId);
  const manual = answers.filter((answer) => answer.isCorrect === null && answer.type === 'essay');

  return (
    <div className="space-y-6">
      <Link href="/admin/grading" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Grading queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">Quiz attempt {attempt.attemptNo}</Badge>
            <Badge tone={attempt.status === 'graded' ? 'success' : 'warning'}>{attempt.status}</Badge>
          </div>
          <h1 className="page-title mt-2">{attempt.lessonTitle}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {attempt.userName} ({attempt.userEmail}) · {attempt.courseTitle} · submitted{' '}
            {timeAgo(attempt.submittedAt)} ({formatDateTime(attempt.submittedAt)})
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-500">
            Auto-marked: <strong className="text-ink-800">{attempt.autoPoints}</strong> of{' '}
            {attempt.maxPoints} total points
          </p>
          {attempt.scorePercent !== null ? (
            <p className="text-xs text-ink-500">
              Current score {attempt.scorePercent}% · {attempt.passed ? 'passed' : 'not passed'}
            </p>
          ) : null}
        </div>
      </div>

      {attempt.status === 'graded' ? (
        <div className="card p-5">
          <p className="text-sm text-ink-700">
            This attempt has already been graded ({attempt.scorePercent}%). Marks can no longer be
            changed from this screen - that keeps the audit trail honest.
          </p>
          <Link
            href={`/learn/courses/${attempt.courseSlug}/quiz/${attempt.lessonId}?attempt=${attemptId}`}
            className="btn-secondary btn-sm mt-3"
            target="_blank"
          >
            See what the learner sees
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : manual.length === 0 ? (
        <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
          There are no written answers left to mark on this attempt.
        </p>
      ) : (
        <div className="space-y-5">
          {answers.some((answer) => answer.isCorrect !== null) ? (
            <section className="card p-5">
              <h2 className="section-title">Automatically marked answers</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {answers
                  .filter((answer) => answer.isCorrect !== null)
                  .map((answer) => (
                    <li key={answer.questionId} className="flex items-start gap-2">
                      <span className={answer.isCorrect ? 'text-success' : 'text-danger'}>
                        {answer.isCorrect ? '✓' : '✗'}
                      </span>
                      <span className="flex-1 text-ink-700">{answer.prompt}</span>
                      <span className="whitespace-nowrap text-xs text-ink-500">
                        {answer.awardedPoints}/{answer.points}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <QuizMarkingForm
            attemptId={attemptId}
            answers={manual.map((answer) => ({
              questionId: answer.questionId,
              prompt: answer.prompt,
              text: answer.text,
              points: answer.points,
              feedback: answer.feedback,
              options: answer.options,
              correct: answer.correct,
            }))}
          />
        </div>
      )}

      <p className="text-xs text-ink-500">
        Signed in as {user.name}. Grading writes an audit entry and notifies the learner by email and
        in-app notification.
      </p>
    </div>
  );
}
