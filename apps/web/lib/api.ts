// apps/web/lib/api.ts
// Client-first fetch helper for FluxCart
// - Always sends a stable x-user-id so cart/checkout/orders belong to the SAME user
// - Prefer passing session email via userIdOverride from components
// - Otherwise falls back to a persistent dev id in localStorage ("flux_user")

export type ApiJSON = Record<string, unknown> | unknown[];

export function getApiBase() {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return base.replace(/\/+$/, "");
}

/**
 * getPreferredUserId(email?)
 * - If a valid email is provided, use it (best for logged-in users)
 * - Else use/persist a stable dev id in localStorage ("flux_user")
 */
export function getPreferredUserId(email?: string): string {
  if (email && email.includes("@")) return email;

  if (typeof window !== "undefined") {
    const key = "flux_user";
    let v = localStorage.getItem(key);
    if (!v) {
      v = `dev_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, v);
    }
    return v;
  }

  // SSR fallback (rarely used for client fetches)
  return "dev";
}

/**
 * Returns a client-only user id (dev id) from localStorage.
 * If none exists, it will create and persist one.
 * NOTE: Prefer getPreferredUserId(session?.user?.email) in components
 */
export function getXUserIdClient(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const key = "flux_user";
    let v = localStorage.getItem(key);
    if (!v) {
      v = `dev_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, v);
    }
    return v;
  } catch {
    return undefined;
  }
}

/**
 * apiFetch(path, init?, userIdOverride?)
 * - Ensures `x-user-id` is ALWAYS sent:
 *   - Uses userIdOverride if provided (pass email here when logged in)
 *   - Otherwise uses a persistent dev id from localStorage
 */
export async function apiFetch<T = ApiJSON>(
  path: string,
  init: RequestInit = {},
  userIdOverride?: string
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  // Choose the id to send with this request
  let xuid = (userIdOverride && userIdOverride.trim()) || undefined;

  // If not explicitly provided, fall back to a stable client id
  if (!xuid) xuid = getXUserIdClient();

  // As a last resort (SSR/no-window), keep requests consistent
  if (!xuid) xuid = "dev";

  headers.set("x-user-id", xuid);

  // If sending JSON body, ensure content-type
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const data = await res.json();
      if (data && (data as any).error) message = String((data as any).error);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const text = await res.text();
  if (!text) return undefined as unknown as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Convenience wrappers */
export const api = {
  get: <T = ApiJSON>(path: string, userIdOverride?: string) =>
    apiFetch<T>(path, { method: "GET" }, userIdOverride),

  post: <T = ApiJSON>(path: string, body?: unknown, userIdOverride?: string) =>
    apiFetch<T>(
      path,
      { method: "POST", body: body ? JSON.stringify(body) : undefined },
      userIdOverride
    ),

  patch: <T = ApiJSON>(path: string, body?: unknown, userIdOverride?: string) =>
    apiFetch<T>(
      path,
      { method: "PATCH", body: body ? JSON.stringify(body) : undefined },
      userIdOverride
    ),

  put: <T = ApiJSON>(path: string, body?: unknown, userIdOverride?: string) =>
    apiFetch<T>(
      path,
      { method: "PUT", body: body ? JSON.stringify(body) : undefined },
      userIdOverride
    ),

  del: <T = ApiJSON>(path: string, userIdOverride?: string) =>
    apiFetch<T>(path, { method: "DELETE" }, userIdOverride),
};
