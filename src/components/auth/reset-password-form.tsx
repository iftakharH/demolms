'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { resetPasswordAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { AuthCard, FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, EMPTY_FORM_STATE);

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Signing in on other devices will be stopped."
      footer={
        <Link href="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <FormMessage error={state.error} message={state.message} />

        <div>
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            placeholder="At least 8 characters"
            aria-invalid={state.fieldErrors?.password ? true : undefined}
          />
          {state.fieldErrors?.password ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="confirm">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="input"
            placeholder="Type it again"
          />
        </div>

        <SubmitButton className="btn-primary w-full" pendingLabel="Saving...">
          <KeyRound className="size-4" aria-hidden />
          Set new password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
