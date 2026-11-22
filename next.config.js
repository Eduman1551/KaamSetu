/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false, // no dev badge during the live demo
  // Keep heavy Node-only packages out of the webpack bundle.
  serverExternalPackages: ['playwright', 'playwright-core', 'pdf-parse'],
  images: {
    // Screenshots are served by our own API route.
    localPatterns: [{ pathname: '/api/shot/**' }, { pathname: '/demo-shots/**' }, { pathname: '/bg.jpg' }],
  },
};
module.exports = nextConfig;
