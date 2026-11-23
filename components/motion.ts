// Shared Framer Motion presets so every section animates the same way.
import type { Variants } from 'framer-motion';

/** Fade + slide up 24px. Used with whileInView + viewport once:true. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

/** Parent that staggers its children by 80 ms. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.2 } } as const;

/** Hover/tap feedback for buttons: lift + press. */
export const pressable = { whileHover: { y: -2 }, whileTap: { y: 1, scale: 0.98 } } as const;

/** Map a 0-100 score to the dashboard palette: terracotta -> saffron -> sage. */
export function scoreColor(v: number): string {
  if (v < 50) return '#C8553D';
  if (v < 75) return '#E8842C';
  return '#5E8C6A';
}

/** Darker shades of the same colours for text (AA on white). */
export function scoreTextColor(v: number): string {
  if (v < 50) return '#B0442E';
  if (v < 75) return '#A9561A';
  return '#46704F';
}
