'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Copy-to-clipboard control used for verification links and certificate ids. */
export function CopyButton({
  value,
  label = 'Copy link',
  className = 'btn-secondary btn-sm',
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt('Copy this link', value);
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  );
}
