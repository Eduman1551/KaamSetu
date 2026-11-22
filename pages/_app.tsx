import type { AppProps } from 'next/app';
import { Inter, Poppins } from 'next/font/google';
import { MotionConfig } from 'framer-motion';
import '@/styles/globals.css';

// Fonts are self-hosted by next/font (no layout shift, no external requests at runtime).
const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-poppins' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function App({ Component, pageProps }: AppProps) {
  return (
    // reducedMotion="user" makes Framer Motion honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <div className={`${poppins.variable} ${inter.variable} font-body`}>
        <Component {...pageProps} />
      </div>
    </MotionConfig>
  );
}
