'use client';

import { useEffect, useState } from 'react';

export default function PhoneIdentity() {
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem('flux_user');
      const n = localStorage.getItem('flux_user_name');
      setPhone(p && p.trim() ? p : null);
      setName(n && n.trim() ? n : null);
    } catch {}
  }, []);

  if (!phone) return null;

  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="rounded-full bg-black/5 px-3 py-1 text-sm">
        {name ? name : phone}
      </span>
      <button
        className="text-sm underline hover:opacity-80"
        onClick={() => {
          localStorage.removeItem('flux_user');
          localStorage.removeItem('flux_user_name');
          // light reload to refresh UI & header
          window.location.reload();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
