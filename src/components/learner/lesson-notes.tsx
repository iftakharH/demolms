'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, NotebookPen } from 'lucide-react';

const DEBOUNCE_MS = 900;

/**
 * Per-lesson notes with autosave. One note per lesson (upserted server-side);
 * the course-wide list is rendered by the page from the same table.
 */
export function LessonNotes({
  lessonId,
  lessonTitle,
  initialBody,
  bare = false,
}: {
  lessonId: number;
  lessonTitle: string;
  initialBody: string;
  bare?: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initialBody);

  const save = useCallback(
    async (value: string) => {
      setState('saving');
      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lessonId, body: value }),
        });
        if (!response.ok) throw new Error('failed');
        lastSaved.current = value;
        setState('saved');
      } catch {
        setState('error');
      }
    },
    [lessonId],
  );

  // debounced autosave
  useEffect(() => {
    if (body === lastSaved.current) return;
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(body), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [body, save]);

  // flush on unload
  useEffect(() => {
    const onBeforeUnload = () => {
      if (body !== lastSaved.current) {
        void fetch('/api/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lessonId, body }),
          keepalive: true,
        });
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [body, lessonId]);

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={bare ? 'text-sm font-semibold text-ink-900' : 'section-title flex items-center gap-2'}>
          {bare ? null : <NotebookPen className="size-4 text-brand-600" aria-hidden />}
          Notes on this lesson
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-ink-500" aria-live="polite">
          {state === 'saving' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Saving...
            </>
          ) : state === 'saved' ? (
            <>
              <Check className="size-3.5 text-success" aria-hidden />
              Saved
            </>
          ) : state === 'dirty' ? (
            'Unsaved changes'
          ) : state === 'error' ? (
            'Could not save - check your connection'
          ) : (
            'Autosaves as you type'
          )}
        </span>
      </div>

      <label className="sr-only" htmlFor="lesson-notes">
        Notes for {lessonTitle}
      </label>
      <textarea
        id="lesson-notes"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={bare ? 6 : 5}
        placeholder="Anything worth remembering from this lesson. Only you can see this."
        className={`input ${bare ? 'mt-3' : 'mt-4'}`}
      />
      <p className="mt-2 text-xs text-ink-400">
        Notes are private to you and save automatically - they also appear in the course notes list.
      </p>
    </>
  );

  if (bare) return content;

  return <section className="card p-5">{content}</section>;
}
