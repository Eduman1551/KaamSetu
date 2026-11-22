import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

interface Props {
  to: number;
  duration?: number;
  suffix?: string;
  /** Called on every frame with the current value (used by the score ring). */
  onValue?: (v: number) => void;
}

/** Counts from 0 to `to`, but only once it scrolls into view. */
export default function CountUp({ to, duration = 1.2, suffix = '', onValue }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (reduce) {
      setValue(to);
      onValue?.(to);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        setValue(Math.round(v));
        onValue?.(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, to, duration, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}
