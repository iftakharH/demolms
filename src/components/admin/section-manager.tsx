import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  FileText,
  HelpCircle,
  Paperclip,
  PenLine,
  Plus,
  Settings2,
  Trash2,
  Video,
} from 'lucide-react';
import type { AdminSection } from '@/lib/queries/admin-courses';
import { Badge } from '@/components/ui/badge';
import { InlineRename } from '@/components/admin/inline-rename';
import { formatDuration } from '@/lib/format';
import {
  createLessonAction,
  createSectionAction,
  deleteLessonAction,
  deleteSectionAction,
  duplicateLessonAction,
  duplicateSectionAction,
  moveLessonAction,
  moveSectionAction,
  renameLessonAction,
  updateSectionAction,
} from '@/lib/actions/admin-course-actions';

const TYPE_ICON = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
  assignment: PenLine,
} as const;

const TYPE_LABEL = {
  video: 'Video',
  text: 'Article',
  quiz: 'Quiz',
  assignment: 'Assignment',
} as const;

/**
 * Sections and lessons with up/down reordering, all as plain forms so the
 * builder works without client-side state.
 */
export function SectionManager({
  slug,
  sections,
  canWrite,
}: {
  slug: string;
  sections: AdminSection[];
  canWrite: boolean;
}) {
  const totalLessons = sections.reduce((sum, section) => sum + section.lessons.length, 0);

  return (
    <section id="sections" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">Curriculum</h2>
          <p className="mt-1 text-sm text-ink-500">
            {sections.length} section{sections.length === 1 ? '' : 's'} · {totalLessons} lesson
            {totalLessons === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {sections.map((section, index) => (
        <div key={section.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ink-50 px-4 py-3">
            <span className="badge bg-ink-200 text-ink-700">Section {index + 1}</span>

            {canWrite ? (
              <InlineRename
                action={updateSectionAction}
                fields={{ slug, section_id: section.id }}
                value={section.title}
                label={`Section ${index + 1} title`}
                className="flex-1"
              />
            ) : (
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{section.title}</p>
            )}

            {canWrite ? (
              <div className="flex items-center gap-1.5">
                <form action={moveSectionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="btn-ghost btn-sm px-2" aria-label="Move section up" disabled={index === 0}>
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </form>
                <form action={moveSectionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    className="btn-ghost btn-sm px-2"
                    aria-label="Move section down"
                    disabled={index === sections.length - 1}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                </form>
                <form action={duplicateSectionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <button type="submit" className="btn-ghost btn-sm px-2" aria-label="Duplicate section">
                    <Copy className="size-4" aria-hidden />
                  </button>
                </form>
                <form action={deleteSectionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="section_id" value={section.id} />
                  <button type="submit" className="btn-ghost btn-sm px-2 text-danger" aria-label="Delete section">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          <ul className="divide-y divide-line">
            {section.lessons.map((lesson, lessonIndex) => {
              const Icon = TYPE_ICON[lesson.type];
              return (
                <li key={lesson.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {canWrite ? (
                        <InlineRename
                          action={renameLessonAction}
                          fields={{ slug, lesson_id: lesson.id }}
                          value={lesson.title}
                          label={`Lesson title: ${lesson.title}`}
                        />
                      ) : (
                        <span className="truncate text-sm font-medium text-ink-900">{lesson.title}</span>
                      )}
                      {lesson.isPreview ? <Badge tone="brand">Preview</Badge> : null}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span>{TYPE_LABEL[lesson.type]}</span>
                      <span>{formatDuration(lesson.durationMinutes)}</span>
                      {lesson.type === 'quiz' ? (
                        <span>
                          {lesson.questionCount} question{lesson.questionCount === 1 ? '' : 's'}
                          {lesson.quizPassPercent !== null ? ` · pass ${lesson.quizPassPercent}%` : ''}
                        </span>
                      ) : null}
                      {lesson.type === 'assignment' ? (
                        <span>
                          {lesson.submissionCount} submission{lesson.submissionCount === 1 ? '' : 's'}
                        </span>
                      ) : null}
                      {lesson.resourceCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="size-3" aria-hidden />
                          {lesson.resourceCount}
                        </span>
                      ) : null}
                      {lesson.type === 'video' && !lesson.videoPath ? (
                        <span className="text-warning">no video uploaded</span>
                      ) : null}
                      {lesson.type === 'text' && !lesson.hasBody ? (
                        <span className="text-warning">no content yet</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link href={`/admin/courses/${slug}/lessons/${lesson.id}`} className="btn-secondary btn-sm">
                      <Settings2 className="size-3.5" aria-hidden />
                      Edit
                    </Link>
                    {lesson.isPreview ? (
                      <Link
                        href={`/courses/${slug}/preview/${lesson.id}`}
                        className="btn-ghost btn-sm px-2"
                        aria-label="Open preview"
                      >
                        <Eye className="size-4" aria-hidden />
                      </Link>
                    ) : null}
                    {canWrite ? (
                      <>
                        <form action={moveLessonAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" className="btn-ghost btn-sm px-2" aria-label="Move lesson up" disabled={lessonIndex === 0}>
                            <ArrowUp className="size-4" aria-hidden />
                          </button>
                        </form>
                        <form action={moveLessonAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            className="btn-ghost btn-sm px-2"
                            aria-label="Move lesson down"
                            disabled={lessonIndex === section.lessons.length - 1}
                          >
                            <ArrowDown className="size-4" aria-hidden />
                          </button>
                        </form>
                        <form action={duplicateLessonAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <button type="submit" className="btn-ghost btn-sm px-2" aria-label="Duplicate lesson">
                            <Copy className="size-4" aria-hidden />
                          </button>
                        </form>
                        <form action={deleteLessonAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <button type="submit" className="btn-ghost btn-sm px-2 text-danger" aria-label="Delete lesson">
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}

            {section.lessons.length === 0 ? (
              <li className="px-4 py-4 text-sm text-ink-500">No lessons in this section yet.</li>
            ) : null}
          </ul>

          {canWrite ? (
            <form action={createLessonAction} className="flex flex-wrap items-center gap-2 border-t border-line bg-ink-50 px-4 py-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="section_id" value={section.id} />
              <input name="title" placeholder="New lesson title" className="input h-9 min-w-0 flex-1 py-1 text-sm" required />
              <select name="type" className="input h-9 w-auto py-1 text-sm" defaultValue="video" aria-label="Lesson type">
                <option value="video">Video</option>
                <option value="text">Article</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
              </select>
              <button type="submit" className="btn-primary btn-sm">
                <Plus className="size-3.5" aria-hidden />
                Add lesson
              </button>
            </form>
          ) : null}
        </div>
      ))}

      {canWrite ? (
        <form action={createSectionAction} className="card flex flex-wrap items-center gap-2 p-4">
          <input type="hidden" name="slug" value={slug} />
          <input name="title" placeholder="New section title" className="input h-9 min-w-0 flex-1 py-1 text-sm" required />
          <button type="submit" className="btn-secondary btn-sm">
            <Plus className="size-3.5" aria-hidden />
            Add section
          </button>
        </form>
      ) : null}
    </section>
  );
}
