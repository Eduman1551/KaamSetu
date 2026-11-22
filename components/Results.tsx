import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnalysisResult, SkillToAdd } from '@/lib/types';
import CountUp from './CountUp';
import ProofCard from './ProofCard';
import { CheckIcon, ChevronDown, ExternalIcon, ShieldIcon, TrashIcon, WarnIcon } from './Icons';
import { fadeUp, inView, pressable, scoreColor, stagger } from './motion';

interface Props {
  result: AnalysisResult;
  onDelete: () => void;
  deleting: boolean;
}

const NAV = [
  { id: 'r-score', label: 'Score' },
  { id: 'r-strengths', label: 'Strengths' },
  { id: 'r-skills', label: 'Skills to add' },
  { id: 'r-ats', label: 'ATS tips' },
  { id: 'r-proof', label: 'Proof' },
  { id: 'r-delete', label: 'Delete data' },
];

function BlockTitle({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return (
    <div className="mb-8">
      <p className="kicker mb-2">{kicker}</p>
      <h3 className="text-3xl font-bold md:text-[2.5rem] md:leading-tight">{title}</h3>
      {note && <p className="mt-2 text-ink/70">{note}</p>}
    </div>
  );
}

/** Big ring that counts 0 → score over 1.5 s once visible; colour follows the value. */
function ScoreRing({ score }: { score: number }) {
  const [v, setV] = useState(0);
  const r = 88;
  const c = 2 * Math.PI * r;
  const color = scoreColor(v);
  return (
    <div className="relative mx-auto h-64 w-64 shrink-0 md:h-72 md:w-72">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} stroke="#F5F7FB" strokeOpacity="0.1" strokeWidth="14" fill="none" />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`Overall score ${score} out of 100`}>
        <span className="font-heading text-7xl font-extrabold" style={{ color, transition: 'color 0.4s ease' }}>
          <CountUp to={score} duration={1.5} onValue={setV} />
        </span>
        <span className="text-ink/70">out of 100</span>
      </div>
    </div>
  );
}

function SubBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-semibold tabular-nums" style={{ color: scoreColor(value) }}>
          {value}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink/10">
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
    <motion.li variants={fadeUp} whileHover={{ y: -4 }} className="glass overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-5 p-6 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="font-heading text-2xl font-semibold">{s.skill}</span>
            <span className="text-ink/75">
              in <b className="text-ink">{s.count}</b> of {total} listings
            </span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
            <motion.div
              className="h-full rounded-full bg-saffron"
              initial={{ width: 0 }}
              whileInView={{ width: `${pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-ink/70">
          <ChevronDown />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ul className="space-y-3 border-t border-ink/10 px-6 pb-6 pt-4">
              {s.courses.length === 0 && <li className="text-ink/70">No verified course link found in today&apos;s search.</li>}
              {s.courses.map((c) => (
                <li key={c.url} className="flex items-center gap-4 rounded-2xl bg-navy-950/40 p-3 pr-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-saffron/15 font-heading text-xl font-bold text-saffron" aria-hidden>
                    {c.platform.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold leading-snug" title={c.title}>
                      {c.title}
                    </p>
                    <p className="text-base text-ink/70">
                      {c.platform}
                      {c.hours ? ` · ${c.hours} h` : ' · self-paced'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2.5 py-0.5 text-sm font-semibold ${
                      c.free ? 'bg-teal/20 text-teal' : 'bg-ink/10 text-ink/70'
                    }`}
                  >
                    {c.free ? 'Free' : 'Paid'}
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink/20 text-ink/90 transition-colors hover:border-saffron hover:text-saffron"
                    aria-label={`Open course: ${c.title}`}
                  >
                    <ExternalIcon />
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

/** The full results view (6 blocks + sticky mini-nav). */
export default function Results({ result, onDelete, deleting }: Props) {
  const total = result.listingsAnalyzed.count;
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div id="results">
      {/* Sticky mini-nav for the presenter */}
      <div className="sticky top-[76px] z-40 -mx-1 mb-10 overflow-x-auto">
        <nav className="glass mx-auto flex w-max gap-1 p-1.5" aria-label="Result sections">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className="whitespace-nowrap rounded-xl px-4 py-2 text-base text-ink/85 transition-colors hover:bg-saffron hover:text-navy"
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Context line */}
      <motion.div {...inView} variants={fadeUp} className="mb-12 text-center">
        {result.demo && (
          <span className="mb-4 inline-block rounded-full border border-saffron/50 px-4 py-1 text-sm font-semibold text-saffron">
            Demo result · pre-saved from a real run
          </span>
        )}
        <h2 className="section-title">Your career snapshot</h2>
        <p className="mx-auto mt-3 max-w-3xl text-ink/80">
          Target roles: <b className="text-ink">{result.targetRoles.join(' · ')}</b>. Based on{' '}
          <b className="text-ink">{total} real job listings</b> from {result.listingsAnalyzed.sources.slice(0, 5).join(', ')}
          {result.listingsAnalyzed.sources.length > 5 ? ` and ${result.listingsAnalyzed.sources.length - 5} more` : ''}.
        </p>
      </motion.div>

      <div className="space-y-24">
        {/* Block 1: Score */}
        <motion.section id="r-score" {...inView} variants={fadeUp} className="glass scroll-mt-40 p-6 md:p-10">
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-center">
            <ScoreRing score={result.overallScore} />
            <div className="w-full flex-1 space-y-5">
              <p className="kicker">Overall score</p>
              <p className="text-xl leading-relaxed md:text-2xl">{result.summary}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <SubBar label="Skills match" value={result.subScores.skillsMatch} />
                <SubBar label="ATS readability" value={result.subScores.atsReadability} />
                <SubBar label="Impact & bullets" value={result.subScores.impact} />
                <SubBar label="Structure" value={result.subScores.structure} />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Block 2: Strengths */}
        <section id="r-strengths" className="scroll-mt-40">
          <BlockTitle kicker="Your strengths" title="Skills employers are asking for — and you have" />
          {result.strengths.length === 0 ? (
            <p className="glass p-6 text-ink/80">
              None of your listed skills showed up in today&apos;s listings yet. The skills below are your fastest way in.
            </p>
          ) : (
            <motion.ul {...inView} variants={stagger} className="flex flex-wrap gap-3">
              {result.strengths.slice(0, 8).map((s) => (
                <motion.li
                  key={s.skill}
                  variants={fadeUp}
                  className="flex items-center gap-3 rounded-2xl border border-teal/40 bg-teal/10 px-5 py-3"
                >
                  <CheckIcon className="text-teal" width={20} height={20} />
                  <span className="font-semibold">{s.skill}</span>
                  <span className="text-ink/75">
                    in {s.count} of {total} listings
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>

        {/* Block 3: Skills to add */}
        <section id="r-skills" className="scroll-mt-40">
          <BlockTitle
            kicker="Skills to add"
            title="Your top 5 skills to learn next"
            note="Ranked by trend from today's listings — a signal, not a guarantee."
          />
          <motion.ul {...inView} variants={stagger} className="grid gap-4">
            {result.skillsToAdd.map((s, i) => (
              <SkillCard key={s.skill} s={s} total={total} defaultOpen={i === 0} />
            ))}
          </motion.ul>
        </section>

        {/* Block 4: ATS tips */}
        <section id="r-ats" className="scroll-mt-40">
          <BlockTitle kicker="ATS tips" title="Make your resume machine-friendly" />
          <motion.ul {...inView} variants={stagger} className="glass divide-y divide-ink/10">
            {result.atsTips.slice(0, 5).map((t) => (
              <motion.li key={t.text} variants={fadeUp} className="flex items-start gap-4 px-6 py-5">
                {t.pass ? (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal/20 text-teal" aria-label="Pass">
                    <CheckIcon width={20} height={20} />
                  </span>
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-saffron/20 text-saffron" aria-label="Fix">
                    <WarnIcon width={20} height={20} />
                  </span>
                )}
                <span className="pt-1">{t.text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </section>

        {/* Block 5: Proof cards */}
        <section id="r-proof" className="scroll-mt-40">
          <BlockTitle
            kicker="Proof cards"
            title="Don't take our word for it"
            note="Real screenshots of live listings, with the exact sentence highlighted."
          />
          <motion.div {...inView} variants={stagger} className="grid gap-6 lg:grid-cols-3">
            {result.proofCards.slice(0, 3).map((c) => (
              <ProofCard key={c.skill} card={c} />
            ))}
          </motion.div>
        </section>

        {/* Block 6: Delete my data */}
        <motion.section id="r-delete" {...inView} variants={fadeUp} className="glass scroll-mt-40 p-8 text-center md:p-12">
          <ShieldIcon className="mx-auto mb-4 text-teal" width={40} height={40} />
          <h3 className="mb-3 text-3xl font-semibold">Done? Wipe everything.</h3>
          <p className="mx-auto mb-8 max-w-2xl text-ink/80">
            Your resume, results and screenshots live only in this session&apos;s memory and auto-delete after {result.ttlMinutes} minutes.
            You can delete them right now.
          </p>
          <motion.button
            {...pressable}
            onClick={onDelete}
            disabled={deleting}
            className="btn border-2 border-ink/40 text-ink hover:border-miss hover:text-miss"
          >
            <TrashIcon /> {deleting ? 'Deleting…' : 'Delete my data'}
          </motion.button>
        </motion.section>
      </div>
    </div>
  );
}

/** Confirmation shown after data is deleted, with a check animation. */
export function DeletedNotice({ onRestart, hadData }: { onRestart: () => void; hadData: boolean }) {
  return (
    <div className="glass mx-auto max-w-2xl p-10 text-center" role="status">
      <svg viewBox="0 0 80 80" className="mx-auto mb-6 h-24 w-24" aria-hidden>
        <motion.circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="#2DD4BF"
          strokeWidth="5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d="M25 41l10 10 20-22"
          fill="none"
          stroke="#2DD4BF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.45, duration: 0.35 }}
        />
      </svg>
      <h3 className="mb-3 text-3xl font-semibold">Your data is deleted</h3>
      <p className="mb-8 text-ink/80">
        {hadData
          ? 'Your resume, results and screenshots have been wiped from the server.'
          : 'Nothing from you is stored on the server right now.'}
      </p>
      <motion.button {...pressable} onClick={onRestart} className="btn-primary">
        Start again
      </motion.button>
    </div>
  );
}
