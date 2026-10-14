/**
 * Demo configuration. Everything has a working default, so `npm install && npm
 * run dev` needs no setup. Values can be overridden with .env.local.
 */

/** Used to sign the session cookie (HMAC) and session tokens. */
export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'demolms-demo-session-secret-change-me-locally';

/** Shared secret for the mock payment provider <-> webhook signature. */
export const PAYMENT_WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET ?? 'whsec_demo_local_secret';

/** Base URL used in metadata, sitemap and emails. */
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Dev tools: TOTP code shown on screen, demo-account quick fill, /dev/outbox
 * link in the footer. On by default because this build only ever runs locally;
 * set DEMO_HIDE_DEV_TOOLS=true to hide them.
 */
export const DEV_TOOLS = process.env.DEMO_HIDE_DEV_TOOLS !== 'true';

export const SESSION_COOKIE = 'demolms_session';

/** Session lifetime (days). */
export const SESSION_DAYS = 14;
/** Length of the "half authenticated" window while an admin enters their TOTP code. */
export const MFA_WINDOW_MINUTES = 10;

export const DEMO_ACCOUNTS = [
  { email: 'learner@demo.test', password: 'Demo1234!', role: 'learner', label: 'Learner', mfa: false },
  { email: 'admin@demo.test', password: 'Demo1234!', role: 'admin', label: 'Admin', mfa: true },
  { email: 'auditor@demo.test', password: 'Demo1234!', role: 'auditor', label: 'Auditor (read-only)', mfa: true },
] as const;

export const CURRENCY = 'GBP';
