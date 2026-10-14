import type { LessonOutline } from '@/lib/queries/catalog';
import { formatDuration } from '@/lib/format';
import Link from 'next/link';
import { FileText, HelpCircle, Lock, PenLine, PlayCircle } from 'lucide-react';

const TYPE_META: Record<LessonOutline['type'], { icon: typeof PlayCircle; label: string }> = {
  video: { icon: PlayCircle, label: 'Video' },
  text: { icon: FileText, label: 'Article' },
  quiz: { icon: HelpCircle, label: 'Quiz' },
  assignment: { icon: PenLine, label: 'Assignment' },
};

/**
 * Curriculum outline. Preview lessons link out to the free preview player;
 * everything else is locked until enrolment (the player enforces this too).
 */
export function Curriculum({
  courseSlug,
  sections,
  enrolled = false,
}: {
  courseSlug: string;
  sections: { id: number; title: string; lessons: LessonOutline[] }[];
  enrolled?: boolean;
}) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {sections.map((section, index) => {
        const minutes = section.lessons.reduce((sum, lesson) => sum + lesson.durationMinutes, 0);
        return (
          <details key={section.id} open={index === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-ink-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{section.title}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {section.lessons.length} lesson{section.lessons.length === 1 ? '' : 's'}
                  {minutes > 0 ? ` · ${formatDuration(minutes)}` : ''}
                </p>
              </div>
              <span className="text-xs font-medium text-brand-700 group-open:hidden">Show</span>
              <span className="hidden text-xs font-medium text-ink-500 group-open:inline">Hide</span>
            </summary>

            <ul className="border-t border-line">
              {section.lessons.map((lesson) => {
                const meta = TYPE_META[lesson.type];
                const Icon = meta.icon;
                const unlocked = enrolled || lesson.isPreview;
                const content = (
                  <>
                    <Icon className={`size-4 shrink-0 ${lesson.isPreview && !enrolled ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                    {lesson.isPreview && !enrolled ? (
                      <span className="badge bg-brand-50 text-brand-700">Free preview</span>
                    ) : null}
                    <span className="text-xs whitespace-nowrap text-ink-400">
                      {formatDuration(lesson.durationMinutes)}
                    </span>
                    {!unlocked ? <Lock className="size-3.5 shrink-0 text-ink-300" aria-hidden /> : null}
                  </>
                );

                return (
                  <li key={lesson.id}>
                    {unlocked ? (
                      <Link
                        href={
                          enrolled
                            ? `/learn/courses/${courseSlug}?lesson=${lesson.id}`
                            : `/courses/${courseSlug}/preview/${lesson.id}`
                        }
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-700 transition hover:bg-brand-50/60"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink-500">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
