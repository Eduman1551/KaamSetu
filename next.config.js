/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false, // no dev badge during the live demo
  // Keep heavy Node-only packages out of the webpack bundle.
  serverExternalPackages: ['playwright', 'playwright-core', 'pdf-parse', 'ws', 'bcryptjs', 'sharp'],
  // Basic security headers on every response.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  images: {
    // Screenshots are served by our own API route.
    localPatterns: [{ pathname: '/api/student/shot/**' }, { pathname: '/bg.jpg' }],
  },
};
module.exports = nextConfig;
