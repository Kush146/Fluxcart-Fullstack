'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type OrderItem = {
  id: string;
  productId: string;
  qty: number;
  kind: 'BUY'|'RENT'|'SWAP';
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
  status: 'PENDING'|'PAID'|'PACKED'|'SHIPPED'|'ACTIVE_RENT'|'RETURNED'|'REFUNDED'|'CANCELED';
  totalCents: number;
  discountCents: number;
  createdAt: string;
  items: OrderItem[];
};

const FLOW: Order['status'][] = ['PENDING','PAID','PACKED','SHIPPED'];

export default function OrderDetail() {
  const { data: session } = useSession();
  const userId = getStableUserId(session?.user?.email ?? null);

  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/orders/${params.id}`, {
          headers: { 'x-user-id': userId },
          credentials: 'include',
        });
        if (res.ok) {
          const o = await res.json();
          setOrder(o);
        } else {
          setOrder(null);
        }
      } catch (e) {
        console.error(e);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, userId]);

  const stepIndex = useMemo(() => {
    if (!order) return 0;
    const idx = FLOW.indexOf(order.status);
    return idx >= 0 ? idx : 0;
  }, [order]);

  async function reorder() {
    if (!order) return;
    setReordering(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/reorder`, {
        method: 'POST',
        headers: { 'x-user-id': userId }, // removed Content-Type
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${data.added} item(s) to cart`);
        router.push('/cart');
      } else {
        toast.error(data?.error || 'Reorder failed');
      }
    } catch {
      toast.error('Reorder failed');
    } finally {
      setReordering(false);
    }
  }

  async function resendEmail() {
    if (!order) return;
    setResending(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/resend-email`, {
        method: 'POST',
        headers: { 'x-user-id': userId }, // removed Content-Type
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Receipt email sent');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to send email');
      }
    } catch {
      toast.error('Failed to send email');
    } finally {
      setResending(false);
    }
  }

  if (loading) return <div className="p-4">Loading…</div>;
  if (!order) return (
    <div className="p-4">
      Order not found.{' '}
      <button className="underline" onClick={() => router.push('/orders')}>Back</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Order {order.id}</h1>
          <div className="text-sm text-neutral-600">{new Date(order.createdAt).toLocaleString()}</div>
          <StatusPill status={order.status} />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={reorder} disabled={reordering}>
            {reordering ? 'Adding…' : 'Reorder'}
          </Button>

          <a
            href={`${API}/orders/${order.id}/receipt.pdf?uid=${encodeURIComponent(session?.user?.email ?? userId)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-xl border px-3 py-2 text-sm"
          >
            Download PDF
          </a>

          <Button variant="outline" onClick={resendEmail} disabled={resending}>
            {resending ? 'Sending…' : 'Resend receipt'}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="py-2">
        <div className="flex items-center gap-2">
          {FLOW.map((s, i) => {
            const active = i <= stepIndex;
            return (
              <div key={s} className="flex items-center">
                <div className={`h-6 w-6 rounded-full text-[10px] grid place-items-center ${active ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                  {i+1}
                </div>
                <span className={`mx-2 text-xs ${active ? 'font-medium' : 'text-neutral-500'}`}>{s.replace('_',' ')}</span>
                {i < FLOW.length - 1 && (
                  <div className={`h-[2px] w-8 ${i < stepIndex ? 'bg-black' : 'bg-neutral-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {order.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.product?.images?.[0]}
              alt={it.product?.title || it.productId}
              className="h-16 w-16 rounded object-cover bg-neutral-100"
            />
            <div className="flex-1">
              <Link href={`/p/${it.product?.slug ?? ''}`} className="font-medium hover:underline">
                {it.product?.title ?? `Product ${it.productId}`}
              </Link>
              <div className="text-sm text-neutral-600">
                {it.qty} × ₹{(it.priceCents/100).toFixed(2)} ({it.kind})
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t pt-3 text-sm">
        {order.discountCents > 0 && (
          <div className="flex items-center justify-between text-green-700">
            <span>Discount</span>
            <span>− ₹{(order.discountCents/100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>₹{(order.totalCents/100).toFixed(2)}</span>
        </div>
      </div>

      <div>
        <Link href="/orders" className="inline-block rounded-xl border px-3 py-2 text-sm">
          Back to orders
        </Link>
      </div>
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
    <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${map[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

/** Keep your original behavior but accept null/undefined from NextAuth. */
function getStableUserId(email?: string | null): string {
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem('flux_user');
    if (existing && existing.trim()) return existing.trim();
  }
  if (email && email.includes('@')) return email;
  return ensureDevUser();
}

function ensureDevUser(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('flux_user');
  if (!id) { id = `dev_${Math.random().toString(36).slice(2)}`; localStorage.setItem('flux_user', id); }
  return id;
}
