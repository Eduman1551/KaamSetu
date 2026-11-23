import { useEffect, type ReactNode } from 'react';

/**
 * Wraps a dashboard in the warm light theme. The wrapper class applies the theme
 * on the very first (server) render; the <html> class also covers portals
 * (lightbox) and overscroll, and is removed again when leaving the dashboard.
 */
export default function LightTheme({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('theme-light');
    return () => document.documentElement.classList.remove('theme-light');
  }, []);
  return <div className="theme-light min-h-screen bg-navy text-ink">{children}</div>;
}
