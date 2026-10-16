import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, FileText, RotateCcw } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { activeEnrolment } from '@/lib/progress';
import { assignmentLesson, submissionsFor } from '@/lib/queries/assessment';
import { AssignmentForm } from '@/components/learner/assignment-form';
import { Badge, SubmissionStatusBadge } from '@/components/ui/badge';
import { renderMarkdown } from '@/lib/markdown';
import { formatDateTime, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Assignment',
  robots: { index: false },
};

export default async function AssignmentPage({
  params,
  searchParams,
}: PageProps<'/learn/courses/[slug]/assignment/[lessonId]'>) {
  const { slug, lessonId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/learn/courses/${slug}`);

  const assignment = assignmentLesson(Number.parseInt(lessonId, 10));
  if (!assignment || assignment.courseSlug !== slug) notFound();

  const enrolment = activeEnrolment(user.id, assignment.courseId);
  if (!enrolment) redirect(`/courses/${slug}?access=needed`);

  const submissions = submissionsFor(assignment.id, user.id);
  const latest = submissions[0];
  const canSubmit = !latest || latest.status === 'resubmission_requested';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href={`/learn/courses/${slug}?lesson=${assignment.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {assignment.courseTitle}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Assignment</Badge>
          <Badge tone="outline">Marked out of {assignment.maxScore}</Badge>
          {assignment.allowFiles ? <Badge tone="outline">File uploads allowed</Badge> : null}
        </div>
        <h1 className="page-title mt-3">{assignment.title}</h1>
        {assignment.briefMd ? (
          <div
            className="prose-lms mt-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(assignment.briefMd) }}
          />
        ) : (
          <p className="mt-4 text-sm text-ink-500">Your instructor has not written a brief yet.</p>
        )}
      </div>

      {query.submitted === '1' ? (
        <p className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-strong">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          Submitted. Your instructor will grade it and you will get an email with the feedback.
        </p>
      ) : null}

      {latest ? (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Your latest submission</h2>
            <SubmissionStatusBadge status={latest.status} />
          </div>

          <p className="mt-2 text-xs text-ink-500">
            Submitted {formatDateTime(latest.submittedAt)} ({timeAgo(latest.submittedAt)})
            {latest.gradedAt ? ` · graded ${timeAgo(latest.gradedAt)}` : ''}
          </p>

          <div className="mt-4 rounded-xl border border-line bg-ink-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Your answer</p>
            <p className="mt-2 text-sm whitespace-pre-wrap text-ink-700">{latest.bodyText || '(no text)'}</p>
            {latest.fileName ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-ink-600">
                <FileText className="size-3.5" aria-hidden />
                {latest.fileName}
                {latest.fileId ? (
                  <a href={`/api/submissions/${latest.id}`} className="link">
                    download
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>

          {latest.status === 'graded' ? (
            <div className="mt-4 rounded-xl border border-success-line bg-success-soft p-4">
              <p className="text-sm font-semibold text-success-strong">
                Score: {latest.score} / {latest.maxScore}
              </p>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-success-strong/90">{latest.feedback}</p>
            </div>
          ) : latest.status === 'resubmission_requested' ? (
            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-950">
                <RotateCcw className="size-4" aria-hidden />
                Your instructor asked for a resubmission
              </p>
              <p className="mt-1.5 text-sm text-brand-950/90">{latest.feedback}</p>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-600">
              <Clock className="size-4 text-warning" aria-hidden />
              Waiting to be graded. You will get an email as soon as it is reviewed.
            </p>
          )}
        </section>
      ) : null}

      {canSubmit ? (
        <section className="card p-5">
          <h2 className="section-title">
            {latest ? 'Submit your updated work' : 'Submit your work'}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Text, a file, or both. Each submission is kept, so nothing is lost if you resubmit.
          </p>
          <div className="mt-5">
            <AssignmentForm
              lessonId={assignment.id}
              allowFiles={assignment.allowFiles}
              resubmission={Boolean(latest)}
            />
          </div>
        </section>
      ) : null}

      {submissions.length > 1 ? (
        <section className="card p-5">
          <h2 className="section-title">Submission history</h2>
          <ul className="mt-3 divide-y divide-line">
            {submissions.slice(1).map((submission) => (
              <li key={submission.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm text-ink-800">{formatDateTime(submission.submittedAt)}</p>
                  <p className="text-xs text-ink-500">
                    {submission.score !== null ? `Scored ${submission.score}/${submission.maxScore}` : 'Not graded'}
                  </p>
                </div>
                <SubmissionStatusBadge status={submission.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
