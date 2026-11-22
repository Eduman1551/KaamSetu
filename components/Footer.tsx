import { BridgeLogo, ShieldIcon } from './Icons';

const TEAM = ['Ayushman Singh Shekhawat', 'Paarth Singh', 'Vinayak', 'Tanush Goyal'];

export default function Footer() {
  return (
    <footer id="privacy" className="mt-16 border-t border-ink/10 bg-navy-950/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <BridgeLogo width={34} height={24} />
            <span className="font-heading text-lg font-bold">
              Kaam<span className="text-saffron">Setu</span>
            </span>
          </div>
          <p className="flex max-w-prose items-start gap-2.5 text-[15px] text-ink/75">
            <ShieldIcon className="mt-0.5 shrink-0 text-teal" width={18} height={18} />
            <span>
              Privacy first: your resume file and its raw text are processed in memory and never stored. Companies only
              see an anonymous, verified profile, and only if you switch visibility on.
            </span>
          </p>
        </div>
        <div className="md:text-right">
          <p className="kicker mb-2">Built by</p>
          <p className="text-[15px]">{TEAM.join(' · ')}</p>
          <p className="mt-4 text-sm text-ink/70">Built for Engineering for Social Empowerment</p>
          <p className="meta mt-1">Skill trends come from today&apos;s live listings: a signal, not a guarantee.</p>
        </div>
      </div>
    </footer>
  );
}
