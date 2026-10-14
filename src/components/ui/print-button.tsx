'use client';

import { Printer } from 'lucide-react';

/** Print button used on receipts and certificates (print styles hide chrome). */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {label}
    </button>
  );
}
