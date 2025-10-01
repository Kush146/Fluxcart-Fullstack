"use client";

import Image from "next/image";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { firstSafeImage } from "@/lib/img"; // still supported if you have it

type Product = {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceCents: number;
  currency?: string;
  rating?: number;
  images: string[];
  category?: string | null;
};

/** Keep this list in sync with apps/web/next.config.js -> images.remotePatterns */
const ALLOWED_HOSTS = new Set<string>([
  // primary you already added
  "picsum.photos",
  "images.unsplash.com",
  "plus.unsplash.com",
  "images.pexels.com",
  "cdn.pixabay.com",
  "lh3.googleusercontent.com",
  // allow your own site/public assets
  // (relative paths like /catalog/... are always allowed)
]);

/** Final fallback if none of the product images are allowed/working */
const FALLBACK =
  "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=60";

function isAllowedForNext(url: string): boolean {
  try {
    if (!url) return false;
    // Allow local/public assets like /catalog/Category/file.jpg
    if (url.startsWith("/")) return true;

    const u = new URL(url);
    // Only http/https
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Must be in Next allowlist
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function normalize(url: string): string {
  return url.trim();
}

function formatPrice(cents: number, currency = "INR") {
  const rupees = cents / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export default function ProductCard({ product }: { product: Product }) {
  const images = Array.isArray(product.images) ? product.images : [];

  // Build a deterministic list of safe candidates that Next.js will accept.
  const safeCandidates = React.useMemo(() => {
    const raw = images.map(normalize).filter(Boolean);

    // Prefer using your shared helper (if it enforces host allow-list)
    // but also locally filter to guarantee we never pass a disallowed host.
    const dedup = Array.from(new Set(raw)); // de-duplicate
    const safe = dedup.filter(isAllowedForNext);

    // If all were filtered out but your helper can still produce something valid, try it:
    const helperPick = firstSafeImage ? firstSafeImage(dedup) : undefined;
    if (safe.length === 0 && helperPick && isAllowedForNext(helperPick)) {
      safe.push(helperPick);
    }

    // Always push a LAST-RESORT fallback at the end
    safe.push(FALLBACK);
    return safe;
  }, [images]);

  const [idx, setIdx] = React.useState(0);
  const [src, setSrc] = React.useState<string>(safeCandidates[0] || FALLBACK);
  const [loading, setLoading] = React.useState(true);

  // Reset whenever product changes
  React.useEffect(() => {
    setIdx(0);
    setSrc(safeCandidates[0] || FALLBACK);
    setLoading(true);
  }, [product.id, safeCandidates]);

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm border">
      <div className="relative w-full aspect-[4/3] bg-neutral-100">
        {loading && <div className="absolute inset-0 animate-pulse bg-neutral-200" />}

        <Image
          src={src}
          alt={product.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
          onLoad={() => setLoading(false)}
          onError={() => {
            // Try next candidate; the last entry is FALLBACK, so this won't explode.
            setIdx((i) => {
              const next = Math.min(i + 1, safeCandidates.length - 1);
              setSrc(safeCandidates[next]);
              return next;
            });
            setLoading(false);
          }}
          priority={false}
        />
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-medium line-clamp-2">{product.title}</h3>
          {typeof product.rating === "number" && (
            <span className="shrink-0 text-sm text-neutral-600">★ {product.rating.toFixed(1)}</span>
          )}
        </div>

        {product.category && (
          <div className="mt-1 text-xs text-neutral-500">{product.category}</div>
        )}

        <div className="mt-3 font-semibold">
          {formatPrice(product.priceCents, product.currency)}
        </div>

        {/* Wire these to your handlers as needed */}
        <div className="mt-3 flex gap-2">
          <button className="px-4 py-2 rounded-full bg-black text-white text-sm">Add</button>
          <button className="px-4 py-2 rounded-full border text-sm">Rent</button>
          <button className="px-4 py-2 rounded-full border text-sm">Swap</button>
        </div>
      </CardContent>
    </Card>
  );
}
