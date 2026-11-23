import type { AppProps } from 'next/app';
import localFont from 'next/font/local';
import { MotionConfig } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import '@/styles/globals.css';

// Fonts come from the @fontsource-variable packages (variable weight files) and are
// self-hosted by next/font/local: no network needed at build time or at runtime.
const jakarta = localFont({
  src: '../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-jakarta',
  display: 'swap',
});
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
});
const mono = localFont({
  src: '../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
});

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  // reducedMotion="user" makes Framer Motion honour prefers-reduced-motion.
  return (
    <SessionProvider session={session}>
      <MotionConfig reducedMotion="user">
        <div className={`${jakarta.variable} ${inter.variable} ${mono.variable} font-body`}>
          <Component {...pageProps} />
        </div>
      </MotionConfig>
    </SessionProvider>
  );
}
