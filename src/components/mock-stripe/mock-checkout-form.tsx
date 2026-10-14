'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, CreditCard, Send, ShieldAlert, XCircle } from 'lucide-react';
import { submitMockPayment, type PayResult } from '@/lib/actions/payment-actions';
import { TEST_CARDS } from '@/lib/payments-client';
import { formatPence } from '@/lib/format';

interface OrderView {
  publicId: string;
  amountPence: number;
  courseTitle: string;
  customerEmail: string;
  cardholderName: string;
}

/**
 * The hosted payment page. Submitting charges the fake card, then the server
 * action delivers a *signed webhook* to our own endpoint and shows the raw
 * result here - so the demo can prove verification and idempotency.
 */
export function MockCheckoutForm({ order }: { order: OrderView }) {
  const router = useRouter();
  const [result, setResult] = useState<PayResult | null>(null);
  const [pending, setPending] = useState(false);
  const [card, setCard] = useState('4242 4242 4242 4242');

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      const outcome = await submitMockPayment(formData);
      setResult(outcome);
      if (outcome.status === 'declined' || outcome.status === 'error') {
        setPending(false);
      }
    } catch (error) {
      setResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
      setPending(false);
    }
  }

  if (result && result.status !== 'declined') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div
          className={`card p-6 ${
            result.status === 'paid' ? 'border-emerald-200 bg-success-soft' : 'border-rose-200 bg-danger-soft'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.status === 'paid' ? (
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
            )}
            <div>
              <h1 className="text-lg font-semibold text-ink-900">
                {result.status === 'paid' ? 'Payment approved' : 'Payment could not be processed'}
              </h1>
              <p className="mt-1 text-sm text-ink-700">{result.message}</p>
            </div>
          </div>
        </div>

        {result.delivery ? (
          <DeliveryLog
            label="Webhook delivered to /api/webhooks/payments"
            status={result.delivery.status}
            body={result.delivery.body}
            eventId={result.delivery.eventId}
          />
        ) : null}

        {result.badSignatureDelivery ? (
          <DeliveryLog
            label="Tampered signature attempt (dev button) - the webhook rejected it"
            status={result.badSignatureDelivery.status}
            body={result.badSignatureDelivery.body}
            tone="danger"
          />
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {result.redirectTo ? (
            <button type="button" className="btn-primary" onClick={() => router.push(result.redirectTo!)}>
              Continue to your receipt
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setResult(null);
              setPending(false);
            }}
          >
            Back to the card form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-ink-900">Pay {formatPence(order.amountPence)}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {order.courseTitle} · order {order.publicId}
        </p>

        {result?.status === 'declined' ? (
          <>
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {result.message}
            </p>
            {result.delivery ? (
              <DeliveryLog
                label="Decline reported to the app via a signed webhook"
                status={result.delivery.status}
                body={result.delivery.body}
                eventId={result.delivery.eventId}
              />
            ) : null}
          </>
        ) : null}

        <form action={onSubmit} className="mt-5 space-y-4">
          <input type="hidden" name="order" value={order.publicId} />

          <div>
            <label className="label" htmlFor="name">
              Name on card
            </label>
            <input id="name" name="name" defaultValue={order.cardholderName} required className="input" />
          </div>

          <div>
            <label className="label" htmlFor="card">
              Card number
            </label>
            <div className="relative">
              <input
                id="card"
                name="card"
                value={card}
                onChange={(event) => setCard(event.target.value)}
                required
                inputMode="numeric"
                autoComplete="cc-number"
                className="input pr-10 font-mono"
              />
              <CreditCard className="absolute top-2.5 right-3 size-5 text-ink-400" aria-hidden />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCard('4242 4242 4242 4242')}
                className="chip px-2.5 py-1 text-xs"
              >
                Succeeds
              </button>
              <button
                type="button"
                onClick={() => setCard('4000 0000 0000 0002')}
                className="chip px-2.5 py-1 text-xs"
              >
                Declines
              </button>
              <button
                type="button"
                onClick={() => setCard('5555 5555 5555 4444')}
                className="chip px-2.5 py-1 text-xs"
              >
                Mastercard
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="expiry">
                Expiry
              </label>
              <input id="expiry" name="expiry" defaultValue="12 / 29" required className="input font-mono" />
            </div>
            <div>
              <label className="label" htmlFor="cvc">
                CVC
              </label>
              <input id="cvc" name="cvc" defaultValue="123" required className="input font-mono" />
            </div>
          </div>

          <fieldset className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-3.5">
            <legend className="px-1.5 text-xs font-semibold tracking-wide text-brand-800 uppercase">
              Developer options
            </legend>
            <label className="flex items-start gap-2.5 text-sm text-brand-950">
              <input
                type="checkbox"
                name="simulate_bad_signature"
                className="mt-0.5 size-4 rounded border-brand-300"
              />
              <span>
                <span className="font-medium">Simulate bad signature</span>
                <span className="block text-xs text-brand-900/80">
                  Sends a second, wrongly-signed event first and shows the webhook rejecting it.
                </span>
              </span>
            </label>
          </fieldset>

          <button type="submit" disabled={pending} className="btn-primary btn-lg w-full">
            {pending ? 'Processing payment...' : `Pay ${formatPence(order.amountPence)}`}
          </button>
        </form>

        <p className="mt-4 text-xs text-ink-500">
          Test cards: <code className="rounded bg-ink-100 px-1">4242 4242 4242 4242</code> succeeds,{' '}
          <code className="rounded bg-ink-100 px-1">4000 0000 0000 0002</code> declines. Any other
          number is rejected.
        </p>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Order</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Course</dt>
              <dd className="text-right text-ink-800">{order.courseTitle}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Customer</dt>
              <dd className="text-right text-ink-800">{order.customerEmail}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatPence(order.amountPence)}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5 text-sm text-ink-600">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldAlert className="size-4 text-brand-600" aria-hidden />
            How this demo works
          </h2>
          <p className="mt-2">
            Approving a card does not mark the order paid. The server signs an event with HMAC-SHA256
            and POSTs it to the app&rsquo;s real webhook endpoint, which verifies the signature and
            only then creates the enrolment.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Card values are never stored; only the brand and last four digits are kept, like a real
            provider would give you.
          </p>
        </div>

        <div className="card border-warning/40 bg-warning-soft p-4 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5" aria-hidden />
            Demo only
          </p>
          <p className="mt-1">
            No payment network is involved. Expected test numbers:{' '}
            <code className="rounded bg-white/70 px-1">{TEST_CARDS.success}</code>,{' '}
            <code className="rounded bg-white/70 px-1">{TEST_CARDS.decline}</code>.
          </p>
        </div>
      </aside>
    </div>
  );
}

function DeliveryLog({
  label,
  status,
  body,
  eventId,
  tone = 'neutral',
}: {
  label: string;
  status: number;
  body: string;
  eventId?: string;
  tone?: 'neutral' | 'danger';
}) {
  const ok = status >= 200 && status < 300;
  return (
    <div className={`card mt-4 p-4 ${tone === 'danger' ? 'border-rose-200' : ''}`}>
      <p className="flex items-center gap-2 text-sm font-medium text-ink-800">
        <Send className={`size-4 ${ok ? 'text-emerald-600' : 'text-danger'}`} aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-xs text-ink-500">
        HTTP <span className={`font-mono font-semibold ${ok ? 'text-emerald-700' : 'text-danger'}`}>{status}</span>
        {eventId ? (
          <>
            {' '}
            · event <code className="rounded bg-ink-100 px-1">{eventId}</code>
          </>
        ) : null}
      </p>
      <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-950 p-3 text-[0.6875rem] leading-relaxed text-ink-100">
        {pretty(body)}
      </pre>
    </div>
  );
}

function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
