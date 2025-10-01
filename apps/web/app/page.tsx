'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ShoppingBag,
  PackageOpen,
  RefreshCw,
  Users,
  ArrowRight,
  Percent,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
        <div className="pointer-events-none absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-200/30 blur-3xl" />

        <div className="relative z-10 grid gap-8 px-6 py-12 md:grid-cols-2 md:items-center md:gap-12 md:px-10 lg:px-14 lg:py-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs text-neutral-700 backdrop-blur">
              <Percent className="h-3.5 w-3.5" />
              10% off on orders ₹1000+
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Buy · Rent · Swap · <span className="text-indigo-700">Group-Buy</span>
            </h1>

            <p className="max-w-xl text-neutral-700">
              Welcome to <span className="font-semibold">FluxCart</span> — a playful demo store
              where you can explore a catalog and try a simulated checkout. Add items to cart,
              see auto-applied discounts, and place orders with a single click.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/shop" className="inline-block">
                <Button className="rounded-xl">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Go to Shop
                </Button>
              </Link>

              <Link href="/orders" className="inline-block">
                <Button variant="outline" className="rounded-xl">
                  View Orders
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <p className="text-xs text-neutral-500">
              Tip: Sign in with Email or Google from the top-right to save your orders.
            </p>
          </div>

          <div className="mx-auto w-full max-w-xl">
            <Card className="overflow-hidden">
              <div className="relative h-64 w-full sm:h-80">
                <Image
                  src="https://images.unsplash.com/photo-1554995207-c18c203602cb?q=80&w=1600&auto=format&fit=crop"
                  alt="FluxCart preview"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 640px"
                  className="object-cover"
                  priority
                />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-700">
            <PackageOpen className="h-5 w-5" />
          </div>
          <h3 className="font-semibold">Buy or Rent</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Add items as a purchase or a rental. Try both flows in one cart.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <RefreshCw className="h-5 w-5" />
          </div>
          <h3 className="font-semibold">Swap-friendly</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Experiment with swap items for a playful community vibe.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/10 text-rose-700">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="font-semibold">Group-Buy</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Organize or join group-buys to unlock shared savings.
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-700">
            <Percent className="h-5 w-5" />
          </div>
          <h3 className="font-semibold">Auto-discounts</h3>
          <p className="mt-1 text-sm text-neutral-600">
            10% off auto-applies when your subtotal hits ₹1000 or more.
          </p>
        </Card>
      </section>

      {/* Secondary CTA */}
      <section className="rounded-2xl border bg-white px-6 py-8 text-center md:px-10">
        <h2 className="text-xl font-semibold">Ready to try it out?</h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-neutral-600">
          Browse the catalog, add a few items, and head to checkout. You can simulate
          payments safely during development.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link href="/shop" className="inline-block">
            <Button className="rounded-xl">
              Start Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/cart" className="inline-block">
            <Button variant="outline" className="rounded-xl">
              View Cart
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
