import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BridgeLogo } from './Icons';
import { pressable } from './motion';

interface Props {
  onDemo: () => void;
  hasResults: boolean;
}

/** Sticky top bar: transparent over the hero, blurred-solid after scrolling. */
export default function NavBar({ onDemo, hasResults }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#how', label: 'How it works' },
    { href: '#analyse', label: 'Analyse' },
    ...(hasResults ? [{ href: '#results', label: 'Results' }] : []),
    { href: '#privacy', label: 'Privacy' },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 border-b ${
        scrolled ? 'bg-navy/85 backdrop-blur-xl border-ink/10 shadow-glass' : 'bg-transparent border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 md:px-8" aria-label="Main">
        <a href="#top" className="flex items-center gap-3 rounded-lg" aria-label="KaamSetu home">
          <BridgeLogo />
          <span className="font-heading text-xl font-bold tracking-tight">
            Kaam<span className="text-saffron">Setu</span>
          </span>
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-md px-1 py-2 text-ink/80 transition-colors hover:text-saffron">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <motion.button {...pressable} onClick={onDemo} className="btn-primary !px-5 !py-2.5 !text-base">
          Try demo
        </motion.button>
      </nav>
    </header>
  );
}
