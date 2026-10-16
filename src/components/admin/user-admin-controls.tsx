'use client';

import { useActionState, useState } from 'react';
import { Power, ShieldCheck } from 'lucide-react';
import { changeUserRoleAction, setUserActiveAction } from '@/lib/actions/admin-user-actions';
import { EMPTY_FORM_STATE } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/submit-button';

/** Role change + enable/disable controls on the user detail page. */
export function UserAdminControls({
  userId,
  role,
  isActive,
  canWrite,
}: {
  userId: number;
  role: 'learner' | 'admin' | 'auditor';
  isActive: boolean;
  canWrite: boolean;
}) {
  const [roleState, roleAction] = useActionState(changeUserRoleAction, EMPTY_FORM_STATE);
  const [activeState, activeAction] = useActionState(setUserActiveAction, EMPTY_FORM_STATE);
  const [newRole, setNewRole] = useState(role);
  const [reason, setReason] = useState('');

  if (!canWrite) {
    return (
      <p className="rounded-xl border border-line bg-ink-50 px-4 py-3 text-sm text-ink-600">
        Auditor accounts are read-only: role changes and account changes are hidden here and rejected
        by the server.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <form action={roleAction} className="space-y-3">
        <input type="hidden" name="user_id" value={userId} />

        {roleState.error ? (
          <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            {roleState.error}
          </p>
        ) : null}
        {roleState.ok ? (
          <p className="rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
            {roleState.message}
          </p>
        ) : null}

        <div>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as typeof newRole)}
            className="input"
          >
            <option value="learner">Learner</option>
            <option value="admin">Admin (full access)</option>
            <option value="auditor">Auditor (read-only admin)</option>
          </select>
          <p className="mt-1.5 text-xs text-ink-500">
            Demoting an admin ends their sessions immediately. The last active admin cannot be demoted.
          </p>
        </div>

        <SubmitButton className="btn-secondary" pendingLabel="Saving..." disabled={newRole === role}>
          <ShieldCheck className="size-4" aria-hidden />
          Update role
        </SubmitButton>
      </form>

      <div className="border-t border-line pt-5">
        <form action={activeAction} className="space-y-3">
          <input type="hidden" name="user_id" value={userId} />
          <input type="hidden" name="active" value={isActive ? '0' : '1'} />

          {activeState.error ? (
            <p className="rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              {activeState.error}
            </p>
          ) : null}
          {activeState.ok ? (
            <p className="rounded-xl border border-success-line bg-success-soft px-3.5 py-2.5 text-sm text-success-strong">
              {activeState.message}
            </p>
          ) : null}

          {isActive ? (
            <div>
              <label className="label" htmlFor="reason">
                Reason (stored in the audit log)
              </label>
              <input
                id="reason"
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="input"
                placeholder="Chargeback investigation"
              />
            </div>
          ) : null}

          <SubmitButton
            className={isActive ? 'btn-danger' : 'btn-primary'}
            pendingLabel="Working..."
          >
            <Power className="size-4" aria-hidden />
            {isActive ? 'Disable account and sign out' : 'Enable account'}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
