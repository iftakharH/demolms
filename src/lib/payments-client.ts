/**
 * Client-safe payment constants.
 * (payments.ts is server-only: it signs payloads with node:crypto.)
 */
export const TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  mastercard: '5555555555554444',
} as const;

export const CARD_LABELS: { value: string; label: string; outcome: 'success' | 'decline' }[] = [
  { value: '4242 4242 4242 4242', label: 'Visa · succeeds', outcome: 'success' },
  { value: '4000 0000 0000 0002', label: 'Visa · declines', outcome: 'decline' },
  { value: '5555 5555 5555 4444', label: 'Mastercard · succeeds', outcome: 'success' },
];
