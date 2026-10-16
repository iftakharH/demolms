import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileText, Paperclip, PlayCircle, Trash2, Upload } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminLessonDetail, adminQuestions, lessonResources } from '@/lib/queries/admin-courses';
import { LessonEditor } from '@/components/admin/lesson-editor';
import { QuizBuilder } from '@/components/admin/quiz-builder';
import { Badge } from '@/components/ui/badge';
import { addResourceAction, deleteResourceAction } from '@/lib/actions/admin-course-actions';
import { fileUrl, humanFileSize } from '@/lib/file-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lesson editor · Admin' };

export default async function LessonEditorPage({
  params,
  searchParams,
}: PageProps<'/admin/courses/[slug]/lessons/[lessonId]'>) {
  const { slug, lessonId } = await params;
  const user = await requireStaff(`/admin/courses/${slug}/lessons/${lessonId}`);
  const query = await searchParams;
  const lesson = adminLessonDetail(Number.parseInt(lessonId, 10));
  if (!lesson || lesson.courseSlug !== slug) notFound();

  const canWrite = user.role === 'admin';
  const questions = lesson.type === 'quiz' ? adminQuestions(lesson.id) : [];
  const resources = lessonResources(lesson.id);
  const error = typeof query.error === 'string' ? query.error : null;
  const saved = query.saved === '1';

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/courses/${slug}#sections`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {lesson.courseTitle}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{lesson.type}</Badge>
          {lesson.isPreview ? <Badge tone="info">Free preview</Badge> : null}
        </div>
        <h1 className="page-title mt-2">{lesson.title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Lesson #{lesson.id} in {lesson.courseTitle}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}
      {saved && !error ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success-strong">
          Saved.
        </p>
      ) : null}

      <LessonEditor
        canWrite={canWrite}
        values={{
          id: lesson.id,
          slug,
          type: lesson.type,
          title: lesson.title,
          durationMinutes: lesson.durationMinutes,
          isPreview: lesson.isPreview,
          bodyMd: lesson.bodyMd ?? '',
          videoPath: lesson.videoPath,
          captionsPath: lesson.captionsPath,
          posterPath: lesson.posterPath,
          quizPassPercent: lesson.quizPassPercent ?? 70,
          quizMaxAttempts: lesson.quizMaxAttempts ?? 3,
          quizShowAnswers: lesson.quizShowAnswers,
          assignmentBriefMd: lesson.assignmentBriefMd ?? '',
          assignmentMaxScore: lesson.assignmentMaxScore,
          assignmentAllowFiles: lesson.assignmentAllowFiles,
        }}
      />

      {/* ------------------------------------------------------------- video files */}
      {lesson.type === 'video' ? (
        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="section-title">Uploaded files</h2>
            <p className="mt-1 text-sm text-ink-500">
              Managed by the &ldquo;Video files&rdquo; fields in the form above. Files land in{' '}
              <code className="rounded bg-ink-100 px-1.5 py-0.5">public/uploads</code>.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FileStatus label="Video" path={lesson.videoPath} />
            <FileStatus label="Captions (.vtt)" path={lesson.captionsPath} />
            <FileStatus label="Poster image" path={lesson.posterPath} />
          </div>

          {lesson.videoPath ? (
            <video
              className="max-w-md rounded-xl border border-line"
              controls
              preload="metadata"
              poster={lesson.posterPath ? fileUrl(lesson.posterPath) : undefined}
            >
              <source src={fileUrl(lesson.videoPath)} type="video/mp4" />
              {lesson.captionsPath ? (
                <track kind="captions" src={fileUrl(lesson.captionsPath)} srcLang="en" label="English" default />
              ) : null}
            </video>
          ) : (
            <p className="rounded-xl border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning-strong">
              No video uploaded yet. Upload one with the form above (choose the file, then Save lesson).
            </p>
          )}
        </section>
      ) : null}

      {/* -------------------------------------------------------------- resources */}
      <section className="card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Downloadable resources</h2>
            <p className="mt-1 text-sm text-ink-500">
              Served through an access-checked route: only enrolled learners can download these, and
              the file path is never exposed.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-line rounded-xl border border-line">
          {resources.map((resource) => (
            <li key={resource.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{resource.title}</p>
                <p className="text-xs text-ink-500">
                  {resource.originalName} · {humanFileSize(resource.sizeBytes)} · {resource.mime}
                </p>
              </div>
              {canWrite ? (
                <>
                  <a
                    href={fileUrl(resource.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm px-2"
                    aria-label={`Open ${resource.title}`}
                  >
                    <Download className="size-4" aria-hidden />
                  </a>
                  <form action={deleteResourceAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="lesson_id" value={lesson.id} />
                    <input type="hidden" name="resource_id" value={resource.id} />
                    <button type="submit" className="btn-ghost btn-sm px-2 text-danger" aria-label={`Delete ${resource.title}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </>
              ) : null}
            </li>
          ))}
          {resources.length === 0 ? (
            <li className="px-4 py-4 text-sm text-ink-500">No resources on this lesson yet.</li>
          ) : null}
        </ul>

        {canWrite ? (
          <form action={addResourceAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <div>
              <label className="label" htmlFor="resource-title">
                Title
              </label>
              <input id="resource-title" name="title" className="input" placeholder="Lesson worksheet" />
            </div>
            <div>
              <label className="label" htmlFor="resource-file">
                File (PDF, zip, txt, csv, docx, xlsx)
              </label>
              <input
                id="resource-file"
                name="file"
                type="file"
                required
                accept=".pdf,.zip,.txt,.md,.csv,.docx,.xlsx"
                className="input py-2"
              />
            </div>
            <button type="submit" className="btn-secondary">
              <Upload className="size-4" aria-hidden />
              Upload
            </button>
          </form>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- quiz */}
      {lesson.type === 'quiz' ? (
        <QuizBuilder slug={slug} lessonId={lesson.id} questions={questions} canWrite={canWrite} />
      ) : null}

      {lesson.type === 'quiz' ? (
        <p className="text-xs text-ink-500">
          <Paperclip className="mr-1 inline size-3" aria-hidden />
          Pass mark, attempts and answer visibility live in the lesson form above.
        </p>
      ) : null}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-ink-500">
          Looking for the learner view? Use <strong>Preview as learner</strong> on the course page.
        </p>
        <Link href={`/courses/${slug}?preview=1`} className="btn-secondary btn-sm">
          <PlayCircle className="size-3.5" aria-hidden />
          Open course preview
        </Link>
      </div>
    </div>
  );
}

function FileStatus({ label, path }: { label: string; path: string | null }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
      <p className="mt-1 truncate text-sm text-ink-800" title={path ?? ''}>
        {path ?? '—'}
      </p>
      <p className={`mt-1 text-xs ${path ? 'text-success' : 'text-warning'}`}>
        {path ? 'uploaded' : 'missing'}
      </p>
    </div>
  );
}
