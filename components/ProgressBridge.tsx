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
  onRetry: () => void;
}

const PLANKS = 12;

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
      <path d="M0 185 Q 150 175 300 185 T 600 185" stroke="#E8DFD0" strokeWidth="2" fill="none" />
      {/* towers */}
      <rect x={left - 8} y={40} width={12} height={140} rx={3} fill="#E8842C" />
      <rect x={right - 4} y={40} width={12} height={140} rx={3} fill="#E8842C" />
      {/* main cable draws itself as progress grows */}
      <motion.path
        d={`M${left - 2} 44 Q 300 170 ${right + 2} 44`}
        stroke="#E8842C"
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
                  <line x1={cx} y1={cableY} x2={cx} y2={130} stroke="#B9A98F" strokeWidth="1.5" />
                  <rect x={x} y={130} width={w - 4} height={14} rx={3} fill="#5E8C6A" />
                </motion.g>
              )}
            </AnimatePresence>
            {!on && <rect x={x} y={130} width={w - 4} height={14} rx={3} fill="#F0E9DC" />}
          </g>
        );
      })}
    </svg>
  );
}

/** Live analysis progress: bridge animation, step list fed by SSE, thin bar. */
export default function ProgressBridge({ steps, pct, elapsed, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="card mx-auto max-w-2xl p-6 text-center md:p-8" role="alert">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-saffron/15 text-saffron">
          <WarnIcon width={24} height={24} />
        </div>
        <h3 className="h3 mb-2">That didn&apos;t work this time</h3>
        <p className="mx-auto mb-6 max-w-prose text-[15px] text-ink/80">{error}</p>
        <motion.button {...pressable} onClick={onRetry} className="btn-primary">
          Try again
        </motion.button>
      </div>
    );
  }

  return (
    <div className="card mx-auto grid max-w-5xl gap-6 p-5 md:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center" aria-live="polite">
      <div>
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h3 className="h3">Building your bridge…</h3>
          <span className="num font-mono text-lg font-semibold text-saffron">{Math.round(pct)}%</span>
        </div>
        <Bridge pct={pct} />
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <motion.div className="h-full rounded-full bg-saffron" animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
        </div>
        <p className="meta num mt-4">{elapsed}s elapsed · usually about a minute</p>
      </div>

      <ul className="min-h-[200px] space-y-2.5 text-[15px] lg:border-l lg:border-ink/10 lg:pl-6">
        {steps.length === 0 && (
          <li className="space-y-3" aria-hidden>
            <span className="skeleton block h-4 w-3/4" />
            <span className="skeleton block h-4 w-1/2" />
          </li>
        )}
        <AnimatePresence initial={false}>
          {steps.map((s) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3"
            >
              {s.status === 'done' ? (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal/20 text-teal">
                  <CheckIcon width={14} height={14} />
                </span>
              ) : (
                <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                  <span className="pulse-soft h-2.5 w-2.5 rounded-full bg-saffron" />
                </span>
              )}
              <span className={s.status === 'done' ? 'text-ink/70' : 'font-medium text-ink'}>{s.label}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
