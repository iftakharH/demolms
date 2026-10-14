import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { adminOrders, orderStats } from '@/lib/queries/admin-orders';
import { OrderStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate, formatPence } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Orders · Admin' };

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially refunded' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  await requireStaff('/admin/orders');
  const params = await searchParams;
  const status = typeof params.status === 'string' ? params.status : '';
  const q = typeof params.q === 'string' ? params.q : '';

  const orders = adminOrders({ status, q });
  const stats = orderStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Orders</h1>
        <p className="mt-1 text-sm text-ink-500">
          {stats.paidCount} paid · net revenue {formatPence(stats.netRevenuePence)} ·{' '}
          {stats.refundedCount} refunded ({formatPence(stats.refundedPence)}) · {stats.failedCount} failed
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => {
            const query = new URLSearchParams();
            if (tab.value) query.set('status', tab.value);
            if (q) query.set('q', q);
            const href = query.toString() ? `/admin/orders?${query}` : '/admin/orders';
            return (
              <Link
                key={tab.label}
                href={href}
                className={`chip ${status === tab.value ? 'chip-active' : ''}`}
                aria-current={status === tab.value ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/admin/orders" className="ml-auto flex gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="order-search">
            Search orders
          </label>
          <input
            id="order-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Order, learner or course"
            className="input w-60"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-8" aria-hidden />}
          title="No orders match"
          description="Try a different status or clear the search."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Learner</th>
                  <th>Course</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs text-ink-600">{order.publicId}</td>
                    <td>
                      <span className="block text-sm text-ink-800">{order.userName}</span>
                      <span className="block text-xs text-ink-500">{order.userEmail}</span>
                    </td>
                    <td className="max-w-56">
                      <span className="block truncate text-sm text-ink-800">{order.courseTitle}</span>
                    </td>
                    <td className="text-xs whitespace-nowrap text-ink-500">
                      {formatDate(order.paidAt ?? order.createdAt)}
                    </td>
                    <td className="text-right">
                      <span className="font-medium">{formatPence(order.totalPence)}</span>
                      {order.refundedPence > 0 ? (
                        <span className="block text-xs text-info">
                          -{formatPence(order.refundedPence)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="text-right">
                      <Link href={`/admin/orders/${order.id}`} className="link text-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
