import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { previewLesson } from '@/lib/queries/catalog';
import { renderMarkdown } from '@/lib/markdown';
import { fileUrl } from '@/lib/file-url';
import { formatDuration } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/courses/[slug]/preview/[lessonId]'>): Promise<Metadata> {
  const { lessonId } = await params;
  const preview = previewLesson(Number.parseInt(lessonId, 10));
  if (!preview) return { title: 'Preview not found', robots: { index: false } };
  return {
    title: `Preview: ${preview.lesson.title}`,
    description: `Free preview lesson from ${preview.course.title}.`,
    robots: { index: false },
  };
}

export default async function PreviewLessonPage({
  params,
}: PageProps<'/courses/[slug]/preview/[lessonId]'>) {
  const { slug, lessonId } = await params;
  const preview = previewLesson(Number.parseInt(lessonId, 10));
  if (!preview || preview.course.slug !== slug) notFound();

  const { lesson } = preview;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href={`/courses/${preview.course.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {preview.course.title}
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Badge tone="brand">Free preview</Badge>
        <Badge tone="outline">{lesson.type}</Badge>
        {lesson.durationMinutes > 0 ? (
          <span className="text-xs text-ink-500">{formatDuration(lesson.durationMinutes)}</span>
        ) : null}
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{lesson.title}</h1>

      {lesson.type === 'video' && lesson.videoPath ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-scrim">
          <video
            className="aspect-video w-full"
            controls
            preload="metadata"
            poster={lesson.posterPath ? fileUrl(lesson.posterPath) : undefined}
          >
            <source src={fileUrl(lesson.videoPath)} type="video/mp4" />
            {lesson.captionsPath ? (
              <track
                kind="captions"
                src={fileUrl(lesson.captionsPath)}
                srcLang="en"
                label="English"
                default
              />
            ) : null}
            Your browser does not support embedded video.
          </video>
        </div>
      ) : lesson.bodyMd ? (
        <article
          className="prose-lms mt-6"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.bodyMd) }}
        />
      ) : (
        <p className="mt-6 text-sm text-ink-500">This preview lesson has no content to display yet.</p>
      )}

      <div className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-ink-900">Enjoying the preview?</p>
          <p className="mt-0.5 text-sm text-ink-500">
            Enrol to unlock the full curriculum, quizzes, assignments and your certificate.
          </p>
        </div>
        <Link href={`/courses/${preview.course.slug}`} className="btn-primary">
          <PlayCircle className="size-4" aria-hidden />
          View the full course
        </Link>
      </div>
    </div>
  );
}
