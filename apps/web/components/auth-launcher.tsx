'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';

type ModalState = { open: boolean };
type Coords = { top: number; left: number };

const PANEL_WIDTH_PX = 384; // 24rem
const GAP_PX = 8;
const MARGIN_PX = 12;
const AFTER_LOGIN = '/account';

export default function AuthLauncher() {
  const { data: session, status } = useSession();
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [name, setName] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [authing, setAuthing] = useState(false);

  // Keep a stable identifier for the API (email when signed in)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status === 'authenticated' && session?.user?.email) {
      localStorage.setItem('flux_user', session.user.email);
      if (session.user.name) localStorage.setItem('flux_user_name', session.user.name);
      setName(session.user.name ?? session.user.email ?? null);
    } else if (status === 'unauthenticated') {
      // clear stale name if any
      const n = localStorage.getItem('flux_user_name');
      setName(n && n.trim() ? n : null);
    }
  }, [status, session?.user?.email, session?.user?.name]);

  // Read whatever name we had stored (useful for dev/local flows)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!name) {
      const n = localStorage.getItem('flux_user_name');
      if (n && n.trim()) setName(n);
    }
  }, [name]);

  // Close on ESC
  useEffect(() => {
    if (!modal.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setModal({ open: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal.open]);

  const isAuthed = Boolean(session?.user?.email);

  if (isAuthed) {
    const label = name ?? session?.user?.name ?? session?.user?.email ?? 'Signed in';
    return (
      <div className="ml-auto flex items-center gap-3">
        <a
          href="/account"
          className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          title="Go to your account"
        >
          Account
        </a>
        <span
          className="hidden max-w-[18ch] truncate rounded-full bg-black/5 px-3 py-1 text-sm text-neutral-900 sm:inline"
          title={label}
        >
          {label}
        </span>
        <button
          className="text-sm underline text-neutral-900 hover:opacity-80"
          onClick={async () => {
            try {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('flux_user');
                localStorage.removeItem('flux_user_name');
              }
              await signOut({ callbackUrl: '/' });
            } catch {
              window.location.href = '/';
            }
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  function openModal() {
    const btn = btnRef.current;
    if (!btn) {
      setModal({ open: true });
      setCoords(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let left = r.left + scrollX;
    const maxLeft = vw - PANEL_WIDTH_PX - MARGIN_PX;
    if (left > maxLeft) left = Math.max(MARGIN_PX, maxLeft);
    const top = r.bottom + scrollY + GAP_PX;

    setCoords({ top, left });
    setModal({ open: true });
  }

  async function startSignIn(provider: 'email' | 'google') {
    if (authing) return;
    setAuthing(true);
    setModal({ open: false });
    try {
      await signIn(provider, { callbackUrl: AFTER_LOGIN });
    } finally {
      // if signIn navigates we won't see this; harmless fallback
      setAuthing(false);
    }
  }

  return (
    <div className="ml-auto">
      <button
        ref={btnRef}
        className="rounded-full bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
        onClick={openModal}
        disabled={authing}
      >
        {authing ? 'Opening…' : 'Sign in'}
      </button>

      {modal.open && (
        <>
          {/* Backdrop */}
          <button
            aria-label="Close sign in"
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={() => setModal({ open: false })}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed z-[101] w-[min(92vw,384px)] rounded-2xl bg-white p-5 text-neutral-900 shadow-2xl"
            style={{ top: (coords?.top ?? 0) + 'px', left: (coords?.left ?? 0) + 'px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-lg font-semibold">Sign in to FluxCart</div>

            <div className="space-y-3">
              <button
                className="flex w-full items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60"
                onClick={() => startSignIn('email')}
                disabled={authing}
              >
                Continue with Email (free)
              </button>

              <button
                className="flex w-full items-center justify-center rounded-xl border border-neutral-300 px-4 py-2 text-neutral-900 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60"
                onClick={() => startSignIn('google')}
                disabled={authing}
              >
                Continue with Google
              </button>
            </div>

            <button
              className="mt-4 w-full rounded-xl px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand/40"
              onClick={() => setModal({ open: false })}
              disabled={authing}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
