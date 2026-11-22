import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import CountUp from './CountUp';
import { ArrowDown } from './Icons';
import { fadeUp, pressable, stagger } from './motion';

const HEADLINE = 'Bridge the gap between your degree and your first job';
const ACCENT = new Set(['first', 'job']);

// Fixed particle positions (no randomness, so server and client render the same).
const PARTICLES = [
  { l: 8, t: 70, s: 4, d: 16, dx: 30, o: 0.5, delay: 0 },
  { l: 18, t: 85, s: 3, d: 19, dx: -20, o: 0.4, delay: 3 },
  { l: 27, t: 60, s: 4, d: 22, dx: 25, o: 0.35, delay: 6 },
  { l: 39, t: 80, s: 3, d: 17, dx: 15, o: 0.45, delay: 2 },
  { l: 52, t: 75, s: 4, d: 20, dx: -25, o: 0.4, delay: 8 },
  { l: 63, t: 88, s: 3, d: 18, dx: 20, o: 0.5, delay: 4 },
  { l: 72, t: 65, s: 4, d: 24, dx: -15, o: 0.3, delay: 1 },
  { l: 81, t: 82, s: 3, d: 16, dx: 25, o: 0.45, delay: 7 },
  { l: 90, t: 72, s: 4, d: 21, dx: -30, o: 0.35, delay: 5 },
];

const MLink = motion.create(Link);

export default function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // Background moves at ~35% of scroll speed = gentle parallax.
  const bgY = useTransform(scrollY, [0, 1000], [0, reduce ? 0 : 350]);

  const counters = [
    { to: 20, suffix: '+', label: 'live job listings read per analysis' },
    { to: 15, suffix: '', label: 'question skills test to get verified' },
    { to: 3, suffix: '', label: 'proof screenshots from real listings' },
  ];

  return (
    <section id="top" className="relative isolate flex min-h-[92svh] items-center overflow-hidden pt-16">
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-20 h-[120%]">
        <Image src="/bg.jpg" alt="A suspension bridge at sunrise" fill priority sizes="100vw" className="object-cover object-center" />
      </motion.div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/75 via-navy/65 to-navy" />
      <div
        className="glow-shift absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(60% 50% at 70% 55%, rgba(255,153,51,0.16), transparent 70%)' }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              left: `${p.l}%`,
              top: `${p.t}%`,
              width: p.s,
              height: p.s,
              animationDelay: `${p.delay}s`,
              ['--d' as string]: `${p.d}s`,
              ['--dx' as string]: `${p.dx}px`,
              ['--o' as string]: p.o,
            }}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <motion.p initial="hidden" animate="show" variants={fadeUp} className="kicker mb-4">
          KaamSetu · SkillBridge
        </motion.p>
        <motion.h1
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="max-w-3xl font-bold"
          style={{ fontSize: 'clamp(32px, 4.2vw, 48px)', lineHeight: 1.15 }}
        >
          {HEADLINE.split(' ').map((w, i) => (
            <motion.span
              key={i}
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } }}
              className={`mr-[0.25em] inline-block ${ACCENT.has(w) ? 'text-saffron' : ''}`}
            >
              {w}
            </motion.span>
          ))}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-5 max-w-prose text-lg text-ink/85"
        >
          Students get an AI resume analysis against today&apos;s real job listings and a hard skills test to get verified.
          Companies meet verified, anonymous candidates. Colleges see where their cohort needs help.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <MLink {...pressable} href="/signup" className="btn-primary px-6 py-3">
            Get started
          </MLink>
          <MLink {...pressable} href="/login" className="btn-secondary px-6 py-3">
            Log in
          </MLink>
        </motion.div>

        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
          className="mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {counters.map((c) => (
            <motion.li key={c.label} variants={fadeUp} className="glass px-5 py-4">
              <div className="font-mono text-[28px] font-semibold text-saffron">
                <CountUp to={c.to} suffix={c.suffix} />
              </div>
              <div className="text-sm text-ink/80">{c.label}</div>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      <a
        href="#how"
        aria-label="Scroll to how it works"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full p-2 text-ink/70 transition-colors hover:text-saffron md:block"
      >
        <motion.span
          className="block"
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown width={22} height={22} />
        </motion.span>
      </a>
    </section>
  );
}
