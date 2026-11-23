import { useState, type ReactNode } from 'react';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from './NavBar';
import LightTheme from './LightTheme';
import DashBand from './DashBand';
import { RoleChip, type RoleName } from './ui';

export interface NavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
}

interface Props {
  title: string;
  role: RoleName;
  userName: string;
  nav?: NavItem[];
  active?: string;
  onNav?: (id: string) => void;
  /** Right side of the top bar (e.g. sample-data chip). */
  topRight?: ReactNode;
  /** Navy welcome band: title, subtitle and optional overlapping stat cards. */
  band?: { title: string; subtitle?: ReactNode; stats?: ReactNode; aside?: ReactNode };
  children: ReactNode;
}

/** Shared navy top bar for every dashboard (white logo with saffron accent). */
export function NavyTopBar({ children, left }: { children: ReactNode; left?: ReactNode }) {
  return (
    <header className="on-navy sticky top-0 z-40 border-b border-white/10 bg-[#0B1B3A]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">{left ?? <Logo href="/dashboard" compact />}</div>
        <div className="flex items-center gap-1.5 sm:gap-3">{children}</div>
      </div>
    </header>
  );
}

export function LogoutButton() {
  return (
    <button className="btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/' })}>
      <LogOut size={16} aria-hidden /> <span className="hidden sm:inline">Log out</span>
    </button>
  );
}

/** Dashboard shell: navy sidebar + navy top bar (structure), warm ivory content. */
export default function DashboardLayout({ title, role, userName, nav, active, onNav, topRight, band, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navList = nav && (
    <ul className="space-y-1">
      {nav.map((n) => {
        const on = active === n.id;
        const Icon = n.icon;
        return (
          <li key={n.id}>
            <button
              onClick={() => {
                onNav?.(n.id);
                setMenuOpen(false);
              }}
              aria-current={on ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-[10px] border-l-[3px] px-3 py-2 text-left text-[15px] transition-colors ${
                on ? 'border-[#FF9933] bg-[rgba(255,153,51,0.16)] font-medium text-[#FFB366]' : 'border-transparent text-[#E8EEF8] hover:bg-[#13264D]'
              }`}
            >
              {Icon && <Icon size={18} strokeWidth={2} aria-hidden className={on ? '' : 'text-[#A9B8D0]'} />}
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="num rounded-full bg-[#FF9933] px-1.5 text-[12px] font-semibold text-[#0B1B3A]">{n.badge}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <LightTheme>
      <Head>
        <title>{`${title} · KaamSetu`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="flex min-h-screen">
        {nav && (
          <div className="hidden w-64 shrink-0 bg-[#0B1B3A] lg:block">
            <aside className="on-navy sticky top-0 flex h-screen flex-col px-3 py-4">
              <div className="mb-6 px-2">
                <Logo href="/dashboard" />
              </div>
              <nav aria-label="Dashboard">{navList}</nav>
            </aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="on-navy sticky top-0 z-40 border-b border-white/10 bg-[#0B1B3A]">
            <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6">
              <div className="flex items-center gap-2">
                {nav && (
                  <button className="btn-ghost btn-sm lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
                    {menuOpen ? <X size={18} /> : <Menu size={18} />}
                  </button>
                )}
                <span className={nav ? 'lg:hidden' : ''}>
                  <Logo href="/dashboard" compact />
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3">
                {topRight}
                <span className="hidden max-w-[200px] truncate text-sm text-[#C9D4E8] sm:inline" title={userName}>
                  {userName}
                </span>
                <RoleChip role={role} />
                <LogoutButton />
              </div>
            </div>
            {nav && menuOpen && (
              <nav className="border-t border-white/10 bg-[#0B1B3A] px-3 py-3 lg:hidden" aria-label="Dashboard">
                {navList}
              </nav>
            )}
          </header>
          {band && <DashBand title={band.title} subtitle={band.subtitle} stats={band.stats} aside={band.aside} />}
          <main className={`mx-auto max-w-[1100px] px-4 pb-8 sm:px-6 ${band ? '' : 'pt-6 sm:pt-8'}`}>{children}</main>
        </div>
      </div>
    </LightTheme>
  );
}
