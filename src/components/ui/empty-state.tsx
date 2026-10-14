import type { ReactNode } from 'react';

/** Consistent empty state used across every list in the product. */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="mb-1 text-ink-400">{icon}</div> : null}
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {description ? <p className="max-w-md text-sm text-ink-500">{description}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
