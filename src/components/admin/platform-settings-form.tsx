'use client';

import { useActionState } from 'react';
import { Megaphone, PauseCircle, Save } from 'lucide-react';
import { updatePlatformSettingsAction } from '@/lib/actions/admin-settings-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

export interface PlatformSettingsValues {
  announcementEnabled: boolean;
  announcementText: string;
  enrolmentsPaused: boolean;
}

/** Announcement banner + enrolment pause, saved together. */
export function PlatformSettingsForm({ values }: { values: PlatformSettingsValues }) {
  const [state, action] = useActionState(updatePlatformSettingsAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Platform controls</h2>
          <p className="mt-1 text-sm text-ink-500">
            Announcements show under the site header; pausing stops new enrolments and checkouts.
          </p>
        </div>
        {state.ok ? <span className="badge bg-success-soft text-success">{state.message}</span> : null}
      </div>

      {state.error ? (
        <p className="rounded-xl border border-rose-200 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Megaphone className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="announcement_text">
              Announcement banner
            </label>
            <input
              id="announcement_text"
              name="announcement_text"
              defaultValue={values.announcementText}
              maxLength={200}
              placeholder="e.g. New: Interview Skills for Developers is live"
              className="input"
            />
            <label className="mt-2.5 flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="announcement_enabled"
                defaultChecked={values.announcementEnabled}
                className="size-4 rounded border-line-strong"
              />
              Show the banner across the site
            </label>
            <p className="mt-1 text-xs text-ink-400">
              Needs some text to switch on. Visitors and learners see it under the header.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <PauseCircle className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink-800">Pause new enrolments</p>
            <p className="mt-0.5 text-xs text-ink-500">
              Existing learners keep their access; free enrols and checkouts are refused with a
              friendly notice.
            </p>
            <label className="mt-2.5 flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="enrolments_paused"
                defaultChecked={values.enrolmentsPaused}
                className="size-4 rounded border-line-strong"
              />
              Enrolments are paused
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton className="btn-primary" pendingLabel="Saving...">
          <Save className="size-4" aria-hidden />
          Save platform settings
        </SubmitButton>
      </div>
    </form>
  );
}
