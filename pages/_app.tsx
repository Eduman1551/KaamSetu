import type { AppProps } from 'next/app';
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import '@/styles/globals.css';

// Fonts are self-hosted by next/font (no layout shift, no external requests at runtime).
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

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
