/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The /agents capability-map flow was retired when the funnel moved to the
      // capability blueprint. Old links, shared URLs and the /blueprints email
      // footer all land on the replacement.
      { source: '/agents', destination: '/blueprint', permanent: true },
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
