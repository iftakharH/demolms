'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { registerAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { AuthCard, FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, EMPTY_FORM_STATE);

  return (
    <AuthCard
      title="Create your account"
      subtitle="Free courses, quizzes and certificates. No card needed."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        <FormMessage error={state.error} message={state.message} />

        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            className="input"
            placeholder="Alex Morgan"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.name}</p>
          ) : null}
        </div>

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
            aria-invalid={state.fieldErrors?.email ? true : undefined}
          />
          {state.fieldErrors?.email ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
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
            Confirm password
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

        <SubmitButton className="btn-primary w-full" pendingLabel="Creating account...">
          <UserPlus className="size-4" aria-hidden />
          Create account
        </SubmitButton>

        <p className="text-xs text-ink-500">
          In this demo the verification email is written to a local outbox - no real email is sent.
        </p>
      </form>
    </AuthCard>
  );
}
