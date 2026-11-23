import { useState, type ReactNode } from 'react';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
import { Logo } from './NavBar';
import { ROLE_META, RoleChip, type RoleName } from './ui';

export interface NavItem {
  id: string;
  label: string;
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

/** Dashboard shell: plain navy (no photo) for readability, optional sidebar. */
export default function DashboardLayout({ title, role, userName, nav, active, onNav, topRight, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = ROLE_META[role];

  const navList = nav && (
    <ul className="space-y-0.5">
      {nav.map((n) => (
        <li key={n.id}>
          <button
            onClick={() => {
              onNav?.(n.id);
              setMenuOpen(false);
            }}
            aria-current={active === n.id ? 'page' : undefined}
            className={`flex w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-left text-[15px] transition-colors ${
              active === n.id ? `${meta.ring} bg-ink/5 ${meta.text} font-medium` : 'border-transparent text-ink/70 hover:bg-ink/5 hover:text-ink'
            }`}
          >
            {n.label}
            {!!n.badge && <span className="num rounded-full bg-saffron px-1.5 text-[12px] font-semibold text-navy">{n.badge}</span>}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Head>
        <title>{`${title} · KaamSetu`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-navy">
        <header className="sticky top-0 z-40 border-b border-ink/10 bg-navy/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {nav && (
                <button className="btn-ghost btn-sm lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label="Open menu">
                  Menu
                </button>
              )}
              <Logo href="/dashboard" />
            </div>
            <div className="flex items-center gap-3">
              {topRight}
              <span className="hidden max-w-[180px] truncate text-sm text-ink/80 sm:inline" title={userName}>
                {userName}
              </span>
              <RoleChip role={role} />
              <button className="btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/' })}>
                Log out
              </button>
            </div>
          </div>
          {nav && menuOpen && <nav className="border-t border-ink/10 px-4 py-3 lg:hidden" aria-label="Dashboard">{navList}</nav>}
        </header>
        <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
          {nav && (
            <nav className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block" aria-label="Dashboard">
              {navList}
            </nav>
          )}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </>
  );
}
