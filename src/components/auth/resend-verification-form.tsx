'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { resendVerificationAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';

/** Resend form used on the "check your email" and expired-link screens. */
export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, action] = useActionState(resendVerificationAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-3">
      <FormMessage error={state.error} message={state.message} />
      <div>
        <label className="label" htmlFor="resend-email">
          Email address
        </label>
        <input
          id="resend-email"
          name="email"
          type="email"
          required
          defaultValue={email}
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <SubmitButton className="btn-secondary w-full" pendingLabel="Sending...">
        <MailCheck className="size-4" aria-hidden />
        Resend verification email
      </SubmitButton>
    </form>
  );
}
