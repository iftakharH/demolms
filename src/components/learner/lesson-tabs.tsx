'use client';

import { useState, type ReactNode } from 'react';
import { FileText, NotebookPen } from 'lucide-react';

/**
 * Tabs for the under-the-video panels. Both panels are rendered on the server
 * and passed in as children, so the page stays a server component.
 */
export function LessonTabs({
  notes,
  resources,
  resourceCount,
  defaultTab = 'notes',
}: {
  notes: ReactNode;
  resources: ReactNode | null;
  resourceCount: number;
  defaultTab?: 'notes' | 'resources';
}) {
  const [tab, setTab] = useState<'notes' | 'resources'>(defaultTab);

  const tabs: { id: 'notes' | 'resources'; label: string; icon: ReactNode; badge?: number }[] = [
    { id: 'notes', label: 'My notes', icon: <NotebookPen className="size-4" aria-hidden /> },
  ];
  if (resources) {
    tabs.push({
      id: 'resources',
      label: 'Resources',
      icon: <FileText className="size-4" aria-hidden />,
      badge: resourceCount,
    });
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-1 border-b border-line px-2 pt-2" role="tablist">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active
                  ? 'border-b-2 border-brand-600 text-brand-700'
                  : 'border-b-2 border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              <span className={active ? 'text-brand-600' : 'text-ink-400'}>{item.icon}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 ? (
                <span className="rounded-full bg-ink-100 px-1.5 text-[0.6875rem] text-ink-600">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {tab === 'notes' ? (
          notes
        ) : resources ? (
          resources
        ) : (
          <p className="text-sm text-ink-500">No resources on this lesson.</p>
        )}
      </div>
    </section>
  );
}
