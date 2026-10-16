import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  Circle,
  CirclePlay,
  Download,
  FileText,
  HelpCircle,
  Paperclip,
  PenLine,
  SkipForward,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { activeEnrolment, courseCompletion, courseNotes, playerLessons } from '@/lib/progress';
import { fileUrl } from '@/lib/file-url';
import { renderMarkdown } from '@/lib/markdown';
import { formatDuration, humanFileSizeShort } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { ProgressBar, ProgressRing } from '@/components/ui/progress';
import { VideoPlayer } from '@/components/learner/video-player';
import { LessonNotes } from '@/components/learner/lesson-notes';
import { LessonTabs } from '@/components/learner/lesson-tabs';
import { MarkComplete } from '@/components/learner/mark-complete';
import { FlashToast } from '@/components/ui/flash-toast';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Course player',
  robots: { index: false },
};

const TYPE_ICON = {
  video: CirclePlay,
  text: FileText,
  quiz: HelpCircle,
  assignment: PenLine,
} as const;

export default async function CoursePlayerPage({
  params,
  searchParams,
}: PageProps<'/learn/courses/[slug]'>) {
  const { slug } = await params;
  const routeParams = await searchParams;

  const user = await requireUser(`/learn/courses/${slug}`);

  const course = queryOne<{
    id: number;
    slug: string;
    title: string;
    subtitle: string;
    instructor_name: string;
    certificate_enabled: number;
  }>(
    'SELECT id, slug, title, subtitle, instructor_name, certificate_enabled FROM courses WHERE slug = ?',
    slug,
  );
  if (!course) notFound();

  const enrolment = activeEnrolment(user.id, course.id);
  if (!enrolment) redirect(`/courses/${slug}?access=needed`);

  const lessons = playerLessons(user.id, course.id);
  if (lessons.length === 0) notFound();

  const completion = courseCompletion(user.id, course.id);

  const requestedId = Number.parseInt(String(routeParams.lesson ?? ''), 10);
  const current =
    lessons.find((lesson) => lesson.id === requestedId) ??
    lessons.find((lesson) => !lesson.completedAt) ??
    lessons[0];

  const currentIndex = lessons.findIndex((lesson) => lesson.id === current.id);
  const previous = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const next = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;
  const upNext = next
    ? {
        id: next.id,
        title: next.title,
        href: `/learn/courses/${course.slug}?lesson=${next.id}`,
        durationMinutes: next.durationMinutes,
      }
    : null;

  const notes = courseNotes(user.id, course.id);
  const lessonNote = notes.find((note) => note.lessonId === current.id)?.body ?? '';
  const resources = query<{
    id: number;
    title: string;
    originalName: string;
    sizeBytes: number;
  }>(
    `SELECT r.id, r.title, f.original_name AS originalName, f.size_bytes AS sizeBytes
       FROM lesson_resources r JOIN files f ON f.id = r.file_id
      WHERE r.lesson_id = ? ORDER BY r.id`,
    current.id,
  );

  // lessons grouped by section, with per-section progress
  const sections: {
    title: string;
    lessons: typeof lessons;
    done: number;
  }[] = [];
  for (const lesson of lessons) {
    const last = sections[sections.length - 1];
    if (last && last.title === lesson.sectionTitle) {
      last.lessons.push(lesson);
    } else {
      sections.push({ title: lesson.sectionTitle, lessons: [lesson], done: 0 });
    }
  }
  for (const section of sections) {
    section.done = section.lessons.filter((lesson) => lesson.completedAt).length;
  }

  const notesForCourse = notes.slice(0, 5);
  const completed = Boolean(current.completedAt);

  const resourcesPanel =
    resources.length > 0 ? (
      <div>
        <p className="text-sm text-ink-600">
          Downloads are checked against your enrolment - these are not public URLs.
        </p>
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {resources.map((resource) => (
            <li key={resource.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FileText className="size-4 shrink-0 text-ink-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">{resource.title}</p>
                <p className="text-xs text-ink-500">
                  {resource.originalName} · {humanFileSizeShort(resource.sizeBytes)}
                </p>
              </div>
              <a href={`/api/resources/${resource.id}`} className="btn-secondary btn-sm">
                <Download className="size-3.5" aria-hidden />
                Download
              </a>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      <FlashToast code={typeof routeParams.flash === 'string' ? routeParams.flash : null} />

      {/* -------------------------------------------------------------- header */}
      <div>
        <Link
          href="/learn/my-learning"
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          My learning
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="page-title truncate">{course.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {completion.completedLessons} of {completion.totalLessons} lessons complete · with{' '}
              {course.instructor_name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {completion.complete ? (
              <Badge tone="success">
                <Award className="size-3.5" aria-hidden />
                Course complete
              </Badge>
            ) : (
              <ProgressRing percent={completion.percent} size={52} stroke={5} />
            )}
            <Link href={`/courses/${course.slug}`} className="btn-secondary btn-sm">
              Course details
            </Link>
          </div>
        </div>
      </div>

      {routeParams.finished === '1' ? (
        <div className="rounded-2xl border border-success-line bg-success-soft px-5 py-4">
          <p className="text-sm font-semibold text-success-strong">
            {completion.complete ? `You finished ${course.title}.` : 'That was the last lesson - nice work.'}
          </p>
          <p className="mt-1 text-sm text-success-strong/80">
            {completion.complete && course.certificate_enabled
              ? 'Your certificate is ready.'
              : completion.complete
                ? 'Your progress is saved.'
                : 'Finish any outstanding quizzes or assignments to complete the course.'}
          </p>
          {completion.complete && course.certificate_enabled ? (
            <Link href="/learn/certificates" className="btn-primary btn-sm mt-3">
              <Award className="size-4" aria-hidden />
              View my certificate
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ----------------------------------------------------------- lesson area */}
        <div className="min-w-0 space-y-5">
          <section className="card min-w-0 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{current.type}</Badge>
              {completed ? <Badge tone="success">completed</Badge> : null}
              {current.durationMinutes > 0 ? (
                <span className="text-xs text-ink-500">{formatDuration(current.durationMinutes)}</span>
              ) : null}
              <span className="text-xs text-ink-400">
                Lesson {currentIndex + 1} of {lessons.length}
              </span>
              <span className="ml-auto text-xs text-ink-400">{current.sectionTitle}</span>
            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink-900">{current.title}</h2>

            <div className="mt-5">
              {current.type === 'video' ? (
                current.videoPath ? (
                  <VideoPlayer
                    lessonId={current.id}
                    src={fileUrl(current.videoPath)}
                    captionsSrc={current.captionsPath ? fileUrl(current.captionsPath) : null}
                    posterSrc={current.posterPath ? fileUrl(current.posterPath) : null}
                    initialPosition={current.videoPositionSeconds}
                    title={current.title}
                    upNext={upNext}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-warning bg-warning-soft px-4 py-3 text-sm text-warning-strong">
                    No video has been uploaded for this lesson yet.
                  </p>
                )
              ) : null}

              {current.type === 'text' ? (
                current.bodyMd ? (
                  <article
                    className="prose-lms max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(current.bodyMd) }}
                  />
                ) : (
                  <p className="text-sm text-ink-500">This article has no content yet.</p>
                )
              ) : null}

              {current.type === 'quiz' || current.type === 'assignment' ? (
                <div className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
                  {current.type === 'quiz' ? 'Quiz' : 'Assignment'} lessons open on their own page - use
                  the button below.
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-4">
              <MarkComplete
                lessonId={current.id}
                completed={completed}
                nextLabel={next ? `Next: ${truncate(next.title, 34)}` : null}
              />
              {current.type === 'quiz' || current.type === 'assignment' ? (
                <Link
                  href={`/learn/courses/${course.slug}/${current.type}/${current.id}`}
                  className="btn-secondary"
                >
                  Open the {current.type}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
              {current.attemptCount > 0 && current.type === 'quiz' ? (
                <p className="text-xs text-ink-500">
                  Best score {current.bestScorePercent ?? '-'}%
                  {current.pendingReview ? ' · one attempt awaiting review' : ''}
                </p>
              ) : null}
              {current.submissionStatus ? (
                <p className="text-xs text-ink-500">
                  Submission: {current.submissionStatus.replace('_', ' ')}
                  {current.submissionScore !== null ? ` · ${current.submissionScore}/100` : ''}
                </p>
              ) : null}
            </div>

            {next ? (
              <Link
                href={`/learn/courses/${course.slug}?lesson=${next.id}`}
                className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-ink-50 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-700">
                  <SkipForward className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.6875rem] font-semibold tracking-wide text-brand-700 uppercase">
                    Up next
                  </span>
                  <span className="block truncate text-sm font-medium text-ink-900">{next.title}</span>
                  <span className="block text-xs text-ink-500">
                    {next.type}
                    {next.durationMinutes > 0 ? ` · ${formatDuration(next.durationMinutes)}` : ''}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-400" aria-hidden />
              </Link>
            ) : (
              <p className="mt-4 rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
                This is the last lesson. {completion.complete ? 'You have finished the course.' : 'Finish any outstanding work to complete the course.'}
              </p>
            )}
          </section>

          {/* -------------------------------------------------- notes / resources */}
          <LessonTabs
            notes={
              <LessonNotes
                lessonId={current.id}
                lessonTitle={current.title}
                initialBody={lessonNote}
                bare
              />
            }
            resources={resourcesPanel}
            resourceCount={resources.length}
            defaultTab={resources.length > 0 && !lessonNote ? 'notes' : 'notes'}
          />

          {notesForCourse.length > 0 ? (
            <section className="card p-5">
              <h2 className="section-title">My notes across this course</h2>
              <ul className="mt-4 space-y-3">
                {notesForCourse.map((note) => (
                  <li key={note.id} className="rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/learn/courses/${course.slug}?lesson=${note.lessonId}`}
                        className="truncate text-sm font-medium text-ink-800 hover:text-brand-700"
                      >
                        {note.lessonTitle}
                      </Link>
                      <span className="shrink-0 text-xs text-ink-400">{timeAgoShort(note.updatedAt)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm whitespace-pre-wrap text-ink-600">{note.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* ------------------------------------------------------------- sidebar */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="card min-w-0 overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink-900">Course content</p>
                <span className="text-xs text-ink-500">{completion.percent}%</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={completion.percent} size="sm" label="Course progress" />
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                {completion.completedLessons}/{completion.totalLessons} lessons complete
              </p>
            </div>

            <nav className="max-h-[30rem] overflow-y-auto" aria-label="Lesson list">
              {sections.map((section) => (
                <div key={section.title}>
                  <p className="flex items-center justify-between gap-2 bg-ink-50 px-4 py-2 text-xs font-semibold tracking-wide text-ink-600 uppercase">
                    <span className="truncate">{section.title}</span>
                    <span className="shrink-0 font-normal text-ink-400">
                      {section.done}/{section.lessons.length}
                    </span>
                  </p>
                  <ul>
                    {section.lessons.map((lesson) => {
                      const Icon = TYPE_ICON[lesson.type];
                      const active = lesson.id === current.id;
                      return (
                        <li key={lesson.id}>
                          <Link
                            href={`/learn/courses/${course.slug}?lesson=${lesson.id}`}
                            aria-current={active ? 'true' : undefined}
                            className={`flex items-start gap-2.5 px-4 py-2.5 text-sm transition ${
                              active
                                ? 'border-l-2 border-brand-600 bg-brand-50 text-brand-900'
                                : 'border-l-2 border-transparent text-ink-700 hover:bg-ink-50'
                            }`}
                          >
                            {lesson.completedAt ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                            ) : (
                              <Circle className="mt-0.5 size-4 shrink-0 text-ink-300" aria-hidden />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className={`block ${active ? 'font-semibold' : ''}`}>{lesson.title}</span>
                              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
                                <Icon className="size-3" aria-hidden />
                                {lesson.type}
                                {lesson.durationMinutes > 0 ? ` · ${formatDuration(lesson.durationMinutes)}` : ''}
                                {lesson.type === 'quiz' && lesson.quizPassed ? ' · passed' : ''}
                                {lesson.type === 'assignment' && lesson.submissionStatus === 'graded'
                                  ? ' · graded'
                                  : ''}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="flex items-center justify-between gap-2 border-t border-line p-3">
              {previous ? (
                <Link
                  href={`/learn/courses/${course.slug}?lesson=${previous.id}`}
                  className="btn-secondary btn-sm"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={`/learn/courses/${course.slug}?lesson=${next.id}`} className="btn-primary btn-sm">
                  <SkipForward className="size-3.5" aria-hidden />
                  Next lesson
                </Link>
              ) : (
                <Link href="/learn/certificates" className="btn-secondary btn-sm">
                  <Award className="size-3.5" aria-hidden />
                  Certificates
                </Link>
              )}
            </div>
          </div>

          <div className="card mt-4 flex items-start gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Paperclip className="size-4" aria-hidden />
            </span>
            <p className="text-xs text-ink-500">
              Progress, notes and playback position are saved to your account - close the tab and pick up
              on any device.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function timeAgoShort(value: string | null): string {
  if (!value) return '';
  const then = new Date(value.replace(' ', 'T') + 'Z').getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
