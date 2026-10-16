'use client';

import { useActionState } from 'react';
import { Plus } from 'lucide-react';
import { createCouponAction } from '@/lib/actions/admin-coupon-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

export function CouponForm({ courses }: { courses: { id: number; title: string }[] }) {
  const [state, action] = useActionState(createCouponAction, EMPTY_FORM_STATE);

  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="section-title">New coupon</h2>

      {state.error ? (
        <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
          {state.message}
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="code">
          Code
        </label>
        <input
          id="code"
          name="code"
          required
          className="input font-mono uppercase"
          placeholder="SPRING20"
          aria-invalid={state.fieldErrors?.code ? true : undefined}
        />
        {state.fieldErrors?.code ? (
          <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.code}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="kind">
            Type
          </label>
          <select id="kind" name="kind" className="input" defaultValue="percent">
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="value">
            Value
          </label>
          <input
            id="value"
            name="value"
            required
            className="input"
            placeholder="20 or 15.00"
            aria-invalid={state.fieldErrors?.value ? true : undefined}
          />
          {state.fieldErrors?.value ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.value}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="course_id">
          Applies to
        </label>
        <select id="course_id" name="course_id" className="input" defaultValue="">
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="expires_at">
            Expires
          </label>
          <input id="expires_at" name="expires_at" type="date" className="input" />
          <p className="mt-1.5 text-xs text-ink-400">Blank = no expiry</p>
        </div>
        <div>
          <label className="label" htmlFor="max_uses">
            Usage limit
          </label>
          <input
            id="max_uses"
            name="max_uses"
            type="number"
            min={1}
            className="input"
            placeholder="unlimited"
            aria-invalid={state.fieldErrors?.maxUses ? true : undefined}
          />
          {state.fieldErrors?.maxUses ? (
            <p className="mt-1.5 text-xs text-danger">{state.fieldErrors.maxUses}</p>
          ) : null}
        </div>
      </div>

      <SubmitButton className="btn-primary w-full" pendingLabel="Creating...">
        <Plus className="size-4" aria-hidden />
        Create coupon
      </SubmitButton>
    </form>
  );
}
