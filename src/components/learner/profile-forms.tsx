'use client';

import { useActionState, useState } from 'react';
import { Camera, Save, Trash2 } from 'lucide-react';
import { updateProfileAction, changePasswordAction } from '@/lib/actions/auth-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { Avatar } from '@/components/ui/avatar';
import { DEV_TOOLS } from '@/lib/env';
import type { EmailPrefs } from '@/lib/types';

const PREF_LABELS: { key: keyof EmailPrefs; label: string; hint: string }[] = [
  { key: 'receipts', label: 'Receipts and refunds', hint: 'Payment confirmations and refund notices' },
  { key: 'grades', label: 'Grades and feedback', hint: 'Assignments graded, quiz reviews' },
  { key: 'certificates', label: 'Certificates', hint: 'Issued when you complete a course' },
  { key: 'marketing', label: 'Course announcements', hint: 'New and featured courses' },
];

export function ProfileForm({
  name,
  email,
  avatarPath,
  prefs,
  showPrefs = true,
}: {
  name: string;
  email: string;
  avatarPath: string | null;
  prefs: EmailPrefs;
  /** learner email prefs are meaningless for staff accounts */
  showPrefs?: boolean;
}) {
  const [state, action] = useActionState(updateProfileAction, EMPTY_FORM_STATE);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  return (
    <form action={action} className="card space-y-6 p-5 sm:p-6">
      <div>
        <h2 className="section-title">Profile</h2>
        <p className="mt-1 text-sm text-ink-500">Your name is shown on certificates and feedback.</p>
      </div>

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

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} src={removeAvatar ? null : avatarPath} size="xl" />
        <div className="space-y-2">
          <label className="btn-secondary btn-sm cursor-pointer">
            <Camera className="size-4" aria-hidden />
            Change photo
            <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp" className="sr-only" />
          </label>
          {avatarPath ? (
            <label className="flex items-center gap-2 text-xs text-ink-500">
              <input
                type="checkbox"
                name="remove_avatar"
                checked={removeAvatar}
                onChange={(event) => setRemoveAvatar(event.target.checked)}
                className="size-3.5 rounded border-line-strong"
              />
              <span className="inline-flex items-center gap-1">
                <Trash2 className="size-3.5" aria-hidden />
                Remove current photo
              </span>
            </label>
          ) : null}
          <p className="text-xs text-ink-400">JPG, PNG or WebP · stored in public/uploads/avatars</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            required
            minLength={2}
            className="input"
            aria-invalid={state.fieldErrors?.name ? true : undefined}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.name}</p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="email-readonly">
            Email address
          </label>
          <input id="email-readonly" value={email} readOnly disabled className="input bg-ink-50 text-ink-500" />
          <p className="mt-1.5 text-xs text-ink-400">
            {DEV_TOOLS ? 'Changing the email address is out of scope for this demo.' : ''}
          </p>
        </div>
      </div>

      {showPrefs ? (
        <fieldset>
          <legend className="section-title text-base">Email notifications</legend>
          <p className="mt-1 text-sm text-ink-500">
            Every email lands in the outbox either way - these toggles decide what a learner would
            receive.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PREF_LABELS.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5 transition hover:border-brand-200"
              >
                <input
                  type="checkbox"
                  name={`pref_${item.key}`}
                  defaultChecked={prefs[item.key]}
                  className="mt-0.5 size-4 rounded border-line-strong"
                />
                <span>
                  <span className="block text-sm font-medium text-ink-800">{item.label}</span>
                  <span className="block text-xs text-ink-500">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Saving...">
          <Save className="size-4" aria-hidden />
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="section-title">Change password</h2>
        <p className="mt-1 text-sm text-ink-500">
          Changing your password keeps your other sessions signed in. Use &ldquo;sign out of all
          devices&rdquo; in the account menu to end them.
        </p>
      </div>

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

      <div>
        <label className="label" htmlFor="current_password">
          Current password
        </label>
        <input
          id="current_password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          aria-invalid={state.fieldErrors?.current_password ? true : undefined}
        />
        {state.fieldErrors?.current_password ? (
          <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.current_password}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new_password">
            New password
          </label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
            aria-invalid={state.fieldErrors?.new_password ? true : undefined}
          />
          {state.fieldErrors?.new_password ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.new_password}</p>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            Confirm new password
          </label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton className="btn-secondary" pendingLabel="Updating...">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
}
