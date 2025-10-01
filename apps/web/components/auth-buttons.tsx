'use client';

import { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AuthButtons() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="ml-auto h-9 w-20 animate-pulse rounded-xl bg-neutral-200" />
    );
  }

  // Signed in – show user & sign out
  if (session?.user) {
    const name = session.user.name ?? session.user.email ?? 'You';
    return (
      <div className="ml-auto flex items-center gap-3">
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">
          {name.toString().split(' ')[0]}
        </span>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  // Signed out – show "Sign in" which opens the modal
  return (
    <>
      <div className="ml-auto">
        <Button onClick={() => setOpen(true)}>Sign in</Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <Card
            className="w-full max-w-md rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-semibold">Sign in to FluxCart</h2>

            <div className="grid gap-3">
              {/* Email (magic link) */}
              <Button
                variant="outline"
                className="justify-center"
                onClick={() => {
                  setOpen(false);
                  // Our email page sends the magic link
                  location.href = '/auth/email';
                }}
              >
                Continue with Email (free)
              </Button>

              {/* Google */}
              <Button
                variant="outline"
                className="justify-center"
                onClick={() => signIn('google')}
              >
                Continue with Google
              </Button>
            </div>

            <div className="mt-4 flex justify-center">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>

            {/* Optional: link to GitHub repo */}
            <div className="mt-2 text-center text-xs text-neutral-500">
              <Link href="https://github.com/" target="_blank" className="underline">
                GitHub
              </Link>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
