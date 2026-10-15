'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

/**
 * Click-to-edit title for the builder: shows the value, becomes an input with
 * Save/Cancel on click. Plain form underneath, so no round-trip through a page.
 */
export function InlineRename({
  action,
  fields,
  value,
  label,
  className = '',
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  value: string;
  label: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Click to rename"
        className={`group flex min-w-0 items-center gap-1.5 text-left ${className}`}
      >
        <span className="truncate text-sm font-semibold text-ink-900">{value}</span>
        <Pencil className="size-3 shrink-0 text-ink-400 transition group-hover:text-brand-600" aria-hidden />
      </button>
    );
  }

  return (
    <form action={action} className="flex min-w-0 flex-1 items-center gap-2" onSubmit={() => setEditing(false)}>
      {Object.entries(fields).map(([name, fieldValue]) => (
        <input key={name} type="hidden" name={name} value={String(fieldValue)} />
      ))}
      <input
        name="title"
        defaultValue={value}
        required
        minLength={2}
        maxLength={180}
        className="input h-9 min-w-0 flex-1 py-1 text-sm"
        aria-label={label}
      />
      <button type="submit" className="btn-secondary btn-sm">
        Save
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </form>
  );
}
