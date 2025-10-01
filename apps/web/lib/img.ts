// apps/web/lib/img.ts

// Keep this list aligned with next.config.js if you use <Image /> anywhere.
// We normalize hosts (strip "www.") so "www.foo.com" === "foo.com".
const RAW_ALLOWED = [
  'pixabay.com',
  'cdn.pixabay.com',
  'picsum.photos',
  'images.unsplash.com',
  'plus.unsplash.com',
  'loremflickr.com',
  'colgatebookstore.com',
  // a few common retail CDNs (optional, harmless)
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'rukminim2.flixcart.com',
  'i5.walmartimages.com',
  'target.scene7.com',
];

export const ALLOWED_HOSTS = new Set(RAW_ALLOWED.map(h => h.replace(/^www\./, '')));

function normalizeHost(u: string) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function firstSafeImage(urls: string[] | null | undefined) {
  if (!urls || !urls.length) return '/placeholder.svg';
  for (const u of urls) {
    if (!u) continue;
    if (u.startsWith('/')) return u; // local/public
    if (u.startsWith('data:')) return u; // data URIs are fine here
    const host = normalizeHost(u);
    if (ALLOWED_HOSTS.has(host)) return u;
  }
  return '/placeholder.svg';
}
