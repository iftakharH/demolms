'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  completeMfaStep,
  createAuthToken,
  createSession,
  createUser,
  consumeAuthToken,
  destroyAllSessions,
  destroyCurrentSession,
  findUserByEmail,
  findUserById,
  getCurrentUser,
  getMfaPendingUser,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import { activeSessionCount } from '@/lib/auth';
import { AUDIT_ACTIONS, logAudit } from '@/lib/audit';
import { run } from '@/lib/db';
import { LIMITS, checkLimit, clearLimit, recordFailure } from '@/lib/rate-limit';
import { verifyTotp } from '@/lib/totp';
import { isStaffRole } from '@/lib/types';
import { sendMail, sendMailToUser } from '@/lib/mailer';
import { notify } from '@/lib/notify';
import { passwordChanged, resetPassword, verifyEmail } from '@/lib/email-templates';
import { removeUpload, saveUpload, UploadError } from '@/lib/uploads';
import type { FormState } from '@/lib/action-state';

const emailSchema = z
  .string()
  .trim()
  .min(3, 'Enter your email address')
  .max(254)
  .email('That does not look like an email address');

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

function homePathFor(role: string): string {
  return isStaffRole(role as 'admin') ? '/admin' : '/dashboard';
}

function safeNext(next: unknown): string | null {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

/* ------------------------------------------------------------------ register */

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get('email'));
  const name = z.string().trim().min(2, 'Tell us your name').max(120).safeParse(formData.get('name'));
  const password = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .safeParse(formData.get('password'));

  const fieldErrors: Record<string, string> = {};
  if (!name.success) fieldErrors.name = name.error.issues[0].message;
  if (!email.success) fieldErrors.email = email.error.issues[0].message;
  if (!password.success) fieldErrors.password = password.error.issues[0].message;
  const confirm = String(formData.get('confirm') ?? '');
  if (password.success && confirm !== password.data) {
    fieldErrors.confirm = 'The two passwords do not match';
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  if (!email.success || !name.success || !password.success) {
    return { error: 'Please check the form and try again.' };
  }

  const ip = await clientIp();
  const limit = checkLimit(`register:ip:${ip}`, LIMITS.register);
  if (!limit.allowed) {
    return { error: 'Too many sign-ups from this device. Try again later.' };
  }
  recordFailure(`register:ip:${ip}`, LIMITS.register);

  if (findUserByEmail(email.data)) {
    // Registration is the one place where we must reveal the conflict.
    return {
      error: 'An account with that email already exists. Sign in instead.',
      fieldErrors: { email: 'Already registered' },
    };
  }

  const userId = createUser({ email: email.data, name: name.data, password: password.data });
  logAudit({
    actor: { id: userId, email: email.data, role: 'learner' },
    action: AUDIT_ACTIONS.register,
    entityType: 'user',
    entityId: userId,
    summary: `Registered account for ${email.data}`,
    ip,
  });

  // verification email (lands in the dev outbox, where the link works)
  const rawToken = createAuthToken(userId, 'verify_email', 24 * 60);
  sendMail(email.data, verifyEmail({ name: name.data, url: `/verify-email?token=${rawToken}` }));
  notify({
    userId,
    type: 'welcome',
    title: 'Welcome to demolms',
    body: 'Confirm your email address to unlock everything.',
    href: '/verify-email/notice',
  });

  await createSession(userId, { needsMfa: false });
  redirect('/verify-email/notice?fresh=1');
}

