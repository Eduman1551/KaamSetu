import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BridgeLogo } from './Icons';

/** Sticky landing top bar: transparent over the hero, blurred-solid after scrolling. */
export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled ? 'border-ink/10 bg-navy/85 shadow-glass backdrop-blur-xl' : 'border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
        <Logo />
        <ul className="hidden items-center gap-7 text-[15px] md:flex">
          <li><a href="#how" className="text-ink/80 transition-colors hover:text-saffron">How it works</a></li>
          <li><a href="#roles" className="text-ink/80 transition-colors hover:text-saffron">For you</a></li>
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm">Log in</Link>
          <Link href="/signup" className="btn-primary btn-sm">Get started</Link>
        </div>
      </nav>
    </header>
  );
}

export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label="KaamSetu home">
      <BridgeLogo width={34} height={24} />
      <span className={`font-heading text-lg font-bold tracking-tight ${compact ? 'hidden sm:inline' : ''}`}>
        Kaam<span className="text-saffron">Setu</span>
      </span>
    </Link>
  );
}
