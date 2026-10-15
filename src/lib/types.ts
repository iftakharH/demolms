/** Shared row and view types. */

export type Role = 'learner' | 'admin' | 'auditor';

export interface EmailPrefs {
  receipts: boolean;
  grades: boolean;
  certificates: boolean;
  marketing: boolean;
}

export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  receipts: true,
  grades: true,
  certificates: true,
  marketing: false,
};

export interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  avatar_path: string | null;
  is_active: number;
  email_verified_at: string | null;
  last_login_at: string | null;
  totp_secret: string | null;
  totp_confirmed_at: string | null;
  email_prefs_json: string;
  created_at: string;
  updated_at: string;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  avatarPath: string | null;
  emailVerified: boolean;
  totpConfirmed: boolean;
  isActive: boolean;
  emailPrefs: EmailPrefs;
  createdAt: string;
}

export interface SessionRow {
  token_hash: string;
  user_id: number;
  needs_mfa: number;
  impersonated_by: number | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
}

export interface AuditActorView {
  id: number;
  email: string;
  role: Role;
}

export function toSessionUser(row: DbUser): SessionUser {
  let emailPrefs: EmailPrefs = { ...DEFAULT_EMAIL_PREFS };
  try {
    emailPrefs = { ...emailPrefs, ...(JSON.parse(row.email_prefs_json) as Partial<EmailPrefs>) };
  } catch {
    // keep defaults
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarPath: row.avatar_path,
    emailVerified: Boolean(row.email_verified_at),
    totpConfirmed: Boolean(row.totp_confirmed_at),
    isActive: Boolean(row.is_active),
    emailPrefs,
    createdAt: row.created_at,
  };
}

export function isStaffRole(role: Role): boolean {
  return role === 'admin' || role === 'auditor';
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'auditor':
      return 'Auditor (read-only)';
    default:
      return 'Learner';
  }
}
