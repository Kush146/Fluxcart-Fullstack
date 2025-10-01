'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function EmailSignInPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await signIn('email', {
        email,
        redirect: false, // stay on page and show message
        callbackUrl: '/',
      });
      if (res?.ok) setSent(true);
      else setErr(res?.error || 'Failed to send magic link');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Use email (free), Google, or Phone.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-neutral-700">Email</span>
          <input
            type="email"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || sent}
          />
        </label>
        <button
          type="submit"
          disabled={loading || sent}
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send magic link'}
        </button>
      </form>

      {sent && (
        <p className="mt-4 rounded border bg-green-50 p-3 text-sm text-green-800">
          Check your inbox for a sign-in link.
        </p>
      )}
      {err && (
        <p className="mt-4 rounded border bg-red-50 p-3 text-sm text-red-700">
          {err}
        </p>
      )}

      <div className="mt-6 space-y-2">
        <a href="/api/auth/signin?provider=google" className="block rounded border px-4 py-2 text-center hover:bg-black/5">
          Continue with Google
        </a>
        <a href="/auth/phone" className="block rounded border px-4 py-2 text-center hover:bg-black/5">
          Continue with Phone <span className="text-xs text-neutral-500">(real SMS needs billing)</span>
        </a>
      </div>

      <div className="mt-6 text-center">
        <a href="/" className="text-sm text-blue-600 underline underline-offset-2">← Back to Home</a>
      </div>
    </div>
  );
}
