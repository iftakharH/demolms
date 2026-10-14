import crypto from 'node:crypto';

/** Random URL-safe token (session cookies, verification links). */
export function token(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const PUBLIC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function publicCode(length: number): string {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (const byte of bytes) out += PUBLIC_ALPHABET[byte % PUBLIC_ALPHABET.length];
  return out;
}

/** e.g. DEMO-2026-7K4M2Q */
export function newCertificateId(): string {
  return `DEMO-2026-${publicCode(6)}`;
}

/** e.g. ORD-10428-X7 */
export function newOrderPublicId(): string {
  const number = 10_400 + crypto.randomInt(0, 9_000);
  return `ORD-${number}-${publicCode(2)}`;
}

/** Short display code for coupons, uploads, webhook refs. */
export function shortRef(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/** Constant-time comparison for signatures. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** HMAC-SHA256, hex. Used by the mock payments provider and webhook handler. */
export function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
