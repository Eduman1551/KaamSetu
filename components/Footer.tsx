import { motion } from 'framer-motion';
import { BridgeLogo, ShieldIcon, TrashIcon } from './Icons';
import { pressable } from './motion';

// Edit this list with your team's names.
const TEAM = ['Team KaamSetu'];

export default function Footer({ onDelete }: { onDelete: () => void }) {
  return (
    <footer id="privacy" className="mt-24 border-t border-ink/10 bg-navy-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr] md:px-8">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <BridgeLogo />
            <span className="font-heading text-xl font-bold">
              Kaam<span className="text-saffron">Setu</span>
            </span>
          </div>
          <p className="flex max-w-xl items-start gap-3 text-ink/80">
            <ShieldIcon className="mt-1 shrink-0 text-teal" />
            <span>
              Privacy first: your resume is processed in memory only and never stored. Results and proof screenshots
              auto-delete after the session ends — or delete them yourself any time.
            </span>
          </p>
          <motion.button
            {...pressable}
            onClick={onDelete}
            className="btn mt-6 border-2 border-ink/30 !py-3 text-ink hover:border-miss hover:text-miss"
          >
            <TrashIcon /> Delete my data
          </motion.button>
        </div>
        <div className="md:text-right">
          <p className="kicker mb-2">Built by</p>
          <p className="text-lg">{TEAM.join(' · ')}</p>
          <p className="mt-6 text-ink/75">Built for Engineering for Social Empowerment</p>
          <p className="mt-2 text-base text-ink/60">
            Skill trends come from today&apos;s live listings — a signal, not a guarantee.
          </p>
        </div>
      </div>
    </footer>
  );
}
