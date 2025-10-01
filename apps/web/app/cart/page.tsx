'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { api } from '@/lib/api';

type CartItem = {
  id: string;
  qty: number;
  kind: 'BUY' | 'RENT' | 'SWAP';
  startDate?: string | null;
  endDate?: string | null;
  product: {
    id: string;
    title: string;
    slug: string;
    priceCents: number;
    images: string[];
  };
};

const DISCOUNT_THRESHOLD = 1000 * 100;

export default function CartPage() {
  const { data: session } = useSession();
  // Prefer phone (OTP) ➜ email ➜ dev id
  const userIdOverride = getPreferredUserId(session?.user?.email || undefined);

  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<CartItem[]>('/cart', userIdOverride);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // runs when sign-in changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdOverride]);

  const subtotalCents = useMemo(
    () => items.reduce((s, it) => s + it.product.priceCents * it.qty, 0),
    [items]
  );

  const discountCents = useMemo(
    () => (subtotalCents >= DISCOUNT_THRESHOLD ? Math.floor(subtotalCents * 0.1) : 0),
    [subtotalCents]
  );

  const finalTotalCents = subtotalCents - discountCents;

  async function removeItem(id: string) {
    try {
      // optimistic UI
      const prev = items;
      setItems(prev.filter((i) => i.id !== id));
      await api.del(`/cart/items/${id}`, userIdOverride);
    } catch {
      toast.error('Remove failed');
      load();
    }
  }

  async function setQty(id: string, nextQty: number) {
    // clamp
    nextQty = Math.max(0, Math.min(nextQty, 99));

    // optimistic UI
    const prev = items;
    if (nextQty === 0) {
      setItems(prev.filter((i) => i.id !== id));
    } else {
      setItems(prev.map((i) => (i.id === id ? { ...i, qty: nextQty } : i)));
    }

    try {
      if (nextQty === 0) {
        await api.del(`/cart/items/${id}`, userIdOverride);
      } else {
        await api.patch(`/cart/items/${id}`, { qty: nextQty }, userIdOverride);
      }
    } catch (err) {
      console.error(err);
      setItems(prev); // rollback
      toast.error('Failed to update quantity');
    }
  }

  async function checkout() {
    try {
      setCheckingOut(true);
      const data = await api.post<{ url?: string }>('/checkout/session', {}, userIdOverride);
      if (data?.url) {
        window.location.href = data.url; // simulated URL or Stripe checkout
      } else {
        window.location.href = '/orders';
      }
    } catch (err: any) {
      toast.error(`Checkout failed: ${String(err?.message || err).slice(0, 120)}`);
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Cart</h1>

      {items.length === 0 && !loading && (
        <div className="text-neutral-600">Your cart is empty.</div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <Card key={it.id} className="p-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.product.images?.[0]}
              alt={it.product.title}
              className="h-16 w-16 rounded object-cover"
            />
            <div className="flex-1">
              <div className="font-medium">{it.product.title}</div>
              <div className="text-sm text-neutral-600">
                {it.qty} × ₹{(it.product.priceCents / 100).toFixed(2)} ({it.kind})
              </div>

              {/* qty stepper */}
              <div className="mt-2 inline-flex items-center gap-2">
                <Button variant="outline" onClick={() => setQty(it.id, it.qty - 1)}>
                  –
                </Button>
                <div className="min-w-[2rem] text-center">{it.qty}</div>
                <Button variant="outline" onClick={() => setQty(it.id, it.qty + 1)}>
                  +
                </Button>
              </div>
            </div>

            {/* line subtotal */}
            <div className="text-right min-w-[90px]">
              <div className="font-medium">₹{((it.product.priceCents * it.qty) / 100).toFixed(2)}</div>
              <Button className="mt-2" variant="outline" onClick={() => removeItem(it.id)}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Subtotal</span>
          <span>₹{(subtotalCents / 100).toFixed(2)}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex items-center justify-between text-green-700">
            <span>10% off (₹1000+)</span>
            <span>-₹{(discountCents / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>₹{(finalTotalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={checkout} disabled={items.length === 0 || loading || checkingOut}>
          {checkingOut ? 'Processing…' : 'Checkout'}
        </Button>
      </div>
    </div>
  );
}

/** Chooses the best x-user-id:
 * - If a phone is present in localStorage (set by OTP), we don't override (api helper will read it).
 * - Else we pass email if available.
 * - Else we generate/persist a dev id.
 */
function getPreferredUserId(email?: string): string | undefined {
  if (typeof window !== 'undefined') {
    const phone = localStorage.getItem('flux_user');
    if (phone && phone.trim()) return undefined; // let api helper use phone automatically
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
