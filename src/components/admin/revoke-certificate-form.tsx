'use client';

import { useActionState } from 'react';
import { ShieldX } from 'lucide-react';
import { revokeCertificateAction } from '@/lib/actions/certificate-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/** Inline revoke control on the admin certificates list. */
export function RevokeCertificateForm({
  certificateId,
  canWrite,
}: {
  certificateId: string;
  canWrite: boolean;
}) {
  const [state, action] = useActionState(revokeCertificateAction, EMPTY_FORM_STATE);

  if (!canWrite) {
    return <p className="text-xs text-ink-500">Read-only account.</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="certificate_id" value={certificateId} />

      <div className="min-w-56 flex-1">
        <label className="label" htmlFor={`reason-${certificateId}`}>
          Reason (shown publicly)
        </label>
        <input
          id={`reason-${certificateId}`}
          name="reason"
          required
          minLength={4}
          className="input"
          placeholder="Issued in error - assessment retaken"
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
        />
        {state.error ? <p className="mt-1.5 text-xs text-danger">{state.error}</p> : null}
        {state.ok ? <p className="mt-1.5 text-xs text-emerald-700">{state.message}</p> : null}
      </div>

      <SubmitButton className="btn-danger btn-sm" pendingLabel="Revoking...">
        <ShieldX className="size-3.5" aria-hidden />
        Revoke
      </SubmitButton>
    </form>
  );
}
