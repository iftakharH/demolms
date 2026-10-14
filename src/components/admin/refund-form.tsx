'use client';

import { useActionState, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { refundOrderAction } from '@/lib/actions/payment-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { formatPence } from '@/lib/format';

/** Refund form: full or partial, with a configurable access revocation. */
export function RefundForm({
  orderId,
  outstandingPence,
  accessRevoked,
  canWrite,
}: {
  orderId: number;
  outstandingPence: number;
  accessRevoked: boolean;
  canWrite: boolean;
}) {
  const [state, action] = useActionState(refundOrderAction, EMPTY_FORM_STATE);
  const [full, setFull] = useState(true);
  const [revoke, setRevoke] = useState(true);

  if (!canWrite) {
    return (
      <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
        Auditor accounts are read-only, so refunds are disabled here by design. The server would also
        reject a refund request from this account.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />

      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl border border-emerald-200 bg-success-soft px-3.5 py-2.5 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}

      {outstandingPence <= 0 ? (
        <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
          This order is fully refunded. Nothing further to refund.
        </p>
      ) : null}

      {outstandingPence > 0 ? (
        <>
          <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="full"
            checked={full}
            onChange={(event) => setFull(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line-strong"
          />
          <span>
            <span className="font-medium text-ink-800">Full refund</span>
            <span className="block text-xs text-ink-500">
              {formatPence(outstandingPence)} outstanding on this order
            </span>
          </span>
        </label>

        {!full ? (
          <div>
            <label className="label" htmlFor="amount">
              Amount to refund (GBP)
            </label>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder={(outstandingPence / 100).toFixed(2)}
              className="input"
              aria-invalid={state.fieldErrors?.amount ? true : undefined}
            />
            {state.fieldErrors?.amount ? (
              <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.amount}</p>
            ) : null}
          </div>
        ) : null}

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="revoke_access"
            checked={revoke}
            onChange={(event) => setRevoke(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line-strong"
          />
          <span>
            <span className="font-medium text-ink-800">Revoke course access</span>
            <span className="block text-xs text-ink-500">
              {accessRevoked
                ? 'Already revoked for this learner.'
                : 'Recommended. The learner keeps their notes but cannot open lessons.'}
            </span>
          </span>
        </label>
      </div>

      <div>
        <label className="label" htmlFor="reason">
          Reason (goes in the audit log and the email)
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={2}
          required
          minLength={4}
          className="input"
          placeholder="Duplicate purchase - learner bought the same course twice"
          aria-invalid={state.fieldErrors?.reason ? true : undefined}
        />
        {state.fieldErrors?.reason ? (
          <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.reason}</p>
        ) : null}
      </div>

      <SubmitButton className="btn-danger w-full" pendingLabel="Refunding...">
        <Undo2 className="size-4" aria-hidden />
        {full ? `Refund ${formatPence(outstandingPence)}` : 'Refund amount'}
      </SubmitButton>
      <p className="text-xs text-ink-500">
        This marks the order refunded, optionally revokes the enrolment, writes an audit entry and
        emails the learner.
      </p>
        </>
      ) : null}
    </form>
  );
}