/* ------------------------------------------------------------------ login */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get('email'));
  const passwordValue = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  const genericError = 'Email or password is incorrect.';

  if (!email.success || passwordValue.length === 0) {
    return { error: genericError };
  }

  const ip = await clientIp();
  const emailKey = `login:email:${email.data.toLowerCase()}`;
  const ipKey = `login:ip:${ip}`;

  // account lockout first (a few wrong passwords), then the IP flood limit
  for (const [key, limit] of [
    [emailKey, LIMITS.login],
    [ipKey, LIMITS.loginIp],
  ] as const) {
    const state = checkLimit(key, limit);
    if (!state.allowed) {
      const minutes = Math.max(1, Math.ceil(state.retryAfterSeconds / 60));
      return {
        error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      };
    }
  }

  const user = findUserByEmail(email.data);
  const passwordOk = user ? verifyPassword(passwordValue, user.password_hash) : false;

  if (!user || !passwordOk) {
    recordFailure(emailKey, LIMITS.login);
    recordFailure(ipKey, LIMITS.loginIp);
    logAudit({
      actor: null,
      action: AUDIT_ACTIONS.loginFailed,
      entityType: 'user',
      entityId: user?.id ?? '',
      summary: `Failed login for ${email.data}`,
      ip,
    });
    return { error: genericError };
  }

  if (!user.is_active) {
    return { error: 'This account has been disabled. Contact support.' };
  }

  clearLimit(emailKey);
  clearLimit(ipKey);

  if (isStaffRole(user.role) && user.totp_confirmed_at && user.totp_secret) {
    await createSession(user.id, { needsMfa: true });
    redirect(`/login/mfa${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  }

  await createSession(user.id, { needsMfa: false });
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);
  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.login,
    entityType: 'user',
    entityId: user.id,
    summary: `Login: ${user.email}`,
    ip,
  });

  redirect(next ?? homePathFor(user.role));
}

export async function mfaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pending = await getMfaPendingUser();
  if (!pending) return { error: 'Your sign-in expired. Start again.' };

  const code = String(formData.get('code') ?? '');
  const next = safeNext(formData.get('next'));

  const user = findUserById(pending.id);
  if (!user?.totp_secret) return { error: 'Two-factor authentication is not set up for this account.' };

  const ip = await clientIp();
  const key = `mfa:user:${user.id}`;
  const state = checkLimit(key, LIMITS.login);
  if (!state.allowed) {
    return { error: 'Too many incorrect codes. Try again in a few minutes.' };
  }

  if (!verifyTotp(code, user.totp_secret)) {
    recordFailure(key, LIMITS.login);
    logAudit({
      actor: { id: user.id, email: user.email, role: user.role },
      action: AUDIT_ACTIONS.loginFailed,
      entityType: 'user',
      entityId: user.id,
      summary: `Failed MFA code for ${user.email}`,
      ip,
    });
    return { error: 'That code is not valid. Codes change every 30 seconds.' };
  }

  clearLimit(key);
  await completeMfaStep();
  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.login,
    entityType: 'user',
    entityId: user.id,
    summary: `Login: ${user.email} (with MFA)`,
    ip,
  });

  redirect(next ?? homePathFor(user.role));
}

/* ------------------------------------------------------------------ verification */

export async function resendVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get('email'));
  if (!email.success) return { error: 'Enter the email you registered with.' };

  const user = findUserByEmail(email.data);
  if (!user) {
    return { message: 'If that account exists, a new link is on its way.' };
  }
  if (user.email_verified_at) {
    return { message: 'That email is already verified. Try signing in.' };
  }

  const ip = await clientIp();
  const limit = checkLimit(`resend:ip:${ip}`, LIMITS.reset);
  if (!limit.allowed) return { error: 'Please wait a moment before requesting another email.' };
  recordFailure(`resend:ip:${ip}`, LIMITS.reset);

  const rawToken = createAuthToken(user.id, 'verify_email', 24 * 60);
  sendMail(user.email, verifyEmail({ name: user.name, url: `/verify-email?token=${rawToken}` }));
  return { message: 'A fresh verification link is in the outbox.' };
}

/* ------------------------------------------------------------------ passwords */

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get('email'));
  const generic = { message: 'If that email has an account, a reset link is on its way.' };
  if (!email.success) return { error: 'Enter your email address.' };

  const ip = await clientIp();
  const limit = checkLimit(`reset:ip:${ip}`, LIMITS.reset);
  if (!limit.allowed) return { error: 'Too many requests. Try again later.' };
  recordFailure(`reset:ip:${ip}`, LIMITS.reset);

  const user = findUserByEmail(email.data);
  if (!user || !user.is_active) return generic;

  const rawToken = createAuthToken(user.id, 'reset_password', 60);
  sendMail(user.email, resetPassword({ name: user.name, url: `/reset-password?token=${rawToken}` }));
  return generic;
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  const password = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .safeParse(formData.get('password'));
  const confirm = String(formData.get('confirm') ?? '');

  if (!password.success) return { error: 'Please fix the highlighted field.', fieldErrors: { password: password.error.issues[0].message } };
  if (password.data !== confirm) return { error: 'The two passwords do not match.' };

  const consumed = consumeAuthToken('reset_password', token);
  if (!consumed) return { error: 'That reset link is invalid or has expired. Request a new one.' };

  const user = findUserById(consumed.userId);
  if (!user) return { error: 'That account no longer exists.' };

  run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', hashPassword(password.data), user.id);
  const sessions = await destroyAllSessions(user.id);

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.passwordReset,
    entityType: 'user',
    entityId: user.id,
    summary: `Password reset for ${user.email} (${sessions} session(s) invalidated)`,
  });
  sendMailToUser(user.id, passwordChanged({ name: user.name }));
  notify({
    userId: user.id,
    type: 'security',
    title: 'Password changed',
    body: 'Your password was reset and all devices were signed out.',
    href: '/login',
  });

  redirect('/login?reset=1');
}

/* ------------------------------------------------------------------ sessions */

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/');
}

export async function logoutAllAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  const removed = await destroyAllSessions(user.id);
  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.logoutAll,
    entityType: 'user',
    entityId: user.id,
    summary: `Signed out of all devices (${removed} session(s))`,
  });
  redirect('/login?loggedout=all');
}

/* ------------------------------------------------------------------ profile */

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const name = z.string().trim().min(2, 'Tell us your name').max(120).safeParse(formData.get('name'));
  if (!name.success) {
    return { error: name.error.issues[0].message, fieldErrors: { name: name.error.issues[0].message } };
  }

  const prefs = {
    receipts: formData.get('pref_receipts') === 'on',
    grades: formData.get('pref_grades') === 'on',
    certificates: formData.get('pref_certificates') === 'on',
    marketing: formData.get('pref_marketing') === 'on',
  };

  let avatarPath: string | null | undefined;
  const avatar = formData.get('avatar');
  if (avatar instanceof File && avatar.size > 0) {
    try {
      const stored = await saveUpload(avatar, 'avatar', user.id);
      if (stored) {
        removeUpload(user.avatarPath);
        avatarPath = stored.path;
      }
    } catch (error) {
      if (error instanceof UploadError) return { error: error.message };
      throw error;
    }
  }
  if (formData.get('remove_avatar') === 'on') avatarPath = null;

  if (avatarPath === undefined) {
    run(
      'UPDATE users SET name = ?, email_prefs_json = ?, updated_at = datetime(\'now\') WHERE id = ?',
      name.data,
      JSON.stringify(prefs),
      user.id,
    );
  } else {
    run(
      'UPDATE users SET name = ?, avatar_path = ?, email_prefs_json = ?, updated_at = datetime(\'now\') WHERE id = ?',
      name.data,
      avatarPath,
      JSON.stringify(prefs),
      user.id,
    );
  }

  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.settingsChanged,
    entityType: 'user',
    entityId: user.id,
    summary: `Updated profile for ${user.email}`,
    meta: { emailPrefs: prefs, avatarChanged: avatarPath !== undefined },
  });

  return { ok: true, message: 'Profile saved.' };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Your session expired. Sign in again.' };

  const current = String(formData.get('current_password') ?? '');
  const next = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(200)
    .safeParse(formData.get('new_password'));
  const confirm = String(formData.get('confirm') ?? '');

  const row = findUserById(user.id);
  if (!row) return { error: 'Account not found.' };
  if (!verifyPassword(current, row.password_hash)) {
    return { error: 'Your current password is incorrect.', fieldErrors: { current_password: 'Incorrect password' } };
  }
  if (!next.success) {
    return { error: next.error.issues[0].message, fieldErrors: { new_password: next.error.issues[0].message } };
  }
  if (next.data !== confirm) return { error: 'The two new passwords do not match.' };

  run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', hashPassword(next.data), user.id);
  logAudit({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.passwordReset,
    entityType: 'user',
    entityId: user.id,
    summary: `Password changed by ${user.email} from the profile page`,
  });
  sendMailToUser(user.id, passwordChanged({ name: user.name }));

  return { ok: true, message: 'Password updated. Other devices stay signed in.' };
}

export async function sessionSummaryAction(): Promise<{ count: number }> {
  const user = await getCurrentUser();
  if (!user) return { count: 0 };
  return { count: activeSessionCount(user.id) };
}
