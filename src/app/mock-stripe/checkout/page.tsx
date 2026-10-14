import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { queryOne } from '@/lib/db';
import { MockCheckoutForm } from '@/components/mock-stripe/mock-checkout-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'mockpay · Secure checkout',
  robots: { index: false },
};

export default async function MockCheckoutPage({ searchParams }: PageProps<'/mock-stripe/checkout'>) {
  const params = await searchParams;
  const publicId = typeof params.order === 'string' ? params.order : '';

  const order = publicId
    ? queryOne<{
        public_id: string;
        total_pence: number;
        status: string;
        course_title: string;
        user_email: string;
        user_name: string;
      }>(
        `SELECT o.public_id, o.total_pence, o.status, c.title AS course_title,
                u.email AS user_email, u.name AS user_name
           FROM orders o
           JOIN courses c ON c.id = o.course_id
           JOIN users u ON u.id = o.user_id
          WHERE o.public_id = ?`,
        publicId,
      )
    : undefined;

  if (!order) notFound();

  return (
    <MockCheckoutForm
      order={{
        publicId: order.public_id,
        amountPence: order.total_pence,
        courseTitle: order.course_title,
        customerEmail: order.user_email,
        cardholderName: order.user_name,
      }}
    />
  );
}
