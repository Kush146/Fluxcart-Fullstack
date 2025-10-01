/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Flip to true if you want to bypass Next/Image domain checks during local dev
    // (useful if a new hostname appears). Keep it false for production.
    unoptimized: false,

    // Smaller HTML, modern formats when possible
    formats: ['image/avif', 'image/webp'],

    // Cache remote images a bit longer
    minimumCacheTTL: 60 * 60 * 24, // 24h

    remotePatterns: [
      // ==== Primary sources from your pipeline ====
      { protocol: 'https', hostname: 'cdn.pixabay.com', pathname: '/photo/**' },
      { protocol: 'https', hostname: 'pixabay.com', pathname: '/get/**' },

      // ==== Previously-seen/legacy rows ====
      { protocol: 'https', hostname: 'loremflickr.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'plus.unsplash.com', pathname: '/**' },

      // ==== Retail/CDN hosts commonly found in product sheets ====
      { protocol: 'https', hostname: 'm.media-amazon.com', pathname: '/images/**' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com', pathname: '/images/**' },
      { protocol: 'https', hostname: 'rukminim1.flixcart.com', pathname: '/**' },
      { protocol: 'https', hostname: 'store.storeimages.cdn-apple.com', pathname: '/**' },
      { protocol: 'https', hostname: 'image01-in.oneplus.net', pathname: '/**' },
      { protocol: 'https', hostname: 'images.samsung.com', pathname: '/**' },

      // ==== Specific hosts you hit in errors ====
      { protocol: 'https', hostname: 'www.colgatebookstore.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.smartcellular.us', pathname: '/**' },
      { protocol: 'https', hostname: 'smartcellular.us', pathname: '/**' },
    ],
  },
};

export default nextConfig;
