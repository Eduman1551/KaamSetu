import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnalysisResult, SkillToAdd } from '@/lib/types';
import CountUp from './CountUp';
import ProofCard from './ProofCard';
import { CheckIcon, ChevronDown, ExternalIcon, WarnIcon } from './Icons';
import { fadeUp, inView, scoreColor, scoreTextColor, stagger } from './motion';

const NAV = [
  { id: 'r-score', label: 'Score' },
  { id: 'r-strengths', label: 'Strengths' },
  { id: 'r-skills', label: 'Skills to add' },
  { id: 'r-ats', label: 'ATS tips' },
  { id: 'r-proof', label: 'Proof' },
];

function BlockTitle({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return (
    <div className="mb-5">
      <p className="kicker mb-1.5">{kicker}</p>
      <h3 className="h3">{title}</h3>
      {note && <p className="meta mt-1">{note}</p>}
    </div>
  );
}

/** Ring that counts 0 → score over 1.5 s once visible; colour follows the value. */
export function ScoreRing({ score, size = 'lg', label = 'out of 100' }: { score: number; size?: 'lg' | 'sm'; label?: string }) {
  const [v, setV] = useState(0);
  const r = 88;
  const c = 2 * Math.PI * r;
  const color = scoreColor(v);
  const box = size === 'lg' ? 'h-48 w-48' : 'h-32 w-32';
  return (
    <div className={`relative mx-auto shrink-0 ${box}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} stroke="#EFE7D9" strokeWidth="14" fill="none" />
        <circle
          cx="100"
          cy="100"
          r={r}
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`Score ${score} out of 100`}>
        <span
          className={`font-mono font-semibold ${size === 'lg' ? 'text-[44px]' : 'text-[30px]'}`}
          style={{ color: scoreTextColor(v), transition: 'color 0.4s ease' }}
        >
          <CountUp to={score} duration={1.5} onValue={setV} />
        </span>
        <span className="meta">{label}</span>
      </div>
    </div>
  );
}

export function SubBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-sm">
        <span className="text-ink/85">{label}</span>
        <span className="num font-mono font-medium" style={{ color: scoreTextColor(value) }}>
          {value}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: scoreColor(value) }}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function SkillCard({ s, total, defaultOpen }: { s: SkillToAdd; total: number; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = total ? Math.round((s.count / total) * 100) : 0;
  return (
    <motion.li variants={fadeUp} className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="card-title">{s.skill}</span>
            <span className="num text-sm text-ink/70">
              in <b className="text-ink">{s.count}</b> of {total} listings
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-saffron"
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-ink/60">
          <ChevronDown width={20} height={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ul className="space-y-2 border-t border-ink/10 px-4 pb-4 pt-3">
              {s.courses.length === 0 && <li className="meta">No verified course link found in today&apos;s search.</li>}
              {s.courses.map((c) => (
                <li key={c.url} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-navy-950/40 p-2.5 sm:flex-nowrap">
                  <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-saffron/15 font-heading font-bold text-saffron sm:grid" aria-hidden>
                    {c.platform.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="line-clamp-2 text-[15px] font-medium leading-snug" title={c.title}>
                      {c.title}
                    </p>
                    <p className="meta">
                      {c.platform}
                      {c.hours ? ` · ${c.hours} h` : ' · self-paced'}
                    </p>
                  </div>
                  <span
                    className={`chip ml-auto shrink-0 sm:ml-0 ${c.free ? 'bg-teal/15 text-teal' : 'bg-ink/10 text-ink/70'}`}
                  >
                    {c.free ? 'Free' : 'Paid'}
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink/20 text-ink/85 transition-colors hover:border-saffron hover:text-saffron"
                    aria-label={`Open course: ${c.title}`}
                  >
                    <ExternalIcon width={16} height={16} />
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** The full analysis results (5 blocks + mini-nav). */
export default function Results({ result }: { result: AnalysisResult }) {
  const total = result.listingsAnalyzed.count;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div id="results">
      <div className="sticky top-16 z-30 mb-6 overflow-x-auto">
        <nav className="mx-auto flex w-max gap-1 rounded-xl border border-ink/15 bg-navy-950/90 p-1 shadow-glass backdrop-blur-xl" aria-label="Result sections">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-ink/80 transition-colors hover:bg-navy-700 hover:text-saffron"
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      <p className="mb-6 max-w-prose text-[15px] text-ink/75">
        Target roles: <b className="text-ink">{result.targetRoles.join(' · ')}</b>. Based on{' '}
        <b className="num text-ink">{total} real job listings</b> from {result.listingsAnalyzed.sources.slice(0, 4).join(', ')}
        {result.listingsAnalyzed.sources.length > 4 ? ` and ${result.listingsAnalyzed.sources.length - 4} more` : ''}, scanned{' '}
        {new Date(result.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
      </p>

      <div className="space-y-12">
        <motion.section id="r-score" {...inView} variants={fadeUp} className="card scroll-mt-20 p-5 md:p-7">
          <div className="flex flex-col items-center gap-8 md:flex-row">
            <ScoreRing score={result.overallScore} />
            <div className="w-full flex-1 space-y-4">
              <p className="kicker">Resume score</p>
              <p className="max-w-prose text-[17px] leading-relaxed">{result.summary}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <SubBar label="Skills match" value={result.subScores.skillsMatch} />
                <SubBar label="ATS readability" value={result.subScores.atsReadability} />
                <SubBar label="Impact & bullets" value={result.subScores.impact} />
                <SubBar label="Structure" value={result.subScores.structure} />
              </div>
            </div>
          </div>
        </motion.section>

        <section id="r-strengths" className="scroll-mt-20">
          <BlockTitle kicker="Your strengths" title="Skills employers are asking for, and you have" />
          {result.strengths.length === 0 ? (
            <p className="card p-4 text-[15px] text-ink/80">
              None of your listed skills showed up in today&apos;s listings yet. The skills below are your fastest way in.
            </p>
          ) : (
            <motion.ul {...inView} variants={stagger} className="flex flex-wrap gap-2">
              {result.strengths.slice(0, 8).map((s) => (
                <motion.li key={s.skill} variants={fadeUp} className="flex items-center gap-2 rounded-xl border border-teal/35 bg-teal/10 px-3 py-2 text-[15px]">
                  <CheckIcon className="text-teal" width={16} height={16} />
                  <span className="font-medium">{s.skill}</span>
                  <span className="num text-sm text-ink/70">
                    in {s.count} of {total} listings
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>

        <section id="r-skills" className="scroll-mt-20">
          <BlockTitle
            kicker="Skills to add"
            title="Your top 5 skills to learn next"
            note="Ranked by trend from today's listings: a signal, not a guarantee."
          />
          <motion.ul {...inView} variants={stagger} className="grid gap-3">
            {result.skillsToAdd.map((s, i) => (
              <SkillCard key={s.skill} s={s} total={total} defaultOpen={i === 0} />
            ))}
          </motion.ul>
        </section>

        <section id="r-ats" className="scroll-mt-20">
          <BlockTitle kicker="ATS tips" title="Make your resume machine-friendly" />
          <motion.ul {...inView} variants={stagger} className="card divide-y divide-ink/10">
            {result.atsTips.slice(0, 5).map((t) => (
              <motion.li key={t.text} variants={fadeUp} className="flex items-start gap-3 px-4 py-3 text-[15px]">
                {t.pass ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/20 text-teal" aria-label="Pass">
                    <CheckIcon width={15} height={15} />
                  </span>
                ) : (
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron/20 text-saffron" aria-label="Fix">
                    <WarnIcon width={15} height={15} />
                  </span>
                )}
                <span className="pt-0.5">{t.text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </section>

        <section id="r-proof" className="scroll-mt-20">
          <BlockTitle
            kicker="Proof cards"
            title="Don't take our word for it"
            note="Real screenshots of live listings, with the exact sentence highlighted."
          />
          <motion.div {...inView} variants={stagger} className="grid gap-4 lg:grid-cols-3">
            {result.proofCards.slice(0, 3).map((c) => (
              <ProofCard key={c.skill} card={c} />
            ))}
          </motion.div>
        </section>
      </div>
    </div>
  );
}
