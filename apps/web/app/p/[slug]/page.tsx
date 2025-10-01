'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { api } from '@/lib/api';

type Kind = 'BUY' | 'RENT' | 'SWAP';

type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  images: string[];
};

type GB = {
  id: string;
  productId: string;
  minParticipants: number;
  deadline: string;
  status: 'OPEN' | 'SETTLING' | 'SUCCESS' | 'FAILED';
  _count: { participants: number };
};

export default function ProductDetailPage() {
  const { data: session } = useSession();
  // Prefer phone (localStorage) -> email -> dev id
  const userIdOverride = getPreferredUserId(session?.user?.email || undefined);

  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // cart controls
  const [qty, setQty] = useState(1);
  const [kind, setKind] = useState<Kind>('BUY');

  // group-buy
  const [gbs, setGBs] = useState<GB[]>([]);
  const [gbMin, setGbMin] = useState(5);
  const [gbDays, setGbDays] = useState(3);
  const [gbLoading, setGbLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.get<Product>(`/products/${encodeURIComponent(slug)}`);
        setProduct(p);
        await loadGBs(p.id);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  async function loadGBs(productId: string) {
    try {
      const data = await api.get<GB[]>(`/group-buys?productId=${encodeURIComponent(productId)}`);
      setGBs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }

  async function addToCart() {
    if (!product) return;
    try {
      await api.post('/cart/items', { productId: product.id, qty, kind }, userIdOverride);
      toast.success('Added to cart. View cart →', {
        action: {
          label: 'View cart',
          onClick: () => (window.location.href = '/cart'),
        },
      });
    } catch {
      toast.error('Failed to add to cart');
    }
  }

  async function createGB() {
    if (!product) return;
    setGbLoading(true);
    try {
      const deadline = new Date(Date.now() + gbDays * 24 * 60 * 60 * 1000).toISOString();
      await api.post(
        '/group-buys',
        { productId: product.id, minParticipants: gbMin, deadline },
        userIdOverride
      );
      toast.success('Group-buy created');
      await loadGBs(product.id);
    } catch (e) {
      console.error(e);
      toast.error('Create group-buy failed');
    } finally {
      setGbLoading(false);
    }
  }

  async function joinGB(id: string) {
    try {
      await api.post(`/group-buys/${id}/join`, {}, userIdOverride);
      toast.success('Joined group-buy');
      if (product) await loadGBs(product.id);
    } catch (e) {
      console.error(e);
      toast.error('Join failed');
    }
  }

  if (loading) return <div className="p-4">Loading…</div>;
  if (!product) return <div className="p-4">Not found</div>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images?.[0]}
          alt={product.title}
          className="w-full object-cover"
          style={{ aspectRatio: '1 / 1' }}
        />
      </Card>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <div className="text-lg font-bold mt-1">₹{(product.priceCents / 100).toFixed(2)}</div>
          <p className="text-neutral-700 mt-2">{product.description}</p>
        </div>

        {/* Kind + Qty + Add */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {(['BUY', 'RENT', 'SWAP'] as Kind[]).map((k) => (
              <Button
                key={k}
                variant={kind === k ? 'default' : 'outline'}
                onClick={() => setKind(k)}
              >
                {k}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </Button>
            <div className="w-10 text-center">{qty}</div>
            <Button variant="outline" onClick={() => setQty((q) => q + 1)}>
              +
            </Button>
          </div>
          <Button className="mt-2" onClick={addToCart}>
            Add to Cart
          </Button>
        </div>

        {/* Group-Buy widget */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Group-Buy</h2>

          {/* Existing group-buys */}
          <div className="space-y-2">
            {gbs.length === 0 && (
              <div className="text-sm text-neutral-600">No active group-buys yet.</div>
            )}
            {gbs.map((gb) => {
              const count = gb._count?.participants ?? 0;
              const pct = Math.min(100, Math.round((count / gb.minParticipants) * 100));
              const until = new Date(gb.deadline).toLocaleString();
              return (
                <Card key={gb.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div>
                        <b>{count}</b> / {gb.minParticipants} joined
                      </div>
                      <div className="text-xs text-neutral-600">Deadline: {until}</div>
                    </div>
                    <Button onClick={() => joinGB(gb.id)}>Join</Button>
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-neutral-200">
                    <div className="h-2 rounded bg-black" style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Create a new group-buy */}
          <Card className="p-3 space-y-2">
            <div className="text-sm font-medium">Start a new group-buy</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-600 mb-1">Min participants</div>
                <Input
                  type="number"
                  min={2}
                  value={gbMin}
                  onChange={(e) => setGbMin(Math.max(2, Number(e.target.value) || 2))}
                />
              </div>
              <div>
                <div className="text-xs text-neutral-600 mb-1">Deadline (days)</div>
                <Input
                  type="number"
                  min={1}
                  value={gbDays}
                  onChange={(e) => setGbDays(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
            </div>
            <Button onClick={createGB} disabled={gbLoading}>
              {gbLoading ? 'Creating…' : 'Create group-buy'}
            </Button>
          </Card>
        </div>
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
