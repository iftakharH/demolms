import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BadgeCheck, CreditCard, Lock, ShieldCheck, Ticket } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { evaluateCoupon } from '@/lib/coupons';
import { queryOne } from '@/lib/db';
import { fileUrl } from '@/lib/file-url';
import { CourseArt } from '@/components/course/course-art';
import { formatPence } from '@/lib/format';
import { startCheckoutAction } from '@/lib/actions/payment-actions';
import { SubmitButton } from '@/components/ui/submit-button';
import { isStaffRole } from '@/lib/types';
import { platformSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
};

interface CheckoutCourse {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  instructor_name: string;
  price_pence: number;
  thumbnail_path: string | null;
}

export default async function CheckoutPage({ params, searchParams }: PageProps<'/checkout/[slug]'>) {
  const { slug } = await params;
  const query = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/${slug}`)}`);
  // Staff accounts never buy courses - support access is how they act for a learner.
  if (isStaffRole(user.role)) redirect(`/courses/${slug}?staff=1`);
  // platform pause: no new enrolments while paused
  if (platformSettings().enrolmentsPaused) redirect(`/courses/${slug}?paused=1`);

  const course = queryOne<CheckoutCourse>(
    `SELECT id, slug, title, subtitle, instructor_name, price_pence, thumbnail_path
       FROM courses WHERE slug = ? AND status = 'published'`,
    slug,
  );
  if (!course) notFound();
  if (course.price_pence === 0) redirect(`/courses/${course.slug}`);

  const enrolment = queryOne<{ id: number; access_revoked: number }>(
    'SELECT id, access_revoked FROM enrolments WHERE user_id = ? AND course_id = ?',
    user.id,
    course.id,
  );
  const alreadyEnrolled = Boolean(enrolment && enrolment.access_revoked === 0);

  const couponInput = typeof query.coupon === 'string' ? query.coupon.trim() : '';
  const couponCheck = couponInput ? evaluateCoupon(couponInput, course.id, course.price_pence) : null;
  const discountPence = couponCheck?.ok ? couponCheck.discountPence : 0;
  const totalPence = Math.max(0, course.price_pence - discountPence);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Link href={`/courses/${course.slug}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="size-4" aria-hidden />
        Back to the course
      </Link>

      <h1 className="page-title mt-4">Checkout</h1>
      <p className="mt-1 text-sm text-ink-500">
        One course, one payment, no cart. You will be taken to the local mock payment page next.
      </p>

      {alreadyEnrolled ? (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-success-line bg-success-soft p-5">
          <p className="flex items-center gap-2 text-sm text-success-strong">
            <BadgeCheck className="size-5 text-success" aria-hidden />
            You already have access to this course.
          </p>
          <Link href={`/learn/courses/${course.slug}`} className="btn-primary btn-sm">
            Go to the course
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* --------------------------------------------------------- left column */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="section-title">Your order</h2>
            <div className="mt-4 flex gap-4">
              <span className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                {course.thumbnail_path ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local static asset
                  <img src={fileUrl(course.thumbnail_path)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <CourseArt title={course.title} slug={course.slug} className="h-full w-full" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{course.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{course.subtitle}</p>
                <p className="mt-1 text-xs text-ink-500">by {course.instructor_name}</p>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="section-title flex items-center gap-2">
              <Ticket className="size-4 text-brand-600" aria-hidden />
              Coupon code
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Try <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">WELCOME10</code> for 10% off
              (seeded demo coupon).
            </p>

            <form method="get" action={`/checkout/${course.slug}`} className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="coupon">
                Coupon code
              </label>
              <input
                id="coupon"
                name="coupon"
                defaultValue={couponInput}
                placeholder="WELCOME10"
                className="input font-mono uppercase"
              />
              <button type="submit" className="btn-secondary">
                Apply
              </button>
            </form>

            {couponCheck ? (
              <p
                className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${
                  couponCheck.ok
                    ? 'border border-success-line bg-success-soft text-success-strong'
                    : 'border border-danger-line bg-danger-soft text-danger'
                }`}
              >
                {couponCheck.message}
              </p>
            ) : null}
            {typeof query.error === 'string' ? (
              <p className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                {query.error}
              </p>
            ) : null}
            {couponInput && couponCheck?.ok ? (
              <p className="mt-3 text-xs text-ink-500">
                <Link href={`/checkout/${course.slug}`} className="link">
                  Remove coupon
                </Link>
              </p>
            ) : null}
          </section>
        </div>

        {/* -------------------------------------------------------- right column */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title">Summary</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Course price</dt>
                <dd className="text-ink-800">{formatPence(course.price_pence)}</dd>
              </div>
              {discountPence > 0 ? (
                <div className="flex justify-between text-success-strong">
                  <dt>Discount {couponCheck?.coupon ? `(${couponCheck.coupon.code})` : ''}</dt>
                  <dd>-{formatPence(discountPence)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
                <dt>Total due today</dt>
                <dd>{formatPence(totalPence)}</dd>
              </div>
            </dl>

            <form action={startCheckoutAction} className="mt-5 space-y-3">
              <input type="hidden" name="slug" value={course.slug} />
              <input type="hidden" name="coupon" value={couponInput} />
              <SubmitButton className="btn-primary btn-lg w-full" pendingLabel="Opening payment page...">
                <CreditCard className="size-4" aria-hidden />
                {totalPence === 0 ? 'Complete free order' : `Pay ${formatPence(totalPence)}`}
              </SubmitButton>
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-500">
                <Lock className="size-3.5" aria-hidden />
                Local mock payment - no real card is ever charged
              </p>
            </form>
          </div>

          <div className="card p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <ShieldCheck className="size-4 text-brand-600" aria-hidden />
              What happens next
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-ink-600">
              <li>1. A pending order is created with the coupon applied.</li>
              <li>2. The mock provider page takes a test card.</li>
              <li>3. A signed webhook marks the order paid and creates your enrolment.</li>
              <li>4. Your receipt appears in Orders and in the email outbox.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
