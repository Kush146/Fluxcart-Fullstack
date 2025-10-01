'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { api } from '@/lib/api';

type Kind = 'BUY' | 'RENT' | 'SWAP';

type Product = {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  images: string[];
  rating?: number;
  category?: string | null;
};

type ProductSearch = {
  items: Product[];
  total: number;
};

type SortKey = 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';

/** ---- Image helpers (category-aware + final inline fallback) ---- */
const FALLBACKS: Record<string, string> = {
  Apparel:     'https://picsum.photos/seed/apparel/1200/1200',
  Books:       'https://picsum.photos/seed/books/1200/1200',
  Electronics: 'https://picsum.photos/seed/electronics/1200/1200',
  Fitness:     'https://picsum.photos/seed/fitness/1200/1200',
  Footwear:    'https://picsum.photos/seed/footwear/1200/1200',
  Furniture:   'https://picsum.photos/seed/furniture/1200/1200',
  Home:        'https://picsum.photos/seed/home/1200/1200',
  Outdoors:    'https://picsum.photos/seed/outdoors/1200/1200',
  Toys:        'https://picsum.photos/seed/toys/1200/1200',
  default:     'https://picsum.photos/seed/fluxcart/1200/1200',
};

// 1x1 transparent GIF (avoids Next.js SVG restrictions)
const FINAL_DATA_URI =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function ProductImage({
  src,
  alt,
  category,
}: {
  src?: string;
  alt: string;
  category?: string | null;
}) {
  const catFallback = (category && FALLBACKS[category]) || FALLBACKS.default;
  const [imgSrc, setImgSrc] = useState(src || catFallback);
  const [triedCat, setTriedCat] = useState(!src);
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full aspect-square bg-neutral-100">
      {loading && <div className="absolute inset-0 animate-pulse bg-neutral-200" />}
      {/* Use a plain <img> to bypass next/image hostname restrictions */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgSrc || FINAL_DATA_URI}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          if (!triedCat) {
            setImgSrc(catFallback);
            setTriedCat(true);
          } else if (imgSrc !== FINAL_DATA_URI) {
            setImgSrc(FINAL_DATA_URI);
          }
          setLoading(false);
        }}
      />
    </div>
  );
}

function formatINR(cents: number) {
  const rupees = cents / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export default function Shop() {
  const { data: session } = useSession();

  // query, category, sort
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<string[]>([]);

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('relevance');

  // Prefer phone (localStorage) -> email -> dev id
  const userIdOverride = getPreferredUserId(session?.user?.email || undefined);

  async function load(search: string, cat?: string) {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (cat) params.set('category', cat);

      const data = await api.get<ProductSearch>(`/products?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite((data as any)?.total) ? (data as any).total : 0);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
      setErr('Couldn’t load products. Try again.');
      toast.error('Couldn’t load products');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const list = await api.get<string[]>(`/products/categories`);
      setCategories(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch {
      // categories are optional
    }
  }

  useEffect(() => {
    load('', '');
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side sort
  const sortedItems = useMemo(() => {
    const arr = [...items];
    switch (sort) {
      case 'price_asc':  return arr.sort((a, b) => a.priceCents - b.priceCents);
      case 'price_desc': return arr.sort((a, b) => b.priceCents - a.priceCents);
      case 'rating_desc':return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      default:           return arr;
    }
  }, [items, sort]);

  async function addToCart(productId: string, kind: Kind = 'BUY') {
    try {
      await api.post('/cart/items', { productId, kind, qty: 1 }, userIdOverride);
      toast.success(kind === 'BUY' ? 'Added to cart' : `${kind} added`);
    } catch {
      toast.error('Failed to add to cart');
    }
  }

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search products..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xl"
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-xl border px-3 text-sm"
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="rating_desc">Rating: High → Low</option>
        </select>

        <Button onClick={() => load(q, category)} disabled={loading}>
          {loading ? 'Searching…' : 'Apply'}
        </Button>

        {(q || category) && (
          <Button
            variant="ghost"
            onClick={() => { setQ(''); setCategory(''); setSort('relevance'); load('', ''); }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Category pill bar */}
      {categories.length > 0 && (
        <div className="-mx-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-2 px-2">
            <Pill
              active={category === ''}
              onClick={() => { setCategory(''); load(q, ''); }}
              label="All"
            />
            {categories.map((c) => (
              <Pill
                key={c}
                active={category === c}
                onClick={() => { setCategory(c); load(q, c); }}
                label={c}
              />
            ))}
          </div>
        </div>
      )}

      {err && <div className="text-red-600">{err}</div>}

      {/* Empty state */}
      {!loading && sortedItems.length === 0 && (
        <div className="grid place-items-center rounded-xl border py-16 text-center">
          <div className="text-lg font-medium">No products found</div>
          <div className="mt-1 text-sm text-neutral-600">
            Try a different search or category.
          </div>
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => { setQ(''); setCategory(''); setSort('relevance'); load('', ''); }}
            >
              Clear filters
            </Button>
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && items.length === 0 &&
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={`sk-${i}`} className="overflow-hidden animate-pulse">
              <div className="aspect-square bg-neutral-100" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-neutral-100 rounded" />
                <div className="h-4 w-1/2 bg-neutral-100 rounded" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-9 bg-neutral-100 rounded-xl" />
                  <div className="h-9 bg-neutral-100 rounded-xl" />
                  <div className="h-9 bg-neutral-100 rounded-xl" />
                </div>
              </div>
            </Card>
          ))
        }

        {sortedItems.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-0">
              <ProductImage src={p.images?.[0]} alt={p.title} category={p.category} />
            </CardContent>
            <div className="p-3 space-y-2">
              <a href={`/p/${p.slug}`} className="font-semibold hover:underline block">
                {p.title}
              </a>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{p.category ?? 'Uncategorized'}</span>
                {typeof p.rating === 'number' && <span>★ {p.rating.toFixed(1)}</span>}
              </div>
              <div className="font-bold">{formatINR(p.priceCents)}</div>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => addToCart(p.id, 'BUY')}>Add</Button>
                <Button onClick={() => addToCart(p.id, 'RENT')} variant="outline">Rent</Button>
                <Button onClick={() => addToCart(p.id, 'SWAP')} variant="outline">Swap</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-sm text-neutral-500">
        {total} products
      </div>
    </div>
  );
}

function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        `whitespace-nowrap rounded-full px-3 py-1 text-sm border ` +
        (active ? 'bg-black text-white border-black' : 'hover:bg-black/5')
      }
      title={label}
    >
      {label}
    </button>
  );
}

/** Chooses the best x-user-id */
function getPreferredUserId(email?: string): string | undefined {
  if (typeof window !== 'undefined') {
    const phone = localStorage.getItem('flux_user');
    if (phone && phone.trim()) return undefined;
  }
  if (email && email.includes('@')) return email;
  return ensureDevUser();
}

function ensureDevUser(): string {
  if (typeof window === 'undefined') return 'dev';
  let id = localStorage.getItem('flux_user');
  if (!id) { id = `dev_${Math.random().toString(36).slice(2)}`; localStorage.setItem('flux_user', id); }
  return id;
}
