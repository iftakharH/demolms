'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/toast';

/**
 * Shows a toast for a server-action redirect result (e.g. a lesson marked
 * complete) and then strips the query parameter so a refresh does not repeat it.
 */
export function FlashToast({ code }: { code: string | null }) {
  const { toast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (!code || shown.current) return;
    shown.current = true;

    const known = MESSAGES[code];
    if (known) toast(known);

    const url = new URL(window.location.href);
    url.searchParams.delete('flash');
    window.history.replaceState({}, '', url.toString());
  }, [code, toast]);

  return null;
}

export const MESSAGES: Record<string, { title: string; description?: string; variant?: 'success' | 'info' | 'error' }> = {
  completed: { title: 'Lesson marked complete', description: 'Your progress is saved.', variant: 'success' },
  reopened: { title: 'Lesson reopened', description: 'It is back on your to-do list.', variant: 'info' },
  enrolled: { title: 'You are enrolled', description: 'Lesson one is ready when you are.', variant: 'success' },
  saved: { title: 'Saved', description: 'Your changes are stored.', variant: 'success' },
  already: { title: 'Already enrolled', description: 'Opening your course instead.', variant: 'info' },
  'note-saved': { title: 'Note saved', variant: 'success' },
  'submitted': { title: 'Submission received', description: 'Your instructor will grade it shortly.', variant: 'success' },
};
