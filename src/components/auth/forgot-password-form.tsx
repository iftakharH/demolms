'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { MailQuestion } from 'lucide-react';
import { forgotPasswordAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { AuthCard, FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, EMPTY_FORM_STATE);

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="We will write a reset link to the local outbox."
      footer={
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      <form action={action} className="space-y-4">
        <FormMessage error={state.error} message={state.message} />

        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            placeholder="you@example.com"
          />
        </div>

        <SubmitButton className="btn-primary w-full" pendingLabel="Sending link...">
          <MailQuestion className="size-4" aria-hidden />
          Send reset link
        </SubmitButton>

        <p className="text-xs text-ink-500">
          For security we always show the same message, whether or not the address has an account.
        </p>
      </form>
    </AuthCard>
  );
}
