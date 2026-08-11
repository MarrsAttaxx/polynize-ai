/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The /agents capability-map flow was retired when the funnel moved to the
      // capability blueprint. Old links, shared URLs and the /blueprints email
      // footer all land on the replacement.
      // The funnel is "Map your team" now, so the URL says what the button says. The
      // artefact is still called a blueprint; the route it lives at is not.
      { source: '/blueprint', destination: '/map-your-team', permanent: true },
      { source: '/blueprint/:id', destination: '/map-your-team/:id', permanent: true },
      { source: '/agents', destination: '/map-your-team', permanent: true },
      // The scroll-story variant of /mapping replaced the original, so it is /mapping
      // now. The experiment URL was shared while it was being judged.
      { source: '/mapping/story', destination: '/mapping', permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: '/proposals/:slug', destination: '/proposals/:slug.html' },
      { source: '/pricing', destination: '/pricing.html' },
    ];
  },
  async headers() {
    return [
      {
        /**
         * The touch samples, readable cross-origin.
         *
         * An IMPORTED prezie is served under `Content-Security-Policy: sandbox`, which gives it an opaque
         * origin, so fetching its own server's files is a cross-origin request. Without this the clip
         * plays silently, which is the one thing the import exists to fix.
         */
        source: '/pam/sfx/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/proposals/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/brand',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
