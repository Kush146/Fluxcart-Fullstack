'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type OrderItem = {
  id: string;
  productId: string;
  qty: number;
  kind: 'BUY' | 'RENT' | 'SWAP';
  priceCents: number;
  product?: {
    id: string;
    title: string;
    slug: string;
    images: string[];
  };
};

type Order = {
  id: string;
  status:
    | 'PENDING'
    | 'PAID'
    | 'PACKED'
    | 'SHIPPED'
    | 'ACTIVE_RENT'
    | 'RETURNED'
    | 'REFUNDED'
    | 'CANCELED';
  totalCents: number;
  discountCents: number;
  createdAt: string;
  items: OrderItem[];
};

export default function Orders() {
  const { data: session } = useSession();
  const params = useSearchParams();

  // Use the exact same id everywhere
  const userId = getStableUserId(session?.user?.email ?? undefined);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders`, {
        headers: { 'x-user-id': userId, Accept: 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Auto-confirm Stripe session if we arrive with ?paid=1&sid=...
  useEffect(() => {
    const sid = params.get('sid');
    const paid = params.get('paid');
    if (!sid || paid !== '1') {
      loadOrders();
      return;
    }

    (async () => {
      try {
        await fetch(`${API}/checkout/confirm?sid=${encodeURIComponent(sid)}`, {
          headers: { 'x-user-id': userId, Accept: 'application/json' },
          credentials: 'include',
        });
      } catch {
        // ignore
      } finally {
        loadOrders();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, params]);

  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Your Orders</h1>
      {orders.length === 0 && !loading && (
        <div className="text-neutral-600">No orders yet.</div>
      )}

      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm">
                <b>Order:</b>{' '}
                <Link href={`/orders/${o.id}`} className="underline">
                  {o.id}
                </Link>
              </div>
              <div className="text-xs text-neutral-600">
                {new Date(o.createdAt).toLocaleString()}
              </div>
            </div>
            <StatusPill status={o.status} />
          </div>

          {/* items preview */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {o.items.slice(0, 3).map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.product?.images?.[0]}
                  alt={it.product?.title || it.productId}
                  className="h-12 w-12 rounded object-cover bg-neutral-100"
                />
                <div className="text-sm">
                  <Link
                    href={`/p/${it.product?.slug ?? ''}`}
                    className="font-medium hover:underline"
                  >
                    {it.product?.title ?? `Product ${it.productId}`}
                  </Link>
                  <div className="text-neutral-600">
                    {it.qty} × ₹{(it.priceCents / 100).toFixed(2)} ({it.kind})
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">
              {o.discountCents > 0 && (
                <span className="mr-3 text-green-700">
                  − ₹{(o.discountCents / 100).toFixed(2)} discount
                </span>
              )}
              <b>Total:</b> ₹{(o.totalCents / 100).toFixed(2)}
            </div>
            <Link
              href={`/orders/${o.id}`}
              className="inline-block rounded-xl border px-3 py-2 text-sm"
            >
              View details
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Order['status'] }) {
  const map: Record<Order['status'], string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-blue-100 text-blue-800',
    PACKED: 'bg-purple-100 text-purple-800',
    SHIPPED: 'bg-indigo-100 text-indigo-800',
    ACTIVE_RENT: 'bg-teal-100 text-teal-800',
    RETURNED: 'bg-green-100 text-green-800',
    REFUNDED: 'bg-rose-100 text-rose-800',
    CANCELED: 'bg-neutral-200 text-neutral-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

/** Pick a stable id: prefer existing localStorage 'flux_user' (phone/email/dev),
 * else use session email, else create/persist a dev id.
 */
function getStableUserId(email?: string | null): string {
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem('flux_user');
    if (existing && existing.trim()) return existing.trim();
  }
  if (email && email.includes('@')) return email;
  return ensureDevUser();
}

function ensureDevUser(): string {
  if (typeof window === 'undefined') return 'dev';
  let id = localStorage.getItem('flux_user');
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('flux_user', id);
  }
  return id;
}
