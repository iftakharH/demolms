'use client';

import { useActionState, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { mfaAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { AuthCard, FormMessage } from '@/components/auth/auth-card';
import { SubmitButton } from '@/components/ui/submit-button';
import { logoutAction } from '@/lib/actions/auth-actions';

export function MfaForm({
  next,
  devCode,
  secondsLeft,
}: {
  next?: string;
  devCode: string | null;
  secondsLeft: number;
}) {
  const [state, action] = useActionState(mfaAction, EMPTY_FORM_STATE);
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(secondsLeft);

  // countdown to the next code, so the dev hint stays honest
  useEffect(() => {
    const timer = setInterval(() => setRemaining((value) => (value <= 1 ? 30 : value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <AuthCard
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
      devHint={
        devCode ? (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="size-3.5" aria-hidden />
              Dev mode: current valid code
            </p>
            <p className="font-mono text-2xl font-semibold tracking-widest">{devCode}</p>
            <p className="text-xs text-brand-900/80">
              Refreshes in {remaining}s. In a real deployment this code is only ever in the
              authenticator app.
            </p>
          </div>
        ) : null
      }
      footer={
        <form action={logoutAction}>
          <button type="submit" className="link bg-transparent">
            Use a different account
          </button>
        </form>
      }
    >
      <form action={action} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormMessage error={state.error} message={state.message} />

        <div>
          <label className="label" htmlFor="code">
            6-digit code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="input text-center font-mono text-xl tracking-[0.4em]"
            placeholder="000000"
          />
        </div>

        <SubmitButton className="btn-primary w-full" pendingLabel="Checking code...">
          <KeyRound className="size-4" aria-hidden />
          Verify and sign in
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
