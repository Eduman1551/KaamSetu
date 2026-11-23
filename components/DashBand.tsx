import type { ReactNode } from 'react';

/**
 * Navy welcome band at the top of every dashboard (gradient #0B1B3A → #13264D,
 * with the sunrise bridge faintly on the right). `stats` are rendered as cards
 * that overlap the band's bottom edge onto the ivory content area.
 */
export default function DashBand({ title, subtitle, aside, stats, wide = false }: { title: string; subtitle?: ReactNode; aside?: ReactNode; stats?: ReactNode; wide?: boolean }) {
  const w = wide ? 'max-w-[1280px]' : 'max-w-[1100px]';
  return (
    <div className="mb-6">
      <section className={`on-navy relative isolate overflow-hidden bg-gradient-to-r from-[#0B1B3A] to-[#13264D] ${stats ? 'pb-20' : 'pb-8'} pt-7`}>
        <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-1/2 opacity-[0.13] sm:block" aria-hidden>
          <div className="absolute inset-0 bg-cover bg-right" style={{ backgroundImage: "url('/bg.jpg')" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B3A] to-transparent" />
        </div>
        <div className={`mx-auto flex ${w} flex-wrap items-end justify-between gap-3 px-4 sm:px-6`}>
          <div className="min-w-0">
            <h1 className="font-heading text-[28px] font-bold leading-tight text-white">{title}</h1>
            {subtitle && <p className="mt-1 max-w-prose text-[15px] text-[#C9D4E8]">{subtitle}</p>}
          </div>
          {aside}
        </div>
      </section>
      {stats && <div className={`relative z-10 mx-auto -mt-14 ${w} px-4 sm:px-6`}>{stats}</div>}
    </div>
  );
}
