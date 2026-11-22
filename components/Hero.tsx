import Image from 'next/image';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import CountUp from './CountUp';
import { ArrowDown, UploadIcon } from './Icons';
import { fadeUp, pressable, stagger } from './motion';

interface Props {
  onUpload: () => void;
  onDemo: () => void;
}

const HEADLINE = 'Bridge the gap between your degree and your first job';
// Words that get the saffron accent.
const ACCENT = new Set(['first', 'job']);

// Fixed particle positions (no randomness, so server and client render the same).
const PARTICLES = [
  { l: 8, t: 70, s: 4, d: 16, dx: 30, o: 0.5, delay: 0 },
  { l: 18, t: 85, s: 3, d: 19, dx: -20, o: 0.4, delay: 3 },
  { l: 27, t: 60, s: 5, d: 22, dx: 25, o: 0.35, delay: 6 },
  { l: 39, t: 80, s: 3, d: 17, dx: 15, o: 0.45, delay: 2 },
  { l: 52, t: 75, s: 4, d: 20, dx: -25, o: 0.4, delay: 8 },
  { l: 63, t: 88, s: 3, d: 18, dx: 20, o: 0.5, delay: 4 },
  { l: 72, t: 65, s: 5, d: 24, dx: -15, o: 0.3, delay: 1 },
  { l: 81, t: 82, s: 3, d: 16, dx: 25, o: 0.45, delay: 7 },
  { l: 90, t: 72, s: 4, d: 21, dx: -30, o: 0.35, delay: 5 },
  { l: 45, t: 92, s: 3, d: 23, dx: 10, o: 0.4, delay: 9 },
];

export default function Hero({ onUpload, onDemo }: Props) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // Background moves at ~35% of scroll speed = gentle parallax.
  const bgY = useTransform(scrollY, [0, 1000], [0, reduce ? 0 : 350]);

  const counters = [
    { to: 20, suffix: '+', label: 'real listings scanned per resume' },
    { to: 3, suffix: '', label: 'proof cards with real screenshots' },
    { to: 0, suffix: '', label: 'resumes stored' },
  ];

  return (
    <section id="top" className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-[72px]">
      {/* Background photo with parallax */}
      <motion.div style={{ y: bgY }} className="absolute inset-0 -z-20 h-[120%]">
        <Image
          src="/bg.jpg"
          alt="A suspension bridge at sunrise"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </motion.div>
      {/* Navy overlay (~70%) so text stays readable, with a slow glow shift */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy/75 via-navy/65 to-navy" />
      <div
        className="glow-shift absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(60% 50% at 70% 55%, rgba(255,153,51,0.18), transparent 70%)' }}
      />
      {/* Subtle floating particles */}
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

      <div className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8">
        <motion.p initial="hidden" animate="show" variants={fadeUp} className="kicker mb-5">
          KaamSetu · SkillBridge
        </motion.p>

        {/* Headline words reveal one by one */}
        <motion.h1
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="max-w-4xl text-[2.4rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-[3.55rem]"
        >
          {HEADLINE.split(' ').map((w, i) => (
            <motion.span
              key={i}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
              }}
              className={`mr-[0.25em] inline-block ${ACCENT.has(w) ? 'text-saffron' : ''}`}
            >
              {w}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-6 max-w-2xl text-xl text-ink/85 md:text-[1.35rem]"
        >
          Upload your resume. Our AI reads today&apos;s real job listings in India and shows you exactly what to learn
          next — with proof.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.6 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row"
        >
          <motion.button {...pressable} onClick={onUpload} className="btn-primary">
            <UploadIcon /> Upload my resume
          </motion.button>
          <motion.button {...pressable} onClick={onDemo} className="btn-secondary">
            Try demo resume
          </motion.button>
        </motion.div>

        {/* Animated counters */}
        <motion.ul
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={stagger}
          className="mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {counters.map((c) => (
            <motion.li key={c.label} variants={fadeUp} className="glass px-6 py-5">
              <div className="font-heading text-4xl font-bold text-saffron">
                <CountUp to={c.to} suffix={c.suffix} />
              </div>
              <div className="mt-1 text-ink/80">{c.label}</div>
            </motion.li>
          ))}
        </motion.ul>
      </div>

      {/* Scroll hint */}
      <a
        href="#how"
        aria-label="Scroll to how it works"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 rounded-full p-2 text-ink/70 transition-colors hover:text-saffron md:block"
      >
        <motion.span
          className="block"
          animate={reduce ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown />
        </motion.span>
      </a>
    </section>
  );
}
