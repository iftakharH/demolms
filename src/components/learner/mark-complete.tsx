import { Check, SkipForward } from 'lucide-react';
import { completeLessonAction, reopenLessonAction } from '@/lib/actions/lesson-actions';

/**
 * Mark-complete controls. Plain forms posting server actions, so they work
 * without client-side JavaScript (and the player keeps its own client state).
 */
export function MarkComplete({
  lessonId,
  completed,
  nextLabel,
}: {
  lessonId: number;
  completed: boolean;
  nextLabel: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {completed ? (
        <>
          <span className="badge bg-success-soft text-success">
            <Check className="size-3.5" aria-hidden />
            Lesson complete
          </span>
          <form action={reopenLessonAction}>
            <input type="hidden" name="lesson_id" value={lessonId} />
            <button type="submit" className="btn-ghost btn-sm">
              Mark as not done
            </button>
          </form>
        </>
      ) : (
        <form action={completeLessonAction}>
          <input type="hidden" name="lesson_id" value={lessonId} />
          <button type="submit" className="btn-primary">
            <Check className="size-4" aria-hidden />
            Mark complete
          </button>
        </form>
      )}

      {nextLabel ? (
        <>
          <form action={completeLessonAction}>
            <input type="hidden" name="lesson_id" value={lessonId} />
            <input type="hidden" name="next" value="1" />
            <button type="submit" className="btn-secondary">
              <SkipForward className="size-4" aria-hidden />
              {completed ? 'Next lesson' : 'Complete and continue'}
            </button>
          </form>
          <span className="text-xs text-ink-500">{nextLabel}</span>
        </>
      ) : (
        <form action={completeLessonAction}>
          <input type="hidden" name="lesson_id" value={lessonId} />
          <input type="hidden" name="next" value="1" />
          <button type="submit" className="btn-secondary">
            <SkipForward className="size-4" aria-hidden />
            Finish course
          </button>
        </form>
      )}
    </div>
  );
}
