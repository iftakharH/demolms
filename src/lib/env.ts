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

/**
 * Base URL used in metadata, sitemap and emails.
 *
 * APP_URL always wins. When it is unset, fall back to the public URL the host
 * publishes itself (Render sets RENDER_EXTERNAL_URL, Railway sets
 * RAILWAY_PUBLIC_DOMAIN) before the localhost default - otherwise a deployment
 * that forgets APP_URL sends verification and password-reset links to
 * http://localhost, which look fine in the logs and are useless to a visitor.
 *
 * Note that /sitemap.xml is prerendered at build time, so changing APP_URL needs a
 * redeploy to show up there (env changes trigger one on Render).
 */
const HOST_URL =
  process.env.RENDER_EXTERNAL_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);

export const APP_URL = process.env.APP_URL ?? HOST_URL ?? 'http://localhost:3000';

/**
 * Dev tools: TOTP code shown on screen, demo-account quick fill, /dev/outbox
 * link in the footer. On by default because this build only ever runs locally;
 * set DEMO_HIDE_DEV_TOOLS=true to hide them.
 */
export const DEV_TOOLS = process.env.DEMO_HIDE_DEV_TOOLS !== 'true';

export const SESSION_COOKIE = 'demolms_session';

/**
 * Support access ("enter as learner"): a signed session token for the learner,
 * stored separately so the admin's own session cookie is never touched.
 */
export const IMPERSONATION_COOKIE = 'demolms_support';

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
