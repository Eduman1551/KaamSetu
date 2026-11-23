import { useState, type ReactNode } from 'react';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { LogOut, Menu, X } from 'lucide-react';
import { Logo } from './NavBar';
import LightTheme from './LightTheme';
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
  children: ReactNode;
}

/** Light dashboard shell: white sidebar with sand border, light top bar, 1100px content. */
export default function DashboardLayout({ title, role, userName, nav, active, onNav, topRight, children }: Props) {
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
                on ? 'border-saffron bg-navy-700 font-medium text-saffron' : 'border-transparent text-ink/75 hover:bg-navy-950 hover:text-ink'
              }`}
            >
              {Icon && <Icon size={18} strokeWidth={2} aria-hidden />}
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="num rounded-full bg-saffron px-1.5 text-[12px] font-semibold text-navy">{n.badge}</span>}
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
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sand bg-navy-800 px-3 py-4 lg:flex">
            <div className="mb-6 px-2">
              <Logo href="/dashboard" />
            </div>
            <nav aria-label="Dashboard">{navList}</nav>
          </aside>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-sand bg-navy/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between gap-2 px-3 sm:px-6">
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
                <span className="hidden max-w-[200px] truncate text-sm text-ink/75 sm:inline" title={userName}>
                  {userName}
                </span>
                <RoleChip role={role} />
                <button className="btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/' })}>
                  <LogOut size={16} aria-hidden /> <span className="hidden sm:inline">Log out</span>
                </button>
              </div>
            </div>
            {nav && menuOpen && (
              <nav className="border-t border-sand bg-navy-800 px-3 py-3 lg:hidden" aria-label="Dashboard">
                {navList}
              </nav>
            )}
          </header>
          <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </LightTheme>
  );
}
