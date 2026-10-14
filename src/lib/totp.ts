import { authenticator } from 'otplib';
import { DEV_TOOLS } from './env';

/**
 * TOTP (RFC 6238) for admin MFA, via otplib.
 * In this local demo the current valid code is also printed on screen.
 */

authenticator.options = { window: 1, step: 30 };

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function verifyTotp(code: string, secret: string): boolean {
  const cleaned = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    return authenticator.verify({ token: cleaned, secret });
  } catch {
    return false;
  }
}

/** Only used to demo the flow without an authenticator app. */
export function currentTotp(secret: string): string | null {
  if (!DEV_TOOLS) return null;
  try {
    return authenticator.generate(secret);
  } catch {
    return null;
  }
}

export function secondsUntilNextCode(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

/** otpauth:// URI for the setup QR code. */
export function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, 'demolms (demo)', secret);
}

/** Grouped for display: "123 456" */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
