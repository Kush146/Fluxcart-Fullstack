'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  defaultCurrency?: string | null;
  preferences?: any;
  createdAt?: string;
};

export default function AccountPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const userId = getStableUserId(session?.user?.email ?? null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Profile | null>(null);

  // Auth guard: if unauthenticated, bounce to home
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  // Fetch profile once authenticated
  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`${API}/me`, {
          headers: { 'x-user-id': userId },
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({} as any)))?.error || 'Failed to load');
        }
        const data = (await res.json()) as Profile;
        if (!cancelled) setP({ ...data });
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  function normalizePhone(v: string | null | undefined) {
    if (!v) return '';
    // remove spaces/dashes/parentheses; backend expects + and digits only
    return v.replace(/[\s\-()]/g, '');
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/me`, {
        method: 'PUT',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: p.name ?? '',
          avatarUrl: p.avatarUrl ?? '',
          bio: p.bio ?? '',
          phone: normalizePhone(p.phone),          // ← normalized
          addressLine1: p.addressLine1 ?? '',
          addressLine2: p.addressLine2 ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          postalCode: p.postalCode ?? '',
          country: p.country ?? '',
          defaultCurrency: p.defaultCurrency ?? '',
          preferences: p.preferences ?? undefined,
        }),
      });

      if (!res.ok) {
        // show specific messages like "Phone is already in use by another account"
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save');
      }

      const updated = (await res.json()) as Profile;
      setP(updated);
      router.push('/shop'); // redirect on success
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="p-6">Loading your profile…</div>;
  }
  if (status === 'unauthenticated') {
    return null;
  }
  if (err) {
    return <div className="p-6 text-rose-700">Couldn’t load your profile. {err}</div>;
  }
  if (!p) {
    return <div className="p-6">No profile.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Account</h1>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Basic info */}
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-lg font-medium">Basic info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={p.name ?? ''}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>

          <Field label="Avatar URL">
            <input
              value={p.avatarUrl ?? ''}
              onChange={(e) => setP({ ...p, avatarUrl: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
              placeholder="https://…"
            />
          </Field>

          <Field label="Email">
            <input value={p.email ?? ''} readOnly className="w-full cursor-not-allowed rounded-md border bg-neutral-50 px-3 py-2" />
          </Field>

          <Field label="Phone">
            <input
              value={p.phone ?? ''}
              onChange={(e) => setP({ ...p, phone: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
              inputMode="tel"
              placeholder="+911234567890"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Bio">
              <textarea
                value={p.bio ?? ''}
                onChange={(e) => setP({ ...p, bio: e.target.value })}
                className="min-h-[96px] w-full rounded-md border px-3 py-2"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Address */}
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-lg font-medium">Address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1">
            <input
              value={p.addressLine1 ?? ''}
              onChange={(e) => setP({ ...p, addressLine1: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
          <Field label="Address line 2">
            <input
              value={p.addressLine2 ?? ''}
              onChange={(e) => setP({ ...p, addressLine2: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
          <Field label="City">
            <input
              value={p.city ?? ''}
              onChange={(e) => setP({ ...p, city: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
          <Field label="State">
            <input
              value={p.state ?? ''}
              onChange={(e) => setP({ ...p, state: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
          <Field label="Postal code">
            <input
              value={p.postalCode ?? ''}
              onChange={(e) => setP({ ...p, postalCode: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
          <Field label="Country">
            <input
              value={p.country ?? ''}
              onChange={(e) => setP({ ...p, country: e.target.value })}
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-lg font-medium">Preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default currency">
            <input
              value={p.defaultCurrency ?? ''}
              onChange={(e) => setP({ ...p, defaultCurrency: e.target.value })}
              placeholder="INR / USD / EUR…"
              className="w-full rounded-md border px-3 py-2"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-neutral-600">{label}</span>
      {children}
    </label>
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
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('flux_user', id);
  }
  return id;
}
