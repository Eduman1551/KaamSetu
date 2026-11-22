import { motion } from 'framer-motion';
import { PlanIcon, SearchIcon, ShieldIcon, UploadIcon } from './Icons';
import { fadeUp, inView, stagger } from './motion';

const STEPS = [
  { icon: UploadIcon, title: 'Upload', text: 'Drop your resume PDF. It is read in memory; the file and raw text are never stored.' },
  { icon: SearchIcon, title: 'AI scans real jobs', text: 'We read 20+ live fresher job listings in India and compare them with your skills.' },
  { icon: PlanIcon, title: 'Get your plan', text: 'Score, strengths, top skills to add with free courses, and screenshots as proof.' },
  { icon: ShieldIcon, title: 'Get verified', text: 'Pass a hard 15-question skills test, then choose whether companies can see you.' },
];

const ROLES = [
  {
    title: 'For Students',
    chip: 'bg-saffron/15 text-saffron',
    text: 'See exactly what employers ask for, learn the gaps, and earn a Verified badge companies trust.',
  },
  {
    title: 'For Companies',
    chip: 'bg-sky/15 text-sky',
    text: 'Browse anonymous, test-verified freshers ranked against your own hiring requirements.',
  },
  {
    title: 'For Colleges',
    chip: 'bg-violet/15 text-violet',
    text: 'Spot cohort-level skill gaps from test data and plan the right workshops.',
  },
];

export default function HowItWorks() {
  return (
    <>
      <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <motion.div {...inView} variants={fadeUp} className="mb-10 max-w-prose">
          <p className="kicker mb-2">How it works</p>
          <h2 className="section-title">From resume to verified in four steps</h2>
        </motion.div>
        <motion.ol {...inView} variants={stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} variants={fadeUp} whileHover={{ y: -4 }} className="glass relative p-6">
              <span className="absolute right-5 top-4 font-mono text-3xl font-semibold text-ink/10" aria-hidden>
                {i + 1}
              </span>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-saffron/15 text-saffron">
                <s.icon width={22} height={22} />
              </div>
              <h3 className="card-title mb-1.5">{s.title}</h3>
              <p className="text-[15px] text-ink/75">{s.text}</p>
            </motion.li>
          ))}
        </motion.ol>
      </section>

      <section id="roles" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div {...inView} variants={fadeUp} className="mb-10 max-w-prose">
          <p className="kicker mb-2">One platform, three roles</p>
          <h2 className="section-title">Built for everyone on the bridge</h2>
        </motion.div>
        <motion.ul {...inView} variants={stagger} className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <motion.li key={r.title} variants={fadeUp} whileHover={{ y: -4 }} className="glass p-6">
              <span className={`chip mb-3 ${r.chip}`}>{r.title}</span>
              <p className="text-[15px] text-ink/80">{r.text}</p>
            </motion.li>
          ))}
        </motion.ul>
      </section>
    </>
  );
}
