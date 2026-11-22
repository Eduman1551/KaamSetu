import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, WarnIcon } from './Icons';
import { pressable } from './motion';

export interface Step {
  id: string;
  label: string;
  status: 'active' | 'done';
}

interface Props {
  steps: Step[];
  pct: number;
  elapsed: number;
  error: string | null;
  onSwitchDemo: () => void;
  onRetry: () => void;
}

const PLANKS = 12;
const DEMO_OFFER_AFTER = 90; // seconds

/** An SVG bridge that is built plank by plank as progress grows. */
function Bridge({ pct }: { pct: number }) {
  const built = Math.round((Math.min(100, pct) / 100) * PLANKS);
  const left = 70;
  const right = 530;
  const span = right - left;
  const w = span / PLANKS;

  return (
    <svg viewBox="0 0 600 210" className="h-auto w-full" role="img" aria-label={`Progress: ${Math.round(pct)} percent`}>
      {/* water */}
      <path d="M0 185 Q 150 175 300 185 T 600 185" stroke="#F5F7FB" strokeOpacity="0.12" strokeWidth="2" fill="none" />
      {/* towers */}
      <rect x={left - 8} y={40} width={12} height={140} rx={3} fill="#FF9933" />
      <rect x={right - 4} y={40} width={12} height={140} rx={3} fill="#FF9933" />
      {/* main cable draws itself as progress grows */}
      <motion.path
        d={`M${left - 2} 44 Q 300 170 ${right + 2} 44`}
        stroke="#FF9933"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: Math.max(0.05, pct / 100) }}
        transition={{ duration: 0.6 }}
      />
      {/* planks + hangers */}
      {Array.from({ length: PLANKS }).map((_, i) => {
        const x = left + i * w + 2;
        const cx = x + w / 2 - 2;
        // y of the parabola cable at cx (matches the quadratic curve closely)
        const t = (cx - left) / span;
        const cableY = 44 + 2 * t * (1 - t) * (170 - 44) * 1;
        const on = i < built;
        return (
          <g key={i}>
            <AnimatePresence>
              {on && (
                <motion.g
                  initial={{ opacity: 0, y: -40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <line x1={cx} y1={cableY} x2={cx} y2={130} stroke="#F5F7FB" strokeOpacity="0.45" strokeWidth="1.5" />
                  <rect x={x} y={130} width={w - 4} height={14} rx={3} fill="#F5F7FB" />
                </motion.g>
              )}
            </AnimatePresence>
            {!on && <rect x={x} y={130} width={w - 4} height={14} rx={3} fill="#F5F7FB" fillOpacity="0.07" />}
          </g>
        );
      })}
    </svg>
  );
}

/** Live analysis progress: bridge animation, step list fed by SSE, thin bar. */
export default function ProgressBridge({ steps, pct, elapsed, error, onSwitchDemo, onRetry }: Props) {
  if (error) {
    return (
      <div className="glass mx-auto max-w-3xl p-8 text-center md:p-12" role="alert">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-saffron/15 text-saffron">
          <WarnIcon width={32} height={32} />
        </div>
        <h3 className="mb-3 text-3xl font-semibold">That didn&apos;t work this time</h3>
        <p className="mx-auto mb-8 max-w-xl text-ink/80">{error}</p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <motion.button {...pressable} onClick={onSwitchDemo} className="btn-primary">
            Show the demo result
          </motion.button>
          <motion.button {...pressable} onClick={onRetry} className="btn-secondary">
            Try again
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass mx-auto max-w-4xl p-6 md:p-10" aria-live="polite">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-2xl font-semibold md:text-3xl">Building your bridge…</h3>
        <span className="font-heading text-2xl font-bold tabular-nums text-saffron">{Math.round(pct)}%</span>
      </div>

      <Bridge pct={pct} />

      {/* thin progress bar */}
      <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <motion.div className="h-full rounded-full bg-saffron" animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {steps.map((s) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-4"
            >
              {s.status === 'done' ? (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
                  <CheckIcon width={20} height={20} />
                </span>
              ) : (
                <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                  <span className="pulse-soft h-3.5 w-3.5 rounded-full bg-saffron" />
                </span>
              )}
              <span className={s.status === 'done' ? 'text-ink/75' : 'font-semibold text-ink'}>{s.label}</span>
              {s.status === 'active' && <span className="skeleton ml-auto hidden h-3 w-32 sm:block" aria-hidden />}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-ink/70">
        <span className="tabular-nums">{elapsed}s elapsed · usually about a minute</span>
        <AnimatePresence>
          {elapsed >= DEMO_OFFER_AFTER && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={onSwitchDemo}
              className="rounded-lg px-2 py-1 font-semibold text-saffron underline underline-offset-4 hover:text-ink"
            >
              Taking long? Switch to demo result
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
