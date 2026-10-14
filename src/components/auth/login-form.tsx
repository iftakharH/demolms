'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { LogIn, ShieldCheck } from 'lucide-react';
import { loginAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { AuthCard, FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';
import { DEV_TOOLS, DEMO_ACCOUNTS } from '@/lib/env';

export function LoginForm({
  next,
  notice,
}: {
  next?: string;
  notice?: { tone: 'info' | 'success'; text: string } | null;
}) {
  const [state, action] = useActionState(loginAction, EMPTY_FORM_STATE);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue where you left off."
      devHint={
        DEV_TOOLS ? (
          <div className="space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="size-3.5" aria-hidden />
              Demo accounts (dev mode)
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                  className="chip border-brand-200 bg-surface text-xs hover:bg-brand-50"
                >
                  {account.label}
                  {account.mfa ? (
                    <span className="text-[0.625rem] text-brand-700">+ code</span>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="text-xs text-brand-900/80">
              Admin and auditor sign-ins ask for a 6-digit code. The current valid code is printed on
              the next screen, so you do not need an authenticator app.
            </p>
          </div>
        ) : null
      }
      footer={
        <>
          New here?{' '}
          <Link href="/register" className="link">
            Create an account
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {notice ? <FormMessage {...(notice.tone === 'success' ? { message: notice.text } : { error: notice.text })} /> : null}
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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Password
            </label>
            <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        <SubmitButton className="btn-primary w-full" pendingLabel="Signing in...">
          <LogIn className="size-4" aria-hidden />
          Sign in
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
