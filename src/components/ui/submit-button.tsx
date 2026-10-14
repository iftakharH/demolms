'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Submit button with a built-in pending state (React 19 useFormStatus),
 * so every form gets a loading state without extra wiring.
 */
export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingLabel,
  disabled,
  name,
  value,
  formAction,
  title,
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      title={title}
      disabled={pending || disabled}
      aria-busy={pending}
      className={className}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
