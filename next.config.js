/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false, // no dev badge during the live demo
  // Keep heavy Node-only packages out of the webpack bundle.
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', 'pdf-parse', 'ws', 'bcryptjs', 'sharp'],
  // Vercel: ship the serverless Chromium binary with the analyze function (it is read
  // from disk at runtime, so file tracing can't find it on its own). Only real paths under
  // node_modules/.pnpm: globbing through pnpm's symlinked node_modules/<pkg> folders makes
  // Vercel reject the function ("files in symlinked directories").
  outputFileTracingIncludes: {
    '/api/analyze': [
      './node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**',
      // playwright-core loads parts of itself dynamically; ship the whole package (~10 MB).
      './node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**',
    ],
  },
  // The full `playwright` package is only used locally; never bundle it into functions.
  outputFileTracingExcludes: {
    '*': ['**/node_modules/playwright/**', '**/node_modules/.pnpm/playwright@*/**'],
  },
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
