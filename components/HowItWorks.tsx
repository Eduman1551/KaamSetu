import { motion } from 'framer-motion';
import { PlanIcon, SearchIcon, UploadIcon } from './Icons';
import { fadeUp, inView, stagger } from './motion';

const STEPS = [
  {
    icon: UploadIcon,
    title: 'Upload',
    text: 'Drop your resume PDF. It is read in memory and never stored.',
  },
  {
    icon: SearchIcon,
    title: 'AI scans real jobs',
    text: 'We open 20+ live fresher job listings in India and read what employers actually ask for.',
  },
  {
    icon: PlanIcon,
    title: 'Get your plan',
    text: 'Your score, your strengths, the top skills to add with free courses — and screenshots as proof.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
      <motion.div {...inView} variants={fadeUp} className="mb-14 max-w-3xl">
        <p className="kicker mb-3">How it works</p>
        <h2 className="section-title">Three steps. About a minute.</h2>
      </motion.div>

      <motion.ol {...inView} variants={stagger} className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="glass relative p-8"
          >
            <span className="absolute right-6 top-5 font-heading text-6xl font-extrabold text-ink/10" aria-hidden>
              {i + 1}
            </span>
            <motion.div
              variants={{
                hidden: { scale: 0.6, opacity: 0 },
                show: { scale: 1, opacity: 1, transition: { delay: 0.15 + i * 0.15, type: 'spring', stiffness: 220, damping: 16 } },
              }}
              className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-saffron/15 text-saffron"
            >
              <s.icon width={32} height={32} />
            </motion.div>
            <h3 className="mb-2 text-2xl font-semibold">{s.title}</h3>
            <p className="text-ink/80">{s.text}</p>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
