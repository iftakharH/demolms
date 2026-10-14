import { APP_URL, PAYMENT_WEBHOOK_SECRET } from './env';
import { hmacHex, safeEqual, shortRef } from './ids';

/**
 * The mock payment provider ("mockpay"), standing in for Stripe.
 *
 * Flow: our own checkout page creates a pending order and redirects the browser
 * to the hosted page at /mock-stripe/checkout (a separate-looking screen, like
 * Stripe's). When the card is submitted, this module builds an event, signs it
 * with HMAC-SHA256 exactly like a webhook, and delivers it over HTTP to our own
 * /api/webhooks/payments endpoint - which verifies the signature, is idempotent
 * and only then marks the order paid and creates the enrolment.
 *
 * The dev buttons on the hosted page exercise the failure paths:
 * a bad signature and a duplicate delivery.
 */

export interface MockPaymentEvent {
  id: string;
  type: 'payment.succeeded' | 'payment.failed' | 'charge.refunded';
  created: number;
  data: {
    orderPublicId: string;
    amountPence: number;
    cardBrand?: string;
    cardLast4?: string;
    failureReason?: string;
    [key: string]: unknown;
  };
}

/** Test cards, mirroring the well-known Stripe numbers. */
export const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  /** second success card so the demo has more than one happy path */
  mastercard: '5555555555554444',
} as const;

export interface CardOutcome {
  ok: boolean;
  brand: string;
  last4: string;
  reason?: string;
}

/** Interpret a card number the way a test-mode provider would. */
export function chargeCard(cardNumber: string): CardOutcome {
  const digits = cardNumber.replace(/\D/g, '');
  const last4 = digits.slice(-4);

  if (digits.length < 15 || digits.length > 19) {
    return { ok: false, brand: 'Unknown', last4, reason: 'Card number is incomplete.' };
  }
  if (digits === TEST_CARDS.success) return { ok: true, brand: 'Visa', last4 };
  if (digits === TEST_CARDS.mastercard) return { ok: true, brand: 'Mastercard', last4 };
  if (digits === TEST_CARDS.decline) {
    return { ok: false, brand: 'Visa', last4, reason: 'Your card was declined (test card).' };
  }
  return {
    ok: false,
    brand: digits.startsWith('5') ? 'Mastercard' : 'Visa',
    last4,
    reason: 'Declined: only the documented test cards succeed in this demo.',
  };
}

export function buildEvent(
  type: MockPaymentEvent['type'],
  data: MockPaymentEvent['data'],
): MockPaymentEvent {
  return {
    id: shortRef('evt'),
    type,
    created: Math.floor(Date.now() / 1000),
    data,
  };
}

/**
 * Stripe-style signature header: `t=<unix seconds>,v1=<hmac(secret, "t.payload")>`.
 */
export function signPayload(payload: string, options: { timestamp?: number; secret?: string } = {}): string {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options.secret ?? PAYMENT_WEBHOOK_SECRET;
  const signature = hmacHex(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${signature}`;
}

export interface SignatureCheck {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

/** Verify a signature header with replay protection. */
export function verifySignature(
  payload: string,
  header: string | null,
  options: { toleranceSeconds?: number; secret?: string } = {},
): SignatureCheck {
  if (!header) return { valid: false, reason: 'Missing signature header.' };

  const parts = new Map(
    header
      .split(',')
      .map((part) => part.split('='))
      .filter((pair) => pair.length === 2)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );

  const timestampRaw = parts.get('t');
  const signature = parts.get('v1');
  if (!timestampRaw || !signature) {
    return { valid: false, reason: 'Malformed signature header (expected t=...,v1=...).' };
  }

  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) return { valid: false, reason: 'Invalid timestamp.' };

  const tolerance = options.toleranceSeconds ?? 300;
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > tolerance) {
    return { valid: false, reason: `Timestamp outside tolerance (${age}s old).` };
  }

  const expected = hmacHex(options.secret ?? PAYMENT_WEBHOOK_SECRET, `${timestamp}.${payload}`);
  if (!safeEqual(signature, expected)) {
    return { valid: false, reason: 'Signature does not match the payload.', timestamp };
  }

  return { valid: true, timestamp };
}

export interface DeliveryResult {
  ok: boolean;
  status: number;
  body: string;
  sentSignature: string;
  eventId: string;
}

/**
 * Deliver an event to our own webhook endpoint over real HTTP, exactly like a
 * provider would. `tamper` sends a deliberately wrong signature.
 */
export async function deliverEvent(
  event: MockPaymentEvent,
  options: { tamper?: boolean } = {},
): Promise<DeliveryResult> {
  const payload = JSON.stringify(event);
  const signature = options.tamper
    ? signPayload(payload, { secret: 'whsec_wrong_secret_for_the_demo' })
    : signPayload(payload);

  const response = await fetch(`${APP_URL}/api/webhooks/payments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mockpay-signature': signature,
    },
    body: payload,
    cache: 'no-store',
  });

  const body = await response.text();
  return { ok: response.ok, status: response.status, body, sentSignature: signature, eventId: event.id };
}
