import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, Paperclip } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { submissionById } from '@/lib/queries/assessment';
import { AssignmentGradingForm } from '@/components/admin/assignment-grading-form';
import { Badge, SubmissionStatusBadge } from '@/components/ui/badge';
import { formatDateTime, timeAgo } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Grade a submission · Admin' };

export default async function GradeSubmissionPage({
  params,
}: PageProps<'/admin/grading/assignment/[id]'>) {
  await requireStaff('/admin/grading');
  const { id } = await params;
  const submissionId = Number.parseInt(id, 10);
  if (!Number.isFinite(submissionId)) notFound();

  const submission = submissionById(submissionId);
  if (!submission) notFound();

  const alreadyGraded = submission.status === 'graded';

  return (
    <div className="space-y-6">
      <Link href="/admin/grading" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Grading queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">Assignment</Badge>
            <SubmissionStatusBadge status={submission.status} />
          </div>
          <h1 className="page-title mt-2">{submission.lessonTitle}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {submission.userName} ({submission.userEmail}) · {submission.courseTitle} · submitted{' '}
            {timeAgo(submission.submittedAt)} ({formatDateTime(submission.submittedAt)})
          </p>
        </div>
        <Link
          href={`/learn/courses/${submission.courseSlug}/assignment/${submission.lessonId}`}
          className="btn-secondary btn-sm"
          target="_blank"
        >
          Learner view
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      <section className="card p-5">
        <h2 className="section-title">Submitted work</h2>
        <div className="mt-3 rounded-xl border border-line bg-ink-50 p-4">
          <p className="text-sm whitespace-pre-wrap text-ink-800">{submission.bodyText || '(no text submitted)'}</p>
        </div>

        {submission.fileId ? (
          <a href={`/api/submissions/${submission.id}`} className="btn-secondary btn-sm mt-4">
            <Paperclip className="size-3.5" aria-hidden />
            {submission.fileName ?? 'Attachment'}
            <Download className="size-3.5" aria-hidden />
          </a>
        ) : (
          <p className="mt-3 text-xs text-ink-500">No file attached.</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="section-title">Grading</h2>
        {alreadyGraded ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-700">
              Already graded: <strong>{submission.score} / {submission.maxScore}</strong>
              {submission.gradedAt ? ` · ${timeAgo(submission.gradedAt)}` : ''}
            </p>
            <p className="rounded-xl border border-line bg-ink-50 p-4 text-sm whitespace-pre-wrap text-ink-700">
              {submission.feedback}
            </p>
            <p className="text-xs text-ink-500">
              Grades are not editable here; a resubmission request is the supported way to ask for more
              work.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <AssignmentGradingForm
              submissionId={submission.id}
              maxScore={submission.maxScore}
              defaultScore={submission.score}
            />
          </div>
        )}
      </section>
    </div>
  );
}
